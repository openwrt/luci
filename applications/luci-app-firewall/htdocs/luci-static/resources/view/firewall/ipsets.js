'use strict';
'require view';
'require uci';
'require form';
'require firewall';
'require validation';
'require tools.firewall as fwtool';


/* Validate a single value against one of the validation library's types.
   The type of a set entry value is only known at runtime, from the match
   field the value belongs to, so the stub replaces the `datatype` property. */
const stubValidator = {
	factory: validation,
	apply(type, value, args) {
		if (value != null)
			this.value = value;

		return validation.types[type].apply(this, args);
	},
	assert(condition) {
		return !!condition;
	}
};

/* fw4 reads one value per match field from an entry, separated by blanks,
   in the order of the fields: `192.0.2.1 00:11:22:33:44:55` for a set with
   `src_ip src_mac`. Validate the value of field `i` of a `match` list. */
function validateEntryValue(match, family, i, value) {
	const type = match[i].replace(/^(?:src|dst|dest)_/, '');
	const v4 = (family == 'ipv4');
	const v6 = (family == 'ipv6');

	switch (type) {
	case 'ip':
		/* fw4 silently drops a mask here */
		if (!stubValidator.apply(v4 ? 'ip4addr' : (v6 ? 'ip6addr' : 'ipaddr'), value, [true]))
			return v4 ? _('valid IPv4 address') : (v6 ? _('valid IPv6 address') : _('valid IP address'));
		break;

	case 'net':
		if (!stubValidator.apply(v4 ? 'ip4addr' : (v6 ? 'ip6addr' : 'ipaddr'), value))
			return v4 ? _('valid IPv4 address or network') : (v6 ? _('valid IPv6 address or network') : _('valid IP address or prefix'));
		break;

	case 'mac':
		if (!stubValidator.apply('macaddr', value))
			return _('valid MAC address');
		break;

	case 'port':
		/* fw4 rejects port ranges in set entries */
		if (!stubValidator.apply('port', value))
			return _('valid port value');
		break;
	}

	return null;
}

