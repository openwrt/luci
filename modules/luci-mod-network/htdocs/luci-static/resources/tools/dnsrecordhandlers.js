'use strict';
'require baseclass';


const svcParamKeyMap = {
	/* RFC9460 §14.3.2 */
	mandatory: 0,
	alpn: 1,
	'no-default-alpn': 2,
	port: 3,
	ipv4hint: 4,
	ech: 5,
	ipv6hint: 6
};


return baseclass.extend({

	/* RFC9460 Test Vectors pass:
	D1 Figure 2: AliasMode
	D2 Figure 3: TargetName Is "."
	D2 Figure 4: Specifies a Port
	D2 Figure 5: A Generic Key and Unquoted Value

	D2 Figure 7: Two Quoted IPv6 Hints
	D2 Figure 8: An IPv6 Hint Using the Embedded IPv4 Syntax
	D2 Figure 9: SvcParamKey Ordering Is Arbitrary in Presentation Format but Sorted in Wire Format

	Failure cases (pass):
	D3 Figure 11: Multiple Instances of the Same SvcParamKey
	D3 Figure 12: Missing SvcParamValues That Must Be Non-Empty
	D3 Figure 13: The "no-default-alpn" SvcParamKey Value Must Be Empty
	D3 Figure 14: A Mandatory SvcParam Is Missing
	D3 Figure 15: The "mandatory" SvcParamKey Must Not Be Included in the Mandatory List
	D3 Figure 16: Multiple Instances of the Same SvcParamKey in the Mandatory List

	Encoding - Not implemented - escape sequence handling
	D2 Figure 6: A Generic Key and Quoted Value with a Decimal Escape
	D2 Figure 10: An "alpn" Value with an Escaped Comma and an Escaped Backslash in Two Presentation Formats
	*/

	buildSvcbHex(priority, target, params) {
		let buf = [];
		
		priority = isNaN(priority) ? 1 : priority;

		// Priority: 2 bytes
		buf.push((priority >> 8) & 0xff, priority & 0xff);

		// TargetName in DNS wire format (labels with length prefixes)
		if (target !== '.') { // D2 Figure 3
			if (target.endsWith('.')) target = target.slice(0, -1);
			target.split('.').forEach(part => {
				buf.push(part.length);
				for (let i = 0; i < part.length; i++)
					buf.push(part.charCodeAt(i));
			});
		}
		buf.push(0); // end of name

		if (priority === 0) {
			// AliasMode (priority 0) shall point to something; target '.' is ServiceMode
			if (target === '.') return null;

			/* RFC 9461 §1.2: "SvcPriority (Section 2.4.1): The priority of this record
			(relative to others, with lower values preferred). A value of 0 indicates AliasMode."
			So return here - AliasMode needs only priority and target. */
			return buf.map(b => b.toString(16).padStart(2, '0')).join('');
		}

		// Collect all parameters as { keyNum, keyName, valueBytes }
		const seenKeys = new Set();
		const paramList = [];
		let mandatoryKeys = new Set();
		let definedAlpn = new Set();
		let noDefaultAlpn = false;

		params.forEach(line => {
			if (!line.trim()) return;

			let [keyName, val = ''] = line.split('=');
			keyName = keyName.trim().replace(/^"(.*)"$/, '$1');
			val = val.trim().replace(/^"(.*)"$/, '$1');

			let keyNum = this.svcParamKeyToNumber(keyName);
			if (keyNum == null) return null; // Stop on unknown keys

			// Stop on duplicate keys - D3 Figure 11
			if (seenKeys.has(keyName)) return null;
			seenKeys.add(keyName);

			// Only 'no-default-alpn' key takes no values - D3 Figure 12
			if (keyNum !== 2 && val === '')
				return null;

			// Stash 'mandatory' keys
			if (keyNum === 0) mandatoryKeys = new Set(val.split(',').filter(n => n != ''));

			// Stash 'alpn' values
			if (keyNum === 1) definedAlpn = new Set(val.split(',').filter(n => n != ''));

			// Encountered 'no-default-alpn'
			if (keyNum === 2) noDefaultAlpn = true;

			let valueBytes = this.encodeSvcParamValue(keyName, val);
			paramList.push({ keyNum, keyName, valueBytes });
		});

		/* RFC9460 - §7.1.1
		When "no-default-alpn" is specified in an RR, "alpn" must also be
		specified in order for the RR to be "self-consistent" (Section 2.4.3). */
		if (noDefaultAlpn && definedAlpn.size === 0) return null;

		// Ensure we got mandated keys - D3 Figure 14
		for (const key of mandatoryKeys) {
			if (!seenKeys.has(key)) {
				return null;
			}
		}

		// Sort by numeric key - D2 Figure 9
		paramList.sort((a, b) => a.keyNum - b.keyNum);

		// Write each key/value in wire format
		for (const p of paramList) {
			buf.push((p.keyNum >> 8) & 0xff, p.keyNum & 0xff);
			buf.push((p.valueBytes.length >> 8) & 0xff, p.valueBytes.length & 0xff);
			buf.push(...p.valueBytes);
		}

		// Convert to hex string
		return buf.map(b => b.toString(16).padStart(2, '0')).join('');
	},

	svcParamKeyToNumber(name) {
		name = name.toLowerCase();
		if (name in svcParamKeyMap)
			return svcParamKeyMap[name];

		const match = name.match(/^key(\d{1,5})$/);
		if (match) {
			const n = parseInt(match[1], 10);
			if (n >= 0 && n <= 65535) return n;
		}
		return null;
	},

	encodeSvcParamValue(key, value) {
		switch (key) {
			case 'mandatory':
				const seen = new Set();
				const keys = value.split(',')
					.map(k => k.trim())
					.filter(k => {
						if (seen.has(k)) return false; // D3 Figure 16
						seen.add(k);
						return true;
					})
					.map(k => this.svcParamKeyToNumber(k))
					.filter(n => n != null)
					.filter(n => n != 0) // D3 Figure 15
					.sort((a, b) => a - b); // Ascending order - D2 Figure 9
				return keys.map(n => [(n >> 8) & 0xff, n & 0xff]).flat();

			case 'ech': // Assume ech is in base64
				return Array.prototype.map.call(atob(value), c => c.charCodeAt(0)); // OR Uint8Array.fromBase64(value)
			case 'alpn':
				/* (RFC 9460 §7.1.1 The wire-format value for "alpn" consists of
				at least one alpn-id prefixed by its length as a single octet */
				return value.split(',').map(v => {
					const len = v.length;
					return [len, ...[...v].map(c => c.charCodeAt(0))];
				}).flat();

			case 'no-default-alpn':
				return []; // zero-length value - D3 Figure 13

			case 'port': // D2 Figure 4
				const port = parseInt(value, 10);
				return [(port >> 8) & 0xff, port & 0xff];

			case 'ipv4hint':
				return value.split(',').map(ip => ip.trim().split('.').map(x => parseInt(x, 10))).flat();

			// case 'ech':
			// 	return value.match(/.{1,2}/g).map(b => parseInt(b, 16));

			case 'ipv6hint':
				return value.split(',').map(ip => {
					ip = ip.trim();

					// Check for IPv4-in-IPv6 (e.g. ::192.0.2.33) - D2 Figure 8
					let ipv4Tail = null;
					if (ip.match(/\d+\.\d+\.\d+\.\d+$/)) {
						const parts = ip.split(':');
						ipv4Tail = parts.pop(); // last part is IPv4
						ip = parts.join(':');

						const octets = ipv4Tail.split('.').map(n => parseInt(n, 10));
						if (octets.length !== 4) return null;

						const word1 = ((octets[0] << 8) | octets[1]).toString(16).padStart(4, '0');
						const word2 = ((octets[2] << 8) | octets[3]).toString(16).padStart(4, '0');

						ip += `:${word1}:${word2}`;
					}

					// Split and expand abbreviated ::
					let parts = ip.trim().split(':');
					// Expand shorthand :: into full 8-part address
					if (parts.includes('')) {
						const missing = 8 - parts.filter(p => p !== '').length;
						const expanded = [];
						for (let i = 0; i < parts.length; i++) {
							if (parts[i] === '' && (i === 0 || parts[i - 1] !== '')) {
								for (let j = 0; j < missing; j++) expanded.push('0000');
							} else if (parts[i] !== '') {
								expanded.push(parts[i].padStart(4, '0'));
							}
						}
						parts = expanded;
					} else {
						parts = parts.map(p => p.padStart(4, '0'));
					}
					return parts.map(p => [
						parseInt(p.slice(0, 2), 16),
						parseInt(p.slice(2, 4), 16)
					]).flat();
				}).flat();

			default:
				// Support custom keyNNNN = value (RFC 9461 §8)
				/* In wire format, the keys are represented by their numeric values
				in network byte order, concatenated in strictly increasing numeric order. */
				if (/^key\d{1,5}$/i.test(key)) {
					return value.split(',').map(v => {
						// interpret as ASCII text — one value or comma-separated
						return [...v].map(c => c.charCodeAt(0));
					}).flat();
				}
				return [];
		}
	},

	parseSvcbHex(hex) {
		if (!hex) return null;

		let data = hex.replace(/[\s:]/g, '').toLowerCase();
		let buf = new Uint8Array(data.match(/.{2}/g).map(b => parseInt(b, 16)));
		let view = new DataView(buf.buffer);

		let offset = 0;

		// Parse priority
		if (buf.length < 2) return null;
		let priority = view.getUint16(offset);
		offset += 2;

		// Parse target name (DNS wire format)
		function parseName() {
			let labels = [];
			while (offset < buf.length) {
				let len = buf[offset++];
				if (len === 0) break;
				if (offset + len > buf.length) return null;
				let label = String.fromCharCode(...buf.slice(offset, offset + len));
				labels.push(label);
				offset += len;
			}
			return labels.join('.') + '.';
		}
		let target = parseName();
		if (target === null) return null;

		let svcParams = [];

		// Parse svcParams
		while (offset + 4 <= buf.length) {
			let key = view.getUint16(offset);
			let len = view.getUint16(offset + 2);
			offset += 4;

			if (offset + len > buf.length) break;

			let valBuf = buf.slice(offset, offset + len);
			offset += len;

			let keyname = this.svcParamKeyFromNumber(key);

			// Handle empty-value flag "no-default-alpn"
			if (keyname === 'no-default-alpn' && valBuf.length === 0) {
				svcParams.push(keyname);
			} else {
				let valstr = this.decodeSvcParamValue(keyname, valBuf);
				svcParams.push(`${keyname}=${valstr}`);
			}
		}

		return {
			priority,
			target,
			params: svcParams
		};
	},

	svcParamKeyFromNumber(num) {
		for (const [key, val] of Object.entries(svcParamKeyMap)) {
			if (val === num) return key;
		}
		return `key${num}`;
	},

	decodeSvcParamValue(key, buf) {
		switch (key) {
			case 'mandatory':
				const keys = [];
				for (let i = 0; i + 1 < buf.length; i += 2) {
					const k = (buf[i] << 8) | buf[i + 1];
					keys.push(this.svcParamKeyFromNumber(k));
				}
				return keys.join(',');

			case 'ech':
				return btoa(String.fromCharCode(...buf)); // OR buf.toBase64()
			case 'alpn': {
				let pos = 0, result = [];
				while (pos < buf.length) {
					let len = buf[pos++];
					if (pos + len > buf.length) break;
					let s = String.fromCharCode(...buf.slice(pos, pos + len));
					result.push(s);
					pos += len;
				}
				return result.join(',');
			}

			case 'no-default-alpn':
				return ''; // Flag only

			case 'port':
				return (buf[0] << 8 | buf[1]).toString();

			case 'ipv4hint':
				return [...buf].reduce((acc, byte, i) => {
					if (i % 4 === 0) acc.push([]);
					acc[acc.length - 1].push(byte);
					return acc;
				}, []).map(ip => ip.join('.')).join(',');

			// case 'ech':
			// 	return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');

			case 'ipv6hint':
				const addrs = [];
				for (let i = 0; i + 15 <= buf.length; i += 16) {
					let addr = [];
					for (let j = 0; j < 16; j += 2) {
						const hi = buf[i + j];
						const lo = buf[i + j + 1];
						const word = ((hi << 8) | lo).toString(16).padStart(4, '0');
						addr.push(word);
					}
					addrs.push(this.compressIPv6(addr));
				}
				return addrs.join(',');

			default:
				// Decode keyNNNN=... as raw ASCII if it's a custom numeric key
				if (/^key\d{1,5}$/i.test(key)) {
					return String.fromCharCode(...buf);
				}
				return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
		}
	},

	compressIPv6(hextets) {
		// hextets: Array of 8 strings like ['2001', '0db8', '0000', ..., '0001']

		// Normalize to lowercase + strip leading zeros
		const normalized = hextets.map(h => parseInt(h, 16).toString(16));

		// Find the longest run of zeroes
		let bestStart = -1, bestLen = 0;
		for (let i = 0; i < normalized.length; ) {
			if (normalized[i] !== '0') {
				i++;
				continue;
			}
			let start = i;
			while (i < normalized.length && normalized[i] === '0') i++;
			let len = i - start;
			if (len > bestLen) {
				bestStart = start;
				bestLen = len;
			}
		}

		// If no run of two or more zeroes, no compression
		if (bestLen < 2) return normalized.join(':');

		// Compress
		const head = normalized.slice(0, bestStart).join(':');
		const tail = normalized.slice(bestStart + bestLen).join(':');
		if (head && tail) return `${head}::${tail}`;
		else if (head) return `${head}::`;
		else if (tail) return `::${tail}`;
		else return `::`;
	}
});
