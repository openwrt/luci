'use strict';
'require form';
'require shadowsocks-libev as ss';

function startsWith(str, search) {
	return str.substring(0, search.length) === search;
}

return L.view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('shadowsocks-libev', _('Remote Servers'),
			_('Definition of remote shadowsocks servers.  \
				Disable any of them will also disable instances referring to it.'));

		s = m.section(form.GridSection, 'server');
		s.addremove = true;

		o = s.option(form.Flag, 'disabled', _('Disable'));
		o.editable = true;

		ss.options_server(s);

		return m.render();
	},
	addFooter: function() {
		var p = '#edit=';
		if (startsWith(location.hash, p)) {
			var section_id = location.hash.substring(p.length);
			var editBtn = document.querySelector('#cbi-shadowsocks-libev-' + section_id + ' button.cbi-button-edit');
			if (editBtn)
				editBtn.click();
		}
		return this.super('addFooter', arguments);
	}
});
