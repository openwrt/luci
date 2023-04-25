'use strict';
'require baseclass';
'require fs';
'require uci';
'require form';

return baseclass.extend({
	title: _('Iptables Plugin Configuration'),
	description: _('The iptables plugin will monitor selected firewall rules and collect information about processed bytes and packets per rule.'),

	addFormOptions: function(s) {
		var o, ss;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		for (var family = 4; family <= 6; family += 2) {
			var suffix = (family == 4 ? '' : '6');

			o = s.option(form.SectionValue, '__match' + suffix, form.TableSection, 'collectd_iptables_match' + suffix,
				suffix ? _('Match IPv6 iptables rules') : _('Match IPv4 iptables rules'),
				_('Here you can define various criteria by which the monitored iptables rules are selected.'));

			o.depends('enable', '1');
			o.load = L.bind(function(suffix, section_id) {
				return L.resolveDefault(fs.exec_direct('/usr/sbin/ip' + suffix + 'tables-save', []), '').then(L.bind(function(res) {
					var lines = res.split(/\n/),
					    table, chain, count, iptables = {};

					for (var i = 0; i < lines.length; i++) {
						var m;

						if ((m = lines[i].match(/^\*(\S+)$/)) != null) {
							table = m[1];
							count = {};
						}
						else if ((m = lines[i].match(/^-A (.+?) ([!-].+)$/)) != null) {
							count[m[1]] = (count[m[1]] || 0) + 1;

							iptables[table] = iptables[table] || {};
							iptables[table][m[1]] = iptables[table][m[1]] || {};
							iptables[table][m[1]][count[m[1]]] = E('span', {
								'style': 'overflow:hidden; text-overflow:ellipsis; max-width:200px',
								'data-tooltip': m[2]
							}, [
								'#%d: '.format(count[m[1]]),
								m[2].replace(/-m comment --comment "(.+?)" /, '')
							]);

							/*
							 * collectd currently does not support comments with spaces:
							 * https://github.com/collectd/collectd/issues/2766
							 */
							var c = m[2].match(/-m comment --comment "(.+)" -/);
							if (c && c[1] != '!fw3' && !c[1].match(/[ \t\n]/))
								iptables[table][m[1]][c[1]] = E('span', {}, [ c[1] ]);
						}
					}

					this.subsection.iptables = iptables;

					return form.SectionValue.prototype.load.apply(this, [section_id]);
				}, this));
			}, o, suffix);

			ss = o.subsection;
			ss.anonymous = true;
			ss.addremove = true;
			ss.addbtntitle = suffix ? _('Add IPv6 rule selector') : _('Add IPv4 rule selector');

			o = ss.option(form.Value, 'name', _('Instance name'));
			o.datatype = 'maxlength(63)';
			o.validate = function(section_id, v) {
				var table_opt = this.section.children.filter(function(o) { return o.option == 'table' })[0],
				    table_elem = table_opt.getUIElement(section_id);

				table_elem.clearChoices();
				table_elem.addChoices(Object.keys(this.section.iptables).sort());

				if (v != '' && v.match(/[ \t\n]/))
					return _('The instance name must not contain spaces');

				return true;
			};

			o = ss.option(form.Value, 'table', _('Table'));
			o.default = 'filter';
			o.optional = true;
			o.transformChoices = function() { return this.super('transformChoices', []) || {} };
			o.validate = function(section_id, table) {
				var chain_opt = this.section.children.filter(function(o) { return o.option == 'chain' })[0],
				    chain_elem = chain_opt.getUIElement(section_id);

				chain_elem.clearChoices();
				chain_elem.addChoices(Object.keys(this.section.iptables[table]).sort());

				return true;
			};

			o = ss.option(form.Value, 'chain', _('Chain'));
			o.optional = true;
			o.transformChoices = function() { return this.super('transformChoices', []) || {} };
			o.validate = function(section_id, chain) {
				var table_opt = this.section.children.filter(function(o) { return o.option == 'table' })[0],
				    rule_opt = this.section.children.filter(function(o) { return o.option == 'rule' })[0],
				    rule_elem = rule_opt.getUIElement(section_id),
				    table = table_opt.formvalue(section_id);

				rule_elem.clearChoices();

				if (this.section.iptables[table][chain]) {
					var keys = Object.keys(this.section.iptables[table][chain]).sort(function(a, b) {
						var x = a.match(/^(\d+)/),
						    y = b.match(/^(\d+)/);

						if (x && y)
							return +x[1] > +y[1];
						else if (x || y)
							return +!!x > +!!y;
						else
							return a > b;
					});

					var labels = {};

					for (var i = 0; i < keys.length; i++)
						labels[keys[i]] = this.section.iptables[table][chain][keys[i]].cloneNode(true);

					rule_elem.addChoices(keys, labels);
				}

				if (chain != '' && chain.match(/[ \t\n]/))
					return _('The chain name must not contain spaces');

				return true;
			};

			o = ss.option(form.Value, 'rule', _('Comment / Rule Number'));
			o.optional = true;
			o.transformChoices = function() { return this.super('transformChoices', []) || {} };
			o.load = function(section_id) {
				var table = uci.get('luci_statistics', section_id, 'table'),
				    chain = uci.get('luci_statistics', section_id, 'chain'),
				    rule = uci.get('luci_statistics', section_id, 'rule'),
				    ipt = this.section.iptables;

				if (ipt[table] && ipt[table][chain] && ipt[table][chain][rule])
					this.value(rule, ipt[table][chain][rule].cloneNode(true));

				return rule;
			};
			o.validate = function(section_id, rule) {
				if (rule != '' && rule.match(/[ \t\n]/))
					return _('The comment to match must not contain spaces');

				return true;
			};
		}
	},

	configSummary: function(section) {
		return _('Rule monitoring enabled');
	}
});
