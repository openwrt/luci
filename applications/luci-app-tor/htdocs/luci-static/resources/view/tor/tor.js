'use strict';
'require view';
'require form';
'require uci';


return view.extend({
	render: function () {
		let m, s, o;

		m = new form.Map('tor', _('Tor onion router'),
			_('For further information <a %s>check the documentation</a>')
				.format('href="https://openwrt.org/docs/guide-user/services/tor/client" target="_blank" rel="noreferrer"')
		);

		s = m.section(form.NamedSection, 'conf', 'tor');

		o = s.option(form.DynamicList, 'tail_include', _('Include configs'));
		o.datatype = 'list(string)';

		o = s.option(form.FileUpload, '_custom_config', _('Custom config'));
		o.default = '/etc/tor/torrc_custom';
		o.root_directory = '/etc/tor/';
		o.optional = true;
		o.write = function(section_id, formvalue) {
			let tail_include = uci.get('tor', section_id, 'tail_include');
			if (!tail_include.includes(formvalue)) {
				tail_include.push(formvalue);
				return uci.set('tor', section_id, 'tail_include', tail_include);
			}
		};


		return m.render();
	},
});
