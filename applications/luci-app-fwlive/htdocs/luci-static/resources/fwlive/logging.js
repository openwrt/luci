'use strict';
'require baseclass';
'require fwlive.links as links';

/**
 * Logging toolbar and empty-state DOM renderers for luci-app-fwlive.
 *
 * renderToolbar(host, state, callbacks) → void
 *   host      - #fwlive-logging-bar strip slot (cleared and rebuilt; element kept)
 *   state     - { loggingStatus, loggingBusy, entriesLength, loggingNotice }
 *   callbacks - { onEnable(), onDisable() }
 *
 * G Hybrid chrome: when WAN logging is on, one merged control carries status +
 * rate (click disables). When off, filled Enable CTA. Blockers stay status text.
 *
 * renderManualTestNodes(host, state, callbacks) → void
 *   host      - <ul> element inside #fwlive-help (cleared and rebuilt)
 *   state     - { firewallBackend }
 *
 * Empty-state helpers:
 *   buildEmptyStateNodes(state, callbacks) → Node[]
 *   renderEmptyState(host, state, callbacks) → void
 *     state     - loggingState + { showConsent }
 *     callbacks - { onEnable(), onDismissConsent(persist) }
 *
 * Modules must not mutate state. host is cleared then rebuilt (idempotent replace).
 */

const CONSENT_STORAGE_KEY = 'fwlive-logging-consent-v1';

function consentDismissedPermanent() {
	try {
		return localStorage.getItem(CONSENT_STORAGE_KEY) === '1';
	} catch (e) {
		return false;
	}
}

function persistConsentDismissed() {
	try {
		localStorage.setItem(CONSENT_STORAGE_KEY, '1');
	} catch (e) {
		/* private mode / no storage */
	}
}

function blockerCode(state) {
	const blockers = (state.loggingStatus && state.loggingStatus.blockers) || [];
	if (blockers.indexOf('no_wan_zone') >= 0)
		return 'no_wan_zone';
	if (blockers.indexOf('nf_log_ipv4_missing') >= 0 ||
	    blockers.indexOf('nf_log_ipv6_missing') >= 0)
		return 'nf_log_missing';
	return '';
}

function renderToolbar(host, state, callbacks) {
	host.innerHTML = '';
	const st = state.loggingStatus;
	if (!st) {
		host.style.display = 'none';
		return;
	}

	host.style.display = 'contents';
	const blocker = blockerCode(state);

	if (blocker === 'no_wan_zone') {
		host.appendChild(E('span', { 'class': 'fwlive-logging-status' },
			[ _('WAN logging unavailable: no WAN zone') ]));
		host.appendChild(links.firewallZonesLink());
		return;
	}

	if (blocker === 'nf_log_missing') {
		host.appendChild(E('span', { 'class': 'fwlive-logging-status' },
			[ _('WAN logging unavailable: missing kernel log modules') ]));
		return;
	}

	const limit = st.wan_log_limit || _('default 10/minute');
	if (st.wan_log) {
		const busy = !!state.loggingBusy;
		const children = busy
			? [ _('Disabling…') ]
			: [
				E('span', { 'class': 'fwlive-log-on-dot', 'aria-hidden': 'true' }, [ '' ]),
				E('span', { 'class': 'fwlive-log-label' }, [ _('WAN logging on') ]),
				E('span', { 'class': 'fwlive-log-rate' }, [ _('· %s').format(limit) ])
			];
		host.appendChild(E('button', {
			'class': 'cbi-button fwlive-log-merged',
			'type': 'button',
			'title': _('WAN logging on (%s). Click to disable.').format(limit),
			'disabled': busy ? '' : null,
			'click': function() { callbacks.onDisable(); }
		}, children));
		return;
	}

	host.appendChild(E('button', {
		'class': 'cbi-button cbi-button-action',
		'type': 'button',
		'title': _('Enable WAN zone drop/reject logging (same as Network → Firewall).'),
		'disabled': state.loggingBusy ? '' : null,
		'click': function() { callbacks.onEnable(); }
	}, [ state.loggingBusy ? _('Enabling…') : _('Enable logging') ]));
}

function buildConsentPanel(state, callbacks) {
	const dontShowId = 'fwlive-consent-dont-show';
	const panel = E('div', { 'class': 'fwlive-consent', 'id': 'fwlive-consent' }, [
		E('p', { 'class': 'fwlive-empty-title' }, [ _('Before you enable logging') ]),
		E('ul', { 'class': 'fwlive-consent-list' }, [
			E('li', {}, [
				E('strong', {}, [ _('Changes:') ]),
				' ',
				_('sets log on the WAN firewall zone and reloads the firewall.')
			]),
			E('li', {}, [
				E('strong', {}, [ _('Does not change:') ]),
				' ',
				_('allow/deny rules, LAN logging, or anything else.')
			]),
			E('li', {}, [
				E('strong', {}, [ _('Undo:') ]),
				' ',
				_('turn it back off with the WAN logging on control on the watch strip.')
			])
		]),
		E('p', { 'class': 'fwlive-consent-check' }, [
			E('label', {}, [
				E('input', {
					'type': 'checkbox',
					'id': dontShowId
				}),
				' ',
				_('Don’t show this again')
			])
		]),
		E('p', { 'class': 'fwlive-consent-actions' }, [
			E('button', {
				'class': 'cbi-button cbi-button-action',
				'type': 'button',
				'disabled': state.loggingBusy ? '' : null,
				'click': function() {
					persistConsentDismissed();
					callbacks.onEnable();
				}
			}, [ state.loggingBusy ? _('Enabling…') : _('Enable WAN drop/reject logging') ]),
			' ',
			E('button', {
				'class': 'cbi-button',
				'type': 'button',
				'click': function() {
					const box = document.getElementById(dontShowId);
					const persist = !!(box && box.checked);
					if (persist)
						persistConsentDismissed();
					if (callbacks.onDismissConsent)
						callbacks.onDismissConsent(persist);
				}
			}, [ _('Not now') ]),
			' ',
			links.firewallZonesLink(_('I’ll configure this under Network → Firewall'))
		])
	]);
	return panel;
}

