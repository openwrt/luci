'use strict';
'require ui';
'require uci';
'require form';
'require rpc';
'require view';

const read_domains = rpc.declare({
    object: 'luci.antiblock',
    method: 'read_domains',
    params: ['domains_path']
});

const write_domains = rpc.declare({
    object: 'luci.antiblock',
    method: 'write_domains',
    params: ['domains_path', 'domains']
});

let section_routes;
let section_data;
let domains_textarea;

function write_domains_handler() {
    ui.showModal(null, [E('p', { class: 'spinning' }, _('Write domains'))]);
    const lines = domains_textarea.value.split(/\r?\n/).filter(Boolean);
    const domains_path = section_routes.selectedOptions[0].label;
    const write_domains_res = Promise.all([write_domains(domains_path, lines)]);
    write_domains_res.then(function () { location.reload(); });
}

function read_domains_handler(data) {
    section_data.innerHTML = '';

    const section_descr_div = E('div', { class: 'cbi-section-descr' }, _('Domains count in file: ') + data[0].domains.length);

    domains_textarea = E('textarea', { class: 'cbi-input-textarea' },);
    domains_textarea.value = '';
    data[0].domains.forEach((element) => domains_textarea.value += element + '\n');

    const btn_write_domains = E('button', { class: 'cbi-button cbi-button-apply', click: write_domains_handler }, _('Write domains'));
    const div_for_btn = E('div', { style: 'padding-top: 20px' });
    div_for_btn.appendChild(btn_write_domains);

    section_data.appendChild(section_descr_div);
    section_data.appendChild(domains_textarea);
    section_data.appendChild(div_for_btn);
}

function select_handler() {
    const domains_path = section_routes.selectedOptions[0].label;
    const read_domains_res = Promise.all([read_domains(domains_path)]);
    read_domains_res.then(read_domains_handler);
}

return view.extend({
    handleSaveApply: null,
    handleSave: null,
    handleReset: null,
    load: function () {
        return Promise.all([uci.load('antiblock')]);
    },
    render: function () {
        let uci_routes = uci.sections('antiblock', 'route');

        let file_paths = 0;

        section_routes = E('select', { class: 'cbi-input-select', change: select_handler });
        uci_routes.forEach((route) => {
            if (route.domains_path.substring(0, 4) != 'http') {
                const routes_option = E('option', { value: route.domains_path }, route.domains_path);
                section_routes.appendChild(routes_option);
                file_paths++;
            }
        });

        const main_div = E([]);
        main_div.appendChild(E('h2', _('Domains')));

        if (file_paths > 0) {
            const routes_div = E('div', { class: 'cbi-section' });
            routes_div.appendChild(E('div', { class: 'cbi-section-descr' }, _('Domains path:')));
            routes_div.appendChild(section_routes);
            main_div.appendChild(routes_div);

            section_data = E('div', { class: 'cbi-section' });
            main_div.appendChild(section_data);

            select_handler();
        } else {
            const routes_div = E('div', { class: 'cbi-section' });
            routes_div.appendChild(E('div', { class: 'cbi-section-descr' }, _('Path to file in "Domains path" is not set.')));
            main_div.appendChild(routes_div);
        }

        return main_div;
    }
});
