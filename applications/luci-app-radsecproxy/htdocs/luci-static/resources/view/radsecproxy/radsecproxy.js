'use strict';

'require uci';
'require form';
'require view';
'require fs';
'require ui';

function writeFile(path, content) {
    if (content != null) {
        var normalized = content.replaceAll('\r\n', '\n');
        fs.write(path, normalized);
    }
}

return view.extend({
    render: function(data) {
        var config_file = '/etc/radsecproxy.conf';
        let o;
        const m = new form.Map('radsecproxy', _('Radsecproxy'), _('Configure Radsecproxy'));

        // -------------------------------- //
        // Global radsecproxy configuration //
        // -------------------------------- //

        let s = m.section(form.TypedSection, 'options', _('Global radsecproxy settings'));
        s.anonymous = true;

        // Global radsecproxy -> general

        s.tab('general', _('General Settings'));

        o = s.taboption('general', form.DynamicList, 'ListenUDP', _('ListenUDP'), _('IP address and port where radsecproxy should listen to requests for RADIUS/UDP, e.g. <code>127.0.0.1:1812</code>. Can be specified multiple times. IPv6 addresses must be enclosed in square brackets (<code>[::]:1812</code>). Must be present if clients with type <code>udp</code> are present.'));
        o.datatype = 'string';
        o.optional = true;

        o = s.taboption('general', form.DynamicList, 'ListenTCP', _('ListenTCP'), _('IP address and port where radsecproxy should listen to requests for RADIUS/TCP, e.g. <code>127.0.0.1:1812</code>. Can be specified multiple times. Must be present if clients with type <code>tcp</code> are present.'));
        o.datatype = 'string';
        o.optional = true;

        o = s.taboption('general', form.DynamicList, 'ListenTLS', _('ListenTLS'), _('IP address and port where radsecproxy should listen to requests for RADIUS/TLS, e.g. <code>0.0.0.0:2083</code>. Can be specified multiple times. Must be present if clients with type <code>tls</code> are present.'));
        o.datatype = 'string';
        o.optional = true;

        o = s.taboption('general', form.DynamicList, 'ListenDTLS', _('ListenDTLS'), _('IP address and port where radsecproxy should listen to requests for RADIUS/DTLS, e.g. <code>0.0.0.0:2083</code>. Can be specified multiple times. Must be present if clients with type <code>dtls</code> are present.'));
        o.datatype = 'string';
        o.optional = true;

        o = s.taboption('general', form.Flag, 'IPv4Only', _('IPv4Only'));
        o = s.taboption('general', form.Flag, 'IPv6Only', _('IPv6Only'));

        o = s.taboption('general', form.Flag, 'SNI', _('SNI'), _('Use Server Name Indication for outgoing TLS connections.'));

        // Global radsecproxy -> RADIUS handling

        s.tab('radius', _('RADIUS handling'));

        o = s.taboption('radius', form.Value, 'TTLAttribute', _('TTLAttribute'), _('The attribute in which the TTL is stored. Either a numerical value (for a generic RADIUS attribute) or two numerical values separated by a colon for a Vendor-Specific attribute'));
        o.datatype = 'string';
        o.optional = true;

        o = s.taboption('radius', form.Value, 'AddTTL', _('AddTTL'), _('Add a TTL Attribute with the given value (if it is not present already). Allowed values are 1-255.'));
        o.datatype = 'uinteger';
        o.optional = true;

        o = s.taboption('radius', form.Flag, 'LoopPrevention', _('LoopPrevention'), _('Basic loop prevention. Radsecproxy will not forward packets from a client to a server with the same name.'));
        o.default = true;
        o.rmempty = false;
        o = s.taboption('radius', form.Flag, 'VerifyEAP', _('Verify EAP'), _('Verify that EAP packets are consistent. Only disable this if you REALLY know what you are doing.'));
        o.default = true;
        o.rmempty = false;

        // Global radsecproxy -> source configuration

        s.tab('source_config', _('Source configuration'), _('Radsecproxy will use these specific IP addresses and/or port as source address and/or source port for outgoing connections. Format is <code>ipaddr</code> for only specifying the source IP address, <code>ipaddr:port</code> for IP address and port and <code>*:port</code> to specify the source port.'));

        o = s.taboption('source_config', form.Value, 'SourceUDP', _('SourceUDP'), _('Use this specific IP address and/or port as source for RADIUS/UDP.'));
        o.datatype = 'string';
        o.optional = true;

        o = s.taboption('source_config', form.Value, 'SourceTCP', _('SourceTCP'), _('Use this specific IP address and/or port as source for RADIUS/TCP.'));
        o.datatype = 'string';
        o.optional = true;

        o = s.taboption('source_config', form.Value, 'SourceTLS', _('SourceTLS'), _('Use this specific IP address and/or port as source for RADIUS/TLS.'));
        o.datatype = 'string';
        o.optional = true;

        o = s.taboption('source_config', form.Value, 'SourceDTLS', _('SourceDTLS'), _('Use this specific IP address and/or port as source for RADIUS/DTLS.'));
        o.datatype = 'string';
        o.optional = true;

        // Global radsecproxy -> logging

        s.tab('logging', _('Logging configuration'));

        o = s.taboption('logging', form.ListValue, 'LogLevel', _('Log Level'));
        o.datatype = 'uinteger';
        o.default = 3;
        o.value(1, 'Error');
        o.value(2, 'Warning');
        o.value(3, 'Notice');
        o.value(4, 'Info');
        o.value(5, 'Debug');

        o = s.taboption('logging', form.Value, 'LogDestination', _('Log destination'), _('Destination for Logging. Can be either <code>file:///path/to/logfile</code> or <code>x-syslog:///FACILITY</code>.<br/>Valid facilities are <code>LOG_DAEMON</code>, <code>LOG_MAIL</code>, <code>LOG_USER</code>, <code>LOG_LOCAL0</code>, <code>LOG_LOCAL1</code>, <code>LOG_LOCAL2</code>, <code>LOG_LOCAL3</code>, <code>LOG_LOCAL4</code>, <code>LOG_LOCAL5</code>, <code>LOG_LOCAL6</code>, or <code>LOG_LOCAL7</code>.'));
        o.datatype = 'string';
        o.placeholder = 'x-syslog:///LOG_DAEMON';

        o = s.taboption('logging', form.Flag, 'LogThreadId', _('Log ThreadID'), _('Include the ThreadID in log messages'));
        o.default = true;
        o.rmempty = false;

        o = s.taboption('logging', form.Flag, 'LogFullUsername', _('Log Full User-Name'), _('Can be disabled to only log the realm part of the username for privacy'));
        o.default = true;
        o.rmempty = false;

        o = s.taboption('logging', form.ListValue, 'LogMAC', _('Log MAC'), _('Format in which the MAC address of users (Calling-Station-ID) is logged'));
        o.datatype = 'string';
        o.default = 'Original';
        o.value('Original', 'Original');
        o.value('Static', 'Static');
        o.value('VendorHashed', 'VendorHashed');
        o.value('VendorKeyHashed', 'VendorKeyHashed');
        o.value('FullyHashed', 'FullyHashed');
        o.value('FullyKeyHashed', 'FullyKeyHashed');

        o = s.taboption('logging', form.Value, 'LogKey', _('Log Key'), _('Key (="Pepper") for hashing MAC addresses'));
        o.datatype = 'string';
        o.depends('LogMAC', 'VendorKeyHashed');
        o.depends('LogMAC', 'FullyKeyHashed');

        o = s.taboption('logging', form.Flag, 'ShowFTicksInLuCI', _('Use FTicks reporting'), _('FTicks reporting is used esp. in eduroam'));

        // Global radsecproxy -> FTicks

        s.tab('fticks', _('FTicks reporting'));

        o = s.taboption('fticks', form.ListValue, 'FTicksReporting', _('FTicksReporting'));
        o.datatype = 'string';
        o.default = 'None';
        o.value('None');
        o.value('Basic');
        o.value('Full');
        o.depends('ShowFTicksInLuCI', "1");

        o = s.taboption('fticks', form.ListValue, 'FTicksMAC', _('FTicksMac'), _('Format in which the MAC address of users (Calling-Station-ID) is logged in FTicks'));
        o.datatype = 'string';
        o.default = 'Original';
        o.value('Original', 'Original');
        o.value('Static', 'Static');
        o.value('VendorHashed', 'VendorHashed');
        o.value('VendorKeyHashed', 'VendorKeyHashed');
        o.value('FullyHashed', 'FullyHashed');
        o.value('FullyKeyHashed', 'FullyKeyHashed');
        o.depends('ShowFTicksInLuCI', "1");

        o = s.taboption('fticks', form.Value, 'FTicksKey', _('FTicks Key'), _('Key (="Pepper") for hashed MAC addresses in FTicks'));
        o.datatype = 'string';
        o.depends('FTicksMAC', 'VendorKeyHashed');
        o.depends('FTicksMAC', 'FullyKeyHashed');

        o = s.taboption('fticks', form.Value, 'FTicksSyslogFacility', _('FTicks Syslog Facility'), _('Syslog destination for FTicks. (see LogDestination for formatting)'));
        o.datatype = 'string';
        o.placeholder = 'x-syslog:///LOG_DAEMON';
        o.depends('ShowFTicksInLuCI', "1");

        o = s.taboption('fticks', form.Value, 'FTicksPrefix', _('FTicksPrefix'), _('Prefix for FTicks log lines'));
        o.datatype = 'string';
        o.placeholder = 'F-TICKS/eduroam/1.0';
        o.depends('ShowFTicksInLuCI', "1");


        // Global radsecproxy -> advanced

        s.tab('advanced', _('Advanced Settings'));
        o = s.taboption('advanced', form.SectionValue, '_advanced', form.TypedSection, '_advanced', null, _('Write additional radsecproxy config directly, will be included before any other configuration.'));

        var advanced = o.subsection;
        advanced.anonymous = true;
        advanced.cfgsections = function() { return [ '_advanced'] };
        advanced.tab('_config_file', _('Config file'));

        o = advanced.taboption('_config_file', form.TextValue, '_config_file_data');
        o.wrap = false;
        o.rows = 25;
        o.rmempty = true;
        o.cfgvalue = function(section_id) {
            return L.resolveDefault(fs.read(config_file), '');
        }
        o.write = function(section_id, value) {
            writeFile(config_file, value);
        }

        //--------------------//
        // TLS configurations //
        //--------------------//

        s = m.section(form.GridSection, 'tls', _('TLS Configuration'));
        s.addremove = true;
        s.anonymous = true;
        s.nodescriptions = true;

        // TLS configuration -> general settings

        s.tab('tls', _('TLS Config'));
        o = s.taboption('tls', form.Value, 'name', _('TLS Config Name'), _('Name of the configuration. Special names: <code>default</code> as global default, <code>defaultClient</code> as default for all clients, and <code>defaultServer</code> as default for all servers'));
        o.datatype = 'string';
        o = s.taboption('tls', form.FileUpload, 'CACertificateFile', _('TLS CA certificate'));
        o.datatype = 'file';
        o.modalonly = true;
        o = s.taboption('tls', form.FileUpload, 'certificateFile', _('TLS certificate'));
        o.datatype = 'file';
        o.modalonly = true;
        o = s.taboption('tls', form.FileUpload, 'certificateKeyFile', _('TLS certificate key'));
        o.datatype = 'file';
        o.modalonly = true;
        o = s.taboption('tls', form.Value, 'certificateKeyPassword', _('TLS certificate key password'), _('Optional, if the private key is encrypted'));
        o.datatype = 'string';
        o.optional = true;
        o.modalonly = true;
        o = s.taboption('tls', form.DynamicList, 'policyOID', _('policyOID'), _('Require the peer certificate to include at least one of the configured OIDs'));
        o.datatype = 'string';
        o.optional = true;
        o.modalonly = true;

        // TLS configuration -> advanced

        s.tab('advanced', _('Advanced'));
        o = s.taboption('advanced', form.Flag, 'CRLCheck', _('CRL Check'), _('Check the peer certificate against CRLs. Note that every CA must provide a CRL, and the CRLs must be download manually'));
        o.default = false;
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'CACertificatePath', _('CA Certificate path'), _('Path to directory containing CA certificate(s) and CRLs.'));
        o.datatype = 'string';
        o.rmempty = true;
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'CacheExpiry', _('Cache Expiry'), _('Define how many seconds the CA and CRL information should be cached. <code>0</code> disables caching (Caution: May have huge performance impact), negative value means indefinetely caching.'));
        o.datatype = 'integer';
        o.rmempty = true;
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'TLSVersion', _('TLS Versions'), _('Specify which TLS version (range) should be used. (Example: <code>TLS1_3</code> to allow only TLSv1.3 or <code>TLS1:TLS1_3</code> to allow all versions from TLSv1.0 to TLSv1.3), valid versions (depending on TLS library) are <code>SSL3</code>, <code>TLS1</code>, <code>TLS1_1</code>, <code>TLS1_2</code>, or <code>TLS1_3</code>.'));
        o.datatype = 'string';
        o.rmempty = true;
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'DTLSVersion', _('DTLS Versions'), _('Specify which DTLS version (range) should be used. Valid versions (depending on TLS library) are <code>DTLS1</code> or <code>DTLS1_2</code>.'));
        o.datatype = 'string';
        o.rmempty = true;
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'CipherList', _('Cipher list'), _('Specify the list of acceptable ciphers (see the manpage for <b>openssl-ciphers</b>(1) for details)'));
        o.datatype = 'string';
        o.rmempty = true;
        o.modalonly = true;

        o = s.taboption('advanced', form.Value, 'CipherSuites', _('Cipher Suites'), _('Specify the ciphersuites to be used for TLS1.3. (see the manpage for <b>openssl-ciphers</b>(1) for details)'));
        o.datatype = 'string';
        o.rmempty = true;
        o.modalonly = true;

        //----------//
        // Rewrites //
        //----------//

        s = m.section(form.GridSection, 'rewrite', _('Rewrites'), _('Rewrites allow to change the attribute contents in RADIUS packets, or add/remove attributes'));
        s.addremove = true;
        s.optional = true;
        s.anonymous = true;
        s.nodescriptions = true;

        // Rewrites -> Attributes
        s.tab('simple', _('Simple Attributes'), _('Rewrite RADIUS attributes. The <code>attribute</code> part of the syntax always refers to the numerical <a href="https://www.iana.org/assignments/radius-types/radius-types.xhtml#radius-types-2" target="_blank">attribute type</a> of the RADIUS attribute. The rewrites are performed in order: Remove/Whitelist, Modify, Supplement, Add'));

        o = s.taboption('simple', form.Value, 'name', _('Rewrite name'), _('Name of the rewrite. Special names: <code>default</code> as global default, <code>defaultClient</code> as default for all clients, and <code>defaultServer</code> as default for all servers.<br/>Note that the defaults are only applied to <code>RewriteIn</code>. If outgoing requests should be rewritten, you need to explicitly select this in the config for the clients/servers.'));
        o.optional = false;
        o.datatype = 'string';

        o = s.taboption('simple', form.DynamicList, 'addAttribute', _('Add Attribute'), _('Add an attribute with a given value.<br/>Format: <code>attribute:value</code><br/>If the value starts with a number, it is interpreted as 32bit unsigned integer, if it starts with <code>\'</code> it is interpreted as string and if a string contains a <code>%</code>, the next two digits are interpreted as hexadecimal digits.'));
        o.datatype = 'string';
        o.modalonly = true;

        o = s.taboption('simple', form.DynamicList, 'supplementAttribute', _('Supplement Attribute'), _('Add an attribute with the given value, if the attribute is not present. If the attribute is already present, nothing will be changed.<br/>Format: <code>attribute:value</code>'));
        o.datatype = 'string';
        o.modalonly = true;

        o = s.taboption('simple', form.DynamicList, 'modifyAttribute', _('Modify Attribute'), _('Modify the given attribute using the regex replace pattern. If the attribute is not present, nothing will be changed.<br/>Format: <code>attribute:/regex/replace/</code>'));
        o.datatype = 'string';
        o.modalonly = true;

        o = s.taboption('simple', form.DynamicList, 'removeAttribute', _('Remove Attribute'), _('Remove all attributes of the given type.<br/>Format: <code>attribute</code>'));
        o.datatype = 'string';
        o.depends('whitelistMode', '0');
        o.modalonly = true;

        o = s.taboption('simple', form.Flag, 'whitelistMode', _('Whitelist Mode'), _('If enabled, only attributes configured with <code>WhitelistAttribute</code> or <code>WhitelistVendorAttribute</code> are allowed, all other attributes will be removed.'));
        o.default = false;
        o.modalonly = true;

        o = s.taboption('simple', form.DynamicList, 'whitelistAttribute', _('Whitelist Attribute'), _('Only allow attributes of these types.<br/>Format: <code>attribute</code>'));
        o.datatype = 'string';
        o.depends('whitelistMode', '1');
        o.modalonly = true;

        // Rewrites -> VSA-Attributes
        s.tab('vsa', _('Vendor-Specific Attributes'), _('Rewrite Attributes of the type "Vendor-Specific" (VSA). Syntax is similar to the simple rewrites, except the attribute must now be specified with <code>vendor:subattribute</code>.'));

        o = s.taboption('vsa', form.DynamicList, 'addVendorAttribute', _('Add Vendor-Attribute'));
        o.modalonly = true;
        o = s.taboption('vsa', form.DynamicList, 'supplementVendorAttribute', _('Supplement Vendor-Attribute'));
        o.modalonly = true;
        o = s.taboption('vsa', form.DynamicList, 'modifyVendorAttribute', _('Modify Vendor-Attribute'));
        o.modalonly = true;
        o = s.taboption('vsa', form.DynamicList, 'removeVendorAttribute', _('Remove Vendor-Attribute'), _('If only <code>vendor</code> is used, all VSA of this vendor are removed.'));
        o.modalonly = true;
        o.depends('whitelistMode', '0');
        o = s.taboption('vsa', form.DynamicList, 'whitelistVendorAttribute', _('Whitelist Vendor-Attribute'), _('If only <code>vendor</code> is used, all VSA of this vendor are whitelisted.'));
        o.depends('whitelistMode', '1');
        o.modalonly = true;

        //----------------//
        // RadSec clients //
        //----------------//

        s = m.section(form.GridSection, 'client', 'RADIUS/RadSec Clients');
        s.addremove = true;
        s.optional = false;
        s.anonymous = true;
        s.nodescriptions = true;

        // RadSec clients -> general settings

        s.tab('client', _('Client Config'));

        o = s.taboption('client', form.Value, 'name', _('Client Config Name'), _('Name of the client. Can be an FQDN, a single IP address, an IP address range, or an arbitrary name. If the name is arbitrary, a resolvable FQDN or an IP address must be given in the <code>host</code> config.'));
        o.datatype = 'string';
        o = s.taboption('client', form.DynamicList, 'host', _('Client Host name'), _('FQDN, single IP address or IP address range for the client. Can be specified multiple times. Overrides the <code>name</code> config.'));
        o.datatype = 'string'
        o.optional = true;
        o = s.taboption('client', form.ListValue, 'type', _('Client Type'));
        o.value('udp', 'udp');
        o.value('tcp', 'tcp');
        o.value('tls', 'tls');
        o.value('dtls', 'dtls');
        o.modalonly = true;

        o = s.option(form.DummyValue, 'type-detail', _('Client Type'));
        o.cfgvalue = function(section_id, value) {
            var cltype = uci.get('radsecproxy', section_id, 'type');
            var pskid = uci.get('radsecproxy', section_id, 'PSKidentity');
            if(pskid) {
                return cltype+"-psk";
            }
            return cltype;
        }


        o = s.taboption('client', form.Value, 'secret', _('Client secret'), _('Shared secret for RADIUS. Should be at least 12 characters long.'));
        o.datatype = 'string';
        o.depends('type', 'udp');
        o.depends('type', 'tcp');
        o.modalonly = true;

        o = s.taboption('client', form.Flag, 'IPv4Only', _('IPv4 only'));
        o.modalonly = true;
        o = s.taboption('client', form.Flag, 'IPv6Only', _('IPv6 only'));
        o.modalonly = true;

        // RadSec clients -> TLS configuration

        s.tab('tls', _('(D)TLS configuration'));

        let client_tls = s.taboption('tls', form.ListValue, 'tls', _('TLS config'), _('TLS configuration to use. If left empty, it uses the <code>default</code> or <code>defaultClient</code> tls config (if they are defined)'));
        client_tls.datatype = 'string';
        client_tls.optional = true;
        client_tls.depends('type', 'tls');
        client_tls.depends('type', 'dtls');
        client_tls.modalonly = true;

        o = s.taboption('tls', form.Value, 'PSKidentity', _('PSK Identity'), _('Identity for TLS-PSK. Requires PSK Key to also be set. If set, Certificate configuration of tls block is ignored.'));
        o.datatype = 'string';
        o.optional = true;
        o.depends('type', 'tls');
        o.depends('type', 'dtls');
        o.modalonly = true;

        o = s.taboption('tls', form.Value, 'PSKkey', _('PSK Key'), _('Key for TLS-PSK'));
        o.datatype = 'string';
        o.optional = true;
        o.depends('type', 'tls');
        o.depends('type', 'dtls');
        o.modalonly = true;

        o = s.taboption('tls', form.Value, 'serverName', _('Server Name'), _('Override the certificate name check to use this instead of the config name or Host.'));
        o.datatype = 'string';
        o.optional = true;
        o.depends('type', 'tls');
        o.depends('type', 'dtls');
        o.modalonly = true;

        o = s.taboption('tls', form.Flag, 'certificateNameCheck', _('CertificateNameCheck'), _('Check the name in the Certificate against the configured name / host. Disable this to use a custom name check.'));
        o.default = true;
        o.rmempty = false;
        o.depends('type', 'tls');
        o.depends('type', 'dtls');
        o.modalonly = true;

        o = s.taboption('tls', form.DynamicList, 'matchCertificateAttribute', _('MatchCertificateAttribute'), _('Match the certificate attributes of the peer certificate. Format: <code>CN:/regexp/</code> or <code>SubjectAltName:DNS:/regexp/</code>. See radsecproxy manpage for more detail.'));
        o.datatype = 'string';
        o.depends('certificateNameCheck', "0");
        o.modalonly = true;

        // RadSec Clients -> RADIUS configuration

        s.tab('radius', _('RADIUS specific configuration'));
        o = s.taboption('radius', form.Flag, 'requireMessageAuthenticator', _('requireMessageAuthenticator'), _('Require all requests from the client to contain a MessageAuthenticator attribute. Only disable if the client cannot send MessageAuthenticator.'));
        o.default = true;
        o.depends('type', 'udp');
        o.depends('type', 'tcp');
        o.modalonly = true;

        o = s.taboption('radius', form.Flag, 'requireMessageAuthenticatorProxy', _('requireMessageAuthenticatorProxy'), _('Require all requests that contain a Proxy-State attribute to also include a MessageAuthenticator attribute, to prevent Blast-RADIUS attacks. This should always be enabled if the client is a NAS (e.g., a WLAN controller or an Access Point).'));
        o.default = true;
        o.rmempty = false;
        o.depends('requireMessageAuthenticator', "0");
        o.modalonly = true;

        o = s.taboption('radius', form.Value, 'AddTTL', _('AddTTL'), _('Add a TTL attribute with this value (if not present, overwrites global setting). Allowed values 1-255'));
        o.datatype = 'uinteger';
        o.rmempty = true;
        o.modalonly = true;

        o = s.taboption('radius', form.Value, 'duplicateInterval', _('Duplicate Interval'), _('Amount of seconds during which a packet with the same ID and authenticator will be considered a retransmission. Defaults to 10. Allowed values 0-255'));
        o.datatype = 'uinteger';
        o.rmempty = true;
        o.modalonly = true;

        let client_rewritein = s.taboption('radius', form.ListValue, 'rewriteIn', _('RewriteIn'), _('Rewrite all incoming RADIUS packets according to the rewrite block referenced here. If empty, it uses the <code>default</code> or <code>defaultClient</code> rewrites (if they are defined).'));
        client_rewritein.datatype = 'string';
        client_rewritein.optional = true;
        client_rewritein.modalonly = true;
        let client_rewriteout = s.taboption('radius', form.ListValue, 'rewriteOut', _('RewriteOut'), _('Rewrite all outgoing RADIUS packets according to the rewrite block referenced here.'));
        client_rewriteout.datatype = 'string';
        client_rewriteout.optional = true;
        client_rewriteout.modalonly = true;

        // RadSec Clients -> FTicks configuration
        s.tab('fticks', _('FTicks configuration'));
        o = s.taboption('fticks', form.Value, 'fticksVISCOUNTRY', _('FTicks VISCOUNTRY'), _('Country code of visited institution (2 characters)'));
        o.datatype = 'string';
        o.modalonly = true;
        o = s.taboption('fticks', form.Value, 'fticksVISINST', _('FTicks VISINST'), _('Institution name of visited institution'));
        o.datatype = 'string';
        o.modalonly = true;

        //----------------//
        // RadSec servers //
        //----------------//

        s = m.section(form.GridSection, 'server', 'RADIUS/RadSec servers');
        s.addremove = true;
        s.optional = true;
        s.anonymous = true;
        s.nodescriptions = true;

        // RadSec servers -> general config

        s.tab('server', _('Server Config'));

        o = s.taboption('server', form.Value, 'name', _('Server Config Name'), _('Name of the server. Can be an FQDN, a single IP address or an arbitrary name. If the name is not an IP address or FQDN, one must be provided in the <code>host</code> config. This name is used to reference servers for realms.'));
        o.datatype = 'string';

        o = s.taboption('server', form.DynamicList, 'host', _('Server Host name'), _('FQDN or IP address for the server. Can be specified multiple times, radsecproxy will use the first agailable. Do not use this for fail-over.'));
        o.datatype = 'string';
        o.optional = true;

        o = s.taboption('server', form.Value, 'port', _('Server port'), _('Default: <code>1812</code> for udp or tcp, <code>2083</code> for tls or dtls'));
        o.datatype = 'uinteger';
        o.optional = true;
        o.modalonly = true;

        o = s.taboption('server', form.ListValue, 'type', _('Server Type'));
        o.value('udp', 'udp');
        o.value('tcp', 'tcp');
        o.value('tls', 'tls');
        o.value('dtls', 'dtls');
        o.modalonly = true;

        o = s.option(form.DummyValue, 'type-detail', _('Server Type'));
        o.cfgvalue = function(section_id, value) {
            var cltype = uci.get('radsecproxy', section_id, 'type');
            var pskid = uci.get('radsecproxy', section_id, 'PSKidentity');
            if(pskid) {
                return cltype+"-psk";
            }
            return cltype;
        }

        o = s.taboption('server', form.Value, 'secret', _('Server secret'), _('Shared secret for RADIUS. Should be at least 12 characters long.'));
        o.datatype = 'string';
        o.depends('type', 'udp');
        o.depends('type', 'tcp');
        o.modalonly = true;

        // RadSec servers -> Connection details

        s.tab('conn', _('Connection Details'));

        o = s.taboption('conn', form.Value, 'source', _('Source'), _('Use this specific IP address and/or port as source for outgoing connections. Overwrites the global Source config.'));
        o.datatype = 'string';
        o.optional = true;
        o.modalonly = true;

        o = s.taboption('conn', form.Flag, 'IPv4Only', _('IPv4 only'));
        o.modalonly = true;
        o = s.taboption('conn', form.Flag, 'IPv6Only', _('IPv6 only'));
        o.modalonly = true;

        // RadSec servers -> TLS configuration

        s.tab('tls', _('(D)TLS configuration'));
        let server_tls = s.taboption('tls', form.ListValue, 'tls', _('TLS config'), _('TLS configuration to use. If left empty, it uses the <code>default</code> or <code>defaultServer</code> tls config (if they are defined)'));
        server_tls.datatype = 'string';
        server_tls.optional = true;
        server_tls.depends('type', 'tls');
        server_tls.depends('type', 'dtls');
        server_tls.modalonly = true;

        o = s.taboption('tls', form.Value, 'PSKidentity', _('PSK Identity'), _('Identity for TLS-PSK. Requires PSK Key to also be set. If set, Certificate configuration of tls block is ignored.'));
        o.datatype = 'string';
        o.optional = true;
        o.depends('type', 'tls');
        o.depends('type', 'dtls');
        o.modalonly = true;

        o = s.taboption('tls', form.Value, 'PSKkey', _('PSK Key'), _('Key for TLS-PSK'));
        o.datatype = 'string';
        o.optional = true;
        o.depends('type', 'tls');
        o.depends('type', 'dtls');
        o.modalonly = true;

        o = s.taboption('tls', form.Value, 'serverName', _('Server Name'), _('Override the certificate name check to use this instead of the config name or Host.'));
        o.datatype = 'string';
        o.optional = true;
        o.depends('type', 'tls');
        o.depends('type', 'dtls');
        o.modalonly = true;

        o = s.taboption('tls', form.ListValue, 'SNI', _('SNI'), _('Use ServerNameIndication for this connection (overrides global default)'));
        o.depends('type', 'tls');
        o.depends('type', 'dtls');
        o.rmempty = true;
        o.value('', 'Global default');
        o.value('0', 'Disabled');
        o.value('1', 'Enabled');
        o.modalonly = true;

        o = s.taboption('tls', form.Value, 'SNIservername', _('SNI Server Name'), _('Alternate server name to use for SNI'));
        o.datatype = 'string';
        o.optional = true;
        o.depends('type', 'tls');
        o.depends('type', 'dtls');
        o.modalonly = true;

        o = s.taboption('tls', form.Flag, 'certificateNameCheck', _('CertificateNameCheck'), _('Check the name in the Certificate against the configured name / host. Disable this to use a custom name check.'));
        o.default = true;
        o.rmempty = false;
        o.depends('type', 'tls');
        o.depends('type', 'dtls');
        o.modalonly = true;

        o = s.taboption('tls', form.DynamicList, 'matchCertificateAttribute', _('MatchCertificateAttribute'), _('Match the certificate attributes of the peer certificate. Format: <code>CN:/regexp/</code> or <code>SubjectAltName:DNS:/regexp/</code>. See radsecproxy manpage for more detail.'));
        o.datatype = 'string';
        o.depends('certificateNameCheck', "0");
        o.modalonly = true;

        o = s.taboption('tls', form.Value, 'DTLSForceMTU', _('DTLSForceMTU'), _('Force a specific MTU to the DTLS library. Only needed if DTLS cannot determine the MTU itself and falls back to a very small MTU'));
        o.datatype = 'uinteger';
        o.depends('type', 'dtls');
        o.rmempty = true;
        o.optional = true;
        o.modalonly = true;

        // RadSec Servers -> RADIUS configuration

        s.tab('radius', _('RADIUS specific configuration'));
        o = s.taboption('radius', form.Flag, 'requireMessageAuthenticator', _('requireMessageAuthenticator'), _('Require all responses from the server to contain a MessageAuthenticator attribute. Only disable if the server cannot send MessageAuthenticator.'));
        o.default = true;
        o.depends('type', 'udp');
        o.depends('type', 'tcp');
        o.modalonly = true;

        o = s.taboption('radius', form.Flag, 'statusServer', _('StatusServer'), _('Enable Status-Server to check availability of the server'));
        o.default = true;
        o.rmempty = false;
        o.modalonly = true;

        o = s.taboption('radius', form.Value, 'AddTTL', _('AddTTL'), _('Add a TTL attribute with this value (if not present, overwrites global setting). Allowed values 1-255'));
        o.datatype = 'uinteger';
        o.rmempty = true;
        o.modalonly = true;


        let server_rewritein = s.taboption('radius', form.ListValue, 'rewriteIn', _('RewriteIn'), _('Rewrite all incoming RADIUS packets according to the rewrite block referenced here. If left empty, it uses the <code>default</code> or <code>defaultServer</code> rewrites (if they are defined).'));
        server_rewritein.datatype = 'string';
        server_rewritein.optional = true;
        server_rewritein.modalonly = true;
        let server_rewriteout = s.taboption('radius', form.ListValue, 'rewriteOut', _('RewriteOut'), _('Rewrite all outgoing RADIUS packets according to the rewrite block referenced here.'));
        server_rewriteout.datatype = 'string';
        server_rewriteout.optional = true;
        server_rewriteout.modalonly = true;

        o = s.taboption('radius', form.ListValue, 'LoopPrevention', _('LoopPrevention'), _('Enable Loop Prevention for this specific server (overrides global default).'));
        o.rmempty = true;
        o.value('', 'Global default');
        o.value('0', 'Disabled');
        o.value('1', 'Enabled');
        o.modalonly = true;

        o = s.taboption('radius', form.Value, 'retryCount', _('RetryCount'), _('Amount of times radsecproxy should try to retransmit the packet if no answer was received.'));
        o.datatype = 'uinteger';
        o.rmempty = true;
        o.placeholder = "2";
        o.depends('type', 'udp');
        o.depends('type', 'dtls');
        o.modalonly = true;

        o = s.taboption('radius', form.Value, 'retryInterval', _('RetryInterval'), _('Amount of seconds between retransmissions.'));
        o.datatype = 'uinteger';
        o.rmempty = true;
        o.placeholder = "5";
        o.depends('type', 'udp');
        o.depends('type', 'dtls');
        o.modalonly = true;

        // RadSec Servers -> dynamic discovery

        s.tab('dynamic', _('Dynamic Discovery'));
        o = s.taboption('dynamic', form.Value, 'dynamicLookupCommand', _('dynamicLookupCommand'), _('Discover the server dynamically, either by custom script or by DNS lookup.<br/>For DNS lookup use <code>naptr:&lt;service&gt;</code> or <code>srv:&lt;prefix&gt;</code>. For eduroam, use <code>naptr:x-eduroam:radius.tls</code>'));
        o.datatype = 'string';
        o.rmempty = true;
        o.modalonly = true;

        o = s.taboption('dynamic', form.Flag, 'blockingStartup', _('blockingStartup'), _('Treat this server as if it is already connected. Packets for a new realm will be queued instead of being failed over to the next server in the realm. May cause delays (or even drops) for initial connections, but uses the same route for all packets.'));
        o.default = false;
        o.modalonly = true;

        //--------//
        // Realms //
        //--------//

        s = m.section(form.GridSection, 'realm', 'Realms', _('Realms will be interpreted in order, first match wins.'));
        s.tab('realm', _('Realm Config'));
        s.addremove = true;
        s.optional = false;
        s.anonymous = true;
        s.sortable = true;
        s.nodescriptions = true;

        o = s.taboption('realm', form.Value, 'name', _('Realm'), _('Realm to route. Can be a simple string (e.g., <code>example.com</code>), a regular rexpression (e.g., <code>/@example\\.(com|org)$/</code>), or a wildcard (<code>*</code>)'));
        o.datatype = 'string';

        o = s.option(form.DummyValue, 'action', _('Action'));
        o.cfgvalue = function(section_id, value) {
            var servers = uci.get('radsecproxy', section_id, 'server');
            var replyMessage = uci.get('radsecproxy', section_id, 'replyMessage');
            if (servers) {
                return 'Forward to: ' + servers;
            } else if (replyMessage) {
                return 'Reject: ' + replyMessage;
            } else {
                return '(No action)';
            }
        };

        let realm_servers  = s.taboption('realm', form.DynamicList, 'server', _('Server'), _('Servers to route access requests for this realm to.'));
        realm_servers.datatype = 'string';
        realm_servers.optional = true;
        realm_servers.modalonly = true;

        let realm_accounting = s.taboption('realm', form.DynamicList, 'accountingServer', _('Accounting server'), _('Servers to route accounting requests for this realm to.'));
        realm_accounting.datatype = 'string';
        realm_accounting.optional = true;
        realm_accounting.modalonly = true;

        o = s.taboption('realm', form.Value, 'replyMessage', _('Reply message'), _('Reject access requests for this realm with this message'));
        o.datatype = 'string';
        o.optional = true;
        o.modalonly = true;
        o.depends('server', []);

        o = s.taboption('realm', form.Flag, 'accountingResponse', _('Accounting response'), _('If no accounting servers are configured, reply to Accounting-Requests with Accounting-Response instead of ignoring the packet.'));
        o.modalonly = true;
        o.depends('accountingServer', []);

        //------------------------------------------//
        // Custom load script for block references: //
        //   tls - server - rewrite                 //
        //------------------------------------------//

        uci.load('radsecproxy').then(function() {
            uci.sections('radsecproxy', 'tls').forEach(function(section) {
                if (section.name) {
                    client_tls.value(section.name);
                    server_tls.value(section.name);
                }
            });
            uci.sections('radsecproxy', 'rewrite').forEach(function(section) {
                if (section.name) {
                    client_rewritein.value(section.name);
                    client_rewriteout.value(section.name);
                    server_rewritein.value(section.name);
                    server_rewriteout.value(section.name);
                }
            });
            uci.sections('radsecproxy', 'server').forEach(function(section) {
                if (section.name) {
                    realm_servers.value(section.name);
                    realm_accounting.value(section.name);
                }
            });
        });


        return m.render();
    }
});
