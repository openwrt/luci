/*
 * Copyright (c) 2018-2020, Tano Systems LLC. All Rights Reserved.
 * Anton Kikin <a.kikin@tano-systems.com>
 * Copyright (c) 2023-2024. All Rights Reserved.
 * Paul Donald <newtwen+github@gmail.com>
 */

'use strict';
'require ui';
'require form';
'require network';
'require session';
'require uci';

/*
 *	Filter neighbors (-H)
 *
 *	The filter column means that filtering is enabled
 *	The 1proto column tells that only one protocol will be kept.
 *	The 1neigh column tells that only one neighbor will be kept.
 *
 *	       incoming                outgoing
 *	    filter  1proto  1neigh  filter  1proto  1neigh
 *	0
 *	1    x       x               x       x
 *	2    x       x
 *	3                            x       x
 *	4    x                       x
 *	5    x
 *	6                            x
 *	7    x       x       x       x       x
 *	8    x       x       x
 *	9    x               x       x       x
 *	10                           x               x
 *	11   x               x
 *	12   x               x       x               x
 *	13   x               x       x
 *	14   x       x               x               x
 *	15   x       x               x
 *	16   x       x       x       x               x
 *	17   x       x       x       x
 *	18   x                       x               x
 *	19   x                       x       x
 */

const etitle = _('enable filter');
const ptitle = _('keep only one protocol');
const ntitle = _('keep only one neighbor');

var cbiFilterSelect = form.Value.extend({
	__name__: 'CBI.LLDPD.FilterSelect',

	__init__: function() {
		this.super('__init__', arguments);

		this.selected = null;

		this.filterVal = [
			[ 0, 0, 0, 0, 0, 0 ],
			[ 1, 1, 0, 1, 1, 0 ],
			[ 1, 1, 0, 0, 0, 0 ],
			[ 0, 0, 0, 1, 1, 0 ],
			[ 1, 0, 0, 1, 0, 0 ],
			[ 1, 0, 0, 0, 0, 0 ],
			[ 0, 0, 0, 1, 0, 0 ],
			[ 1, 1, 1, 1, 1, 0 ],
			[ 1, 1, 1, 0, 0, 0 ],
			[ 1, 0, 1, 1, 1, 0 ],
			[ 0, 0, 0, 1, 0, 1 ],
			[ 1, 0, 1, 0, 0, 0 ],
			[ 1, 0, 1, 1, 0, 1 ],
			[ 1, 0, 1, 1, 0, 0 ],
			[ 1, 1, 0, 1, 0, 1 ],
			[ 1, 1, 0, 1, 0, 0 ],
			[ 1, 1, 1, 1, 0, 1 ],
			[ 1, 1, 1, 1, 0, 0 ],
			[ 1, 0, 0, 1, 0, 1 ],
			[ 1, 0, 0, 1, 1, 0 ]
		];
	},

	/** @private */
	handleRowClick: function(section_id, ev) {
		var row = ev.currentTarget;
		var tbody = row.parentNode;
		var selected = row.getAttribute('data-filter');
		var input = tbody.querySelector('[id="' + this.cbid(section_id) + '-' + selected + '"]');

		this.selected = selected;

		tbody.querySelectorAll('tr').forEach(function(e) {
			e.classList.remove('lldpd-filter-selected');
		});

		input.checked = true;
		row.classList.add('lldpd-filter-selected');
	},

	formvalue: function(section_id) {
		return this.selected || this.cfgvalue(section_id);
	},

	renderFrame: function(section_id, in_table, option_index, nodes) {
		var tmp = this.description;

		// Prepend description with table legend
		this.description = 
			'<ul><li>' + 'E &mdash; ' + etitle + '</li>' +
			    '<li>' + 'P &mdash; ' + ptitle + '</li>' +
			    '<li>' + 'N &mdash; ' + ntitle + '</li>' +
			'</ul>' + this.description;

		var rendered = this.super('renderFrame', arguments);

		// Restore original description
		this.description = tmp;

		return rendered;
	},

	renderWidget: function(section_id, option_index, cfgvalue) {
		//default value is "15" - rows are zero based
		var selected = parseInt(cfgvalue) || 15;

		var tbody = [];

		var renderFilterVal = L.bind(function(row, col) {
			return this.filterVal[row][col] ? '&#x2714;' : '';
		}, this);

		for (var i = 0; i < this.filterVal.length; i++) {
			tbody.push(E('tr', {
				'class': ((selected == i) ? 'lldpd-filter-selected' : ''),
				'click': L.bind(this.handleRowClick, this, section_id),
				'data-filter': i,
			}, [
				E('td', {}, [
					E('input', {
						'class': 'cbi-input-radio',
						'data-update': 'click change',
						'type': 'radio',
						'id': this.cbid(section_id) + '-' + i,
						'name': this.cbid(section_id),
						'checked': (selected == i) ? '' : null,
						'value': i
					})
				]),
				E('td', {}, i),
				E('td', {'title': etitle}, renderFilterVal(i, 0)),
				E('td', {'title': ptitle}, renderFilterVal(i, 1)),
				E('td', {'title': ntitle}, renderFilterVal(i, 2)),
				E('td', {'title': etitle}, renderFilterVal(i, 3)),
				E('td', {'title': ptitle}, renderFilterVal(i, 4)),
				E('td', {'title': ntitle}, renderFilterVal(i, 5))
			]));
		};

		var table = E('table', { 'class': 'lldpd-filter', 'id': this.cbid(section_id) }, [
			E('thead', {}, [
				E('tr', {}, [
					E('th', { 'rowspan': 2 }),
					E('th', { 'rowspan': 2 }, _('Filter')),
					E('th', { 'colspan': 3 }, _('Incoming')),
					E('th', { 'colspan': 3 }, _('Outgoing'))
				]),
				E('tr', {}, [
					E('th', {}, 'E'),
					E('th', {}, 'P'),
					E('th', {}, 'N'),
					E('th', {}, 'E'),
					E('th', {}, 'P'),
					E('th', {}, 'N'),
				])
			]),
			E('tbody', {}, tbody)
		]);

		return table;
	},
});

var CBIMultiIOSelect = form.MultiValue.extend({
	__name__: 'CBI.MultiIOSelect',

	renderWidget: function(section_id, option_index, cfgvalue) {
		var value = (cfgvalue != null) ? cfgvalue : this.default ? this.default : '',
		    choices = this.transformChoices() ? this.transformChoices() : '';

		var widget = new ui.Dropdown(L.toArray(value), choices, {
			id: this.cbid(section_id),
			sort: this.keylist,
			multiple: true,
			optional: true,
			display_items: 5,
			dropdown_items: -1,
			create: true,
			disabled: (this.readonly != null) ? this.readonly : this.map.readonly,
			validate: L.bind(this.validate, this, section_id),
		});

		return widget.render();
	}
});

function init() {
	return new Promise(function(resolveFn, rejectFn) {
		var data = session.getLocalData('luci-app-lldpd');
		if (data !== null) {
			return resolveFn();
		}

		data = {};

		return uci.load('luci').then(function() {
			session.setLocalData('luci-app-lldpd', data);
			return resolveFn();
		});
	});
}

return L.Class.extend({
	cbiFilterSelect: cbiFilterSelect,
	CBIMultiIOSelect: CBIMultiIOSelect,
	init: init,
});
