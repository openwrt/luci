'use strict';
'require baseclass';
'require menu-footstrap-common as common';

/* footer.ut's entry: menu-footstrap-common wires the chrome, fs-chrome renders it. */
return baseclass.extend({
	__init__() {
		common.init();
	}
});
