'use strict';
'require form';
'require fs';
'require uci';
'require view';
"require view.dnsapi as dnsapi";

return view.extend({
	load() {
		return Promise.all([
			L.resolveDefault(fs.list('/etc/ssl/acme/'), []).then(files => {
				let certs = [];
				for (let f of files) {
					if (f.type == 'file' && f.name.match(/\.key$/)) {
						certs.push(f);
					}
				}
				return certs;
			}),
			L.resolveDefault(fs.exec_direct('/usr/libexec/acmesh-dnsinfo.sh'), ''),
		]);
	},

	render(data) {
		let certs = data[0];
		let dnsApiInfoText = data[1];
		let apiInfos = dnsapi.parseFile(dnsApiInfoText);

		let wikiUrl = 'https://github.com/acmesh-official/acme.sh/wiki/';
		let wikiInstructionUrl = wikiUrl + 'dnsapi';
		let m, s, o;

		m = new form.Map("acme", _("ACME certificates"),
			_("This configures ACME (Letsencrypt) automatic certificate installation. " +
				"Simply fill out this to have the router configured with Letsencrypt-issued " +
				"certificates for the web interface. " +
				"Note that the domain names in the certificate must already be configured to " +
				"point at the router's public IP address. " +
				"Once configured, issuing certificates can take a while. " +
				"Check the logs for progress and any errors.") + '<br/>' +
				_("Cert files are stored in") + ' <em>/etc/ssl/acme<em>'
		);

		s = m.section(form.TypedSection, "acme", _("ACME global config"));
		s.anonymous = true;

		o = s.option(form.Value, "account_email", _("Account email"),
			_('Email address to associate with account key.') + '<br/>' +
			_('If a certificate wasn\'t renewed in time then you\'ll receive a notice at 20 days before expiry.')
		);
		o.rmempty = false;
		o.datatype = "minlength(1)";

		o = s.option(form.Flag, "debug", _("Enable debug logging"));
		o.rmempty = false;

		s = m.section(form.GridSection, "cert", _("Certificate config"));
		s.anonymous = false;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.tab("general", _("General Settings"));
		o = s.tab('challenge_webroot', _('Webroot Challenge Validation'));
		o = s.tab('challenge_dns', _('DNS Challenge Validation'));
		o = s.tab("advanced", _('Advanced Settings'));

		o = s.taboption('general', form.Flag, "enabled", _("Enabled"));
		o.rmempty = false;

		o = s.taboption('general', form.DynamicList, "domains", _("Domain names"),
			_("Domain names to include in the certificate. " +
				"The first name will be the subject name, subsequent names will be alt names. " +
				"Note that all domain names must point at the router in the global DNS."));
		o.datatype = "list(string)";

		o = s.taboption('general', form.ListValue, 'validation_method', _('Validation method'),
			_("Standalone mode will use the built-in webserver of acme.sh to issue a certificate. " +
			"Webroot mode will use an existing webserver to issue a certificate. " +
			"DNS mode will allow you to use the DNS API of your DNS provider to issue a certificate."));
		o.value("standalone", _("Standalone"));
		o.value("webroot", _("Webroot"));
		o.value("dns", _("DNS"));
		o.default = 'webroot';

		o = s.taboption('challenge_webroot', form.Value, 'webroot', _('Webroot directory'),
			_("Webserver root directory. Set this to the webserver " +
				"document root to run Acme in webroot mode. The web " +
				"server must be accessible from the internet on port 80.") + '<br/>' +
			_("Default") + " <em>/var/run/acme/challenge/</em>"
		);
		o.optional = true;
		o.depends("validation_method", "webroot");
		o.modalonly = true;

		o = s.taboption('challenge_dns', form.ListValue, 'dns', _('DNS API'),
			_("To use DNS mode to issue certificates, set this to the name of a DNS API supported by acme.sh. " +
				"See https://github.com/acmesh-official/acme.sh/wiki/dnsapi for the list of available APIs. " +
				"In DNS mode, the domain name does not have to resolve to the router IP. " +
				"DNS mode is also the only mode that supports wildcard certificates. " +
				"Using this mode requires the acme-dnsapi package to be installed."));
		o.depends("validation_method", "dns");
		// List of supported DNS API. Names are same as file names in acme.sh for easier search.
		// May be outdated but not changed too often.
		o.value('', '');
		for (let info of apiInfos) {
			let title = info.Name;
			if (info.Domains) {
				title += ' (' + info.Domains + ')';
			}
			o.value(info.Id, title);
		}
		o.modalonly = true;
		o.onchange = _handleCheckService;

		o = s.taboption('challenge_dns', form.DummyValue, '_wiki_url', _('See instructions'), '');
		o.rawhtml = true;
		o.default = '<a id="wikiInstructionUrl" href="%s" target="_blank" rel="noreferrer">Acme Wiki DNS API</a>'
			.format(wikiInstructionUrl);
		o.depends('validation_method', 'dns');
		o.modalonly = true;

		o = s.taboption('challenge_dns', form.Flag, '_dns_options_alt', _('Alternative DNS API options'), '');
		o.modalonly = true;

		for (let info of apiInfos) {
			if (info.OptsTitle) {
				o = s.taboption('challenge_dns', form.DummyValue, '_dns_OptsTitle_' + info.Id, ' ', '');
				o.default = info.OptsTitle;
				o.depends({'dns': info.Id, '_dns_options_alt': '0'});
				o.modalonly = true;
			}
			for (let opt of info.Opts) {
				_addDnsProviderField(s, info.Id, opt, false);
			}
			if (info.OptsAltTitle) {
				o = s.taboption('challenge_dns', form.DummyValue, '_dns_OptsAltTitle_' + info.Id, ' ', '');
				o.default = info.OptsAltTitle;
				o.depends({'dns': info.Id, '_dns_options_alt': '1'});
				o.modalonly = true;
			}
			for (let opt of info.OptsAlt) {
				_addDnsProviderField(s, info.Id, opt, true);
			}
		}

		o = s.taboption('challenge_dns', form.DynamicList, 'credentials', _('DNS API credentials'),
			_("The credentials for the DNS API mode selected above. " +
				"See https://github.com/acmesh-official/acme.sh/wiki/dnsapi for the format of credentials required by each API. " +
				"Add multiple entries here in KEY=VAL shell variable format to supply multiple credential variables."));
		o.datatype = "list(string)";
		o.depends("validation_method", "dns");
		o.modalonly = true;

		o = s.taboption('challenge_dns', form.Value, 'calias', _('Challenge Alias'),
			_("The challenge alias to use for ALL domains. " +
				"See https://github.com/acmesh-official/acme.sh/wiki/DNS-alias-mode for the details of this process. " +
				"LUCI only supports one challenge alias per certificate."));
		o.depends("validation_method", "dns");
		o.modalonly = true;

		o = s.taboption('challenge_dns', form.Value, 'dalias', _('Domain Alias'),
			_("The domain alias to use for ALL domains. " +
				"See https://github.com/acmesh-official/acme.sh/wiki/DNS-alias-mode for the details of this process. " +
				"LUCI only supports one challenge domain per certificate."));
		o.depends("validation_method", "dns");
		o.modalonly = true;


		o = s.taboption('advanced', form.Flag, 'staging', _('Use staging server'),
			_(
				'Get certificate from the Letsencrypt staging server ' +
				'(use for testing; the certificate won\'t be valid).'
			)
		);
		o.rmempty = false;
		o.modalonly = true;

		o = s.taboption('advanced', form.ListValue, 'key_type', _('Key type'),
			_('Key size (and type) for the generated certificate.')
		);
		o.value('rsa2048', _('RSA 2048 bits'));
		o.value('rsa3072', _('RSA 3072 bits'));
		o.value('rsa4096', _('RSA 4096 bits'));
		o.value('ec256', _('ECC 256 bits'));
		o.value('ec384', _('ECC 384 bits'));
		o.rmempty = false;
		o.optional = true;
		o.modalonly = true;
		o.cfgvalue = function(section_id) {
			let keylength = uci.get('acme', section_id, 'keylength');
			if (keylength) {
				// migrate the old keylength to a new keytype
				switch (keylength) {
					case '2048': return 'rsa2048';
					case '3072': return 'rsa3072';
					case '4096': return 'rsa4096';
					case 'ec-256': return 'ec256';
					case 'ec-384': return 'ec384';
					default: return ''; // bad value
				}
			}
			return this.super('cfgvalue', arguments);
		};
		o.write = function(section_id, value) {
			// remove old keylength
			uci.unset('acme', section_id, 'keylength');
			uci.set('acme', section_id, 'key_type', value);
		};

		o = s.taboption('advanced', form.Value, "acme_server", _("ACME server URL"),
			_('Use a custom CA instead of Let\'s Encrypt.') +	' ' + _('Custom ACME server directory URL.'));
		o.depends("staging", "0");
		o.placeholder = "https://api.buypass.com/acme/directory";
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'days', _('Days until renewal'));
		o.optional    = true;
		o.placeholder = 90;
		o.datatype    = 'uinteger';
		o.modalonly = true;


		s = m.section(form.GridSection, '_certificates');

		s.render = L.bind(_renderCerts, this, certs);

		return m.render();
	}
});


