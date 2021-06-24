'use strict';
'require baseclass';
'require form';

return baseclass.extend({
   title: _('Syslog Plugin Configuration'),
   description: _('The SysLog plugin receives log messages from the daemon and dispatches them to syslog.'),

   addFormOptions: function(s) {
       var o;

       o = s.option(form.Flag, 'enable', _('Enable this plugin'));

       o = s.option(form.ListValue, 'LogLevel', _('Log level'), _('Sets the syslog log-level.'));
       o.value('err');
       o.value('warning');
       o.value('notice');
       o.value('info');
       o.value('debug');
       o.rmempty=false;
       o.default = 'warning';

       o = s.option(form.ListValue, 'NotifyLevel', _('Notify level'), _('Controls which notifications should be sent to syslog.'));
       o.value('FAILURE');
       o.value('WARNING');
       o.value('OKAY');
       o.rmempty=false;
       o.default = 'WARNING';
   },

   configSummary: function(section) {
       return _('Syslog enabled');
   }
});
