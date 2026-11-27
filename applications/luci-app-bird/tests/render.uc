import { readfile } from 'fs';

const source = readfile(ARGV[0]);
const api = loadstring(substr(source, 0, index(source, "\nreturn {\n\t'luci.ospf':")) +
	'\nreturn { birdIsRunning, cleanSettings, renderConfig, readSettings };')();
const scenario = ARGV[1];
if (scenario == 'installed') {
	const saved = api.readSettings(readfile('/etc/bird.conf'));
	if (saved.mode != 'managed') die('Expected a managed configuration');
	const candidate = api.cleanSettings(saved.state, saved.state);
	if (candidate.error) die(candidate.error);
	print(api.renderConfig(candidate.state));
	exit(0);
}

function detail(name, family, target, values) {
	return { name, family, target, values };
}

function rule(family, direction, action, prefix, metric_type, metric, tag) {
	return detail('Route filter rule', family, '', [direction, action, prefix, metric_type ?? 'none', metric ?? '', tag ?? '']);
}

const links = [
	{device:'eth0',area:'0',mode:'broadcast',family:'ipv4',cost:10,priority:1,hello:10},
	{device:'eth1',area:'1',mode:'passive',family:'ipv4',cost:10,priority:1,hello:10},
	{device:'eth2',area:'2',mode:'nbma',family:'ipv4',cost:10,priority:1,hello:10}
];
const payload = {
	enabled: true, router_id: '192.0.2.1', policy: 'none', links,
	advanced: {ipv6:false, details:[rule(4,'install','accept','192.0.2.0/24')]}
};
if (scenario != 'basic') {
	for (let link in links) link.family = 'dual';
	links[0].bfd = true;
	links[0].bfd_multiplier = 5;
	links[0].bfd_mode = 'keyed sha1';
	payload.advanced = {
		ipv6:true, install6:false, ecmp:4, graceful:'on', grace_time:120,
		merge_external:true, areas:[
			{area:'1',type:'normal',networks:[
				{family:4,prefix:'10.10.0.0/16',hidden:false},
				{family:4,prefix:'192.0.2.0/24',hidden:true},
				{family:6,prefix:'2001:db8:20::/48',hidden:false}
			]},
			{area:'2',type:'nssa',networks:[],default_nssa:true,
				default_metric:'e2',default_cost:300,translator:true,translator_stability:45}
		],
		details:[
			detail('TTL security mode',4,'eth0',['tx only']),
			detail('Interface dead interval',4,'eth0',['multiplier',4]),
			detail('Interface dead interval',6,'eth0',['seconds',45]),
			detail('BFD minimum receive interval',4,'eth0',[300]),
			detail('BFD minimum transmit interval',4,'eth0',[400]),
			detail('BFD authentication key',4,'eth0',[1,'test-bfd-secret']),
			detail('OSPF authentication key',4,'eth0',[1,'hmac sha384','test-key-four','','','','']),
			detail('OSPF authentication key',6,'eth0',[1,'hmac sha256','test-key-six','','','','']),
			detail('OSPF receive buffer',4,'eth0',['bytes',4096]),
			detail('NBMA neighbor election eligibility',4,'eth2',['192.0.2.42',false]),
			detail('NBMA neighbor election eligibility',6,'eth2',['fe80::42',true]),
			detail('NSSA external summary',4,'2',['192.0.2.0/24',false,10]),
			rule(4,'install','accept','192.0.2.0/24'),
			rule(6,'redistribute','accept','2001:db8:30::/48','e2',20,5)
		]
	};
}
if (scenario == 'virtual') {
	push(payload.advanced.details,
		detail('OSPF virtual link',4,'1',['192.0.2.2','',10,40,5,40]),
		detail('OSPF virtual-link authentication key',4,'1',['192.0.2.2','',1,'hmac sha256','test-vlink','','','','']));
}
if (scenario == 'af') {
	push(payload.advanced.details, detail('OSPFv3 IPv4 address family',4,'',[true]));
	for (let row in payload.advanced.details)
		if (row.name == 'NBMA neighbor election eligibility' && row.family == 4) row.values[0] = 'fe80::42';
}
const result = api.cleanSettings(payload, {links:[]});
if (result.error) die(result.error);
const rendered = api.renderConfig(result.state);
if (index(rendered, '# luci-app-bird: v2 ') != 0 || api.readSettings(rendered).mode != 'managed')
	die('New configuration marker is not recognized');
