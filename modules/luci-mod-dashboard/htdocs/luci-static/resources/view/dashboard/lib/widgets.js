'use strict';
'require baseclass';
'require fs';
'require uci';

const SLOTS = [ 'cards', 'charts', 'tabs' ];

return baseclass.extend({
	slots: SLOTS,

	load() {
		return L.resolveDefault(fs.list('/www' + L.resource('view/dashboard/include')), []).then(entries => {
			return Promise.all(entries.filter(e => {
				return (e.type == 'file' && e.name.match(/\.js$/));
			}).map(e => {
				return 'view.dashboard.include.' + e.name.replace(/\.js$/, '');
			}).sort().map(n => {
				return L.require(n);
			}));
		}).then(includes => {
			return Promise.all(includes.map(include => new Promise(resolve => {
				resolve((typeof(include.available) == 'function') ? include.available() : true);
			}).catch(e => {
				console.error(e);
				return false;
			}))).then(flags => includes.filter((include, i) => flags[i]));
		});
	},

	list(includes, slot) {
		return includes.reduce((list, include) => list.concat(include.widgets || []), [])
			.filter(widget => widget.slot == slot)
			.sort((a, b) => (a.order || 0) - (b.order || 0));
	},

	defaults(includes, slot) {
		return this.list(includes, slot).filter(widget => !widget.hidden).map(widget => widget.id);
	},

	// Navigation from a visible widget must not depend on the saved tab list.
	// Only add destinations supplied by includes available on this device;
	// rendering still omits tabs whose data could not be loaded.
	requiredTabs(includes, layout) {
		const knownTabs = new Set(this.list(includes, 'tabs').map(widget => widget.id));
		const required = new Set();
		for (const include of includes)
			for (const widget of include.widgets || [])
				if (layout[widget.slot]?.includes(widget.id))
					for (const id of widget.detailTabs || [])
						if (knownTabs.has(id))
							required.add(id);
		return required;
	},

	resolveLayout(includes, layout) {
		const resolved = Object.fromEntries(SLOTS.map(slot => [ slot, layout[slot].slice() ]));
		for (const id of this.requiredTabs(includes, layout))
			if (!resolved.tabs.includes(id))
				resolved.tabs.push(id);
		return resolved;
	},

	// The ids to show in each slot, in display order. A slot that is not
	// configured shows its defaults: UCI cannot store an empty list, so
	// emptying one brings them back. Ids this device does not know, from
	// a restored config or typed by hand, are ignored.
	configuredLayout(includes) {
		const layout = {};
		SLOTS.forEach(slot => {
			const known = this.list(includes, slot).map(widget => widget.id);
			const ids = L.toArray(uci.get('dashboard', 'layout', slot)).filter((id, i, list) => {
				return known.includes(id) && list.indexOf(id) == i;
			});
			layout[slot] = ids.length ? ids : this.defaults(includes, slot);
		});
		return layout;
	},

	layout(includes) {
		return L.resolveDefault(uci.load('dashboard')).then(() => this.resolveLayout(includes, this.configuredLayout(includes)));
	}
});
