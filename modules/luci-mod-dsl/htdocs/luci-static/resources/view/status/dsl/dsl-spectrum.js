//
// OpenWRT Status menu option to display DSL spectrum graph
//
//
//
'use strict';
'require view';
'require fs';
'require ui';


return view.extend({
        load: function() {

                  return Promise.all([
                      fs.exec_direct('/sbin/dsl_cpe_pipe.sh', ['g997dsnrg', '0 1']),
                      fs.exec_direct('/sbin/dsl_cpe_pipe.sh', ['g997dsnrg', '1 1']),
                      fs.exec_direct('/sbin/dsl_cpe_pipe.sh', ['g997bansg', '0']),
                      fs.exec_direct('/sbin/dsl_cpe_pipe.sh', ['g997bansg', '1']),
                      fs.exec_direct('/sbin/dsl_cpe_pipe.sh', ['g997dqlng', '0 1']),
                      fs.exec_direct('/sbin/dsl_cpe_pipe.sh', ['g997dqlng', '1 1']),
                      fs.exec_direct('/sbin/dsl_cpe_pipe.sh', ['g997dhlogg', '0 1']),
                      fs.exec_direct('/sbin/dsl_cpe_pipe.sh', ['g997dhlogg', '1 1'])
                 ]);
        },


        render: function(data) {

                var v = E([], [
                        E('h2', {'style': "height: 40px"}, [ _('DSL line spectrum') ]),
                        E('p', {}, 'Graphs below show Signal-to-noise ratio, Bit allocation, Quiet line noise and Channel characteristics function (HLOG) per sub-carrier.'),
                        E('div', {'style':'display:none', 'id':'usdB'}, data[0] ),
                        E('div', {'style':'display:none','id':'dsdB'}, data[1] ),
                        E('div', {'style':'display:none','id':'usBits'}, data[2] ),
                        E('div', {'style':'display:none','id':'dsBits'}, data[3] ),
                        E('div', {'style':'display:none','id':'usQln'}, data[4] ),
                        E('div', {'style':'display:none','id':'dsQln'}, data[5] ),
                        E('div', {'style':'display:none','id':'usHLog'}, data[6] ),
                        E('div', {'style':'display:none','id':'dsHLog'}, data[7] ),
                        E('div', {'style': "height: 360px; width: 1024px"},
                                 E('canvas', {
                                      'id': 'dbChart',
                                      'height': 360,
                                      'width': 1024},
                                      ["chart"])
                        ),
                        E('div', {'style': "height: 360px; width:1024px"},
                                 E('canvas', {
                                       'id': 'bitsChart',
                                       'height': 360,
                                       'width': 1024},
                                      ["chart2"])
                        ),
                        E('div', {'style': "height: 360px; width:1024px"},
                                 E('canvas', {
                                       'id': 'qlnChart',
                                       'height': 360,
                                       'width': 1024},
                                      ["chart2"])
                        ),
                        E('div', {'style': "height: 360px; width:1024px"},
                                 E('canvas', {
                                       'id': 'hlogChart',
                                       'height': 360,
                                       'width': 1024},
                                      ["chart2"])
                        ),
                        E('script', {'src':'/luci-static/resources/view/status/dsl/dsl-graph-new.js'}, {}
                        )
                ]);


        return v;
        },

        handleSaveApply: null,
        handleSave: null,
        handleReset: null
});
dsHLog
