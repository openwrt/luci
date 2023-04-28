function ubus_call(command, argument, params) {
    var request_data = {};
    request_data.jsonrpc = "2.0";
    request_data.method = "call";
    request_data.params = [data.ubus_rpc_session, command, argument, params]
    var request_json = JSON.stringify(request_data);
    var request = new XMLHttpRequest();
    request.open("POST", ubus_url, false);
    request.setRequestHeader("Content-type", "application/json");
    request.send(request_json);
    if (request.status === 200) {
        var response = JSON.parse(request.responseText)
        if (!("error" in response) && "result" in response) {
            if (response.result.length === 2) {
                return response.result[1];
            }
        } else {
            console.err("Failed query ubus!");
        }
    }
}

function renderTableXRoutes(data, target_id) {
    for (var protocol in data) {
        var target = document.getElementById(target_id);

        var title = document.createElement('h3');
        title.appendChild(document.createTextNode('X-Routes ' + protocol));
        target.appendChild(title);

        var table = document.createElement('table');
        table.setAttribute('class', 'table');
        table.setAttribute('id', 'babel_overview_xroutes_' + protocol);

        var headerRow = document.createElement('tr');
        headerRow.setAttribute('class', 'tr table-titles');
        var headerContent = '<th class="th" style="font-weight: 700;">' + protocol + ' Prefix</th>\
                             <th class="th" style="font-weight: 700;">Metric</th>\
                             <th class="th" style="font-weight: 700;">Source-Prefix</th>';

        headerRow.innerHTML = headerContent;
        table.appendChild(headerRow);


        for (var prefix in data[protocol]) {
            var prefixRow = document.createElement('tr');
            prefixRow.setAttribute('class', 'tr');
            var prefixContent = '<td class="td" data-title="xroutes_' + protocol + '_prefix">' + prefix + '</td>\
                                 <td class="td" data-title="xroutes_' + protocol + '_metric">' + data[protocol][prefix]["metric"] + '</td>\
                                 <td class="td" data-title="xroutes_' + protocol + '_src-prefix">' + data[protocol][prefix]["src-prefix"] + '</td>';

            prefixRow.innerHTML = prefixContent;
            table.appendChild(prefixRow);
        }
        target.appendChild(table);
    }
}

function renderTableRoutes(data, target_id) {
    for (var protocol in data) {
        var target = document.getElementById(target_id);

        var title = document.createElement('h3');
        title.appendChild(document.createTextNode('Routes ' + protocol));
        target.appendChild(title);

        var table = document.createElement('table');
        table.setAttribute('class', 'table');
        table.setAttribute('id', 'babel_overview_routes_' + protocol);

        var headerRow = document.createElement('tr');
        headerRow.setAttribute('class', 'tr table-titles');
        var headerContent = '<th class="th" style="font-weight: 700;">' + protocol + ' Prefix</th>\
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
            var prefixContent = '<td class="td" data-title="routes_' + protocol + '_prefix">' + prefix + '</td>\
                                 <td class="td" data-title="routes_' + protocol + '_src-prefix">' + data[protocol][prefix]["src-prefix"] + '</td>\
                                 <td class="td" data-title="routes_' + protocol + '_metric">' + data[protocol][prefix]["route_metric"] + '</td>\
                                 <td class="td" data-title="routes_' + protocol + '_rout-smoothed-metric">' + data[protocol][prefix]["route_smoothed_metric"] + '</td>\
                                 <td class="td" data-title="routes_' + protocol + '_refmetric">' + data[protocol][prefix]["refmetric"] + '</td>\
                                 <td class="td" data-title="routes_' + protocol + '_id">' + data[protocol][prefix]["id"] + '</td>\
                                 <td class="td" data-title="routes_' + protocol + '_seqno">' + data[protocol][prefix]["seqno"] + '</td>\
                                 <td class="td" data-title="routes_' + protocol + '_channels">' + data[protocol][prefix]["channels"] + '</td>\
                                 <td class="td" data-title="routes_' + protocol + '_age">' + data[protocol][prefix]["age"] + '</td>\
                                 <td class="td" data-title="routes_' + protocol + '_via">' + data[protocol][prefix]["via"] + '</td>\
                                 <td class="td" data-title="routes_' + protocol + '_nexthop">' + data[protocol][prefix]["nexthop"] + '</td>\
                                 <td class="td" data-title="routes_' + protocol + '_installed">' + data[protocol][prefix]["installed"] + '</td>\
                                 <td class="td" data-title="routes_' + protocol + '_feasible">' + data[protocol][prefix]["feasible"] + '</td>';

            prefixRow.innerHTML = prefixContent;
            table.appendChild(prefixRow);
        }
        target.appendChild(table);
    }
}

function renderTableNeighbours(data, target_id) {
    for (var protocol in data) {
        var target = document.getElementById(target_id);

        var title = document.createElement('h3');
        title.appendChild(document.createTextNode('Neighbours ' + protocol));
        target.appendChild(title);

        var table = document.createElement('table');
        table.setAttribute('class', 'table');
        table.setAttribute('id', 'babel_overview_neighbours_' + protocol);

        var headerRow = document.createElement('tr');
        headerRow.setAttribute('class', 'tr table-titles');
        var headerContent = '<th class="th" style="font-weight: 700;">' + protocol + ' Neighbour</th>\
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
            var neighbourContent = '<td class="td" data-title="' + protocol + '_neighbour">' + neighbour + '</td>\
                                    <td class="td" data-title="neighbours_' + protocol + '_dev">' + data[protocol][neighbour]["dev"] + '</td>\
                                    <td class="td" data-title="neighbours_' + protocol + '_hello-reach">' + data[protocol][neighbour]["hello-reach"] + '</td>\
                                    <td class="td" data-title="neighbours_' + protocol + '_rxcost">' + data[protocol][neighbour]["rxcost"] + '</td>\
                                    <td class="td" data-title="neighbours_' + protocol + '_txcost">' + data[protocol][neighbour]["txcost"] + '</td>\
                                    <td class="td" data-title="neighbours_' + protocol + '_rtt">' + data[protocol][neighbour]["rtt"] + '</td>\
                                    <td class="td" data-title="neighbours_' + protocol + '_channel">' + data[protocol][neighbour]["channel"] + '</td>\
                                    <td class="td" data-title="neighbours_' + protocol + '_if_up">' + data[protocol][neighbour]["if_up"] + '</td>';

            neighbourRow.innerHTML = neighbourContent;
            table.appendChild(neighbourRow);
        }
        target.appendChild(table);
    }
}

function renderTableInfo(data, target_id) {
    var target = document.getElementById(target_id);

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
    var neighbourContent = '<td class="td" data-title="info_babeld-version">' + data["babeld-version"] + '</td>\
                            <td class="td" data-title="info_dev">' + data["my-id"] + '</td>\
                            <td class="td" data-title="info_hello-reach">' + data["host"] + '</td>';

    neighbourRow.innerHTML = neighbourContent;
    table.appendChild(neighbourRow);
    target.appendChild(table);
}
