// SPDX-License-Identifier: Apache-2.0

export let STATUS_OK = 0;
export let STATUS_NOT_FOUND = 4;
export let STATUS_TIMEOUT = 7;
export let STATUS_NOT_SUPPORTED = 8;

export function connect() {
	return {
		defer: function(object, method, request, callback) {
			global.TEST_LAST_CALL = { object, method, request };

			if (global.TEST_DEFER_THROW)
				die('defer failed');

			if (global.TEST_DEFER_NULL)
				return null;

			let status = global.TEST_EXEC_STATUS;

			if (type(status) != 'int')
				status = STATUS_OK;

			callback(status, global.TEST_EXEC_REPLY);

			return {};
		}
	};
};
