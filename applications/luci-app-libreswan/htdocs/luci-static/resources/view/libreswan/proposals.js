'use strict';
'require view';
'require ui';
'require form';
'require uci';

return view.extend({
	render: function() {
		let m, s, o;

		m = new form.Map('libreswan', _('IPSec Proposals'));

		s = m.section(form.GridSection, 'crypto_proposal');
		s.anonymous = false;
		s.addremove = true;
		s.nodescriptions = true;
		s.addbtntitle = _('Add Proposal');

		s.renderSectionAdd = function(extra_class) {
			var el = form.GridSection.prototype.renderSectionAdd.apply(this, arguments),
				nameEl = el.querySelector('.cbi-section-create-name');
			ui.addValidator(nameEl, 'uciname', true, function(v) {
				let sections = [
					...uci.sections('libreswan', 'crypto_proposal'),
					...uci.sections('libreswan', 'tunnel'),
				];
				if (sections.find(function(s) {
					return s['.name'] == v;
				})) {
					return _('This may not share the same name as other proposals or configured tunnels.');
				}
				if (v.length > 15) return _('Name length shall not exceed 15 characters');
				return true;
			}, 'blur', 'keyup');
			return el;
		};

		o = s.tab('general', _('General'));

		o = s.taboption('general', form.MultiValue, 'hash_algorithm', _('Hash Algorithm'), ('* = %s').format(_('Unsafe')));
		o.default = 'md5';
		o.value('md5', _('MD5*'));
		o.value('sha1', _('SHA1*'));
		o.value('sha256', _('SHA256'));
		o.value('sha384', _('SHA384'));
		o.value('sha512', _('SHA512'));

		o = s.taboption('general', form.MultiValue, 'encryption_algorithm', _('Encryption Method'), ('* = %s').format(_('Unsafe')));
		o.default = 'aes';
		o.value('3des', _('3DES*'))
		o.value('aes', _('AES'))
		o.value('aes_ctr', _('AES_CTR'));
		o.value('aes_cbc', _('AES_CBC'));
		o.value('aes128', _('AES128'));
		o.value('aes192', _('AES192'));
		o.value('aes256', _('AES256'));
		o.value('camellia_cbc', _('CAMELLIA_CBC'));

		o = s.taboption('general', form.MultiValue, 'dh_group', _('DH Group'),
			('* = %s <a href="%s">RFC8247</a>.').format(_('Unsafe, See'), 'https://www.rfc-editor.org/rfc/rfc8247#section-2.4'));
		o.default = 'modp1536';
		o.value('modp1536', _('DH Group 5*'));
		o.value('modp2048', _('DH Group 14'));
		o.value('modp3072', _('DH Group 15'));
		o.value('modp4096', _('DH Group 16'));
		o.value('modp6144', _('DH Group 17'));
		o.value('modp8192', _('DH Group 18'));
		o.value('dh19', _('DH Group 19'));
		o.value('dh20', _('DH Group 20'));
		o.value('dh21', _('DH Group 21'));
		o.value('dh22', _('DH Group 22*'));
		o.value('dh31', _('DH Group 31'));

		return m.render();
	}
});
