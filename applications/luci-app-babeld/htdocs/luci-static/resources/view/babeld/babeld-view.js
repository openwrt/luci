'use strict';
'require uci';
'require view';
'require poll';
'require ui';
'require rpc';

function renderTableXRoutes(ubus_data, target_div) {
	const data = ubus_data;
	for (let protocol in data) {
		const target = target_div;

		const title = document.createElement('h3');
		title.appendChild(document.createTextNode('X-Routes ' + protocol));
		target.appendChild(title);

		const table = document.createElement('table');
		table.setAttribute('class', 'table');
		table.setAttribute('id', 'babel_overview_xroutes_' + protocol);

		const headerRow = document.createElement('tr');
		headerRow.setAttribute('class', 'tr table-titles');
		const headerContent = '<th class="th" style="font-weight: 700;">' + '%h'.format(protocol) + ' Prefix</th>\
                             <th class="th" style="font-weight: 700;">Metric</th>\
                             <th class="th" style="font-weight: 700;">Source-Prefix</th>';

		headerRow.innerHTML = headerContent;
		table.appendChild(headerRow);


		for (let prefix in data[protocol]) {
			const prefixRow = document.createElement('tr');
			prefixRow.setAttribute('class', 'tr');
			const prefixContent = '<td class="td" data-title="xroutes_' + '%h'.format(protocol) + '_prefix">' + '%h'.format(data[protocol][prefix]["address"]) + '</td>\
                                 <td class="td" data-title="xroutes_' + '%h'.format(protocol) + '_metric">' + '%d'.format(data[protocol][prefix]["metric"]) + '</td>\
                                 <td class="td" data-title="xroutes_' + '%h'.format(protocol) + '_src_prefix">' + '%h'.format(data[protocol][prefix]["src_prefix"]) + '</td>';

			prefixRow.innerHTML = prefixContent;
			table.appendChild(prefixRow);
		}
		target.appendChild(table);
	}
}

