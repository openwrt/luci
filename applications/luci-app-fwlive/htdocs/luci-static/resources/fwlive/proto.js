'use strict';
'require baseclass'; /* LuCI require() needs Class.isSubclass — plain return {} fails */

/**
 * Protocol filter pair: grouped <select> + always-visible custom text field.
 * Typed custom value wins when non-empty (D Always custom).
 */

return baseclass.extend({
	readProtoFilter: function() {
		const custom = document.getElementById('fwlive-proto-custom');
		if (custom) {
			const typed = (custom.value || '').trim();
			if (typed)
				return typed;
		}
		const sel = document.getElementById('fwlive-proto');
		return sel ? (sel.value || '') : '';
	},

	setProtoFilterValue: function(value) {
		const sel = document.getElementById('fwlive-proto');
		const custom = document.getElementById('fwlive-proto-custom');
		if (!sel)
			return false;

		value = value || '';
		let inMenu = (value === '');
		if (!inMenu) {
			for (let i = 0; i < sel.options.length; i++) {
				if (sel.options[i].value === value) {
					inMenu = true;
					break;
				}
			}
		}

		if (inMenu) {
			sel.value = value;
			if (custom)
				custom.value = '';
		} else {
			sel.value = '';
			if (custom)
				custom.value = value;
		}

		return true;
	}
});
