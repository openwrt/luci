'use strict';
'require view';
'require rpc';
'require poll';
'require fs';
'require dom';
'require ui';
'require form';
'require uci';
'require network';
'require tools.widgets as widgets';

let Hosts, Remotehosts, Remoteinfo, Localinfo, Clients, WifiNetworks, Initscript;

const dns_cache = [];
const hostapdClientData = [];

const callDeleteKnown = rpc.declare({
	object: 'usteer',
	method: 'delete_known',
	params: ['node', 'address'],
	reject: true
});

function SplitWlan(wlan) {
	let wlansplit = [];
	if (typeof wlan.split('#')[1] !== 'undefined') {
		wlansplit=wlan.split('#');
		if (typeof dns_cache[wlansplit[0]] !== 'undefined') {
			wlansplit[0]=dns_cache[wlansplit[0]];
		}
	} else {
		wlansplit[0]=_('This AP'); 
		wlansplit[1]=wlan; 
	}
	return wlansplit;
}


function collectHearingClient(client_table_entries, mac) {
	if (typeof Clients[mac] !== 'undefined') {
		for (let wlanc in Clients[mac]) {
			let SSID = '';
			let freq = 0;
			if (typeof Localinfo[wlanc] !== 'undefined') {
				SSID = Localinfo[wlanc]['ssid'];
				freq = Localinfo[wlanc]['freq'];
			}
			if (typeof Remoteinfo[wlanc] !== 'undefined') {
				SSID = Remoteinfo[wlanc]['ssid'];
				freq = Remoteinfo[wlanc]['freq'];
			}
			const wlansplit=SplitWlan(wlanc);
			client_table_entries.push([
				'<nobr>' + '%h'.format(wlansplit[0]) + '</nobr>',
				'<nobr>' + '%h'.format(wlansplit[1]) + '</nobr>',
				'%h'.format(SSID),
				'%h'.format(freq),
				Clients[mac][wlanc]['connected'] === true ? 'Yes' : 'No',
				typeof Clients[mac][wlanc]['signal'] !== 'undefined' ? '%h'.format(Clients[mac][wlanc]['signal']) : ''
			]);
		}
	}
}

function buildHearingMacBlock(mac) {
	let maciphost = '%h'.format(mac);
	const macUp = mac.toUpperCase();
	const macn = macUp.replace(/:/g,'');
	if (typeof Hosts[macUp] !== 'undefined') {
		if ((String(Hosts[macUp]['ipaddrs'][0]).length > 0) && (typeof Hosts[macUp]['ipaddrs'][0] !== 'undefined'))
			maciphost += '\u2003' + Hosts[macUp]['ipaddrs'];
		if ((String(Hosts[macUp]['name']).length > 0) && (typeof Hosts[macUp]['name'] !== 'undefined'))
			maciphost += '\u2003%h'.format(Hosts[macUp]['name']);
	}
	const client_table = E('table', {'class': 'table cbi-section-table','id':'client_table'+macn}, [
		E('tr', {'class': 'tr table-titles'}, [
			E('th', {'class': 'th'}, _('AP','Name or IP address of access point')),
			E('th', {'class': 'th'}, _('Interface name','interface name in usteer overview')),
			E('th', {'class': 'th', 'style': 'width:25%'}, _('SSID')),
			E('th', {'class': 'th', 'style': 'width:15%'}, _('Frequency','BSS operating frequency in usteer overview')),
			E('th', {'class': 'th', 'style': 'width:15%'}, _('Connected','Connection state in usteer overview')),
			E('th', {'class': 'th', 'style': 'width:15%'}, _('Signal','Signal strength reported by wireless station in usteer overview'))
		])
	]);
	const client_table_entries = [];
	collectHearingClient(client_table_entries, mac);
	cbi_update_table(client_table, client_table_entries, E('em', _('No data')));
	return E([E('h4', maciphost), client_table]);
}

const HearingMap = form.DummyValue.extend({
	renderWidget() {
		const body = E([
			E('h3', _('Hearing map'))
		]);
		for (let mac in Clients)
			body.appendChild(buildHearingMacBlock(mac));
		return E('div', {'class': 'cbi-section cbi-tblsection', 'id': 'hearingmap_body'}, [body]);
	}
});




function collectWlanAPInfoEntries(connectioninfo_table_entries, wlanAPInfos) {
	for (let wlan in wlanAPInfos) {
		const wlansplit=SplitWlan(wlan);
		connectioninfo_table_entries.push([
			'<nobr>' + '%h'.format(wlansplit[0]) + '</nobr>',
			'<nobr>' + '%h'.format(wlansplit[1]) + '</nobr>',
			'%h'.format(wlanAPInfos[wlan]['bssid']),
			'%h'.format(wlanAPInfos[wlan]['ssid']),
			'%h'.format(wlanAPInfos[wlan]['freq']),
			'%h'.format(wlanAPInfos[wlan]['n_assoc']),
			'%h'.format(wlanAPInfos[wlan]['noise']),
			'%h'.format(wlanAPInfos[wlan]['load']),
			'%h'.format(wlanAPInfos[wlan]['max_assoc']),
			typeof wlanAPInfos[wlan]['roam_events']['source'] !== 'undefined' ? '%h'.format(wlanAPInfos[wlan]['roam_events']['source']) : '',
			typeof wlanAPInfos[wlan]['roam_events']['target'] !== 'undefined' ? '%h'.format(wlanAPInfos[wlan]['roam_events']['target']) : ''
		]);
	}
};


function knownDeleteClick(node, mac, btn) {
	btn.disabled = true;
	callDeleteKnown(node, mac).then(function() {
		const row = btn.closest('tr');
		if (row)
			row.remove();
	}).catch(function(err) {
		btn.disabled = false;
		ui.addNotification(null, E('p', err.message ?? String(err)), 'error');
	});
}

function collectKnownStaEntries(known_table_entries, wlanAPInfos, isLocal) {
	for (let wlan in wlanAPInfos) {
		const known = wlanAPInfos[wlan]['known_sta'];
		if (!known)
			continue;
		const wlansplit = SplitWlan(wlan);
		const ssid = wlanAPInfos[wlan]['ssid'];
		for (let i = 0; i < known.length; i++) {
			const mac = known[i]['address'];
			const macUp = mac.toUpperCase();
			let hostname = '';
			if ((typeof Hosts[macUp] !== 'undefined') &&
			    (typeof Hosts[macUp]['name'] !== 'undefined') &&
			    (String(Hosts[macUp]['name']).length > 0))
				hostname = Hosts[macUp]['name'];
			known_table_entries.push([
				'<nobr>' + '%h'.format(wlansplit[0]) + '</nobr>',
				'<nobr>' + '%h'.format(wlansplit[1]) + '</nobr>',
				'%h'.format(ssid),
				'%h'.format(mac),
				'%h'.format(hostname),
				'%h'.format(known[i]['signal']),
				'%h'.format(Math.round(known[i]['age'] / 1000)),
				/* Only local nodes: deleting a remote node's entry only
				 * clears our own synced copy of it, not the remote peer's
				 * own record, so it reappears on the next remote update
				 * (remote_update_interval) - offering Delete there would
				 * look like it worked and then silently undo itself. */
				isLocal ? E('button', {
					'class': 'btn cbi-button cbi-button-remove',
					'click': function(ev) {
						knownDeleteClick(wlan, mac, ev.currentTarget);
					}
				}, _('Delete')) : ''
			]);
		}
	}
}

