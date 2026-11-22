'use strict';
'require baseclass';

// Pure logic of the telldus-mqtt LuCI pages: no DOM, no rpc, no uci calls.
//
// Gateway rule (the TellStick serial is status.gateway.serial):
// - The pages show and change only the device sections whose option
//   'gateway' is empty or the same as the serial. Sections for other
//   TellSticks are not changed; the pages only count them.
// - A new section gets 'gateway' = serial if the serial is known and at
//   least one device section has a 'gateway' option. Else it gets no
//   'gateway' (it is then used with all TellSticks).
// - As in the daemon, the first section (in file order) that matches a
//   device is used. Other sections for the same device are duplicates.

// RF parameters of a tellstick.conf device (telldus-core SettingsConfuse.cpp)
var RF_PARAMETERS = [ 'devices', 'house', 'unit', 'code', 'system', 'units', 'fade' ];

// Keys of a raw event that are not device options
var EVENT_NOT_OPTIONS = { 'class': true, 'method': true, 'group': true, 'time': true };

// Options that a device section has without user data
var BASE_OPTIONS = { 'type': true, 'id': true, 'gateway': true, 'name': true, 'topic': true };

var UNITS = {
	temperature: ' °C',
	humidity: ' %',
	windaverage: ' m/s',
	windgust: ' m/s',
	winddirection: '°',
	rainrate: ' mm/h',
	raintotal: ' mm'
};

function str(v) {
	if (v == null)
		return '';
	if (Array.isArray(v))
		return v.join(' ');
	return String(v);
}

