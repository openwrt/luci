'use strict';
'require view';
'require fs';
'require poll';
'require ui';
'require uci';

let main_config;

return view.extend({
    retrieveLog: async function () {
        return fs.read_direct('/tmp/antiblock/stat.txt').then(function (logdata) {
            const loglines = logdata.trim().split(/\n/).map(function (line) {
                return line.replace(/^<\d+>/, '');
            });
            return { value: loglines.join('\n'), rows: loglines.length + 1 };
        }).catch(function (err) {
            ui.addNotification(null, E('p', {}, _('Unable to load statistics data:') + ' ' + err.message));
            return '';
        });
    },

    pollLog: async function () {
        const element = document.getElementById('syslog');
        if (element) {
            const log = await this.retrieveLog();
            element.value = log.value;
            element.rows = log.rows;
        }
    },

    load: async function () {
        await uci.load('antiblock');

        main_config = uci.sections('antiblock', 'main');
        if (!main_config[0]?.stat || main_config[0]?.stat === '0') {
            return;
        }

        poll.add(this.pollLog.bind(this), 10);

        return await this.retrieveLog();
    },

    render: function (loglines) {
        const main_div = E([]);
        main_div.appendChild(E('h2', _('Statistics')));
        const routes_div = E('div', { class: 'cbi-section' });
        routes_div.appendChild(E('div', { class: 'cbi-section-descr' }, _('Statistics are not enabled.')));
        main_div.appendChild(routes_div);

        if (!main_config[0]?.stat || main_config[0]?.stat === '0') {
            return main_div;
        }

        return E([], [
            E('h2', {}, [_('Statistics')]),
            E('div', { 'id': 'content_syslog' }, [
                E('textarea', {
                    'id': 'syslog',
                    'style': 'font-size:12px',
                    'readonly': 'readonly',
                    'wrap': 'off',
                    'rows': loglines.rows
                }, [loglines.value])
            ])
        ]);
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});
