'use strict';
/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright 2025-2026 Lucas Albers <lucas.b.albers@gmail.com> */
'require baseclass';
'require fwlive.links as links';

/**
 * Logging toolbar and empty-state DOM renderers for luci-app-fwlive.
 *
 * renderToolbar(host, state, callbacks) → void
 *   host      - #fwlive-logging-bar strip slot (controls rebuilt; live status kept)
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
 * toggleRpcCatchNotice(err, accessNotice, fallback) → string
 *   ubus code 6 / JSON-RPC -32002 → accessNotice; any other rejection → fallback.
 *
 * captureFocus(host, active) / restoreFocus(host, focused)
 *   chips.js pattern: if focus was inside host, move it to the replacement control.
 * hasLoggingAction(host, action) → bool
 *   true when host still contains that data-fwlive-logging-action.
 *
 * Modules must not mutate state. Toolbar controls are replaced; the role=status
 * node is reused so live announcements survive rebuilds.
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

function luciRpcFailureCode(err) {
	const msg = err && typeof err.message === 'string' ? err.message : '';
	let match = /failed with ubus code (-?\d+):/.exec(msg);
	if (!match) match = /failed with error (-?\d+):/.exec(msg);
	if (!match) return null;
	const code = Number(match[1]);
	return code === code ? code : null;
}

function toggleRpcCatchNotice(err, accessNotice, fallback) {
	const code = luciRpcFailureCode(err);
	if (code === 6 || code === -32002) return accessNotice;
	return fallback;
}

function nodeIsInside(node, host) {
	while (node) {
		if (node === host) return true;
		node = node.parentNode;
	}
	return false;
}

function captureFocus(host, active) {
	if (!host || !active || !nodeIsInside(active, host)) return null;
	const action =
		typeof active.getAttribute === 'function'
			? active.getAttribute('data-fwlive-logging-action')
			: null;
	return { action: action || 'host' };
}

function findLoggingControl(root, action) {
	if (!root || !action) return null;
	const pending = [root];
	while (pending.length) {
		const node = pending.pop();
		if (!node || node.nodeType !== 1) continue;
		if (node.getAttribute && node.getAttribute('data-fwlive-logging-action') === action)
			return node;
		const children = node.childNodes || [];
		for (let i = children.length - 1; i >= 0; i--) pending.push(children[i]);
	}
	return null;
}

function primaryLoggingControl(root) {
	return (
		findLoggingControl(root, 'enable') ||
		findLoggingControl(root, 'disable') ||
		findLoggingControl(root, 'dismiss')
	);
}

function restoreFocus(host, focused) {
	if (!focused || !host) return;
	let target = focused.action ? findLoggingControl(host, focused.action) : null;
	if (!target) target = primaryLoggingControl(host);
	if (target && typeof target.focus === 'function') target.focus();
}

function hasLoggingAction(host, action) {
	return !!findLoggingControl(host, action);
}

function toolbarLiveStatus(host) {
	let live = host._fwliveLoggingLive;
	if (!live || live.nodeType !== 1) {
		live = E(
			'span',
			{
				'class': 'fwlive-logging-live',
				'role': 'status'
			},
			['']
		);
		host._fwliveLoggingLive = live;
	}
	if (live.parentNode !== host) host.appendChild(live);
	return live;
}

function replaceToolbarControls(host, live) {
	const kids = [];
	for (let i = 0; i < host.childNodes.length; i++) kids.push(host.childNodes[i]);
	for (let i = 0; i < kids.length; i++) {
		if (kids[i] !== live) host.removeChild(kids[i]);
	}
}

function placeToolbarNode(host, live, node) {
	if (live && live.parentNode === host) host.insertBefore(node, live);
	else host.appendChild(node);
}

function setLiveText(live, text) {
	const msg = text == null ? '' : String(text);
	let tn = null;
	const kids = live.childNodes || [];
	for (let i = 0; i < kids.length; i++) {
		if (kids[i].nodeType === 3) {
			tn = kids[i];
			break;
		}
	}
	if (!tn) {
		const tmp = E('span', {}, [msg]);
		tn = tmp.childNodes && tmp.childNodes[0];
		if (tn) live.appendChild(tn);
		return;
	}
	tn.textContent = msg;
	if (tn.nodeValue !== undefined) tn.nodeValue = msg;
}

function updateLiveStatus(live, state) {
	setLiveText(live, state.loggingNotice || '');
	live.setAttribute(
		'class',
		state.loggingNotice
			? 'fwlive-logging-live ' + loggingNoticeClass(state)
			: 'fwlive-logging-live'
	);
	live.setAttribute('role', 'status');
}

function enableLoggingButton(state, callbacks) {
	return E(
		'button',
		{
			'class': 'cbi-button cbi-button-action',
			'type': 'button',
			'data-fwlive-logging-action': 'enable',
			'title': _('Enable WAN zone drop/reject logging (same as Network → Firewall).'),
			'aria-disabled': state.loggingBusy ? 'true' : null,
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

function appendBlockerStatus(host, live, blocker, st) {
	if (blocker === 'no_wan_zone') {
		placeToolbarNode(
			host,
			live,
			E(
				'span',
				{ 'class': 'fwlive-logging-status' },
				labelWithZoneCandidates(_('WAN logging unavailable: no WAN zone'), st)
			)
		);
		placeToolbarNode(host, live, links.firewallZonesLink());
		return;
	}

	if (blocker === 'nf_log_missing') {
		placeToolbarNode(
			host,
			live,
			E('span', { 'class': 'fwlive-logging-status' }, [
				_('WAN logging unavailable: missing kernel log modules')
			])
		);
		return;
	}

	if (blocker === 'unknown') {
		placeToolbarNode(
			host,
			live,
			E('span', { 'class': 'fwlive-logging-status' }, [_('WAN logging unavailable')])
		);
	}
}

function appendWanLogDisableControl(host, state, callbacks) {
	const st = state.loggingStatus;
	const configuredLimit = st.wan_log_limit;
	const limit =
		configuredLimit != null && configuredLimit !== ''
			? _('configured log_limit: %s').format(configuredLimit)
			: _('no WAN rate limit configured');
	const busy = !!state.loggingBusy;
	const children = busy
		? [_('Disabling…')]
		: [
				E('span', { 'class': 'fwlive-log-on-dot', 'aria-hidden': 'true' }, ['']),
				E('span', { 'class': 'fwlive-log-label' }, [_('WAN logging on')]),
				E('span', { 'class': 'fwlive-log-rate' }, [_('· %s').format(limit)])
			];
	placeToolbarNode(
		host,
		host._fwliveLoggingLive,
		E(
			'button',
			{
				'class': 'cbi-button fwlive-log-merged',
				'type': 'button',
				'data-fwlive-logging-action': 'disable',
				'title': _('WAN logging on (%s). Click to disable.').format(limit),
				'aria-disabled': busy ? 'true' : null,
				'click': function () {
					callbacks.onDisable();
				}
			},
			children
		)
	);
}

function renderToolbar(host, state, callbacks) {
	const live = toolbarLiveStatus(host);
	replaceToolbarControls(host, live);
	updateLiveStatus(live, state);

	const st = state.loggingStatus;
	if (!st) {
		/* First-fetch failure: keep the host so loggingNotice stays visible. */
		if (state.loggingNotice) {
			host.style.display = 'contents';
			return;
		}
		host.style.display = 'none';
		return;
	}

	host.style.display = 'contents';
	const blocker = blockerCode(state);

	if (blocker) appendBlockerStatus(host, live, blocker, st);

	if (st.wan_log) {
		appendWanLogDisableControl(host, state, callbacks);
		return;
	}

	if (blocker) return;

	placeToolbarNode(host, live, enableLoggingButton(state, callbacks));
}

