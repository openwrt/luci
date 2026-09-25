'use strict';
'require baseclass';
'require ui';

var ERRORS = {
	1:  'Failed',
	2:  'Drop',
	3:  'NoBufs',
	4:  'NoRoute',
	5:  'Busy',
	6:  'Parse',
	7:  'InvalidArgs',
	8:  'Security',
	9:  'AddressQuery',
	10: 'NoAddress',
	11: 'Abort',
	12: 'NotImplemented',
	13: 'InvalidState',
	14: 'NoAck',
	15: 'ChannelAccessFailure',
	16: 'Detached',
	17: 'FcsErr',
	18: 'NoFrameReceived',
	19: 'UnknownNeighbor',
	20: 'InvalidSourceAddress',
	21: 'AddressFiltered',
	22: 'DestinationAddressFiltered',
	23: 'NotFound',
	24: 'Already',
	26: 'Ipv6AddressCreationFailure',
	27: 'NotCapable',
	28: 'ResponseTimeout',
	29: 'Duplicated',
	30: 'ReassemblyTimeout',
	31: 'NotTmf',
	32: 'NonLowpanDataFrame',
	33: 'DisabledFeature',
	34: 'LinkMarginLow',
	255: 'GenericError',
};

return baseclass.extend({
	translate: function(code) {
		var n = parseInt(code);
		if (!n) return null;
		return ERRORS[n] || 'UnknownErrorType';
	},

	notify: function(result) {
		var msg = this.translate(result && result.error);
		if (msg)
			ui.addNotification(null, E('p', _('Error: %s').format(msg)), 'danger');
		return result;
	},
});
