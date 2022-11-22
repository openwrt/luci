// Copyright 2022 Jo-Philipp Wich <jo@mein.io>
// Licensed to the public under the Apache License 2.0.

import { access, basename } from 'fs';
import { cursor } from 'uci';

const template_directory = '/usr/share/ucode/luci/template';

function cut_message(msg) {
	return trim(replace(msg, /\n--\n.*$/, ''));
}

function format_nested_exception(ex) {
	let msg = replace(cut_message(ex.message), /(\n+(  \|[^\n]*(\n|$))+)/, (m, m1) => {
		m1 = replace(m1, /(^|\n)  \| ?/g, '$1');
		m = match(m1, /^(.+?)\n(In.*line \d+, byte \d+:.+)$/);

		return `
			<div class="exception">
				<div class="message">${cut_message(m ? m[1] : m1)}</div>
				${m ? `<pre class="context">${trim(m[2])}</pre>` : ''}
			</div>
		`;
	});

	return `
		<div class="exception">
			<div class="message">${cut_message(msg)}</div>
			<pre class="context">${trim(ex.stacktrace[0].context)}</pre>
		</div>
	`;
}

function format_lua_exception(ex) {
	let m = match(ex.message, /^(.+)\nstack traceback:\n(.+)$/);

	return `
		<div class="exception">
			<div class="message">${cut_message(m ? m[1] : ex.message)}</div>
			<pre class="context">${m ? trim(replace(m[2], /(^|\n)\t/g, '$1')) : ex.stacktrace[0].context}</pre>
		</div>
	`;
}

const Class = {
	init_lua: function(optional) {
		if (!this.L) {
			let bridge = this.env.dispatcher.load_luabridge(optional);

			if (bridge) {
				let http = this.env.http;

				this.L = bridge.create();
				this.L.set('L', proto({ write: (...args) => http.closed || print(...args) }, this.env));
				this.L.invoke('require', 'luci.ucodebridge');

				this.env.lua_active = true;
			}
		}

		return this.L;
	},

	is_ucode_template: function(path) {
		return access(`${template_directory}/${path}.ut`);
	},

	render_ucode: function(path, scope) {
		let tmplfunc = loadfile(path, { raw_mode: false });

		if (this.env.http.closed)
			render(call, tmplfunc, null, scope ?? {});
		else
			call(tmplfunc, null, scope ?? {});
	},

	render_lua: function(path, scope) {
		let vm = this.init_lua();
		let render = vm.get('_G', 'luci', 'ucodebridge', 'render');

		render.call(path, scope ?? {});
	},

	trycompile: function(path) {
		let ucode_path = `${template_directory}/${path}.ut`;

		if (access(ucode_path)) {
			try {
				loadfile(ucode_path, { raw_mode: false });
			}
			catch (ucode_err) {
				return `Unable to compile '${path}' as ucode template: ${format_nested_exception(ucode_err)}`;
			}
		}
		else {
			try {
				let vm = this.init_lua(true);

				if (vm)
					vm.get('_G', 'luci', 'ucodebridge', 'compile').call(path);
				else
					return `Unable to compile '${path}' as Lua template: Unable to load Lua runtime`;
			}
			catch (lua_err) {
				return `Unable to compile '${path}' as Lua template: ${format_lua_exception(lua_err)}`;
			}
		}

		return true;
	},

	render_any: function(path, scope) {
		let ucode_path = `${template_directory}/${path}.ut`;

		scope = proto(scope ?? {}, this.scopes[-1]);

		push(this.scopes, scope);

		try {
			if (access(ucode_path))
				this.render_ucode(ucode_path, scope);
			else
				this.render_lua(path, scope);
		}
		catch (ex) {
			pop(this.scopes);
			die(ex);
		}

		pop(this.scopes);
	},

	render: function(path, scope) {
		let self = this;
		this.env.http.write(render(() => self.render_any(path, scope)));
	},

	call: function(modname, method, ...args) {
		let vm = this.init_lua();
		let lcall = vm.get('_G', 'luci', 'ucodebridge', 'call');

		return lcall.call(modname, method, ...args);
	}
};

export default function(env) {
	const self = proto({ env: env ??= {}, scopes: [ proto(env, global) ], global }, Class);
	const uci = cursor();

	// determine theme
	let media = uci.get('luci', 'main', 'mediaurlbase');
	let status = self.trycompile(`themes/${basename(media)}/header`);

	if (status !== true) {
		media = null;
		self.env.media_error = status;

		for (let k, v in uci.get_all('luci', 'themes')) {
			if (substr(k, 0, 1) != '.') {
				status = self.trycompile(`themes/${basename(v)}/header`);

				if (status === true) {
					media = v;
					break;
				}
			}
		}

		if (!media)
			error500(`Unable to render any theme header template, last error was:\n${status}`);
	}

	self.env.media = media;
	self.env.theme = basename(media);
	self.env.resource = uci.get('luci', 'main', 'resourcebase');
	self.env.include = (...args) => self.render_any(...args);

	return self;
};