if (api.readSettings(replace(rendered, '# luci-app-bird: v2 ', '# luci-app-bird: ')).mode != 'external')
	die('Old configuration format was accepted');
if (scenario != 'basic') {
	for (let needle in ['ttl security tx only;', 'dead count 4;', 'dead 45;', 'min rx interval 300 ms;',
	                     'min tx interval 400 ms;', 'authentication keyed sha1;', 'algorithm hmac sha384;',
	                     'algorithm hmac sha256;', 'rx buffer 4096;', 'default cost2 300;',
	                     '192.0.2.0/24 hidden;', 'ospf_metric2 = 20;'])
		if (index(rendered, needle) < 0) die('Missing directive: ' + needle);
	const ipv6_ospf = index(rendered, 'protocol ospf v3 ');
	const ipv4_rendered = ipv6_ospf >= 0 ? substr(rendered, 0, ipv6_ospf) : rendered;
	if (match(ipv4_rendered, /interface "eth0" \{[^}]*\n      dead [0-9]/))
		die('Fixed dead interval still overrides the multiplier');
	push(payload.advanced.details, rule(6,'redistribute','reject','2001:0db8:30::/48'));
	const duplicate_rule = api.cleanSettings(payload, {links:[]});
	if (duplicate_rule.error != 'A rule already exists for this address family, direction and prefix. Edit the existing rule.')
		die('Equivalent exact-prefix rules did not produce a duplicate error');
	pop(payload.advanced.details);
	for (let key in payload.advanced.details)
		if (key.name == 'OSPF authentication key') key.values[2] = '';
	const saved = api.cleanSettings(payload, result.state);
	if (saved.error ||
	    length(filter(saved.state.advanced.details, row => row.name == 'OSPF authentication key' && length(row.values[2]))) != 2)
		die('Existing keys in v2 configuration were not retained');
}

if (scenario == 'full') {
	const running_text = 'BIRD 2 ready.\nDaemon is up and running\n';
	if (!api.birdIsRunning({ ok: true, text: running_text }) ||
	    api.birdIsRunning({ ok: false, text: running_text }) ||
	    api.birdIsRunning({ ok: true, text: 'BIRD 2 ready.' }))
		die('BIRD daemon status did not match the service reply');
	push(payload.links, { device: 'eth3', area: '2', mode: 'ptp', family: 'ipv6',
		cost: 10, priority: 1, hello: 10, bfd: true });
	push(payload.advanced.details,
		detail('BFD minimum transmit interval', 4, 'eth3', [600]),
		detail('OSPF receive buffer', 6, 'eth3', ['bytes', 6144]),
		detail('NSSA external summary', 6, '2', ['2001:db8:42::/48', false, '']));
	payload.advanced.ipv6 = false;
	const inactive = api.cleanSettings(payload, result.state);
	if (inactive.error)
		die('Disabling OSPFv3 discarded pending IPv6 settings: ' + inactive.error);
	const inactive_config = api.renderConfig(inactive.state);
	if (index(inactive_config, 'protocol ospf v3 lan_ospf6') >= 0 ||
	    index(inactive_config, 'interface "eth3"') >= 0)
		die('Inactive IPv6 OSPF or its BFD interface was rendered');
	const retained = api.readSettings(inactive_config).state;
	retained.advanced.ipv6 = true;
	const restored = api.cleanSettings(retained, inactive.state);
	if (restored.error) die('Re-enabling OSPFv3 failed: ' + restored.error);
	const active_config = api.renderConfig(restored.state);
	for (let needle in ['protocol ospf v3 lan_ospf6', 'interface "eth3"', 'rx buffer 6144;',
	                     'min tx interval 600 ms;', '2001:db8:42::/48'])
		if (index(active_config, needle) < 0) die('Missing restored IPv6 setting: ' + needle);
}
print(rendered);
