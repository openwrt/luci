'use strict';
'require form';
'require fs';
'require rpc';
'require uci';
'require ui';
'require view';

const RESOLV_FILE = '/tmp/resolv.conf.d/resolv.conf.auto';
const LOGERR_CMD = "logread -e 'unbound.*error.*ssl library'";
const HELP_URL = 'https://github.com/openwrt/packages/blob/master/net/unbound/files/README.md';

let section_enabled = false;
let daemon_enabled = false;

const callRcInit = rpc.declare({
	object: 'rc',
	method: 'init',
	params: [ 'name', 'action' ],
	expect: { result: false }
});

return view.extend({
	load() {
		return Promise.all([
			uci.load('unbound'),
			fs.read(RESOLV_FILE).catch(() => ''),
			fs.exec(LOGERR_CMD).catch(() => ''),
		]).then(([_, resolv, logerr]) => ({
			resolvContent: resolv || '',
			logerr: logerr ? logerr.trim().slice(-250) : null,
		}));
	},

	render({resolvContent, logerr}) {
		const m = new form.Map('unbound');

		daemon_enabled = uci.get('unbound', 'ub_main', 'enabled');

		if (logerr) {
			ui.addTimeLimitedNotification(null, E('p', _('Note: SSL/TLS library is missing an API. Please review syslog. >> logread ... ') + logerr), 7000, 'warning');
		}

		const s = m.section(form.TableSection, 'zone', _('Zones'),
			_('Organize directed forward, stub, and authoritative zones' +
			' <a href=\"%s\" target=\"_blank\">(help)</a>.'.format(HELP_URL)));
		s.anonymous = false;
		s.addremove = true;
		s.sortable = true;

		s.extedit = L.url(`admin/services/unbound/zone-details/%s`);

		const ztype = s.option(form.DummyValue, 'zone_type', _('Type'));
		ztype.rawhtml = true;
		ztype.cfgvalue = function(section_id) {
			const type = uci.get('unbound', section_id, 'zone_type');
			const tls = uci.get('unbound', section_id, 'tls_upstream');
			if (type?.includes('forward')) return tls === '1' ? _('Forward TLS') : _('Forward');
			if (type?.includes('stub')) return _('Recurse');
			if (type?.includes('auth')) return _('AXFR');
			return _('Undefined');
		};

		const zones = s.option(form.DummyValue, 'zone_name', _('Zones'));
		zones.rawhtml = true;
		zones.cfgvalue = function(section_id) {
			const type = uci.get('unbound', section_id, 'zone_type');
			const raw = uci.get('unbound', section_id, 'zone_name');
			const list = Array.isArray(raw) ? raw : raw?.split(/\s+/) || [];
			if (list.length === 0) return '(empty)';

			const html = list.map(name =>
				`<var>${name === '.' ? _('(root)') : name}</var>`
			).join(', ');

			if (type?.includes('forward')) return _('accept upstream results for ') + html;
			if (type?.includes('stub')) return _('select recursion for ') + html;
			if (type?.includes('auth')) return _('prefetch zone files for ') + html;

			return _('unknown action for ') + html;
		};

		const servers = s.option(form.DummyValue, 'server', _('Servers'));
		servers.rawhtml = true;
		servers.cfgvalue = function(section_id) {
			const servers = uci.get('unbound', section_id, 'server');
			const url = uci.get('unbound', section_id, 'url_dir');
			const type = uci.get('unbound', section_id, 'zone_type');
			const tls = uci.get('unbound', section_id, 'tls_upstream');
			const tlsName = uci.get('unbound', section_id, 'tls_index');
			const useResolv = uci.get('unbound', section_id, 'resolv_conf');

			const list = Array.isArray(servers) ? servers : servers?.split(/\s+/) || [];
			let out = list.map(s => `<var>${s}</var>`).join(', ');

			if (out) out = _('use nameservers ') + out;

			if (tls === '1' && tlsName)
				out += _(' with default certificate for <var>%s</var>'.format(tlsName));

			if (type?.includes('auth') && url)
				out += _(', and try <var>%s</var>'.format(url));
			else if (!type?.includes('auth') && url)
				out += _('download from <var>%s</var>'.format(url));

			if (type?.includes('forward') && useResolv === '1') {
				const lines = resolvContent.split('\n');
				const resolvNameservers = [];
				for (let i = 0; i < lines.length; i++) {
					if (lines[i].match(/^\s*nameserver\b/)) {
						resolvNameservers.push(`<var>${lines[i].match(/^\s*nameserver\b(.*)$/)[1]}</var>`);
					}
				}
				if (!out && resolvNameservers.length > 0)
					out = _('use <var>%s</var> nameservers '.format(RESOLV_FILE)) + resolvNameservers.join(', ');
				else if (resolvNameservers.length > 0)
					out += _(', and <var>%s</var> entries '.format(RESOLV_FILE)) + resolvNameservers.join(', ');
			}

			return out || '(empty)';
		};

		s.option(form.Flag, 'fallback', _('Fallback')).rmempty = false;
		const ena = s.option(form.Flag, 'enabled', _('Enable'))
		ena.rmempty = false;
		ena.load = (section_id) => { 
			let _temp = uci.get('unbound', section_id, 'enabled');
			if (_temp === '1') section_enabled = true;
		}

		return m.render();
	},

	handleSaveApply(ev, mode) {
		const cmd = daemon_enabled ? 'reload' : 'stop';

		const Fn = L.bind(() => {
			if (section_enabled) callRcInit('unbound', cmd);
			document.removeEventListener('uci-applied', Fn);
		});
		document.addEventListener('uci-applied', Fn);
		this.super('handleSaveApply', [ev, mode]);
	}
});
