'use strict';
'require view';
'require dom';
'require fs';
'require ui';
'require uci';
'require network';


return view.extend({
	handleCommand: function(exec, args) {
		let buttons = document.querySelectorAll('.diag-action > .cbi-button');

		for (let i = 0; i < buttons.length; i++)
			buttons[i].setAttribute('disabled', 'true');

		return fs.exec(exec, args).then(function(res) {
			let out = document.querySelector('textarea');

			dom.content(out, [ res.stdout || '', res.stderr || '' ]);
		}).catch(function(err) {
			ui.addNotification(null, E('p', [ err ]))
		}).finally(function() {
			for (let i = 0; i < buttons.length; i++)
				buttons[i].removeAttribute('disabled');
		});
	},

	handleEnroll: function() {
		return this.handleCommand('at_enroll.sh', "");
	},

	load: function() {
		return uci.load('sshnpd').then(function() {
			let atsign = uci.get_first('sshnpd','','atsign'),
				keyfile = '/root/.atsign/keys/'+atsign+'_key.atKeys';
				return L.resolveDefault(fs.stat(keyfile), {});
		});
	},

	render: function(res) {

		const has_atkey = res.path;
		const atsign = uci.get_first('sshnpd','','atsign');
		const device = uci.get_first('sshnpd','','device');
		const otp = uci.get_first('sshnpd','','otp');
		const enrollready = atsign && device && otp && !has_atkey;

		const instructions = E('div', { 'class': 'cbi-map-descr'}, _('Press the Enroll button then run this command on a system where '+atsign+' is activated:'));

		const enrollcmd = E('code','at_activate approve -a '+atsign+' --arx noports --drx '+device);

		let table = E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left' }, [
						E('span', { 'class': 'diag-action' }, [
							E('button', {
								'class': 'cbi-button cbi-button-action',
								'click': ui.createHandlerFn(this, 'handleEnroll')
							}, [ _('Enroll') ])
						])
					]),
				])
			]);

		const cmdwindow = E('div', {'class': 'cbi-section'}, [
			E('div', { 'id' : 'command-output'},
				E('textarea', {
					'id': 'widget.command-output',
					'style': 'width: 100%; font-family:monospace; white-space:pre',
					'readonly': true,
					'wrap': 'on',
					'rows': '20'
				})
			)
			]);

		let view = E('div', { 'class': 'cbi-map'}, [
			E('h2', {}, [ _('NoPorts atSign Enrollment') ]),
			atsign ? E([]) : E('div', { 'class': 'cbi-map-descr'}, _('atSign must be configured')),
			device ? E([]) : E('div', { 'class': 'cbi-map-descr'}, _('Device must be configured')),
			otp ? E([]) : E('div', { 'class': 'cbi-map-descr'}, _('OTP must be configured. An OTP can be generated using:')),
			otp ? E([]) : E('code','at_activate otp -a '+atsign),
			has_atkey ? E('div', { 'class': 'cbi-map-descr'}, _('Existing key found at: '+has_atkey)) : E([]),
			enrollready ? instructions : E([]),
			enrollready ? enrollcmd  : E([]),
			enrollready ? table : E([]),
			enrollready ? cmdwindow : E([]),
		]);

		return view;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
