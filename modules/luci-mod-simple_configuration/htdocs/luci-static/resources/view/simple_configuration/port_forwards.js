'use strict';
'require dom';
'require view';
'require rpc';
'require form';
'require uci';
'require tools.firewall as fwtool';
'require tools.widgets as widgets';

return view.extend({
    callHostHints: rpc.declare({
        object: 'luci-rpc',
        method: 'getHostHints',
        expect: { '': {} }
    }),

    load: function() {
        uci.load('firewall');
        return this.callHostHints();
    },

    render: function(hosts) {
        var m, s, o;
        m = new form.Map('firewall', _('Port Forwards'),
            _('Port forwarding allows remote computers on the Internet to connect to a specific computer or service within the private LAN.'));

        s = m.section(form.TableSection, 'redirect', _('Port Forwards'));
        s.addremove = true;
        s.anonymous = true;

        s.handleAdd = function(ev) {
            var config_name = this.uciconfig || this.map.config,
                section_id = uci.add(config_name, this.sectiontype);

            uci.set(config_name, section_id, 'target', 'DNAT');
            uci.set(config_name, section_id, 'src', 'wan');
            uci.set(config_name, section_id, 'dest', 'lan');
            this.addedSection = section_id;
            this.renderMoreOptionsModal(section_id);
        };

        o = s.option(form.Value, 'name', _('Name'),
            _('Name chosen for this server.'));
        o.placeholder = _('Unnamed forward');

        o = s.option(fwtool.CBIProtocolSelect, 'proto', _('Protocol'));
        o.default = 'tcp udp';

        o = s.option(form.Value, 'src_dport', _('External port'),
            _('Match incoming traffic directed at the given destination port or port range on this host'));
        o.rmempty = false;
        o.datatype = 'neg(portrange)';
        o.depends({ proto: 'tcp', '!contains': true });
        o.depends({ proto: 'udp', '!contains': true });


        o = s.option(form.Value, 'dest_ip', _('Internal IP address'),
            _('Redirect matched incoming traffic to the specified internal host'));
        o.rmempty = true;
        o.datatype = 'list(neg(ipmask))';

        var choices = fwtool.transformHostHints('ipv4', hosts);
        for (var i = 0; i < choices[0].length; i++) {
            o.value(choices[0][i], choices[1][choices[0][i]]);
        }

        o.transformChoices = function() {
            return this.super('transformChoices', []) || {};
        };

        o = s.option(form.Value, 'dest_port', _('Internal port'),
            _('Redirect matched incoming traffic to the given port on the internal host'));
        o.rmempty = true;
        o.placeholder = _('any');
        o.datatype = 'portrange';
        o.depends({ proto: 'tcp', '!contains': true });
        o.depends({ proto: 'udp', '!contains': true });

        return m.render();
    }
});
