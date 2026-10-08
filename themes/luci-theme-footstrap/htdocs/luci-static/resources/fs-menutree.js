'use strict';
'require baseclass';

/* The menu tree as a routing table: path <-> node, with LuCI's alias/firstchild resolution. Pure
 * lookup — no DOM. The chrome and the SPA router both need it, and require() raises
 * DependencyError on a loop, so the shared half is its own module rather than reached across. */

/* the ACL-filtered tree from /admin/menu, handed over once by the chrome's init() */
let _tree = null;

function setTree(tree) {
	_tree = tree;
}

/* /cgi-bin/luci/admin/status/overview -> ['admin','status','overview'].
 * The bare base (what build_url() emits for the brand wordmark) yields an empty seg list, not
 * null: the dispatcher's root node is itself a `firstchild`, so resolveSegs([]) walks to the
 * overview as the server does — returning null made the wordmark full-reload instead. null is
 * reserved for a path outside LuCI's scriptname. */
function segsFromPath(pathname) {
	const base = L.env.scriptname || '';
	if (base && pathname.indexOf(base) !== 0)
		return null;
	const rest = pathname.slice(base.length).replace(/^\/+|\/+$/g, '');
	return rest.length ? rest.split('/') : [];
}

/* walk the (scrubbed, ACL-filtered) menu tree to the node for a path */
function nodeForSegs(segs) {
	let node = _tree;
	for (let i = 0; i < segs.length; i++) {
		node = node && node.children && node.children[segs[i]];
		if (!node) return null;
	}
	return node;
}

/* ---- alias / firstchild resolution ----
 *
 * 7 of the 27 menu links are redirects rather than pages (4 `alias`, 3 `firstchild`). The server
 * does not redirect them: a full GET answers 200 at the requested URL and stamps the resolved leaf
 * into requestpath/dispatchpath/nodespec. The client must therefore resolve exactly as
 * dispatcher.uc does, or a click and an F5 on the same URL open different pages — nodeWeight() and
 * firstChildOf() are ports, not approximations. Only the ACL check is skipped, the tree from
 * /admin/menu already being ACL-filtered for this session.
 *
 * `rewrite` is deliberately not followed: the tree has none, and a wrong guess at its splice
 * semantics would open the wrong page — worse than the full load it falls back to. */

/* node_weight() from dispatcher.uc: lower wins; a login node sorts last. */
function nodeWeight(node) {
	return Math.min(node.order ?? 9999, 9999) + (node.auth && node.auth.login ? 10000 : 0);
}

/* resolve_firstchild() from dispatcher.uc: the eligible child of lowest weight. Ties go to tree
 * order (the comparison is strict, as upstream's is, and JSON.parse preserves key order). A
 * `firstchild` child is eligible only if it resolves to something itself — recursively. */
function firstChildOf(node) {
	let bestName = null, best = null;
	const kids = node.children || {};
	for (const name in kids) {
		const child = kids[name];
		if (!child.satisfied || !child.title || !child.action || typeof child.action !== 'object')
			continue;
		if (child.action.type === 'firstchild') {
			if ((!best || nodeWeight(best) > nodeWeight(child)) && firstChildOf(child)) {
				best = child; bestName = name;
			}
		} else if (!child.firstchild_ineligible) {
			if (!best || nodeWeight(best) > nodeWeight(child)) {
				best = child; bestName = name;
			}
		}
	}
	return best ? { name: bestName, node: best } : null;
}

/* Follow alias/firstchild to the real page: {segs, node} of the leaf the dispatcher would have
 * rendered, or null when nothing resolves (the server would 404 — let it). The hop cap is a cycle
 * guard: an alias loop in some app's menu.d must not hang the UI. */
function resolveSegs(segs) {
	let node = nodeForSegs(segs);
	for (let hops = 0; node && node.action && hops < 8; hops++) {
		const type = node.action.type;
		if (type === 'alias') {
			segs = String(node.action.path).split('/');
			node = nodeForSegs(segs);
		} else if (type === 'firstchild') {
			const pick = firstChildOf(node);
			if (!pick) return null;
			segs = segs.concat([ pick.name ]);
			node = pick.node;
		} else {
			return { segs, node };
		}
	}
	return null;
}

/* ---- readonly is a property of the PATH, not of the leaf ----
 *
 * apply_tree_acls() (dispatcher.uc:442) marks a NODE readonly from its own `depends.acl`, but a
 * request accumulates every ancestor's acls into ctx.acls and stamps the leaf from the
 * accumulation (`resolved.node.readonly = !perm`, :1003). Reading the leaf alone therefore
 * disagrees with a full load: luci.js derives hasViewPermission() from
 * `!env.nodespec.readonly`, which views and the Save/Apply footer key their disabled state off, so
 * every page whose SECTION is read-only would gain controls the server refuses.
 *
 * The operator is AND down the path, not OR: check_acl_depends() (:312) is handed the whole
 * concatenated list (:457-470) and grants write as soon as ANY group in it does, so a page is
 * read-only only when every acl-bearing node on the path is. A leaf with a writable acl of its own
 * re-opens the whole path.
 *
 * A node with no `depends.acl` contributes nothing to ctx.acls and is skipped. That is also why
 * the test reads `depends.acl` rather than the `readonly` flag alone: an acl-bearing node the
 * session may write carries no flag and would otherwise look ungated.
 *
 * Feed it the RESOLVED segments — that is the path the dispatcher accumulates over. */
function readonlyForSegs(segs) {
	let node = _tree;
	let gated = 0, locked = 0;
	const weigh = (n) => {
		const acl = n && n.depends && n.depends.acl;
		if (!acl || !acl.length)
			return;
		gated++;
		if (n.readonly === true)
			locked++;
	};
	weigh(node);
	for (let i = 0; i < segs.length; i++) {
		node = node && node.children && node.children[segs[i]];
		if (!node)
			break;
		weigh(node);
	}
	return gated > 0 && gated === locked;
}

/* The view class a menu node instantiates, or null when the node is not SPA-able. The
 * Status -> Overview `template` node maps to view.status.index, its server template doing nothing
 * else; the globals that template also defines come from ensureOverviewHelpers() in
 * menu-footstrap-common.js. Shared by navigate() and the hover prefetch. */
function viewClassFor(node) {
	if (!node || !node.action || node.satisfied === false)
		return null;
	if (node.action.type === 'view')
		return 'view.' + String(node.action.path).replace(/\//g, '.');
	if (node.action.type === 'template' && node.action.path === 'admin_status/index')
		return 'view.status.index';
	return null;
}

/* The node the current full load landed on, i.e. what L.env.dispatchpath points at. */
function currentNode() {
	return nodeForSegs(L.env.dispatchpath || []);
}

return baseclass.extend({
	setTree,
	tree: () => _tree,
	segsFromPath,
	currentNode,
	resolveSegs,
	readonlyForSegs,
	viewClassFor
});