const KnownStations = form.DummyValue.extend({
	renderWidget() {
		const body = E([
			E('h3', _('Known stations')),
			E('div',
				_('Best signal ever locally observed per node for a station, kept as a roaming fallback for stations that never probe or report RRM measurements once associated (many home-appliance/IoT WiFi stacks never do).') + ' ' +
				_('A signal of 0 is a cold-start placeholder, not a real reading: it marks a node as "worth exploring" for a station connected elsewhere, so the station gets pushed there once to find out for real.') + ' ' +
				_('Only populated while "Known stations" is enabled in Settings. Use the Delete button to manually remove a stale or unwanted entry from this AP, entries owned by a remote node can only be removed on that node.')
			)
		]);
		const known_table = E('table', {'class': 'table cbi-section-table', 'id': 'known_table'}, [
			E('tr', {'class': 'tr table-titles'}, [
				E('th', {'class': 'th'}, _('AP','Name or IP address of access point')),
				E('th', {'class': 'th'}, _('Interface name','interface name in usteer overview')),
				E('th', {'class': 'th'}, _('SSID')),
				E('th', {'class': 'th'}, _('MAC')),
				E('th', {'class': 'th'}, _('Host', 'host hint in usteer overview')),
				E('th', {'class': 'th'}, _('Signal')),
				E('th', {'class': 'th'}, _('Age (s)')),
				E('th', {'class': 'th'}, '')
			])
		]);
		const known_table_entries = [];
		collectKnownStaEntries(known_table_entries, Localinfo, true);
		collectKnownStaEntries(known_table_entries, Remoteinfo, false);
		cbi_update_table(known_table, known_table_entries, E('em', _('No data')));
		body.appendChild(known_table);
		return E('div', {'class': 'cbi-section cbi-tblsection'}, [body]);
	}
});

const RSN_CIPHER_MAP = {
    "00-0f-ac-0": _("Use group cipher"),
    "00-0f-ac-1": "WEP-40",
    "00-0f-ac-2": "TKIP",
    "00-0f-ac-3": _("Reserved"),
    "00-0f-ac-4": "AES-CCMP-128",
    "00-0f-ac-5": "WEP-104",
    "00-0f-ac-6": "BIP-CMAC-128",
    "00-0f-ac-7": _("Group addressed traffic not allowed"),
    "00-0f-ac-8": "AES-GCMP-128",
    "00-0f-ac-9": "AES-GCMP-256",
    "00-0f-ac-10": "AES-CCMP-256",
    "00-0f-ac-11": "BIP-GMAC-128",
    "00-0f-ac-12": "BIP-GMAC-256",
    "00-0f-ac-13": "BIP-CMAC-256",
};

const RSN_AKM_MAP = {
    "00-0f-ac-1": "802.1X",
    "00-0f-ac-2": "PSK",
    "00-0f-ac-3": "FT 802.1X",
    "00-0f-ac-4": "FT PSK",
    "00-0f-ac-5": "WPA2 Enterprise SHA-256",
    "00-0f-ac-6": "WPA2 PSK SHA-256",
    "00-0f-ac-7": "TDLS",
    "00-0f-ac-8": "SAE",
    "00-0f-ac-9": "FT SAE",
    "00-0f-ac-10": _("AP PeerKey"),
    "00-0f-ac-11": "Suite B 192-bit",
    "00-0f-ac-12": "Suite B 192-bit FT",
    "00-0f-ac-13": "FILS SHA-256",
    "00-0f-ac-14": "FILS SHA-384",
    "00-0f-ac-15": "FILS FT SHA-256",
    "00-0f-ac-16": "FILS FT SHA-384",
    "00-0f-ac-17": "OWE",
    "00-0f-ac-18": "FT OWE",
};

function translateCipher(value) {
	if (!value) return ""; 
	return RSN_CIPHER_MAP[value] ?? _("Unrecognized cipher code")+": "+value;
}

function translateAkm(value) { 
	if (!value) return _("Install hostapd_cli for AKM and cipher info"); 
	return RSN_AKM_MAP[value] ?? _("Unknown AKM")+": "+value;
}

function tooltip(mac, IP, hostname, wlan) {
	const body= E([]);
	body.appendChild(E('div', '%h'.format(mac)));
	if (typeof IP !== 'undefined') {
		for (let IPaddr in IP['ipaddrs']) body.appendChild(E('div', '%h'.format(IP['ipaddrs'][IPaddr])));
		for (let IPaddr in IP['ip6addrs']) body.appendChild(E('div', '%h'.format(IP['ip6addrs'][IPaddr])));;
	}
	if (hostname !== '') {
		body.appendChild(E('div', '%h'.format(hostname)));
	}
	if (wlan==_('This AP')) {
		body.appendChild(E('div', 
		           '%h '.format(translateAkm(hostapdClientData[mac.toUpperCase()]?.AKMSuiteSelector))+
				   '%h'.format(translateCipher(hostapdClientData[mac.toUpperCase()]?.dot11RSNAStatsSelectedPairwiseCipher))
		));
	}
	return body;
}

function collectWlanAPInfos(compactconnectioninfo_table_entries, wlanAPInfos) {
	for (let wlan in wlanAPInfos) {
		const hostl = E([]);
		const wlansplit=SplitWlan(wlan);
		for (let mac in Clients) {
			if (typeof Clients[mac] !== 'undefined')
				if (typeof Clients[mac][wlan] !== 'undefined')
					if (String(Clients[mac][wlan]['connected']).valueOf() === 'true') {
						let foundname = mac;
						let IP = '';
						let hostname = '';
						const macUp = mac.toUpperCase();
						if (typeof Hosts[macUp] !== 'undefined') {
							if ((typeof Hosts[macUp]['ipaddrs'][0] !== 'undefined') && (String(Hosts[macUp]['ipaddrs'][0]).length > 0)) {
								IP = Hosts[macUp]['ipaddrs'][0];
								foundname = IP;
							}
							if ((typeof Hosts[macUp]['name'] !== 'undefined') && (String(Hosts[macUp]['name']).length > 0)) {
								hostname =  Hosts[macUp]['name'];
								foundname = hostname;
							}
						}
						hostl.appendChild(
							E('span', { 'class': 'cbi-tooltip-container' }, [
								'%h\u2003'.format(foundname),
								E('div', { 'class': 'cbi-tooltip' }, tooltip(mac, Hosts[macUp], hostname, wlansplit[0]))
							])
						);
					}
		}
		compactconnectioninfo_table_entries.push([
			'<nobr>' + '%h'.format(wlansplit[0]) + '</nobr>',
			'<nobr>' + '%h'.format(wlansplit[1]) + '</nobr>',
			'%h'.format(wlanAPInfos[wlan]['ssid']),
			'%h'.format(wlanAPInfos[wlan]['freq']),
			'%h'.format(wlanAPInfos[wlan]['load']),
			'%h'.format(wlanAPInfos[wlan]['n_assoc']),
			hostl
		]);
	}
};

