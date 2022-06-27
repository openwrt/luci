'use strict';
'require form';
'require view';

return view.extend({
    render: function () {
        // A basic configuration form; the luci.adguardhome script that
        // powers the other UI pages needs a username and password to
        // communicate with the AdguardHome REST API.
        var s, o;
        var m = new form.Map(
            'adguardhome', 
            _('AdGuard Home Configuration'), 
            _('This application requires the username and password that were configured when you set up AdGuard Home, ' +
            'as the REST API for AdGuard Home is password protected. The password cannot be read from the YAML ' +
            'configuration file for AdGuard Home, as it is encrypted in that store. The credentials supplied here will ' +
            'be stored unencrypted in /etc/config/adguardhome on your device.')
        );
        s = m.section(
            form.TypedSection, 
            'adguardhome', 
            _('General settings'),     
        );
        s.anonymous = true;
        o = s.option(
            form.Value, 
            'web_username', 
            _('Username for AdGuard Home'), 
            _('The username you configured when you set up AdGuard Home')
        );
        o.placeholder = 'adguard';
        o = s.option(
            form.Value, 
            'web_password', 
            _('Password for AdGuard Home'), 
            _('The password you configured when you set up AdGuard Home')
        );
        o.password = true;
        return m.render();
    }
})