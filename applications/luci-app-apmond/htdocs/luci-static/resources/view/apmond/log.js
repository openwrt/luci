'use strict';
'require view';
'require fs';
'require ui';
'require dom';
'require poll';
'require view.apmond.common as common';

/*
 * ApmonD log: the output of "apmond read_log" (<log_mountpoint>/apmond/apmond_log.log).
 * The only command these views run; allowed by name in the ACL. Refresh reads it again, and
 * "Follow" re-reads it every 10 seconds, scrolled to the end, as read_log -f.
 */

var APMOND = '/usr/sbin/apmond';

return view.extend({
	fetchLog: function() {
		return L.resolveDefault(fs.exec_direct(APMOND, [ 'read_log' ]), null);
	},

	logText: function(text) {
		if (text == null) {
			return _('Could not read the ApmonD log. Is apmond installed?');
		}
		if (String(text).trim() === '') {
			return _('The log is empty, or no log file has been written yet.');
		}
		return String(text);
	},

	update: function() {
		var self = this;

		return this.fetchLog().then(function(t) {
			dom.content(self.pre, [ self.logText(t) ]);
			self.pre.scrollTop = self.pre.scrollHeight;
		});
	},

	load: function() {
		return this.fetchLog();
	},

	render: function(text) {
		var self = this;
		var follow = false;
		var pollFn = function() {
			return self.update();
		};
		var followBtn;

		this.pre = E('pre', { 'style': 'white-space:pre-wrap; max-height:40em; overflow-y:auto' }, [ this.logText(text) ]);

		followBtn = E('button', {
			'class': 'btn cbi-button',
			'click': function(ev) {
				follow = !follow;
				if (follow) {
					poll.add(pollFn, 10);
					ev.target.firstChild.data = _('Stop following');
					self.update();
				}
				else {
					poll.remove(pollFn);
					ev.target.firstChild.data = _('Follow');
				}
			}
		}, [ _('Follow') ]);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, [ _('ApmonD Log') ]),
			E('div', { 'class': 'cbi-map-descr' }, [ _('The output of "apmond read_log". What is logged depends on the debug level set in Settings.') ]),
			E('div', { 'class': 'right' }, [
				followBtn,
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-action',
					'click': ui.createHandlerFn(this, function() {
						return self.update();
					})
				}, [ _('Refresh') ])
			]),
			this.pre,
			common.footer()
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
