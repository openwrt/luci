'use strict';
'require baseclass';
'require uci';

/**
 * User-only annotations for Switch config: stored in /etc/config/luci (not network).
 * Expect one section each:
 *   config switchconfig_port_labels
 *       option lan1 'uplink'
 *   config switchconfig_vlan_labels
 *       option 10 'Guest'
 */

const T_PORT_LABELS = 'switchconfig_port_labels';
const T_VLAN_LABELS = 'switchconfig_vlan_labels';

return baseclass.extend(/** @lends luci.tools.switchconfig_labels.prototype */{
	T_PORT_LABELS: T_PORT_LABELS,

	T_VLAN_LABELS: T_VLAN_LABELS,

	_singleSectionSid(typ) {
		const secs = uci.sections('luci', typ);

		return secs.length ? secs[0]['.name'] : null;
	},

	_ensurePortMapSid() {
		let sid = this._singleSectionSid(T_PORT_LABELS);

		if (!sid)
			sid = uci.add('luci', T_PORT_LABELS);

		return sid;
	},

	_ensureVlanMapSid() {
		let sid = this._singleSectionSid(T_VLAN_LABELS);

		if (!sid)
			sid = uci.add('luci', T_VLAN_LABELS);

		return sid;
	},

	_mapToObject(sid) {
		const m = {};

		if (!sid)
			return m;

		const row = uci.get('luci', sid);

		if (!row || typeof row != 'object')
			return m;

		for (const k in row) {
			if (k.charAt(0) === '.')
				continue;

			const v = row[k];

			m[k] = Array.isArray(v) ? v.join(' ') : String(v != null ? v : '');
		}

		return m;
	},

	/**
	 * Remove label options whose port / VLAN no longer exists on this bridge.
	 */
	pruneSwitchconfigLabels(validPortIds, validVids) {
		const vp = {};

		for (let i = 0; i < validPortIds.length; i++)
			vp[validPortIds[i]] = true;

		const vv = {};

		for (let j = 0; j < validVids.length; j++)
			vv[String(validVids[j])] = true;

		const psid = this._singleSectionSid(T_PORT_LABELS);

		if (psid) {
			const pm = this._mapToObject(psid);

			for (const port in pm) {
				if (!vp[port])
					uci.unset('luci', psid, port);
			}
		}

		const vsid = this._singleSectionSid(T_VLAN_LABELS);

		if (vsid) {
			const vm = this._mapToObject(vsid);

			for (const vid in vm) {
				if (!vv[vid])
					uci.unset('luci', vsid, vid);
			}
		}
	},

	getPortLabelMap() {
		const sid = this._singleSectionSid(T_PORT_LABELS);

		return this._mapToObject(sid);
	},

	getVlanLabelMap() {
		const sid = this._singleSectionSid(T_VLAN_LABELS);

		return this._mapToObject(sid);
	},

	setPortLabel(port, labelText) {
		const t = String(labelText || '').trim();
		const sid = this._ensurePortMapSid();

		if (!t)
			uci.unset('luci', sid, port);
		else
			uci.set('luci', sid, port, t);

		return uci.save();
	},

	setVlanLabel(vlanId, labelText) {
		const vidKey = String(vlanId);
		const t = String(labelText || '').trim();
		const sid = this._ensureVlanMapSid();

		if (!t)
			uci.unset('luci', sid, vidKey);
		else
			uci.set('luci', sid, vidKey, t);

		return uci.save();
	},

	/**
	 * Flush draft labels without racing parallel uci saves: runs setPortLabel / setVlanLabel in order.
	 */
	syncAllDraftLabels(portSpecs, vlanSpecs) {
		let chain = Promise.resolve();

		for (let i = 0; i < portSpecs.length; i++) {
			const port = portSpecs[i].port;
			const label = portSpecs[i].label;

			chain = chain.then(L.bind(function() {
				return this.setPortLabel(port, label);
			}, this));
		}

		for (let j = 0; j < vlanSpecs.length; j++) {
			const vlan = vlanSpecs[j].vlan;
			const label = vlanSpecs[j].label;

			chain = chain.then(L.bind(function() {
				return this.setVlanLabel(vlan, label);
			}, this));
		}

		return chain;
	}
});
