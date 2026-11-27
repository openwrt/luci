'use strict';
'require view';
'require rpc';
'require poll';

var callSummary = rpc.declare({ object: 'crowdsec_monitor', method: 'summary', expect: { '': {} } });
var callList = rpc.declare({ object: 'crowdsec_monitor', method: 'list', params: [ 'origin', 'page', 'page_size', 'search' ], expect: { '': {} } });

function el(tag, attrs, children) { return E(tag, attrs || {}, children || []); }
function num(v) { return Number(v || 0).toLocaleString(); }
function bytes(n) {
	n = Number(n || 0);
	if (n < 1024) return num(n) + ' B';
	if (n < 1048576) return (n / 1024).toFixed(1) + ' KiB';
	if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MiB';
	return (n / 1073741824).toFixed(2) + ' GiB';
}
function remaining(ms) {
	if (ms === undefined || ms === null || ms <= 0) return _('Expiring');
	var s = Math.floor(ms / 1000), d = Math.floor(s / 86400);
	s %= 86400;
	var h = Math.floor(s / 3600);
	s %= 3600;
	var m = Math.floor(s / 60);
	if (d) return _('%dd %dh').format(d, h);
	if (h) return _('%dh %dmin').format(h, m);
	return _('%dmin').format(Math.max(1, m));
}
function metric(title, value, detail, accent) {
	return el('div', { 'style': 'background:var(--background-color,#fff);border:1px solid #d8d8d8;border-top:3px solid ' + accent + ';border-radius:7px;padding:13px 15px;min-width:0' }, [
		el('div', { 'style': 'font-size:.88em;color:#666;margin-bottom:5px' }, [title]),
		el('div', { 'style': 'font-size:1.55em;font-weight:700;line-height:1.25;overflow-wrap:anywhere' }, [value]),
		el('div', { 'style': 'font-size:.8em;color:#777;margin-top:4px' }, [detail])
	]);
}

