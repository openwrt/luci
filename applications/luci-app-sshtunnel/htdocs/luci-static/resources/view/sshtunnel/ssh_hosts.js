'use strict';
'require form';
'require fs';
'require ui';
'require view';


return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load: function () {
		return Promise.all([
			fs.lines('/root/.ssh/known_hosts'),
		]);
	},

	render: function (data) {
		var knownHosts = data[0];

		var m, s, o;

		m = new form.Map('sshtunnel', _('SSH Tunnels'),
			_('This configures <a %s>SSH Tunnels</a>.')
				.format('href="https://openwrt.org/docs/guide-user/services/ssh/sshtunnel"')
		);

		s = m.section(form.GridSection, '_known_hosts');
		s.render = L.bind(_renderKnownHosts, this, knownHosts);

		return m.render();
	},
});

function _renderKnownHosts(knownHosts) {
	var table = E('table', {'class': 'table cbi-section-table', 'id': 'known_hosts'}, [
		E('tr', {'class': 'tr table-titles'}, [
			E('th', {'class': 'th'}, _('Hostname')),
			E('th', {'class': 'th'}, _('Public Key')),
		])
	]);

	var rows = _splitKnownHosts(knownHosts);
	cbi_update_table(table, rows);

	return E('div', {'class': 'cbi-section cbi-tblsection'}, [
		E('h3', _('Known hosts ')),
		E('div', {'class': 'cbi-section-descr'},
			_('Keys of SSH servers found in %s.').format('<code>/root/.ssh/known_hosts</code>')
		),
		table
	]);
}

function _splitKnownHosts(knownHosts) {
	var knownHostsMap = [];
	for (var i = 0; i < knownHosts.length; i++) {
		var sp = knownHosts[i].indexOf(' ');
		if (sp < 0) {
			continue;
		}
		var hostname = knownHosts[i].substring(0, sp);
		var pub = knownHosts[i].substring(sp + 1);
		knownHostsMap.push([hostname, '<small><code>' + pub + '</code></small>']);
	}
	return knownHostsMap;
}
