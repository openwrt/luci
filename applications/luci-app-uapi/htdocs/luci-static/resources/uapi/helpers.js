'use strict';
'require baseclass';

return baseclass.extend({
	fmtTime: function (epoch) {
		if (!epoch) return '-';
		return new Date(epoch * 1000).toLocaleString();
	},

	badge: function (ok, yes, no) {
		return E('span', { 'class': ok ? 'label success' : 'label' }, [ ok ? (yes || _('Yes')) : (no || _('No')) ]);
	},

	warnBadge: function (text) {
		return E('span', { 'class': 'label warning' }, [ text ]);
	},

	row: function (label, value) {
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left', 'width': '33%' }, [ label ]),
			E('td', { 'class': 'td left' }, [ value ])
		]);
	}
});
