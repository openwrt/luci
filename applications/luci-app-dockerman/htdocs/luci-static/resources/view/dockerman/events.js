'use strict';
'require form';
'require fs';
'require dockerman.common as dm2';

/*
Copyright 2026
Docker manager JS for Luci by Paul Donald <newtwen+github@gmail.com> 
LICENSE: GPLv2.0
*/


/* API v1.52

GET /events supports content-type negotiation and can produce either
 application/x-ndjson (Newline delimited JSON object stream) or
 application/json-seq (RFC7464).

application/x-ndjson:

{"some":"thing\n"}
{"some2":"thing2\n"}
...

application/json-seq: ␊ = \n | ^J | 0xa, ␞ = ␞ | ^^ | 0x1e

␞{"some":"thing\n"}␊
␞{"some2":"thing2\n"}␊
...

*/

return dm2.dv.extend({
	load() {
		const now = Math.floor(Date.now() / 1000);

		return Promise.all([
			dm2.docker_events({ query: { since: `0`, until: `${now}` } }),
		]);
	},

	render([events]) {
		if (events?.code !== 200) {
			return E('div', {}, [ events?.body?.message ]);
		}

		this.outputText = events?.body ? JSON.stringify(events?.body, null, 2) + '\n' : '';
		const event_list = events?.body || [];
		const view = this;

		const mainContainer = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, [_('Docker - Events')])
		]);

		// Filters
		const now = new Date();
		const nowIso = now.toISOString().slice(0, 16);
		const filtersSection = E('div', { 'class': 'cbi-section' }, [
			E('div', { 'class': 'cbi-section-node' }, [
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Type')),
					E('div', { 'class': 'cbi-value-field' }, [
						E('select', {
							'id': 'event-type-filter',
							'class': 'cbi-input-select',
							'change': () => {
								view.updateSubtypeFilter(this.value);
								view.renderEventsTable(event_list);
							}
						}, [
							E('option', { 'value': '' }, _('All Types')),
							...Object.keys(dm2.Types).map(type => 
								E('option', { 'value': type }, `${dm2.Types[type].e} ${dm2.Types[type].i18n}`)
							)
						])
					])
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Subtype')),
					E('div', { 'class': 'cbi-value-field' }, [
						E('select', {
							'id': 'event-subtype-filter',
							'class': 'cbi-input-select',
							'disabled': true,
							'change': () => {
								view.renderEventsTable(event_list);
							}
						}, [
							E('option', { 'value': '' }, _('Select Type First'))
						])
					])
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('From')),
					E('div', { 'class': 'cbi-value-field' }, [
						E('input', {
							'id': 'event-from-date',
							'type': 'datetime-local',
							'value': '1970-01-01T00:00',
							'step': 60,
							'style': 'width: 180px;',
							'change': () => { view.renderEventsTable(event_list); }
						}),
						E('button', {
							'type': 'button',
							'class': 'cbi-button',
							'style': 'margin-left: 8px;',
							'click': () => {
								const now = new Date();
								const iso = now.toISOString().slice(0,16);
								document.getElementById('event-from-date').value = iso;
								view.renderEventsTable(event_list);
							}
						}, _('Now')),
						E('button', {
							'type': 'button',
							'class': 'cbi-button',
							'style': 'margin-left: 8px;',
							'click': () => {
								const unixzero = new Date(0);
								const iso = unixzero.toISOString().slice(0,16);
								document.getElementById('event-from-date').value = iso;
								view.renderEventsTable(event_list);
							}
						}, _('0'))
					])
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('To')),
					E('div', { 'class': 'cbi-value-field' }, [
						E('input', {
							'id': 'event-to-date',
							'type': 'datetime-local',
							'value': nowIso,
							'step': 60,
							'style': 'width: 180px;',
							'change': () => { view.renderEventsTable(event_list); }
						}),
						E('button', {
							'type': 'button',
							'class': 'cbi-button',
							'style': 'margin-left: 8px;',
							'click': () => {
								const now = new Date();
								const iso = now.toISOString().slice(0,16);
								document.getElementById('event-to-date').value = iso;
								view.renderEventsTable(event_list);
							}
						}, _('Now'))
					])
				])
			])
		]);
		mainContainer.appendChild(filtersSection);

		this.tableSection = E('div', { 'class': 'cbi-section', 'id': 'events-section' });
		mainContainer.appendChild(this.tableSection);

		this.renderEventsTable(event_list);

		mainContainer.appendChild(this.insertOutputFrame(E('div', {}), null));

		return mainContainer;
	},

	renderEventsTable(event_list) {
		const view = this;

		// Get filter values
		const typeFilter = document.getElementById('event-type-filter')?.value || '';
		const subtypeFilter = document.getElementById('event-subtype-filter')?.value || '';

		// Build filters object for docker_events API
		const filters = {};
		if (typeFilter) {
			filters.type = [typeFilter];
		}
		if (subtypeFilter) {
			filters.event = [subtypeFilter];
		}

		// Show loading indicator
		this.tableSection.innerHTML = '';

		// Query docker events with filters and date range
		const fromInput = document.getElementById('event-from-date');
		const toInput = document.getElementById('event-to-date');
		let since = '0';
		let until = Math.floor(Date.now() / 1000).toString();
		if (fromInput && fromInput.value) {
			const fromDate = new Date(fromInput.value);
			if (!isNaN(fromDate.getTime())) {
				since = Math.floor(fromDate.getTime() / 1000).toString();
				since = since < 0 ? 0 : since;
			}
		}
		if (toInput && toInput.value) {
			const toDate = new Date(toInput.value);
			if (!isNaN(toDate.getTime())) {
				const now = Date.now() / 1000;
				until = Math.floor(toDate.getTime() / 1000).toString();
				until = until > now ? now : until;
			}
		}
		const queryParams = { since, until };
		if (Object.keys(filters).length > 0) {
			// docker pre v27: filters => docker *streams* events. v27, send events in body.
			// Some older dockerd endpoints don't like encoded filter params, even if we can't stream.
			queryParams.filters = JSON.stringify(filters);
		}

		event_list = new Set();
		view.outputText = '';
		let eventsTable = null;

		function updateTable() {
			const ev_array = Array.from(event_list.keys());
			const rows = ev_array.map(event => {
				const type = event.Type;
				const typeInfo = dm2.Types[type];
				const typeDisplay = typeInfo ? `${typeInfo.e} ${typeInfo.i18n}` : type;
				const actionParts = event.Action?.split(':') || [];
				const action = actionParts.length > 0 ? actionParts[0] : '';
				const action_sub = actionParts.length > 1 ? actionParts[1] : null;
				const actionInfo = typeInfo?.sub?.[action];
				const actionDisplay = actionInfo ? `${actionInfo.e} ${actionInfo.i18n}${action_sub ? ':'+action_sub : ''}` : action;
				return [
					view.buildTimeString(event.time),
					typeDisplay,
					actionDisplay,
					view.objectToText(event.Actor),
					event.scope || ''
				];
			});

			const output = JSON.stringify(ev_array, null, 2);
			view.outputText = output + '\n';
			view.insertOutput(view.outputText);

			if (!eventsTable) {
				eventsTable = new L.ui.Table(
					[_('Time'), _('Type'), _('Action'), _('Actor'), _('Scope')],
					{ id: 'events-table', style: 'width: 100%; table-layout: auto;' },
					E('em', [_('No events found')])
				);
				view.tableSection.innerHTML = '';
				view.tableSection.appendChild(eventsTable.render());
			}
			eventsTable.update(rows);
		}

		view.tableSection.innerHTML = '';

		/* Partial transfers work but XHR times out waiting, even with xhr.timeout = 0 */
		// view.handleXHRTransfer({
		// 	q_params:{ query: queryParams },
		// 	commandCPath: '/docker/events',
		// 	commandDPath: '/events',
		// 	commandTitle: dm2.ActionTypes['prune'].i18n,
		// 	showProgress: false,
		// 	onUpdate: (msg) => {
		// 		try {
		// 			if(msg.error)
		// 				ui.addTimeLimitedNotification(dm2.ActionTypes['prune'].i18n, msg.error, 7000, 'error');

		// 			event_list.add(msg);
		// 			updateTable();

		// 			const output = JSON.stringify(msg, null, 2) + '\n';
		// 			view.insertOutput(output);
		// 		} catch {

		// 		}
		// 	},
		// 	noFileUpload: true,
		// });

		view.executeDockerAction(
			dm2.docker_events,
			{ query: queryParams },
			_('Load Events'),
			{
				showOutput: false,
				showSuccess: false,
				onSuccess: (response) => {
					if (response.body)
						event_list = Array.isArray(response.body) ? new Set(response.body) : new Set([response.body]);
					updateTable();
				},
				onError: (err) => {
					view.tableSection.innerHTML = '';
					view.tableSection.appendChild(E('em', { 'style': 'color: red;' }, _('Failed to load events: %s').format(err?.message || err)));
				}
			}
		);
	},

	updateSubtypeFilter(selectedType) {
		const subtypeSelect = document.getElementById('event-subtype-filter');
		if (!subtypeSelect) return;

		// Clear existing options
		subtypeSelect.innerHTML = '';

		if (!selectedType || !dm2.Types[selectedType] || !dm2.Types[selectedType].sub) {
			subtypeSelect.disabled = true;
			subtypeSelect.appendChild(E('option', { 'value': '' }, _('Select Type First')));
			return;
		}

		// Enable and populate with subtypes
		subtypeSelect.disabled = false;
		subtypeSelect.appendChild(E('option', { 'value': '' }, _('All Subtypes')));

		const subtypes = dm2.Types[selectedType].sub;
		for (const action in subtypes) {
			subtypeSelect.appendChild(
				E('option', { 'value': action }, `${subtypes[action].e} ${subtypes[action].i18n}`)
			);
		}
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

});
