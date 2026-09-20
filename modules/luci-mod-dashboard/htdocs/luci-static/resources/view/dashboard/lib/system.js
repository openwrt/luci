'use strict';
'require baseclass';
'require rpc';

const callSystemBoard = rpc.declare({
	object: 'system',
	method: 'board'
});

const callSystemInfo = rpc.declare({
	object: 'system',
	method: 'info'
});

return baseclass.extend({
	info() {
		const now = performance.now();

		if (this.pending == null || now - this.asked > 1000) {
			this.asked = now;
			this.pending = L.resolveDefault(callSystemInfo(), {});
		}

		return this.pending;
	},

	// The board does not change while the page is open.
	board() {
		if (this.boardinfo == null)
			this.boardinfo = callSystemBoard().catch(() => {
				this.boardinfo = null;

				return {};
			});

		return this.boardinfo;
	}
});
