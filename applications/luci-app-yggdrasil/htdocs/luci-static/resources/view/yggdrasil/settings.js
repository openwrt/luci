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

		o = m.section(form.TableSection, "listen_address", _("Listen addresses"), 
			_("Listen addresses for incoming connections. You will need to add " +
				"listeners in order to accept incoming peerings from non-local nodes. " +
				"Multicast peer discovery will work regardless of any listeners set " +
				"here. Each listener should be specified in URI format as above, e.g. " +
				"tcp://0.0.0.0:0 or tcp://[::]:0 to listen on all interfaces."));
		o.option(form.Value, "uri",
			_("e.g. tcp://0.0.0.0:0 or tcp://[::]:0"));
		o.anonymous = true;
		o.addremove = true;

		o = m.section(form.TableSection, "multicast_interface", _("Multicast interface"), 
			_("Configuration for which interfaces multicast peer discovery should be enabled on. " + 
				"Regex is a regular expression which is matched against an interface name, and interfaces use the first configuration that they match gainst. " +
				"Beacon configures whether or not the node should send link-local multicast beacons to advertise their presence, while listening for incoming connections on Port. " +
				"Listen controls whether or not the node listens for multicast beacons and opens outgoing connections."));
		o.option(form.Value, "regex", _("Regular expression"));
		o.option(form.Flag, "beacon", _("Send beacons"));
		o.option(form.Flag, "listen", _("Listen for beacons"));
		o.option(form.Value, "port", _("Link-local port"));
		o.anonymous = true;
		o.addremove = true;

		return m.render();
	}
});
