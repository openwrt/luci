'use strict';
'require view';
'require fs-appearance as appearance';

/* The Footstrap page, dispatched by menu.d; `.cbi-section` draws the card. */
return view.extend({
	render: () => appearance.renderStandalone().then((form) => E('div', { 'class': 'cbi-section' }, [ form ])),

	/* null: a set handler makes View.addFooter() draw Save & Apply. */
	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
