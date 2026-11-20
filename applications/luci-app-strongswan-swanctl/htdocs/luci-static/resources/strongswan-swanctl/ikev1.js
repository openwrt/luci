'use strict';
'require baseclass';
'require uci';

return baseclass.extend({
	/**
	 * Text of the IKEv1 deprecation notice.
	 */
	message: function () {
		return _('IKEv1 is deprecated and may be removed in future updates. Please upgrade your connections to IKEv2.');
	},

	/**
	 * Return true if the keyexchange value includes IKEv1.
	 */
	isIkev1: function (keyexchange) {
		return keyexchange == 'ikev1' || keyexchange == 'ike';
	},

	/**
	 * Resolve to true if at least one connection uses IKEv1.
	 */
	isUsed: function () {
		return uci.load('ipsec').then(L.bind(function () {
			return uci.sections('ipsec', 'connection').some(L.bind(function (s) {
				return this.isIkev1(s.keyexchange);
			}, this));
		}, this));
	},

	/**
	 * Resolve to a warning banner, or to null if IKEv1 is not used.
	 */
	banner: function () {
		return this.isUsed().then(L.bind(function (used) {
			return used ? E('div', { 'class': 'alert-message warning' }, E('p', this.message())) : null;
		}, this));
	},

	/**
	 * Insert the banner, if any, at the top of a rendered view node.
	 */
	prepend: function (node) {
		return this.banner().then(function (banner) {
			if (banner)
				node.insertBefore(banner, node.firstChild);
			return node;
		});
	}
});
