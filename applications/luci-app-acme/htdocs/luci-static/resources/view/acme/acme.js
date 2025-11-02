'use strict';
'require form';
'require fs';
'require uci';
'require ui';
'require view';
"require view.dnsapi as dnsapi";

return view.extend({
	load() {
		return Promise.all([
			L.resolveDefault(fs.list('/etc/ssl/acme/'), []).then(files => {
				let certs = [];
				for (let f of files) {
					if (f.type == 'file' && f.name.match(/\.fullchain\.crt$/)) {
						certs.push(f);
					}
				}
				return certs;
			}),
			L.resolveDefault(fs.exec_direct('/usr/libexec/acmesh-dnsinfo.sh'), ''),
			L.resolveDefault(fs.list('/usr/lib/acme/client/dnsapi/'), null),
			L.resolveDefault(fs.lines('/proc/sys/kernel/hostname'), ''),
			L.resolveDefault(uci.load('ddns')),
		]);
	},

	render(data) {
		let certs = data[0];
		let dnsApiInfoText = data[1];
		let apiInfos = dnsapi.parseFile(dnsApiInfoText);
		let hasDnsApi = data[2] != null;
		let hostname = data[3];
		let systemDomain = _guessDomain(hostname);
		let ddnsDomains = _collectDdnsDomains();
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
				_("Cert files are stored in") + ' <em>/etc/ssl/acme</em>'+ '<br />' +
				'<a href="https://openwrt.org/docs/guide-user/services/tls/acmesh" target="_blank">' + _('See more') + '</a>'
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

		if (ddnsDomains && ddnsDomains.length > 0) {
			let ddnsDomainsList = ddnsDomains.map(d => d.domains[0]);
			o = s.option(form.Button, '_import_ddns');
			o.title = _('Found DDNS domains');
			o.inputtitle = _('Import') + ': ' + ddnsDomainsList.join();
			o.inputstyle = 'apply';
			o.onclick = function () {
				_importDdns(ddnsDomains);
			};
		}

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

		o = s.taboption('general', form.ListValue, 'validation_method', _('Validation method'),
			_('Standalone mode will use the built-in webserver of acme.sh to issue a certificate. ' +
				'Webroot mode will use an existing webserver to issue a certificate. ' +
				'DNS mode will allow you to use the DNS API of your DNS provider to issue a certificate.') + '<br />' +
			_('Validation via TLS ALPN') + ': ' + _('Validate via TLS port 443.') + '<br />' +
			'<a href="https://letsencrypt.org/docs/challenge-types/" target="_blank">' + _('See more') + '</a>'
		);
		o.value('standalone', 'HTTP-01' + _('Standalone'));
		o.value('webroot', 'HTTP-01' + _('Webroot Challenge Validation'));
		o.value('dns', 'DNS-01 ' + _('DNS Challenge Validation'));
		o.value('alpn', 'TLS-ALPN-01 ' + _('Validation via TLS ALPN'));
		o.default = 'standalone';

		if (!hasDnsApi) {
			let dnsApiPkg = 'acme-acmesh-dnsapi';
			o = s.taboption('general', form.Button, '_install');
			o.depends('validation_method', 'dns');
			o.title = _('Package is not installed');
			o.inputtitle = _('Install package %s').format(dnsApiPkg);
			o.inputstyle = 'apply';
			o.onclick = function () {
				let link = L.url('admin/system/package-manager') + '?query=' + dnsApiPkg;
				window.open(link, '_blank', 'noopener');
			};
		}

		o = s.taboption('general', form.Value, 'listen_port', _('Listen port'),
			_('Port where to listen for ACME challenge requests. The port will be temporarily open during validation.') + '<br />' +
			_('It may be needed to change if your web server is behind reverse proxy and uses a different port.') + '<br />' +
			_('Standalone') + ': ' + _('Default') + ' 80.' + '<br />' +
			_('Webroot Challenge Validation') + ': ' + _('To temporary open port you can specify your web server port e.g. 80.') + '<br />' +
			_('Validation via TLS ALPN') + ': ' + _('Default') + ' 443.'
		);
		o.optional = true;
		o.placeholder = '80';
		o.depends('validation_method', 'standalone');
		o.depends('validation_method', 'webroot');
		o.depends('validation_method', 'alpn');
		o.modalonly = true;

		o = s.taboption('general', form.DynamicList, "domains", _("Domain names"),
			_("Domain names to include in the certificate. " +
				"The first name will be the subject name, subsequent names will be alt names. " +
				"Note that all domain names must point at the router in the global DNS."));
		o.datatype = "list(string)";
		if (systemDomain) {
			o.default = [systemDomain];
		}
		o.validate = function (section_id, value) {
			if (!value) {
				return true;
			}
			if (!/^[*a-z0-9][a-z0-9.-]*$/.test(value)) {
				return _('Invalid domain. Allowed lowercase a-z, numbers and hyphen -');
			}
			if (value.startsWith('*')) {
				let method = this.section.children.filter(function (o) { return o.option == 'validation_method'; })[0].formvalue(section_id);
				if (method && method !== 'dns') {
					return _('wildcards * require Validation method: DNS');
				}
			}
			return true;
		};

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
		o.depends('validation_method', 'dns');
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

		o = s.taboption('challenge_dns', form.Value, 'dns_wait', _('Wait for DNS update'),
			_('Seconds to wait for a DNS record to be updated before continue.') + '<br />' +
			'<a href="https://github.com/acmesh-official/acme.sh/wiki/dnssleep" target="_blank">' + _('See more') + '</a>'
		);
		o.depends('validation_method', 'dns');
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
			_('Use a custom CA instead of Let\'s Encrypt.') +	' ' + _('Custom ACME server directory URL.') + '<br />' +
			'<a href="https://github.com/acmesh-official/acme.sh/wiki/Server" target="_blank">' + _('See more') + '</a>' + '<br />'
			+ _('Default') + ' <code>letsencrypt</code>'
		);
		o.placeholder = "https://api.buypass.com/acme/directory";
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Flag, 'staging', _('Use staging server'),
			_(
				'Get certificate from the Letsencrypt staging server ' +
				'(use for testing; the certificate won\'t be valid).'
			)
		);
		o.depends('acme_server', '');
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'days', _('Days until renewal'));
		o.optional    = true;
		o.placeholder = 'acme.sh default (60 days)';
		o.datatype    = 'uinteger';
		o.modalonly = true;


		s = m.section(form.GridSection, '_certificates');

		s.render = L.bind(_renderCerts, this, certs);

		return m.render();
	}
});

