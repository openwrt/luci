'use strict';
'require baseclass';

/* ---- theme identity: the version footstrap SHIPS, and the repo it came from ----
 *
 * Shown at the foot of the Appearance tab with NO network call: it is what is installed, not what
 * is available. Which version is available is the package manager's question — the installer adds
 * the feed, and `apk upgrade` answers it.
 *
 * FS_VERSION is stamped at build/deploy: the theme Makefile (Build/Prepare) and dev-sync.sh rewrite
 * the '0.0.0-dev' literal below — BY FILE NAME, so this constant cannot move to another file without
 * changing both seds. An unstamped source checkout stays 'dev'. */
const FS_VERSION = '0.0.0-dev';

/* The parentheses around the regex are load-bearing — do not "tidy" them away. luci.mk minifies
 * this file with jsmin, whose regex-vs-division test is a ONE-character lookback against a fixed
 * allow-list. `n` (the last letter of `return`) is not on it, so `return /re/` is read as a
 * division and the regex's `//` swallows the rest of the file — exiting 0 (openwrt/luci#8299).
 *
 * The shape of the version is the WHOLE test — do NOT re-add a `FS_VERSION !== '0.0.0-dev'`
 * comparison. CI runs terser over this file BEFORE the Makefile stamps the version, so at that
 * moment both sides of that comparison are the same literal: terser folded it to `&& !1` and
 * every released build reported itself as '(dev)' forever after. An SDK/buildbot build has no
 * terser step, so it worked locally and only ever broke in a release. A regex test is not constant-folded —
 * proven by the same minified output, which kept this very `.test()` call — so the sentinel is
 * excluded by its SHAPE instead. `-dev$` and not `^\d+\.\d+\.\d+$`, because dev-sync.sh stamps
 * `git describe` ('0.9.4-12-gabc1234') and that must keep counting as a real version. */
function isReal() { return ((/^\d+\.\d+/).test(FS_VERSION)) && !((/-dev$/).test(FS_VERSION)); }

/* Two exports, and the two that were dropped are worth a line each so they are not re-added out of
 * habit: `VERSION` (the bare string) and `isReal` had no caller anywhere in the theme or the
 * templates — `label()` is what every reader actually wants, and it is the one place that decides
 * how a dev build names itself. An export nobody imports is not free: it is a promise to keep the
 * shape stable. */
return baseclass.extend({
	/* the project's page: the link at the foot of the Appearance tab, and its only reader since
	 * the footer line was withdrawn. It was assembled from a separate FS_REPO constant that the
	 * retired self-update script needed to build API paths from, and nothing has needed the bare
	 * `owner/name` since. */
	REPO_URL: 'https://github.com/VizzleTF/luci-theme-footstrap',
	/* what the Appearance tab's version row prints */
	label: () => (isReal() ? ('Footstrap v' + FS_VERSION) : 'Footstrap (dev)')
});
