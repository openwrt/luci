'use strict';
/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright 2025-2026 Lucas Albers <lucas.b.albers@gmail.com> */
'require baseclass';
'require fwlive.links as links';

/**
 * Logging toolbar and empty-state DOM renderers for luci-app-fwlive.
 *
 * renderToolbar(host, state, callbacks) → void
 *   host      - #fwlive-logging-bar strip slot (cleared and rebuilt; element kept)
 *   state     - { loggingStatus, loggingBusy, loggingNotice, loggingNoticeFail }
 *   callbacks - { onEnable(), onDisable() }
 *
 * G Hybrid chrome: when WAN logging is on, one merged control carries status +
 * rate (click disables). When off, filled Enable CTA. Blockers stay status text.
 *
 * renderManualTestNodes(host, state, callbacks) → void
 *   host      - <ul> element inside #fwlive-help (cleared and rebuilt)
 *   state     - unused; instruction is nft-only (rpcd never emits iptables)
 *
 * Empty-state helpers:
 *   buildEmptyStateNodes(state, callbacks) → Node[]
 *   renderEmptyState(host, state, callbacks) → void
 *     state     - loggingState + { showConsent }
 *     callbacks - { onEnable(), onDismissConsent(persist) }
 *
 * toggleFailureNotice(code, fallback) → string
 *   rpcd enable/disable error code → notice; unknown codes return fallback.
 *
 * Modules must not mutate state. host is cleared then rebuilt (idempotent replace).
 */

const CONSENT_STORAGE_KEY = 'fwlive-logging-consent-v1';

function consentDismissedPermanent() {
	try {
		return localStorage.getItem(CONSENT_STORAGE_KEY) === '1';
	} catch (_e) {
		return false;
	}
}

function persistConsentDismissed() {
	try {
		localStorage.setItem(CONSENT_STORAGE_KEY, '1');
	} catch (_e) {
		/* private mode / no storage */
	}
}

/* Shared by enable and disable; codes a toggle cannot emit fall through. */
function toggleFailureNotice(code, fallback) {
	switch (code) {
		case 'nf_log_missing':
			return _('Cannot enable logging until kernel log modules are installed.');
		case 'firewall_changes_pending':
			return _('Another change is staged for the firewall; apply or revert it first.');
		case 'no_wan_zone':
			return _('No WAN zone found; cannot toggle logging without one.');
		case 'lock_failed':
			return _('Could not acquire the logging lock.');
		case 'rollback_tracking_failed':
			return _('Could not track the logging change safely; logging was not changed.');
		case 'baseline_snapshot_failed':
			return _('Could not snapshot the current logging state.');
		case 'firewall_reload_failed':
			return _('The firewall did not reload; saved and live logging may differ.');
		case 'uci_set_failed':
			return _('Could not write the WAN zone log option.');
		case 'uci_delete_failed':
			return _('Could not clear the WAN zone log option.');
		case 'uci_commit_failed':
			return _('Could not save the firewall configuration.');
		case 'firewall_commit_raced':
			return _(
				'Another change overwrote WAN logging after it was saved; check the current state.'
			);
		default:
			return fallback;
	}
}

function enableLoggingButton(state, callbacks) {
	return E(
		'button',
		{
			'class': 'cbi-button cbi-button-action',
			'type': 'button',
			'title': _('Enable WAN zone drop/reject logging (same as Network → Firewall).'),
			'disabled': state.loggingBusy ? '' : null,
			'click': function () {
				callbacks.onEnable();
			}
		},
		[state.loggingBusy ? _('Enabling…') : _('Enable logging')]
	);
}

function blockerCode(state) {
	const blockers = (state.loggingStatus && state.loggingStatus.blockers) || [];
	if (blockers.indexOf('no_wan_zone') >= 0) return 'no_wan_zone';
	if (
		blockers.indexOf('nf_log_ipv4_missing') >= 0 ||
		blockers.indexOf('nf_log_ipv6_missing') >= 0
	)
		return 'nf_log_missing';
	if (blockers.length > 0) return 'unknown';
	return '';
}

function wanZoneCandidateNames(st) {
	return Array.isArray(st && st.wan_zone_candidates)
		? st.wan_zone_candidates.filter(function (name) {
				return typeof name === 'string';
			})
		: [];
}

function labelWithZoneCandidates(label, st) {
	const children = [label];
	const candidates = wanZoneCandidateNames(st);
	if (candidates.length) children.push(': ', E('code', {}, [candidates.join(', ')]));
	return children;
}

