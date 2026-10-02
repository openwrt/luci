'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require tools.weechat as weechatTools';

var CBIAutoJoin = form.Value.extend({
	validate: function(section_id, value) {
		var el = document.getElementById(this.cbid(section_id));
		if (el && el.parentNode) {
			var rows = el.parentNode.querySelectorAll('tr[data-channel-row]');
			for (var i = 0; i < rows.length; i++) {
				var chanInput = rows[i].querySelector('.chan-input');
				var keyInput = rows[i].querySelector('.key-input');
				var chan = (chanInput ? chanInput.value : '').trim();
				var key = (keyInput ? keyInput.value : '').trim();

				if (!chan && key)
					return _('Channel key cannot be specified without a channel name');
				if (chan && (chan.indexOf(',') !== -1 || /\s/.test(chan)))
					return _('Channel name "%s" cannot contain commas or spaces').format(chan);
				if (key && (key.indexOf(',') !== -1 || /\s/.test(key)))
					return _('Channel key cannot contain commas or spaces');
			}
		}
		return true;
	},

	textvalue: function(section_id) {
		var val = this.cfgvalue(section_id);
		var parsed = weechatTools.parseAutoJoin(val);
		if (parsed.channels.length === 0)
			return null;

		var nodes = [];
		parsed.channels.forEach(function(chan, idx) {
			if (idx > 0)
				nodes.push(', ');
			nodes.push(E('code', {}, chan));
		});
		return E('span', {}, nodes);
	},

	renderWidget: function(section_id, option_index, cfgvalue) {
		var isReadonly = (this.readonly != null) ? this.readonly : this.map.readonly;
		var hidden = new ui.Hiddenfield((cfgvalue != null) ? cfgvalue : '', {
			id: this.cbid(section_id)
		});

		var table = E('table', { 'class': 'table cbi-section-table' }, [
			E('tr', { 'class': 'tr cbi-section-table-titles' }, [
				E('th', { 'class': 'th cbi-section-table-cell' }, _('Channel')),
				E('th', { 'class': 'th cbi-section-table-cell' }, _('Key')),
				E('th', { 'class': 'th cbi-section-table-cell cbi-section-actions' }, '')
			])
		]);

		function updateValue() {
			var rows = table.querySelectorAll('tr[data-channel-row]');
			var chansWithKeys = [];
			var chansWithoutKeys = [];

			rows.forEach(function(row) {
				var chanInput = row.querySelector('.chan-input');
				var keyInput = row.querySelector('.key-input');
				var chan = (chanInput ? chanInput.value : '').trim();
				var key = (keyInput ? keyInput.value : '').trim();

				if (!chan)
					return;

				if (key)
					chansWithKeys.push({ chan: chan, key: key });
				else
					chansWithoutKeys.push(chan);
			});

			var allChans = chansWithKeys.map(function(item) { return item.chan; }).concat(chansWithoutKeys);
			var allKeys = chansWithKeys.map(function(item) { return item.key; });
			var result = allChans.join(',');
			if (allKeys.length > 0)
				result += ' ' + allKeys.join(',');

			hidden.setValue(result);
		}

		function createRow(channel, key) {
			var chanInput = E('input', {
				'type': 'text',
				'class': 'cbi-input-text chan-input',
				'placeholder': '#openwrt',
				'value': channel || '',
				'disabled': isReadonly || null
			});

			chanInput.addEventListener('input', function() {
				if (chanInput.value.indexOf(',') !== -1 || /\s/.test(chanInput.value)) {
					chanInput.classList.add('cbi-input-invalid');
					chanInput.title = _('Enter a single channel per row without commas or spaces');
				} else {
					chanInput.classList.remove('cbi-input-invalid');
					chanInput.removeAttribute('title');
				}
				updateValue();
			});

			var keyInput = E('input', {
				'type': 'password',
				'class': 'cbi-input-text key-input',
				'placeholder': _('Optional key'),
				'value': key || '',
				'disabled': isReadonly || null
			});

			keyInput.addEventListener('input', function() {
				if (keyInput.value.indexOf(',') !== -1 || /\s/.test(keyInput.value)) {
					keyInput.classList.add('cbi-input-invalid');
					keyInput.title = _('Channel key cannot contain commas or spaces');
				} else {
					keyInput.classList.remove('cbi-input-invalid');
					keyInput.removeAttribute('title');
				}
				updateValue();
			});

			var btnRemove = E('button', {
				'type': 'button',
				'class': 'btn cbi-button cbi-button-remove',
				'title': _('Remove'),
				'disabled': isReadonly || null
			}, '✕');

			var row = E('tr', {
				'class': 'tr cbi-section-table-row',
				'data-channel-row': ''
			}, [
				E('td', { 'class': 'td cbi-section-table-cell' }, chanInput),
				E('td', { 'class': 'td cbi-section-table-cell' }, keyInput),
				E('td', { 'class': 'td cbi-section-table-cell cbi-section-actions' }, btnRemove)
			]);

			btnRemove.addEventListener('click', function() {
				row.remove();
				updateValue();
			});

			return row;
		}

		var parsed = weechatTools.parseAutoJoin(cfgvalue != null ? cfgvalue : '');
		if (parsed.channels.length > 0) {
			parsed.channels.forEach(function(chan, idx) {
				table.appendChild(createRow(chan, parsed.keys[idx] || ''));
			});
		}
		else {
			table.appendChild(createRow('', ''));
		}

		var btnAdd = E('button', {
			'type': 'button',
			'class': 'btn cbi-button cbi-button-add',
			'disabled': isReadonly || null
		}, _('Add channel'));

		btnAdd.addEventListener('click', function() {
			var newRow = createRow('', '');
			table.appendChild(newRow);
			var input = newRow.querySelector('.chan-input');
			if (input)
				input.focus();
		});

		return E('div', { 'class': 'cbi-value-field' }, [
			table,
			btnAdd,
			hidden.render()
		]);
	}
});

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('weechat', _('WeeChat - IRC Servers'),
			_('Configure IRC server connections, authentication, and auto-join channels.'));

		s = m.section(form.GridSection, 'server', _('IRC Servers'));
		s.addremove = true;
		s.anonymous = false;
		s.addbtntitle = _('Add Server');
		s.nodescriptions = true;

		s.sectiontitle = function(section_id) {
			return section_id;
		};

		/* Define Tabs */
		s.tab('connection', _('Connection'));
		s.tab('identity', _('Identity'));
		s.tab('auth', _('Authentication'));
		s.tab('channels', _('Channels'));

		/* Connection settings (table columns + modal Connection tab) */
		o = s.taboption('connection', form.Value, 'address', _('Server Hostname'),
			_('Hostname or IP address of the IRC server.'));
		o.placeholder = 'irc.oftc.net';
		o.rmempty = false;

		o = s.taboption('connection', form.Value, 'port', _('Port'));
		o.datatype = 'port';
		o.default = '6697';
		o.placeholder = '6697';

		o = s.taboption('connection', form.Flag, 'ssl', _('Use TLS'));
		o.default = o.enabled;
		o.rmempty = false;

		o = s.taboption('connection', form.ListValue, 'ipv6', _('IPv6 Support'),
			_('IPv6 connection mode for this IRC server.'));
		o.value('auto', _('Auto'));
		o.value('force', _('Force IPv6'));
		o.value('disable', _('Disable IPv6'));
		o.default = 'auto';
		o.textvalue = function(section_id) {
			var val = this.cfgvalue(section_id) || this.default;
			switch (val) {
			case 'force': return _('Force IPv6');
			case 'disable': return _('Disabled');
			case 'auto':
			default:
				return _('Auto');
			}
		};

		/* Channels (table column + modal Channels tab) */
		o = s.taboption('channels', CBIAutoJoin, 'autojoin', _('Auto-join Channels'),
			_('Channels to join automatically after connecting to this server.'));
		o.rmempty = true;

		/* Auto-connect & Enabled flags (table columns + modal Connection tab) */
		o = s.taboption('connection', form.Flag, 'autoconnect', _('Auto-connect'),
			_('Connect automatically when WeeChat starts.'));
		o.default = o.enabled;
		o.rmempty = false;
		o.editable = true;

		o = s.taboption('connection', form.Flag, 'enabled', _('Enabled'));
		o.default = o.enabled;
		o.rmempty = false;
		o.editable = true;

		/* Tab 2: Identity */
		o = s.taboption('identity', form.Value, 'nicks', _('Nicknames'),
			_('Comma-separated list of nicknames to try.'));
		o.placeholder = 'weechat,weechat_';
		o.modalonly = true;

		o = s.taboption('identity', form.Value, 'username', _('Username'));
		o.placeholder = 'weechat';
		o.modalonly = true;

		o = s.taboption('identity', form.Value, 'realname', _('Real Name'));
		o.placeholder = 'WeeChat User';
		o.modalonly = true;

		/* Tab 3: Authentication */
		o = s.taboption('auth', form.ListValue, 'auth_method', _('Authentication Method'),
			_('Select the authentication method required by the IRC network.'));
		o.value('none', _('None'));
		o.value('nickserv', _('NickServ (/msg nickserv identify)'));
		o.value('sasl_plain', _('SASL PLAIN'));
		o.value('sasl_scram_sha_256', _('SASL SCRAM-SHA-256'));
		o.value('sasl_scram_sha_512', _('SASL SCRAM-SHA-512'));
		o.default = 'none';
		o.modalonly = true;

		o = s.taboption('auth', form.Value, 'sasl_username', _('SASL Username'),
			_('Account username if different from nickname.'));
		o.depends('auth_method', 'sasl_plain');
		o.depends('auth_method', 'sasl_scram_sha_256');
		o.depends('auth_method', 'sasl_scram_sha_512');
		o.modalonly = true;

		o = s.taboption('auth', form.Value, 'password', _('Password'));
		o.password = true;
		o.depends('auth_method', 'nickserv');
		o.depends('auth_method', 'sasl_plain');
		o.depends('auth_method', 'sasl_scram_sha_256');
		o.depends('auth_method', 'sasl_scram_sha_512');
		o.modalonly = true;

		return m.render().then(L.bind(function(nodes) {
			var target = null;
			var hashMatch = (window.location.hash || '').match(/#(?:edit|server)=([^&]+)/);
			if (hashMatch) {
				target = decodeURIComponent(hashMatch[1]);
			} else {
				var params = new URLSearchParams(window.location.search);
				target = params.get('server') || params.get('edit');
			}

			if (target && (m.data.get('weechat', target) || uci.get('weechat', target))) {
				if (window.history && window.history.replaceState) {
					var cleanSearch = window.location.search ? window.location.search.replace(/[?&](?:server|edit)=[^&]*/g, '').replace(/^&/, '?') : '';
					window.history.replaceState(null, '', window.location.pathname + cleanSearch);
				}
				s.renderMoreOptionsModal(target);
			}

			return nodes;
		}, this));
	}
});
