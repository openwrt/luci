'use strict';
'require baseclass';
'require dom';
'require ui';

const media = '/luci-static/athena';
const dismissLabels = () => [
	_('Cancel'),
	_('Close'),
	_('Dismiss'),
	'取消',
	'关闭',
	'Cancel',
	'Close'
];
function classes(node, names) {
	for (const name of names.split(/\s+/))
		if (name && !node.classList.contains(name)) node.classList.add(name);
}
function unclasses(node, names) {
	for (const name of names.split(/\s+/))
		if (node.classList.contains(name)) node.classList.remove(name);
}
function attr(node, name, value) {
	value = String(value);
	if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}
function icon(name) {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('class', 'athena-icon');
	svg.setAttribute('aria-hidden', 'true');
	const use = document.createElementNS(svg.namespaceURI, 'use');
	use.setAttribute('href', `${media}/icons/sprite.svg#${name}`);
	svg.append(use);
	return svg;
}
function button(node, variant, size) {
	if (
		!node ||
		(node.matches('div,span') && node.querySelector('button,input[type=button],input[type=submit]'))
	)
		return;
	if (node.classList.contains('cbi-dropdown')) {
		if (node.classList.contains('cbi-button')) {
			const actualSize = node.closest('.diag-action') ? 'md' : 'lg';
			unclasses(node, actualSize === 'md' ? 'button--lg' : 'button--md');
			classes(node, `button button--primary button--${actualSize}`);
			attr(node, 'role', 'button');
			attr(node, 'aria-label', node.querySelector('li[display]')?.textContent || _('Save & Apply'));
		}
		return;
	}
	classes(node, 'button');
	attr(node, 'data-slot', 'button');
	for (const name of ['primary', 'secondary', 'tertiary', 'danger-soft', 'ghost'])
		if (name !== variant && node.classList.contains(`button--${name}`))
			node.classList.remove(`button--${name}`);
	for (const name of ['sm', 'md', 'lg'])
		if (name !== size && node.classList.contains(`button--${name}`))
			node.classList.remove(`button--${name}`);
	classes(node, `button--${variant || 'secondary'} button--${size || 'sm'}`);
	if (node.tagName === 'DIV' || node.tagName === 'SPAN') {
		attr(node, 'role', 'button');
		attr(node, 'tabindex', '0');
		if (!node.dataset.athenaKeyboard) {
			node.dataset.athenaKeyboard = 'true';
			node.addEventListener('keydown', (event) => {
				if ((event.key === 'Enter' || event.key === ' ') && !node.hasAttribute('disabled')) {
					event.preventDefault();
					node.click();
				}
			});
		}
	}
}
function variant(node) {
	const label = (node.value || node.textContent || '').trim();
	const modal = node.closest('.modal');
	if (modal && dismissLabels().includes(label)) return 'tertiary';
	if (
		node.matches('.danger,.cbi-button-negative,.cbi-button-remove,.cbi-button-reset,.remove') ||
		node.closest('.cbi-section-remove')
	)
		return 'danger-soft';
	if (
		node.matches(
			'.cbi-button-save,.cbi-button-apply,.cbi-button-positive,.cbi-button-add,.important'
		) ||
		(modal && node.closest('.right,.button-row,.modal-footer'))
	)
		return 'primary';
	return 'secondary';
}
function card(heading, nodes, className) {
	const content = E('div', { class: 'card__content athena-card-content' }, nodes);
	return E('section', { class: 'card athena-card' + (className ? ` ${className}` : '') }, [
		heading ? E('header', { class: 'card__header athena-card-header' }, [heading]) : '',
		content
	]);
}
function wrapCard(source, title, className) {
	if (source.dataset.athenaCard) return;
	source.dataset.athenaCard = 'true';
	const host = card(title ? E('h3', { class: 'card__title' }, title) : null, [], className);
	source.before(host);
	host.querySelector('.card__content').append(source);
	classes(source, 'athena-card-source');
}
function isFlag(node) {
	const label = node.closest('label')?.textContent || '';
	return (
		node.matches('[role="switch"],[switch]') ||
		!!node.closest('[data-widget="CBI.FlagValue"],[data-widget="CBI.Flag"]') ||
		node.dataset.athenaBooleanFilter === 'true' ||
		!!node.closest('.cbi-section-table-filter') ||
		(/status-logs/.test(document.body.dataset.page || '') && !!node.closest('#content_syslog'))
	);
}
function syncBooleanFilter(node) {
	const state = node.value === '' ? 'all' : node.value === '1' ? 'on' : 'off';
	node.checked = state === 'on';
	const wrapper = node.closest('.athena-filter-switch');
	if (!wrapper) return;
	attr(wrapper, 'data-filter-state', state);
	const label = state === 'all' ? _('All') : state === 'on' ? _('On') : _('Off');
	attr(node, 'aria-label', `${node.dataset.athenaFilterLabel} (${label})`);
	let all = wrapper.querySelector('.athena-filter-all');
	if (!all) {
		all = E(
			'button',
			{
				type: 'button',
				class: 'link athena-filter-all',
				click: () => {
					if (!node.disabled) clearBooleanFilters(node.closest('.table'), [node]);
				}
			},
			_('All')
		);
		wrapper.append(all);
	}
	attr(all, 'aria-label', `${_('All')}：${node.dataset.athenaFilterLabel}`);
	attr(all, 'aria-pressed', state === 'all');
	attr(all, 'aria-disabled', node.disabled);
	if (all.disabled !== node.disabled) all.disabled = node.disabled;
}
function clearBooleanFilters(table, nodes) {
	const resetting = table.dataset.athenaFilterResetting;
	table.dataset.athenaFilterResetting = 'true';
	try {
		for (const node of nodes) {
			node.value = '';
			syncBooleanFilter(node);
			node.dispatchEvent(new window.Event('input', { bubbles: true }));
		}
	} finally {
		if (resetting === undefined) delete table.dataset.athenaFilterResetting;
		else table.dataset.athenaFilterResetting = resetting;
	}
}
function booleanFilters(root) {
	for (const node of root.querySelectorAll('.cbi-section-table-filter input.cbi-section-filter')) {
		if (node.dataset.athenaBooleanFilter === 'true') continue;
		if (node.getAttribute('placeholder') !== '0/1' || node.getAttribute('maxlength') !== '1')
			continue;
		const table = node.closest('.table');
		const header = table?.querySelector('.cbi-section-table-titles:not(.cbi-section-table-filter)');
		const cell = node.closest('th,td,.th,.td');
		const index = [...cell.parentElement.children].indexOf(cell);
		node.dataset.athenaFilterLabel = `${_('Filter')} ${header?.children[index]?.textContent.trim() || ''}`;
		node.dataset.athenaBooleanFilter = 'true';
		const value = node.value;
		node.type = 'checkbox';
		node.value = value;
		node.style.removeProperty('width');
		unclasses(node, 'input');
		node.addEventListener(
			'input',
			() => {
				if (table?.dataset.athenaFilterResetting !== 'true') node.value = node.checked ? '1' : '0';
				syncBooleanFilter(node);
			},
			true
		);
		if (!table.dataset.athenaFilterReset) {
			table.dataset.athenaFilterReset = 'true';
			for (const reset of table.querySelectorAll('.cbi-section-table-filter button')) {
				reset.addEventListener('click', () => {
					// LuCI resets the source value and emits input. Restore its third
					// (unfiltered) state after that handler, rather than mapping it to 0.
					clearBooleanFilters(table, table.querySelectorAll('[data-athena-boolean-filter]'));
				});
			}
		}
	}
}
function customChoices(menu) {
	if (menu.classList.contains('preview')) return;
	const dropdown = menu.parentElement,
		api = dom.findClassInstance(dropdown);
	if (!api?.createItems) return;
	for (const input of menu.querySelectorAll(api.options?.create_query || '.create-item-input')) {
		const row = input.closest('li');
		if (!row || row.querySelector('.athena-choice-add')) continue;
		classes(row, 'athena-choice-create');
		const add = E(
			'button',
			{
				type: 'button',
				class: 'button button--primary button--sm athena-choice-add',
				click: (event) => {
					event.preventDefault();
					event.stopPropagation();
					// Blur runs LuCI's own datatype validator, as with the native Enter flow.
					// A click can already have moved focus to the button. Explicitly run the
					// original blur listeners too, so pasted values cannot retain old errors.
					input.dispatchEvent(new window.Event('blur'));
					if (
						!input.value.trim() ||
						input.disabled ||
						input.readOnly ||
						input.classList.contains('cbi-input-invalid') ||
						!input.checkValidity()
					) {
						input.focus();
						return;
					}
					input.blur();
					api.createItems(dropdown, input.value);
					input.value = '';
					update();
				}
			},
			_('Add')
		);
		const update = () => {
			const disabled = input.disabled || input.readOnly || !input.value.trim();
			if (add.disabled !== disabled) add.disabled = disabled;
		};
		input.after(add);
		input.addEventListener('input', update);
		input.addEventListener('keyup', update);
		update();
	}
}
let activeTooltip = null;
let tooltipIndex = 0;
const scrollSurfaces = new Map();
function prepareScrollSurface(node) {
	if (scrollSurfaces.has(node)) return;
	const surface = E('div', {
		class: 'athena-scroll-surface',
		popover: 'manual',
		'aria-hidden': 'true'
	});
	if (typeof surface.showPopover !== 'function') return;
	// The official fade masks the whole scroller, including its background.
	// Keep an opaque surface below floating content, above any modal backdrop.
	document.body.append(surface);
	scrollSurfaces.set(node, surface);
	attr(node, 'data-athena-scroll-surface', 'true');
	surface.showPopover();
}
function syncScrollSurface(node) {
	const surface = scrollSurfaces.get(node);
	if (!surface) return;
	if (!node.isConnected || !node.matches(':popover-open')) {
		surface.hidePopover();
		surface.remove();
		scrollSurfaces.delete(node);
		node.removeAttribute('data-athena-scroll-surface');
		return;
	}
	const rect = node.getBoundingClientRect();
	Object.assign(surface.style, {
		top: rect.top + 'px',
		left: rect.left + 'px',
		width: rect.width + 'px',
		height: rect.height + 'px',
		borderRadius: window.getComputedStyle(node).borderRadius
	});
}
function hideRichTooltip() {
	if (!activeTooltip) return;
	const tooltip = activeTooltip;
	activeTooltip = null;
	if (tooltip.hasAttribute('popover')) {
		if (tooltip.matches(':popover-open')) tooltip.hidePopover();
		tooltip.removeAttribute('popover');
	}
	syncScrollSurface(tooltip);
	for (const name of ['position', 'inset', 'top', 'left', 'margin', 'max-height', 'overflow'])
		tooltip.style.removeProperty(name);
}
function richTooltips(root) {
	for (const tooltip of root.querySelectorAll('.cbi-tooltip-container > .cbi-tooltip')) {
		if (tooltip.dataset.athenaTooltip) continue;
		tooltip.dataset.athenaTooltip =
			typeof tooltip.showPopover === 'function' ? 'popover' : 'native';
		const host = tooltip.parentElement;
		const show = () => {
			if (typeof tooltip.showPopover !== 'function' || !host.isConnected) return;
			if (activeTooltip !== tooltip) {
				hideRichTooltip();
				activeTooltip = tooltip;
			}
			prepareScrollSurface(tooltip);
			attr(tooltip, 'popover', 'manual');
			if (!tooltip.matches(':popover-open')) tooltip.showPopover();
			const rect = host.getBoundingClientRect();
			Object.assign(tooltip.style, {
				position: 'fixed',
				inset: 'auto',
				top: '0px',
				left: '0px',
				margin: '0',
				maxHeight: innerHeight - 24 + 'px',
				overflow: 'auto'
			});
			const box = tooltip.getBoundingClientRect(),
				below = innerHeight - rect.bottom - 12;
			const top =
				below >= box.height || below >= rect.top - 12 ? rect.bottom + 6 : rect.top - box.height - 6;
			Object.assign(tooltip.style, {
				top: Math.max(12, Math.min(top, innerHeight - box.height - 12)) + 'px',
				left: Math.max(12, Math.min(rect.left, innerWidth - box.width - 12)) + 'px'
			});
			syncScrollSurface(tooltip);
		};
		const hide = (event) => {
			if (!host.contains(event.relatedTarget) && activeTooltip === tooltip) hideRichTooltip();
		};
		if (!tooltip.id) tooltip.id = 'athena-tooltip-' + ++tooltipIndex;
		attr(tooltip, 'role', 'tooltip');
		attr(host, 'aria-describedby', tooltip.id);
		if (!host.matches('a,button,[tabindex]') && !host.querySelector('a,button,input'))
			attr(host, 'tabindex', '0');
		host.addEventListener('mouseenter', show);
		host.addEventListener('mouseleave', hide);
		host.addEventListener('focusin', show);
		host.addEventListener('focusout', hide);
		host.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') hideRichTooltip();
		});
		if (host.matches(':hover')) show();
	}
}
function typography(root) {
	for (const node of root.querySelectorAll(
		'h1,h2,h3,h4,h5,h6,p,code,.cbi-map-descr,.cbi-section-descr,.cbi-value-description'
	)) {
		let type = 'body-sm';
		if (node.matches('h1')) type = 'h1';
		else if (node.matches('h2,.athena-page-title,.athena-nft-title > h3')) type = 'h2';
		else if (node.matches('h3') && node.closest('.athena-details')) type = 'h3';
		else if (node.matches('h3,h5')) type = 'h5';
		else if (node.matches('h4,h6')) type = node.matches('.modal > h4') ? 'h4' : 'h6';
		else if (node.matches('code')) type = 'code';
		else if (node.matches('.cbi-value-description')) type = 'body-xs';
		for (const name of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'body-sm', 'body-xs', 'code'])
			if (name !== type) unclasses(node, 'typography--' + name);
		classes(node, 'typography typography--' + type);
	}
}
function controls(root) {
	typography(root);
	booleanFilters(root);
	richTooltips(root);
	tabMenus(root);
	for (const image of root.querySelectorAll('img[src*="/luci-static/resources/icons/"]')) {
		const name = image.src.split('/').pop();
		if (
			/^(alias|bridge|ethernet|switch|tunnel|vlan|vpn|vrf|wifi|wireguard)(?:_disabled)?\.svg$/.test(
				name
			) ||
			/^port_(?:pse_)?(?:up|down)(?:_disabled)?\.svg$/.test(name)
		)
			image.src = media + '/icons/' + name;
	}
	for (const menu of root.querySelectorAll('.cbi-dropdown > ul')) {
		customChoices(menu);
		const open = menu.classList.contains('dropdown');
		if (open) classes(menu, 'list-box dropdown__popover');
		else unclasses(menu, 'list-box dropdown__popover');
		for (const item of menu.querySelectorAll(':scope > li')) {
			if (open) classes(item, 'list-box__item');
			else unclasses(item, 'list-box__item');
		}
		if (open) {
			const dropdown = menu.parentElement;
			const rect = dropdown.getBoundingClientRect();
			const firstOpen = !menu.dataset.athenaOpen;
			menu.dataset.athenaOpen = 'true';
			const popover = typeof menu.showPopover === 'function';
			if (popover && !menu.hasAttribute('popover')) {
				prepareScrollSurface(menu);
				menu.setAttribute('popover', 'manual');
				menu.showPopover();
			}
			attr(dropdown, 'aria-expanded', 'true');
			// The native widget positions against its scroll parent. Combo menus at
			// the page footer also need the available viewport height as a bound.
			if (popover || dropdown.classList.contains('cbi-button') || dropdown.closest('.modal'))
				requestAnimationFrame(() => {
					if (!dropdown.hasAttribute('open')) return;
					const below = innerHeight - rect.bottom - 12,
						above = rect.top - 12;
					const down = below >= Math.min(220, above);
					const height = Math.max(36, Math.min(320, down ? below : above));
					Object.assign(menu.style, {
						position: 'fixed',
						margin: '0',
						top:
							(down
								? rect.bottom + 6
								: Math.max(12, rect.top - Math.min(menu.scrollHeight, height) - 6)) + 'px',
						bottom: 'auto',
						left:
							Math.max(12, Math.min(rect.left, innerWidth - Math.max(180, rect.width) - 12)) + 'px',
						right: 'auto',
						width: Math.min(Math.max(180, rect.width), innerWidth - 24) + 'px',
						minWidth: '0',
						maxHeight: height + 'px'
					});
					syncScrollSurface(menu);
					if (firstOpen) {
						const api = dom.findClassInstance(dropdown),
							selected = menu.querySelector('li[selected]') || menu.querySelector('li');
						if (api?.setFocus && selected) api.setFocus(dropdown, selected, true);
					}
				});
		} else {
			if (menu.hasAttribute('popover')) {
				if (menu.matches(':popover-open')) menu.hidePopover();
				menu.removeAttribute('popover');
			}
			syncScrollSurface(menu);
			delete menu.dataset.athenaOpen;
			if (!menu.classList.contains('preview')) attr(menu.parentElement, 'aria-expanded', 'false');
			for (const name of ['position', 'margin', 'left', 'right', 'width', 'min-width'])
				menu.style.removeProperty(name);
		}
	}
	for (const node of root.querySelectorAll('input,textarea,select')) {
		if (node.closest('[data-athena-custom]')) continue;
		const type = node.type;
		if (node.tagName === 'TEXTAREA') classes(node, 'textarea');
		else if (node.tagName === 'SELECT') classes(node, 'select__trigger');
		else if (['button', 'submit', 'reset'].includes(type))
			button(node, variant(node), node.closest('.cbi-page-actions,.modal') ? 'lg' : 'sm');
		else if (type === 'checkbox') {
			if (isFlag(node)) {
				if (!node.closest('.athena-switch')) {
					const wrapper = E('span', { class: 'switch athena-switch' });
					const track = E(
						'span',
						{ class: 'switch__control', 'aria-hidden': 'true' },
						E('span', { class: 'switch__thumb' })
					);
					node.before(wrapper);
					wrapper.append(node, track);
					attr(node, 'role', 'switch');
					const title = node
						.closest('.cbi-value')
						?.querySelector('.cbi-value-title')
						?.textContent.trim();
					if (title) attr(node, 'aria-label', title);
				}
				if (node.dataset.athenaBooleanFilter === 'true') {
					const wrapper = node.closest('.athena-switch');
					classes(wrapper, 'athena-filter-switch');
					syncBooleanFilter(node);
				}
			} else classes(node, 'athena-checkbox');
		} else if (!['hidden', 'radio', 'file', 'color'].includes(type)) classes(node, 'input');
	}
	for (const node of root.querySelectorAll('.cbi-button,.btn,button.cbi-button, .modal div.btn')) {
		if (node.closest('[data-athena-custom]') || node.classList.contains('athena-fold')) continue;
		const size = node.closest(
			'.cbi-page-actions,.modal .right,.modal .button-row,.modal .modal-footer,[data-page="admin-system-reboot"] #view'
		)
			? 'lg'
			: node.closest('.diag-action,.athena-package-controls')
				? 'md'
				: 'sm';
		button(
			node,
			node.matches('.control-group > button') &&
				node.parentElement.querySelector('input.cbi-input-password')
				? 'ghost'
				: variant(node),
			size
		);
		if (node.matches('.cbi-dynlist > .add-item > .cbi-button-add')) {
			classes(node, 'button--icon-only');
			attr(node, 'aria-label', _('Add'));
			// Native DynamicList.handleClick() requires the original button as target.
			if (!node.querySelector(':scope > svg.athena-icon')) node.replaceChildren(icon('plus'));
		}
		if (node.matches('.cbi-button-add') && node.closest('.cbi-tblsection-create'))
			classes(node, 'athena-table-add');
		if (
			node.closest('.modal') &&
			(node.matches('.cbi-button-save') || (node.textContent || '').replace(/\s/g, '') === '保存')
		) {
			classes(node, 'athena-modal-save');
			if (node.tagName !== 'INPUT' && node.textContent === '保存') {
				node.textContent = '保 存';
				attr(node, 'aria-label', '保存');
			}
		}
		if (
			node.matches('.control-group > button') &&
			node.parentElement.querySelector('input.cbi-input-password')
		) {
			const input = node.parentElement.querySelector('input.cbi-input-password');
			classes(node, 'athena-password-toggle button--icon-only');
			button(node, 'ghost', 'sm');
			const visible = input.type !== 'password';
			const state = visible ? 'eyeOff' : 'eye';
			attr(node, 'aria-label', visible ? _('Hide password') : _('Show password'));
			if (node.dataset.athenaEye !== state || !node.querySelector('svg')) {
				node.dataset.athenaEye = state;
				node.replaceChildren(icon(state));
			}
		}
	}
	for (const list of root.querySelectorAll('.cbi-dynlist')) {
		const api = dom.findClassInstance(list);
		if (!api?.removeItem) continue;
		for (const item of list.querySelectorAll(':scope > .item')) {
			if (item.querySelector(':scope > .athena-dyn-remove')) continue;
			const remove = E(
				'button',
				{
					type: 'button',
					class: 'button button--ghost button--sm button--icon-only athena-dyn-remove',
					'aria-label': _('Remove'),
					disabled: api.options?.disabled || null,
					click: (event) => {
						event.stopPropagation();
						api.removeItem(list, item);
					}
				},
				icon('close')
			);
			item.append(remove);
		}
	}
}
function sortableTable(table) {
	const handles = table.querySelectorAll('.cbi-section-table-row .drag-handle');
	for (const handle of handles) attr(handle, 'aria-label', _('Drag to reorder'));
	if (!handles.length || table.dataset.athenaSort) return;
	table.dataset.athenaSort = 'true';
	let source = null;
	table.addEventListener(
		'dragstart',
		(event) => {
			source = event.target.closest('.drag-handle')?.closest('.cbi-section-table-row') || null;
		},
		true
	);
	table.addEventListener(
		'dragend',
		() => {
			source = null;
		},
		true
	);
	const pointToHandle = (event) => {
		const target = event.target.closest('.drag-handle')?.closest('.cbi-section-table-row');
		if (!source || !target || source === target || source.parentElement !== target.parentElement)
			return;
		// Native LuCI uses each row's midpoint. A handle is at that midpoint, so a
		// downward handle-to-handle drop otherwise commonly inserts above itself.
		const rows = [...source.parentElement.children];
		const below = rows.indexOf(source) < rows.indexOf(target);
		unclasses(target, below ? 'drag-over-above' : 'drag-over-below');
		classes(target, below ? 'drag-over-below' : 'drag-over-above');
		// The original bubbling drop handler still reorders the DOM and UCI model.
	};
	table.addEventListener('dragover', pointToHandle);
	table.addEventListener('drop', pointToHandle, true);
}
function tableLayout(table, rows, columns) {
	const wrapper = table.closest('.athena-table');
	const data = rows.filter(
		(row) =>
			!row.classList.contains('table__header') && row.getAttribute('data-athena-empty') !== 'true'
	);
	const hasHeader = rows.some((row) => row.classList.contains('table__header'));
	const readonly = !table.querySelector('input,select,textarea,button,.cbi-dropdown');
	const pairs =
		!hasHeader && readonly && data.length && data.every((row) => row.children.length === 2);
	const metrics =
		!hasHeader &&
		readonly &&
		data.length &&
		data.every(
			(row) =>
				row.children.length >= 4 &&
				row.children.length % 2 === 0 &&
				[...row.children].every((cell, index) => index % 2 || cell.querySelector('strong'))
		);
	attr(wrapper, 'data-athena-table-layout', pairs ? 'key-value' : metrics ? 'metrics' : 'data');
	attr(wrapper, 'data-athena-empty-table', !data.length);
	if (wrapper.style.getPropertyValue('--athena-table-columns') !== String(columns))
		wrapper.style.setProperty('--athena-table-columns', String(columns));
	for (const row of data)
		for (const cell of row.children) {
			const value = cell.textContent.trim();
			let kind = 'text';
			if (
				cell.querySelector(
					'input,select,textarea,.cbi-dropdown,.athena-switch,.ifacebox,.cbi-progressbar'
				)
			)
				kind = 'content';
			else if (
				cell.matches('.cbi-section-actions') ||
				cell.querySelector('button,.cbi-button,.button-group')
			)
				kind = 'actions';
			else if (
				/^[+-]?\d[\d.,]*(?:\s*(?:%|(?:[kmgtpe]i?)?(?:b|bit)(?:\/s)?|ms|s|h|d))?$/i.test(value)
			)
				kind = 'number';
			else if (
				/^(?:\d{1,3}\.){3}\d{1,3}(?::\d+|\/\d+)?$/.test(value) ||
				/^[\da-f]+(?::[\da-f]*)+(?:%[\w.-]+)?(?:\/\d+)?$/i.test(value) ||
				/^\[[\da-f:]+(?:%[\w.-]+)?\]:\d+$/i.test(value) ||
				(cell.querySelector('code') && !/\s/.test(value))
			)
				kind = 'identifier';
			attr(cell, 'data-athena-cell', kind);
		}
}
function tableProgress(table) {
	for (const bar of table.querySelectorAll('.cbi-progressbar')) {
		const title = bar.getAttribute('title') || '';
		let output = bar.nextElementSibling;
		if (!output?.classList.contains('athena-progress-output')) {
			output = E('span', {
				class: 'meter__output athena-progress-output typography typography--body-xs'
			});
			bar.after(output);
		}
		if (output.textContent !== title) output.textContent = title;
	}
}
function tables(root) {
	for (const table of root.querySelectorAll('table.table,div.table')) {
		if (
			table.closest('[data-athena-custom]') ||
			table.classList.contains('athena-diagnostics-tools')
		)
			continue;
		const rows = [
			...table.querySelectorAll(':scope > tr,:scope > .tr,:scope > tbody > tr,:scope > thead > tr')
		];
		if (!rows.length) continue;
		if (!table.parentElement?.classList.contains('table__scroll-container')) {
			const scroll = E('div', {
				class: 'table__scroll-container',
				tabindex: '0',
				role: 'region',
				'aria-label':
					table.getAttribute('aria-label') ||
					table.closest('.cbi-section,.athena-card')?.querySelector('h3,h4')?.textContent ||
					_('Data table')
			});
			const wrapper = E('div', { class: 'table-root table-root--primary athena-table' }, scroll);
			table.before(wrapper);
			scroll.append(table);
		}
		classes(table, 'table__content');
		sortableTable(table);
		if (table.id === 'packages') classes(table.closest('.athena-table'), 'athena-package-table');
		const columns = Math.max(...rows.map((row) => row.children.length));
		if (
			document.body.dataset.page === 'admin-network-network' &&
			table.closest('#cbi-network-interface')
		)
			classes(table.closest('.athena-table'), 'athena-interface-table');
		let first = true;
		for (const row of rows) {
			classes(row, 'table__row');
			const header =
				row.classList.contains('table-titles') ||
				[...row.children].some((cell) => cell.matches('th,.th'));
			if (header) classes(row, 'table__header');
			else {
				unclasses(row, 'table__header');
				if (first) {
					attr(row, 'data-athena-first-row', 'true');
					first = false;
				} else if (row.hasAttribute('data-athena-first-row'))
					row.removeAttribute('data-athena-first-row');
			}
			for (const cell of row.children) {
				// cbi_update_table() clones header classes into new data cells.
				unclasses(cell, header ? 'table__cell' : 'table__column');
				classes(cell, header ? 'table__column' : 'table__cell');
			}
			const cell = row.children[0];
			const empty =
				!header &&
				row.children.length === 1 &&
				(row.classList.contains('placeholder') ||
					cell.hasAttribute('colspan') ||
					!!cell.querySelector('em'));
			if (empty) {
				attr(row, 'data-athena-empty', 'true');
				classes(cell, 'athena-empty-cell');
				if (table.tagName === 'TABLE') attr(cell, 'colspan', columns);
				let message = cell.querySelector(':scope > .athena-empty-content');
				if (!message) {
					message = cell.childNodes.length === 1 && cell.firstElementChild;
					if (!message) {
						message = E('span');
						message.append(...cell.childNodes);
						cell.append(message);
					}
					classes(message, 'athena-empty-content');
				}
			} else {
				row.removeAttribute('data-athena-empty');
				for (const value of row.children) {
					unclasses(value, 'athena-empty-cell');
					for (const message of value.querySelectorAll('.athena-empty-content'))
						unclasses(message, 'athena-empty-content');
				}
			}
			for (const group of row.querySelectorAll('.cbi-section-actions > div'))
				if (group.querySelectorAll(':scope > .button').length > 1)
					classes(group, 'button-group button-group--sm');
		}
		tableProgress(table);
		tableLayout(table, rows, columns);
	}
}
function logLayout(main) {
	const content = main.querySelector('#content_syslog');
	if (!content || content.dataset.athenaLogLayout) return;
	content.dataset.athenaLogLayout = 'true';
	classes(content, 'athena-log-panel');
	const oldRows = [...content.querySelectorAll(':scope > div')].filter((node) =>
		node.querySelector('input,select')
	);
	const fields = E('div', { class: 'athena-log-filters' });
	const get = (id) => content.querySelector('#' + id);
	const heading = (label, field, invert) =>
		E('div', { class: 'athena-log-field-header' }, [
			E('label', { for: field.id }, label),
			invert
				? E('label', { class: 'athena-log-exclude' }, [E('span', {}, _('Exclude')), invert])
				: ''
		]);
	const add = (id, label, invertId) => {
		const field = get(id);
		if (!field) return;
		const invert = get(invertId);
		if (invert) attr(invert, 'aria-label', `${_('Exclude')}: ${label}`);
		fields.append(E('div', { class: 'athena-log-field' }, [heading(label, field, invert), field]));
	};
	const from = get('logFromTime'),
		to = get('logToTime');
	if (from && to) {
		classes(fields, 'athena-log-filters--dmesg');
		const invert = get('invertLogRangeTime');
		attr(from, 'aria-label', _('Start time (seconds)'));
		attr(to, 'aria-label', _('End time (seconds)'));
		attr(from, 'placeholder', _('From'));
		attr(to, 'placeholder', _('To'));
		attr(invert, 'aria-label', _('Exclude time range'));
		fields.append(
			E('div', { class: 'athena-log-field athena-log-range' }, [
				heading(_('Time range (seconds)'), from, invert),
				E('div', { class: 'athena-log-range-inputs' }, [
					from,
					E('span', { 'aria-hidden': 'true' }, '—'),
					to
				])
			])
		);
	}
	if (!from || !to) classes(fields, 'athena-log-filters--syslog');
	const toolbar = get('scrollDownButton')?.parentElement;
	add('logFacilitySelect', _('Facility'), 'invertLogFacilitySearch');
	add(
		'logSeveritySelect',
		_('Severity'),
		get('invertSeverity') ? 'invertSeverity' : 'invertLogSeveritySearch'
	);
	const reverse = get('invertAscendingSort');
	if (reverse) {
		attr(reverse, 'aria-label', _('Reverse order'));
		const sort = E('label', { class: 'athena-log-sort' }, [
			E('span', {}, _('Reverse order')),
			reverse
		]);
		if (toolbar && toolbar !== content) {
			classes(toolbar, 'athena-log-toolbar');
			toolbar.prepend(sort);
		} else fields.append(sort);
	}
	add('logTextFilter', _('Contains text'), 'invertLogTextSearch');
	const maxRows = get('logMaxRows');
	if (maxRows && toolbar && toolbar !== content) {
		attr(maxRows, 'aria-label', _('Maximum rows'));
		classes(toolbar, 'athena-log-toolbar');
		toolbar.prepend(
			E('label', { class: 'athena-log-limit' }, [E('span', {}, _('Maximum rows')), maxRows])
		);
	} else add('logMaxRows', _('Maximum rows'));
	for (const row of oldRows) if (!row.querySelector('input,select')) row.remove();
	content.prepend(fields);
}
function sshKeysLayout(main) {
	const list = main.querySelector('.cbi-dynlist'),
		add = list?.querySelector(':scope > .add-item');
	if (!add) return;
	classes(list, 'athena-ssh-keys');
	let existing = list.querySelector(':scope > .athena-ssh-existing');
	if (!existing) {
		existing = card(
			E('h3', { class: 'card__title' }, _('Configured public keys')),
			[],
			'athena-ssh-existing'
		);
		list.insertBefore(existing, add);
	}
	// LuCI removes every direct child before add-item when it refreshes keys.
	// Keep add-item last and recreate this presentation wrapper after a refresh.
	const content = existing.querySelector('.card__content');
	for (const node of list.querySelectorAll(':scope > .item,:scope > p')) content.append(node);
	for (const node of content.querySelectorAll(':scope > .item')) {
		let remove = node.querySelector('.athena-ssh-remove');
		if (!remove) {
			remove = E(
				'button',
				{
					type: 'button',
					class: 'button button--danger-soft button--sm athena-ssh-remove',
					'aria-label': `${_('Delete')} ${node.querySelector('strong')?.textContent || ''}`,
					disabled: add.querySelector('input')?.disabled || null,
					click: (event) => {
						event.stopPropagation();
						node.dataset.athenaDeleteClick = 'true';
						try {
							node.click();
						} finally {
							delete node.dataset.athenaDeleteClick;
						}
					}
				},
				_('Delete')
			);
			node.addEventListener(
				'click',
				(event) => {
					if (!event.target.closest('.athena-ssh-remove') && !node.dataset.athenaDeleteClick)
						event.stopImmediatePropagation();
				},
				true
			);
		}
		if (!node.querySelector('.athena-ssh-key-heading')) {
			const name = node.querySelector(':scope > strong');
			const heading = E('div', { class: 'athena-ssh-key-heading' }, [name, remove]);
			for (const br of node.querySelectorAll(':scope > br')) br.remove();
			node.prepend(heading);
		}
	}
	if (!add.dataset.athenaSshLayout) {
		add.dataset.athenaSshLayout = 'true';
		classes(add, 'card athena-card athena-ssh-add');
		const input = add.querySelector('input'),
			submit = add.querySelector('button');
		if (!input || !submit) return;
		if (!input.id) input.id = 'athena-ssh-key-input';
		attr(input, 'aria-label', _('SSH public key'));
		classes(submit, 'cbi-button-positive');
		const header = E(
			'header',
			{ class: 'card__header athena-card-header' },
			E('h3', { class: 'card__title' }, _('Add SSH public key'))
		);
		const body = E('div', { class: 'card__content athena-card-content' }, [
			E(
				'p',
				{ class: 'cbi-section-descr' },
				_('Paste an OpenSSH public key, or drop a .pub file here.')
			),
			E('label', { class: 'athena-ssh-input-label', for: input.id }, _('Public key')),
			input,
			E('div', { class: 'cbi-page-actions athena-ssh-add-actions' }, submit)
		]);
		add.replaceChildren(header, body);
	}
}
function diagnosticsLayout(main) {
	const tools = main.querySelector('#view .athena-diagnostics-tools, #view .cbi-map > table');
	if (tools) {
		classes(tools, 'athena-diagnostics-tools');
		attr(tools, 'role', 'presentation');
		const names = ['Ping', 'Traceroute', 'Nslookup', 'ARP'];
		const descriptions = [
			_('Test host connectivity'),
			_('Trace the route to a host'),
			_('Look up DNS records'),
			_('Discover local network devices')
		];
		const cells = tools.querySelectorAll(':scope > tr > td, :scope > tbody > tr > td');
		cells.forEach((cell, index) => {
			const field = cell.querySelector(':scope > input,:scope > select');
			if (!field) return;
			classes(cell, 'athena-diagnostic-tool');
			if (!field.id) field.id = 'athena-diag-target-' + index;
			attr(field, 'aria-label', `${names[index] || 'ARP'} ${_('target')}`);
			const hintId = 'athena-diag-hint-' + index;
			attr(field, 'aria-describedby', hintId);
			if (field.tagName === 'INPUT') attr(field, 'placeholder', _('Domain or IP address'));
			if (!cell.querySelector(':scope > .athena-diagnostic-heading'))
				cell.prepend(
					E('div', { class: 'athena-diagnostic-heading' }, [
						E('label', { for: field.id }, names[index] || 'ARP'),
						E('p', { id: hintId }, descriptions[index] || descriptions[3])
					])
				);
			// LuCI reads action.parentNode.previousSibling.value. Keep the original
			// target immediately before diag-action, with both inside the same cell.
			for (const action of cell.querySelectorAll('.diag-action > .cbi-button'))
				classes(action, 'cbi-button-positive');
		});
		wrapCard(tools, null, 'athena-glass-panel athena-diagnostics-panel');
	}
	const output = main.querySelector('#command-output');
	if (output) {
		wrapCard(output.closest('.cbi-section'), _('Diagnostic results'), 'athena-diagnostics-result');
		const area = output.querySelector('textarea');
		if (area) {
			attr(area, 'aria-label', _('Diagnostic output'));
			attr(area, 'placeholder', _('Run a tool above to see its output here.'));
		}
	}
}
function packageLayout(main) {
	const controls = main.querySelector('#disk-space-label')?.parentElement?.parentElement;
	if (controls?.classList.contains('controls')) {
		classes(controls, 'athena-package-controls');
		classes(controls.parentElement, 'athena-package-toolbar');
		for (const [id, name] of [
			['disk-space-label', 'disk'],
			['filter-label', 'filter'],
			['download-label', 'install'],
			['action-label', 'actions']
		]) {
			const label = controls.querySelector('#' + id);
			if (!label) continue;
			const group = label.parentElement;
			classes(group, 'athena-package-' + name);
			const input = group.querySelector('input');
			if (input) {
				if (!input.id) input.id = 'athena-package-' + name + '-input';
				attr(label, 'for', input.id);
			}
		}
		const disk = controls.querySelector('.athena-package-disk'),
			progress = disk?.querySelector('.cbi-progressbar');
		if (progress) {
			classes(disk, 'meter');
			attr(disk.querySelector('label'), 'data-slot', 'label');
			classes(progress, 'meter__track');
			classes(progress.firstElementChild, 'meter__fill');
			attr(progress, 'role', 'meter');
			attr(progress, 'aria-labelledby', 'disk-space-label');
			attr(progress, 'aria-valuemin', '0');
			attr(progress, 'aria-valuemax', '100');
			const percentage = parseFloat(progress.firstElementChild.style.width);
			attr(
				progress,
				'aria-valuenow',
				Number.isFinite(percentage) ? Math.max(0, Math.min(100, percentage)) : 0
			);
			const value = progress.getAttribute('title') || '';
			attr(progress, 'aria-valuetext', value);
			let summary = disk.querySelector('.athena-package-disk-summary');
			if (!summary) {
				summary = E('span', { class: 'meter__output athena-package-disk-summary' });
				disk.append(summary);
			}
			if (summary.textContent !== value) summary.textContent = value;
		}
		const installButton = controls.querySelector('.athena-package-install button');
		if (installButton) classes(installButton, 'cbi-button-positive');
		const translations = [...controls.children].find((node) =>
			node.querySelector('input[name="filter_i18n"]')
		);
		if (translations) {
			classes(translations, 'athena-package-translations');
			const label = translations.querySelector(':scope > label'),
				options = translations.querySelector(':scope > div');
			if (label && options) {
				if (!label.id) label.id = 'athena-package-translation-label';
				attr(options, 'role', 'radiogroup');
				attr(options, 'aria-labelledby', label.id);
				for (const node of [...options.childNodes])
					if (node.nodeType === 3 && !node.textContent.trim()) node.remove();
			}
		}
	}
	for (const pager of main.querySelectorAll('.controls > .pager')) {
		// handlePage() reads event.target.parentNode and .text.firstChild.data.
		// Keep all original pager children directly under their native parent.
		classes(pager, 'athena-package-pager');
		classes(pager.parentElement, 'athena-package-pagination');
	}
}
function pages(main) {
	const page = document.body.dataset.page || '';
	if (page === 'admin-system-package-manager') packageLayout(main);
	if (/^admin-status-routesj?$/.test(page)) {
		for (const pane of main.querySelectorAll('#view .cbi-section[data-tab]')) {
			classes(pane, 'athena-route-panels');
			for (const heading of [...pane.querySelectorAll(':scope > h3')]) {
				const nodes = [];
				for (
					let node = heading.nextSibling;
					node && !(node instanceof HTMLElement && node.tagName === 'H3');
					node = node.nextSibling
				)
					nodes.push(node);
				const title = heading.textContent.trim();
				for (const node of nodes)
					if (node instanceof HTMLElement && node.matches('table,.table'))
						attr(node, 'aria-label', title);
				const host = card(null, []);
				heading.before(host);
				const header = E('header', { class: 'card__header athena-card-header' });
				header.append(heading);
				host.prepend(header);
				host.querySelector('.card__content').append(...nodes);
			}
		}
	}
	if (/^admin-status-logs/.test(page)) {
		logLayout(main);
		const content = main.querySelector('#content_syslog');
		if (content) classes(content, 'athena-log-panel');
		for (const [id, bottom] of [
			['scrollDownButton', true],
			['scrollUpButton', false]
		]) {
			const source = main.querySelector('#' + id);
			if (source && !source.dataset.athenaLogScroll) {
				source.dataset.athenaLogScroll = 'true';
				source.addEventListener(
					'click',
					() => {
						const area = main.querySelector('#syslog');
						if (area) area.scrollTop = bottom ? area.scrollHeight : 0;
					},
					true
				);
			}
		}
	}
	if (page === 'admin-network-network') {
		const map = main.querySelector('#cbi-network');
		const menu = map?.querySelector(':scope > .cbi-tabmenu');
		if (menu && !map.dataset.athenaHeading) {
			const heading = map.querySelector(':scope > .cbi-section > h3');
			if (heading) {
				classes(heading, 'athena-page-title');
				attr(heading, 'role', 'heading');
				attr(heading, 'aria-level', '1');
				menu.before(heading);
				map.dataset.athenaHeading = 'true';
			}
		}
	}
	if (page === 'admin-status-nftables')
		for (const section of main.querySelectorAll('.nft-table > .cbi-section'))
			classes(section, 'athena-nft-title');
	if (page === 'admin-system-crontab') {
		const description = main.querySelector('#view > .cbi-section-descr');
		if (description) {
			const host = card(null, []);
			const nodes = [];
			for (let node = description; node; node = node.nextSibling) nodes.push(node);
			description.before(host);
			host.querySelector('.card__content').append(...nodes);
		}
	}
	if (page === 'admin-network-diagnostics') {
		diagnosticsLayout(main);
	}
	if (page === 'admin-system-admin-repokeys') {
		const keys = main.querySelector('#cbi-json-keys');
		if (keys) wrapCard(keys, _('Configured public keys'));
		const input = main.querySelector('#key-input');
		if (input) {
			const section = input.closest('.cbi-section');
			if (section) wrapCard(section, _('Add repository public key'));
			const add = input.parentElement?.querySelector('.right > button');
			if (add) {
				classes(add, 'cbi-button-positive');
				classes(add.parentElement, 'cbi-page-actions');
			}
		}
	}
	if (page === 'admin-system-admin-sshkeys') {
		sshKeysLayout(main);
	}
	if (page === 'admin-network-dns' || page === 'admin-system-system') {
		for (const menu of main.querySelectorAll('.cbi-section > ul.cbi-tabmenu'))
			classes(menu.parentElement, 'athena-external-tabs');
	}
	if (/^admin-services-openclash/.test(page))
		for (const group of main.querySelectorAll('.oc-tpl-tabs'))
			if (
				group.querySelector(':scope > button[data-tab]') &&
				!group.querySelector(':scope > [data-tab-title]')
			)
				attr(group, 'data-initialized', 'true');
	if (['admin', 'admin-status', 'admin-status-overview'].includes(page)) {
		const view = main.querySelector('#view');
		if (view && !view.closest('.athena-details')) {
			const details = E(
				'section',
				{ class: 'athena-details', 'aria-labelledby': 'athena-details-title' },
				[E('h2', { id: 'athena-details-title' }, _('Device details'))]
			);
			view.before(details);
			details.append(view);
		}
		for (const source of main.querySelectorAll(
			'.cbi-title [data-indicator="poll-status"][data-clickable="true"]'
		)) {
			const expanded = source.dataset.style !== 'active';
			classes(source, 'athena-fold');
			button(source, 'tertiary', 'sm');
			attr(source, 'aria-expanded', expanded);
			const label = expanded ? _('Collapse') : _('Expand');
			if (source.textContent !== label) source.textContent = label;
		}
		for (const image of main.querySelectorAll('img[src*="/icons/port_"]')) {
			const group = image.closest('.ifacebox')?.parentElement;
			if (group) classes(group, 'athena-ports');
		}
	}
	for (const node of main.querySelectorAll('.cbi-tblsection-create,.cbi-section-create'))
		if (node.querySelector(':scope > .cbi-button-add')) classes(node, 'athena-full-add');
}
let modalActive = false;
let modalOpener = null;
let lastAction = null;
const scrollBindings = new WeakMap();
const tabBindings = new WeakMap();
const tabMenuSelector = '.cbi-tabmenu,#tabmenu > ul.tabs';
function tabMenus(root) {
	if (!root) return;
	for (const layer of root.querySelectorAll('.athena-tabs-overflow')) {
		if (tabBindings.get(layer.nextElementSibling)?.layer !== layer) layer.remove();
	}
	for (const menu of root.querySelectorAll(tabMenuSelector)) {
		classes(menu, 'tabs__list scroll-shadow--hide-scrollbar');
		for (const tab of menu.querySelectorAll(':scope > li > a')) classes(tab, 'tabs__tab');
		let binding = tabBindings.get(menu);
		if (!binding) {
			// LuCI requires menu.nextElementSibling === pane group and the reverse.
			// Keep both native nodes in place; only add the overflow controls before them.
			const layer = E('span', {
				class: 'tabs__list-container athena-tabs-overflow',
				'data-orientation': 'horizontal'
			});
			const move = (direction) =>
				menu.scrollBy({
					left: direction * Math.max(80, menu.clientWidth * 0.7),
					behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
						? 'auto'
						: 'smooth'
				});
			const previous = E(
				'button',
				{
					type: 'button',
					class: 'tabs__list-container__scroll-prev',
					'aria-label': _('Scroll tabs backward'),
					click: () => move(-1)
				},
				icon('chevron')
			);
			const next = E(
				'button',
				{
					type: 'button',
					class: 'tabs__list-container__scroll-next',
					'aria-label': _('Scroll tabs forward'),
					click: () => move(1)
				},
				icon('chevron')
			);
			layer.append(previous, next);
			const reveal = (tab) => {
				if (!tab || !menu.clientWidth || menu.scrollWidth <= menu.clientWidth + 1) return;
				const rail = menu.getBoundingClientRect(),
					item = tab.getBoundingClientRect();
				const delta =
					item.left < rail.left + 24
						? item.left - rail.left - 24
						: item.right > rail.right - 24
							? item.right - rail.right + 24
							: 0;
				if (delta) menu.scrollBy({ left: delta, behavior: 'auto' });
			};
			const update = () => {
				if (!menu.isConnected || !menu.clientWidth) {
					if (!layer.hidden) layer.hidden = true;
					return;
				}
				if (layer.hidden) layer.hidden = false;
				const host = layer.offsetParent || menu.parentElement;
				const rect = menu.getBoundingClientRect(),
					box = host.getBoundingClientRect();
				Object.assign(layer.style, {
					left: rect.left - box.left + (host.scrollLeft || 0) - (host.clientLeft || 0) + 'px',
					top: rect.top - box.top + (host.scrollTop || 0) - (host.clientTop || 0) + 'px',
					width: rect.width + 'px',
					height: rect.height + 'px'
				});
				const before =
					menu.hasAttribute('data-left-scroll') || menu.hasAttribute('data-left-right-scroll');
				const after =
					menu.hasAttribute('data-right-scroll') || menu.hasAttribute('data-left-right-scroll');
				if (previous.hidden !== !before) previous.hidden = !before;
				if (next.hidden !== !after) next.hidden = !after;
				if (binding.width !== menu.clientWidth) {
					binding.width = menu.clientWidth;
					binding.reveal(binding.selected);
				}
			};
			binding = { layer, update, reveal, selected: null };
			tabBindings.set(menu, binding);
			menu.addEventListener('focusin', (event) => reveal(event.target.closest('a')));
		}
		if (window.getComputedStyle(menu.parentElement).position === 'static')
			classes(menu.parentElement, 'athena-tabs-host');
		if (binding.layer.nextElementSibling !== menu) menu.before(binding.layer);
		scrollShadow(menu, 'horizontal');
		const selected = menu.querySelector('.cbi-tab > a,.active > a,[aria-selected="true"]');
		if (menu.clientWidth && selected !== binding.selected) {
			binding.selected = selected;
			binding.reveal(selected);
		}
	}
}
let scrollShadowQueued = false;
function scrollShadow(node, orientation) {
	if (!node) return;
	// HeroUI Tabs shares data-orientation with ScrollShadow; keep its layout axis.
	orientation ||= node.matches(
		'.cbi-tabmenu,.tabs__list,#tabmenu .tabs,.athena-breadcrumb,.table__scroll-container'
	)
		? 'horizontal'
		: node.matches('.athena-sidebar-scroll,.cbi-dropdown > ul')
			? 'vertical'
			: undefined;
	let binding = scrollBindings.get(node);
	if (!binding) {
		const update = () => {
			if (!node.isConnected) return;
			if (node.matches('.table__scroll-container')) {
				// A fitting table needs no clipping. Focus and native refreshes must not
				// leave a hidden vertical offset that cuts off the header or first row.
				attr(node, 'data-athena-overflow-x', node.scrollWidth - node.clientWidth > 1);
				if (node.scrollTop) node.scrollTop = 0;
			}
			const css = window.getComputedStyle(node);
			const canY = /auto|scroll|overlay/.test(css.overflowY),
				canX = /auto|scroll|overlay/.test(css.overflowX);
			const hasY = canY && node.scrollHeight - node.clientHeight > 1;
			const hasX = canX && node.scrollWidth - node.clientWidth > 1;
			const horizontal =
				binding.orientation === 'horizontal' ||
				(binding.orientation !== 'vertical' && !hasY && (hasX || (!canY && canX)));
			classes(node, 'scroll-shadow scroll-shadow--fade');
			unclasses(node, horizontal ? 'scroll-shadow--vertical' : 'scroll-shadow--horizontal');
			classes(node, horizontal ? 'scroll-shadow--horizontal' : 'scroll-shadow--vertical');
			attr(node, 'data-orientation', horizontal ? 'horizontal' : 'vertical');
			attr(node, 'data-scroll-shadow-mode', 'manual');
			const offset = horizontal ? Math.abs(node.scrollLeft) : node.scrollTop;
			const total = horizontal
				? node.scrollWidth - node.clientWidth
				: node.scrollHeight - node.clientHeight;
			const before = (horizontal ? hasX : hasY) && offset > 1,
				after = (horizontal ? hasX : hasY) && total - offset > 1;
			const state =
				before && after
					? horizontal
						? 'left-right-scroll'
						: 'top-bottom-scroll'
					: before
						? horizontal
							? 'left-scroll'
							: 'top-scroll'
						: after
							? horizontal
								? 'right-scroll'
								: 'bottom-scroll'
							: '';
			for (const name of [
				'top-scroll',
				'bottom-scroll',
				'top-bottom-scroll',
				'left-scroll',
				'right-scroll',
				'left-right-scroll'
			]) {
				if (name === state) attr(node, 'data-' + name, 'true');
				else if (node.hasAttribute('data-' + name)) node.removeAttribute('data-' + name);
			}
			tabBindings.get(node)?.update();
			syncScrollSurface(node);
		};
		binding = { update, orientation };
		scrollBindings.set(node, binding);
		node.addEventListener('scroll', update, { passive: true });
		node.addEventListener('input', update, { passive: true });
		const resize = new ResizeObserver(update);
		resize.observe(node);
		binding.resize = resize;
		binding.observed = new WeakSet();
	}
	if (orientation) binding.orientation = orientation;
	for (const child of node.children)
		if (!binding.observed.has(child)) {
			binding.observed.add(child);
			binding.resize.observe(child);
		}
	binding.update();
}
function scrollShadows(root) {
	if (!root) return;
	tabMenus(root);
	for (const node of [root, ...root.querySelectorAll('*')]) {
		if (!(node instanceof window.HTMLElement) || !node.clientWidth || !node.clientHeight) continue;
		const known = node.matches(
			'textarea,.scroll-shadow,.table__scroll-container,.cbi-tabmenu,.athena-sidebar-scroll,.athena-breadcrumb,.cbi-dropdown > ul,#tabmenu .tabs'
		);
		if (
			!known &&
			node.scrollWidth - node.clientWidth <= 1 &&
			node.scrollHeight - node.clientHeight <= 1
		)
			continue;
		const css = window.getComputedStyle(node);
		if (/auto|scroll|overlay/.test(css.overflowX + css.overflowY)) scrollShadow(node);
	}
}
function scheduleScrollShadows() {
	if (scrollShadowQueued) return;
	scrollShadowQueued = true;
	requestAnimationFrame(() => {
		scrollShadowQueued = false;
		scrollShadows(document.body);
	});
}
function modal() {
	const overlay = document.getElementById('modal_overlay');
	const dialog = overlay?.querySelector(':scope > .modal');
	if (!dialog) return;
	const active = document.body.classList.contains('modal-overlay-active');
	if (active && !modalActive) modalOpener = lastAction;
	if (!active && modalActive) {
		if (document.body.dataset.page === 'admin-system-package-manager') {
			// LuCI's package view queries these options globally, including hidden dialogs.
			// Canceled install options must not leak into the next Update lists command.
			for (const input of dialog.querySelectorAll(
				'input[name="overwrite"],input[name="autoremove"],input[name="i18ninstall"]'
			))
				input.checked = false;
		}
		if (modalOpener?.isConnected) modalOpener.focus({ preventScroll: true });
	}
	modalActive = active;
	classes(dialog, 'modal__dialog scroll-shadow--hide-scrollbar');
	classes(overlay, 'modal__backdrop');
	attr(dialog, 'role', 'dialog');
	attr(dialog, 'aria-modal', 'true');
	const heading = dialog.querySelector(':scope > h4');
	if (heading) {
		classes(heading, 'modal__header');
		if (!heading.id) heading.id = 'athena-modal-title';
		attr(dialog, 'aria-labelledby', heading.id);
	}
	let footer = null;
	for (const child of dialog.children) {
		const actions =
			child.matches('.right,.button-row,.modal-footer,.cbi-page-actions') &&
			child.querySelector('button,input[type="button"],input[type="submit"],.btn');
		if (actions) {
			classes(child, 'modal__footer athena-modal-footer');
			footer = child;
		} else unclasses(child, 'modal__footer athena-modal-footer');
	}
	attr(dialog, 'data-athena-footer', !!footer);
	const dismiss = [...dialog.querySelectorAll('button,input[type="button"],.btn')].find(
		(node) =>
			!node.classList.contains('athena-modal-close') &&
			!node.matches(':disabled,[disabled]') &&
			dismissLabels().includes((node.value || node.textContent || '').trim())
	);
	let close = overlay.querySelector('.athena-modal-close');
	if (!close) {
		close = E(
			'button',
			{
				type: 'button',
				class: 'button button--tertiary button--icon-only athena-modal-close',
				'aria-label': _('Close'),
				click: () => {
					const current = overlay.querySelector(':scope > .modal');
					const target = [...current.querySelectorAll('button,input[type="button"],.btn')].find(
						(node) =>
							!node.matches(':disabled,[disabled]') &&
							dismissLabels().includes((node.value || node.textContent || '').trim())
					);
					target?.click();
				}
			},
			icon('close')
		);
	}
	// Keep LuCI's firstChild/lastChild contract untouched. Package-manager removes
	// its last child (the loading line) when the command completes.
	if (close.parentElement !== overlay) overlay.append(close);
	close.id = 'athena-modal-close';
	attr(dialog, 'aria-owns', close.id);
	attr(dialog, 'tabindex', '-1');
	let frame = overlay.querySelector(':scope > .athena-modal-frame');
	if (!frame) {
		frame = E('div', { class: 'athena-modal-frame', 'aria-hidden': 'true' });
		overlay.append(frame);
	}
	if (close.disabled !== !dismiss) close.disabled = !dismiss;
	const update = () => {
		if (!dialog.isConnected) return;
		const rect = dialog.getBoundingClientRect();
		Object.assign(frame.style, {
			top: rect.top + 'px',
			left: rect.left + 'px',
			width: rect.width + 'px',
			height: rect.height + 'px'
		});
		Object.assign(close.style, { top: rect.top + 12 + 'px', left: rect.right - 56 + 'px' });
		const headerSize = dialog.querySelector(':scope > h4')?.getBoundingClientRect().height || 0;
		const footerSize =
			dialog.querySelector(':scope > .athena-modal-footer')?.getBoundingClientRect().height || 0;
		const end = Math.max(headerSize, dialog.clientHeight - footerSize),
			fade = Math.min(24, Math.max(0, (end - headerSize) / 2));
		const top = dialog.scrollTop > 1,
			bottom = dialog.scrollHeight - dialog.clientHeight - dialog.scrollTop > 1;
		const gradient = ['to bottom', '#000 0px', `#000 ${headerSize}px`];
		if (top) gradient.push(`transparent ${headerSize}px`, `#000 ${headerSize + fade}px`);
		if (bottom) gradient.push(`#000 ${end - fade}px`, `transparent ${end}px`);
		gradient.push(`#000 ${end}px`, '#000 100%');
		dialog.style.setProperty('--scroll-linear-gradient', gradient.join(','));
	};
	scrollShadow(dialog, 'vertical');
	if (!dialog.dataset.athenaScrollShadow) {
		dialog.dataset.athenaScrollShadow = 'true';
		dialog.addEventListener('scroll', update, { passive: true });
		window.addEventListener('resize', update);
		new ResizeObserver(update).observe(dialog);
		update();
	}
	update();
	if (!overlay.dataset.athenaBackdrop) {
		overlay.dataset.athenaBackdrop = 'true';
		overlay.addEventListener('click', (event) => {
			if (event.target === overlay && !close.disabled) close.click();
		});
	}
}
function enhance(main) {
	pages(main);
	controls(main);
	tables(main);
	const dialog = document.querySelector('#modal_overlay > .modal');
	if (dialog) {
		controls(dialog);
		tables(dialog);
	}
	modal();
	for (const node of scrollSurfaces.keys()) syncScrollSurface(node);
	scheduleScrollShadows();
	for (const indicator of document.querySelectorAll('#indicators > [data-indicator="uci-changes"]'))
		button(indicator, 'secondary', 'sm');
}