// As derive_topic() in openwrt/telldus-mqtt-uci2json.uc
function deriveTopic(prefix, name) {
	name = str(name).replace(/[/+#]/g, '_');
	prefix = str(prefix);
	return (prefix != '') ? prefix + '/' + name : name;
}

// As the generator: topic_prefix if it is set (also if empty), else 'home'
function topicPrefix(main) {
	return (main && typeof main.topic_prefix == 'string') ? main.topic_prefix : 'home';
}

function appliesTo(section, serial) {
	var gw = str(section.gateway);
	return gw == '' || (str(serial) != '' && gw == str(serial));
}

function newSectionGateway(sections, serial) {
	if (str(serial) == '')
		return null;
	for (var i = 0; i < (sections || []).length; i++)
		if (str(sections[i].gateway) != '')
			return str(serial);
	return null;
}

function rfOptions(section) {
	var rf = {};
	if (!section)
		return rf;
	if (str(section.protocol) != '')
		rf.protocol = str(section.protocol);
	if (str(section.model) != '')
		rf.model = str(section.model);
	for (var i = 0; i < RF_PARAMETERS.length; i++)
		if (str(section[RF_PARAMETERS[i]]) != '')
			rf[RF_PARAMETERS[i]] = str(section[RF_PARAMETERS[i]]);
	return rf;
}

function makeRow(type, id, section, device, prefix) {
	var name = section ? str(section.name) : '';
	var topic = section ? str(section.topic) : '';
	var derived = (name != '') ? deriveTopic(prefix, name) : '';
	return {
		key: type + ' ' + id,
		type: type,
		id: id,
		sid: section ? section['.name'] : null,
		gateway: section ? str(section.gateway) : '',
		name: name,
		topic: topic,
		derivedTopic: derived,
		effectiveTopic: (name != '') ? (topic != '' ? topic : derived) : '',
		heard: !!device,
		lastSeen: (device && typeof device.last_seen == 'number') ? device.last_seen : null,
		online: device ? (device.online !== false) : false,
		values: (device && device.values && typeof device.values == 'object') ? device.values : {},
		daemonTopic: device ? str(device.topic) : '',
		rf: rfOptions(section),
		duplicate: false
	};
}

// Merge the devices of the status file with the UCI device sections.
// type: 'sensor' or 'switch'. sections: uci.sections('telldus-mqtt', 'device').
// Returns { rows: [...], otherGateways: <sections of this type for other
// TellSticks> }. Rows: first the devices of the status file (in file
// order), then the sections not matched by a device.
function mergeDevices(type, devices, sections, serial, prefix) {
	var rows = [];
	var used = {};
	var matched = {};
	var otherGateways = 0;
	var mine = [];

	sections = sections || [];
	for (var i = 0; i < sections.length; i++) {
		var s = sections[i];
		if (str(s.type) != type)
			continue;
		if (appliesTo(s, serial))
			mine.push(s);
		else
			otherGateways++;
	}

	devices = Array.isArray(devices) ? devices : [];
	for (let i = 0; i < devices.length; i++) {
		var d = devices[i];
		if (!d || d.type != type || str(d.id) == '' || matched[str(d.id)])
			continue;
		var match = null;
		for (var j = 0; j < mine.length; j++)
			if (str(mine[j].id) == str(d.id)) {
				match = mine[j];
				break;
			}
		if (match)
			used[match['.name']] = true;
		matched[str(d.id)] = true;
		rows.push(makeRow(type, str(d.id), match, d, prefix));
	}

	var first = {};
	for (let j = 0; j < mine.length; j++) {
		var id = str(mine[j].id);
		if (used[mine[j]['.name']]) {
			first[id] = true;
			continue;
		}
		var row = makeRow(type, id, mine[j], null, prefix);
		row.key = type + ' ' + id + ' ' + mine[j]['.name'];
		row.duplicate = !!first[id] || !!matched[id];
		first[id] = true;
		rows.push(row);
	}

	return { rows: rows, otherGateways: otherGateways };
}

// Topics used by more than one named row: { topic: true }
function duplicateTopics(rows) {
	var count = {}, dup = {};
	for (var i = 0; i < rows.length; i++) {
		var t = rows[i].effectiveTopic;
		if (t == '' || rows[i].duplicate)
			continue;
		count[t] = (count[t] || 0) + 1;
		if (count[t] > 1)
			dup[t] = true;
	}
	return dup;
}

// Seconds -> short text, e.g. "45 s", "12 min", "3 h 5 min", "2 d 4 h"
function formatAge(seconds) {
	if (typeof seconds != 'number' || isNaN(seconds))
		return '-';
	var s = Math.max(0, Math.floor(seconds));
	if (s < 60)
		return s + ' ' + _('s');
	var m = Math.floor(s / 60);
	if (m < 60)
		return m + ' ' + _('min');
	var h = Math.floor(m / 60);
	if (h < 24)
		return h + ' ' + _('h') + ((m % 60) ? ' ' + (m % 60) + ' ' + _('min') : '');
	var d = Math.floor(h / 24);
	return d + ' ' + _('d') + ((h % 24) ? ' ' + (h % 24) + ' ' + _('h') : '');
}

// Age of a time stamp of the status file. 'now' must be the router time
// (from the same rpc call that read the file), not the browser time.
function age(now, time) {
	if (typeof now != 'number' || typeof time != 'number' || time <= 0)
		return null;
	return Math.max(0, now - time);
}

// Sensor values -> "15.8 °C, 44 %"
function formatValues(values) {
	var parts = [];
	var keys = Object.keys(values || {});
	for (var i = 0; i < keys.length; i++) {
		var k = keys[i], v = str(values[k]);
		if (k == 'temperature' || k == 'humidity')
			parts.push(v + UNITS[k]);
		else if (UNITS[k])
			parts.push(k + ' ' + v + UNITS[k]);
		else
			parts.push(k + ' ' + v);
	}
	return parts.join(', ');
}

// ---- Changes to UCI, as a list of operations ----
// { op: 'add', values: { ... } }        add a 'device' section
// { op: 'set', sid, option, value }
// { op: 'unset', sid, option }
// { op: 'remove', sid }

function hasUserOptions(section) {
	for (var k in section)
		if (k.charAt(0) != '.' && !BASE_OPTIONS[k])
			return true;
	return false;
}

// The user changed the name of a row. section: the UCI section of the row
// (or null). Returns the operations.
// - A name creates the section if there is none.
// - An empty name removes name and topic. Then the section is removed,
//   if it has no other options (a switch with RF options stays: it is
//   still a device in tellstick.conf, but it is not published).
function planName(row, name, section, sections, serial) {
	name = str(name).trim();
	if (!row.sid || !section) {
		if (name == '')
			return [];
		var values = { type: row.type, id: row.id, name: name };
		var gw = newSectionGateway(sections, serial);
		if (gw)
			values.gateway = gw;
		return [ { op: 'add', values: values } ];
	}
	if (name != '')
		return (name == str(section.name)) ? [] : [ { op: 'set', sid: row.sid, option: 'name', value: name } ];
	if (!hasUserOptions(section))
		return [ { op: 'remove', sid: row.sid } ];
	var ops = [];
	if (section.name != null)
		ops.push({ op: 'unset', sid: row.sid, option: 'name' });
	if (section.topic != null)
		ops.push({ op: 'unset', sid: row.sid, option: 'topic' });
	return ops;
}

// A topic must not have MQTT wildcards. Empty = derived from the name.
function validTopic(topic) {
	topic = str(topic);
	return topic == '' || !/[+#\0]/.test(topic);
}

// The user changed the topic of a named row. Empty = derived from the name.
function planTopic(row, topic) {
	topic = str(topic).trim();
	if (!row.sid || !validTopic(topic) || topic == row.topic)
		return [];
	if (topic == '')
		return [ { op: 'unset', sid: row.sid, option: 'topic' } ];
	return [ { op: 'set', sid: row.sid, option: 'topic', value: topic } ];
}

// Rows that can get the name of oldRow: heard sensors without a name,
// newest first.
function replaceCandidates(oldRow, rows) {
	var list = [];
	for (var i = 0; i < rows.length; i++) {
		var r = rows[i];
		if (r.type == oldRow.type && r.heard && r.name == '' && r.id != oldRow.id)
			list.push(r);
	}
	list.sort(function(a, b) { return (b.lastSeen || 0) - (a.lastSeen || 0); });
	return list;
}

// Replace: the section of oldRow gets the id of newRow. Name, topic and
// gateway stay. A section of newRow without a name is removed.
function planReplace(oldRow, newRow) {
	if (!oldRow.sid || oldRow.id == newRow.id)
		return [];
	var ops = [];
	if (newRow.sid && newRow.sid != oldRow.sid)
		ops.push({ op: 'remove', sid: newRow.sid });
	ops.push({ op: 'set', sid: oldRow.sid, option: 'id', value: newRow.id });
	return ops;
}

// Next free switch id: 1 + the largest number used by any switch section
// (all TellSticks: tellstick.conf has one id space) or any switch in the
// status file.
function nextSwitchId(sections, devices) {
	var max = 0;
	function take(type, id) {
		if (type == 'switch' && /^[0-9]{1,9}$/.test(str(id)))
			max = Math.max(max, parseInt(str(id), 10));
	}
	for (var i = 0; i < (sections || []).length; i++)
		take(str(sections[i].type), sections[i].id);
	for (let i = 0; i < (Array.isArray(devices) ? devices : []).length; i++)
		if (devices[i])
			take(devices[i].type, devices[i].id);
	return String(max + 1);
}

// The id for the On and Off buttons (tdtool --on <id>), or null. Only a
// switch of the status file: telldusd has it.
function switchId(row) {
	if (!row || row.type != 'switch' || !row.heard || row.duplicate || !/^[0-9]{1,9}$/.test(str(row.id)))
		return null;
	var id = parseInt(str(row.id), 10);
	return (id >= 1) ? id : null;
}

// ---- Raw RF events (button capture) ----

// A key for an event, with its time: a repeat of a button has a new time
function eventKey(ev) {
	var keys = Object.keys(ev || {}).sort();
	var parts = [];
	for (var i = 0; i < keys.length; i++)
		parts.push(keys[i] + '=' + str(ev[keys[i]]));
	return parts.join(';');
}

// Start of a capture: the keys of the events in the status file now
function captureStart(events) {
	var seen = {};
	for (var i = 0; i < (Array.isArray(events) ? events : []).length; i++)
		seen[eventKey(events[i])] = true;
	return seen;
}

// Events that came after the capture start, newest first (as in the file).
// No clock is used: an event is new if the start did not have it.
function capturedEvents(events, start) {
	var list = [];
	for (var i = 0; i < (Array.isArray(events) ? events : []).length; i++)
		if (!start[eventKey(events[i])])
			list.push(events[i]);
	return list;
}

// Map a raw command event to the options of a switch section.
// The raw events come from telldus-core service/Protocol*.cpp decodeData():
//   arctech selflearning: house 1..67108863, unit 1..16, group, method
//   arctech codeswitch:   house A..P, unit 1..16 (no unit for method bell)
//   waveman codeswitch:   house A..P, unit 1..16
//   sartano codeswitch:   code (10 digits 0/1)
//   everflourish selflearning: house 0..16383, unit 1..4
//   x10 codeswitch:       house A..P, unit 1..16
// tellstick.conf models: arctech 'selflearning-switch', 'codeswitch',
// 'bell'; waveman, sartano, x10 'codeswitch'; everflourish 'selflearning'.
// telldus-core decodes no other switch protocols (risingsun, comen, ...
// cannot be received). For others (for example hasta), protocol, model and
// the other keys are copied, and 'known' is false.
// Returns { options: { protocol, model, ... }, known: bool }.
function eventToSwitch(ev) {
	ev = ev || {};
	var p = str(ev.protocol), m = str(ev.model);
	var o = { protocol: p };

	if (p == 'arctech' && m == 'selflearning' && ev.house != null && ev.unit != null) {
		o.model = 'selflearning-switch';
		o.house = str(ev.house);
		o.unit = str(ev.unit);
		return { options: o, known: true };
	}
	if (p == 'arctech' && m == 'codeswitch' && ev.house != null) {
		if (str(ev.method) == 'bell' || ev.unit == null) {
			o.model = 'bell';
			o.house = str(ev.house);
		}
		else {
			o.model = 'codeswitch';
			o.house = str(ev.house);
			o.unit = str(ev.unit);
		}
		return { options: o, known: true };
	}
	if ((p == 'waveman' || p == 'x10') && m == 'codeswitch' && ev.house != null && ev.unit != null) {
		o.model = 'codeswitch';
		o.house = str(ev.house);
		o.unit = str(ev.unit);
		return { options: o, known: true };
	}
	if (p == 'sartano' && ev.code != null) {
		o.model = 'codeswitch';
		o.code = str(ev.code);
		return { options: o, known: true };
	}
	if (p == 'everflourish' && ev.house != null && ev.unit != null) {
		o.model = 'selflearning';
		o.house = str(ev.house);
		o.unit = str(ev.unit);
		return { options: o, known: true };
	}

	// Unknown: copy what can be a UCI option
	var keys = Object.keys(ev);
	for (var i = 0; i < keys.length; i++) {
		var k = keys[i];
		if (EVENT_NOT_OPTIONS[k] || k == 'protocol' || !/^[a-z0-9_]+$/.test(k))
			continue;
		o[k] = str(ev[k]);
	}
	return { options: o, known: false };
}

// The model without a vendor part: 'selflearning-switch:nexa' -> 'selflearning-switch'
function baseModel(model) {
	return str(model).split(':')[0];
}

// A switch section that sends the same code as the options, or null
function findSwitch(sections, options) {
	for (var i = 0; i < (sections || []).length; i++) {
		var s = sections[i];
		if (str(s.type) != 'switch' || str(s.protocol) != str(options.protocol) ||
		    baseModel(s.model) != baseModel(options.model))
			continue;
		var same = true;
		for (var j = 0; j < RF_PARAMETERS.length; j++) {
			var k = RF_PARAMETERS[j];
			if (str(s[k]) != str(options[k]))
				same = false;
		}
		if (same)
			return s;
	}
	return null;
}

// Options of a new switch section from a captured event
function planCreateSwitch(ev, name, sections, devices, serial) {
	var mapped = eventToSwitch(ev);
	var values = { type: 'switch', id: nextSwitchId(sections, devices), name: str(name).trim() };
	var keys = Object.keys(mapped.options);
	for (var i = 0; i < keys.length; i++)
		values[keys[i]] = mapped.options[keys[i]];
	var gw = newSectionGateway(sections, serial);
	if (gw)
		values.gateway = gw;
	return [ { op: 'add', values: values } ];
}

// Short text for an event: "arctech selflearning, house 123, unit 1, turnon"
function formatEvent(ev) {
	var parts = [ (str(ev.protocol) + ' ' + str(ev.model)).trim() ];
	var keys = Object.keys(ev || {});
	for (var i = 0; i < keys.length; i++) {
		var k = keys[i];
		if (k == 'time' || k == 'class' || k == 'protocol' || k == 'model' || k == 'method')
			continue;
		parts.push(k + ' ' + str(ev[k]));
	}
	if (str(ev.method) != '')
		parts.push(str(ev.method));
	return parts.join(', ');
}

// RF options -> "arctech selflearning-switch, house 123, unit 1"
function formatRf(rf) {
	var parts = [];
	if (rf.protocol)
		parts.push((rf.protocol + ' ' + (rf.model || '')).trim());
	for (var i = 0; i < RF_PARAMETERS.length; i++)
		if (rf[RF_PARAMETERS[i]] != null)
			parts.push(RF_PARAMETERS[i] + ' ' + rf[RF_PARAMETERS[i]]);
	return parts.join(', ');
}

return baseclass.extend({
	RF_PARAMETERS: RF_PARAMETERS,
	deriveTopic: deriveTopic,
	topicPrefix: topicPrefix,
	appliesTo: appliesTo,
	newSectionGateway: newSectionGateway,
	mergeDevices: mergeDevices,
	duplicateTopics: duplicateTopics,
	formatAge: formatAge,
	age: age,
	formatValues: formatValues,
	planName: planName,
	validTopic: validTopic,
	planTopic: planTopic,
	replaceCandidates: replaceCandidates,
	planReplace: planReplace,
	nextSwitchId: nextSwitchId,
	switchId: switchId,
	eventKey: eventKey,
	captureStart: captureStart,
	capturedEvents: capturedEvents,
	eventToSwitch: eventToSwitch,
	findSwitch: findSwitch,
	planCreateSwitch: planCreateSwitch,
	formatEvent: formatEvent,
	formatRf: formatRf
});