return view.extend({

	load() {
		return Promise.all([
			uci.load('firewall')
		]);
	},

	render() {
		let m, s, o;

		m = new form.Map('firewall', _('Firewall - IP sets'),
			_('firewall4 supports referencing and creating IP sets to simplify matching of large address lists without the need to create one rule per item to match. Port ranges in ipsets are unsupported by firewall4.<br />'));

		const have_fw4 = L.hasSystemFeature('firewall4');

		if (have_fw4) {
			s = m.section(form.NamedSection, 'fwver', 'fwver', '', _('Your device runs firewall4.'));
		} else {
			s = m.section(form.NamedSection, 'fwver', 'fwver', '', _('Your device does not run firewall4.'));
		}


		s = m.section(form.GridSection, 'ipset', _('IP Sets'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable  = true;
		s.cloneable = true;
		s.nodescriptions = true;


		/* refer to: https://ipset.netfilter.org/ipset.man.html */
		if (have_fw4) {
			o = s.option(form.Value, 'name', _('Name'));
			o.optional = false;
			o.rmempty = false;
			o.validate = function (section_id, value) {
				if (!/^[a-zA-Z_.][a-zA-Z0-9/_.-]*$/.test(value))
					return _('Invalid set name');

				return true;
			};
		} else {
			o = s.option(form.Value, 'name', _('Name'));
			o.depends({ external: '' });
			/*  Default: (none) if external is unset
			  value of external if external is set */
		}
		o.placeholder = _('Unnamed set');


		/* comment requires https://git.openwrt.org/?p=project/firewall4.git;a=commitdiff;h=39e8c70957c795bf0c12f04299170ae86c6efdf8 */
		o = s.option(form.Value, 'comment', _('Comment'));
		o.placeholder = _('Comment');
		o.modalonly = true;
		o.rmempty = true;


		o = s.option(form.ListValue, 'family', _('Family'));
		o.value('any', _('IPv4 and IPv6'))
		o.value('ipv4', _('IPv4'));
		o.value('ipv6', _('IPv6'));
		o.default = 'ipv4';


		/* Direction src, dst; (Data)Types: ip, port, mac, net or set
		   Tuples: direction_datatype e.g. src_port, dest_net */
		o = s.option(form.DynamicList, 'match', _('Packet Field Match'),
			_('Packet fields to match upon.<br />' +
			  'Syntax: <em>direction_datatype</em>. e.g.: <code>src_port, dest_net</code>.<br />' +
			  'Directions: <code>src, dst</code>. Datatypes: <code>ip, port, mac, net, set</code>.<br />' +
			  'Direction prefixes are optional.<br />' +
			  '*Note: datatype <code>set</code> is unsupported in fw4.'));
		o.value('ip', _('ip: IP addr'));
		o.value('port', _('port: Port'));
		o.value('mac', _('mac: MAC addr'));
		o.value('net', _('net: (sub)net'));
		if (!have_fw4)
			o.value('set', _('set: ipset*'));
		o.value('src_ip', _('src_ip: Source IP'));
		o.value('src_port', _('src_port: Source Port'));
		o.value('src_mac', _('src_mac: Source MAC addr'));
		o.value('src_net', _('src_net: Source (sub)net'));
		if (!have_fw4)
			o.value('src_set', _('src_Set: Source ipset*')); // fw4 unsupported
		o.value('dest_ip', _('dest_ip: Destination IP'));
		o.value('dest_port', _('dest_port: Destination Port'));
		o.value('dest_mac', _('dest_mac: Destination MAC addr'));
		o.value('dest_net', _('dest_net: Destination (sub)net'));
		if (!have_fw4)
			o.value('dest_set', _('dest_set: Destination ipset*')); // fw4 unsupported
		o.optional = false;
		o.rmempty = false;


		// TODO: if/when firewall5 arrives, this 'else' check must change.
		if (have_fw4) {

			//we have fw4
			o = s.option(form.DynamicList, 'entry', _('IPs/Networks/MACs'),
				_('One value per match field, separated by blanks, in the order of the fields.<br />' +
				  'ip: <code>addr</code>; net: <code>addr[/cidr]</code>; mac: <code>macaddr</code>; port: <code>port</code>.<br />' +
				  'E.g. <code>192.0.2.1 00:11:22:33:44:55</code> for <code>src_ip src_mac</code>.'));
			o.rmempty = true;
			o.validate = function(section_id, value) {
				if (value == null || value == '')
					return true;

				const match = L.toArray(this.section.formvalue(section_id, 'match'));
				const family = this.section.formvalue(section_id, 'family');
				const values = value.trim().split(/[ \t]+/);

				if (match.length == 0)
					return true;

				if (values.length != match.length)
					return _('Expecting: one value per match field (%d), separated by blanks').format(match.length);

				for (let i = 0; i < values.length; i++) {
					const err = validateEntryValue(match, family, i, values[i]);

					if (err != null)
						return _('Expecting: %s for match field "%s"').format(err, match[i]);
				}

				return true;
			};


			o = s.option(form.Value, 'maxelem', _('Max Entries'),
				_('up to 65536 entries.'));
			o.datatype = 'port'; //covers 16 bit size
			o.modalonly = true;
			o.rmempty = true;

		} else {
			// this else section is intended to handle firewall3

			o = s.option(form.Value, 'external', _('Refer To External Set'));
			/* Todo: loop to fill o.values with all other ipset names except itself */
			o.rmempty = true;
			o.optional = true;


			/* 'storage' depends on fw3. It must be removed for fw4 */
			//aka 'method' in netfilter terminology.
			o = s.option(form.ListValue, 'storage', _('Storage Method'));
			o.value('bitmap', _('bitmap')); //ipv4 only
			o.value('hash', _('hash'));
			o.value('list', _('list'));
			o.validate = function(section_id, value) {
				const family = this.section.formvalue(section_id, 'family');
				if (value.match(/bitmap/) && !family.match(/ipv4/))
					return _('bitmap is ipv4 only');
				return true;
			}

			/* this iprange differs from netfilters range fromip-toip|ip/cidr:
			   uci enforces a datatype = cidr in order to be able to enter
			   an IP for all storage/data types.  */
			o = s.option(form.Value, 'iprange', _('IP (range)'),
				_('ip[/cidr]<br />'+
				  'For use with Match datatypes: <code>*_ip</code>.'));
			o.datatype = 'ipaddr';
			o.depends({family: 'ipv4', storage: 'bitmap', match: /_ip|_mac/ });
			o.depends({storage: 'hash', match: /_ip/ });


			o = s.option(form.DynamicList, 'entry', _('IPs/Networks'),
				_('ip[/cidr]<br />'));
			o.datatype = 'or(ipaddr,macaddr)';
			o.depends({storage: 'hash', match: /_ip|_net|_mac/ });


			o = s.option(form.Value, 'portrange', _('Port range'),
				_('fromport-toport'));
			o.datatype = 'neg(portrange)';
			o.depends({family: 'ipv4', storage: 'bitmap', match: /_port/ });
			o.depends({family: 'ipv4', storage: 'hash', match: /_port/ });
			o.depends({family: 'ipv6', storage: 'hash', match: /_port/ });


			o = s.option(form.Value, 'netmask', _('Netmask'));
			o.datatype = 'or(ip4prefix,ip6prefix)';
			o.depends({family: 'ipv4', storage: 'bitmap', match: /_ip/ });
			o.depends({storage: 'hash', match: /_ip/});


			o = s.option(form.Value, 'maxelem', _('Max Length'),
				_('up to 65536 entries.'));
			o.datatype = 'port'; //covers 16 bit size
			o.depends('storage', 'hash');
			o.depends('storage', 'list');
			o.modalonly = true;


			o = s.option(form.Value, 'hashsize', _('Initial Hash Size'));
			o.depends('storage', 'hash');
			o.placeholder = _('1024');
			o.modalonly = true;

		}

		o = s.option(form.FileUpload, 'loadfile', _('Include File'),
			_('Path to file of CIDRs, subnets, host IPs, etc.<br />'));
		o.root_directory = '/etc/luci-uploads';
		o.enable_delete = true;
		o.enable_upload = true;
		o.datatype = 'file';
		o.rmempty = true;


		o = s.option(form.Value, 'timeout', _('Timeout'),
			_('Unit: seconds. Default <code>0</code> means the entry is added permanently to the set.<br />' +
			  'Max: 2147483 seconds.'));
		o.placeholder = _('0');
		o.modalonly = true;
		o.rmempty = true;


		o = s.option(form.Flag, 'counters', _('Counters'),
			_('Enables packet and byte count tracking for the set.'));
		o.modalonly = true;
		o.rmempty = true;
		o.default = false;


		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = true;
		o.editable = true;
		o.modalonly = false;


		return m.render();
	}
});
