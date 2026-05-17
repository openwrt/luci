'use strict';
'require form';
'require view';
'require uci';
'require ui';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('mwan3')
		]);
	},

	render: function () {
		let m, s, o;

		m = new form.Map('mwan3', _('MultiWAN Manager - Policies'),
			_('Policies are profiles grouping one or more members controlling how Mwan3 distributes traffic.') + '<br />' +
			_('Member interfaces with lower metrics are used first.') + '<br />' +
			_('Member interfaces with the same metric will be load-balanced.') + '<br />' +
			_('Load-balanced member interfaces distribute more traffic out those with higher weights.') + '<br />' +
			_('Names may contain characters A-Z, a-z, 0-9, _ and no spaces.') + '<br />' +
			_('Names must be 15 characters or less.') + '<br />' +
			_('Policies may not share the same name as configured interfaces, members or rules'));

		s = m.section(form.GridSection, 'policy');
		s.addremove = true;
		s.anonymous = false;
		s.nodescriptions = true;

		/* This name length error check can likely be removed when mwan3 migrates to nftables */
		s.renderSectionAdd = function(extra_class) {
			var el = form.GridSection.prototype.renderSectionAdd.apply(this, arguments),
				nameEl = el.querySelector('.cbi-section-create-name');
			ui.addValidator(nameEl, 'uciname', true, function(v) {
				let sections = [
					...uci.sections('mwan3', 'interface'),
					...uci.sections('mwan3', 'member'),
					...uci.sections('mwan3', 'policy'),
					...uci.sections('mwan3', 'rule')
				];

				for (let j = 0; j < sections.length; j++) {
					if (sections[j]['.name'] == v) {
						return _('Policies may not share the same name as configured interfaces, members or rules');
					}
				}
				if (v.length > 15) return _('Name length shall not exceed 15 characters');
				return true;
			}, 'blur', 'keyup');
			return el;
		};

		o = s.option(form.DynamicList, 'use_member', _('Member used'));
		var options = uci.sections('mwan3', 'member')
		for (var i = 0; i < options.length; i++) {
			var value = options[i]['.name'];
			o.value(value);
		}

		o = s.option(form.ListValue, 'last_resort', _('Last resort'),
			_('When all policy members are offline use this behavior for matched traffic'));
		o.default = 'unreachable';
		o.value('unreachable', _('unreachable (reject)'));
		o.value('blackhole', _('blackhole (drop)'));
		o.value('default', _('default (use main routing table)'));

		return m.render();
	}
})
