'use strict';
'require form';
'require fs';
'require uci';
'require view';

return view.extend({
	load: function() {
		return L.resolveDefault(fs.list('/etc/ssl/acme/'), []).then(function(entries) {
			var certs = [];
			for (var i = 0; i < entries.length; i++) {
				if (entries[i].type == 'file' && entries[i].name.match(/\.key$/)) {
					certs.push(entries[i]);
				}
			}
			return certs;
		});
	},

	render: function (certs) {
		let wikiUrl = 'https://github.com/acmesh-official/acme.sh/wiki/';
		var wikiInstructionUrl = wikiUrl + 'dnsapi';
		var m, s, o;

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
		)
		o.rmempty = false;
		o.datatype = "minlength(1)";

		o = s.option(form.Flag, "debug", _("Enable debug logging"));
		o.rmempty = false;

		s = m.section(form.GridSection, "cert", _("Certificate config"))
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
		o.value('', '')
		o.value('dns_acmedns', 'ACME DNS API github.com/joohoi/acme-dns');
		o.value('dns_acmeproxy', 'ACME Proxy github.com/mdbraber/acmeproxy');
		o.value('dns_1984hosting', '1984.is');
		o.value('dns_active24', 'Active24.com');
		o.value('dns_ad', 'Alwaysdata.com');
		o.value('dns_ali', 'Alibaba Cloud Aliyun.com');
		o.value('dns_anx', 'Anexia.com');
		o.value('dns_arvan', 'ArvanCloud.ir');
		o.value('dns_aurora', 'AuroraDNS.eu');
		o.value('dns_autodns', 'autoDNS (InternetX)');
		o.value('dns_aws', 'Amazon AWS Route53');
		o.value('dns_azion', 'Azion.com');
		o.value('dns_azure', 'Azure');
		o.value('dns_bunny', 'Bunny.net');
		o.value('dns_cf', 'CloudFlare.com');
		o.value('dns_clouddns', 'CloudDNS vshosting.cz');
		o.value('dns_cloudns', 'ClouDNS.net');
		o.value('dns_cn', 'Core-Networks.de');
		o.value('dns_conoha', 'ConoHa.io');
		o.value('dns_constellix', 'constellix.com');
		o.value('dns_cpanel', 'CPanel');
		o.value('dns_curanet', 'curanet.dk scannet.dk wannafind.dk dandomain.dk');
		o.value('dns_cyon', 'cayon.ch');
		o.value('dns_da', 'DirectAdmin Panel');
		o.value('dns_ddnss', 'DDNSS.de');
		o.value('dns_desec', 'deSEC.io');
		o.value('dns_df', 'DynDnsFree.de');
		o.value('dns_dgon', 'DigitalOcean.com');
		o.value('dns_dnshome', 'dnsHome.de');
		o.value('dns_dnsimple', 'DNSimple.com');
		o.value('dns_dnsservices', 'dns.services');
		o.value('dns_doapi', 'Domain-Offensive do.de');
		o.value('dns_domeneshop', 'DomeneShop.no');
		o.value('dns_dp', 'DNSPod.cn');
		o.value('dns_dpi', 'DNSPod.com');
		o.value('dns_dreamhost', 'DreamHost.com');
		o.value('dns_duckdns', 'DuckDNS.org');
		o.value('dns_durabledns', 'DurableDNS.com');
		o.value('dns_dyn', 'Dyn.com');
		o.value('dns_dynu', 'Dynu.com');
		o.value('dns_dynv6', 'DynV6.com');
		o.value('dns_easydns', 'EasyDNS.net');
		o.value('dns_edgedns', 'Akamai Edge DNS');
		o.value('dns_euserv', 'euserv.eu');
		o.value('dns_exoscale', 'Exoscale.com');
		o.value('dns_fornex', 'fornex.com');
		o.value('dns_freedns', 'FreeDNS.afraid.org');
		o.value('dns_gandi_livedns', 'LiveDNS.Gandi.net');
		// o.value('dns_gcloud', 'Google Cloud gcloud client');
		o.value('dns_gcore', 'Gcore.com');
		o.value('dns_gd', 'GoDaddy.com');
		o.value('dns_geoscaling', 'Geoscaling.com');
		o.value('dns_googledomains', 'Google Domains');
		o.value('dns_he', 'he.net');
		o.value('dns_hetzner', 'Hetzner.com');
		o.value('dns_hexonet', 'Hexonet.net');
		o.value('dns_hostingde', 'Hosting.de');
		o.value('dns_huaweicloud', 'MyHuaweiCloud.com');
		o.value('dns_infoblox', 'Infoblox');
		o.value('dns_infomaniak', 'InfoManiak.com');
		o.value('dns_internetbs', 'InternetBS.net');
		o.value('dns_inwx', 'inwx.de');
		o.value('dns_ionos', 'IONOS.com');
		o.value('dns_ipv64', 'ipv64.net');
		o.value('dns_ispconfig', 'ISPConfig Server');
		o.value('dns_jd', 'JDCloud.com');
		o.value('dns_joker', 'Joker.com');
		o.value('dns_kappernet', 'kapper.net');
		o.value('dns_kas', 'kasserver.com');
		o.value('dns_kinghost', 'KingHost.net');
		o.value('dns_la', 'dns.la');
		o.value('dns_leaseweb', 'leaseweb.com');
		// o.value('dns_lexicon', 'Lexicon client');
		o.value('dns_linode_v4', 'Linode.com');
		o.value('dns_loopia', 'Loopia.se');
		o.value('dns_lua', 'LuaDNS.com');
		// o.value('dns_maradns', 'MaraDNS Server zone file');
		o.value('dns_me', 'DNSMadeEasy.com');
		// o.value('dns_miab', 'Mail-in-a-Box Server API');
		o.value('dns_misaka', 'misaka.io');
		o.value('dns_mydevil', 'MyDevil.net');
		o.value('dns_mydnsjp', 'MyDNS.JP');
		o.value('dns_mythic_beasts', 'Mythic-Beasts.com');
		o.value('dns_namecheap', 'NameCheap.com');
		o.value('dns_namecom', 'Name.com');
		o.value('dns_namesilo', 'NameSilo.com');
		o.value('dns_nanelo', 'Nanelo.com');
		o.value('dns_nederhost', 'NederHost.nl');
		o.value('dns_neodigit', 'Neodigit.net');
		o.value('dns_netcup', 'netcup.eu netcup.de');
		o.value('dns_netlify', 'Netlify.com');
		o.value('dns_nic', 'nic.ru');
		o.value('dns_njalla', 'Njalla njal.la');
		o.value('dns_nm', 'NameMaster.de');
		// o.value('dns_nsd', 'NSD Server zone file');
		o.value('dns_nsone', 'NS1 nsone.net');
		o.value('dns_nsupdate', 'nsupdate (RFC2136) Server');
		o.value('dns_nw', 'Nexcess.net');
		o.value('dns_oci', 'Oracle Cloud Infrastructure (OCI)');
		o.value('dns_one', 'one.com');
		o.value('dns_online', 'online.net');
		o.value('dns_openprovider', 'OpenProvider.com');
		// o.value('dns_openstack', 'OpenStack Client');
		o.value('dns_opnsense', 'OPNsense Bind API');
		o.value('dns_ovh', 'OVH ovh.com ovhcloud.com kimsufi.com soyoustart.com');
		o.value('dns_pdns', 'PowerDNS Server');
		o.value('dns_pleskxml', 'plesk.com XML API');
		o.value('dns_pointhq', 'PointDNS pointhq.com');
		o.value('dns_porkbun', 'Porkbun.com');
		o.value('dns_rackcorp', 'RackCorp.com');
		o.value('dns_rackspace', 'RackSpace rackspacecloud.com');
		o.value('dns_rage4', 'rage4.com');
		o.value('dns_rcode0', 'Rcode0 rcodezero.at');
		o.value('dns_regru', 'Reg.ru');
		o.value('dns_scaleway', 'Scaleway.com');
		o.value('dns_schlundtech', 'Schlundtech.de');
		o.value('dns_selectel', 'Selectel.ru');
		o.value('dns_selfhost', 'selfhost.de');
		o.value('dns_servercow', 'servercow.de');
		o.value('dns_simply', 'Simply.com');
		o.value('dns_tele3', 'tele3.cz');
		o.value('dns_transip', 'transip.nl');
		o.value('dns_udr', 'ud-reselling.com');
		o.value('dns_ultra', 'UltraDNS.com');
		o.value('dns_variomedia', 'variomedia.de');
		o.value('dns_veesp', 'veesp.com');
		o.value('dns_vercel', 'Vercel.com');
		o.value('dns_vscale', 'vscale.io');
		o.value('dns_vultr', 'vultr.com');
		o.value('dns_websupport', 'websupport.sk');
		o.value('dns_world4you', 'World4You.com');
		o.value('dns_yandex', 'Yandex DNS dns.yandex.ru');
		o.value('dns_yc', 'Yandex Cloud cloud.yandex.net');
		o.value('dns_zilore', 'zilore.com');
		o.value('dns_zone', 'Zone.ee');
		o.value('dns_zonomi', 'Zonomi.com');
		o.modalonly = true;
		o.onchange = L.bind(_handleCheckService, o, s);

		o = s.taboption('challenge_dns', form.DummyValue, '_wiki_url', _('See instructions'), '');
		o.rawhtml = true;
		o.default = '<a id="wikiInstructionUrl" href="%s" target="_blank" rel="noreferrer">Acme Wiki DNS API</a>'
			.format(wikiInstructionUrl);
		o.depends('validation_method', 'dns');
		o.modalonly = true;

		_addDnsProviderField(s, 'dns_1984hosting', 'One984HOSTING_Username', '1984.is Username', '');
		_addDnsProviderField(s, 'dns_1984hosting', 'One984HOSTING_Password', '1984.is Password', '');

		_addDnsProviderField(s, 'dns_acmedns', 'ACMEDNS_BASE_URL', 'ACMEDNS URL', '');
		_addDnsProviderField(s, 'dns_acmedns', 'ACMEDNS_USERNAME', 'ACMEDNS User', '');
		_addDnsProviderField(s, 'dns_acmedns', 'ACMEDNS_PASSWORD', 'ACMEDNS Password', '');
		_addDnsProviderField(s, 'dns_acmedns', 'ACMEDNS_SUBDOMAIN', 'ACMEDNS Subdomain', '');

		_addDnsProviderField(s, 'dns_ali', 'Ali_Key', 'Ali Key', '');
		_addDnsProviderField(s, 'dns_ali', 'Ali_Secret', 'Ali Secret', '');

		_addDnsProviderField(s, 'dns_aws', 'AWS_ACCESS_KEY_ID', 'AWS access key id', '');
		_addDnsProviderField(s, 'dns_aws', 'AWS_SECRET_ACCESS_KEY', 'AWS secret access key', '');

		_addDnsProviderField(s, 'dns_azure', 'AZUREDNS_SUBSCRIPTIONID', 'Azure Subscription ID', '');
		_addDnsProviderField(s, 'dns_azure', 'AZUREDNS_TENANTID', 'Azure Tenant ID', '');
		_addDnsProviderField(s, 'dns_azure', 'AZUREDNS_APPID', 'Azure App ID', '');
		_addDnsProviderField(s, 'dns_azure', 'AZUREDNS_CLIENTSECRET', 'Azure Client Secret', '');

		_addDnsProviderField(s, 'dns_bunny', 'BUNNY_API_KEY', 'Bunny API Key', '');

		_addDnsProviderField(s, 'dns_cf', 'CF_Key', 'CF Key', '');
		_addDnsProviderField(s, 'dns_cf', 'CF_Email', 'CF Email', '');
		_addDnsProviderField(s, 'dns_cf', 'CF_Token', 'CF Token', '');
		_addDnsProviderField(s, 'dns_cf', 'CF_Account_ID', 'CF Account ID', '');
		_addDnsProviderField(s, 'dns_cf', 'CF_Zone_ID', 'CF Zone ID', '');

		_addDnsProviderField(s, 'dns_ddnss', 'DDNSS_Token', 'DDNSS.de Token', '');

		_addDnsProviderField(s, 'dns_desec', 'DEDYN_TOKEN', 'deSEC.io Token', '');

		_addDnsProviderField(s, 'dns_duckdns', 'DuckDNS_Token', 'DuckDNS Token',
			_('Open <a href="https://www.duckdns.org/">DuckDNS</a> and copy a token here')
		);

		_addDnsProviderField(s, 'dns_dynv6', 'DYNV6_TOKEN', 'DynV6 Token', '');

		_addDnsProviderField(s, 'dns_dnsimple', 'DNSimple_OAUTH_TOKEN', 'DNSimple OAuth TOKEN', '');

		_addDnsProviderField(s, 'dns_dgon', 'DO_API_KEY', 'Digital Ocean API Key', '');

		_addDnsProviderField(s, 'dns_dreamhost', 'DH_API_KEY', 'DreamHost.com API Key', '');

		_addDnsProviderField(s, 'dns_df', 'DF_user', 'DynDnsFree.de Username', '');
		_addDnsProviderField(s, 'dns_df', 'DF_password', 'DynDnsFree.de Password', '');

		_addDnsProviderField(s, 'dns_gandi_livedns', 'GANDI_LIVEDNS_KEY', 'Gandi LiveDNS Key', '');

		_addDnsProviderField(s, 'dns_gcore', 'GCORE_Key', 'GCore Key', '');

		_addDnsProviderField(s, 'dns_gd', 'GD_Key', 'GoDaddy.com Key', '');
		_addDnsProviderField(s, 'dns_gd', 'GD_Secret', 'GoDaddy.com Secret', '');

		_addDnsProviderField(s, 'dns_geoscaling', 'GEOSCALING_Username', 'Geoscaling.com Username',
			_('This is usually NOT an email address')
		);
		_addDnsProviderField(s, 'dns_geoscaling', 'GEOSCALING_Password', 'Geoscaling.com Password', '');

		_addDnsProviderField(s, 'dns_googledomains', 'GOOGLEDOMAINS_ACCESS_TOKEN', 'Google Domains Access Token', '');
		_addDnsProviderField(s, 'dns_googledomains', 'GOOGLEDOMAINS_ZONE', 'Google Domains Zone', '');

		_addDnsProviderField(s, 'dns_he', 'HE_Username', 'dns.he.net Username', '');
		_addDnsProviderField(s, 'dns_he', 'HE_Password', 'dns.he.net Password', '');

		_addDnsProviderField(s, 'dns_hetzner', 'HETZNER_Token', 'Hetzner Token', '');

		_addDnsProviderField(s, 'dns_he', 'dns_hexonet', 'Hexonet.net Login', 'username!roleId');
		_addDnsProviderField(s, 'dns_he', 'dns_hexonet', 'Hexonet.net Password', '');

		_addDnsProviderField(s, 'dns_huaweicloud', 'HUAWEICLOUD_Username', 'MyHuaweiCloud.com Username', '');
		_addDnsProviderField(s, 'dns_huaweicloud', 'HUAWEICLOUD_Password', 'MyHuaweiCloud.com Password', '');
		_addDnsProviderField(s, 'dns_huaweicloud', 'HUAWEICLOUD_DomainName', 'MyHuaweiCloud.com Domain Name', '');

		_addDnsProviderField(s, 'dns_infomaniak', 'INFOMANIAK_API_TOKEN', 'InfoManiak Token', '');

		_addDnsProviderField(s, 'dns_ipv64', 'IPv64_Token', 'ipv64.net Token', '');

		_addDnsProviderField(s, 'dns_jd', 'JD_ACCESS_KEY_ID', 'JDCloud.com Access Key ID', '');
		_addDnsProviderField(s, 'dns_jd', 'JD_ACCESS_KEY_SECRET', 'JDCloud.com Access Key Secret', '');
		_addDnsProviderField(s, 'dns_jd', 'JD_REGION', 'JDCloud.com Region', 'cn-north-1');

		_addDnsProviderField(s, 'dns_joker', 'JOKER_USERNAME', 'Joker.com User', '');
		_addDnsProviderField(s, 'dns_joker', 'JOKER_PASSWORD', 'Joker.com Password', '');

		_addDnsProviderField(s, 'dns_freedns', 'FREEDNS_User', 'FreeDNS User', '');
		_addDnsProviderField(s, 'dns_freedns', 'FREEDNS_Password', 'FreeDNS Password', '');

		_addDnsProviderField(s, 'dns_la', 'LA_Id', 'dns.la Id', '');
		_addDnsProviderField(s, 'dns_la', 'LA_Key', 'dns.la Key', '');

		_addDnsProviderField(s, 'dns_linodev4', 'LINODE_V4_API_KEY', 'Linode API Key', '');

		_addDnsProviderField(s, 'dns_loopia', 'LOOPIA_User', 'Loopia User', '');
		_addDnsProviderField(s, 'dns_loopia', 'LOOPIA_Password', 'Loopia Password', '');

		_addDnsProviderField(s, 'dns_lua', 'LUA_Email', 'luadns.com email', '');
		_addDnsProviderField(s, 'dns_lua', 'LUA_Key', 'luadns.com Key', '');

		_addDnsProviderField(s, 'dns_mydnsjp', 'MYDNSJP_MasterID', 'MyDNS.jp MasterID', '');
		_addDnsProviderField(s, 'dns_mydnsjp', 'MYDNSJP_Password', 'MyDNS.jp Password', '');

		_addDnsProviderField(s, 'dns_me', 'ME_Key', 'DNSMadeEasy Key', '');
		_addDnsProviderField(s, 'dns_me', 'ME_Secret', 'DNSMadeEasy Secret', '');

		_addDnsProviderField(s, 'dns_namecom', 'Namecom_Username', 'Name.com Username', '');
		_addDnsProviderField(s, 'dns_namecom', 'Namecom_Token', 'Name.com Token', '');

		_addDnsProviderField(s, 'dns_namecheap', 'NAMECHEAP_API_KEY', 'NameCheap API Key', '');
		_addDnsProviderField(s, 'dns_namecheap', 'NAMECHEAP_USERNAME', 'NameCheap User', '');
		_addDnsProviderField(s, 'dns_namecheap', 'NAMECHEAP_SOURCEIP', 'NameCheap Source IP', '');

		_addDnsProviderField(s, 'dns_nic', 'NIC_ClientID', 'Nic.ru ClientID', '');
		_addDnsProviderField(s, 'dns_nic', 'NIC_ClientSecret', 'Nic.ru ClientSecret', '');
		_addDnsProviderField(s, 'dns_nic', 'NIC_Username', 'Nic.ru Username', '');
		_addDnsProviderField(s, 'dns_nic', 'NIC_Password', 'Nic.ru Password', '');

		_addDnsProviderField(s, 'dns_netlify', 'NETLIFY_ACCESS_TOKEN', 'Netlify Access Token', '');

		_addDnsProviderField(s, 'dns_nsone', 'NS1_Key', 'nsone.net Key', '');

		_addDnsProviderField(s, 'dns_nsupdate', 'NSUPDATE_SERVER', 'nsupdate server address', '');
		_addDnsProviderField(s, 'dns_nsupdate', 'NSUPDATE_SERVER_PORT', 'nsupdate server port', '');
		_addDnsProviderField(s, 'dns_nsupdate', 'NSUPDATE_KEY', 'nsupdate key file path', '');
		_addDnsProviderField(s, 'dns_nsupdate', 'NSUPDATE_ZONE', 'nsupdate zone', '');

		_addDnsProviderField(s, 'dns_nsupdate', 'OCI_CLI_TENANCY', 'OCI Tenancy',
			_('OCID of tenancy that contains the target DNS zone')
		);
		_addDnsProviderField(s, 'dns_nsupdate', 'OCI_CLI_USER', 'OCI User',
			_('OCID of user with permission to add/remove records from zones')
		);
		_addDnsProviderField(s, 'dns_nsupdate', 'OCI_CLI_REGION', 'OCI Region',
			_('Should point to the tenancy home region')
		);
		_addDnsProviderField(s, 'dns_nsupdate', 'OCI_CLI_KEY_FILE', 'OCI Key file',
			_('Path to private API signing key file in PEM format')
		);
		_addDnsProviderField(s, 'dns_nsupdate', 'OCI_CLI_KEY', 'OCI Key',
			_('The private API signing key in PEM format')
		);

		_addDnsProviderField(s, 'dns_ovh', 'OVH_AK', 'OVH Application Key', '');
		_addDnsProviderField(s, 'dns_ovh', 'OVH_AS', 'OVH Application Secret', '');
		_addDnsProviderField(s, 'dns_ovh', 'OVH_CK', 'OVH Consumer Key', '');
		_addDnsProviderField(s, 'dns_ovh', 'OVH_END_POINT', 'OVH Region/Endpoint',
			'ovh-eu, ovh-us, ovh-ca, kimsufi-eu, kimsufi-ca, soyoustart-eu, soyoustart-ca'
		);

		_addDnsProviderField(s, 'dns_pdns', 'PDNS_Url', 'PDNS API URL', '');
		_addDnsProviderField(s, 'dns_pdns', 'PDNS_ServerId', 'PDNS Server ID', '');
		_addDnsProviderField(s, 'dns_pdns', 'PDNS_Token', 'PDNS Token', '');
		_addDnsProviderField(s, 'dns_pdns', 'PDNS_Ttl', 'PDNS Default TTL', '60');

		_addDnsProviderField(s, 'dns_porkbun', 'PORKBUN_API_KEY', 'Porkbun API Key', '');
		_addDnsProviderField(s, 'dns_porkbun', 'PORKBUN_SECRET_API_KEY', 'Porkbun API Secret', '');

		_addDnsProviderField(s, 'dns_rackspace', 'RACKSPACE_Apikey', 'RackSpace API Key', '');
		_addDnsProviderField(s, 'dns_rackspace', 'RACKSPACE_Username', 'Porkbun Username', '');

		_addDnsProviderField(s, 'dns_regru', 'REGRU_API_Username', 'reg.ru Username', '');
		_addDnsProviderField(s, 'dns_regru', 'REGRU_API_Password', 'reg.ru Password', '');

		_addDnsProviderField(s, 'dns_selectel', 'SL_Key', 'Selectel API Key', '');

		_addDnsProviderField(s, 'dns_selfhost', 'SELFHOSTDNS_USERNAME', 'SelfHost.de Username', '');
		_addDnsProviderField(s, 'dns_selfhost', 'SELFHOSTDNS_PASSWORD', 'SelfHost.de Password', '');
		_addDnsProviderField(s, 'dns_selfhost', 'SELFHOSTDNS_MAP', 'SelfHost.de Domains map',
			_('E.g. <code>_acme-challenge.example.com:12345:98765 alias.example.com:11111</code>')
		);

		_addDnsProviderField(s, 'dns_simply', 'SIMPLY_AccountName', 'Simply.com account name', '');
		_addDnsProviderField(s, 'dns_simply', 'SIMPLY_ApiKey', 'Simply.com API Key', '');

		_addDnsProviderField(s, 'dns_tele3', 'TELE3_Key', 'tele3.cz API Key', '');
		_addDnsProviderField(s, 'dns_tele3', 'TELE3_Secret', 'tele3.cz API Secret', '');

		_addDnsProviderField(s, 'dns_vultr', 'VULTR_API_KEY', 'Vultr API Secret', '');

		_addDnsProviderField(s, 'dns_vscale', 'VSCALE_API_KEY', 'vscale.io API Key', '');

		_addDnsProviderField(s, 'dns_yandex', 'PDD_Token', 'Yandex DNS API Token', '');

		_addDnsProviderField(s, 'dns_yandex', 'PDD_Token', 'Yandex DNS API Token', '');

		_addDnsProviderField(s, 'dns_yc', 'YC_Zone_ID', 'Yandex Cloud: DNS Zone ID', '');
		_addDnsProviderField(s, 'dns_yc', 'YC_Folder_ID', 'Yandex Cloud: YC Folder ID', '');
		_addDnsProviderField(s, 'dns_yc', 'YC_SA_ID', 'Yandex Cloud: Service Account ID', '');
		_addDnsProviderField(s, 'dns_yc', 'YC_SA_Key_ID', 'Yandex Cloud: Service Account IAM Key ID', '');
		_addDnsProviderField(s, 'dns_yc', 'YC_SA_Key_File_Path', 'Yandex Cloud: Path to private key', '');
		_addDnsProviderField(s, 'dns_yc', 'YC_SA_Key_File_PEM_b64', 'Yandex Cloud: PEM of private key',
			_('Base64 content of private key. Use instead of YC_SA_Key_File_Path')
		);

		_addDnsProviderField(s, 'dns_zilore', 'Zilore_Key', 'Zilore API Key', '');

		_addDnsProviderField(s, 'dns_zone', 'ZONE_Username', 'Zone.ee Username', '');
		_addDnsProviderField(s, 'dns_zone', 'ZONE_Key', 'Zone.ee API Key', '');

		_addDnsProviderField(s, 'dns_zonomi', 'ZM_Key', 'Zonomi.com API Key', '');


		o = s.taboption('challenge_dns', form.DynamicList, 'credentials', _('DNS API credentials'),
			_("The credentials for the DNS API mode selected above. " +
				"See https://github.com/acmesh-official/acme.sh/wiki/dnsapi for the format of credentials required by each API. " +
				"Add multiple entries here in KEY=VAL shell variable format to supply multiple credential variables."))
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


		o = s.taboption('advanced', form.Flag, 'use_staging', _('Use staging server'),
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
		o.cfgvalue = function(section_id, set_value) {
			var keylength = uci.get('acme', section_id, 'keylength');
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
			return set_value;
		};
		o.write = function(section_id, value) {
			// remove old keylength
			uci.unset('acme', section_id, 'keylength');
			uci.set('acme', section_id, 'key_type', value);
		};

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
		o.modalonly = true;


		s = m.section(form.GridSection, '_certificates');

		s.render = L.bind(_renderCerts, this, certs);

		return m.render();
	}
})


