'use strict';
'require baseclass';
'require rpc';

let callDawnGetNetwork, callDawnGetHearingMap, callHostHints;

callDawnGetNetwork = rpc.declare({
  object: 'dawn',
  method: 'get_network',
  expect: {  }
});

callDawnGetHearingMap = rpc.declare({
  object: 'dawn',
  method: 'get_hearing_map',
  expect: {  }
});

callHostHints = rpc.declare({
  object: 'luci-rpc',
  method: 'getHostHints',
  expect: { }
});

function getAvailableText(available) {
  return ( available ? _('Available') : _('Not available') );
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
  return ( hosthints[mac] && hosthints[mac].name ? hosthints[mac].name : mac);
}

return L.Class.extend({
  callDawnGetNetwork: callDawnGetNetwork, 
  callDawnGetHearingMap: callDawnGetHearingMap,
  callHostHints: callHostHints,
  getAvailableText: getAvailableText,
  getChannelFromFrequency: getChannelFromFrequency,
  getFormattedNumber: getFormattedNumber,
  getHostnameFromMAC: getHostnameFromMAC
});