return view.extend({
	handleSave: null,
	handleSaveApply: null,
	handleReset: null,
	load: function() {
		return L.resolveDefault(callSummary(), null).then(function(summary) {
			return L.resolveDefault(callList('', 1, 50, ''), null).then(function(listing) {
				return [summary, listing];
			});
		});
	},
	render: function(data) {
		var summary = data[0], listing = data[1], page = 1, pageSize = 50, debounce = null;
		var root = el('div', { 'class': 'cbi-map' });
		var status = el('div', { 'style': 'padding:12px 16px;border-radius:6px;margin:12px 0;background:#f3f4f6;border-left:4px solid #9ca3af' });
		var cards = el('div', { 'style': 'display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:12px;margin:16px 0' });
		var historyBox = el('section', { 'style': 'border:1px solid #ddd;border-radius:7px;padding:14px;margin:16px 0;background:var(--background-color,#fff)' });
		var historyInfo = el('div', { 'style': 'font-size:.85em;color:#666;margin:6px 0' });
		var historyChart = el('div', { 'style': 'display:flex;align-items:flex-end;gap:3px;height:100px;padding:8px 0;border-bottom:1px solid #ccc;overflow:hidden' });
		var tableHost = el('div', { 'style': 'overflow-x:auto;margin-top:12px' });
		var countLabel = el('span', { 'style': 'color:#666;font-size:.9em' }, [_('Loading…')]);
		var pageLabel = el('span', { 'style': 'padding:0 12px' }, [_('Page %d of %d').format(1, 1)]);
		var origin, search, refresh, previous, next;

		root.appendChild(el('h2', {}, [_('CrowdSec Monitor')]));
		root.appendChild(el('p', { 'class': 'cbi-map-descr' }, [_('Local monitoring of the CrowdSec Firewall Bouncer. Shows the blocks currently applied in the OpenWrt nftables sets. The Bouncer synchronises decisions with the LAPI automatically; this dashboard is read-only.')]));
		root.appendChild(status);

		function renderSummary(s) {
			summary = s;
			var ok = !!(s && s.available), running = !!(s && s.bouncer_running);
			status.style.background = ok && running ? '#edf8f0' : '#fff7e6';
			status.style.borderLeftColor = ok && running ? '#26934a' : '#d69e2e';
			status.innerHTML = '';
			status.appendChild(el('div', { 'style': 'font-weight:700' }, [
				_('Bouncer: %s').format(running ? _('running') : _('not detected'))
			]));
			status.appendChild(el('div', {}, [
				ok ? _('nftables table accessible') : _('Could not query the ip crowdsec table')
			]));

			var processed = s && s.counters ? s.counters.processed : null, total = 0, origins = [];
			(s && Array.isArray(s.sets) ? s.sets : []).forEach(function(set) {
				total += Number(set.count || 0);
				origins.push(set.origin + ': ' + num(set.count));
			});
			var blocked = 0, blockedBytes = 0;
			(s && Array.isArray(s.sets) ? s.sets : []).forEach(function(set) {
				blocked += Number(set.packets || 0);
				blockedBytes += Number(set.bytes || 0);
			});
			var hasChains = s && s.chains && s.chains.input && s.chains.forward;

			cards.innerHTML = '';
			cards.appendChild(metric(_('Traffic processed'),
				processed ? num(processed.packets) : '—',
				processed ? bytes(processed.bytes) : _('Counter unavailable'), '#3979b9'));
			cards.appendChild(metric(_('Packets blocked'), num(blocked),
				bytes(blockedBytes) + ' · ' + _('set counters'), '#c44747'));
			cards.appendChild(metric(_('IPs in active sets'), num(total),
				origins.length ? origins.join(' · ') : _('No active sets'), '#26934a'));
			cards.appendChild(metric(_('Bouncer rules'),
				hasChains ? 'INPUT / FORWARD' : _('Check rules'),
				'INPUT: ' + (s && s.chains && s.chains.input ? _('yes') : _('no')) +
				' · FORWARD: ' + (s && s.chains && s.chains.forward ? _('yes') : _('no')), '#7b61a8'));
			var current = origin.value, seenOrigin = {};
			origin.innerHTML = '';
			origin.appendChild(el('option', { value: '' }, [_('All origins')]));
			(s && Array.isArray(s.sets) ? s.sets : []).forEach(function(set) {
				if (!set.origin || seenOrigin[set.origin]) return;
				seenOrigin[set.origin] = true;
				origin.appendChild(el('option', { value: set.origin }, [set.origin]));
			});
			origin.value = seenOrigin[current] ? current : '';
			renderHistory(s && s.history ? s.history : []);
		}

		function renderHistory(samples) {
			historyChart.innerHTML = '';
			if (!samples || samples.length < 2) {
				historyInfo.textContent = _('Collecting samples. History is temporary and resets when the router restarts.');
				return;
			}
			/* Logarithmic scale: a single spike no longer flattens the rest of the window. */
			function scale(v) { return Math.log(1 + Math.max(0, v)); }
			var max = 0;
			samples.forEach(function(x) { max = Math.max(max, Number(x.processed_rate || 0), Number(x.blocked_rate || 0)); });
			var top = scale(max) || 1;
			samples.forEach(function(x) {
				var pr = Number(x.processed_rate || 0), br = Number(x.blocked_rate || 0);
				var p = pr > 0 ? Math.max(2, Math.round(scale(pr) / top * 88)) : 0;
				var b = br > 0 ? Math.max(2, Math.round(scale(br) / top * 88)) : 0;
				var tip = new Date(x.ts * 1000).toLocaleTimeString() + ' · ' +
					_('processed/s: %s · blocked/s: %s').format(Number(x.processed_rate || 0).toFixed(1), Number(x.blocked_rate || 0).toFixed(1));
				var col = el('div', { 'title': tip, 'style': 'flex:1;min-width:2px;height:' + p + 'px;position:relative;background:#3979b9;border-radius:2px 2px 0 0' });
				if (b > 0)
					col.appendChild(el('div', { 'style': 'position:absolute;bottom:0;left:0;right:0;height:' + Math.max(2, b) + 'px;background:#c44747' }));
				historyChart.appendChild(col);
			});
			var first = samples[0], last = samples[samples.length - 1];
			historyInfo.textContent = _('Samples: %d · window: %d s · blue bars: processed packets/s · red: blocked packets/s. Volatile history (/tmp), resets with the router.')
				.format(samples.length, Math.max(0, last.ts - first.ts));
		}

		root.appendChild(cards);
		root.appendChild(historyBox);
		historyBox.appendChild(el('h3', {}, [_('Activity history')]));
		historyBox.appendChild(historyInfo);
		historyBox.appendChild(historyChart);

		root.appendChild(el('h3', {}, [_('IPs currently blocked in nftables')]));

		var controls = el('div', { 'style': 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px;background:#f5f5f5;border:1px solid #ddd;border-radius:6px' });
		origin = el('select', { 'class': 'cbi-input-select', 'style': 'min-width:190px;max-width:240px' }, [el('option', { value: '' }, [_('All origins')])]);
		search = el('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': _('Search IP'), 'aria-label': _('Search IP address'), 'style': 'min-width:190px;max-width:260px' });
		refresh = el('button', { 'class': 'btn cbi-button-action' }, [_('Refresh list')]);
		controls.appendChild(origin);
		controls.appendChild(search);
		controls.appendChild(refresh);
		controls.appendChild(countLabel);

		var pager = el('div', { 'style': 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:12px 0;padding:10px;background:#f5f5f5;border:1px solid #ddd;border-radius:6px' });
		previous = el('button', { 'class': 'btn' }, [_('Previous')]);
		next = el('button', { 'class': 'btn' }, [_('Next')]);
		pager.appendChild(previous);
		pager.appendChild(pageLabel);
		pager.appendChild(next);

		function renderRows(result) {
			tableHost.innerHTML = '';
			if (!result || !result.available) {
				tableHost.appendChild(el('div', { 'class': 'alert-message warning' }, [_('Could not retrieve the IP list.')]));
				countLabel.textContent = _('List unavailable');
				previous.disabled = true;
				next.disabled = true;
				return;
			}
			var th = 'text-align:left;padding:10px;border-bottom:1px solid #ccc';
			var table = el('table', { 'class': 'table', 'style': 'width:100%;border-collapse:collapse' });
			table.appendChild(el('thead', {}, [el('tr', { 'style': 'background:#f0f0f0' }, [
				el('th', { 'style': th }, [_('IP address')]),
				el('th', { 'style': th }, [_('Origin')]),
				el('th', { 'style': th }, [_('Time remaining')]),
				el('th', { 'style': th }, [_('Initial duration')])
			])]));
			var body = el('tbody');
			(result.rows || []).forEach(function(row, i) {
				body.appendChild(el('tr', { 'style': 'background:' + (i % 2 ? '#fafafa' : 'transparent') }, [
					el('td', { 'style': 'padding:9px 10px;border-bottom:1px solid #e5e5e5;font-family:monospace' }, [row.ip]),
					el('td', { 'style': 'padding:9px 10px;border-bottom:1px solid #e5e5e5' }, [
						el('span', { 'style': 'display:inline-block;padding:2px 8px;border-radius:12px;background:#e8eef8;color:#315b91;font-size:.85em' }, [row.origin])
					]),
					el('td', { 'style': 'padding:9px 10px;border-bottom:1px solid #e5e5e5' }, [remaining(row.expires_ms)]),
					el('td', { 'style': 'padding:9px 10px;border-bottom:1px solid #e5e5e5' }, [remaining(row.timeout_ms)])
				]));
			});
			if (!result.rows || !result.rows.length)
				body.appendChild(el('tr', {}, [el('td', { 'colspan': '4', 'style': 'padding:16px;text-align:center;color:#777' }, [_('No IP found.')])]));
			table.appendChild(body);
			tableHost.appendChild(table);
			countLabel.textContent = _('%s addresses found').format(num(result.total));
			pageLabel.textContent = _('Page %d of %d').format(result.page, result.pages);
			previous.disabled = result.page <= 1;
			next.disabled = result.page >= result.pages;
		}

		function refreshList() {
			refresh.disabled = true;
			refresh.textContent = _('Querying…');
			return callList(origin.value, page, pageSize, search.value.trim()).then(function(r) {
				if (r && r.pages && page > r.pages) {
					page = r.pages;
					return callList(origin.value, page, pageSize, search.value.trim()).then(renderRows);
				}
				renderRows(r);
			}).catch(function() {
				renderRows(null);
			}).finally(function() {
				refresh.disabled = false;
				refresh.textContent = _('Refresh list');
			});
		}

		function refreshSummary() {
			return callSummary().then(renderSummary).catch(function() {});
		}

		previous.addEventListener('click', function() { if (page > 1) { page--; refreshList(); } });
		next.addEventListener('click', function() { page++; refreshList(); });
		refresh.addEventListener('click', function() { page = 1; refreshList(); refreshSummary(); });
		origin.addEventListener('change', function() { page = 1; refreshList(); });
		search.addEventListener('input', function() {
			if (debounce) window.clearTimeout(debounce);
			debounce = window.setTimeout(function() { page = 1; refreshList(); }, 450);
		});
		search.addEventListener('keydown', function(ev) {
			if (ev.key === 'Enter') {
				if (debounce) window.clearTimeout(debounce);
				page = 1;
				refreshList();
			}
		});

		root.appendChild(controls);
		root.appendChild(tableHost);
		root.appendChild(pager);
		root.appendChild(el('div', { 'class': 'cbi-section-descr', 'style': 'margin-top:12px' }, [
			_('The list shows the IPs currently present in the nftables sets managed by the Bouncer, not a direct query of the LAPI decisions. The Bouncer synchronises additions and removals automatically. Time remaining and initial duration come from the nftables expires and timeout fields. The exact time of the last LAPI query must be confirmed on the central server with cscli bouncers list.')
		]));
		root.appendChild(el('p', { 'style': 'font-size:.82em;color:#777' }, [
			_('Indicators refresh every 15 seconds. History keeps up to 240 samples in /tmp and is lost when the router restarts. The list refreshes when you search, filter or change page.')
		]));

		if (summary) renderSummary(summary);
		renderRows(listing);
		poll.add(function() { return refreshSummary(); }, 15);
		return root;
	}
});