/**
 * Is not an IP or a local domain without TLD
 */
function _isFqdn(domain) {
	let i = domain.lastIndexOf('.');
	if (i < 0) {
		return false;
	}
	let tld = domain.substr(i + 1);
	if (tld.length < 2) {
		return false;
	}
	return /^[a-z0-9]+$/.test(tld);
}

function _guessDomain(hostname) {
	return _isFqdn(hostname) ? hostname : (_isFqdn(window.location.hostname) ? window.location.hostname : '');
}

function _collectDdnsDomains() {
	let ddnsDomains = [];
	let ddnsServices = uci.sections('ddns', 'service');
	for (let ddnsService of ddnsServices) {
		let dnsApi = '';
		let credentials = [];
		switch (ddnsService.service_name) {
			case 'duckdns.org':
				dnsApi = 'dns_duckdns';
				credentials = [
					'DuckDNS_Token=' + ddnsService['password'],
				];
				break;
			case 'dynv6.com':
				dnsApi = 'dns_dynv6';
				credentials = [
					'DYNV6_TOKEN=' + ddnsService['password'],
				];
				break;
			case 'afraid.org-v2-basic':
				dnsApi = 'dns_freedns';
				credentials = [
					'FREEDNS_User=' + ddnsService['username'],
					'FREEDNS_Password=' + ddnsService['password'],
				];
				break;
			case 'cloudflare.com-v4':
				dnsApi = 'dns_cf';
				credentials = [
					'CF_Token=' + ddnsService['password'],
				];
				break;
		}
		if (credentials.length > 0) {
			ddnsDomains.push({
				sectionId: ddnsService['.name'],
				domains: [ddnsService['domain'], ddnsService['domain']],
				dnsApi: dnsApi,
				credentials: credentials,
			});
		}
	}
	return ddnsDomains;
}

function _importDdns(ddnsDomains) {
	let certSections = uci.sections('acme', 'cert');
	let certSectionNames = new Map();
	let certSectionDomains = new Map();
	for (let s of certSections) {
		certSectionNames.set(s['.name'], null);
		if (s.domains) {
			for (let d of s.domains) {
				certSectionDomains.set(d, s['.name']);
			}
		}
	}
	let importedDomains = {};
	let importedErrors = [];
	for (let ddnsDomain of ddnsDomains) {
		let sectionId = ddnsDomain.sectionId;
		// ensure unique sectionId
		if (certSectionNames.has(sectionId)) {
			sectionId += '_' + new Date().getTime();
		}
		if (ddnsDomain.domains) {
			for (let d of ddnsDomain.domains) {
				let dupDomainSection = certSectionDomains.get(d);
				if (dupDomainSection) {
					let errorText = _('The domain %s in DDNS %s is already configured in %s. Please check it after the importing.')
						.format(d, sectionId, dupDomainSection);
					importedErrors.push(errorText);
				}
			}
		}
		importedDomains[sectionId] = {
			'domains': ddnsDomain.domains,
			'validation_method': 'dns',
			'dns': ddnsDomain.dnsApi,
			'credentials': ddnsDomain.credentials,
		};
	}
	ui.showModal(_('Check the configurations of the added domain certificates'), [
		E('p', JSON.stringify(importedDomains, null, 2)),
		E('p', importedErrors.join('<br />')),
		E('div', { 'class': 'right' }, [
			E('button', {
				'class': 'btn cbi-button',
				'click': ui.hideModal
			}, _('Cancel')),
			' ',
			E('button', {
				'class': 'btn cbi-button-action',
				'click': ui.createHandlerFn(this, function (ev) {
					for (let [sectionId, opts] of Object.entries(importedDomains)) {
						uci.add('acme', 'cert', sectionId);
						for (let [key, val] of Object.entries(opts)) {
							uci.set('acme', sectionId, key, val);
						}
					}
					uci.save().then(() => window.location.reload());
				})
			}, _('Save'))
		])
	]);
}

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
		let domain = cert.name.replace(/\.fullchain\.crt$/, '');
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
