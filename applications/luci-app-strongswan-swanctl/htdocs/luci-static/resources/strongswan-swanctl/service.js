'use strict';
'require baseclass';
'require rpc';
'require uci';
'require ui';

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

return baseclass.extend({
	/**
	 * Resolve to true if the IPsec service is enabled. The service is
	 * enabled if the option 'enabled' in the 'globals' section is not set.
	 */
	isEnabled: function () {
		return L.resolveDefault(uci.load('ipsec'), null).then(function () {
			switch (uci.get('ipsec', 'globals', 'enabled')) {
			case '0':
			case 'off':
			case 'false':
			case 'no':
			case 'disabled':
				return false;
			}
			return true;
		});
	},

	/**
	 * Resolve to the procd state of the swanctl service. The state contains
	 * whether at least one instance is running and the errors reported by
	 * the init script.
	 */
	getProcdState: function () {
		return L.resolveDefault(callServiceList('swanctl'), {}).then(function (res) {
			const service = res?.swanctl ?? {};
			const instances = Object.values(service.instances ?? {});
			const errors = [].concat(service.errors ?? [], ...instances.map(i => i.errors ?? []));

			return {
				running: instances.some(i => i.running),
				errors: [...new Set(errors)]
			};
		});
	},

	/**
	 * Resolve to the state of the IPsec service with the properties
	 * 'enabled', 'running' and 'errors'.
	 */
	getState: function () {
		return Promise.all([
			this.isEnabled(),
			this.getProcdState()
		]).then(function ([enabled, procd]) {
			return {
				enabled: enabled,
				running: enabled && procd.running,
				errors: procd.errors
			};
		});
	},

	/**
	 * Enable the IPsec service and apply the change. The reload trigger of
	 * the init script then starts the service and the page is reloaded.
	 */
	enable: function () {
		return uci.load('ipsec')
			.then(function () {
				uci.set('ipsec', 'globals', 'enabled', '1');
				return uci.save();
			})
			.then(L.bind(ui.changes.init, ui.changes))
			.then(L.bind(ui.changes.apply, ui.changes))
			.catch(e => ui.addNotification(null, E('p', e.message)));
	},

	/**
	 * Return a warning banner with an enable button.
	 */
	disabledBanner: function (description) {
		return E('div', { 'class': 'alert-message warning' }, [
			E('h4', _('The IPsec service is disabled')),
			E('p', description),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-positive',
					'click': ui.createHandlerFn(this, 'enable')
				}, [_('Enable service')])
			])
		]);
	},

	/**
	 * Return an error banner with the errors reported by the init script.
	 */
	notRunningBanner: function (errors) {
		return E('div', { 'class': 'alert-message error' }, [
			E('h4', _('The IPsec service is not running')),
			E('p', _('The IPsec service is enabled but not running. Check the system log for details.')),
			errors.length ? E('ul', errors.map(e => E('li', e))) : ''
		]);
	},

	/**
	 * Return the banner matching the given service state, or null if the
	 * service is running. The description is shown if the service is
	 * disabled.
	 */
	banner: function (state, description) {
		if (!state.enabled)
			return this.disabledBanner(description);
		if (!state.running)
			return this.notRunningBanner(state.errors);
		return null;
	},

	/**
	 * Insert the banner, if the service is disabled or not running, at the
	 * top of a rendered view node.
	 */
	prepend: function (node, description) {
		return this.getState().then(L.bind(function (state) {
			const banner = this.banner(state, description);
			if (banner)
				node.insertBefore(banner, node.firstChild);
			return node;
		}, this));
	}
});
