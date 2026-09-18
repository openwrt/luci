'use strict';
'require baseclass';

/* The installed version, shown on the Appearance page with no network call; which version is
 * available is the package manager's question.
 *
 * The Makefile (Build/Prepare), dev-sync.sh and tools/stage.sh sed the literal below BY FILE
 * NAME, so it cannot move to another file without changing all three. An unstamped checkout
 * stays 'dev'. */
const FS_VERSION = '0.0.0-dev';

/* The parentheses are load-bearing: jsmin's regex-vs-division test is a one-character lookback
 * against a fixed allow-list, and `n` (the last letter of `return`) is not on it, so `return /re/`
 * is read as a division and swallows the rest of the file, exiting 0 (openwrt/luci#8299).
 *
 * The sentinel is matched by shape, never by `FS_VERSION !== '0.0.0-dev'`: terser runs before the
 * Makefile stamps the version, so that comparison folds to a constant and every release reports
 * '(dev)' — an SDK build has no terser step, so it broke only in releases. A regex test is not
 * folded. `-dev$` rather than `^\d+\.\d+\.\d+$`, because dev-sync.sh stamps `git describe`
 * ('0.9.4-12-gabc1234'), which must count as a real version. */
function isReal() { return ((/^\d+\.\d+/).test(FS_VERSION)) && !((/-dev$/).test(FS_VERSION)); }

/* Do not re-add `VERSION` or `isReal` as exports: neither had a caller, and an export nobody
 * imports is a promise to keep the shape stable. */
return baseclass.extend({
	REPO_URL: 'https://github.com/VizzleTF/luci-theme-footstrap',
	label: () => (isReal() ? ('Footstrap v' + FS_VERSION) : 'Footstrap (dev)')
});
