/*
 * Copyright (C) 2008-2026 The OpenWrt Project
 * Copyright (C) 2026 Manfred Jaider <info@masmbit.com>
 *
 * This is free software, licensed under the Apache License, Version 2.0.
 * See /LICENSE for more information.
 *
 * luci-app-openvpn-plus : LuCI status overview page
 * /www/luci-static/resources/view/status/include/35_openvpn.js
 */

/* global E */
'use strict';

const TXT = {
	STATUS: {
		openvpn: _('OpenVPN'),
		active: _('Active'),
		disabled: _('Disabled'),
		pending: _('Pending...'),
		error: _('Error')
	}
};
const CFG = Object.freeze({
	FILE: Object.freeze({
		vpn_disabled_img: '/luci-static/resources/icons/tunnel_disabled.svg',
		vpn_enabled_img: '/luci-static/resources/icons/tunnel.svg'
	})
});
const OPENVPN = Object.freeze({
	STATE: Object.freeze({
		pending: 'pending',
		active: 'active',
		error: 'error'
	})
});
/**
 * Main data storage for the OpenVPN page
 */
const APP_DATA_TEMPLATE = Object.freeze({
	statusClass: null,
	wizardClass: null,
	keygenClass: null,
	uptime: 0,
	serverTemplate: '',
	clientTemplate: '',
	logread: '',
	keysReady: false,
	ovpnUciSections: null,
	instances: null
});

/**
 * Main entry point where the page starts loading
 */
return L.Class.extend({
	title: TXT.STATUS.openvpn,

	// Create main data storage
	APP_DATA: Object.assign({}, APP_DATA_TEMPLATE, {
		ovpnUciSections: [],
		instances: []
	}),

	// Shared HTML container nodes
	statusTableContainer: null,
	ifaceBoxContainer: null,

	/**
	 * Load code and data before rendering the page elements
	 */
	load: function () {
		const self = this;

		// Load all required classes
		return Promise.all([
			L.require('view.vpn.openvpn-status'),
			L.uci.load('openvpn').catch(function () { return null; })

		]).then(async function (results) {

			const openvpnStatus = results[0];
			if (!openvpnStatus) return null;

			await openvpnStatus.onLoad();

			// Gets the openvon sections from LuCI
			const ovpnSections = L.uci.sections('openvpn', 'openvpn') || [];
			// Sorts the array alphabetically based on the internal '.name' (instance1, instance2, ...)
			ovpnSections.sort(function (a, b) {
				return a['.name'].localeCompare(b['.name'], undefined, { numeric: true, sensitivity: 'base' });
			});

			// If no instances exist, clear title and hide the card block completely
			if (ovpnSections.length === 0) {
				self.title = '';
				return null;
			}

			self.title = TXT.STATUS.openvpn;
			self.statusTableContainer = E('div', { 'id': 'openvpn_overview_table_wrapper', 'style': 'display: block;' }, [E('div', {})]);
			self.ifaceBoxContainer = E('div', { 'style': 'display:block; margin: 10px 0 15px 0; text-align: left;' }, []);

			// Use the safe outer context reference "self" to read the view data
			const appData = self.APP_DATA;
			appData.ovpnUciSections = ovpnSections;

			// Callback function to refresh the status table
			const refreshStatusBoxCallback = function (ovpnState, tooltip, appData) {
				if (!self.ifaceBoxContainer) return

				let labelText = TXT.STATUS.disabled
				let headBg = 'background:var(--background-color-medium, #f4f4f5) !important;'
				let textColor = 'var(--text-color-high, #333333)'
				let imgIcon = CFG.FILE.vpn_disabled_img

				if (ovpnState === OPENVPN.STATE.active) {
					labelText = TXT.STATUS.active
					headBg = 'background:var(--success-color-high, #00ac59) !important;'
					textColor = 'var(--on-success-color, white)'
					imgIcon = CFG.FILE.vpn_enabled_img
				} else if (ovpnState === OPENVPN.STATE.pending) {
					labelText = TXT.STATUS.pending
					headBg = 'background:var(--warn-color-high, #efbd0b) !important;'
					textColor = 'var(--on-warn-color, #000000)'
				} else if (ovpnState === OPENVPN.STATE.error) {
					labelText = TXT.STATUS.error
					headBg = 'background:var(--error-color-high, #f62b12) !important;'
					textColor = 'var(--on-error-color, white)'
				}

				const boxHeadNode = E('div', {
					'class': 'ifacebox-head',
					'style': 'padding:3px 8px; font-size:12px; font-weight:bold; text-shadow:none !important; text-align:center; white-space:nowrap; ' + headBg
				}, [
					E('strong', { 'style': 'color: ' + textColor + ' !important;' }, labelText)
				]);

				const badgeImgNode = E('img', { 'src': imgIcon, 'style': 'width:32px; height:36px; vertical-align:middle;' });

				const tooltipContainer = E('span', { 'class': 'cbi-tooltip-container' }, [
					badgeImgNode,
					tooltip
				]);
				const boxBodyNode = E('div', {
					'class': 'ifacebox-body',
					'style': 'padding:6px; text-align:center; min-height:0; background:transparent !important;'
				}, [
					tooltipContainer
				]);

				const flatIfaceBox = E('div', {
					'class': 'ifacebox',
					'style': 'display:inline-block; margin:0; border-radius:4px; overflow:hidden;'
				}, [boxHeadNode, boxBodyNode]);

				if (self.ifaceBoxContainer.firstChild) {
					self.ifaceBoxContainer.replaceChild(flatIfaceBox, self.ifaceBoxContainer.firstChild);
				} else {
					self.ifaceBoxContainer.appendChild(flatIfaceBox);
				}
			};

			try {
				// Use the clean await operator to trigger the live dashboard refresh loop flatly
				await openvpnStatus.refreshLiveDashboard(appData, self.statusTableContainer, refreshStatusBoxCallback);
				return openvpnStatus;
			} catch (err) {
				console.error('Error during initial dashboard telemetry launch:', err);
				return openvpnStatus;
			}
		});
	},

	/**
	 * Render the page elements onto the interface
	 */
	render: function (openvpnStatus) {
		if (!openvpnStatus || !this.statusTableContainer || !this.ifaceBoxContainer) {
			return null;
		}

		return E('div', { 'class': 'cbi-section', 'style': 'margin:0; padding:0; width:100%;' }, [
			this.ifaceBoxContainer,
			this.statusTableContainer
		]);
	}
});