const callNetworkRrdnsLookup = rpc.declare({
	object: 'network.rrdns',
	method: 'lookup',
	params: [ 'addrs', 'timeout', 'limit' ],
	expect: { '': {} }
});


function collectRemoteHosts (remotehosttableentries,Remotehosts) {
	const getUndefinedDnsCacheIPs = (Remotehosts, dns_cache) =>
		Object.keys(Remotehosts).filter(IPaddr => !dns_cache.hasOwnProperty(IPaddr));

	const ipAddrs = getUndefinedDnsCacheIPs(Remotehosts, dns_cache);

	L.resolveDefault(callNetworkRrdnsLookup(ipAddrs, 1000, 1000), {}).then(function(replies) {
				for (let address of ipAddrs) {
					if (!address)
						continue;
					if (replies[address]) {
						dns_cache[address] = replies[address];
						continue;
					} else {
						if (Hosts.length >0)
							dns_cache[address]=Hosts[
								Object.keys(Hosts).find(mac =>   
									((typeof Hosts[mac]['name'] !== 'undefined') && 
										((Object.keys(Hosts[mac]['ip6addrs']).find(IPaddr2 => (address === Hosts[mac]['ip6addrs'][IPaddr2]))) ||
										(Object.keys(Hosts[mac]['ipaddrs']).find(IPaddr2 => (address === Hosts[mac]['ipaddrs'][IPaddr2])))))
										)
								]['name'];
					}
				}
	});

	for (let IPaddr in Remotehosts) {
		remotehosttableentries.push([IPaddr,'%h'.format(dns_cache[IPaddr]),'%h'.format(Remotehosts[IPaddr]['id'])]);
	}
}


const Clientinfooverview = form.DummyValue.extend({
	renderWidget() {
		const body = E([
			E('h3', _('Remote hosts'))
		]);
		const remotehost_table = E('table', {'class': 'table cbi-section-table', 'id': 'remotehost_table'}, [
			E('tr', {'class': 'tr table-titles'}, [
				E('th', {'class': 'th'}, _('IP address')),
				E('th', {'class': 'th'}, _('Hostname')),
				E('th', {'class': 'th'}, _('Identifier'))
			])
		]);
		const remotehosttableentries = [];
		collectRemoteHosts(remotehosttableentries,Remotehosts);
		cbi_update_table(remotehost_table, remotehosttableentries, E('em', _('No data')));
		body.appendChild(remotehost_table);
		body.appendChild(
			E('h3', _('Client list'))
		);
		const connectioninfo_table = E('table', {'class': 'table cbi-section-table', 'id': 'connectioninfo_table'}, [
			E('tr', {'class': 'tr table-titles'}, [
				E('th', {'class': 'th'}, _('AP','Name or IP address of access point')),
				E('th', {'class': 'th'}, _('Interface name','interface name in usteer overview')),
				E('th', {'class': 'th'}, _('BSSID')),
				E('th', {'class': 'th'}, _('SSID')),
				E('th', {'class': 'th'}, _('Frequency','BSS operating frequency in usteer overview')),
				E('th', {'class': 'th'}, _('N','Number of associated clients in usteer overview')),
				E('th', {'class': 'th'}, _('Noise','Channel noise in usteer overview')),
				E('th', {'class': 'th'}, _('Load','Channel load in usteer overview')),
				E('th', {'class': 'th'}, _('Max assoc','Max associated clients in usteer overview')),
				E('th', {'class': 'th'}, _('Roam src','Roam source in usteer overview')),
				E('th', {'class': 'th'}, _('Roam tgt','Roam target in usteer overview'))
			])
		]);
		const connectioninfo_table_entries = [];
		collectWlanAPInfoEntries(connectioninfo_table_entries, Localinfo);
		collectWlanAPInfoEntries(connectioninfo_table_entries, Remoteinfo);

		cbi_update_table(connectioninfo_table, connectioninfo_table_entries, E('em', _('No data')));
		body.appendChild(connectioninfo_table);
		const compactconnectioninfo_table = E('table', {'class': 'table cbi-section-table','id': 'compactconnectioninfo_table'}, [
			E('tr', {'class': 'tr table-titles'}, [
				E('th', {'class': 'th'}, _('AP','Name or IP address of access point')),
				E('th', {'class': 'th'}, _('Interface name','interface name in usteer overview')),
				E('th', {'class': 'th'}, _('SSID')),
				E('th', {'class': 'th'}, _('Frequency', 'BSS operating frequency in usteer overview')),
				E('th', {'class': 'th'}, _('Load', 'Channel load in usteer overview')),
				E('th', {'class': 'th'}, _('N', 'Number of associated clients in usteer overview')),
				E('th', {'class': 'th'}, _('Host', 'host hint in usteer overview'))
			])
		]);
		const compactconnectioninfo_table_entries = [];
		collectWlanAPInfos(compactconnectioninfo_table_entries, Localinfo);
		collectWlanAPInfos(compactconnectioninfo_table_entries, Remoteinfo);
		cbi_update_table(compactconnectioninfo_table, compactconnectioninfo_table_entries, E('em', _('No data')));
		body.appendChild(compactconnectioninfo_table);
		return E('div', {'class': 'cbi-section cbi-tblsection'}, [body]);
	}
});

const Settingstitle = form.DummyValue.extend({
	renderWidget() {
		const body = E([
			E('h3', _('Settings')),
			E('div',
				_('The first four options below are mandatory.') + ' ' +
				_('Also be sure to enable rrm reports, 80211kv, etc.') + ' ' +
				_('See <a %s>documentation</a>').format('href="https://openwrt.org/docs/guide-user/network/wifi/usteer"')
			),
		]);
		return E('div', [body]);
	}
});

let footerdata;
const Settingsfooter = form.DummyValue.extend({
	renderWidget() {
		return E('div', {'style': 'width:100%'}, [footerdata]);
	}
});

function parseAllSta(text) {
    const lines = text.split('\n');
    let currentMac = null;

    for (const raw of lines) {
        const line = raw.trim();
        // Detect MAC address line
        if (/^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i.test(line)) {
            currentMac = line.toUpperCase();
            hostapdClientData[currentMac] = {};
            continue;
        }
        if (currentMac && line.includes('=')) {
            const [key, value] = line.split('=');
            hostapdClientData[currentMac][key] = value;
        }
    }
}

