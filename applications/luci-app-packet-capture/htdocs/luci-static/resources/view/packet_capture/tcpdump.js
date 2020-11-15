'use strict';
'require rpc';
'require uci';
'require ui';
'require fs';
'require form';
'require network';
'require tools.widgets as widgets';

var eventSource,
	captureFilePoll,
	hostName;

function stopTcpdump() {
	fs.exec("/usr/sbin/packet_capture_stop").then(function(replay) {
		if(eventSource) { 
			eventSource.close();
		}
	}.bind(this)).catch(function(error) {
		console.log(error);
	});
}

window.onbeforeunload = stopTcpdump;

var callLuciProcessList = rpc.declare({
	object: 'luci',
	method: 'getProcessList',
	expect: { result: [] }
});

var callInitAction = rpc.declare({
	object: 'luci',
	method: 'setInitAction',
	params: [ 'name', 'action' ],
	expect: { result: false }
});

function findButton(title) {
	var buttons = document.querySelectorAll('button');
	for (var i=0; i < buttons.length; i++) {
		if (buttons[i].firstChild.nodeValue == title) {
			return buttons[i];
		}
	}
}

function addOutput() {
	var tcpdumpOut = document.querySelectorAll('[id$="tcpdump_out"]')[0];
	if(tcpdumpOut) {
		return;
	}

	var frameEl = E('div', {'class': 'cbi-value'});

	frameEl.appendChild(E('textarea', {
			'id': 'tcpdump_out',
			'class': 'cbi-input-textarea',
			'readonly': '',
			'style': 'width:100%',
			'rows': 30,
	}));

	frameEl.firstElementChild.style.fontFamily = 'monospace';

	var downloadBtn = document.querySelectorAll('[id$="download_file"]')[0];
	if(downloadBtn) {
		downloadBtn.parentNode.insertBefore(frameEl, downloadBtn.nextSibling);
	}
}

var downloadCaptureFile = function(ev) {
	var form = E('form', {
		method: 'post',
		action: '/cgi-bin/cgi-download',
		enctype: 'application/x-www-form-urlencoded'
	}, E('input', { type: 'hidden', name: 'sessionid', value: rpc.getSessionID()},
	   E('input', { type: 'hidden', name: 'path', value: "/tmp/capture.pcap"},
	   E('input', { type: 'hidden', name: 'filename', value: hostName + "-" + Date.now() + ".pcap"}
	))));

	ev.currentTarget.parentNode.appendChild(form);
	form.submit();
	form.parentNode.removeChild(form);
}

function subscribeTcpdump() {
	eventSource = new EventSource('/ubus/subscribe/tcpdump' + '?' + rpc.getSessionID());
	eventSource.onerror = function(event) {
		eventSource.close();
		console.log(event);	
	};

	addOutput();
	var textOut = document.querySelectorAll('[id$="tcpdump_out"]')[0];
	textOut.value = "";
	eventSource.addEventListener("tcpdump.data", function(event) {
		textOut.value = textOut.value + "\n" + JSON.parse(event.data).data;
	});
}

function updateButtons() {
	var tasks = [];
	tasks.push(callLuciProcessList().then(L.bind(function(list) {
		for (var i = 0; i < list.length; i++) {
			if(list[i].COMMAND.includes("/usr/sbin/packet_capture")) {
				var downloadBtn = document.querySelectorAll('[id$="download_file"]')[0];
				if(!downloadBtn) {
					return;
				}
				if(!eventSource || eventSource.readyState == 2) {
					subscribeTcpdump();
				}
				var textOut = document.querySelectorAll('[id$="tcpdump_out"]')[0];
				if(textOut) {
					textOut.style.borderColor = "green";
				}
				var startBtn = document.querySelectorAll('[id$="start_tcpdump"]')[0];
				if(startBtn) {
					startBtn.hidden = true;
				}
				var stopBtn = document.querySelectorAll('[id$="stop_tcpdump"]')[0];
				if(stopBtn) {
					stopBtn.hidden = false;
				}
				return;
			}
		}
		var textOut = document.querySelectorAll('[id$="tcpdump_out"]')[0];
		if(textOut) {
			textOut.style.borderColor = "red";
		}
		var startBtn = document.querySelectorAll('[id$="start_tcpdump"]')[0];
		if(startBtn) {
			startBtn.hidden = false;
		}
		var stopBtn = document.querySelectorAll('[id$="stop_tcpdump"]')[0];
		if(stopBtn) {
			stopBtn.hidden = true;
		}
	})));
	return  Promise.all(tasks);
}

function updatePollCheckCaptureFileExists() {
	checkCaptureFileExists();
	L.Poll.remove(captureFilePoll);
	L.Poll.add(L.bind(checkCaptureFileExists, m),5);
}

