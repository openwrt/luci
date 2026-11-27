// SPDX-License-Identifier: Apache-2.0
'use strict';
'require baseclass';
'require rpc';

// What more than one view needs, loaded with
// `'require trafficctl.common as common';` (LuCI resolves the name to
// /luci-static/resources/trafficctl/common.js). LuCI loads a module once per
// page, so the stylesheet below is added once however many views require it.
//
// The views take what they use into local names (var fmtRate =
// common.fmtRate;), so their own functions keep calling plain names and the
// tests that slice those functions out of a view keep running them unchanged.
// The functions here are plain top-level declarations for the same reason:
// the tests slice them out of this file by indentation.

if (!document.querySelector('link[href*="trafficctl/status.css"]')) {
	var lnk = document.createElement('link');
	lnk.rel = 'stylesheet';
	lnk.type = 'text/css';
	lnk.href = L.resource('view/trafficctl/status.css');
	document.head.appendChild(lnk);
}

// rpcd takes an int argument as a signed 32-bit number and refuses the whole
// call (Invalid argument) for anything larger. A rate typed beyond that is
// sent as this, so the backend answers with its own range message.
var RPC_INT_MAX = 2147483647;

var callBlock = rpc.declare({
	object: 'luci.trafficctl',
	method: 'block',
	params: ['ip', 'label']
});

var callUnblock = rpc.declare({
	object: 'luci.trafficctl',
	method: 'unblock',
	params: ['ip', 'label']
});

// The deny list is keyed on the MAC, and an offline device (the Rules tab)
// may have no lease left to find it by IP, so the plugin prefers the MAC.
// The Devices tab passes the IP alone: LuCI leaves an undefined param out of
// the call.
var callMacfilterRemove = rpc.declare({
	object: 'luci.trafficctl',
	method: 'macfilter_remove',
	params: ['ip', 'mac']
});

var callRatelimit = rpc.declare({
	object: 'luci.trafficctl',
	method: 'ratelimit',
	// rate_kbit_up is omitted for a symmetric limit rather than sent equal to
	// rate_kbit: the backend reads absence as "same as download", and sending
	// it always would make every record asymmetric-shaped on disk.
	params: ['ip', 'rate_kbit', 'label', 'mode', 'rate_kbit_up']
});

var callShapeAdd = rpc.declare({
	object: 'luci.trafficctl',
	method: 'shape_add',
	params: ['ip', 'rate_kbit', 'label', 'rate_kbit_up']
});

var callShapeRemove = rpc.declare({
	object: 'luci.trafficctl',
	method: 'shape_remove',
	params: ['ip', 'label']
});

// A ceiling in kbit/s; no ceiling (0 or less) is a dash. The Port Forwards
// tab keeps its own, which shows 0 as "0 kbit/s".
function fmtRate(kbit) {
	if (!kbit || kbit <= 0) return '—';
	var mbit = kbit / 1000;
	if (mbit >= 1) return (mbit % 1 === 0 ? mbit.toFixed(0) : mbit.toFixed(1)) + ' ' + _('Mbit/s');
	return kbit + ' ' + _('kbit/s');
}

// A ceiling as one figure, or both when upload has its own (#66). An upload
// figure of 0 means the backend found no upload ceiling to report; the
// download one is still the limit, so it is shown alone.
function fmtCeiling(kbit, kbitUp) {
	if (!kbitUp || kbitUp <= 0 || kbitUp === kbit) return fmtRate(kbit);
	return '↓ ' + fmtRate(kbit) + ' / ↑ ' + fmtRate(kbitUp);
}

return baseclass.extend({
	RPC_INT_MAX: RPC_INT_MAX,
	callBlock: callBlock,
	callUnblock: callUnblock,
	callMacfilterRemove: callMacfilterRemove,
	callRatelimit: callRatelimit,
	callShapeAdd: callShapeAdd,
	callShapeRemove: callShapeRemove,
	fmtRate: fmtRate,
	fmtCeiling: fmtCeiling
});
