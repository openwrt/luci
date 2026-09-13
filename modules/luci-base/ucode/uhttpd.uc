{%

import dispatch from 'luci.dispatcher';
import request from 'luci.http';

global.handle_request = function(env) {
	let req = request(env, uhttpd.recv, uhttpd.send);

	dispatch(req);

	req.close();
};