function _addDnsProviderField(s, apiId, opt, isOptsAlt) {
	let desc = '<code>' + opt.Name + '</code> ' + opt.Description;
	if (opt.Default) {
		desc += '<br />' + _('Default')  + ' <code>' + opt.Default + '</code>';
	}
	let optionName = '_credentials_' + opt.Name;
	if (isOptsAlt) {
		optionName += '_OptsAlt'
	}
	let o = s.taboption('challenge_dns', form.Value, optionName, opt.Title, desc);
	o.depends({'dns': apiId, '_dns_options_alt': isOptsAlt ? '1' : '0'});
	o.modalonly = true;
	o.placeholder = opt.Default;
	o.cfgvalue = function (section_id) {
		let creds = this.map.data.get(this.map.config, section_id, 'credentials');
		return _extractParamValue(creds, opt.Name);
	};
	o.write = function (section_id, value) { };
	o.onchange = _handleEditChange;
	return o;
}

function _handleEditChange(event, section_id, newVal) {
	// Add the provider field value directly to the credentials DynList
	let credentialsDynList = this.map.lookupOption('credentials', section_id)[0].getUIElement(section_id);
	let creds = credentialsDynList.getValue();
	let credsMap = _parseKeyValueListToMap(creds);
	let optName = this.option.substring('_credentials_'.length);
	optName = optName.replace(/_OptsAlt$/, '');
	if (newVal) {
		credsMap.set(optName, newVal);
	} else {
		credsMap.delete(optName);
	}
	let newCreds = [];
	for (let [key, val] of credsMap) {
		newCreds.push(key + '="' + val + '"');
	}
	credentialsDynList.setValue(newCreds);
}