function wanLogLimitDescription(limit) {
	if (limit != null && limit !== '')
		return _(
			'Configured WAN zone log_limit: %s. It limits only on fw4 builds that support it; kernel/logd may still constrain total log volume.'
		).format(limit);

	return _(
		'No WAN zone log_limit is configured. Kernel/logd may still constrain total log volume.'
	);
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
				E('strong', {}, [_('Rate limit:')]),
				' ',
				wanLogLimitDescription(state.loggingStatus && state.loggingStatus.wan_log_limit)
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
					'id': dontShowId,
					'data-fwlive-logging-action': 'consent-dont-show'
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
					'data-fwlive-logging-action': 'dismiss',
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
			_('Turns on WAN zone drop/reject logging (same as Network → Firewall → wan → Log).'),
			' ',
			wanLogLimitDescription(st.wan_log_limit),
			' ',
			_('Normal LAN browsing is not logged.')
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
	toggleRpcCatchNotice: toggleRpcCatchNotice,
	captureFocus: captureFocus,
	restoreFocus: restoreFocus,
	hasLoggingAction: hasLoggingAction,
	renderToolbar: renderToolbar,
	buildEmptyStateNodes: buildEmptyStateNodes,
	renderEmptyState: renderEmptyState,
	renderManualTestNodes: renderManualTestNodes
});
