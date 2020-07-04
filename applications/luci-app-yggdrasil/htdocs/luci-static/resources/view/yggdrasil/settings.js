'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('yggdrasil', 'Yggdrasil');

		s = m.section(form.TypedSection, 'yggdrasil', _('General settings'));
		s.anonymous = true;

		s.option(form.Value, "IfName", _("Yggdrasil's network interface name"));
		s.option(form.Value, "LinkLocalTCPPort", _("Link-local TCP port"),
			_("The port number to be used for the link-local TCP listeners for the "+
				"configured MulticastInterfaces. This option does not affect listeners" +
				"specified in the Listen option. Unless you plan to firewall link-local" +
				"traffic, it is best to leave this as the default value of 0. This " +
				"option cannot currently be changed by reloading config during runtime."));

		s.option(form.Flag, "NodeInfoPrivacy", _("Enable NodeInfo privacy"),
		  _("By default, nodeinfo contains some defaults including the platform," +
		  " architecture and Yggdrasil version. These can help when surveying" +
		  " the network and diagnosing network routing problems. Enabling" +
		  " nodeinfo privacy prevents this, so that only items specified in" +
		  " \"NodeInfo\" are sent back if specified."));

		o = s.option(form.Value, "NodeInfo", _("NodeInfo"),
			_("Optional node info. This must be a { \"key\": \"value\", ... } map " +
				"or set as null. This is entirely optional but, if set, is visible " +
				"to the whole network on request."));
		o.validate = function(k, v) {
			try { JSON.parse(v); return true; } catch (e) { return e.message; }
		}

		s.option(form.Value, "IfMTU", _("MTU size for the interface"));
		s.option(form.Value, "SwitchOptions_MaxTotalQueueSize", 
			_("Maximum size of all switch queues combined"));

		o = m.section(form.TableSection, "multicast_interface", _("Multicast interfaces"),
			_("Regular expressions for which interfaces multicast peer discovery " +
				"should be enabled on. If none specified, multicast peer discovery is " +
				"disabled. The default value is .* which uses all interfaces."));
		o.option(form.Value, "name", _("Interface name"), 
			_("Set .* to multicast on all interfaces"));
		o.anonymous = true;
		o.addremove = true;

		o = m.section(form.TableSection, "listen_address", _("Listen addresses"), 
			_("Listen addresses for incoming connections. You will need to add " +
				"listeners in order to accept incoming peerings from non-local nodes. " +
				"Multicast peer discovery will work regardless of any listeners set " +
				"here. Each listener should be specified in URI format as above, e.g. " +
				"tcp://0.0.0.0:0 or tcp://[::]:0 to listen on all interfaces."));
			_("Address to listen for incoming connections"), 
		o.option(form.Value, "uri",
			_("e.g. tcp://0.0.0.0:0 or tcp://[::]:0"));
		o.anonymous = true;
		o.addremove = true;

		return m.render();
	}
});
