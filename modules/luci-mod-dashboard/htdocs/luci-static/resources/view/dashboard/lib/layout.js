'use strict';
'require baseclass';
'require form';
'require uci';
'require ui';
'require view.dashboard.lib.widgets as widgets';

function attachOptions(map, lists, panels) {
	const parking = E('div', { 'hidden': '' });
	map.root.appendChild(parking);
	for (const panel of panels.filter(Boolean)) {
		const list = lists[panel.slot].getUIElement('layout');
		const fields = E('div', { 'class': 'dashboard-widget-options' },
			panel.options.map(option => map.findElement('data-field', option.cbid('layout'))));
		const summary = E('summary', {}, panel.title);
		const details = E('details', { 'class': 'dashboard-widget-settings' }, [ summary, fields ]);
		parking.appendChild(details);
		// Keep native form actions out of the dynamic list's delete/drag handlers.
		for (const type of [ 'click', 'keydown', 'touchstart', 'touchmove', 'touchend', 'dragstart', 'drop' ])
			fields.addEventListener(type, ev => ev.stopPropagation());
		summary.addEventListener('click', ev => ev.stopPropagation());
		summary.addEventListener('keydown', ev => ev.stopPropagation());
		const mount = () => {
			const item = Array.from(list.node.children).find(node =>
				node.matches('.item') && node.querySelector(':scope > input[type="hidden"]')?.value === panel.widget);
			if (item && details.parentNode !== item) {
				item.classList.add('dashboard-configurable');
				item.querySelector(':scope > span')?.remove();
				item.insertBefore(details, item.firstChild);
			}
		};
		const addItem = list.addItem, removeItem = list.removeItem;
		list.addItem = function() {
			const result = addItem.apply(this, arguments);
			mount();
			return result;
		};
		list.removeItem = function(node, item) {
			if (item.contains(details))
				parking.appendChild(details);
			return removeItem.apply(this, arguments);
		};
		mount();
	}
}

return baseclass.extend({
	render(includes) {
		const slots = {
			cards: _('Status cards'),
			charts: _('Live charts'),
			tabs: _('Detail tabs')
		};

		const m = new form.Map('dashboard');
		const s = m.section(form.NamedSection, 'layout', 'dashboard');
		const lists = {};

		widgets.slots.forEach(slot => {
			const choices = widgets.list(includes, slot);

			if (!choices.length)
				return;

			const o = lists[slot] = s.option(form.DynamicList, slot, slots[slot]);

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
				node.classList.add('dashboard-widget-list');
				// Native drop handling expects the item itself as the drop target.
				node.addEventListener('dragstart', () => node.classList.add('dashboard-sorting'));
				for (const type of [ 'dragend', 'drop' ])
					node.addEventListener(type, () => node.classList.remove('dashboard-sorting'));

				node.querySelectorAll('.cbi-dropdown ul > li[data-value]').forEach(li => {
					if (shown.includes(li.getAttribute('data-value')))
						li.setAttribute('unselectable', '');
				});
				node.querySelector('.create-item-input')?.parentNode.remove();

				return node;
			};
		});

		return Promise.all(includes.filter(include => typeof(include.addOptions) == 'function')
			.map(include => include.addOptions(s, form, ui))).then(panels => {
			const renderContents = m.renderContents;
			m.renderContents = function() {
				return renderContents.apply(this, arguments).then(node => {
					attachOptions(this, lists, panels);
					return node;
				});
			};
			return m.render();
		}).then(node => E('div', { 'class': 'dashboard-settings' }, [
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
