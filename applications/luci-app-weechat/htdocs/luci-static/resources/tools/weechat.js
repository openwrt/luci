'use strict';
'require baseclass';

return baseclass.extend({
	parseAutoJoin: function(val) {
		if (!val || !val.trim())
			return { channels: [], keys: [] };

		var trimmed = val.trim();
		var spaceIdx = trimmed.search(/\s/);
		if (spaceIdx === -1) {
			return {
				channels: trimmed.split(',').map(function(c) { return c.trim(); }).filter(Boolean),
				keys: []
			};
		}

		var firstPart = trimmed.substring(0, spaceIdx).trim();
		var rest = trimmed.substring(spaceIdx + 1).trim();

		/* Keys are positional, so keep empty ones to stay aligned with channels */
		return {
			channels: firstPart.split(',').map(function(c) { return c.trim(); }).filter(Boolean),
			keys: rest.length ? rest.split(',').map(function(k) { return k.trim(); }) : []
		};
	}
});
