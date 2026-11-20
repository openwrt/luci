'use strict';

'require baseclass';
'require uci';

return baseclass.extend({
	checkLength(p, required) {
		let enough = p.length >= parseInt(required);

		if (required && !enough)
			return false;

		return true;
	},

	checkDigits(p) {
		let m = p.match(/\d/);

		return m ? true : false;
	},

	checkUpperLower(p) {

		return /[a-z]/.test(p) && /[A-Z]/.test(p);
	},

	checkSpecialChars(p) {
		let m = p.match(/[^a-zA-Z0-9]/);

		return m ? true : false;
	}
});
