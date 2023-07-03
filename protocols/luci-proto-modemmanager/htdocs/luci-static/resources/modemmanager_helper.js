'use strict';
'require baseclass';
'require fs';

return baseclass.extend({

	_mmcliBin: '/usr/bin/mmcli',

	_emptyStringValue: '--',

	_parseIndex: function (dbusPath) {
		var index = dbusPath.split('/').slice(-1);
		return parseInt(index);
	},

	_parseOutput: function (output) {
		try {
			return this._removeEmptyStrings(JSON.parse(output));
		} catch (err) {
			return null;
		}
	},

	_removeEmptyStrings: function (obj) {
		if (obj == null) {
			return obj;
		}

		if (typeof obj == 'string') {
			if (obj == this._emptyStringValue) {
				obj = null;
			}
		} else if (Array.isArray()) {
			obj = obj.map(L.bind(function (it) {
				return this._removeEmptyStrings(it);
			}, this));
		} else {
			var keys = Object.keys(obj);
			keys.forEach(L.bind(function (key) {
				obj[key] = this._removeEmptyStrings(obj[key]);
			}, this));
		}

		return obj;
	},

	getModems: function () {
		return fs.exec_direct(this._mmcliBin, [ '-L', '-J' ]).then(L.bind(function (res) {
			var json = this._parseOutput(res);
			if (json == null) {
				return [];
			}
			var modems = json['modem-list'];
			var tasks = [];

			modems.forEach(L.bind(function (modem) {
				var index = this._parseIndex(modem);
				if (!isNaN(index)) {
					tasks.push(this.getModem(index));
				}
			}, this));
			return Promise.all(tasks);
		}, this));
	},

	getModem: function (index) {
		return fs.exec_direct(this._mmcliBin, [ '-m', index, '-J' ]).then(L.bind(function (modem) {
			return this._parseOutput(modem);
		}, this));
	},

	getModemSims: function (modem) {
		var tasks = [];
		var simSlots = modem.generic['sim-slots'];
		var sim = modem.generic.sim;
		if (sim != null && !simSlots.includes(sim)) {
			simSlots.push(sim);
		}

		simSlots.forEach(L.bind(function (modem) {
			var index = this._parseIndex(modem);
			if (!isNaN(index)) {
				tasks.push(this.getSim(index));
			}
		}, this));
		return Promise.all(tasks);
	},

	getSim: function (index) {
		return fs.exec_direct(this._mmcliBin, [ '-i', index, '-J' ]).then(L.bind(function (sim) {
			return this._parseOutput(sim);
		}, this));
	},

	getModemLocation: function (modem) {
		var index = this._parseIndex(modem['dbus-path']);
		return fs.exec_direct(this._mmcliBin, [ '-m', index, '--location-get', '-J' ]).then(L.bind(function (location) {
			return this._parseOutput(location);
		}, this));
	}
});
