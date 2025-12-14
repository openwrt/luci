'use strict';
'require rpc';

const callLogRead = rpc.declare({
	object: 'log',
	method: 'read',
	params: ['lines', 'stream', 'oneshot'],
	expect: {}
});

function Logview(logtag, name) {
	return L.view.extend({
		load: () => Promise.resolve(),

		render: () => {
			L.Poll.add(() => {
				return callLogRead(1000, false, true).then(res => {
					const logEl = document.getElementById('logfile');
					if (!logEl) return;

					const filtered = (res?.log ?? [])
					.filter(entry => !logtag || entry.msg.includes(logtag))
					.map(entry => {
						const d = new Date(entry.time);
						const date = d.toLocaleDateString([], {
							year: 'numeric',
							month: '2-digit',
							day: '2-digit'
						});
						const time = d.toLocaleTimeString([], {
							hour: '2-digit',
							minute: '2-digit',
							second: '2-digit',
							hour12: false
						});
						return `[${date}-${time}] ${entry.msg}`;
					});
					if (filtered.length > 0) {
						logEl.value = filtered.join('\n');
					} else {
						logEl.value = _('No %s related logs yet!').format(name);
					}
					logEl.scrollTop = logEl.scrollHeight;
				});
			});

			return E('div', { class: 'cbi-map' }, [
				E('div', { class: 'cbi-section' }, [
					E('div', { class: 'cbi-section-descr' },
						_('The syslog output, pre-filtered for messages related to: %s').format(name)),
					E('textarea', {
						id: 'logfile',
						style: 'min-height: 500px; max-height: 90vh; width: 100%; padding: 5px; font-family: monospace; resize: vertical;',
						readonly: 'readonly',
						wrap: 'off'
					})
				])
			]);
		},

		handleSaveApply: null,
		handleSave: null,
		handleReset: null
	});
}

return L.Class.extend({ Logview });
