'use strict';
'require baseclass';
'require rpc';

let callDawnGetNetwork, callDawnGetHearingMap, callHostHints;

callDawnGetNetwork = rpc.declare({
	object: 'dawn',
	method: 'get_network',
	expect: { }
});

callDawnGetHearingMap = rpc.declare({
	object: 'dawn',
	method: 'get_hearing_map',
	expect: { }
});

callHostHints = rpc.declare({
	object: 'luci-rpc',
	method: 'getHostHints',
	expect: { }
});

function isDawnRPCAvailable() {
    return rpc.list("dawn").then(function(signatures) {
        return 'dawn' in signatures && 'get_network' in signatures.dawn && 'get_hearing_map' in signatures.dawn;
    });
}

function getAvailableText(available) {
	return ( available ? _('Available') : _('Not available') );
}

function getYesText(yes) {
	return ( yes ? _('Yes') : _('No') );
}

function getChannelFromFrequency(freq) {
	if (freq <= 2400) {
		return 0;
	}
	else if (freq == 2484) {
		return 14;
	}
	else if (freq < 2484) {
		return (freq - 2407) / 5;
	}
	else if (freq >= 4910 && freq <= 4980) {
		return (freq - 4000) / 5;
	}
	else if (freq <= 45000) {
		return (freq - 5000) / 5;
	}
	else if (freq >= 58320 && freq <= 64800) {
		return (freq - 56160) / 2160;
	}
	else {
		return 0;
	}
}

function getFormattedNumber(num, decimals, divider = 1) {
	return (num/divider).toFixed(decimals);
}

function getHostnameFromMAC(hosthints, mac) {
	return ( hosthints[mac] && hosthints[mac].name ? hosthints[mac].name + ' (' + mac + ')' : mac );
}

function getDawnServiceNotRunningErrorMessage() {
	return E('div', { 'class': 'alert-message fade-in warning' }, [
		E('h4', _('DAWN service unavailable')),
		E('p', _('Unable to query the DAWN service via ubus, the service appears to be stopped.')),
		E('a', { 'href': L.url('admin/system/startup') }, _('Check Startup services'))
	]);
}

return L.Class.extend({
	callDawnGetNetwork: callDawnGetNetwork, 
	callDawnGetHearingMap: callDawnGetHearingMap,
	callHostHints: callHostHints,
	isDawnRPCAvailable: isDawnRPCAvailable,
	getAvailableText: getAvailableText,
	getYesText: getYesText,
	getChannelFromFrequency: getChannelFromFrequency,
	getFormattedNumber: getFormattedNumber,
	getHostnameFromMAC: getHostnameFromMAC,
	getDawnServiceNotRunningErrorMessage: getDawnServiceNotRunningErrorMessage
});
