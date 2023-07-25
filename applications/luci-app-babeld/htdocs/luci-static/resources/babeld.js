function renderTableXRoutes(ubus_data, target_div) {
	var data = ubus_data;
	for (var protocol in data) {
		var target = target_div;

		var title = document.createElement('h3');
		title.appendChild(document.createTextNode('X-Routes ' + protocol));
		target.appendChild(title);

		var table = document.createElement('table');
		table.setAttribute('class', 'table');
		table.setAttribute('id', 'babel_overview_xroutes_' + protocol);

		var headerRow = document.createElement('tr');
		headerRow.setAttribute('class', 'tr table-titles');
		var headerContent = '<th class="th" style="font-weight: 700;">' + '%h'.format(protocol) + ' Prefix</th>\
                             <th class="th" style="font-weight: 700;">Metric</th>\
                             <th class="th" style="font-weight: 700;">Source-Prefix</th>';

		headerRow.innerHTML = headerContent;
		table.appendChild(headerRow);


		for (var prefix in data[protocol]) {
			var prefixRow = document.createElement('tr');
			prefixRow.setAttribute('class', 'tr');
			var prefixContent = '<td class="td" data-title="xroutes_' + '%h'.format(protocol) + '_prefix">' + '%h'.format(prefix) + '</td>\
                                 <td class="td" data-title="xroutes_' + '%h'.format(protocol) + '_metric">' + '%h'.format(data[protocol][prefix]["metric"]) + '</td>\
                                 <td class="td" data-title="xroutes_' + '%h'.format(protocol) + '_src-prefix">' + '%h'.format(data[protocol][prefix]["src-prefix"]) + '</td>';

			prefixRow.innerHTML = prefixContent;
			table.appendChild(prefixRow);
		}
		target.appendChild(table);
	}
}