function renderTableRoutes(ubus_data, target_div) {
	const data = ubus_data;
	for (let protocol in data) {
		const target = target_div;

		const title = document.createElement('h3');
		title.appendChild(document.createTextNode('Routes ' + protocol));
		target.appendChild(title);

		const table = document.createElement('table');
		table.setAttribute('class', 'table');
		table.setAttribute('id', 'babel_overview_routes_' + protocol);

		const headerRow = document.createElement('tr');
		headerRow.setAttribute('class', 'tr table-titles');
		const headerContent = '<th class="th" style="font-weight: 700;">' + '%h'.format(protocol) + ' Prefix</th>\
                             <th class="th" style="font-weight: 700;">Source-Prefix</th>\
                             <th class="th" style="font-weight: 700;">Route-Metric</th>\
                             <th class="th" style="font-weight: 700;">Route Smoothed Metric</th>\
                             <th class="th" style="font-weight: 700;">Refmetric</th>\
                             <th class="th" style="font-weight: 700;">ID</th>\
                             <th class="th" style="font-weight: 700;">Seq. No.</th>\
                             <th class="th" style="font-weight: 700;">Age</th>\
                             <th class="th" style="font-weight: 700;">Via</th>\
                             <th class="th" style="font-weight: 700;">Nexthop</th>\
                             <th class="th" style="font-weight: 700;">Installed</th>\
                             <th class="th" style="font-weight: 700;">Feasible</th>';

		headerRow.innerHTML = headerContent;
		table.appendChild(headerRow);

		for (let prefix in data[protocol]) {
			const prefixRow = document.createElement('tr');
			prefixRow.setAttribute('class', 'tr');
			const prefixContent = '<td class="td" data-title="routes_' + '%h'.format(protocol) + '_prefix">' + '%h'.format(data[protocol][prefix]["address"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_src_prefix">' + '%h'.format(data[protocol][prefix]["src_prefix"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_metric">' + '%d'.format(data[protocol][prefix]["route_metric"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_rout_smoothed_metric">' + '%d'.format(data[protocol][prefix]["route_smoothed_metric"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_refmetric">' + '%d'.format(data[protocol][prefix]["refmetric"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_id">' + '%h'.format(data[protocol][prefix]["id"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_seqno">' + '%d'.format(data[protocol][prefix]["seqno"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_age">' + '%d'.format(data[protocol][prefix]["age"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_via">' + '%h'.format(data[protocol][prefix]["via"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_nexthop">' + '%h'.format(data[protocol][prefix]["nexthop"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_installed">' + '%b'.format(data[protocol][prefix]["installed"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_feasible">' + '%b'.format(data[protocol][prefix]["feasible"]) + '</td>';

			prefixRow.innerHTML = prefixContent;
			table.appendChild(prefixRow);
		}
		target.appendChild(table);
	}
}

function renderTableNeighbours(ubus_data, target_div) {
	const data = ubus_data;
	for (let protocol in data) {
		const target = target_div;

		const title = document.createElement('h3');
		title.appendChild(document.createTextNode('Neighbours ' + protocol));
		target.appendChild(title);

		const table = document.createElement('table');
		table.setAttribute('class', 'table');
		table.setAttribute('id', 'babel_overview_neighbours_' + protocol);

		const headerRow = document.createElement('tr');
		headerRow.setAttribute('class', 'tr table-titles');
		const headerContent = '<th class="th" style="font-weight: 700;">' + '%h'.format(protocol) + ' Neighbour</th>\
                             <th class="th" style="font-weight: 700;">Device</th>\
                             <th class="th" style="font-weight: 700;">Multicast Hellos</th>\
                             <th class="th" style="font-weight: 700;">Unicast Hellos</th>\
                             <th class="th" style="font-weight: 700;">RX cost</th>\
                             <th class="th" style="font-weight: 700;">TX cost</th>\
                             <th class="th" style="font-weight: 700;">RTT</th>\
                             <th class="th" style="font-weight: 700;">Interface up</th>';

		headerRow.innerHTML = headerContent;
		table.appendChild(headerRow);

		for (let neighbour in data[protocol]) {
			const neighbourRow = document.createElement('tr');
			neighbourRow.setAttribute('class', 'tr');
			const neighbourContent = '<td class="td" data-title="neighbours_' + '%h'.format(protocol) + '_neighbour">' + '%h'.format(data[protocol][neighbour]["address"]) + '</td>\
                                    <td class="td" data-title="neighbours_' + '%h'.format(protocol) + '_dev">' + '%h'.format(data[protocol][neighbour]["dev"]) + '</td>\
                                    <td class="td" data-title="neighbours_' + '%h'.format(protocol) + '_hello_reach">' + '%d'.format(data[protocol][neighbour]["hello_reach"]) + '</td>\
                                    <td class="td" data-title="neighbours_' + '%h'.format(protocol) + '_uhello_reach">' + '%d'.format(data[protocol][neighbour]["uhello_reach"]) + '</td>\
                                    <td class="td" data-title="neighbours_' + '%h'.format(protocol) + '_rxcost">' + '%d'.format(data[protocol][neighbour]["rxcost"]) + '</td>\
                                    <td class="td" data-title="neighbours_' + '%h'.format(protocol) + '_txcost">' + '%d'.format(data[protocol][neighbour]["txcost"]) + '</td>\
                                    <td class="td" data-title="neighbours_' + '%h'.format(protocol) + '_rtt">' + '%d'.format(data[protocol][neighbour]["rtt"]) + '</td>\
                                    <td class="td" data-title="neighbours_' + '%h'.format(protocol) + '_if_up">' + '%b'.format(data[protocol][neighbour]["if_up"]) + '</td>';

			neighbourRow.innerHTML = neighbourContent;
			table.appendChild(neighbourRow);
		}
		target.appendChild(table);
	}
}

function renderTableInfo(ubus_data, target_div) {
	const data = ubus_data;
	const target = target_div;

	const title = document.createElement('h3');
	title.appendChild(document.createTextNode('Info'));
	target.appendChild(title);

	const table = document.createElement('table');
	table.setAttribute('class', 'table');
	table.setAttribute('id', 'babel_overview_info');


	const headerRow = document.createElement('tr');
	headerRow.setAttribute('class', 'tr table-titles');
	const headerContent = '<th class="th" style="font-weight: 700;">Babeld Version</th>\
                         <th class="th" style="font-weight: 700;">My-ID</th>\
                         <th class="th" style="font-weight: 700;">Host</th>';

	headerRow.innerHTML = headerContent;
	table.appendChild(headerRow);

	const neighbourRow = document.createElement('tr');
	neighbourRow.setAttribute('class', 'tr');
	const neighbourContent = '<td class="td" data-title="info_babeld_version">' + '%h'.format(data["babeld_version"]) + '</td>\
                            <td class="td" data-title="info_dev">' + '%h'.format(data["my_id"]) + '</td>\
                            <td class="td" data-title="info_host">' + '%h'.format(data["host"]) + '</td>';

	neighbourRow.innerHTML = neighbourContent;
	table.appendChild(neighbourRow);
	target.appendChild(table);
}


return view.extend({
	callGetInfo: rpc.declare({
		object: 'babeld',
		method: 'get_info'
	}),
	callGetXroutes: rpc.declare({
		object: 'babeld',
		method: 'get_xroutes'
	}),
	callGetRoutes: rpc.declare({
		object: 'babeld',
		method: 'get_routes'
	}),
	callGetNeighbours: rpc.declare({
		object: 'babeld',
		method: 'get_neighbours'
	}),

	fetch_babeld() {
		let data;
		let self = this;
		return new Promise(function (resolve, reject) {
			Promise.all([self.callGetInfo(), self.callGetXroutes(), self.callGetRoutes(), self.callGetNeighbours()])
				.then(function (res) {
					data = res;
					resolve([data]);
				})
				.catch(function (err) {
					console.error(err);
					reject([null]);
				});
		});
	},

	action_babeld() {
		let self = this;
		return new Promise(function (resolve, reject) {
			self
				.fetch_babeld()
				.then(function ([data]) {
					var info = data[0];
					var xroutes = data[1];
					var routes = data[2];
					var neighbours = data[3];
					var result = { info, xroutes, routes, neighbours };
					resolve(result);
				})
				.catch(function (err) {
					reject(err);
				});
		});
	},

	load() {
		return new Promise(function (resolve, reject) {
			const script = E('script', { 'type': 'text/javascript' });
			script.onload = resolve;
			script.onerror = reject;
			script.src = L.resource('babeld.js');
			document.querySelector('head').appendChild(script);
		});
	},
	render() {
		return this.action_babeld()
			.then(function (result) {

				const mainDiv = E('div', {
					'id': 'babeld'
				}, []);

                renderTableInfo(result.info, mainDiv);
                renderTableXRoutes(result.xroutes, mainDiv);
                renderTableRoutes(result.routes, mainDiv);
                renderTableNeighbours(result.neighbours, mainDiv);

				const fresult = E([], {}, mainDiv);
				return fresult;
			})
			.catch(function (error) {
				console.error(error);
			});
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,
});
