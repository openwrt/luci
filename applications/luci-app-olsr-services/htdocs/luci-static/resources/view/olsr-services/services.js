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
    const tableData = [];
    servicesArray.forEach(function (service) {
        const sourceUrl = service.isIpv6 ? '[' + service.source + ']' : service.source;
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
    const servicesArray = [];
    results.forEach(function(result) {
        if (result.configured && result.services != "") {
            const isIpv6 = result.source == "olsrd6";
            const services = result.services.split('\n');
            services.forEach(function (service) {
                const source = service.split('#')[1];
                const serviceRawDescription = service.replace(/\t/g, '').split('#')[0].split('|');
                const url = serviceRawDescription[0];
                const protocol = serviceRawDescription[1];
                const description = serviceRawDescription[2];
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
    render() {
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
