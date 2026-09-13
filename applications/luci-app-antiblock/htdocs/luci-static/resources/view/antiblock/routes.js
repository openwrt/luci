'use strict';
'require view';
'require form';
'require tools.widgets as widgets';

return view.extend({
    render: function () {
        const m = new form.Map('antiblock', _('Routes'));

        const s = m.section(form.GridSection, 'route', _('Routes'), _('It is necessary to enter from 1 to 32 values:'));
        s.optional = false;
        s.anonymous = true;
        s.addremove = true;
        s.nodescriptions = true;

        let o = s.option(widgets.DeviceSelect, 'gateway', _('Gateway'), _('Gateway'));
        o.loopback = true;
        o.nocreate = true;
        o.noaliases = true;

        o = s.option(form.Value, 'domains_path', _('Domains path'), _('Domains path/URL. If you want to add domains via LuCI, specify the files in the /etc/antiblock folder.'));
        o.default = '/etc/antiblock/';

        o = s.option(form.Flag, 'enabled', _('Enable'));
        o.default = o.enabled;
        o.editable = true;

        return m.render();
    }
});
