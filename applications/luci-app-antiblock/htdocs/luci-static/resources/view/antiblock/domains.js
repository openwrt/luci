'use strict';
'require ui';
'require uci';
'require fs';
'require form';
'require view';

let section_routes;
let section_data;
let domains_textarea;

async function write_domains_handler() {
    ui.showModal(null, [E('p', { class: 'spinning' }, _('Write domains'))]);
    const lines = domains_textarea.value.split(/\r?\n/).filter(Boolean);
    let write_data = '';
    lines.forEach(function (element) { write_data += element + '\n' });
    const domains_path = section_routes.selectedOptions[0].label;
    try {
        await fs.write(domains_path, write_data);
        await fs.exec('/etc/init.d/antiblock', ['restart']);
    } catch (err) {
        ui.addNotification(null, E('p', {}, _('Unable to write to domains file') + ' ' + domains_path + ' "' + err.message + '"'));
    }
    ui.hideModal();
    select_handler();
}

function read_domains_handler(data) {
    const text_data = data.split(/\r?\n/).filter(Boolean);
    const section_descr_div = E('div', { class: 'cbi-section-descr' }, _('Domain count in file:') + ' ' + text_data.length);

    domains_textarea = E('textarea', { class: 'cbi-input-textarea' },);
    domains_textarea.value = '';
    text_data.forEach(function (element) { domains_textarea.value += element + '\n' });

    const btn_write_domains = E('button', { class: 'cbi-button cbi-button-apply', click: write_domains_handler }, _('Write domains'));
    const div_for_btn = E('div', { style: 'padding-top: 20px' });
    div_for_btn.appendChild(btn_write_domains);

    section_data.innerHTML = '';
    section_data.appendChild(section_descr_div);
    section_data.appendChild(domains_textarea);
    section_data.appendChild(div_for_btn);
}

function select_handler() {
    section_data.innerHTML = '';
    const domains_path = section_routes.selectedOptions[0].label;
    fs.read_direct(domains_path).then(
        read_domains_handler
    ).catch(
        function (err) {
            if (err.message == 'Failed to stat requested path') {
                fs.exec('/bin/mkdir', ['/etc/antiblock']).then(
                    fs.write(domains_path, '').then(
                        read_domains_handler("")
                    ).catch(
                        function (err) {
                            section_data.appendChild(E('p', {}, _('Unable to create domains file') + ' ' + domains_path + ' "' + err.message + '"'));
                        }
                    )
                );
            } else {
                section_data.appendChild(E('p', {}, _('Unable to read domains file') + ' ' + domains_path + ' "' + err.message + '"'));
            }
        }
    );
}

return view.extend({
    handleSaveApply: null,
    handleSave: null,
    handleReset: null,
    load: async function () {
        return await uci.load('antiblock');
    },
    render: function () {
        const uci_routes = uci.sections('antiblock', 'route');

        section_routes = E('select', { class: 'cbi-input-select', change: select_handler });
        uci_routes.forEach(function (route) {
            if (route.domains_path.substring(0, 4) != 'http') {
                const routes_option = E('option', { value: route.domains_path }, route.domains_path);
                section_routes.appendChild(routes_option);
            }
        });

        const main_div = E([]);
        main_div.appendChild(E('h2', _('Domains')));

        if (section_routes.innerHTML != '') {
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
