'use strict';
'require fs';
'require view';

return view.extend({
    load: function() {
        return L.resolveDefault(fs.read_direct('/tmp/basicstation/log'), '');
    },

    render: function(log) {
        return E('div', { 'class': 'cbi-map', 'id': 'map' }, [
            E('h2', _('Log Messages')),
            E('div', { 'class': 'cbi-section' }, [
                E('pre', [ log ])
            ]),
        ])
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
})
