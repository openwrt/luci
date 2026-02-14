'use strict';
'require view';
'require uci';
'require rpc';
'require form';
'require fs';

const callLeds = rpc.declare({
	object: 'luci',
	method: 'getLEDs',
	expect: { '': {} }
});

return view.extend({
	load() {
		return Promise.all([
			callLeds(),
			L.resolveDefault(fs.list('/www' + L.resource('view/system/led-trigger')), [])
		]).then(function([leds, plugins]) {
			const tasks = [];

			for (let p of plugins) {
				const m = p.name.match(/^(.+)\.js$/);

				if (p.type != 'file' || m == null)
					continue;

				tasks.push(L.require('view.system.led-trigger.' + m[1]).then(L.bind(function(name){
					return L.resolveDefault(L.require('view.system.led-trigger.' + name)).then(function(form) {
						return {
							name: name,
							form: form,
						};
					});
				}, this, m[1])));
			}

			return Promise.all(tasks).then(function(plugins) {
				return [leds, plugins];
			});
		});
	},

	render([leds, plugins]) {
		let m, s, o;
		const triggers = [];

		for (let k in leds)
			for (let t of leds[k].triggers)
				triggers.push(t);

		m = new form.Map('system',
			_('<abbr title="Light Emitting Diode">LED</abbr> Configuration'),
			_('Customizes the behaviour of the device <abbr title="Light Emitting Diode">LED</abbr>s if possible.'));

		s = m.section(form.GridSection, 'led', '');
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.addbtntitle = _('Add LED action');
		s.nodescriptions = true;

		s.option(form.Value, 'name', _('Name'));

		o = s.option(form.ListValue, 'sysfs', _('<abbr title="Light Emitting Diode">LED</abbr> Name'));
		Object.keys(leds).sort().forEach(function(name) {
			o.value(name)
		});

		o = s.option(form.ListValue, 'trigger', _('Trigger'));
		for (let plugin of plugins) {
			if ( plugin.form.kernel == false ) {
				o.value(plugin.name, plugin.form.trigger);
			}
			else {
				if (triggers.indexOf(plugin.name) >= 0)
					o.value(plugin.name, plugin.form.trigger);
			}
		}
		o.onchange = function(ev, section, value) {
			const nes = this.map.findElement('id', 'cbid.system.%s.trigger'.format(section)).nextElementSibling;
			for (let plugin of plugins) {
				if ( plugin.name === value && nes )
					nes.innerText = plugin.form.description || '';
			}
		}
		o.load = function(section_id) {
			const trigger = uci.get('system', section_id, 'trigger');
			for (let plugin of plugins) {
				if ( plugin.name === trigger)
					this.description = plugin.form.description || ' ';
			}
			return trigger;
		};

		s.addModalOptions = function(s) {
			for (let plugin of plugins) {
				plugin.form.addFormOptions(s);
			}

			const opts = s.getOption();

			const removeIfNoneActive = function(original_remove_fn, section_id) {
				let isAnyActive = false;

				for (let optname in opts) {
					if (opts[optname].ucioption != this.ucioption)
						continue;

					if (!opts[optname].isActive(section_id))
						continue;

					isAnyActive = true;
					break;
				}

				if (!isAnyActive)
					original_remove_fn.call(this, section_id);
			};

			for (let optname in opts) {
				if (!opts[optname].ucioption || optname == opts[optname].ucioption)
					continue;
				opts[optname].remove = removeIfNoneActive.bind(opts[optname], opts[optname].remove);
			}
		};

		return m.render();
	}
});
