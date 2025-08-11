'use strict';
'require dom';
'require fs';
'require poll';
'require view';

const FILENAME = '/usr/sbin/unbound-control';

return view.extend({
	load() {
		return L.resolveDefault(fs.stat(FILENAME), "")
			.then(stat => {
			if (!stat) {
				return Promise.all([
					L.resolveDefault(fs.stat('/sbin/logread'), {path: ''}),
					L.resolveDefault('', {path: ''}),
				]);
			} else {
				return Promise.all([
					L.resolveDefault(fs.stat('/sbin/logread'), {path: ''}),
					L.resolveDefault(fs.stat(FILENAME), {path: false}),
					L.resolveDefault(fs.exec_direct(FILENAME, ['-c', '/var/lib/unbound/unbound.conf', 'stats_noreset']).then(data => {return data}), {}),
					L.resolveDefault(fs.exec_direct(FILENAME, ['-c', '/var/lib/unbound/unbound.conf', 'list_local_data']).then(data => {return data}), {}),
					L.resolveDefault(fs.exec_direct(FILENAME, ['-c', '/var/lib/unbound/unbound.conf', 'list_local_zones']).then(data => {return data}), {}),
					L.resolveDefault(fs.exec_direct(FILENAME, ['-c', '/var/lib/unbound/unbound.conf', 'dump_cache']).then(data => {return data}), {}),
				]);
			}
		});
	},

	render([logread, uc, stats, data, zones, cache]) {

		L.Poll.add(() => {
			return L.resolveDefault(fs.exec_direct(logread.path, ['-e', 'unbound:'])).then(function(res) {
				const log = document.getElementById("logfile");
				log.value = res ? res.trim() : _('No related logs yet!');
				log.scrollTop = log.scrollHeight;
			});
		});

		if (uc.path) {
			// Stats
			L.Poll.add(() => {
				return L.resolveDefault(fs.exec_direct('/usr/sbin/unbound-control', ['-c', '/var/lib/unbound/unbound.conf', 'stats_noreset'])).then(function(res) {
					const stats = document.getElementById("stats");
					stats.value = res ? res.trim() : _('No stats yet!');
				});
			});
			// Local Data
			L.Poll.add(() => {
				return L.resolveDefault(fs.exec_direct('/usr/sbin/unbound-control', ['-c', '/var/lib/unbound/unbound.conf', 'list_local_data'])).then(function(res) {
					const ld = document.getElementById("local_data");
					ld.value = res ? res.trim() : _('No local data yet!');
					ld.scrollTop = ld.scrollHeight;
				});
			});
			// Zones Data
			L.Poll.add(() => {
				return L.resolveDefault(fs.exec_direct('/usr/sbin/unbound-control', ['-c', '/var/lib/unbound/unbound.conf', 'list_local_zones'])).then(function(res) {
					const zd = document.getElementById("zones_data");
					zd.value = res ? rest.trim() :_('No zones data yet!');
					zd.scrollTop = zd.scrollHeight;
				});
			});
			// Cache Dump
			L.Poll.add(() => {
				return L.resolveDefault(fs.exec_direct('/usr/sbin/unbound-control', ['-c', '/var/lib/unbound/unbound.conf', 'dump_cache'])).then(function(res) {
					const dc = document.getElementById("cache_dump");
					dc.value = res ? (res.length > 262144 ? _('Unbound cache is too large to display in LuCI.') : res.trim()) : _('No cache dump yet!');
					dc.scrollTop = dc.scrollHeight;
				});
			});
		}

		return E('div', [
				(!uc.path) ?
				E('div', { class: 'cbi-section' }, [
					E('div', { class: 'cbi-section-descr' }, _('This could display more statistics with the unbound-control package.')),
				]) : '',
				(uc.path) ?
				E('div', { class: 'cbi-section' }, [
					E('div', { class: 'cbi-section-descr' }, _('This shows Unbound self reported performance statistics.')),
					E('textarea', {
						'id': 'stats',
						'style': 'width: 100% !important; padding: 5px; font-family: monospace',
						'readonly': 'readonly',
						'wrap': 'off',
						'rows': 10,
						'value': stats,
						'placeholder': _('Statistics'),
				})]) : '',
				(uc.path) ?
				E('div', { class: 'cbi-section' }, [
					E('div', { class: 'cbi-section-descr' }, _("This shows Unbound 'local-data:' entries from default, .conf, or control.")),
					E('textarea', {
						'id': 'local_data',
						'style': 'width: 100% !important; padding: 5px; font-family: monospace',
						'readonly': 'readonly',
						'wrap': 'off',
						'rows': 10,
						'value': data,
						'placeholder': _('Local Data'),
				})]) : '',
				(uc.path) ?
				E('div', { class: 'cbi-section' }, [
					E('div', { class: 'cbi-section-descr' }, _("This shows Unbound 'local-zone:' entries from default, .conf, or control.")),
					E('textarea', {
						'id': 'zones_data',
						'style': 'width: 100% !important; padding: 5px; font-family: monospace',
						'readonly': 'readonly',
						'wrap': 'off',
						'rows': 10,
						'value': zones,
						'placeholder': _('Local Zones'),
				})]) : '',
				(uc.path) ?
				E('div', { class: 'cbi-section' }, [
					E('div', { class: 'cbi-section-descr' }, _("This shows 'ubound-control dump_cache' for auditing records including DNSSEC.")),
					E('textarea', {
						'id': 'cache_dump',
						'style': 'width: 100% !important; padding: 5px; font-family: monospace',
						'readonly': 'readonly',
						'wrap': 'off',
						'rows': 10,
						'value': cache,
						'placeholder': _('DNS Cache'),
				})]) : '',
				E('div', { class: 'cbi-map' },
					E('div', { class: 'cbi-section' }, [
					E('div', { class: 'cbi-section-descr' }, _('This shows syslog filtered for events involving Unbound.')),
					E('textarea', {
						'id': 'logfile',
						'style': 'width: 100% !important; padding: 5px; font-family: monospace',
						'readonly': 'readonly',
						'wrap': 'off',
						'rows': 25,
						'placeholder': _('Log'),
					}),
				])),
			]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