function getCipherAKM() {
	for (const wlan in Localinfo) {		
		fs.stat('/usr/sbin/hostapd_cli').then(stat => {
			if (!stat || stat.type !== 'file') { return; }
			fs.exec_direct('/usr/sbin/hostapd_cli', ['-i', wlan.split('.')[1], 'all_sta'])
				.then(res => { parseAllSta(res); })
				.catch(err => {});
		}).catch (function (){return null;});
	}
}

/* Object.create(null): a section-less SSID literally named "__proto__"
 * would otherwise hit Object.prototype's __proto__ setter instead of
 * creating an own property, silently breaking memoization for it. */
const ssidSectionIds = Object.create(null);
const usedSsidSectionIds = Object.create(null);

/* Maps an SSID to its 'usteer_ssid' section id. Prefers reusing an
 * existing section that already records this exact SSID, so the mapping
 * is stable across page loads regardless of the current SSID list's
 * order or composition - deriving ids purely from allocation order
 * would let an unrelated SSID's id shift onto a different SSID after a
 * deletion/reorder, orphaning its section and duplicating another one.
 * Only SSIDs with no existing section yet get a freshly allocated id,
 * collision-checked so two distinct SSIDs that only differ in
 * characters stripped by sanitization (e.g. "my wifi" and "my-wifi")
 * never end up sharing one section. */
function ssidSectionId(ssid) {
	uci.sections('usteer', 'usteer_ssid', function (sc) {
		usedSsidSectionIds[sc['.name']] = true;
		if (sc.ssid != null && !Object.prototype.hasOwnProperty.call(ssidSectionIds, sc.ssid))
			ssidSectionIds[sc.ssid] = sc['.name'];
	});

	if (Object.prototype.hasOwnProperty.call(ssidSectionIds, ssid))
		return ssidSectionIds[ssid];

	let base = 'ssid_' + ssid.replace(/[^a-zA-Z0-9_]/g, '_');
	if (/^[0-9]/.test(base))
		base = '_' + base;

	let id = base, n = 1;
	while (usedSsidSectionIds[id])
		id = base + '_' + (n++);

	usedSsidSectionIds[id] = true;
	ssidSectionIds[ssid] = id;

	return id;
}

/* Creates the 'usteer_ssid' UCI section that holds per-SSID overrides for
 * the given SSID, if it does not already exist. Called lazily, right
 * before a value is actually written to one of that SSID's fields (see
 * opt() in addSsidTab() below) - not eagerly for every configured SSID
 * just because the page was opened, which would stage a change (and the
 * "Unsaved changes" indicator) for every SSID without any user action,
 * and materialize a section for all of them on the next unrelated Save. */
function ensureSsidSection(sid, ssid) {
	if (!uci.get('usteer', sid))
		uci.add('usteer', 'usteer_ssid', sid);
	uci.set('usteer', sid, 'ssid', ssid);
}

/*
 * Adds one tab, named after the SSID, containing this SSID's own copy of
 * the roaming-policy options (no longer exposed in the global Settings
 * tab - each SSID overrides them independently). Every field
 * is bound (via ucisection/ucioption) to this SSID's own 'usteer_ssid'
 * section. Left empty, a field always falls back to whatever the shared
 * 'usteer' section has stored for that option (config_set_ssid_configs()
 * in ssid_config.c reads config.field whenever the per-SSID key is
 * absent from the JSON blob) - this holds whether this SSID's UCI
 * section exists yet or not, since an absent per-SSID option is never
 * sent to the daemon either way. The Value fields' placeholders show
 * usteer's compiled-in default purely as a hint of what the global
 * value is if nobody has overridden it - not what blank resolves to.
 * The option keys passed to taboption() are prefixed with the section
 * id purely so multiple SSID tabs sharing the same underlying field
 * names (e.g. "min_snr") don't collide within this one CBI section.
 */
