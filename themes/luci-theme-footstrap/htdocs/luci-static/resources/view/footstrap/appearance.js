'use strict';
'require view';
'require fs-appearance as appearance';

/* The Footstrap page, dispatched by menu.d; fs-appearance.js draws its own cards. */
return view.extend({
	render: () => appearance.renderStandalone(),

	/* null: a set handler makes View.addFooter() draw Save & Apply. */
	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
