'use strict';
'require rpc';
'require uci';
'require ui';
'require fs';
'require form';
'require network';
'require tools.widgets as widgets';

var eventSource,
	hideStart = false;

var callIperf3Start = rpc.declare({
	object: 'luci.tputmeas',
	method: 'iperf3Start',
	params:  [ "mode", "server_address", "interface", "interface_address", "port",
			   "duration", "bytes", "udp", "bitrate", "reverse", "bidir", "connections", "interval" ],
	expect: { '': {} }
});

var callIperf3Stop =  rpc.declare({
	object: 'luci.tputmeas',
	method: 'iperf3Stop',
	expect: { '': {} }
});

function stopIperf3() {
	callIperf3Stop().then(function(replay) {
		if (eventSource)
			eventSource.close();
	}.bind(this)).catch(function(error) {
	});
}

window.addEventListener('beforeunload', stopIperf3);

function addOutput() {
	var iperf3Out = document.querySelectorAll('[id$="iperf3_out"]')[0];
	if (iperf3Out)
		return;

	var frameEl = E('div', {'class': 'cbi-value'});

	frameEl.appendChild(E('textarea', {
			'id': 'iperf3_out',
			'class': 'cbi-input-textarea',
			'readonly': '',
			'style': 'width:100%',
			'rows': 30,
	}));

	frameEl.firstElementChild.style.fontFamily = 'monospace';

	var stopBtn = document.querySelectorAll('[id$="stop_iperf3"]')[0];
	if (stopBtn)
		stopBtn.parentNode.insertBefore(frameEl, stopBtn.nextSibling);
}

function subscribeIperf3() {
	if (eventSource)
		eventSource.close();

	eventSource = new EventSource('/ubus/subscribe/luci.tputmeas.notify')
	eventSource.onerror = function(event) {
		console.log(event);
		eventSource.close();
	};

	addOutput();
	var textOut = document.querySelectorAll('[id$="iperf3_out"]')[0];
	textOut.value = ""
	eventSource.addEventListener("luci.tputmeas.notify.data", function(event) {
		textOut.value = textOut.value + "\n" + JSON.parse(event.data).data;
	});
};

function updateButtons() {
	var tasks = [];
	tasks.push(fs.stat("/var/run/luci-iperf3.pid").then(L.bind(function(list) {
			if (!eventSource || eventSource.readyState == 2)
				subscribeIperf3();
			var textOut = document.querySelectorAll('[id$="iperf3_out"]')[0];
			if (textOut)
				textOut.style.borderColor = "green";
			var startBtn = document.querySelectorAll('[id$="start_iperf3"]')[0];
			if (startBtn)
				startBtn.hidden = true;
			var stopBtn = document.querySelectorAll('[id$="stop_iperf3"]')[0];
			if (stopBtn)
				stopBtn.hidden = false;
			return;
		})).catch(function(error) {
			var textOut = document.querySelectorAll('[id$="iperf3_out"]')[0];
			if (textOut)
				textOut.style.borderColor = "red";
			var startBtn = document.querySelectorAll('[id$="start_iperf3"]')[0];
			if (startBtn)
				startBtn.hidden = hideStart;
			var stopBtn = document.querySelectorAll('[id$="stop_iperf3"]')[0];
			if (stopBtn)
				stopBtn.hidden = true;
			if (eventSource)
				eventSource.close();
	}));

	return  Promise.all(tasks);
}

