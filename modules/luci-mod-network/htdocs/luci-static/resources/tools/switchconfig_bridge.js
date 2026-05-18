'use strict';
'require baseclass';
'require uci';

/** @file Bridge / VLAN inference helpers for the port-centric Switch config view (self-contained). */

return baseclass.extend(/** @lends luci.tools.switchconfig_bridge.prototype */{
	netdevMap(netDevices) {
		const m = {};

		for (let i = 0; i < netDevices.length; i++)
			m[netDevices[i].getName()] = netDevices[i];

		return m;
	},

	inferBridgeHint() {
		let q;

		try {
			q = new URL(window.location.href);
		}
		catch (e) {
			return null;
		}

		if (!q.searchParams)
			return null;

		let v = q.searchParams.get('device') || q.searchParams.get('bridge');

		if (typeof v === 'string')
			v = v.trim();

		return (v != null && v !== '') ? v : null;
	},

	bridgesFromUciSections() {
		return uci.sections('network', 'device')
			.filter(function(ds) { return ds.type === 'bridge' && ds.name; })
			.sort(function(a, b) { return L.naturalCompare(a.name, b.name); });
	},

	branchVlanRefsCount(devname) {
		let n = 0;

		uci.sections('network', 'bridge-vlan', function(bvs) {
			if (bvs.device === devname)
				n++;
		});

		return n;
	},

	inferSwitchBridge(netDevices, hinted) {
		const ndm = this.netdevMap(netDevices);

		if (hinted) {
			if (uci.sections('network', 'bridge-vlan').some(function(bv) {
				return bv.device === hinted;
			})) {
				return hinted;
			}

			const netd = ndm[hinted];

			if (netd != null && netd.isBridge())
				return hinted;
		}

		let bestName = null;
		let bestScore = -1;

		for (let ds of this.bridgesFromUciSections()) {
			const name = ds.name;
			const ports = L.toArray(ds.ports);
			const bv = this.branchVlanRefsCount(name);
			let sc = ports.length + bv * 4;

			if (ports.length >= 8 || bv >= 8)
				sc += 80;

			if (sc > bestScore) {
				bestScore = sc;
				bestName = name;
			}
		}

		if (bestScore > 0)
			return bestName;

		for (let i = 0; i < netDevices.length; i++) {
			const d = netDevices[i];

			if (!d.isBridge())
				continue;

			const pname = d.getName();
			const bv = this.branchVlanRefsCount(pname);
			let sc = (d.getPorts() || []).length + bv * 6;

			if (bv >= 4)
				sc += 120;

			if (sc > bestScore) {
				bestScore = sc;
				bestName = pname;
			}
		}

		return bestName || null;
	},

	collectSeenPortsBridge(bridgeName) {
		const seenPorts = {};
		const bridges = this.bridgesFromUciSections().filter(function(ds) {
			return ds.name === bridgeName;
		});

		for (let ds of bridges)
			L.toArray(ds.ports).forEach(function(port) {
				seenPorts[port.replace(/:.*/, '') || port] = true;
			});

		uci.sections('network', 'bridge-vlan', function(bvs) {
			if (bvs.device !== bridgeName)
				return;

			L.toArray(bvs.ports).forEach(function(portspec) {
				const mm = portspec.match(/^([^:]+)(?::[ut*]+)?$/);

				if (mm)
					seenPorts[mm[1]] = true;
			});
		});

		return Object.keys(seenPorts);
	},

	/*
	 * Same scope as the Bridge VLAN filtering tab in tools/network.js: options there
	 * depend on `type` being `bridge` (vlan_filtering / bridge-vlan rows).
	 */
	hasVlanAwareBridgeConfigured() {
		return uci.sections('network', 'device').some(function(d) {
			return d.type === 'bridge' && d.name;
		});
	}
});
