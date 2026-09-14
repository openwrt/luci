'use strict';
'require view';
'require rpc';
'require poll';
'require uci';
'require wwand.simlist as simlist';

/* Status -> SIM cards: every SIM card wwand has seen (ubus sim_inventory,
   the daemon's siminventory.uc), by ICCID, and where it is — which modem and
   slot, which eUICC and profile, or which reader (a remote SIM through
   wwand-rsim). Cards that were seen and are gone stay listed as not present,
   with when they were last seen: that is what a later ICCID binding needs to
   know, and what an operator asks after moving cards around. */

var callInventory = rpc.declare({ object: 'wwand', method: 'sim_inventory', expect: { '': {} } });

function where(c) {
	if (c.reader)
		return _('reader %s').format(c.reader);
	if (c.modem)
		return (c.slot != null) ? _('%s, slot %d').format(c.modem, c.slot) : c.modem;
	return '?';
}

/* how long ago, from the router's clock: last_seen is the daemon's time() */
function ago(secs) {
	if (secs < 120)
		return _('%d s ago').format(secs);
	if (secs < 7200)
		return _('%d min ago').format(Math.floor(secs / 60));
	if (secs < 172800)
		return _('%d h ago').format(Math.floor(secs / 3600));
	return _('%d days ago').format(Math.floor(secs / 86400));
}

function state(c, now) {
	if (!c.present)
		return E('span', { 'style': 'opacity:.6' }, [ (c.last_seen != null && now != null)
			? _('not present, last seen %s').format(ago(Math.max(0, now - c.last_seen)))
			: _('not present') ]);
	if (c.active)
		return E('strong', {}, _('in use'));
	return _('present');
}

function esim(c) {
	if (!c.eid)
		return '';
	/* array children throughout: the names come from the card */
	return E('span', {}, [
		_('eUICC'), ' ', E('code', {}, [ c.eid ]),
		c.profile ? ' · ' + _('profile %s').format(c.profile.state || '?') + (c.profile.name ? ' "' + c.profile.name + '"' : '') : '',
	]);
}

/* this card's override (PIN, APN, …) on the Modems page, in the editor
   there: Edit when it has one, Create when not (Modems page, ?sim=) */
function settingsButton(c) {
	if (!c.iccid)
		return '';

	var have = !!simlist.findSim(c.iccid, c.imsi);

	return E('button', {
		'class': 'btn cbi-button ' + (have ? 'cbi-button-edit' : 'cbi-button-add'),
		'title': have ? _('Edit the settings of this SIM card') : _('Create settings for this SIM card'),
		'click': function() {
			window.location.href = L.url('admin/network/wwand') + '?sim=' + encodeURIComponent(c.iccid);
		},
	}, [ have ? _('Edit') : _('Create') ]);
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callInventory(), {}),
			L.resolveDefault(uci.load('network'), null),
		]).then(function(r) { return r[0]; });
	},

	table: function(inv) {
		var cards = (inv && inv.cards) || [];

		if (!cards.length)
			return E('p', {}, E('em', {}, _('No SIM card seen yet.')));

		return E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Name')),
				E('th', { 'class': 'th' }, _('ICCID')),
				E('th', { 'class': 'th' }, _('Where')),
				E('th', { 'class': 'th' }, _('State')),
				E('th', { 'class': 'th' }, _('IMSI')),
				E('th', { 'class': 'th' }, _('eSIM')),
				E('th', { 'class': 'th' }, _('Settings')),
			]),
		].concat(cards.map(function(c) {
			return E('tr', { 'class': 'tr' }, [
				/* the label from the card's wwand_sim, set on Network → Modems */
				E('td', { 'class': 'td' }, [ c.name ? String(c.name) : '—' ]),
				E('td', { 'class': 'td' }, E('code', {}, [ c.iccid ])),
				E('td', { 'class': 'td' }, [ where(c) ]),
				E('td', { 'class': 'td' }, state(c, inv.now)),
				E('td', { 'class': 'td' }, [ c.imsi || '—' ]),
				E('td', { 'class': 'td' }, esim(c)),
				E('td', { 'class': 'td' }, settingsButton(c)),
			]);
		})));
	},

	render: function(inv) {
		var self = this;
		var box = E('div', {}, self.table(inv || {}));

		poll.add(function() {
			return L.resolveDefault(callInventory(), {}).then(function(i) {
				box.replaceChildren(self.table(i || {}));
			});
		}, 10);

		return E([], [
			E('h2', {}, _('SIM cards')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Every SIM card wwand has seen and where it is: in a modem slot, as a profile on an eUICC, or in a reader (remote SIM). A card that was taken out stays listed as not present. On a modem with more than one slot, the cards in the inactive slots appear once the slot list has been read.')),
			box,
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