return L.view.extend({

	render: function(processes) {
		var m, s, o;

		m = new form.Map('luci_tputmeas', _('Throughput Measurements - Iperf3 Client'), _('Iperf3 is a tool for performing network throughput measurements. It can test TCP, UDP, or SCTP throughput. To perform an iperf3 test the user must establish both a server and a client.'));
		s = m.section(form.TypedSection, 'iperf3')
		s.anonymous = 1;

		o = s.option(form.Value, 'server_address', _('Server address'), _('Address of the iperf3 server'));
		o.optional = false;
		o.datatype = 'ip4addr("nomask")';

		o = s.option(widgets.DeviceSelect, 'interface', _('Interface'), _('Bind to the specific interface associated with address host.'))
		o.noaliases = true;

		o = s.option(form.Value, 'interface_address', _('Interface address'), _('Bind to the specific interface address associated with address host.'));
		o.optional = false;
		o.datatype = 'ip4addr("nomask")';
		o.depends('interface', undefined);

		o = s.option(form.Value, 'port', _('Port'), _('Set server port to listen on/connect to to n (default 5201)'));
		o.modalonly = false;
		o.datatype = 'list(neg(port))';
		o.default = '5201'

		o = s.option(form.Value, 'duration', _('Duration'), _('Time in seconds to transmit for (default 10 secs)'));
		o.modalonly = false;
		o.datatype = 'range(1,4294967296)'
		o.validate =function(section_id, value) {
			var bytes_input = document.querySelectorAll('[id$="bytes"]'),
				duration_input = document.querySelectorAll('[id$="duration"]');

			if (bytes_input[2] && bytes_input[2].value && duration_input[2].value){
				hideStart = true;
				return _("Only one test end condition (duration or bytes) may be specified")
			}
			hideStart = false;

			return true;
		}

		o = s.option(form.Value, 'bytes', _('Bytes'), _('Number of bytes to transmit (instead of duration)'));
		o.modalonly = false;
		o.validate = function(section_id, value) {
			var bytes_input = document.querySelectorAll('[id$="bytes"]'),
				duration_input = document.querySelectorAll('[id$="duration"]');

			if (duration_input[2] && duration_input[2].value && bytes_input[2].value) {
				hideStart = true;
				return _("Only one test end condition (duration or bytes) may be specified")
			}
			hideStart = false;

			return true;
		}

		o = s.option(form.Value, 'bitrate', _('Bitrate'), _('Set target bitrate to n bits/sec (default 1 Mbit/sec for UDP, unlimited for TCP/SCTP).'));
		o.modalonly = false;

		o = s.option(form.Value, 'connections', _('Connections'), _('Number of parallel client streams to run. '));
		o.modalonly = false;
		o.datatype = 'range(1,4294967296)';

		o = s.option(form.Value, 'interval', _('Interval'), _('Pause n seconds between periodic throughput reports; default is 1, use 0 to disable'));
		o.modalonly = false;
		o.datatype = 'range(1,4294967296)';

		o = s.option(form.Flag, 'udp', _('Udp'), _("Use UDP rather than TCP"));

		o = s.option(form.Flag, 'reverse', _('Reverse'), _("Reverse the direction of a test, so that the server sends data to the client"));

		o = s.option(form.Flag, 'bidir', _('Bidirectional'), _("Run in bidirectional mode"))

		o = s.option(form.Button, 'start_iperf3', _('Start iperf3'), _(''));
		o.inputstyle = 'apply';
		o.onclick = ui.createHandlerFn(this, function(section_id, ev) {
			var iface = document.querySelectorAll('[id$="interface"]')[1].value ? document.querySelectorAll('[id$="interface"]')[1].value : null,
				port = document.querySelectorAll('[id$="port"]')[2].value ?  document.querySelectorAll('[id$="port"]')[2].value : null,
				server_address = document.querySelectorAll('[id$="server_address"]')[2].value ? document.querySelectorAll('[id$="server_address"]')[2].value : null,
				interface_address = document.querySelectorAll('[id$="interface_address"]')[2].value ? document.querySelectorAll('[id$="interface_address"]')[2].value : null,
				duration = document.querySelectorAll('[id$="duration"]')[2].value ? document.querySelectorAll('[id$="duration"]')[2].value : null,
				bytes = document.querySelectorAll('[id$="bytes"]')[2].value ? document.querySelectorAll('[id$="bytes"]')[2].value : null,
				bitrate = document.querySelectorAll('[id$="bitrate"]')[2].value ? document.querySelectorAll('[id$="bitrate"]')[2].value : null,
				connections = document.querySelectorAll('[id$="connections"]')[2].value ? document.querySelectorAll('[id$="connections"]')[2].value : null,
				interval = document.querySelectorAll('[id$="interval"]')[2].value ? document.querySelectorAll('[id$="interval"]')[2].value : null,
				udp = document.querySelectorAll('[data-widget-id$="udp"]')[0].checked ? true : false,
				reverse = document.querySelectorAll('[data-widget-id$="reverse"]')[0].checked ? true : false,
				bidir = document.querySelectorAll('[data-widget-id$="bidir"]')[0].checked ? true : false;

			return callIperf3Start("-c", server_address, iface, interface_address, port,
									duration, bytes, udp, bitrate, reverse, bidir, connections, interval).then(function(replay) {
				if (replay.error){
					ui.showModal(_(replay.error), [
						E('div', { 'class': 'right' }, [
							E('button', {
								'class': 'cbi-button cbi-button-negative important',
								'click': function(ev) {
									ui.hideModal();
								}
							}, _('Close')),
						])
					]);
					return;
				}
				rpc.list.apply(rpc).then(function(res) {
					for (var k in res) {
						if (res[k] == "luci.tputmeas.notify")
							subscribeIperf3()
					}
				}.bind(this))}.bind(this)).catch(function(error) {
					console.log(error);
				});
		});

		o = s.option(form.Button, 'stop_iperf3', _('Stop iperf3'), _(''));
		o.inputstyle = 'apply';
		o.onclick =  ui.createHandlerFn(this, function(section_id, ev) {
			if (!eventSource)
				return;
			return callIperf3Stop().then(function(replay) {
				eventSource.close();
			}.bind(this)).catch(function(error) {
				console.log(error);
			});
		});

		L.Poll.add(L.bind(updateButtons, m),1);

		return m.render();
	},
});
