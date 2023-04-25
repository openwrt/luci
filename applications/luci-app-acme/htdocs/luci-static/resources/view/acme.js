'use strict';
'require form';
'require fs';
'require view';

return view.extend({
	load: function () {
		return Promise.all([
			L.resolveDefault(fs.stat('/usr/sbin/nginx'), {}),
			L.resolveDefault(fs.stat('/usr/sbin/uhttpd'), {})
		]);
	},

	render: function (stats) {
		var m, s, o;

		m = new form.Map("acme", _("ACME certificates"),
			_("This configures ACME (Letsencrypt) automatic certificate installation. " +
				"Simply fill out this to have the router configured with Letsencrypt-issued " +
				"certificates for the web interface. " +
				"Note that the domain names in the certificate must already be configured to " +
				"point at the router's public IP address. " +
				"Once configured, issuing certificates can take a while. " +
				"Check the logs for progress and any errors."));

		s = m.section(form.TypedSection, "acme", _("ACME global config"));
		s.anonymous = true;

		o = s.option(form.Value, "account_email", _("Account email"),
			_("Email address to associate with account key."))
		o.rmempty = false;
		o.datatype = "minlength(1)";

		o = s.option(form.Flag, "debug", _("Enable debug logging"));
		o.rmempty = false;

		s = m.section(form.GridSection, "cert", _("Certificate config"))
		s.anonymous = false;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.tab("general", _("General Settings"));
		o = s.tab("challenge", _("Challenge Validation"));
		o = s.tab("advanced", _('Advanced Settings'));

		o = s.taboption('general', form.Flag, "enabled", _("Enabled"));
		o.rmempty = false;

		o = s.taboption('general', form.Flag, "use_staging", _("Use staging server"),
			_("Get certificate from the Letsencrypt staging server " +
				"(use for testing; the certificate won't be valid)."));
		o.rmempty = false;
		o.modalonly = true;

		o = s.taboption('general', form.ListValue, "keylength", _("Key size"),
			_("Key size (and type) for the generated certificate."));
		o.value("2048", _("RSA 2048 bits"));
		o.value("3072", _("RSA 3072 bits"));
		o.value("4096", _("RSA 4096 bits"));
		o.value("ec-256", _("ECC 256 bits"));
		o.value("ec-384", _("ECC 384 bits"));
		o.default = "2048";
		o.rmempty = false;

		o = s.taboption('general', form.DynamicList, "domains", _("Domain names"),
			_("Domain names to include in the certificate. " +
				"The first name will be the subject name, subsequent names will be alt names. " +
				"Note that all domain names must point at the router in the global DNS."));
		o.datatype = "list(string)";

		if (stats[1].type === 'file') {
			o = s.taboption('general', form.Flag, "update_uhttpd", _("Use for uhttpd"),
				_("Update the uhttpd config with this certificate once issued " +
					"(only select this for one certificate). " +
					"Is also available luci-app-uhttpd to configure uhttpd form the LuCI interface."));
			o.rmempty = false;
			o.modalonly = true;
		}

		if (stats[0].type === 'file') {
			o = s.taboption('general', form.Flag, "update_nginx", _("Use for nginx"),
				_("Update the nginx config with this certificate once issued " +
					"(only select this for one certificate). " +
					"Nginx must support ssl, if not it won't start as it needs to be " +
					"compiled with ssl support to use cert options"));
			o.rmempty = false;
			o.modalonly = true;
		}

		o = s.taboption('challenge', form.ListValue, "validation_method", _("Validation method"),
			_("Standalone mode will use the built-in webserver of acme.sh to issue a certificate. " +
			"Webroot mode will use an existing webserver to issue a certificate. " +
			"DNS mode will allow you to use the DNS API of your DNS provider to issue a certificate."));
		o.value("standalone", _("Standalone"));
		o.value("webroot", _("Webroot"));
		o.value("dns", _("DNS"));
		o.default = "standalone";

		o = s.taboption('challenge', form.Value, "webroot", _("Webroot directory"),
			_("Webserver root directory. Set this to the webserver " +
				"document root to run Acme in webroot mode. The web " +
				"server must be accessible from the internet on port 80."));
		o.optional = true;
		o.depends("validation_method", "webroot");
		o.modalonly = true;

		o = s.taboption('challenge', form.Value, "dns", _("DNS API"),
			_("To use DNS mode to issue certificates, set this to the name of a DNS API supported by acme.sh. " +
				"See https://github.com/acmesh-official/acme.sh/wiki/dnsapi for the list of available APIs. " +
				"In DNS mode, the domain name does not have to resolve to the router IP. " +
				"DNS mode is also the only mode that supports wildcard certificates. " +
				"Using this mode requires the acme-dnsapi package to be installed."));
		o.depends("validation_method", "dns");
		o.modalonly = true;

		o = s.taboption('challenge', form.DynamicList, "credentials", _("DNS API credentials"),
			_("The credentials for the DNS API mode selected above. " +
				"See https://github.com/acmesh-official/acme.sh/wiki/dnsapi for the format of credentials required by each API. " +
				"Add multiple entries here in KEY=VAL shell variable format to supply multiple credential variables."))
		o.datatype = "list(string)";
		o.depends("validation_method", "dns");
		o.modalonly = true;

		o = s.taboption('challenge', form.Value, "calias", _("Challenge Alias"),
			_("The challenge alias to use for ALL domains. " +
				"See https://github.com/acmesh-official/acme.sh/wiki/DNS-alias-mode for the details of this process. " +
				"LUCI only supports one challenge alias per certificate."));
		o.depends("validation_method", "dns");
		o.modalonly = true;

		o = s.taboption('challenge', form.Value, "dalias", _("Domain Alias"),
			_("The domain alias to use for ALL domains. " +
				"See https://github.com/acmesh-official/acme.sh/wiki/DNS-alias-mode for the details of this process. " +
				"LUCI only supports one challenge domain per certificate."));
		o.depends("validation_method", "dns");
		o.modalonly = true;

		o = s.taboption('advanced', form.Flag, "use_acme_server",
			_("Custom ACME CA"), _("Use a custom CA instead of Let's Encrypt."));
		o.depends("use_staging", "0");
		o.default = false;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, "acme_server", _("ACME server URL"),
			_("Custom ACME server directory URL."));
		o.depends("use_acme_server", "1");
		o.placeholder = "https://api.buypass.com/acme/directory";
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'days', _('Days until renewal'));
		o.optional    = true;
		o.placeholder = 90;
		o.datatype    = 'uinteger';

		return m.render()
	}
})

