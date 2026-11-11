'use strict';
'require view';
'require fs';
'require ui';

function parseCommits(logText) {
	return (logText || '').split(/\n/).filter(Boolean).map(function(line) {
		const parts = line.split('\t');

		if (parts.length < 3)
			return null;

		return {
			sha: parts[0],
			date: parts[1],
			msg: parts.slice(2).join('\t')
		};
	}).filter(Boolean);
}

function renderOutput(title, res, reloadAfterClose) {
	const output = [res.stdout, res.stderr].filter(Boolean).join('\n').trim() || _('No output.');
	const success = (res.code === 0);

	ui.showModal(title, [
		E('p', { 'class': success ? 'spinning' : null }, [
			success ? _('Command completed successfully.') : _('Command failed with exit code %d.').format(res.code)
		]),
		E('pre', { 'style': 'white-space: pre-wrap' }, [ output ]),
		E('div', { 'class': 'right' }, [
			E('button', {
				'class': 'btn',
				'click': function() {
					ui.hideModal();

					if (reloadAfterClose)
						window.location.reload();
				}
			}, [ _('Dismiss') ])
		])
	]);
}

return view.extend({
	handleRestoreConfirm: function(sha) {
		ui.showModal(_('Restoring backup...'), [
			E('p', { 'class': 'spinning' }, [ _('The selected commit is being restored now.') ])
		]);

		return fs.exec('/usr/bin/uci-git-restore', [ sha ]).then(function(res) {
			renderOutput(_('Restore Output'), res, res.code === 0);
		});
	},

	handleRestore: function(sha) {
		ui.showModal(_('Restore this backup?'), [
			E('p', [ _('This will copy the selected backup into <code>/etc/config/</code> and trigger a configuration reload.') ]),
			E('p', [ _('Selected commit: %s').format(sha) ]),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('Cancel') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button-action important',
					'click': ui.createHandlerFn(this, 'handleRestoreConfirm', sha)
				}, [ _('Restore') ])
			])
		]);
	},

	load: function() {
		return L.resolveDefault(fs.exec('/usr/bin/uci-git-list', []), { code: 1, stdout: '', stderr: '' });
	},

	render: function(res) {
		const commits = (res.code === 0) ? parseCommits(res.stdout) : [];
		let body;

		if (res.code !== 0) {
			body = E('div', { 'class': 'alert-message warning' }, [
				E('p', [ _('Unable to read backup history.') ]),
				E('pre', { 'style': 'white-space: pre-wrap' }, [ (res.stderr || res.stdout || _('No error output.')).trim() ])
			]);
		}
		else if (!commits.length) {
			body = E('p', { 'class': 'cbi-section-descr' }, [ _('No backup commits found yet.') ]);
		}
		else {
			const rows = commits.map(L.bind(function(commit) {
				return E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td' }, [ commit.date ]),
					E('td', { 'class': 'td' }, [ commit.msg ]),
					E('td', { 'class': 'td' }, [ E('code', [ commit.sha.substring(0, 8) ]) ]),
					E('td', { 'class': 'td right' }, [
						E('button', {
							'class': 'btn cbi-button-action',
							'click': ui.createHandlerFn(this, 'handleRestore', commit.sha)
						}, [ _('Restore') ])
					])
				]);
			}, this));

			body = E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, [ _('Date') ]),
					E('th', { 'class': 'th' }, [ _('Commit') ]),
					E('th', { 'class': 'th' }, [ _('SHA') ]),
					E('th', { 'class': 'th right' }, [ _('Action') ])
				])
			].concat(rows));
		}

		return E([], [
			E('h2', [ _('Restore UCI Backup') ]),
			E('div', { 'class': 'cbi-map-descr' }, [
				_('Select one of the last 30 backup commits and restore it. A new commit recording the restore will be created afterwards.')
			]),
			body
		]);
	}
});
