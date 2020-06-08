'use strict';
'require view';
'require dom';
'require ui';
'require form';
'require rpc';
'require uci';
'require network';

var formData = {
    administrator: {
        pw1: null,
        pw2: null
    },
    wan: {
        section_id: null,
        proto: null,
        ipv4_addr: null,
        netmask: null,
        ipv4_gateway: null,
        ipv6_addr: null,
        ipv6_gateway: null,
        username: null,
        pw3: null
    },
    wifi: {
        section_id_2: null,
        section_id_5: null,
        enable: null,
        SSID: null,
        SSID_2: null,
        pw4: null,
        Ghz_2: null,
        Ghz_5: null
    }
};
var callSetPassword = rpc.declare({
    object:'luci',
    method:'setPassword',
    params:['username','password'],
    expect:{
        result:false
    }
});



return view.extend({
    checkPassword:function(section_id,value){
        var strength = document.querySelector('.cbi-value-description'),
            strongRegex = new RegExp("^(?=.{8,})(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*\\W).*$","g"),
            mediumRegex = new RegExp("^(?=.{7,})(((?=.*[A-Z])(?=.*[a-z]))|((?=.*[A-Z])(?=.*[0-9]))|((?=.*[a-z])(?=.*[0-9]))).*$","g"),
            enoughRegex = new RegExp("(?=.{6,}).*","g");

        if (strength && value.length) {
            if(false == enoughRegex.test(value))
                strength.innerHTML = '%s: <span style = "color:red">%s</span>'.format(_('Password strength'),_('More Characters'));
            else if(strongRegex.test(value))
                strength.innerHTML = '%s: <span style = "color:green">%s</span>'.format(_('Password strength'),_('Strong'));
            else if(mediumRegex.test(value))
                strength.innerHTML = '%s: <span style = "color:orange">%s</span>'.format(_('Password strength'),_('Medium'));
            else
                strength.innerHTML = '%s: <span style = "color:red">%s</span>'.format(_('Password strength'),_('Weak'));}
        return true;
    },

    load: function() {
        return Promise.all([
            network.getNetworks(),
            network.getWifiNetworks(),
            network.getWifiDevices(),
            uci.changes()
        ]).then(L.bind(function(data) {
            this.networks = data[0];
            this.wifis = data[1];
            this.devices = data[2];
        }, this));
    },

    render: function () {
        var m, s, o;
        m = new form.JSONMap(formData, _('Quick Setup'));

        s = m.section(form.TypedSection, 'administrator', _('Administrator'), _('Changes the administrator password for accessing the device'));
        s.anonymous = true;
        s.addremove = false;

        o = s.option(form.Value, 'pw1', _('New password'));
        o.password = true;
        o.validate = this.checkPassword;

        o = s.option(form.Value, 'pw2', _('Confirmation'));
        o.password = true;
        o.renderWidget = function(){
            var node = form.Value.prototype.renderWidget.apply(this,arguments);
            node.querySelector('input').addEventListener('keydown',function(ev){
                if(ev.keyCode == 13 && !ev.currentTarget.classList.contains('cbi-input-invalid'))
                    document.querySelector('.cbi-button-save').click();
            });
            return node;
        };

        //***************************************

        //**************************************
        s = m.section(form.NamedSection, 'wan', 'wan', _('WAN'), _('Changes the connection type of internet'));
        s.anonymous = true;
        s.addremove = false;

        var protocols = network.getProtocols(),
            proto, net;

        for (var i = 0; i < this.networks.length; i++) {
            if(this.networks[i].getName() == 'wan'){
                net = this.networks[i];
                formData.wan.section_id = net.getName();
            }
        }

        proto = s.option(form.ListValue, 'proto', _('Protocol'));
        for (var i = 0; i < protocols.length; i++) {
            proto.value(protocols[i].getProtocol(), protocols[i].getI18n());
        }
        proto.value('pppoe', 'PPPoE');
        proto.default = net.getProtocol(net.getName());

        o = s.option(form.Value, 'ipv4_addr', _('IPv4 address'));
        o.datatype = 'ip4addr';
        o.placeholder = '203.0.113.42';
        o.depends('proto', 'static');

        o = s.option(form.ListValue, 'netmask', _('IPv4 netmask'));
        o.datatype = 'ip4addr("nomask")';
        o.depends('proto', 'static')
        o.value('255.255.255.0');
        o.value('255.255.0.0');
        o.value('255.0.0.0');

        o = s.option(form.Value, 'ipv4_gateway', _('IPv4 gateway'));
        o.datatype = 'ip4addr("nomask")';
        o.depends('proto', 'static');
        o.placeholder = '203.0.113.1';

        o = s.option(form.Value, 'ipv6_addr', _('IPv6 address'));
        o.datatype = 'ip6addr';
        o.placeholder = '2001:db8:0:1234:0:567:8:1';
        o.depends('proto', 'static');
        o.rmempty = true;

        o = s.option(form.Value, 'ipv6_gateway', _('IPv6 gateway'));
        o.datatype = 'ip6addr("nomask")';
        o.depends('proto', 'static');
        o.rmempty = true;

        o = s.option(form.Value, 'username', _('PAP/CHAP username'));
        o.depends('proto', 'pppoe');

        o = s.option(form.Value, 'pw3', _('PAP/CHAP password'));
        o.depends('proto', 'pppoe');
        o.password = true;

        s.render = function() {
            return Promise.all([
                {},
                this.renderUCISection('wan')
            ]).then(this.renderContents.bind(this));
        };
        //***************************************

        //**************************************
        s = m.section(form.TypedSection, 'wifi', _('Wifi'));
        s.anonymous = true;
        s.addremove = false;

        var SSID, pd, enable, ssid, ssid_5, Ghz_2, Ghz_5, device_2, device_5;

        for (var i = 0; i < this.devices.length; i++) {
            if (uci.get('wireless', this.devices[i].getName(), 'hwmode') == '11g') {//2.4Ghz
                device_2 = i;
            }
            if (uci.get('wireless', this.devices[i].getName(), 'hwmode') == '11a') {//5Ghz
                device_5 = i;
            }
        }

        for (var i = 0; i < this.wifis.length; i++) {
            var device = uci.get('wireless', this.wifis[i].getName(), 'device');
            var hw = uci.get('wireless', device, 'hwmode');

            if (uci.get('wireless', this.wifis[i].getName(), 'network') == 'lan' && hw == '11g') {//2.4GHz
                formData.wifi.Ghz_2 = true;
                formData.wifi.section_id_2 = this.wifis[i].getName();
                Ghz_2 = i;
                ssid = uci.get('wireless', this.wifis[i].getName(), 'ssid');
                formData.wifi.pw4 = uci.get('wireless', formData.wifi.section_id_2, 'key');
            }
            if (uci.get('wireless', this.wifis[i].getName(), 'network') == 'lan' && hw == '11a') {//5GHz
                formData.wifi.Ghz_5 = true;
                formData.wifi.section_id_5 = this.wifis[i].getName();
                Ghz_5 = i;
                ssid_5 = uci.get('wireless', this.wifis[i].getName(), 'ssid');
                if(!ssid_5.includes('_2')){
                    ssid_5 = ssid_5 + '_2';
                }
                uci.set('wireless', formData.wifi.section_id_5, 'ssid', ssid_5);
                uci.save();
                formData.wifi.pw4 = uci.get('wireless', formData.wifi.section_id_5, 'key');
            }
        }

        if (formData.wifi.Ghz_2 == null) {
            var device = this.devices[device_2].getName();
            var mode = uci.get('wireless', this.wifis[Ghz_5].getName(), 'mode');
            var encryption = uci.get('wireless', this.wifis[Ghz_5].getName(), 'encryption');
            var key = uci.get('wireless', this.wifis[Ghz_5].getName(), 'key');
            var ssid = uci.get('wireless', this.wifis[Ghz_5].getName(), 'ssid');
            if (ssid.includes('_2')) {
                ssid = ssid.substring(0,ssid.indexOf('_2'));
            }

            var wifi_id = uci.add('wireless', 'wifi-iface', 'default_radio'+this.wifis.length);
            uci.set('wireless', wifi_id, 'device', device);
            uci.set('wireless', wifi_id, 'network', 'lan');
            uci.set('wireless', wifi_id, 'mode', mode);
            uci.set('wireless', wifi_id, 'encryption', encryption);
            uci.set('wireless', wifi_id, 'key', key);
            uci.set('wireless', wifi_id, 'ssid', ssid);
            uci.save();
            formData.wifi.Ghz_2 = true;
            formData.wifi.section_id_2 = wifi_id;
        }

        if (formData.wifi.Ghz_5 == null) {
            var device = this.devices[device_5].getName();
            var mode = uci.get('wireless', this.wifis[Ghz_2].getName(), 'mode');
            var encryption = uci.get('wireless', this.wifis[Ghz_2].getName(), 'encryption');
            var key = uci.get('wireless', this.wifis[Ghz_2].getName(), 'key');
            var ssid = uci.get('wireless', this.wifis[Ghz_2].getName(), 'ssid');
            ssid = ssid + '_2';

            var wifi_id = uci.add('wireless', 'wifi-iface', 'default_radio'+this.wifis.length);
            uci.set('wireless', wifi_id, 'device', device);
            uci.set('wireless', wifi_id, 'network', 'lan');
            uci.set('wireless', wifi_id, 'mode', mode);
            uci.set('wireless', wifi_id, 'encryption', encryption);
            uci.set('wireless', wifi_id, 'key', key);
            uci.set('wireless', wifi_id, 'ssid', ssid);
            uci.save();
            formData.wifi.Ghz_5 = true;
            formData.wifi.section_id_5 = wifi_id;
        }
        ssid = uci.get('wireless', formData.wifi.section_id_2, 'ssid');
        ssid_5 = uci.get('wireless', formData.wifi.section_id_5, 'ssid');

        enable = s.option(form.Flag, 'enable', _('Enable'));
        enable.default = true;
        if (enable.enabled == true) {
            formData.wifi.enable = 1;
        }
        else {
            formData.wifi.enable = 0;
        }

        SSID = s.option(form.Value, 'SSID', _('Name of Wifi network'));
        SSID.default = ssid;

        pd = s.option(form.Value, 'pw4', _('Wifi password'));
        pd.default = formData.wifi.pw4;
        pd.password = true;
        pd.validate = this.checkPassword;

        o = s.option(form.Value, 'SSID_2', _('Secondary Wifi network (5 GHz)'), _('This secondary Wifi network is faster but has a lower range.'));
        o.default = ssid_5;
        o.readonly = true;


        return m.render().then(L.bind(function(){
            return m.save(function () {
            });
        }, this));

    },
    handleSave: function(){
        var map = document.querySelector('.cbi-map');
        return dom.callClassMethod(map,'save').then(function(){
            uci.set('network', formData.wan.section_id, 'proto', formData.wan.proto);
            if (formData.wan.proto == 'static') {
                if(formData.wan.ipv6_addr == null){
                    uci.set('network', formData.wan.section_id, 'ipaddr', formData.wan.ipv4_addr);
                    uci.set('network', formData.wan.section_id, 'netmask', formData.wan.netmask);
                    uci.set('network', formData.wan.section_id, 'gateway', formData.wan.ipv4_gateway);
                }
                else{
                    uci.set('network', formData.wan.section_id, 'ip6addr', formData.wan.ipv6_addr);
                    uci.set('network', formData.wan.section_id, 'ip6gw', formData.wan.ipv6_gateway);
                }
            }
            if (formData.wan.proto == 'PPPoE') {
                uci.set('network', formData.wan.section_id, 'username', formData.wan.username);
                uci.set('network', formData.wan.section_id, 'password', formData.wan.pw3);
            }
            uci.set('wireless', formData.wifi.section_id_2, 'key', formData.wifi.pw4);
            uci.set('wireless', formData.wifi.section_id_5, 'key', formData.wifi.pw4);
            uci.set('wireless', formData.wifi.section_id_2, 'ssid', formData.wifi.SSID);
            uci.set('wireless', formData.wifi.section_id_5, 'ssid', formData.wifi.SSID+'_2');
            if (formData.wifi.enable == false) {
                uci.set('wireless', formData.wifi.section_id_2, 'disabled', 1);
                uci.set('wireless', formData.wifi.section_id_5, 'disabled', 1);
            }
            else {
                uci.set('wireless', formData.wifi.section_id_2, 'disabled', 0);
                uci.set('wireless', formData.wifi.section_id_5, 'disabled', 0);
            }
            uci.save();
            if (formData.administrator.pw1 != formData.administrator.pw2) {
                ui.addNotification(null, E('p', _('Given password confirmation did not match, password not changed!')), 'danger');
                return;
            }
            if (formData.administrator.pw1 != null) {
                var success = callSetPassword('root', formData.administrator.pw1);
                if (success) {
                    ui.addNotification(null, E('p', _('The system password has been successfully changed.')), 'info');
                }
                else {
                    ui.addNotification(null, E('p', _('Failed to change the system password.')), 'danger');
                }
                formData.administrator.pw1 = null;
                formData.administrator.pw2 = null;
            }
            dom.callClassMethod(map,'render');
        });
    },
    handleReset: null

});
