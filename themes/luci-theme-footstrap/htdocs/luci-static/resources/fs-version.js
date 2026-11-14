'use strict';
'require baseclass';

/* Must stay in this file: Makefile, stage.sh and dev-sync.sh stamp it by name. */
const FS_VERSION = '0.0.0-dev';

/* By shape: the minifier folds `!== '0.0.0-dev'`; a dev deploy stamps `git describe`, so only
 * `-dev$` is unstamped. */
function isReal() { return ((/^\d+\.\d+/).test(FS_VERSION)) && !((/-dev$/).test(FS_VERSION)); }

return baseclass.extend({
	REPO_URL: 'https://github.com/VizzleTF/luci-theme-footstrap',
	label: () => (isReal() ? ('Footstrap v' + FS_VERSION) : 'Footstrap (dev)')
});
