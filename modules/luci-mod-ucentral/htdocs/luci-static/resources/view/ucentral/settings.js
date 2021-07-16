'use strict';
'require view';
'require form';
'require fs';
'require ui';
'require tools.ucentral as uctool';

var profile = null;

function serialize(data) {
	if (!L.isObject(profile.unit))
		profile.unit = {};

	profile.redirector = data.local.redirector;
	profile.unit.location = data.local.location;

	return JSON.stringify(profile, null, '\t');
}

return view.extend({
	load: function() {
		return L.resolveDefault(fs.read('/etc/ucentral/profile.json'), '').then(function(data) {
			try { profile = JSON.parse(data); }
			catch(e) { profile = {}; };
		});
	},

	render: function() {
		var m, s, o, data = { local: {
			redirector: profile.redirector,
			location: L.isObject(profile.unit) ? profile.unit.location : ''
		} };

		m = new form.JSONMap(data);
		m.readonly = !L.hasViewPermission();

		s = m.section(form.NamedSection, 'local', 'local', _('Local settings'),
			_('The settings on this page specify how the local uCentral client connects to the controller server.'));

		s.option(form.Value, 'redirector', _('Redirector URL'));
		s.option(form.Value, 'location', _('Unit location'));

		o = s.option(form.Button, '_certs', _('Certificates'));
		o.inputtitle = _('Upload certificate bundle…');
		o.onclick = function(ev) {
			return ui.uploadFile('/tmp/certs.tar').then(function(res) {
				uctool.showProgress(_('Verifying certificates…'));

				return fs.exec('/sbin/certupdate').then(function(res) {
					if (res.code) {
						uctool.showError(_('Certificate validation failed: %s').format(res.stderr || res.stdout));
					}
					else {
						uctool.showProgress(_('Certificates updated.'), 1500);
						uctool.setDirty(true);
					}
				}, function(err) {
					uctool.showError(_('Unable to verify certificates: %s').format(err));
				});
			});
		};

		return m.render();
	},

	handleSave: uctool.save.bind(uctool, serialize),

	handleSaveApply: null,
	handleReset: null
});