function checkCaptureFileExists() {
	var tasks = [];
	tasks.push(fs.stat("/tmp/capture.pcap").then(L.bind(function(res) {
		var downloadBtn = findButton("Download");
		if(!downloadBtn) {
			return;
		}
		var downloadCheckBox = document.querySelectorAll('[id$="file"]')[0].checked;
		if(!downloadCheckBox) {
			fs.remove("/tmp/capture.pcap").then(function(replay) {
				downloadBtn.disabled = true;;
			}.bind(this)).catch(function(error) {
				console.log(error);
			});
		} else {
			downloadBtn.disabled = false;
		}
	})).catch(function(error) {
		var downloadBtn = findButton("Download");
		if(downloadBtn) {
			downloadBtn.disabled = true;
		}
	}));

	return  Promise.all(tasks);
}

return L.view.extend({

	load: function() {
		return Promise.all([
		uci.load('system')
		]);
	},

	handleDownload: function(ev) {
		downloadCaptureFile(ev);
	},

	render: function(processes) {
		var m, s, o;

		hostName = uci.get('system', '@system[0]', 'hostname');

		m = new form.Map('packet_capture', _('Packet Capture - Tcpdump'), _('Capture packets with tcpdump.'));
		s = m.section(form.TypedSection, 'tcpdump');
		s.anonymous = 1;

		o = s.option(widgets.DeviceSelect, 'interface', _('Interface'), _(''));
		o.noaliases = true;
		o.modalonly = true;
		o.rmempty = false;
		o.filter = function(section_id, value) {
			return true;
		}

		o = s.option(form.Value, 'filter', _('Filter'), _('Tcpdump filter like protocol, port etc.'));
		o.modalonly = false;
		o.datatype = 'and(minlength(1),maxlength(1024))';

		o = s.option(form.Value, 'duration', _('Duration'), _('Duration of packet capturing in seconds.'));
		o.modalonly = false;
		o.datatype = 'range(1,4294967296)';

		o = s.option(form.Value, 'packets', _('Packets'), _('Number of packets to be captured.'));
		o.modalonly = false;
		o.datatype = 'range(1,4294967296)';

		o = s.option(form.Flag, 'domains', _('Resolve domains'), _("Convert host addresses to names."));

		o = s.option(form.Flag, 'verbose', _('Verbose output'), _("Print the link-level header on each dump line."));

		o = s.option(form.Flag, 'file', _('Save to file'), _("Save capture to pcap file."));

		o = s.option(form.Button, 'start_tcpdump', _('Start tcpdump'), _(''));
		o.inputstyle = 'apply';
		o.onclick = ui.createHandlerFn(this, function(section_id, ev) {
			var downloadBtn = findButton("Download");
			if(!downloadBtn) {
				return;
			}
			fs.remove("/tmp/capture.pcap").then(function(replay) {
				downloadBtn.disabled = true;;
			}.bind(this)).catch(function(error) {
				console.log(error);
			});

			var iface = document.querySelectorAll('[id$="interface"]')[1].value,
			    filter = document.querySelectorAll('[id$="filter"]')[2].value,
				packets = document.querySelectorAll('[id$="packets"]')[2].value,
				duration = document.querySelectorAll('[id$="duration"]')[2].value,
				verbose = document.querySelectorAll('[id$="verbose"]')[0].checked,
				domains = document.querySelectorAll('[id$="domains"]')[0].checked,
				file = document.querySelectorAll('[id$="file"]')[0].checked;

			var args = {
				"interface": iface,
				"filter": filter,
				"packets": packets,
				"duration": duration,
				"verbose": verbose,
				"domains": domains,
				"file": file
			}
		
			return fs.exec_direct('/usr/sbin/packet_capture_start', [JSON.stringify(args)]).then(function(replay) {
				rpc.list.apply(rpc).then(function(res) {
					for (var k in res) {
						if(res[k] == "tcpdump" ){
							subscribeTcpdump()
						}
					}
				}.bind(this));
			}.bind(this)).catch(function(error) {
				console.log(error);
			});
		});

		o = s.option(form.Button, 'stop_tcpdump', _('Stop tcpdump'), _(''));
		o.inputstyle = 'apply';
		o.onclick =  ui.createHandlerFn(this, function(section_id, ev) {
			if(!eventSource) {
				return;
			};
			return fs.exec("/usr/sbin/packet_capture_stop").then(function(replay) {
				eventSource.close();
			}.bind(this)).catch(function(error) {
				console.log(error);
			});
		});

		o = s.option(form.Button, 'download_file', _('Download capture file'));
		o.inputstyle = 'action important';
		o.inputtitle = _('Download');
		o.onclick = this.handleDownload;

		L.Poll.add(L.bind(updateButtons, m),1);
		captureFilePoll = L.bind(updatePollCheckCaptureFileExists, m);
		L.Poll.add(captureFilePoll,1);

		return m.render();
	},
});
