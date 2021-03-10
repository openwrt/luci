// Thsis file wouldn't have been possible without help from [@vsviridov](https://github.com/vsviridov)

'require ui';
'require rpc';
'require form';

var pkg = {
	get Name() { return 'vpnbypass'; }
};

var _getInitList = rpc.declare({
	object: 'luci.' + pkg.Name,
	method: 'getInitList',
	params: ['name']
});

var _setInitAction = rpc.declare({
	object: 'luci.' + pkg.Name,
	method: 'setInitAction',
	params: ['name', 'action'],
	expect: { result: false }
});

var _getInitStatus = rpc.declare({
	object: 'luci.' + pkg.Name,
	method: 'getInitStatus',
	params: ['name']
});

var RPC = {
	listeners: [],
	on: function on(event, callback) {
		var pair = { event: event, callback: callback }
		this.listeners.push(pair);
		return function unsubscribe() {
			this.listeners = this.listeners.filter(function (listener) {
				return listener !== pair;
			});
		}.bind(this);
	},
	emit: function emit(event, data) {
		this.listeners.forEach(function (listener) {
			if (listener.event === event) {
				listener.callback(data);
			}
		});
	},
	getInitList: function getInitList(name) {
		_getInitList(name).then(function (result) {
			this.emit('getInitList', result);
		}.bind(this));

	},
	getInitStatus: function getInitStatus(name) {
		_getInitStatus(name).then(function (result) {
			this.emit('getInitStatus', result);
		}.bind(this));
	},
	setInitAction: function setInitAction(name, action) {
		_setInitAction(name, action).then(function (result) {
			this.emit('setInitAction', result);
		}.bind(this));
	}
}

var statusCBI = form.DummyValue.extend({
	renderWidget: function (section) {
		var status = E('span', {}, _("Quering") + "...");
		RPC.on('getInitStatus', function (reply) {
			if (reply[pkg.Name].version) {
				if (reply[pkg.Name].running) {
					status.innerText = _("Running (version: %s)").format(reply[pkg.Name].version);
				}
				else {
					if (reply[pkg.Name].enabled) {
						status.innerText = _("Stopped (version: %s)").format(reply[pkg.Name].version);
					}
					else {
						status.innerText = _("Stopped (Disabled)");
					}
				}
			}
			else {
				status.innerText = _("Not installed or not found")
			}
		});
		return E('div', {}, [status]);
	}
});

var buttonsCBI = form.DummyValue.extend({
	renderWidget: function (section) {

		var btn_gap = E('span', {}, '&nbsp;&nbsp;');
		var btn_gap_long = E('span', {}, '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');

		var btn_start = E('button', {
			'class': 'btn cbi-button cbi-button-apply',
			disabled: true,
			click: function (ev) {
				ui.showModal(null, [
					E('p', { 'class': 'spinning' }, _('Starting %s service').format(pkg.Name))
				]);
				return RPC.setInitAction(pkg.Name, 'start');
			}
		}, _('Start'));

		var btn_action = E('button', {
			'class': 'btn cbi-button cbi-button-apply',
			disabled: true,
			click: function (ev) {
				ui.showModal(null, [
					E('p', { 'class': 'spinning' }, _('Restarting %s service').format(pkg.Name))
				]);
				return RPC.setInitAction(pkg.Name, 'restart');
			}
		}, _('Restart'));

		var btn_stop = E('button', {
			'class': 'btn cbi-button cbi-button-reset',
			disabled: true,
			click: function (ev) {
				ui.showModal(null, [
					E('p', { 'class': 'spinning' }, _('Stopping %s service').format(pkg.Name))
				]);
				return RPC.setInitAction(pkg.Name, 'stop');
			}
		}, _('Stop'));

		var btn_enable = E('button', {
			'class': 'btn cbi-button cbi-button-apply',
			disabled: true,
			click: function (ev) {
				ui.showModal(null, [
					E('p', { 'class': 'spinning' }, _('Enabling %s service').format(pkg.Name))
				]);
				return RPC.setInitAction(pkg.Name, 'enable');
			}
		}, _('Enable'));

		var btn_disable = E('button', {
			'class': 'btn cbi-button cbi-button-reset',
			disabled: true,
			click: function (ev) {
				ui.showModal(null, [
					E('p', { 'class': 'spinning' }, _('Disabling %s service').format(pkg.Name))
				]);
				return RPC.setInitAction(pkg.Name, 'disable');
			}
		}, _('Disable'));

		RPC.on('getInitStatus', function (reply) {
			if (reply[pkg.Name].version) {
				if (reply[pkg.Name].enabled) {
					btn_enable.disabled = true;
					btn_disable.disabled = false;
					if (reply[pkg.Name].running) {
						btn_start.disabled = true;
						btn_action.disabled = false;
						btn_stop.disabled = false;
					}
					else {
						btn_start.disabled = false;
						btn_action.disabled = true;
						btn_stop.disabled = true;
					}
				}
				else {
					btn_start.disabled = true;
					btn_action.disabled = true;
					btn_stop.disabled = true;
					btn_enable.disabled = false;
					btn_disable.disabled = true;
				}
			}
		});

		RPC.getInitStatus(pkg.Name);
		
		return E('div', {}, [btn_start, btn_gap, btn_action, btn_gap, btn_stop, btn_gap_long, btn_enable, btn_gap, btn_disable]);
	}
});

RPC.on('setInitAction', function (reply) {
	ui.hideModal();
	RPC.getInitStatus(pkg.Name);
});

return L.Class.extend({
	Status: statusCBI,
	Buttons: buttonsCBI
});