/**
 * @param {string[]} paramsKeyVals
 * @param {string} paramName
 * @returns {string}
 */
function _extractParamValue(paramsKeyVals, paramName) {
	let map = _parseKeyValueListToMap(paramsKeyVals)
	return map.get(paramName) || '';
}

/**
 * @param {string[]} paramsKeyVals
 * @returns {Map}
 */
function _parseKeyValueListToMap(paramsKeyVals) {
	let map = new Map();
	if (!paramsKeyVals) {
		return map;
	}
	for (let paramKeyVal of paramsKeyVals) {
		let pos = paramKeyVal.indexOf("=");
		if (pos < 0) {
			continue;
		}
		let name = paramKeyVal.slice(0, pos);
		let unquotedVal = paramKeyVal.slice(pos + 2, paramKeyVal.length - 1);
		map.set(name, unquotedVal);
	}
	return map;
}

function _handleCheckService(event, section_id, newVal) {
	document.getElementById('wikiInstructionUrl').href = 'https://github.com/acmesh-official/acme.sh/wiki/dnsapi#' + newVal;
}

function _renderCerts(certs) {
	let table = E('table', {'class': 'table cbi-section-table', 'id': 'certificates_table'}, [
		E('tr', {'class': 'tr table-titles'}, [
			E('th', {'class': 'th'}, _('Main Domain')),
			E('th', {'class': 'th'}, _('Private Key')),
			E('th', {'class': 'th'}, _('Public Certificate')),
			E('th', {'class': 'th'}, _('Issued on')),
		])
	]);

	let rows = certs.map(function (cert) {
		let domain = cert.name.substring(0, cert.name.length - 4);
		let issueDate = new Date(cert.mtime * 1000).toLocaleDateString();
		return [
			domain,
			'/etc/ssl/acme/' + domain + '.key',
			'/etc/ssl/acme/' + domain + '.fullchain.crt',
			issueDate,
		];
	});

	cbi_update_table(table, rows);

	return E('div', {'class': 'cbi-section cbi-tblsection'}, [
		E('h3', _('Certificates')), table]);
}
