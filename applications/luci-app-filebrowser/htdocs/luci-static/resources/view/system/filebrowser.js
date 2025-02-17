'use strict';
'require view';
'require ui';
'require form';

var formData = {
	files: {
		root: null,
	}
};

return view.extend({
	render: function() {
		let m, s, o;

		m = new form.JSONMap(formData, _('File Browser'), '');

		s = m.section(form.NamedSection, 'files', 'files');

		o = s.option(form.FileUpload, 'root', '');
		o.root_directory = '/';
		o.browser = true;
		o.show_hidden = true;
		o.enable_upload = true;
		o.enable_remove = true;
		o.enable_download = true;

		return m.render();
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
})
