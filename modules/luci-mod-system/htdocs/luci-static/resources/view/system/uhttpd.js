'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('uhttpd', _('HTTP(S) Access'), _('uHTTPd offers <abbr title="Hypertext Transfer Protocol">HTTP</abbr> or <abbr title="Hypertext Transfer Protocol Secure">HTTPS</abbr> network access.'));

		s = m.section(form.NamedSection, 'main', 'uhttpd', _('Settings'));
		s.addremove = false;

		o = s.option(form.Flag, 'redirect_https', _('Redirect to HTTPS'), _('Enable automatic redirection of <abbr title="Hypertext Transfer Protocol">HTTP</abbr> requests to <abbr title="Hypertext Transfer Protocol Secure">HTTPS</abbr> port.'));
		o.rmempty = false;

		const csp_mode_option = s.option(form.RichListValue, "csp_mode", _('Content-Security-Policy'), _('Configure CSP headers to improve security.'));
		csp_mode_option.value('none', _('None (default)'), _('Least secure. CSP disabled.'));
		csp_mode_option.value('strict', _('Strict'), _('Most secure setting compatible with OpenWRT default installs.'));
		csp_mode_option.value('permissive', _('Permissive'), _('Less secure than Strict, but better than None.<br>Use with integrations incompatible with Strict.'));
		csp_mode_option.value('custom', _('Custom'), _('For experts only.'));
		csp_mode_option.default = 'none';
		csp_mode_option.rmempty = false;

		const csp_policy_option = s.option(form.Value, 'csp_policy', _('Custom CSP Policy String'), _('The Content-Security-Policy header-value used in custom-mode.') + "<br />" + _(' WARNING: Wrong values for this setting can render the web-UI inaccessible and require recovery by SSH.'));
		csp_policy_option.default = "default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'trusted-types-eval'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://sysupgrade.openwrt.org;";

		csp_mode_option.onchange = function(ev, section_id, value) {
			const policy_element = csp_policy_option.getUIElement(section_id);
			const node = policy_element.node.querySelector('input');
			const isCustom = value === 'custom';
			if (isCustom) {
				node.removeAttribute('readonly', 'readonly');
			} else {
				node.setAttribute('readonly', 'readonly');
			}
		};

		return m.render();
	}
});