function addSsidTab(s, ssid) {
	const sid = ssidSectionId(ssid);
	const tab = 'ssid_' + sid;
	let o;

	function opt(cls, field, label, descr) {
		const out = s.taboption(tab, cls, sid + '_' + field, label, descr);
		out.ucisection = sid;
		out.ucioption = field;
		out.optional = true;

		/* uci.set() on a section that doesn't exist yet is silently a
		 * no-op (see ensureSsidSection()), so the section has to be
		 * created just before the default write() runs, not instead of
		 * it - and only on an actual write, not merely because the field
		 * was rendered. */
		const write = out.write.bind(out);
		out.write = function (section_id, value) {
			ensureSsidSection(sid, ssid);
			return write(section_id, value);
		};

		/* Nothing to remove from a section that was never created. */
		const remove = out.remove.bind(out);
		out.remove = function (section_id) {
			if (!uci.get('usteer', sid))
				return;
			return remove(section_id);
		};

		return out;
	}

	s.tab(tab, ssid);

	/* Field order below mirrors struct usteer_config's declaration order
	 * (see ssid_config.h), grouped into the same visual clusters that
	 * order already produces - station tracking/policy timeouts first,
	 * then the SNR/signal family, then roaming, then band steering,
	 * then load kick. */

	o = opt(form.Value, 'sta_block_timeout', _('Sta block timeout'), _('Maximum amount of time (ms) a station on this SSID may be blocked due to policy decisions'));
	o.datatype = 'uinteger';
	o.placeholder = '30000 (ms)';

	o = opt(form.Value, 'local_sta_timeout', _('Local sta timeout'), _('Maximum amount of time (ms) a local unconnected station on this SSID is tracked'));
	o.datatype = 'uinteger';
	o.placeholder = '120000 (ms)';

	o = opt(form.Value, 'local_sta_update', _('Local sta update'), _('Local station information update interval (ms) for devices on this SSID'));
	o.datatype = 'uinteger';
	o.placeholder = '1000 (ms)';

	o = opt(form.Value, 'max_retry_band', _('Max retry band'), _('Maximum number of consecutive times a station on this SSID may be blocked by policy'));
	o.datatype = 'uinteger';
	o.placeholder = 5;

	o = opt(form.Value, 'seen_policy_timeout', _('Seen policy timeout'), _('Maximum idle time (ms) of a station entry on this SSID to be considered for policy decisions'));
	o.datatype = 'uinteger';
	o.placeholder = '30000 (ms)';

	/* A Flag can't express "off for this SSID" once the global usteer
	 * section has it on: an unchecked Flag whose value equals its
	 * default is removed rather than written (see parse() in form.js),
	 * so unchecking here would just fall back to the global value
	 * instead of overriding it. A three-way choice keeps the blank
	 * "inherit" state (still removed on save, so it doesn't force a
	 * per-SSID section into existence) while making Enable/Disable
	 * explicit overrides that write '1'/'0' regardless of the global
	 * setting. */
	o = opt(form.ListValue, 'assoc_steering', _('Assoc steering'), _('Allow rejecting assoc requests for steering purposes, for stations on this SSID'));
	o.value('', _('Use global setting'));
	o.value('1', _('Enable'));
	o.value('0', _('Disable'));
	o.default = '';

	o = opt(form.ListValue, 'probe_steering', _('Probe steering'), _('Allow ignoring probe requests for steering purposes, for stations on this SSID'));
	o.value('', _('Use global setting'));
	o.value('1', _('Enable'));
	o.value('0', _('Disable'));
	o.default = '';

	o = opt(form.Value, 'max_neighbor_reports', _('Max neighbor reports'), _('Maximum number of neighbor reports set for a node of this SSID'));
	o.datatype = 'uinteger';
	o.placeholder = 8;

	o = opt(form.Value, 'band_steering_threshold', _('Band steering threshold'), _('Minimum number of stations delta between bands on this SSID before band steering policy is active'));
	o.datatype = 'uinteger';
	o.placeholder = 5;

	o = opt(form.Value, 'load_balancing_threshold', _('Load balancing threshold'), _('Minimum number of stations delta between APs before load balancing policy is active, for this SSID'));
	o.datatype = 'uinteger';
	o.placeholder = 0;

	if (Initscript.includes('aggressiveness')) {
		o = opt(form.ListValue, 'aggressiveness', _('Aggressiveness'),
			_('Aggressiveness of BSS-transition-request to push a station connected to this SSID to another node, default 3')
		);
		o.value('0', _('0 No active transition'));
		o.value('1', _('1 Passive BSS-transition-request'));
		o.value('2', _('2 BSS-transition-request with disassociation imminent'));
		o.value('3', _('3 BSS-transition-request with disassociation imminent and timer'));
		o.value('4', _('4 BSS-transition-request with disassociation imminent, timer and forced disassociation'));
		o.default = '3';
		/* rmempty (true by default) already makes an unchanged value
		 * equal to o.default skip writing an explicit UCI override on
		 * save - optional only controls whether the widget itself
		 * offers a blank "-- Please choose --" entry, which is never
		 * a meaningful choice here since the widget always shows a
		 * real value (the override, or o.default). */
		o.optional = false;
		o.datatype = 'uinteger';
	}

	if (Initscript.includes('aggressiveness_mac_list')) {
		o = opt(form.DynamicList, 'aggressiveness_mac_list', _('Aggressiveness mac list'),
			_('List of MACs (lower case) to set aggressiveness per station on this SSID, e.g. ff:ff:ff:ff:ff:ff,2')+' '+
			_('See the Aggressiveness option above for this SSID for a list of numerical values')
		);
		o.datatype = 'list(string)';
	}

	/* min_snr, min_connect_snr, roam_scan_snr, roam_trigger_snr and
	 * band_steering_min_snr all share the same dual convention in the
	 * daemon (usteer_snr_to_signal() in policy.c): a negative value is
	 * taken as an already-absolute dBm signal level, a non-negative
	 * value (including the default 0) as an SNR relative to the noise
	 * floor. Named after what each threshold does (not after "SNR", a
	 * parameter name a new user has no reason to know) and led with the
	 * sign convention in the very first sentence of the description, so
	 * "0" is never misread as an impossible "0 dBm required" bar. */
	o = opt(form.Value, 'min_snr', _('Signal threshold'),
		_('Minimum positive (SNR) or negative signal level (-dBm) for a device on this SSID to remain connected')
	);
	o.datatype = 'integer';
	o.placeholder = '0 (SNR) or -95 (dBm)';

	o = opt(form.Value, 'min_snr_kick_delay', _('Min SNR kick delay'), _('Timeout after which a station on this SSID with SNR < min_SNR will be kicked'));
	o.datatype = 'uinteger';
	o.placeholder = '5000 (ms)';

	o = opt(form.Value, 'min_connect_snr', _('Connect threshold'),
		_('Minimum positive (SNR) or negative signal level (-dBm) for a device to be allowed to connect to this SSID')
	);
	o.datatype = 'integer';
	o.placeholder = '0 (SNR) or -95 (dBm)';

	o = opt(form.Value, 'signal_diff_threshold', _('Signal diff threshold'), _('Minimum signal strength difference until AP steering policy is active between nodes of this SSID'));
	o.datatype = 'uinteger';
	o.placeholder = 0;

	o = opt(form.Value, 'steer_reject_timeout', _('Steer reject timeout'), _('Timeout (ms) for which a device on this SSID will not be steered after rejecting a BSS-transition-request'));
	o.datatype = 'uinteger';
	o.placeholder = '60000 (ms)';

	o = opt(form.Value, 'roam_scan_snr', _('Roam-scan threshold'),
		_('Minimum positive (SNR) or negative signal level (-dBm) before usteer starts scanning for a roam candidate for a device on this SSID')
	);
	o.datatype = 'integer';
	o.placeholder = '0 (SNR) or -95 (dBm)';

	o = opt(form.Value, 'roam_process_timeout', _('Roam process timeout'), _('Timeout (ms) after which an association on this SSID following a disassociation is not seen as a roam'));
	o.datatype = 'uinteger';
	o.placeholder = '5000 (ms)';

	o = opt(form.Value, 'roam_scan_tries', _('Roam scan tries'), _('Maximum number of client roaming scan trigger attempts, for stations on this SSID'));
	o.datatype = 'uinteger';
	o.placeholder = 3;

	o = opt(form.Value, 'roam_scan_timeout', _('Roam scan timeout'),
		_('Retry scanning when roam_scan_tries is exceeded after this timeout (in ms), for stations on this SSID')
	);
	o.datatype = 'uinteger';
	o.placeholder = '0 (ms)';

	o = opt(form.Value, 'roam_scan_interval', _('Roam scan interval'), _('Minimum time (ms) between client roaming scan trigger attempts, for stations on this SSID'));
	o.datatype = 'uinteger';
	o.placeholder = '10000 (ms)';

	o = opt(form.Value, 'roam_trigger_snr', _('Roam-trigger threshold'),
		_('Minimum positive (SNR) or negative signal level (-dBm) before usteer forces a device on this SSID to roam to another node')
	);
	o.datatype = 'integer';
	o.placeholder = '0 (SNR) or -95 (dBm)';

	o = opt(form.Value, 'roam_trigger_interval', _('Roam trigger interval'), _('Minimum time (ms) between client roaming trigger attempts, for stations on this SSID'));
	o.datatype = 'uinteger';
	o.placeholder = '60000 (ms)';

	o = opt(form.Value, 'roam_kick_delay', _('Roam kick delay'), _('Timeout (ms) for client roam requests on this SSID - usteer will kick the client after this times out'));
	o.datatype = 'uinteger';
	o.placeholder = '10000 (ms)';

	o = opt(form.Value, 'band_steering_interval', _('Band steering interval'), _('Attempting to steer clients on this SSID to a higher frequency-band every n ms. A value of 0 disables band-steering.'));
	o.datatype = 'uinteger';
	o.placeholder = '30000 (ms)';

	o = opt(form.Value, 'band_steering_min_snr', _('Band-steering threshold'),
		_('Minimum positive (SNR) or negative signal level (-dBm) a device on this SSID has to maintain over band_steering_interval to be steered to, and stay on, a higher frequency band')
	);
	o.datatype = 'integer';
	o.placeholder = '0 (SNR) or -60 (dBm)';

	if (Initscript.includes('band_steering_signal_threshold')) {
		o = opt(form.Value, 'band_steering_signal_threshold', _('Band steering signal threshold'),
			_('For a station on this SSID: SNR difference that the signal must be better compared to signal was on connection to node.')+' '+
			_('Avoids conflicts between roaming and band-steering policies.')+' '+
			_('A value of 0 disables threshold')
		);
		o.datatype = 'uinteger';
		o.placeholder = 0;
	}

	o = opt(form.Value, 'initial_connect_delay', _('Initial connect delay'), _('Initial delay (ms) before responding to probe requests on this SSID, to allow other APs to see packets as well'));
	o.datatype = 'uinteger';
	o.placeholder = '0 (ms)';

	o = opt(form.Flag, 'load_kick_enabled', _('Load kick enabled'), _('This option enables kicking clients on this SSID on excessive channel load'));
	o.rmempty = true;

	o = opt(form.Value, 'load_kick_threshold', _('Load kick threshold'), _('Minimum channel load (%) on a node of this SSID before kicking clients'));
	o.datatype = 'uinteger';
	o.placeholder = 75;
	o.depends(sid + '_load_kick_enabled', '1');

	o = opt(form.Value, 'load_kick_delay', _('Load kick delay'), _('Minimum amount of time (ms) that channel load is above threshold before starting to kick clients on this SSID'));
	o.datatype = 'uinteger';
	o.placeholder = '10000 (ms)';
	o.depends(sid + '_load_kick_enabled', '1');

	o = opt(form.Value, 'load_kick_min_clients', _('Load kick min clients'), _('Minimum number of clients connected to this SSID before kicking based on channel load'));
	o.datatype = 'uinteger';
	o.placeholder = 10;
	o.depends(sid + '_load_kick_enabled', '1');

	o = opt(form.Value, 'load_kick_reason_code', _('Load kick reason code'),
		_('Reason code on client kick based on channel load, for this SSID.') + ' ' + _('Default:') + ' WLAN_REASON_DISASSOC_AP_BUSY'
	);
	o.datatype = 'uinteger';
	o.depends(sid + '_load_kick_enabled', '1');
	o.placeholder = 5;

	o = opt(form.Value, 'node_up_script', _('Node up script'), _('Script to run after bringing up a node of this SSID'));
	o.datatype = 'string';
}

