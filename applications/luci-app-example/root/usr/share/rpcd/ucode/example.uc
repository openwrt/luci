#!/usr/bin/env ucode

'use strict';

import { cursor } from 'uci';

// Rather than parse files in /etc/config, we can use `cursor`.
const uci = cursor();

const methods = {
	get_sample1: {
		call: function() {
			const num_cats = uci.get('example', 'animals', 'num_cats');
			const num_dogs = uci.get('example', 'animals', 'num_dogs');
			const num_parakeets = uci.get('example', 'animals', 'num_parakeets');
			const result = {
				num_cats,
				num_dogs,
				num_parakeets,
				is_this_real: false,
				not_found: null,
			};

			uci.unload();
			return result;
		}
	},

	get_sample2: {
		call: function() {
			const result = {
				option_one: {
					name: "Some string value",
					value: "A value string",
					parakeets: ["one", "two", "three"],
				},
				option_two: {
					name: "Another string value",
					value: "And another value",
					parakeets: [3, 4, 5],
				},
			};
			return result;
		}
	}
};

return { 'luci.example': methods };
