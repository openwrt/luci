'use strict';
'require view';
'require poll';
'require form';
'require uci';
'require fs';
'require network';
'require rpc';
'require shadowsocks-libev as ss';

var conf = 'shadowsocks-libev';
var cfgtypes = ['ss_local', 'ss_redir', 'ss_server', 'ss_tunnel'];

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} }
});

return view.extend({
	render: function(stats) {
		var m, s, o;

		m = new form.Map(conf,
			_('Local Instances'),
			_('Instances of shadowsocks-libev components, e.g. ss-local, \
			   ss-redir, ss-tunnel, ss-server, etc.  To enable an instance it \
			   is required to enable both the instance itself and the remote \
			   server it refers to.'));

		s = m.section(form.GridSection);
		s.addremove = true;
		s.cfgsections = function() {
			return this.map.data.sections(this.map.config)
				.filter(function(s) { return cfgtypes.indexOf(s['.type']) !== -1; })
				.map(function(s) { return s['.name']; });
		};
		s.sectiontitle = function(section_id) {
			var s = uci.get(conf, section_id);
			return (s ? s['.type'] + '.' : '') + section_id;
		};
		s.renderSectionAdd = function(extra_class) {
			var el = form.GridSection.prototype.renderSectionAdd.apply(this, arguments),
				optionEl = [E('option', { value: '_dummy' }, [_('-- instance type --')])];
			cfgtypes.forEach(function(t) {
				optionEl.push(E('option', { value: t }, [t.replace('_', '-')]));
			});
			var selectEl = E('select', {
				class: 'cbi-input-select',
				change: function(ev) {
					ev.target.parentElement.nextElementSibling.nextElementSibling
						.toggleAttribute('disabled', ev.target.value === '_dummy');
				}
			}, optionEl);
			el.lastElementChild.setAttribute('disabled', '');
			el.prepend(E('div', {}, selectEl));
			return el;
		};
		s.handleAdd = function(ev, name) {
			var selectEl = ev.target.parentElement.firstElementChild.firstElementChild,
				type = selectEl.value;
			this.sectiontype = type;
			var promise = form.GridSection.prototype.handleAdd.apply(this, arguments);
			this.sectiontype = undefined;
			return promise;
		};
		s.addModalOptions = function(s, section_id, ev) {
			var sdata = uci.get(conf, section_id),
				stype = sdata ? sdata['.type'] : null;
			if (stype) {
				s.sectiontype = stype;
				return Promise.all([
					L.resolveDefault(fs.stat('/usr/bin/' + stype.replace('_', '-')), null),
					network.getDevices()
				]).then(L.bind(function(res) {
					s.tab('general', _('General Settings'));
					s.tab('advanced', _('Advanced Settings'));
					s.taboption('general', form.Flag, 'disabled', _('Disable'));
					if (!res[0]) {
						ss.option_install_package(s, 'general');
					}
					ss.options_common(s, 'advanced');

					if (stype === 'ss_server') {
						ss.options_server(s, { tab: 'general' });
						o = s.taboption('advanced', form.Value, 'local_address',
							_('Local address'),
							_('The address ss-server will initiate connections from'));
						o.datatype = 'ipaddr';
						ss.values_ipaddr(o, res[1]);
						o = s.taboption('advanced', form.Value, 'local_ipv4_address',
							_('Local IPv4 address'),
							_('The IPv4 address ss-server will initiate IPv4 connections from'));
						o.datatype = 'ip4addr';
						ss.values_ip4addr(o, res[1]);
						o = s.taboption('advanced', form.Value, 'local_ipv6_address',
							_('Local IPv6 address'),
							_('The IPv6 address ss-server will initiate IPv6 connections from'));
						o.datatype = 'ip6addr';
						ss.values_ip6addr(o, res[1]);
					} else {
						ss.options_client(s, 'general', res[1]);
						if (stype === 'ss_tunnel') {
							o = s.taboption('general', form.Value, 'tunnel_address',
								_('Tunnel address'),
								_('The address ss-tunnel will forward traffic to'));
							o.datatype = 'hostport';
						}
					}
					if (stype === 'ss_local' || stype === 'ss_server') {
						o = s.taboption('advanced', form.FileUpload, 'acl',
							_('ACL file'),
							_('File containing Access Control List'));
						o.root_directory = '/etc/shadowsocks-libev';
					}
				}, this));
			}
		};

		o = s.option(form.DummyValue, 'overview', _('Overview'));
		o.modalonly = false;
		o.editable = true;
		o.rawhtml = true;
		o.renderWidget = function(section_id, option_index, cfgvalue) {
			var sdata = uci.get(conf, section_id);
			if (sdata) {
				return form.DummyValue.prototype.renderWidget.call(this, section_id, option_index, ss.cfgvalue_overview(sdata));
			}
			return null;
		};

		o = s.option(form.DummyValue, 'running', _('Running'));
		o.modalonly = false;
		o.editable = true;
		o.default = '';

		o = s.option(form.Button, 'disabled', _('Enable/Disable'));
		o.modalonly = false;
		o.editable = true;
		o.inputtitle = function(section_id) {
			var s = uci.get(conf, section_id);
			if (ss.ucival_to_bool(s['disabled'])) {
				this.inputstyle = 'reset';
				return _('Disabled');
			}
			this.inputstyle = 'save';
			return _('Enabled');
		}
		o.onclick = function(ev) {
			var inputEl = ev.target.parentElement.nextElementSibling;
			inputEl.value = ss.ucival_to_bool(inputEl.value) ? '0' : '1';
			return this.map.save();
		}

		return m.render().finally(function() {
			poll.add(function() {
				return L.resolveDefault(callServiceList(conf), {})
				.then(function(res) {
					var instances = null;
					try {
						instances = res[conf]['instances'];
					} catch (e) {}
					if (!instances) return;
					uci.sections(conf)
					.filter(function(s) { return cfgtypes.indexOf(s['.type']) !== -1; })
					.forEach(function(s) {
						var el = document.getElementById('cbi-shadowsocks-libev-' + s['.name'] + '-running');
						if (el) {
							var name = s['.type'] + '.' + s['.name'],
								running = instances.hasOwnProperty(name)? instances[name].running : false;
							el.innerText = running ? 'yes' : 'no';
						}
					});
				});
			});
		});
	},
});
