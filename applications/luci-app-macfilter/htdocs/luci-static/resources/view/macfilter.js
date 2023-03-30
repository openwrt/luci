'use strict';
'require form';
'require view';
'require network';

return view.extend({
	load: function() {
		return network.getHostHints();
	},

	render: function(hints) {
		var m, s, o;

		m = new form.Map('firewall');

		s = m.section(form.TableSection, 'rule', _('MAC Addresses'));
		s.anonymous = true;
		s.addremove = true;
		s.filter = function(section_id) {
			var sectionObject = this.map.data.get('firewall', section_id);

			return (sectionObject.src == '*' &&
			        sectionObject.dest == 'wan' &&
			        sectionObject.proto == 'any' &&
			        sectionObject.target == 'ACCEPT');
		};
		s.handleAdd = function(ev) {
			var firstRuleSection = this.map.data.get_first('firewall', 'rule');
			var addedRuleID = this.map.data.add('firewall', 'rule');

			this.map.data.set('firewall', addedRuleID, 'enabled', '1');
			this.map.data.set('firewall', addedRuleID, 'src', '*');
			this.map.data.set('firewall', addedRuleID, 'dest', 'wan');
			this.map.data.set('firewall', addedRuleID, 'target', 'ACCEPT');
			this.map.data.set('firewall', addedRuleID, 'proto', 'any');

			// if a previous rule section existed, move the new one before it
			if (firstRuleSection)
				this.map.data.move('firewall', addedRuleID, firstRuleSection['.name']);

			return this.map.save(null, true);
		};

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = o.enabled;

		o = s.option(form.Value, 'name', _('Description'));

		o = s.option(form.Value, 'src_mac', _('MAC address'));
		hints.getMACHints(false).forEach(function(hint) { 
			o.value(hint[0], hint[1]); 
		});

		return m.render();
	}
});
