'use strict';
'require form';
'require network';
'require rpc';
'require tools.widgets as widgets';
'require ui';
network.registerPatternVirtual(/^yggdrasil-.+$/);
function validatePrivateKey(section_id,value) {
	if (!value.match(/^([0-9a-fA-F]){128}$/)) {
		return _('Invalid private key string');
	}
	return true;
};
function validatePublicKey(section_id,value) {
	if (!value.match(/^([0-9a-fA-F]){64}$/)) {
		return _('Invalid public key string');
	}
	return true;
};

function validatePublicKeyOrEmpty(section_id,value) {
	if (value.length == 0) {
		return true;
	}
	if (!value.match(/^([0-9a-fA-F]){64}$/)) {
		return _('Invalid public key string');
	}
	return true;
};

function validateYggdrasilUri(section_id,value) {
	if (!value.match(/^(tls|tcp|unix):\/\//)) {
		return _('URI scheme not supported');
	}
	return true;
};

function validateYggdrasilPeerUri(section_id,value) {
	if (!value.match(/^(tls|tcp|unix|socks):\/\//)) {
		return _('URI scheme not supported');
	}
	return true;
};

var cbiKeyPairGenerate=form.DummyValue.extend({cfgvalue:function(section_id,value){return E('button',{'class':'btn','click':ui.createHandlerFn(this,function(section_id,ev){var prv=this.section.getUIElement(section_id,'private_key'),pub=this.section.getUIElement(section_id,'public_key'),map=this.map;
if((prv.getValue()||pub.getValue())&&!confirm(_('Do you want to replace the current keys?')))
return;
return generateKey().then(function(keypair){prv.setValue(keypair.priv);
pub.setValue(keypair.pub);
map.save(null,true);
});
},section_id)},[_('Generate new key pair')]);
}});
var generateKey=rpc.declare({object:'luci.yggdrasil',method:'generateKeyPair',expect:{keys:{}}});

return network.registerProtocol('yggdrasil',
	{
		getI18n:function(){return _('Yggdrasil Network');},
		getIfname:function(){return this._ubus('l3_device')||this.sid;},
		getType:function(){return "tunnel";},
		getOpkgPackage:function(){return'yggdrasil';},
		isFloating:function(){return true;},
		isVirtual:function(){return true;},
		getDevices:function(){return null;},
		containsDevice:function(ifname){return(network.getIfnameOf(ifname)==this.getIfname());},
		renderFormOptions:function(s){
			var o, ss;
			o=s.taboption('general',form.Value,'private_key',_('Private key'),_('The private key for your Yggdrasil node'));
			o.optional=false;
			o.password=true;
			o.validate=validatePrivateKey;
			o=s.taboption('general',form.Value,'public_key',_('Public key'),_('The public key for your Yggdrasil node'));
			o.optional=false;
			o.validate=validatePublicKey;
			s.taboption('general',cbiKeyPairGenerate,'_gen_server_keypair',' ');
			o=s.taboption('advanced',form.Value,'mtu',_('MTU'),_('Specify an MTU (Maximum Transmission Unit) for your local TUN interface. Default is the largest supported size for your platform. The lowest possible value is 1280.'));
			o.optional=true;
			o.placeholder=1280;
			o.datatype='range(1280, 65535)';
			o=s.taboption('general',form.TextValue,'node_info',_('Node info'),_('Optional node info. This must be a { "key": "value", ... } map or set as null. This is entirely optional but, if set, is visible to the whole network on request.'));
			o.optional=true;
			o.placeholder="{}";
			o=s.taboption('general',form.Flag,'node_info_privacy',_('Node info privacy'),_('By default, node info contains some defaults including the platform, architecture and Yggdrasil version. These can help when surveying the network and diagnosing network routing problems. Enabling node info privacy prevents this, so that only items specified in "Node info" are sent back if specified.'));
			o.default=o.disabled;
			try{s.tab('peers',_('Peers'));}catch(e){};
			o=s.taboption('peers', form.SectionValue, '_listen', form.NamedSection, this.sid, "interface", _("Listen for peers"))
			ss=o.subsection;
			o=ss.option(form.DynamicList,'listen_address',_('Listen addresses'),_('Listen addresses for incoming connections. You will need to add listeners in order to accept incoming peerings from non-local nodes. Multicast peer discovery will work regardless of any listeners sethere. Each listener should be specified in URI format, e.g.tls://0.0.0.0:0 or tls://[::]:0 to listen on all interfaces.'));
			o.placeholder="tls://0.0.0.0:0"
			o=s.taboption('peers',form.DynamicList,'allowed_public_key',_('Allowed public keys'),_('List of peer public keys to allow incoming peering connections from. If left empty then all connections will be allowed by default. This does not affect outgoing peerings, nor does it affect link-local peers discovered via multicast.'));
			o.validate=validatePublicKeyOrEmpty;
			o=s.taboption('peers', form.SectionValue, '_peers', form.TableSection, 'yggdrasil_%s_peer'.format(this.sid), _("Peer addresses"))
			ss=o.subsection;
			ss.addremove=true;
			ss.anonymous=true;
			ss.addbtntitle=_("Add peer address");
			o=ss.option(form.Value,"address",_("Peer URI"));
			o.placeholder="tls://0.0.0.0:0"
			o=ss.option(widgets.NetworkSelect,"interface",_("Peer interface"));
			o=s.taboption('peers', form.SectionValue, '_interfaces', form.TableSection, 'yggdrasil_%s_interface'.format(this.sid), _("Multicast rules"))
			ss=o.subsection;
			ss.addbtntitle=_("Add multicast rule");
			ss.addremove=true;
			ss.anonymous=true;
			o=ss.option(widgets.DeviceSelect,"interface",_("Devices"));
			o.multiple=true;
			ss.option(form.Flag,"beacon",_("Send multicast beacon"));
			ss.option(form.Flag,"listen",_("Listen to multicast beacons"));
			o=ss.option(form.Value,"port",_("Port"));
			o.optional=true;
			o.datatype='range(1, 65535)';
			return;
		}
	}
);