function renderTableRoutes(ubus_data, target_div) {
	var data = ubus_data;
	for (var protocol in data) {
		var target = target_div;

		var title = document.createElement('h3');
		title.appendChild(document.createTextNode('Routes ' + protocol));
		target.appendChild(title);

		var table = document.createElement('table');
		table.setAttribute('class', 'table');
		table.setAttribute('id', 'babel_overview_routes_' + protocol);

		var headerRow = document.createElement('tr');
		headerRow.setAttribute('class', 'tr table-titles');
		var headerContent = '<th class="th" style="font-weight: 700;">' + '%h'.format(protocol) + ' Prefix</th>\
                             <th class="th" style="font-weight: 700;">Source-Prefix</th>\
                             <th class="th" style="font-weight: 700;">Route-Metric</th>\
                             <th class="th" style="font-weight: 700;">Route Smoothed Metric</th>\
                             <th class="th" style="font-weight: 700;">Refmetric</th>\
                             <th class="th" style="font-weight: 700;">ID</th>\
                             <th class="th" style="font-weight: 700;">Seq. No.</th>\
                             <th class="th" style="font-weight: 700;">Channes</th>\
                             <th class="th" style="font-weight: 700;">Age</th>\
                             <th class="th" style="font-weight: 700;">Via</th>\
                             <th class="th" style="font-weight: 700;">Nexthop</th>\
                             <th class="th" style="font-weight: 700;">Installed</th>\
                             <th class="th" style="font-weight: 700;">Feasible</th>';

		headerRow.innerHTML = headerContent;
		table.appendChild(headerRow);

		for (var prefix in data[protocol]) {
			var prefixRow = document.createElement('tr');
			prefixRow.setAttribute('class', 'tr');
			var prefixContent = '<td class="td" data-title="routes_' + '%h'.format(protocol) + '_prefix">' + '%h'.format(prefix) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_src-prefix">' + '%h'.format(data[protocol][prefix]["src-prefix"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_metric">' + '%h'.format(data[protocol][prefix]["route_metric"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_rout-smoothed-metric">' + '%h'.format(data[protocol][prefix]["route_smoothed_metric"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_refmetric">' + '%h'.format(data[protocol][prefix]["refmetric"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_id">' + '%h'.format(data[protocol][prefix]["id"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_seqno">' + '%h'.format(data[protocol][prefix]["seqno"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_channels">' + '%h'.format(data[protocol][prefix]["channels"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_age">' + '%h'.format(data[protocol][prefix]["age"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_via">' + '%h'.format(data[protocol][prefix]["via"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_nexthop">' + '%h'.format(data[protocol][prefix]["nexthop"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_installed">' + '%h'.format(data[protocol][prefix]["installed"]) + '</td>\
                                 <td class="td" data-title="routes_' + '%h'.format(protocol) + '_feasible">' + '%h'.format(data[protocol][prefix]["feasible"]) + '</td>';

			prefixRow.innerHTML = prefixContent;
			table.appendChild(prefixRow);
		}
		target.appendChild(table);
	}
}

function renderTableNeighbours(ubus_data, target_div) {
	var data = ubus_data;
	for (var protocol in data) {
		var target = target_div;

		var title = document.createElement('h3');
		title.appendChild(document.createTextNode('Neighbours ' + protocol));
		target.appendChild(title);

		var table = document.createElement('table');
		table.setAttribute('class', 'table');
		table.setAttribute('id', 'babel_overview_neighbours_' + protocol);

		var headerRow = document.createElement('tr');
		headerRow.setAttribute('class', 'tr table-titles');
		var headerContent = '<th class="th" style="font-weight: 700;">' + '%h'.format(protocol) + ' Neighbour</th>\
                             <th class="th" style="font-weight: 700;">Device</th>\
                             <th class="th" style="font-weight: 700;">Hello-Reach</th>\
                             <th class="th" style="font-weight: 700;">RX cost</th>\
                             <th class="th" style="font-weight: 700;">TX cost</th>\
                             <th class="th" style="font-weight: 700;">RTT</th>\
                             <th class="th" style="font-weight: 700;">Channel</th>\
                             <th class="th" style="font-weight: 700;">Interface up</th>';

		headerRow.innerHTML = headerContent;
		table.appendChild(headerRow);

		for (var neighbour in data[protocol]) {
			var neighbourRow = document.createElement('tr');
			neighbourRow.setAttribute('class', 'tr');
			var neighbourContent = '<td class="td" data-title="' + '%h'.format(protocol) + '_neighbour">' + '%h'.format(neighbour) + '</td>\
                                    <td class="td" data-title="neighbours_' + '%h'.format(protocol) + '_dev">' + '%h'.format(data[protocol][neighbour]["dev"]) + '</td>\
                                    <td class="td" data-title="neighbours_' + '%h'.format(protocol) + '_hello-reach">' + '%h'.format(data[protocol][neighbour]["hello-reach"]) + '</td>\
                                    <td class="td" data-title="neighbours_' + '%h'.format(protocol) + '_rxcost">' + '%h'.format(data[protocol][neighbour]["rxcost"]) + '</td>\
                                    <td class="td" data-title="neighbours_' + '%h'.format(protocol) + '_txcost">' + '%h'.format(data[protocol][neighbour]["txcost"]) + '</td>\
                                    <td class="td" data-title="neighbours_' + '%h'.format(protocol) + '_rtt">' + '%h'.format(data[protocol][neighbour]["rtt"]) + '</td>\
                                    <td class="td" data-title="neighbours_' + '%h'.format(protocol) + '_channel">' + '%h'.format(data[protocol][neighbour]["channel"]) + '</td>\
                                    <td class="td" data-title="neighbours_' + '%h'.format(protocol) + '_if_up">' + '%h'.format(data[protocol][neighbour]["if_up"]) + '</td>';

			neighbourRow.innerHTML = neighbourContent;
			table.appendChild(neighbourRow);
		}
		target.appendChild(table);
	}
}

function renderTableInfo(ubus_data, target_div) {
	var data = ubus_data;
	var target = target_div;

	var title = document.createElement('h3');
	title.appendChild(document.createTextNode('Info'));
	target.appendChild(title);

	var table = document.createElement('table');
	table.setAttribute('class', 'table');
	table.setAttribute('id', 'babel_overview_info');


	var headerRow = document.createElement('tr');
	headerRow.setAttribute('class', 'tr table-titles');
	var headerContent = '<th class="th" style="font-weight: 700;">Babeld Version</th>\
                         <th class="th" style="font-weight: 700;">My-ID</th>\
                         <th class="th" style="font-weight: 700;">Host</th>';

	headerRow.innerHTML = headerContent;
	table.appendChild(headerRow);

	var neighbourRow = document.createElement('tr');
	neighbourRow.setAttribute('class', 'tr');
	var neighbourContent = '<td class="td" data-title="info_babeld-version">' + '%h'.format(data["babeld-version"]) + '</td>\
                            <td class="td" data-title="info_dev">' + '%h'.format(data["my-id"]) + '</td>\
                            <td class="td" data-title="info_hello-reach">' + '%h'.format(data["host"]) + '</td>';

	neighbourRow.innerHTML = neighbourContent;
	table.appendChild(neighbourRow);
	target.appendChild(table);
}