function buildEmptyStateNodes(state, callbacks) {
	const nodes = [];
	const st = state.loggingStatus;
	const blocker = blockerCode(state);

	if (state.loggingNotice) {
		nodes.push(E('p', { 'class': 'fwlive-logging-notice' }, [
			state.loggingNotice,
			' ',
			links.firewallZonesLink()
		]));
	}

	if (blocker === 'no_wan_zone') {
		nodes.push(E('p', { 'class': 'fwlive-empty-title' }, [ _('No WAN zone found') ]));
		nodes.push(E('p', {}, [
			_('No WAN firewall zone found in /etc/config/firewall. Configure zones under '),
			links.firewallZonesLink()
		]));
		return nodes;
	}

	if (blocker === 'nf_log_missing') {
		nodes.push(E('p', { 'class': 'fwlive-empty-title' }, [ _('Kernel log modules missing') ]));
		nodes.push(E('p', {}, [ _('Kernel netfilter log modules are missing. Install kmod-nf-log-ipv4 and kmod-nf-log-ipv6 (or kmod-nf-log / kmod-nf-log6), then reload the firewall.') ]));
		nodes.push(E('p', {}, [
			E('code', {}, [ 'opkg update && opkg install kmod-nf-log-ipv4 kmod-nf-log-ipv6' ])
		]));
		return nodes;
	}

	if (st && st.wan_log) {
		nodes.push(E('p', { 'class': 'fwlive-empty-title' }, [ _('Waiting for firewall events') ]));
		nodes.push(E('p', {}, [ _('WAN drop/reject logging is on. Blocked inbound WAN traffic will show up here. Normal LAN browsing will not.') ]));
		nodes.push(E('p', { 'class': 'fwlive-empty-muted' }, [ _('If the WAN is quiet, wait for probes or use the optional ping check in Help / the enabling-logs guide.') ]));
		nodes.push(E('p', {}, links.firewallZonesLink(_('Open firewall zone settings'))));
		return nodes;
	}

	nodes.push(E('p', { 'class': 'fwlive-empty-title' }, [ _('Logging is off on this router') ]));
	nodes.push(E('p', {}, [ _('OpenWrt does not write firewall events to the log until you turn logging on. Live View only shows what the firewall already logs — it does not add allow/deny rules.') ]));

	/* Consent bullets already spell out the effect — do not repeat it or the CTA. */
	if (state.showConsent) {
		nodes.push(buildConsentPanel(state, callbacks));
		return nodes;
	}

	nodes.push(E('p', {}, [ _('Turns on WAN zone drop/reject logging (same as Network → Firewall → wan → Log). Rate-limited by the zone log_limit (OpenWrt default 10/minute). Normal LAN browsing is not logged.') ]));
	nodes.push(E('p', { 'class': 'fwlive-empty-muted' }, [ _('Nothing changes until you click Enable.') ]));
	nodes.push(E('p', {}, [
		E('button', {
			'class': 'cbi-button cbi-button-action',
			'type': 'button',
			'disabled': state.loggingBusy ? '' : null,
			'click': function() {
				persistConsentDismissed();
				callbacks.onEnable();
			}
		}, [ state.loggingBusy ? _('Enabling…') : _('Enable WAN drop/reject logging') ]),
		' ',
		links.firewallZonesLink(_('I’ll configure this under Network → Firewall'))
	]));
	return nodes;
}

function renderEmptyState(host, state, callbacks) {
	const nodes = buildEmptyStateNodes(state, callbacks);
	host.innerHTML = '';
	for (let i = 0; i < nodes.length; i++)
		host.appendChild(nodes[i]);
}

/**
 * renderManualTestNodes — fills a <li> host element with the backend-specific
 * manual test instruction. Call from addFooter() after render() has inserted
 * the placeholder <li id="fwlive-manual-test">.
 */
function renderManualTestNodes(host, state, _callbacks) {
	host.innerHTML = '';
	if (state.firewallBackend === 'iptables') {
		host.appendChild(document.createTextNode(_('Manual test (System → Terminal): ')));
		host.appendChild(E('code', {}, [ 'iptables -I INPUT -p icmp --icmp-type echo-request -j LOG --log-prefix "fwlive-ping: "' ]));
		host.appendChild(document.createTextNode(_(' then ping the router.')));
	} else {
		host.appendChild(document.createTextNode(_('Manual test (System → Terminal): ')));
		host.appendChild(E('code', {}, [ 'nft insert rule inet fw4 input ip protocol icmp icmp type echo-request log prefix "fwlive-ping " accept' ]));
		host.appendChild(document.createTextNode(_(' then ping the router.')));
	}
}

return baseclass.extend({
	CONSENT_STORAGE_KEY: CONSENT_STORAGE_KEY,
	consentDismissedPermanent: consentDismissedPermanent,
	persistConsentDismissed: persistConsentDismissed,
	renderToolbar: renderToolbar,
	buildEmptyStateNodes: buildEmptyStateNodes,
	renderEmptyState: renderEmptyState,
	renderManualTestNodes: renderManualTestNodes
});
