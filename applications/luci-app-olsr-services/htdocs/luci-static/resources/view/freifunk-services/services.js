'use strict';
'require rpc';
'require view';
'require poll';

const getOlsrd4Services = rpc.declare({
    object: 'olsr-services',
    method: 'services4',
    expect: {}
});

const getOlsrd6Services = rpc.declare({
    object: 'olsr-services',
    method: 'services6',
    expect: {}
});

function createTableData(servicesArray) {
    var tableData = [];
    servicesArray.forEach(function (service) {
        var sourceUrl = service.isIpv6 ? '[' + service.source + ']' : service.source;
        tableData.push(
            [
                E('a', { 'href': service.url }, service.description),
                service.protocol,
                E('a', { 'href': 'http://' + sourceUrl + '/cgi-bin-status.html' }, service.source)
            ]
        );
    });
    return tableData;
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
                cbi_update_table("#olsr_services", createTableData(servicesArray));
            });
        }, 30);
        return E([], {}, [
            E('h2', { 'name': 'content' }, [_('Services')]),
            E('legend', {}, [_('Internal services')]),
            E('fieldset', { 'class': 'cbi-section' }, [
                E('table', { 'id': 'olsr_services' }, [
                    E('tr', { 'class' : 'tr table-titles'}, [
                        E('td', { 'class' : 'th'}, _('Url')),
                        E('td', { 'class' : 'th'}, _('Protocol')),
                        E('td', { 'class' : 'th'}, _('Source'))
                    ]),
                ])
            ]),
        ]);
    }
});
