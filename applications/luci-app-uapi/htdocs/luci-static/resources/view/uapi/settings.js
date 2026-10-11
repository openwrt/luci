'use strict';
'require view';
'require form';

return view.extend({
	render: function () {
		let m, s, o;

		m = new form.Map('uapi', _('uAPI Settings'),
			_('Runtime options uapi reads from <code>/etc/config/uapi</code>. ' +
			  'Bearer tokens live in the same file but are managed on the ' +
			  '<a href="%s">Tokens</a> tab and are never shown here.')
				.format(L.url('admin/services/uapi/tokens')));

		s = m.section(form.TypedSection, 'logging', _('Logging'),
			_('Opt-in log categories. Successful writes (AUDIT) and errors are ' +
			  'always logged; these add the high-volume categories.'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Flag, 'access', _('Access log'),
			_('Log every request (INFO). Off by default.'));
		o.rmempty = true;

		o = s.option(form.Flag, 'debug', _('Debug log'),
			_('Per-ubus-call tracing (DEBUG). Off by default.'));
		o.rmempty = true;

		s = m.section(form.TypedSection, 'ratelimit', _('Rate limiting'),
			_('Per-token token-bucket limit. Leave blank to use the built-in ' +
			  'defaults (100 req/s, burst 200). Defense in depth, not a ' +
			  'standalone security control.'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Value, 'rate', _('Rate (req/s)'));
		o.datatype = 'uinteger';
		o.placeholder = '100';

		o = s.option(form.Value, 'burst', _('Burst'));
		o.datatype = 'uinteger';
		o.placeholder = '200';

		return m.render();
	}
});
