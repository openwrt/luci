'use strict';
'require dom';
'require view';
'require rpc';
'require form';
'require uci';

function validateHostname(sid, s) {
    if (s == null || s == '')
        return true;

    if (s.length > 256)
        return _('Expecting: %s').format(_('valid hostname'));

    var labels = s.replace(/^\.+|\.$/g, '').split(/\./);

    for (var i = 0; i < labels.length; i++)
        if (!labels[i].match(/^[a-z0-9_](?:[a-z0-9-]{0,61}[a-z0-9])?$/i))
            return _('Expecting: %s').format(_('valid hostname'));

    return true;
}

return view.extend({
    callHostHints: rpc.declare({
        object: 'luci-rpc',
        method: 'getHostHints',
        expect: { '': {} }
    }),

    load: function() {
        return this.callHostHints();
    },

    render: function(hosts) {
        var m, s, o;

        m = new form.Map('dhcp', _('Static IP'));

        s = m.section(form.GridSection, 'leases', _('Static Leases'), _('Static leases are used to assign fixed IP addresses and symbolic hostnames to DHCP clients. They are alo required for non-dynamic interface configurations where only hosts with a corresponding lease are served.'));
        s.addremove = true;
        s.anonymous = true;


        o = s.option(form.Value, 'name', _('Hostname'));
        o.validate = validateHostname;
        o.rmempty  = true;
        o.write = function(section, value) {
            uci.set('dhcp', section, 'name', value);
            uci.set('dhcp', section, 'dns', '1');
        };
        o.remove = function(section) {
            uci.unset('dhcp', section, 'name');
            uci.unset('dhcp', section, 'dns');
        };

        o = s.option(form.Value, 'mac', _('<abbr title="Media Access Control">MAC</abbr>-Address'));
        o.datatype = 'list(unique(macaddr))';
        o.rmempty  = true;
        o.cfgvalue = function(section) {
            var macs = uci.get('dhcp', section, 'mac'),
                result = [];

            if (!Array.isArray(macs))
                macs = (macs != null && macs != '') ? macs.split(/\ss+/) : [];

            for (var i = 0, mac; (mac = macs[i]) != null; i++) {
                if (/^([0-9a-fA-F]{1,2}):([0-9a-fA-F]{1,2}):([0-9a-fA-F]{1,2}):([0-9a-fA-F]{1,2}):([0-9a-fA-F]{1,2}):([0-9a-fA-F]{1,2})$/.test(mac)) {
                    result.push('%02X:%02X:%02X:%02X:%02X:%02X'.format(
                        parseInt(RegExp.$1, 16), parseInt(RegExp.$2, 16),
                        parseInt(RegExp.$3, 16), parseInt(RegExp.$4, 16),
                        parseInt(RegExp.$5, 16), parseInt(RegExp.$6, 16)));
                }
            }
            return result.length ? result.join(' ') : null;
        };
        o.renderWidget = function(section_id, option_index, cfgvalue) {
            var node = form.Value.prototype.renderWidget.apply(this, [section_id, option_index, cfgvalue]),
                ipopt = this.section.children.filter(function(o) { return o.option == 'ip' })[0];

            node.addEventListener('cbi-dropdown-change', L.bind(function(ipopt, section_id, ev) {
                var mac = ev.detail.value.value;
                if (mac == null || mac == '' || !hosts[mac] || !hosts[mac].ipv4)
                    return;

                var ip = ipopt.formvalue(section_id);
                if (ip != null && ip != '')
                    return;

                var node = ipopt.map.findElement('id', ipopt.cbid(section_id));
                if (node)
                    dom.callClassMethod(node, 'setValue', hosts[mac].ipv4);
            }, this, ipopt, section_id));

            return node;
        };
        Object.keys(hosts).forEach(function(mac) {
            var hint = hosts[mac].name || hosts[mac].ipv4;
            o.value(mac, hint ? '%s (%s)'.format(mac, hint) : mac);
        });

        o = s.option(form.Value, 'ip', _('<abbr title="Internet Protocol Version 4">IPv4</abbr>-Address'));
        o.datatype = 'or(ip4addr,"ignore")';
        o.validate = function(section, value) {
            var mac = this.map.lookupOption('mac', section),
                name = this.map.lookupOption('name', section),
                m = mac ? mac[0].formvalue(section) : null,
                n = name ? name[0].formvalue(section) : null;

            if ((m == null || m == '') && (n == null || n == ''))
                return _('One of hostname or mac address must be specified!');

            return true;
        };
        Object.keys(hosts).forEach(function(mac) {
            if (hosts[mac].ipv4) {
                var hint = hosts[mac].name;
                o.value(hosts[mac].ipv4, hint ? '%s (%s)'.format(hosts[mac].ipv4, hint) : hosts[mac].ipv4);
            }
        });

        return m.render();
    }
});
