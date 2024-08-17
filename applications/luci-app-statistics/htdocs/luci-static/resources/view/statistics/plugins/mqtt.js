'use strict';
'require baseclass';
'require form';

return baseclass.extend({
    title: _('Mqtt Plugin Configuration'),

    addFormOptions: function(s) {
        let o, ss;

        o = s.option(form.Flag, 'enable', _('Sends or receives data via mqtt'));

        o = s.option(form.SectionValue, '__blocks', form.GridSection, 'collectd_mqtt_block');
        o.depends('enable', '1');

        ss = o.subsection;
        ss.anonymous = true;
        ss.addremove = true;

        o = ss.option(form.ListValue, 'blocktype', _('Type'));
        o.value('Publish', _('Publish'));
        o.value('Subscribe', _('Subscribe'));
        o.default = 'Publish';

        o = ss.option(form.Value, 'name', _('Name'));
        o.optional = false;
        o.rmempty = false;

        o = ss.option(form.Value, 'Host', _('Host'));
        o.datatype = 'host';
        o.optional = false;
        o.rmempty = false;

        o = ss.option(form.Value, 'Port', _('Port'));
        o.datatype = 'port';
        o.optional = true;

        o = ss.option(form.Value, 'User', _('User'));
        o.optional = true;

        o = ss.option(form.Value, 'Password', _('Password'));
        o.password = true;
        o.optional = true;
        o.modalonly = true;

        o = ss.option(form.ListValue, 'Qos', _('QoS'));
        o.value('0', _('0 - At most once'));
        o.value('1', _('1 - At least once'));
        o.value('2', _('2 - Exactly once'));
        o.modalonly = true;
        o.optional = true;

        o = ss.option(form.Value, 'Prefix', _('Prefix'));
        o.depends('blocktype', 'Publish');
        o.optional = true;
        o.modalonly = true;

        o = ss.option(form.ListValue, 'Retain', _('Retain'));
        o.depends('blocktype', 'Publish');
        o.value('true', _('True'));
        o.value('false', _('False'));
        o.optional = true;
        o.modalonly = true;

        o = ss.option(form.ListValue, 'StoreRates', _('StoreRates'));
        o.depends('blocktype', 'Publish');
        o.value('true', _('True'));
        o.value('false', _('False'));
        o.modalonly = true;
        o.optional = true;

        o = ss.option(form.ListValue, 'CleanSession', _('CleanSession'));
        o.depends('blocktype', 'Subscribe');
        o.value('true', _('True'));
        o.value('false', _('False'));
        o.optional = true;
        o.modalonly = true;

        o = ss.option(form.Value, 'Topic', _('Topic'));
        o.depends('blocktype', 'Subscribe');
        o.optional = true;
        o.modalonly = true;
    },

    configSummary: function(section) {
        return _('Mqtt plugin enabled');
    }
});
