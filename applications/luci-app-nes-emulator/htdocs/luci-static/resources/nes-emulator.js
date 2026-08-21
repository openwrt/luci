'use strict';
'require baseclass';
'require rpc';

const LONG_RUNNING_RPC_TIMEOUT = 120;
const LONG_RUNNING_ACTION_GRACE = 5;

function getRpcTimeout() {
	return Math.max(
		Number(L.env.rpctimeout) || 20,
		LONG_RUNNING_RPC_TIMEOUT
	);
}

function getActionTimeout() {
	return (getRpcTimeout() + LONG_RUNNING_ACTION_GRACE) * 1000;
}

function declareLongRunningRpc(specification) {
	const call = rpc.declare(Object.assign({}, specification, {
		nobatch: true
	}));

	return (...args) => {
		const savedTimeout = L.env.rpctimeout;
		L.env.rpctimeout = getRpcTimeout();
		try {
			return call(...args);
		}
		finally {
			L.env.rpctimeout = savedTimeout;
		}
	};
}

return baseclass.extend({
	getActionTimeout,
	declareLongRunningRpc
});
