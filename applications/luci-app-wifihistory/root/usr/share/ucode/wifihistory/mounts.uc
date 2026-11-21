'use strict';

export function decode_mount_field(value) {
	value = replace(value, /\\040/g, ' ');
	value = replace(value, /\\011/g, '\t');
	value = replace(value, /\\012/g, '\n');
	value = replace(value, /\\134/g, '\\');

	return value;
}

export function mountpoint_from_data(data, path) {
	let best = null;

	for (let line in split(data || '', '\n')) {
		let fields = split(line, ' ');
		let source = decode_mount_field(fields[0] || '');
		let mp = decode_mount_field(fields[1] || '');
		let fstype = decode_mount_field(fields[2] || '');

		if (!source || !mp || !fstype)
			continue;

		if (mp != '/' && path != mp &&
		    substr(path, 0, length(mp) + 1) != mp + '/')
			continue;

		if (best == null || length(mp) > length(best.mountpoint))
			best = {
				source: source,
				mountpoint: mp,
				fstype: fstype
			};
	}

	return best;
}
