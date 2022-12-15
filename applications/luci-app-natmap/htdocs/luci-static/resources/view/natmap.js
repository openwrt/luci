'use strict';
'require form';
'require fs';
'require rpc';
'require view';
'require tools.widgets as widgets';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

function getInstances() {
	return L.resolveDefault(callServiceList('natmap'), {}).then(function(res) {
		try {
			return res.natmap.instances || {};
		} catch (e) {}
		return {};
	});
}

function getStatus() {
	return getInstances().then(function(instances) {
		var promises = [];
		var status = {};
		for (var key in instances) {
			var i = instances[key];
			if (i.running && i.pid) {
				var f = '/var/run/natmap/' + i.pid + '.json';
				(function(k) {
					promises.push(fs.read(f).then(function(res) {
						status[k] = JSON.parse(res);
					}).catch(function(e){}));
				})(key);
			}
		}
		return Promise.all(promises).then(function() { return status; });
	});
}

return view.extend({
	load: function() {
		return getStatus();
	},
	render: function(status) {
		var m, s, o;

		m = new form.Map('natmap', _('NATMap'));
		s = m.section(form.GridSection, 'natmap');
		s.addremove = true;
		s.anonymous = true;

		o = s.option(form.Flag, 'enable', _('Enable'));
		o.editable = true;
		o.modalonly = false;

		o = s.option(form.ListValue, 'udp_mode', _('Protocol'));
		o.default = '1';
		o.value('0', 'TCP');
		o.value('1', 'UDP');
		o.textvalue = function(section_id) {
			var cval = this.cfgvalue(section_id);
			var i = this.keylist.indexOf(cval);
			return this.vallist[i];
		};

		o = s.option(form.ListValue, 'family', _('Restrict to address family'));
		o.modalonly = true;
		o.value('', _('IPv4 and IPv6'));
		o.value('ipv4', _('IPv4 only'));
		o.value('ipv6', _('IPv6 only'));

		o = s.option(widgets.NetworkSelect, 'interface', _('Interface'));
		o.modalonly = true;

		o = s.option(form.Value, 'interval', _('Keep-alive interval'));
		o.datatype = 'uinteger';
		o.modalonly = true;

		o = s.option(form.Value, 'stun_server', _('STUN server'), _('For UDP mode'));
		o.datatype = 'host';
		o.modalonly = true;
		o.optional = false;
		o.rmempty = false;

		o = s.option(form.Value, 'http_server', _('HTTP server'), _('For TCP mode'));
		o.datatype = 'host';
		o.modalonly = true;
		o.optional = false;
		o.rmempty = false;

		o = s.option(form.Value, 'port', _('Port'));
		o.datatype = 'port';
		o.optional = false;
		o.rmempty = false;

		o = s.option(form.Flag, '_forward_mode', _('Forward mode'));
		o.modalonly = true;
		o.ucioption = 'forward_target';
		o.load = function(section_id) {
			return this.super('load', section_id) ? '1' : '0';
		};
		o.write = function(section_id, formvalue) {};

		o = s.option(form.Value, 'forward_target', _('Forward target'));
		o.datatype = 'host';
		o.modalonly = true;
		o.depends('_forward_mode', '1');

		o = s.option(form.Value, 'notify_script', _('Notify script'));
		o.datatype = 'file';
		o.modalonly = true;

		o = s.option(form.DummyValue, '_external_ip', _('External IP'));
		o.modalonly = false;
		o.textvalue = function(section_id) {
			var s = status[section_id];
			if (s) return s.ip;
		};

		o = s.option(form.DummyValue, '_external_port', _('External Port'));
		o.modalonly = false;
		o.textvalue = function(section_id) {
			var s = status[section_id];
			if (s) return s.port;
		};

		return m.render();
	}
});
