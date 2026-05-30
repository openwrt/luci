// Copyright 2026
// SPDX-License-Identifier: Apache-2.0

/*
The plugin filename shall be the 32 character uuid in its JS config front-end.
This allows parsing plugins against user-defined configuration. User retains
all control over whether a plugin is active or not.
*/

'use strict';

import { cursor } from 'uci';

/* 
The ucode plugin portion shall return a default action which returns a value
and type of value appropriate for its usage class and type. For http.headers,
it shall return a string array[] with header_name, header_value, without any
\r or \n.
*/

function default_action(...args) {
	const uci = cursor();
	const str = uci.get('luci_plugins', args[0], 'foo') || 'foo';
	const value = sprintf('%s; %s', str, ...args);
	// do stuff
	// should produce: x-example: foo; 263fe72d7e834fa99a82639ed0d9e3bd
	return ['X-Example', value];
};


return default_action;