return view.extend({
	callHostHints: rpc.declare({
		object: 'luci-rpc',
		method: 'getHostHints',
		expect: {'': {}}
	}),
	callGetRemotehosts: rpc.declare({
		object: 'usteer',
		method: 'remote_hosts',
		expect: {'': {}}
	}),
	callGetRemoteinfo: rpc.declare({
		object: 'usteer',
		method: 'remote_info',
		expect: {'': {}}
	}),
	callGetLocalinfo: rpc.declare({
		object: 'usteer',
		method: 'local_info',
		expect: {'': {}}
	}),
	callGetClients: rpc.declare({
		object: 'usteer',
		method: 'get_clients',
		expect: {'': {}}
	}),
	load() {
		return Promise.all([
			rpc.list('usteer'),
			this.callHostHints().catch (function (){return null;}),
			this.callGetRemotehosts().catch (function (){return null;}),
			this.callGetRemoteinfo().catch (function (){return null;}),
			this.callGetLocalinfo().catch (function (){return null;}),
			this.callGetClients().catch (function (){return null;}),
			network.getWifiNetworks().catch (function (){return null;}),
			fs.read('/etc/init.d/usteer').catch (function (){return null;}),
			uci.load('usteer').catch (function (){return null;})
		]);
	},

	poll_status(nodes, data) {
		
		Hosts = data[1];
		Remotehosts = data[2];
		Remoteinfo = data[3];
		Localinfo = data[4];
		Clients = data[5];

		getCipherAKM();	 

		const remotehosttableentries = [];
		collectRemoteHosts(remotehosttableentries,Remotehosts);
		cbi_update_table(nodes.querySelector('#remotehost_table'), remotehosttableentries, E('em', _('No data')));

		const connectioninfo_table_entries = [];
		collectWlanAPInfoEntries(connectioninfo_table_entries, Localinfo);
		collectWlanAPInfoEntries(connectioninfo_table_entries, Remoteinfo);
		cbi_update_table(nodes.querySelector('#connectioninfo_table'), connectioninfo_table_entries, E('em', _('No data')));

		const compactconnectioninfo_table_entries = [];
		collectWlanAPInfos(compactconnectioninfo_table_entries, Localinfo);
		collectWlanAPInfos(compactconnectioninfo_table_entries, Remoteinfo);
		cbi_update_table(nodes.querySelector('#compactconnectioninfo_table'), compactconnectioninfo_table_entries, E('em', _('No data')));

		const known_table_entries = [];
		collectKnownStaEntries(known_table_entries, Localinfo, true);
		collectKnownStaEntries(known_table_entries, Remoteinfo, false);
		cbi_update_table(nodes.querySelector('#known_table'), known_table_entries, E('em', _('No data')));


		const hearingContainer = nodes.querySelector('#hearingmap_body');
		for (let mac in Clients) {
			const macn = mac.toUpperCase().replace(/:/g,'');
			const existingTable = nodes.querySelector('#client_table'+macn);
			if (existingTable) {
				const client_table_entries = [];
				collectHearingClient(client_table_entries, mac);
				cbi_update_table(existingTable, client_table_entries, E('em', _('No data')));
			} else if (hearingContainer) {
				/* Newly seen MAC since the last full page render - build
				 * and append its block live instead of asking the user to
				 * refresh the page to see it. */
				hearingContainer.appendChild(buildHearingMacBlock(mac));
			}
		}
		return;
	},

	render(data) {
		let m, s, o;

		if (!('usteer' in data[0])) {
			m = new form.Map('usteer', _('Usteer'),
				_('Usteer is not running. Make sure it is installed and running.') +' '+
				_('An incorrect parameter can cause usteer to fail to start up.') +' '+
				_('To start it running try %s').format('<code>/etc/init.d/usteer start</code>')
			);
		}

		else {
			m = new form.Map('usteer', _('Usteer'));
		}

		Hosts = data[1];
		Remotehosts = data[2];
		Remoteinfo = data[3];
		Localinfo = data[4];
		Clients = data[5];
		WifiNetworks = data[6];
		Initscript = data[7];

		getCipherAKM();
		
		s = m.section(form.TypedSection, 'usteer');
		s.anonymous = true;
		s.tab('status', _('Status'));
		s.tab('hearingmap', _('Hearing map'));
		s.tab('knowndevices', _('Known stations'));
		s.tab('settings', _('Settings'));

		const allSsidNames = [];
		WifiNetworks.forEach(function (wifiNetwork) {
			if (wifiNetwork && typeof wifiNetwork === 'object') {
				const ssid = wifiNetwork.getSSID();
				if (ssid && allSsidNames.indexOf(ssid) === -1)
					allSsidNames.push(ssid);
			}
		});

		/* Every SSID gets a tab/section registered unconditionally, so its
		 * fields exist and stay bound to their own usteer_ssid UCI section
		 * regardless of the current "SSID list" filter below - only the
		 * nested sub-tab bar's visible set changes live as that field is
		 * edited (see rebuildSsidSubTabs()), no page reload required. */
		allSsidNames.forEach(function (ssid) {
			addSsidTab(s, ssid);
		});

		/* Reassigned below, once m.render() has produced real DOM to work
		 * with. Declared here so the ssid_list onchange handler (wired up
		 * before that point) closes over the same variable binding. */
		let rebuildSsidSubTabs = function () {};
		let toggleKnownStationsTab = function () {};

		if (('usteer' in data[0])) {
			o = s.taboption('status', Clientinfooverview);
			o.readonly = true;

			o = s.taboption('hearingmap', HearingMap);
			o.readonly = true;

			o = s.taboption('knowndevices', KnownStations);
			o.readonly = true;
		}

		o = s.taboption('settings', Settingstitle);
		o.readonly = true;

		o = s.taboption('settings', widgets.NetworkSelect, 'network', _('Network'), _('The network interface for inter-AP communication'));

		o = s.taboption('settings', form.Flag, 'syslog', _('Log messages to syslog'), _('Send usteer log messages to syslog instead of stderr'));
		o.default = '1';
		o.rmempty = false;

		o = s.taboption('settings', form.Flag, 'local_mode', _('Local mode'), _('Disable network communication'));
		o.rmempty = false;

		o = s.taboption('settings', form.Flag, 'ipv6', _('IPv6 mode'), _('Use IPv6 for remote exchange'));
		o.rmempty = false;


		o = s.taboption('settings', form.ListValue, 'debug_level', _('Debug level'));
		o.value('0', _('Fatal'));
		o.value('1', _('Info'));
		o.value('2', _('Verbose'));
		o.value('3', _('Some debug'));
		o.value('4', _('Network packet info'));
		o.value('5', _('All debug messages'));
		o.rmempty = false;
		o.editable = true;

		o = s.taboption('settings', form.Value, 'measurement_report_timeout', _('Measurement report timeout'), _('Maximum amount of time (ms) a measurement report is stored'));
		o.optional = true;
		o.placeholder = '120000 (ms)';
		o.datatype = 'uinteger';

		o = s.taboption('settings', form.Value, 'remote_update_interval', _('Remote update interval'), _('Interval (ms) between sending state updates to other APs'));
		o.optional = true;
		o.placeholder = '1000 (ms)';
		o.datatype = 'uinteger';

		o = s.taboption('settings', form.Value, 'remote_node_timeout', _('Remote node timeout'), _('Number of remote update intervals after which a remote-node is deleted'));
		o.optional = true;
		o.placeholder = 10;
		o.datatype = 'uinteger';

		o = s.taboption('settings', form.Value, 'link_measurement_interval', _('Link measurement interval'),
			_('Interval (ms) the device is sent a link-measurement request to help assess the bi-directional link quality.') + ' ' +
			_('Setting the interval to 0 disables link-measurements.')
		);
		o.optional = true;
		o.placeholder = '30000 (ms)';
		o.datatype = 'uinteger';

		o = s.taboption('settings', form.MultiValue, 'event_log_types', _('Event log types'), _('Message types to include in log.'));
		o.value('probe_req_accept');
		o.value('probe_req_deny');
		o.value('auth_req_accept');
		o.value('auth_req_deny');
		o.value('assoc_req_accept');
		o.value('assoc_req_deny');
		o.value('load_kick_trigger');
		o.value('load_kick_reset');
		o.value('load_kick_min_clients');
		o.value('load_kick_no_client');
		o.value('load_kick_client');
		o.value('signal_kick');
		o.optional = true;
		o.datatype = 'list(string)';

		if (Initscript.includes('known_stations')) {
			o = s.taboption('settings', form.Flag, 'known_stations', _('Known stations'),
				_('Remember the best signal ever locally observed for a station, as a roaming fallback for stations that never probe or report RRM measurements once associated.')
			);
			o.rmempty = true;
			o.onchange = function (ev, section_id, value) {
				toggleKnownStationsTab(value === '1');
			};
		}

		if (Initscript.includes('known_stations_timeout')) {
			o = s.taboption('settings', form.Value, 'known_stations_timeout', _('Known stations timeout'),
				_('Time (s) a station may go unseen on every node before its known-station entry is discarded.') + ' ' + _('0 means never discard')
			);
			o.optional = true;
			o.datatype = 'uinteger';
			o.placeholder = '0 (s)';
			o.depends('known_stations', '1');
		}

		o = s.taboption('settings', form.DynamicList, 'ssid_list', _('SSID list'), _('List of SSIDs to enable steering on, empty means all'));
		WifiNetworks.forEach(function (wifiNetwork) {
			if (wifiNetwork && typeof wifiNetwork === 'object') 
				if (wifiNetwork.getSSID() && (!o.keylist || o.keylist.indexOf(wifiNetwork.getSSID()) === -1)) {
					o.value(wifiNetwork.getSSID())
				}
		});	
		o.optional = true;
		o.datatype = 'list(string)';
		o.onchange = function (ev, section_id, value) {
			rebuildSsidSubTabs(value);
		};

		if (Initscript.includes('reassociation_delay')) {
			o = s.taboption('settings', form.Value, 'reassociation_delay', _('Reassociation delay'), 
				_('Timeout (s in "1024ms") a station is requested to avoid reassociation after bss transition')
			);
			o.optional = true;
			o.placeholder = '30 (s)';
			o.datatype = 'uinteger';
		}

		footerdata = this.super('addFooter', []);
		o = s.taboption('settings', Settingsfooter);
		o.readonly = true;

		/* Map.prototype.save() (form.js) re-renders the map's whole DOM
		 * content in place after every Save - the same renderContents()
		 * used for the initial render, reused via the persistent m.root
		 * node - which wipes out the SSID-tab relocation done below just
		 * as surely as a fresh page load would need it redone. Wrapping
		 * renderContents() itself (rather than only reacting to the one
		 * m.render() call below) means relocateSsidTabs() reruns on every
		 * path that (re)builds this content: initial render, Save, and
		 * Reset alike. */
		const origRenderContents = m.renderContents.bind(m);
		m.renderContents = function () {
			return origRenderContents().then(function (nodes) {
				relocateSsidTabs(nodes);
				return nodes;
			});
		};

		function relocateSsidTabs(nodes) {
			/* LuCI's CBI tab system has no native nested-tab support: every
			 * s.tab() registered on this TypedSection renders as a top-level
			 * entry in the same tab bar. To nest the per-SSID tabs inside
			 * Settings (after its last field) instead, relocate each SSID
			 * pane's DOM node out of the top-level tab group into a new
			 * wrapper appended at the end of the Settings pane, drop its
			 * now-orphaned top-level tab button, and drive tab-switching
			 * for that wrapper with a small self-contained click handler
			 * (see rebuildSsidSubTabs() below for why it doesn't reuse
			 * LuCI's own tab-group code). */
			const settingsPane = nodes.querySelector('div[data-tab="settings"]');
			const topMenu = nodes.querySelector('.cbi-tabmenu');

			const knownDevicesTabButton = topMenu ? topMenu.querySelector('li[data-tab="knowndevices"]') : null;
			if (knownDevicesTabButton) {
				toggleKnownStationsTab = function (enabled) {
					knownDevicesTabButton.style.display = enabled ? '' : 'none';
				};
				toggleKnownStationsTab(uci.get_first('usteer', 'usteer', 'known_stations') === '1');
			}

			if (settingsPane && topMenu && allSsidNames.length) {
				const ssidPaneMap = {};
				allSsidNames.forEach(function (ssid) {
					const tabName = 'ssid_' + ssidSectionId(ssid);
					const li = topMenu.querySelector('li[data-tab="' + tabName + '"]');
					const pane = nodes.querySelector('div[data-tab="' + tabName + '"]');
					if (li)
						li.remove();
					if (pane)
						ssidPaneMap[ssid] = pane;
				});

				const ssidWrap = E('div', { 'class': 'cbi-section-node-tabbed', 'style': 'margin-top:1em' });
				/* Settingsfooter (the Save/Reset action bar) is deliberately
				 * rendered as this pane's last taboption, further down in
				 * this same render() function, so it stays visible while
				 * switching between this app's own tabs. Insert before it
				 * rather than appendChild, so the SSID sub-tabs land after
				 * the last real settings field but still above Save/Reset. */
				settingsPane.insertBefore(ssidWrap, settingsPane.lastElementChild);

				/* Rebuilds the nested SSID tab bar from ssidPaneMap for the
				 * given "SSID list" value (empty/none = every SSID). Called
				 * once below for the value loaded from UCI, and again from
				 * the ssid_list field's onchange handler so removing or
				 * adding an SSID there takes effect immediately, without
				 * waiting for Save + page reload.
				 *
				 * This deliberately does NOT use LuCI's own
				 * ui.tabs.initTabGroup()/switchTab(): initTabGroup() calls
				 * this.updateTabs(group), but updateTabs()'s real signature
				 * is (ev, root) - passing group positionally means it lands
				 * in `ev`, `root` stays undefined, and updateTabs() falls
				 * back to scanning the ENTIRE document for [data-tab-title]
				 * panes instead of just this group. That global scan can
				 * mark unrelated top-level tabs (Status/Hearing map/Known
				 * devices) as empty and hide them - confirmed by them
				 * disappearing after this nested group's first rebuild. A
				 * small self-contained click handler avoids that entirely. */
				const oldMenu = ssidWrap.previousElementSibling;
				if (oldMenu && oldMenu.matches && oldMenu.matches('ul.cbi-ssid-tabmenu'))
					oldMenu.remove();

				rebuildSsidSubTabs = function (enabledList) {
					while (ssidWrap.firstChild)
						ssidWrap.removeChild(ssidWrap.firstChild);
					const prevMenu = ssidWrap.previousElementSibling;
					if (prevMenu && prevMenu.matches && prevMenu.matches('ul.cbi-ssid-tabmenu'))
						prevMenu.remove();

					const enabled = (Array.isArray(enabledList) && enabledList.length)
						? allSsidNames.filter(function (ssid) { return enabledList.indexOf(ssid) !== -1; })
						: allSsidNames;
					const panes = enabled.filter(function (ssid) { return !!ssidPaneMap[ssid]; });

					if (!panes.length)
						return;

					/* Pane visibility is driven by the data-tab-active
					 * ATTRIBUTE, not by display/visibility CSS - the theme's
					 * [data-tab-title] rule collapses every pane to
					 * height:0;opacity:0 and only [data-tab-active="true"]
					 * restores it (see cascade.css). style.display has no
					 * effect on that rule, so toggle the attribute instead,
					 * exactly like LuCI's own switchTab() does. */
					const menu = E('ul', { 'class': 'cbi-tabmenu cbi-ssid-tabmenu' });
					panes.forEach(function (ssid, i) {
						const pane = ssidPaneMap[ssid];
						pane.setAttribute('data-tab-active', (i === 0) ? 'true' : 'false');
						ssidWrap.appendChild(pane);
						menu.appendChild(E('li', {
							'class': (i === 0) ? 'cbi-tab' : 'cbi-tab-disabled'
						}, E('a', {
							'href': '#',
							'click': function (ev) {
								ev.preventDefault();
								Array.prototype.forEach.call(menu.children, function (li) {
									li.classList.remove('cbi-tab');
									li.classList.add('cbi-tab-disabled');
								});
								ev.currentTarget.parentNode.classList.remove('cbi-tab-disabled');
								ev.currentTarget.parentNode.classList.add('cbi-tab');
								panes.forEach(function (s2) {
									ssidPaneMap[s2].setAttribute('data-tab-active', (s2 === ssid) ? 'true' : 'false');
								});
							}
						}, ssid)));
					});
					ssidWrap.parentNode.insertBefore(menu, ssidWrap);
				};

				rebuildSsidSubTabs(uci.get_first('usteer', 'usteer', 'ssid_list'));
			}
		}

		return m.render().then(L.bind(function(m, nodes) {
			poll.add(L.bind(function() {
				return Promise.all([
				rpc.list('usteer'),
				this.callHostHints().catch (function (){return null;}),
				this.callGetRemotehosts().catch (function (){return null;}),
				this.callGetRemoteinfo().catch (function (){return null;}),
				this.callGetLocalinfo().catch (function (){return null;}),
				this.callGetClients().catch (function (){return null;})
				]).then(L.bind(this.poll_status, this, nodes));
			}, this), 5);
			return nodes;
		}, this, m));
	},
	handleReset(ev) {
		footerdata = this.super('addFooter', []);
		return this.super('handleReset',ev);
	},	
	handleSave(ev) {
		footerdata = this.super('addFooter', []);
		return this.super('handleSave',ev);
	},
	addFooter() { 
		return null;
	},
});
