'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('yggdrasil', 'Yggdrasil');

		s = m.section(form.TypedSection, "yggdrasil", _("Encryption keys")); 
		s.anonymous = true;

		s.option(form.Value, "EncryptionPublicKey", _("Encryption public key"));
		s.option(form.Value, "EncryptionPrivateKey", _("Encryption private key"),
			_("Keep this private. When compromised, generate a new keypair and IPv6."));
		s.option(form.Value, "SigningPublicKey", _("Signing public key"));
		s.option(form.Value, "SigningPrivateKey", _("Signing private key"),
			_("Keep this private. When compromised, generate a new keypair and IPv6."));

		return m.render();
	}
});
