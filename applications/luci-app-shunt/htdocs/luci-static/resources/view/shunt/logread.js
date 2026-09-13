'use strict';
'require view.shunt.logtemplate as LogTemplate';

return LogTemplate.Logview(/\bshunt(\[\d+\])?:/, 'shunt');
