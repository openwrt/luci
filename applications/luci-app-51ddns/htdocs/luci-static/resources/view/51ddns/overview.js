'use strict';
'require view';
'require form';
'require rpc';
'require uci';

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} },
});

const callLocalStatus = rpc.declare({
	object: 'luci.51ddns',
	method: 'status',
	expect: { '': {} },
});

const callAgentInfo = rpc.declare({
	object: 'luci.51ddns',
	method: 'info',
	expect: { '': {} },
});

function serviceState(data) {
	const instances = data?.['51ddns-agent']?.instances || {};
	const running = Object.values(instances).some(instance => instance?.running);

	return {
		running,
		label: running ? _('Running') : _('Not running'),
		className: running ? 'alert-message success' : 'alert-message warning',
	};
}

function formatDate(value) {
	const date = new Date(value || '');

	if (Number.isNaN(date.getTime()))
		return _('Synchronizing');

	return date.toLocaleString([], {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function remainingState(value) {
	const expires = new Date(value || '');

	if (Number.isNaN(expires.getTime()))
		return { label: _('Synchronizing'), className: 'alert-message notice' };

	const milliseconds = expires.getTime() - Date.now();
	if (milliseconds <= 0)
		return { label: _('Expired'), className: 'alert-message error' };

	const hours = Math.ceil(milliseconds / 3600000);
	const days = Math.ceil(hours / 24);
	const label = hours > 48
		? N_(days, 'About %d day', 'About %d days').format(days)
		: N_(hours, '%d hour', '%d hours').format(hours);

	return {
		label,
		className: milliseconds <= 3 * 86400000
			? 'alert-message warning'
			: 'alert-message success',
	};
}

return view.extend({
	load() {
		return Promise.all([
			uci.load('51ddns'),
			L.resolveDefault(callServiceList('51ddns-agent'), {}),
			L.resolveDefault(callLocalStatus(), {}),
			L.resolveDefault(callAgentInfo(), {}),
		]);
	},

	render(data) {
		const state = serviceState(data[1]);
		const local = data[2] || {};
		const info = data[3] || {};
		const plan = local.plan || null;
		const remaining = remainingState(plan?.expires_at);
		const map = new form.Map(
			'51ddns',
			_('51DDNS Remote Access'),
			_('Enter the account token once to register this router automatically. Device identity and relay settings are managed by the 51DDNS control plane.'),
		);
		const section = map.section(form.NamedSection, 'main', 'agent', _('Quick setup'));
		section.addremove = false;

		const status = section.option(form.DummyValue, '_status', _('Service status'));
		status.rawhtml = true;
		status.cfgvalue = () =>
			`<span class="${state.className}"><strong>${state.label}</strong></span>`;

		const version = section.option(form.DummyValue, '_version', _('Agent version'));
		version.cfgvalue = () => info.version || _('Unavailable');

		const planName = section.option(form.DummyValue, '_plan_name', _('Current plan'));
		planName.cfgvalue = () => plan?.product_name || _('No active plan');

		const expiresAt = section.option(form.DummyValue, '_expires_at', _('Expires at'));
		expiresAt.cfgvalue = () => plan ? formatDate(plan.expires_at) : _('Not bound');

		const remainingTime = section.option(form.DummyValue, '_remaining_time', _('Time remaining'));
		remainingTime.rawhtml = true;
		remainingTime.cfgvalue = () => {
			if (!plan)
				return `<span class="alert-message warning"><strong>${_('Bind or purchase a plan')}</strong></span>`;

			return `<span class="${remaining.className}"><strong>${remaining.label}</strong></span>`;
		};

		const consoleButton = section.option(form.Button, '_console', _('Console'));
		consoleButton.inputtitle = _('Open 51DDNS Console');
		consoleButton.inputstyle = 'apply';
		consoleButton.onclick = () =>
			window.open('https://console.51ddns.com/console#/workbench', '_blank', 'noopener,noreferrer');

		const enabled = section.option(form.Flag, 'enabled', _('Enable'));
		enabled.rmempty = false;
		enabled.default = enabled.disabled;

		const token = section.option(form.Value, 'account_token', _('Account token'));
		token.password = true;
		token.rmempty = false;
		token.placeholder = '51d_...';
		token.description = _('Copy the token from the 51DDNS console. All devices in the same account share this token.');

		return map.render();
	},
});
