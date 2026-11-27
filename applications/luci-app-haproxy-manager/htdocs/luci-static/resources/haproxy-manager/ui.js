'use strict';
'require baseclass';
'require fs';
'require rpc';
'require ui';

var callUciCommit = rpc.declare({
	object: 'uci',
	method: 'commit',
	params: [ 'config' ],
	reject: true
});
var APPLY_LOCK_BUSY = 75;

function recoveryId(output) {
	var path = String(output || '').trim();
	var id = path.split('/').pop();

	if (!/^\d{8}-\d{6}$/.test(id))
		throw new Error(_('Unable to create a recovery point.'));

	return id;
}

return baseclass.extend({
	ensureStyles: function() {
		if (document.querySelector('link[data-haproxy-manager-style]'))
			return;

		document.head.appendChild(E('link', {
			'rel': 'stylesheet',
			'href': L.resource('haproxy-manager/style.css'),
			'data-haproxy-manager-style': '1'
		}));
	},

	notify: function(message, level) {
		ui.addNotification(null, E('pre', { 'class': 'hm-notification' }, String(message || '').trim()), level || 'info');
	},

	notifyError: function(error) {
		this.notify(error && error.message ? error.message : String(error), 'danger');
	},

	exec: function(path, args) {
		return fs.exec(path, args || []).then(function(result) {
			if (!result.code)
				return result;

			var message = String(result.stderr || result.stdout ||
				_('Command failed with code %d.').format(result.code)).trim();
			var error = new Error(message);
			error.code = result.code;
			error.stdout = result.stdout;
			error.stderr = result.stderr;
			throw error;
		});
	},

	commitAndApply: function() {
		var backupId;
		var committed = false;

		return this.exec('/usr/libexec/haproxy-manager/backup', []).then(function(result) {
			backupId = recoveryId(result.stdout);
			return callUciCommit('haproxy_manager');
		}).then(function() {
			committed = true;
			return this.exec('/usr/libexec/haproxy-manager/apply', [ '--backup', backupId ]);
		}.bind(this)).catch(function(error) {
			if (!committed || !backupId || error.code !== APPLY_LOCK_BUSY)
				throw error;

			return this.exec('/usr/libexec/haproxy-manager/rollback', [ backupId ]).catch(function() {
				return null;
			}).then(function() {
				throw error;
			});
		}.bind(this));
	},

	saveAndApply: function(map) {
		return map.save(null, true).then(function() {
			return this.commitAndApply();
		}.bind(this));
	},

	notifyApplied: function() {
		this.notify(_('Changes saved and applied.'), 'info');
	},

	reloadAfterApply: function(delay) {
		window.setTimeout(function() {
			window.location.reload();
		}, delay || 2500);
	}
});
