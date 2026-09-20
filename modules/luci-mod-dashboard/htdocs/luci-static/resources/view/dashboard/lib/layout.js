'use strict';
'require baseclass';
'require form';
'require uci';
'require ui';
'require view.dashboard.lib.widgets as widgets';

return baseclass.extend({
	render(includes) {
		const slots = {
			cards: _('Status cards'),
			charts: _('Live charts'),
			tabs: _('Detail tabs')
		};

		const m = new form.Map('dashboard');
		const s = m.section(form.NamedSection, 'layout', 'dashboard', null,
			_('The lists follow the page from top to bottom. What is in a list is shown, in that order: drag an entry to move it. An empty list shows the defaults.'));

		widgets.slots.forEach(slot => {
			const choices = widgets.list(includes, slot);

			if (!choices.length)
				return;

			const o = s.option(form.DynamicList, slot, slots[slot]);

			choices.forEach(widget => o.value(widget.id, widget.title));

			// Show the defaults while the slot is not configured, without
			// writing them.
			o.cfgvalue = () => {
				const known = choices.map(widget => widget.id);
				const ids = L.toArray(uci.get('dashboard', 'layout', slot)).filter(id => known.includes(id));

				return ids.length ? ids : widgets.defaults(includes, slot);
			};

			// The list hides a choice once it is picked, but not the ones it
			// starts out with, and always offers a custom value.
			o.renderWidget = function(section_id, option_index, cfgvalue) {
				const node = form.DynamicList.prototype.renderWidget.apply(this, arguments);
				const shown = L.toArray(cfgvalue);

				node.querySelectorAll('.cbi-dropdown ul > li[data-value]').forEach(li => {
					if (shown.includes(li.getAttribute('data-value')))
						li.setAttribute('unselectable', '');
				});
				node.querySelector('.create-item-input').parentNode.remove();

				return node;
			};
		});

		return m.render().then(node => E('div', {}, [
			node,
			E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'class': 'cbi-button cbi-button-apply',
					'click': ui.createHandlerFn(this, () => m.save().then(() => ui.changes.apply(true)))
				}, [ _('Save & Apply') ])
			])
		]));
	}
});
