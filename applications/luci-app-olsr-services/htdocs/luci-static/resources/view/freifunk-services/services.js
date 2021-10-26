'use strict';
'require rpc';
'require view';
'require poll';

const tableHead = '<div class="tr cbi-section-table-titles">' +
    '<div class="th cbi-section-table-cell">' + _('Url') + '</div>' +
    '<div class="th cbi-section-table-cell">' + _('Protocol') + '</div>' +
    '<div class="th cbi-section-table-cell">' + _('Source') + '</div>' +
    '</div>';

var getOlsrd4Services = rpc.declare({
    object: 'olsr-services',
    method: 'services4',
    expect: {}
});

var getOlsrd6Services = rpc.declare({
    object: 'olsr-services',
    method: 'services6',
    expect: {}
});

function updateServicesTable(servicesArray) {
    var table = document.getElementById("olsr_services");
    var tempElement = document.createElement('div');
    tempElement.innerHTML = tableHead;
    table.replaceChildren(tempElement.firstChild);
    servicesArray.forEach(function (service, index) {
        var node = document.createElement('div');
        var index = 1 + index % 2;
        var sourceUrl = service.isIpv6 ? '[' + service.source + ']' : service.source;
        node.classList.add('tr', 'cbi-section-table-row', 'cbi-rowstyle-' + index);
        node.innerHTML =
            '<div class="td cbi-section-table-cell left"><a href="' + service.url + '">' + service.description + '</a></div>' +
            '<div class="td cbi-section-table-cell left">' + service.protocol + '</div>' +
            '<div class="td cbi-section-table-cell left"><a href="http://' + sourceUrl + '/cgi-bin-status.html">' + service.source + '</a></div>';
        table.appendChild(node);
    });
}

function extractServiceInformation(results) {
    var servicesArray = [];
    results.forEach(function(result) {
        if (result.configured && result.services != "") {
            var isIpv6 = result.source == "olsrd6";
            var services = result.services.split('\n');
            services.forEach(function (service) {
                var source = service.split('#')[1];
                var serviceRawDescription = service.replace(/\t/g, '').split('#')[0].split('|');
                var url = serviceRawDescription[0];
                var protocol = serviceRawDescription[1];
                var description = serviceRawDescription[2];
                servicesArray.push({ "source": source, "url": url, "protocol": protocol, "description": description, "isIpv6": isIpv6 });
            });
        }
    });
    return servicesArray;
}

return view.extend({
    handleSaveApply: null,
    handleSave: null,
    handleReset: null,
    render: function (data) {
        poll.add(function () {
            Promise.all([getOlsrd4Services(), getOlsrd6Services()]).then(function (results) {
                var servicesArray = extractServiceInformation(results);
                updateServicesTable(servicesArray);
            });
        }, 30);
        return E([], {}, [
            E('h2', { 'name': 'content' }, [_('Services')]),
            E('legend', {}, [_('Internal services')]),
            E('fieldset', { 'class': 'cbi-section' }, [
                E('div', { 'class': 'table cbi-section-table', 'id': 'olsr_services' }, [
                    E(tableHead)
                ])
            ]),
        ]);
    }
});
