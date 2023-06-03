'use strict';
'require view';
'require ui';
'require form';
'require rpc';
'require tools.widgets as widgets';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});	

function getServiceStatus() {
	return L.resolveDefault(callServiceList('wifidogx'), {}).then(function (res) {
		var isRunning = false;
		try {
			isRunning = res['wifidogx']['instances']['instance1']['running'];
		} catch (e) { }
		return isRunning;
	});
}

function renderStatus(isRunning) {
	var renderHTML = "";
	var spanTemp = '<em><span style="color:%s"><strong>%s %s</strong></span></em>';

	if (isRunning) {
		renderHTML += String.format(spanTemp, 'green', _("apfree-wifidog"), _("running..."));
	} else {
		renderHTML += String.format(spanTemp, 'red', _("apfree-wifidog"), _("not running..."));
	}

	return renderHTML;
}

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('wifidogx', _('ApFree-WiFiDog'));
		m.description = _("apfree-wifidog is a Stable & Secure captive portal solution.");

		s = m.section(form.NamedSection, '_status');
		s.anonymous = true;
		s.render = function (section_id) {
			L.Poll.add(function () {
				return L.resolveDefault(getServiceStatus()).then(function(res) {
					var view = document.getElementById("service_status");
					view.innerHTML = renderStatus(res);
				});
			});

			return E('div', { class: 'cbi-map' },
				E('fieldset', { class: 'cbi-section'}, [
					E('p', { id: 'service_status' },
						_('Collecting data ...'))
				])
			);
		}

		s = m.section(form.TypedSection, "wifidogx", _("ApFree-WiFiDog"), 
			_("ApFree-WiFiDog Settings"));
		s.anonymous = true;
		
		o = s.option(form.Flag, 'enabled', _('Enable'), 
			_('Enable apfree-wifidog service'));
		o.rmempty = false;
		
		o = s.option(form.Value, 'gateway_interface', _('Gateway Interface'), 
			_('The interface that the gateway listens on'));
		o.rmempty = false;
		o.datatype = 'string';

		o = s.option(form.Value, 'gateway_id', _('Gateway ID'), _('The ID of the gateway'));
		o.rmempty = false;
		o.datatype = 'string';
		
		o = s.option(form.Value, 'auth_server_hostname', _('Auth Server Hostname'),
			 _('The hostname of the authentication server'));
		o.rmempty = false;
		o.datatype = 'host';
		
		o = s.option(form.Value, 'auth_server_port', _('Auth Server Port'), 
			_('The port of the authentication server'));
		o.rmempty = false;
		o.datatype = 'port';
		
		o = s.option(form.Value, 'auth_server_path', _('Auth Server URI Path'), 
			_('The URI path of the authentication server'));
		o.rmempty = false;
		o.datatype = 'string';
		
		o = s.option(form.Value, 'check_interval', _('Check Interval(s)'), 
			_('The interval to check the status of the gateway'));
		o.rmempty = false;
		o.datatype = 'uinteger';
		
		o = s.option(form.Flag, 'wired_passed', _('Wired Pass'), 
			_('Wired client will pass through without authentication'));
		o.rmempty = false;

		return m.render();
	}
});
