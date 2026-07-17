// SPDX-License-Identifier: Apache-2.0

export function cursor() {
	return {
		load: function(config) {
			return config == 'lpac' && !global.TEST_UCI_LOAD_FAIL;
		},

		get: function(config, section, option) {
			const values = global.TEST_UCI?.[section];
			return config == 'lpac' && type(values) == 'object'
				? values[option]
				: null;
		},

		set: function(...args) {
			if (args[0] != 'lpac' || length(args) < 3)
				return null;

			const section = args[1];

			if (type(global.TEST_UCI[section]) != 'object')
				global.TEST_UCI[section] = {};

			if (length(args) == 4)
				global.TEST_UCI[section][args[2]] = args[3];

			return true;
		},

		commit: function(config) {
			return config == 'lpac' && global.TEST_COMMIT_OK !== false;
		},

		unload: function() {
			return true;
		}
	};
};