return baseclass.extend({
	icon: icon,
	button: button,
	card: card,
	classes: classes,
	scrollShadow: scrollShadow,
	scrollShadows: scrollShadows,
	init: function () {
		const main = document.getElementById('maincontent');
		if (!main) return;
		let queued = false;
		const schedule = () => {
			if (!queued) {
				queued = true;
				queueMicrotask(() => {
					queued = false;
					enhance(main);
				});
			}
		};
		const observer = new MutationObserver(schedule);
		observer.observe(main, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: [
				'class',
				'disabled',
				'data-style',
				'checked',
				'type',
				'open',
				'title',
				'rows'
			]
		});
		const overlay = document.getElementById('modal_overlay');
		if (overlay)
			observer.observe(overlay, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['class', 'disabled', 'hidden', 'type', 'open']
			});
		const indicators = document.getElementById('indicators');
		if (indicators) observer.observe(indicators, { childList: true, subtree: true });
		observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
		document.addEventListener(
			'pointerdown',
			(event) => {
				if (!event.target.closest('#modal_overlay'))
					lastAction = event.target.closest('button,a,input,[tabindex]');
			},
			true
		);
		document.addEventListener('keydown', (event) => {
			if (!modalActive || event.key !== 'Tab') return;
			const dialog = document.querySelector('#modal_overlay > .modal');
			const close = document.getElementById('athena-modal-close');
			const focusable = [
				...dialog.querySelectorAll(
					'button,a[href],input:not([type="hidden"]),select,textarea,[tabindex="0"]'
				),
				close
			].filter(
				(node) => node && !node.matches(':disabled,[disabled]') && node.getClientRects().length
			);
			const inside = dialog.contains(document.activeElement) || document.activeElement === close;
			if (!focusable.length) {
				event.preventDefault();
				dialog.focus();
				return;
			}
			if (event.shiftKey && (document.activeElement === focusable[0] || !inside)) {
				event.preventDefault();
				focusable.at(-1).focus();
			} else if (!event.shiftKey && (document.activeElement === focusable.at(-1) || !inside)) {
				event.preventDefault();
				focusable[0].focus();
			}
		});
		document.addEventListener('luci-loaded', schedule);
		enhance(main);
		window.addEventListener('resize', hideRichTooltip);
		window.addEventListener('resize', scheduleScrollShadows, { passive: true });
		document.addEventListener(
			'scroll',
			(event) => {
				if (activeTooltip && !activeTooltip.contains(event.target)) hideRichTooltip();
			},
			{ capture: true, passive: true }
		);
	}
});
