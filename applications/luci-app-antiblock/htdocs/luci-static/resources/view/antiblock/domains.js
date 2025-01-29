'use strict';
'require ui';
'require form';
'require rpc';
'require view';

const read_domains = rpc.declare({
    object: 'luci.antiblock',
    method: 'read_domains'
});

const write_domains = rpc.declare({
    object: 'luci.antiblock',
    method: 'write_domains',
    params: ['domains']
});

return view.extend({
    generic_failure: function (message) {
        return E('div', {
            'class': 'error'
        }, ['RPC call failure: ', message]);
    },
    load: function () {
        return Promise.all([
            read_domains()
        ]);
    },
    render: function (data) {
        const main_div = E('div');

        const header = E('h2', {}, _('AntiBlock'));

        const section_descr_div = E(
            'div',
            {
                class: 'cbi-section-descr',
            },
            _('Domains count in file: ')
        );

        const section_div = E(
            'div',
            {
                class: 'cbi-section',
            }
        );

        main_div.appendChild(header);
        main_div.appendChild(section_div);
        section_div.appendChild(section_descr_div);

        if (typeof data[0].domains !== 'undefined') {
            const domains_textarea = E(
                'textarea',
                {
                    class: 'cbi-input-textarea',
                },
            );

            section_descr_div.innerHTML += data[0].domains.length;

            domains_textarea.value = '';
            data[0].domains.forEach((element) => domains_textarea.value += element + '\n');

            const btn_write_domains = E(
                'button',
                {
                    class: 'btn cbi-button cbi-button-apply',
                    click: function (ev) {
                        ui.showModal(null, [
                            E(
                                'p',
                                { class: 'spinning' },
                                _('Write domains')
                            ),
                        ]);
                        const lines = domains_textarea.value.split(/\r?\n/).filter(Boolean);
                        const write_domains_res = Promise.all([write_domains(lines)]);
                        write_domains_res.then(
                            function (value) { location.reload(); },
                            function (error) { /* code if some error */ }
                        );
                    },
                },
                _('Write domains')
            );

            section_div.appendChild(domains_textarea);
            section_div.appendChild(btn_write_domains);
        } else {
            const error_div = E(
                'div',
                {
                },
                _('The File argument was not specified.')
            );

            section_div.appendChild(error_div);
        }

        return main_div;
    },
    handleSave: null,
    handleSaveApply: null,
    handleReset: null
});
