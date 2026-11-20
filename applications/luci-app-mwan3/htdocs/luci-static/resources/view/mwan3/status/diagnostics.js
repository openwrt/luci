'use strict';
'require fs';
'require uci';
'require dom';
'require ui';
'require view';

return view.extend({
	handleCommand: function(exec, args) {
		var buttons = document.querySelectorAll('.cbi-button');

		for (var i = 0; i < buttons.length; i++)
			buttons[i].setAttribute('disabled', 'true');

		return fs.exec(exec, args).then(function(res) {
			var out = document.querySelector('.command-output');
			out.style.display = '';

			dom.content(out, [ res.stdout || '', res.stderr || '' ]);
		}).catch(function(err) {
			ui.addNotification(null, E('p', [ err ]))
		}).finally(function() {
			for (var i = 0; i < buttons.length; i++)
				buttons[i].removeAttribute('disabled');
		});
	},

	handleAction: function(ev) {
		var iface = document.getElementById('iface');
		var task = document.getElementById('task');

		switch (task.value) {
			case 'gateway':
				return this.handleCommand('/usr/libexec/luci-mwan3',
					[ 'diag', 'gateway', iface.value ]);
			case 'tracking':
				return this.handleCommand('/usr/libexec/luci-mwan3',
					[ 'diag', 'tracking', iface.value ]);
			case 'rules':
				return this.handleCommand('/usr/libexec/luci-mwan3',
					[ 'diag', 'rules', iface.value ]);
			case 'routes':
				return this.handleCommand('/usr/libexec/luci-mwan3',
					[ 'diag', 'routes', iface.value ]);
			case 'ifup':
				return this.handleCommand('/usr/sbin/mwan3',
					[ 'ifup', iface.value]);
			case 'ifdown':
				return this.handleCommand('/usr/sbin/mwan3',
					[ 'ifdown', iface.value]);
		}
	},

	load: function() {
		return Promise.all([
			uci.load('mwan3')
		]);
	},

	render: function () {

		var taskSel = [
			E('option', { 'value': 'gateway' }, [ _('Ping default gateway') ]),
			E('option', { 'value': 'tracking' }, [ _('Ping tracking IP') ]),
			E('option', { 'value': 'rules' }, [ _('Check IP rules') ]),
			E('option', { 'value': 'routes' }, [ _('Check routing table') ]),
			E('option', { 'value': 'ifup' }, [ _('Hotplug ifup') ]),
			E('option', { 'value': 'ifdown' }, [ _('Hotplug ifdown') ])
		];

		var ifaceSel = [E('option', { value: '' }, [_('-- Interface Selection --')])];

		var options = uci.sections('mwan3', 'interface')
		for (var i = 0; i < options.length; i++) {
			ifaceSel.push(E('option', { 'value': options[i]['.name'] }, options[i]['.name']));
		}

		return E('div', { 'class': 'cbi-map', 'id': 'map' }, [
				E('h2', {}, [ _('MultiWAN Manager - Diagnostics') ]),
				E('div', { 'class': 'cbi-section' }, [
					E('div', { 'class': 'cbi-section-node' }, [
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title' }, [ _('Interface') ]),
							E('div', { 'class': 'cbi-value-field' }, [
								E('select', {'class': 'cbi-input-select', 'id': 'iface'},
									ifaceSel
								)
							])
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title' }, [ _('Task') ]),
							E('div', { 'class': 'cbi-value-field' }, [
								E('select', { 'class': 'cbi-input-select', 'id': 'task' },
									taskSel
								)
							])
						])
					])
				]),
				'\xa0',
				E('pre', { 'class': 'command-output', 'style': 'display:none' }),
				'\xa0',
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'cbi-button cbi-button-apply',
						'id': 'execute',
						'click': ui.createHandlerFn(this, 'handleAction')
					}, [ _('Execute') ]),
				]),
			]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
})