function loggingNoticeClass(state) {
	return state.loggingNoticeFail
		? 'fwlive-logging-notice fwlive-logging-notice-fail'
		: 'fwlive-logging-notice';
}

function appendLoggingNotice(host, state) {
	if (!state.loggingNotice) return;
	host.appendChild(E('span', { 'class': loggingNoticeClass(state) }, [state.loggingNotice]));
}

function appendBlockerStatus(host, blocker, st) {
	if (blocker === 'no_wan_zone') {
		host.appendChild(
			E(
				'span',
				{ 'class': 'fwlive-logging-status' },
				labelWithZoneCandidates(_('WAN logging unavailable: no WAN zone'), st)
			)
		);
		host.appendChild(links.firewallZonesLink());
		return;
	}

	if (blocker === 'nf_log_missing') {
		host.appendChild(
			E('span', { 'class': 'fwlive-logging-status' }, [
				_('WAN logging unavailable: missing kernel log modules')
			])
		);
		return;
	}

	if (blocker === 'unknown') {
		host.appendChild(
			E('span', { 'class': 'fwlive-logging-status' }, [_('WAN logging unavailable')])
		);
	}
}

function appendWanLogDisableControl(host, state, callbacks) {
	const st = state.loggingStatus;
	const limit = st.wan_log_limit || _('default 10/minute');
	const busy = !!state.loggingBusy;
	const children = busy
		? [_('Disabling…')]
		: [
				E('span', { 'class': 'fwlive-log-on-dot', 'aria-hidden': 'true' }, ['']),
				E('span', { 'class': 'fwlive-log-label' }, [_('WAN logging on')]),
				E('span', { 'class': 'fwlive-log-rate' }, [_('· %s').format(limit)])
			];
	host.appendChild(
		E(
			'button',
			{
				'class': 'cbi-button fwlive-log-merged',
				'type': 'button',
				'title': _('WAN logging on (%s). Click to disable.').format(limit),
				'disabled': busy ? '' : null,
				'click': function () {
					callbacks.onDisable();
				}
			},
			children
		)
	);
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

	if (blocker) appendBlockerStatus(host, blocker, st);

	if (st.wan_log) {
		appendWanLogDisableControl(host, state, callbacks);
		appendLoggingNotice(host, state);
		return;
	}

	if (blocker) {
		appendLoggingNotice(host, state);
		return;
	}

	host.appendChild(enableLoggingButton(state, callbacks));
	appendLoggingNotice(host, state);
}