function _addDnsProviderField(s, provider, env, title, desc) {
	let o = s.taboption('challenge_dns', form.Value, '_' + env, _(title),
		_(desc));
	o.depends('dns', provider);
	o.modalonly = true;
	o.cfgvalue = function (section_id, stored_val) {
		var creds = this.map.data.get(this.map.config, section_id, 'credentials');
		return _extractParamValue(creds, env);
	};
	o.write = function (section_id, value) {
		this.map.data.set('acme', section_id, 'credentials', [env + '="' + value + '"']);
	};
	return o;
}

/**
 * @param {string[]} paramsKeyVals
 * @param {string} paramName
 * @returns {string}
 */
function _extractParamValue(paramsKeyVals, paramName) {
	if (!paramsKeyVals) {
		return '';
	}
	for (let i = 0; i < paramsKeyVals.length; i++) {
		var paramKeyVal = paramsKeyVals[i];
		var parts = paramKeyVal.split('=');
		if (parts.lenght < 2) {
			continue;
		}
		var name = parts[0];
		var val = parts[1];
		if (name == paramName) {
			// unquote
			return val.substring(0, val.length-1).substring(1);
		}
	}
	return '';
}

function _handleCheckService(c, event, curVal, newVal) {
	document.getElementById('wikiInstructionUrl').href = 'https://github.com/acmesh-official/acme.sh/wiki/dnsapi#' + newVal;
}

function _renderCerts(certs) {
	var table = E('table', {'class': 'table cbi-section-table', 'id': 'certificates_table'}, [
		E('tr', {'class': 'tr table-titles'}, [
			E('th', {'class': 'th'}, _('Main Domain')),
			E('th', {'class': 'th'}, _('Private Key')),
			E('th', {'class': 'th'}, _('Public Certificate')),
			E('th', {'class': 'th'}, _('Issued on')),
		])
	]);

	var rows = certs.map(function (cert) {
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
