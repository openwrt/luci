'use strict';

import { basename, glob, open, readfile } from 'fs';

// Linux's bridge sysfs ABI uses 16-byte records. It does not expose VLAN IDs,
// so never use this provider to locate clients on a VLAN-filtering bridge.
function decode_fdb(data, size, ports) {
	const entries = [];
	for (let offset = 0; offset + 16 <= size; offset += 16) {
		const number = ord(data, offset + 6) | (ord(data, offset + 12) << 8);
		if (ord(data, offset + 7) || (ord(data, offset) & 1) || !ports[number])
			continue;
		const b0 = ord(data, offset), b1 = ord(data, offset + 1), b2 = ord(data, offset + 2),
		      b3 = ord(data, offset + 3), b4 = ord(data, offset + 4), b5 = ord(data, offset + 5);
		if (b0 | b1 | b2 | b3 | b4 | b5)
			push(entries, {
				mac: sprintf('%02X:%02X:%02X:%02X:%02X:%02X', b0, b1, b2, b3, b4, b5),
				port: ports[number]
			});
	}
	return entries;
}

export function collect() {
	const root = '/sys/class/net';
	// One credit per bridge, port, raw FDB record or ARP row. Kernel device
	// names and IPv4/MAC fields are bounded, so this also bounds the ubus reply.
	let remaining = 2048, partial = false;
	const bridges = [], neighbours = [];
	for (let path in glob(`${root}/*/bridge`) ?? []) {
		if (!remaining) {
			partial = true;
			break;
		}
		remaining--;
		const device = basename(substr(path, 0, length(path) - 7));
		const filtering = trim(readfile(`${path}/vlan_filtering`) ?? '') != '0';
		const ports = {}, members = [];
		for (let member in glob(`${root}/${device}/brif/*`) ?? []) {
			if (!remaining) {
				partial = true;
				break;
			}
			remaining--;
			const name = basename(member);
			push(members, name);
			if (!filtering) {
				const number = int(trim(readfile(`${member}/port_no`) ?? ''), 16);
				if (number > 0)
					ports[number] = name;
			}
		}
		// Read one extra whole record to distinguish truncation from EOF.
		const limit = remaining * 16;
		const data = filtering ? null : readfile(`${root}/${device}/brforward`, limit + 16);
		const available = type(data) == 'string';
		const size = available ? min(length(data), limit) : 0;
		if (!available || length(data) > limit || size % 16)
			partial = true;
		remaining -= int((size + 15) / 16);
		push(bridges, { device, members, available, entries: decode_fdb(data, size, ports) });
	}

	const arp = open('/proc/net/arp');
	if (arp) {
		arp.read('line'); // header
		for (let line; (line = arp.read('line')); ) {
			if (!remaining) {
				partial = true;
				break;
			}
			remaining--;
			const fields = split(trim(line), /\s+/);
			if (length(fields) == 6 && (int(fields[2], 16) & 2)) {
				const mac = uc(fields[3]);
				if (mac != '00:00:00:00:00:00')
					push(neighbours, { address: fields[0], mac, device: fields[5] });
			}
		}
		arp.close();
	}
	else {
		partial = true;
	}
	return { bridges, neighbours, partial };
};
