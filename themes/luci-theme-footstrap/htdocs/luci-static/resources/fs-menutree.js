'use strict';
'require baseclass';

/* The menu tree as a routing table: path <-> node, with LuCI's alias/firstchild resolution. Pure
 * lookup, no DOM. */

/* the ACL-filtered tree from /admin/menu, handed over once by the chrome's init() */
let _tree = null;

function setTree(tree) {
	_tree = tree;
}

/* /cgi-bin/luci/admin/status/overview -> ['admin','status','overview'] */
function segsFromPath(pathname) {
	const base = L.env.scriptname || '';
	if (base && !pathname.startsWith(base))
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
 * 7 of the 27 menu links are redirects (4 `alias`, 3 `firstchild`); the client resolves them as the
 * dispatcher does. */

/* node_weight() from dispatcher.uc: lower wins; a login node sorts last. */
function nodeWeight(node) {
	return Math.min(node.order ?? 9999, 9999) + (node.auth && node.auth.login ? 10000 : 0);
}

/* resolve_firstchild() from dispatcher.uc: the eligible child of lowest weight. Ties go to tree
 * order (the comparison is strict). */
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
 * rendered, or null when nothing resolves. */
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

/* ---- readonly is a property of the path, not of the leaf ----
 * See apply_tree_acls() (dispatcher.uc:442). */
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

/* The view class a menu node instantiates, or null when the node is not SPA-able. */
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
	nodeForSegs,
	currentNode,
	resolveSegs,
	readonlyForSegs,
	viewClassFor
});