function buildConsentPanel(state, callbacks) {
	const dontShowId = 'fwlive-consent-dont-show';
	const panel = E('div', { 'class': 'fwlive-consent', 'id': 'fwlive-consent' }, [
		E('p', { 'class': 'fwlive-empty-title' }, [_('Before you enable logging')]),
		E('ul', { 'class': 'fwlive-consent-list' }, [
			E('li', {}, [
				E('strong', {}, [_('Changes:')]),
				' ',
				_('Turns on logging for the WAN firewall zone and reloads the firewall.')
			]),
			E('li', {}, [
				E('strong', {}, [_('Does not change:')]),
				' ',
				_('Allow/deny rules, LAN logging, or anything else.')
			]),
			E('li', {}, [
				E('strong', {}, [_('Undo:')]),
				' ',
				_('Turn it back off with the WAN logging control on the watch strip.')
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
			enableLoggingButton(state, callbacks),
			' ',
			E(
				'button',
				{
					'class': 'cbi-button',
					'type': 'button',
					'click': function () {
						const box = document.getElementById(dontShowId);
						const persist = !!(box && box.checked);
						if (persist) persistConsentDismissed();
						if (callbacks.onDismissConsent) callbacks.onDismissConsent(persist);
					}
				},
				[_('Not now')]
			),
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
		nodes.push(
			E('p', { 'class': loggingNoticeClass(state) }, [
				state.loggingNotice,
				' ',
				links.firewallZonesLink()
			])
		);
	}

	if (!st) return nodes;

	if (blocker === 'no_wan_zone') {
		nodes.push(
			E(
				'p',
				{ 'class': 'fwlive-empty-title' },
				labelWithZoneCandidates(_('No WAN zone found'), st)
			)
		);
		nodes.push(
			E('p', {}, [
				_('No WAN firewall zone found in /etc/config/firewall. Configure zones under:'),
				' ',
				links.firewallZonesLink()
			])
		);
		return nodes;
	}

	if (blocker === 'nf_log_missing') {
		nodes.push(E('p', { 'class': 'fwlive-empty-title' }, [_('Kernel log modules missing')]));
		nodes.push(
			E('p', {}, [
				_(
					'Install kmod-nf-log and kmod-nf-log6 with the command for your OpenWrt release, then reload the firewall.'
				)
			])
		);
		nodes.push(E('p', {}, [_('OpenWrt 24.10 and older (opkg):')]));
		nodes.push(
			E('p', {}, [E('code', {}, ['opkg update && opkg install kmod-nf-log kmod-nf-log6'])])
		);
		nodes.push(E('p', {}, [_('OpenWrt 25.12 and newer (apk):')]));
		nodes.push(E('p', {}, [E('code', {}, ['apk -U add kmod-nf-log kmod-nf-log6'])]));
		return nodes;
	}

	if (blocker === 'unknown') {
		nodes.push(E('p', { 'class': 'fwlive-empty-title' }, [_('WAN logging unavailable')]));
		nodes.push(
			E('p', {}, [
				_('This router reported a logging blocker that Live View does not recognize yet.')
			])
		);
		return nodes;
	}

	if (st && st.wan_log) {
		nodes.push(E('p', { 'class': 'fwlive-empty-title' }, [_('Waiting for firewall events')]));
		nodes.push(
			E('p', {}, [
				_(
					'WAN drop/reject logging is on. Blocked inbound WAN traffic will show up here. Normal LAN browsing will not.'
				)
			])
		);
		nodes.push(
			E('p', { 'class': 'fwlive-empty-muted' }, [
				_(
					'If the WAN is quiet, wait for probes or use the optional ping check in Help / the enabling-logs guide.'
				)
			])
		);
		nodes.push(E('p', {}, links.firewallZonesLink(_('Open firewall zone settings'))));
		return nodes;
	}

	nodes.push(E('p', { 'class': 'fwlive-empty-title' }, [_('Logging is off on this router')]));
	nodes.push(
		E('p', {}, [
			_(
				'OpenWrt does not write firewall events to the log until you turn logging on. Live View only shows what the firewall already logs — it does not add allow/deny rules.'
			)
		])
	);

	/* Consent bullets already spell out the effect — do not repeat it or the CTA. */
	if (state.showConsent) {
		nodes.push(buildConsentPanel(state, callbacks));
		return nodes;
	}

	nodes.push(
		E('p', {}, [
			_(
				'Turns on WAN zone drop/reject logging (same as Network → Firewall → wan → Log). Rate-limited by the zone log_limit (OpenWrt default 10/minute). Normal LAN browsing is not logged.'
			)
		])
	);
	nodes.push(
		E('p', { 'class': 'fwlive-empty-muted' }, [
			_('Nothing changes until you click Enable logging.')
		])
	);
	nodes.push(
		E('p', {}, [
			enableLoggingButton(state, callbacks),
			' ',
			links.firewallZonesLink(_('I’ll configure this under Network → Firewall'))
		])
	);
	return nodes;
}

function renderEmptyState(host, state, callbacks) {
	const nodes = buildEmptyStateNodes(state, callbacks);
	host.innerHTML = '';
	for (let i = 0; i < nodes.length; i++) host.appendChild(nodes[i]);
}

/**
 * renderManualTestNodes — fills a <li> host element with the firewall manual test
 * instruction. Call from addFooter() after render() has inserted
 * the placeholder <li id="fwlive-manual-test">.
 */
function renderManualTestNodes(host, _state, _callbacks) {
	host.innerHTML = '';
	host.appendChild(document.createTextNode(_('Manual test (System → Terminal):')));
	host.appendChild(document.createTextNode(' '));
	host.appendChild(
		E('code', {}, [
			'nft insert rule inet fw4 input ip protocol icmp icmp type echo-request log prefix "fwlive-ping " accept'
		])
	);
	host.appendChild(document.createTextNode(' '));
	host.appendChild(document.createTextNode(_('Then ping the router.')));
}

return baseclass.extend({
	CONSENT_STORAGE_KEY: CONSENT_STORAGE_KEY,
	consentDismissedPermanent: consentDismissedPermanent,
	persistConsentDismissed: persistConsentDismissed,
	toggleFailureNotice: toggleFailureNotice,
	renderToolbar: renderToolbar,
	buildEmptyStateNodes: buildEmptyStateNodes,
	renderEmptyState: renderEmptyState,
	renderManualTestNodes: renderManualTestNodes
});
