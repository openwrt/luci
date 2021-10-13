'use strict';
'require view';

return view.extend({
    render: function() {
        var ssl = '0';
        var port = 19999;
        return E('iframe', {
            src: (ssl === '1' ? 'https' : 'http') + '://' + window.location.hostname + ':' + port,
            style: 'width: 100%; min-height: 1200px; border: none; border-radius: 3px;',
        })
    }
});
