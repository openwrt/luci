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

        var table = document.createElement('div');
        table.setAttribute('class', 'table');
        table.setAttribute('id', 'babel_overview_xroutes_' + protocol);

        var headerRow = document.createElement('div');
        headerRow.setAttribute('class', 'tr table-titles');
        var headerContent = '<div class="th" style="font-weight: 700;">' + protocol + ' Prefix</div>\
                             <div class="th" style="font-weight: 700;">Metric</div>\
                             <div class="th" style="font-weight: 700;">Source-Prefix</div>';

        headerRow.innerHTML = headerContent;
        table.appendChild(headerRow);


        for (var prefix in data[protocol]) {
            var prefixRow = document.createElement('div');
            prefixRow.setAttribute('class', 'tr');
            var prefixContent = '<div class="td" data-title="xroutes_' + protocol + '_prefix">' + prefix + '</div>\
                                 <div class="td" data-title="xroutes_' + protocol + '_metric">' + data[protocol][prefix]["metric"] + '</div>\
                                 <div class="td" data-title="xroutes_' + protocol + '_src-prefix">' + data[protocol][prefix]["src-prefix"] + '</div>';

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

        var table = document.createElement('div');
        table.setAttribute('class', 'table');
        table.setAttribute('id', 'babel_overview_routes_' + protocol);

        var headerRow = document.createElement('div');
        headerRow.setAttribute('class', 'tr table-titles');
        var headerContent = '<div class="th" style="font-weight: 700;">' + protocol + ' Prefix</div>\
                             <div class="th" style="font-weight: 700;">Source-Prefix</div>\
                             <div class="th" style="font-weight: 700;">Route-Metric</div>\
                             <div class="th" style="font-weight: 700;">Route Smoothed Metric</div>\
                             <div class="th" style="font-weight: 700;">Refmetric</div>\
                             <div class="th" style="font-weight: 700;">ID</div>\
                             <div class="th" style="font-weight: 700;">Seq. No.</div>\
                             <div class="th" style="font-weight: 700;">Channes</div>\
                             <div class="th" style="font-weight: 700;">Age</div>\
                             <div class="th" style="font-weight: 700;">Via</div>\
                             <div class="th" style="font-weight: 700;">Nexthop</div>\
                             <div class="th" style="font-weight: 700;">Installed</div>\
                             <div class="th" style="font-weight: 700;">Feasible</div>';

        headerRow.innerHTML = headerContent;
        table.appendChild(headerRow);

        for (var prefix in data[protocol]) {
            var prefixRow = document.createElement('div');
            prefixRow.setAttribute('class', 'tr');
            var prefixContent = '<div class="td" data-title="routes_' + protocol + '_prefix">' + prefix + '</div>\
                                 <div class="td" data-title="routes_' + protocol + '_src-prefix">' + data[protocol][prefix]["src-prefix"] + '</div>\
                                 <div class="td" data-title="routes_' + protocol + '_metric">' + data[protocol][prefix]["route_metric"] + '</div>\
                                 <div class="td" data-title="routes_' + protocol + '_rout-smoothed-metric">' + data[protocol][prefix]["route_smoothed_metric"] + '</div>\
                                 <div class="td" data-title="routes_' + protocol + '_refmetric">' + data[protocol][prefix]["refmetric"] + '</div>\
                                 <div class="td" data-title="routes_' + protocol + '_id">' + data[protocol][prefix]["id"] + '</div>\
                                 <div class="td" data-title="routes_' + protocol + '_seqno">' + data[protocol][prefix]["seqno"] + '</div>\
                                 <div class="td" data-title="routes_' + protocol + '_channels">' + data[protocol][prefix]["channels"] + '</div>\
                                 <div class="td" data-title="routes_' + protocol + '_age">' + data[protocol][prefix]["age"] + '</div>\
                                 <div class="td" data-title="routes_' + protocol + '_via">' + data[protocol][prefix]["via"] + '</div>\
                                 <div class="td" data-title="routes_' + protocol + '_nexthop">' + data[protocol][prefix]["nexthop"] + '</div>\
                                 <div class="td" data-title="routes_' + protocol + '_installed">' + data[protocol][prefix]["installed"] + '</div>\
                                 <div class="td" data-title="routes_' + protocol + '_feasible">' + data[protocol][prefix]["feasible"] + '</div>';

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

        var table = document.createElement('div');
        table.setAttribute('class', 'table');
        table.setAttribute('id', 'babel_overview_neighbours_' + protocol);

        var headerRow = document.createElement('div');
        headerRow.setAttribute('class', 'tr table-titles');
        var headerContent = '<div class="th" style="font-weight: 700;">' + protocol + ' Neighbour</div>\
                             <div class="th" style="font-weight: 700;">Device</div>\
                             <div class="th" style="font-weight: 700;">Hello-Reach</div>\
                             <div class="th" style="font-weight: 700;">RX cost</div>\
                             <div class="th" style="font-weight: 700;">TX cost</div>\
                             <div class="th" style="font-weight: 700;">RTT</div>\
                             <div class="th" style="font-weight: 700;">Channel</div>\
                             <div class="th" style="font-weight: 700;">Interface up</div>';

        headerRow.innerHTML = headerContent;
        table.appendChild(headerRow);

        for (var neighbour in data[protocol]) {
            var neighbourRow = document.createElement('div');
            neighbourRow.setAttribute('class', 'tr');
            var neighbourContent = '<div class="td" data-title="' + protocol + '_neighbour">' + neighbour + '</div>\
                                    <div class="td" data-title="neighbours_' + protocol + '_dev">' + data[protocol][neighbour]["dev"] + '</div>\
                                    <div class="td" data-title="neighbours_' + protocol + '_hello-reach">' + data[protocol][neighbour]["hello-reach"] + '</div>\
                                    <div class="td" data-title="neighbours_' + protocol + '_rxcost">' + data[protocol][neighbour]["rxcost"] + '</div>\
                                    <div class="td" data-title="neighbours_' + protocol + '_txcost">' + data[protocol][neighbour]["txcost"] + '</div>\
                                    <div class="td" data-title="neighbours_' + protocol + '_rtt">' + data[protocol][neighbour]["rtt"] + '</div>\
                                    <div class="td" data-title="neighbours_' + protocol + '_channel">' + data[protocol][neighbour]["channel"] + '</div>\
                                    <div class="td" data-title="neighbours_' + protocol + '_if_up">' + data[protocol][neighbour]["if_up"] + '</div>';

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

    var table = document.createElement('div');
    table.setAttribute('class', 'table');
    table.setAttribute('id', 'babel_overview_info');


    var headerRow = document.createElement('div');
    headerRow.setAttribute('class', 'tr table-titles');
    var headerContent = '<div class="th" style="font-weight: 700;">Babeld Version</div>\
                         <div class="th" style="font-weight: 700;">My-ID</div>\
                         <div class="th" style="font-weight: 700;">Host</div>';

    headerRow.innerHTML = headerContent;
    table.appendChild(headerRow);

    var neighbourRow = document.createElement('div');
    neighbourRow.setAttribute('class', 'tr');
    var neighbourContent = '<div class="td" data-title="info_babeld-version">' + data["babeld-version"] + '</div>\
                            <div class="td" data-title="info_dev">' + data["my-id"] + '</div>\
                            <div class="td" data-title="info_hello-reach">' + data["host"] + '</div>';

    neighbourRow.innerHTML = neighbourContent;
    table.appendChild(neighbourRow);
    target.appendChild(table);
}
