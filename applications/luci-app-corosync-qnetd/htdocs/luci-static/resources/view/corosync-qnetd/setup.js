'use strict';
'require view';
'require dom';
'require rpc';
'require poll';
'require ui';
'require corosync.qnetd as qnetd';
/* global qnetd */

const callInterfaces = rpc.declare({ object: 'network.interface', method: 'dump', expect: { interface: [] } });

function addresses(dump) {
	const result = [];
	for (const iface of (dump.interface || [])) {
		if (iface.interface === 'loopback') continue;
		for (const item of (iface['ipv4-address'] || []))
			if (item.address && !item.address.startsWith('127.')) result.push({ address: item.address, label: '%s (%s)'.format(item.address, iface.interface) });
		for (const item of (iface['ipv6-address'] || []))
			if (item.address && !item.address.toLowerCase().startsWith('fe80:') && item.address !== '::1') result.push({ address: item.address, label: '%s (%s)'.format(item.address, iface.interface) });
	}
	return result;
}

function shellAddress(address) {
	return "'" + String(address).replace(/'/g, "'\\''") + "'";
}

function enrollment(address) {
	const nodeCount = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'min': '2', 'value': '2', 'style': 'width:7em' });
	const acknowledge = E('input', { 'type': 'checkbox' });
	const acknowledgeLabel = E('label', { 'style': 'display:none' }, [ acknowledge, ' ', _('I understand the odd-node Last Man Standing trade-off and want the forced command.') ]);
	const commands = E('div');
	const progress = E('div');

	function update() {
		const n = Math.max(2, Number(nodeCount.value) || 2);
		const odd = n % 2 === 1;
		acknowledgeLabel.style.display = odd ? '' : 'none';
		if (odd && !acknowledge.checked) {
			dom.content(commands, E('div', { 'class': 'alert-message warning' }, _('Proxmox discourages adding a QDevice to an odd-sized cluster. A forced setup selects Last Man Standing and makes the QNetd host part of the availability model. Acknowledge this before generating the command.')));
			return;
		}
		const force = odd ? ' --force' : '';
		const allNodes = 'apt update\napt install --yes corosync-qdevice';
		const oneNode = 'pvecm status\npvecm qdevice setup %s%s\npvecm status\ncorosync-qdevice-tool -sv'.format(shellAddress(address), force);
		dom.content(commands, [
			E('h4', _('Run on every Proxmox node')), qnetd.commandBox(allNodes),
			E('h4', _('Then run on one Proxmox node')), qnetd.commandBox(oneNode),
			E('p', _('All cluster nodes must be online during setup. The Proxmox command uses SSH to enroll against this router.'))
		]);
	}

	nodeCount.addEventListener('input', update);
	acknowledge.addEventListener('change', update);
	update();
	poll.add(() => qnetd.status().then(s => {
		const connected = qnetd.clients(s);
		dom.content(progress, connected == null
			? E('div', { 'class': 'alert-message notice' }, _('Connected client count: Unknown'))
			: connected
			? E('div', { 'class': 'alert-message success' }, _('%d QNetd client(s) connected. Enrollment is visible and TLS status is available on the Overview page.').format(connected))
			: E('div', { 'class': 'alert-message notice' }, _('Waiting for a Proxmox cluster to connect…')));
	}), 5);

	return E('div', { 'class': 'cbi-section' }, [
		E('h3', _('Proxmox enrollment commands')),
		E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Cluster node count')), E('div', { 'class': 'cbi-value-field' }, nodeCount) ]),
		acknowledgeLabel,
		commands, progress
	]);
}

return view.extend({
	load: () => Promise.all([ qnetd.status(), callInterfaces() ]),
	render(data) {
		const status = data[0];
		const candidates = addresses(data[1]);
		const selected = E('select', { 'class': 'cbi-input-select' }, candidates.map(a => E('option', { 'value': a.address }, a.label)));
		const initial = status.config?.listen_address || candidates[0]?.address || '';
		selected.value = initial;
		const setupArea = E('div');

		if (status.health?.initialized)
			dom.content(setupArea, enrollment(initial));
		else
			dom.content(setupArea, E('div', { 'class': 'cbi-section' }, [
			E('h3', _('Initialize QNetd')),
			E('p', _('Choose the stable router address reachable from the Proxmox nodes. Setup creates the local CA and server certificate, enables QNetd, and starts it with TLS and client certificates required.')),
			E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Listen address')), E('div', { 'class': 'cbi-value-field' }, selected) ]),
			!candidates.length ? E('div', { 'class': 'alert-message warning' }, _('No non-loopback local address was discovered. Configure the network first.')) : '',
			E('button', { 'class': 'btn cbi-button cbi-button-action important', 'disabled': !candidates.length ? '' : null, 'click': ui.createHandlerFn(this, () => qnetd.run(qnetd.setup(selected.value)).then(() => location.reload())) }, _('Initialize and start'))
		]));

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', _('Corosync QNetd setup')),
			E('p', [ _('This workflow follows the '), E('a', {
				'href': 'https://pve.proxmox.com/pve-docs/chapter-pvecm.html#_corosync_external_vote_support',
				'target': '_blank',
				'rel': 'noreferrer noopener'
			}, _('official Proxmox QDevice guide')), _('.') ]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Preflight checks')),
				E('ul', [
					E('li', [ qnetd.badge(status.installed, _('Ready'), _('Missing')), ' ', _('QNetd package and maintenance helper') ]),
					E('li', [ qnetd.badge(status.dropbear_running, _('Running'), _('Stopped')), ' ', _('SSH server (needed by the official Proxmox enrollment command)') ]),
					E('li', [ qnetd.badge(status.firewall_rule_found, _('Rule found'), _('Check required')), ' ', _('Firewall rule accepting TCP port 5403') ]),
					E('li', [ qnetd.badge((status.system_time || 0) > 1577836800, _('Plausible'), _('Incorrect')), ' ', _('System time for certificate validation') ])
				]),
				!status.firewall_rule_found ? E('p', [ _('Add an explicit firewall rule allowing TCP port 5403 from the Proxmox management network. '), E('a', { 'href': L.url('admin/network/firewall/rules') }, _('Open firewall rules')) ]) : '',
				!status.dropbear_running ? E('p', _('Enable the SSH server and ensure root key authentication works from a Proxmox node. LuCI does not store Proxmox credentials.')) : ''
			]),
			setupArea
		]);
	},
	handleSaveApply: null, handleSave: null, handleReset: null
});
