
'use strict';
'require view';
'require dom';
'require ui';
'require form';
'require rpc';
'require uci';
'require network';

var formData={
    administrator:{
        pw1:null,
        pw2:null
    },
    wan:{
        section_id:null,
        proto:null,
        ipv4_addr:null,
        netmask:null,
        ipv4_gateway:null,
        ipv6_addr:null,
        ipv6_gateway:null
    },
    wifi:{
        SSID:null,
        password:null
    }
};
var callSetPassword=rpc.declare({
    object:'luci',
    method:'setPassword',
    params:['username','password'],
    expect:{
        result:false
    }
});

var callSet=rpc.declare({
    object:'uci',
    method:'set',
    params:['config', 'sid', 'option', 'value'],
    reject: true
});


return view.extend({
    checkPassword:function(section_id,value){
        var strength=document.querySelector('.cbi-value-description'),
            strongRegex=new RegExp("^(?=.{8,})(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*\\W).*$","g"),
            mediumRegex=new RegExp("^(?=.{7,})(((?=.*[A-Z])(?=.*[a-z]))|((?=.*[A-Z])(?=.*[0-9]))|((?=.*[a-z])(?=.*[0-9]))).*$","g"),
            enoughRegex=new RegExp("(?=.{6,}).*","g");
        if(strength&&value.length){
            if(false==enoughRegex.test(value))
                strength.innerHTML='%s: <span style="color:red">%s</span>'.format(_('Password strength'),_('More Characters'));
            else if(strongRegex.test(value))
                strength.innerHTML='%s: <span style="color:green">%s</span>'.format(_('Password strength'),_('Strong'));
            else if(mediumRegex.test(value))
                strength.innerHTML='%s: <span style="color:orange">%s</span>'.format(_('Password strength'),_('Medium'));
            else
                strength.innerHTML='%s: <span style="color:red">%s</span>'.format(_('Password strength'),_('Weak'));}
        return true;
    },

    load: function() {
        return Promise.all([
            network.getDSLModemType(),
            network.getNetworks(),
            uci.changes()
        ]).then(L.bind(function(data) {
            this.networks = data[1];
        }, this));
    },

    render: function () {
        var m, s, o;
        m = new form.JSONMap(formData, _('Quick Setup'));

        s = m.section(form.TypedSection, 'administrator', _('Administrator'), _('Changes the administrator password for accessing the device'));
        s.anonymous = true;
        s.addremove = false;

        o = s.option(form.Value,'pw1',_('Password'));
        o.password=true;
        o.validate=this.checkPassword;

        o = s.option(form.Value,'pw2',_('Confirmation'),' ');
        o.password=true;
        o.renderWidget=function(){
            var node=form.Value.prototype.renderWidget.apply(this,arguments);
            node.querySelector('input').addEventListener('keydown',function(ev){
                if(ev.keyCode==13&&!ev.currentTarget.classList.contains('cbi-input-invalid'))
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


        net = this.networks[1];
        formData.wan.section_id = net.getName();
        proto = s.option(form.ListValue, 'proto', _('Protocol'));
        proto.value('');
        for (var i = 0; i < protocols.length; i++) {
            proto.value(protocols[i].getProtocol(), protocols[i].getI18n());
        }
        proto.default = net.getProtocol(net.getName());
        proto.validate = function(value){
            if(value == '')
                return;
            return true;
        }

        o = s.option(form.Value, 'ipv4_addr', _('IPv4 address'));
        o.datatype = 'ip4addr';
        o.placeholder = '192.168.1.1';
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
        o.placeholder = '192.168.1.1';

        o = s.option(form.Value, 'ipv6_addr', _('IPv6 address'));
        o.datatype = 'ip6addr';
        o.placeholder = '2001:db8:0:1234:0:567:8:1';
        o.depends('proto', 'static');
        o.rmempty = true;

        o = s.option(form.Value, 'ipv6_gateway', _('IPv6 gateway'));
        o.datatype = 'ip6addr("nomask")';
        o.depends('proto', 'static');
        o.rmempty = true;

        s.render = function() {
            return Promise.all([
                {},
                this.renderUCISection('wan')
            ]).then(this.renderContents.bind(this));
        };
        s = m.section(form.TypedSection, 'wifi', _('Wifi'));
        s.anonymous = true;
        s.addremove = false;

        var SSID, pd;
        SSID = s.option(form.Value, 'SSID', _('SSID'));
        pd = s.option(form.Value, 'password', _('Password'));

        return m.render().then(L.bind(function(){
            return m.save(function () {
            });
        }, this));

    },
    handleSave:function(){
        var map=document.querySelector('.cbi-map');
        return dom.callClassMethod(map,'save').then(function(){
            uci.set('network', formData.wan.section_id, 'proto', formData.wan.proto);
            if(formData.wan.proto == 'static'){
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
            uci.save();
            if(formData.administrator.pw1!=formData.administrator.pw2){
                ui.addNotification(null,E('p',_('Given password confirmation did not match, password not changed!')),'danger');
                return;
            }
            if(formData.wan.section_id == null || formData.wan.proto == 'none'){
                ui.addNotification(null,E('p',_('Error!')),'danger');
                return;
            }

            return callSetPassword('root',formData.administrator.pw1).then(function (success) {
                if(success && formData.administrator.pw1 != null){
                    ui.addNotification(null,E('p',_('The system password has been successfully changed.')),'info');
                }
                else if(!success && formData.administrator.pw1 != null)
                    ui.addNotification(null,E('p',_('Failed to change the system password.')),'danger');
                formData.administrator.pw1=null;
                formData.administrator.pw2=null;
                dom.callClassMethod(map,'render');
            });

        });
    },

    //handleSaveApply:null,
    handleReset:null

});
