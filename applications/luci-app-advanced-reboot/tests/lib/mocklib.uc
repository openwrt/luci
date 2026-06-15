/* strict mode compliance: ensure that global variables are defined */
if (!exists(global, 'REQUIRE_SEARCH_PATH'))
	global.REQUIRE_SEARCH_PATH = [];

if (!exists(global, 'MOCK_SEARCH_PATH'))
	global.MOCK_SEARCH_PATH = [];

if (!exists(global, 'TRACE_CALLS'))
	global.TRACE_CALLS = null;

let _fs = require("fs");

/* Force reloading fs module on next require */
delete global.modules.fs;

let _log = (level, fmt, ...args) => {
	let color, prefix;

	switch (level) {
	case 'info':
		color = 34;
		prefix = '!';
		break;

	case 'warn':
		color = 33;
		prefix = 'W';
		break;

	case 'error':
		color = 31;
		prefix = 'E';
		break;

	default:
		color = 0;
		prefix = 'I';
	}

	let f = sprintf("\u001b[%d;1m[%s] %s\u001b[0m", color, prefix, fmt);
	warn(replace(sprintf(f, ...args), "\n", "\n    "), "\n");
};

let read_data_file = (path) => {
	for (let dir in MOCK_SEARCH_PATH) {
		let fd = _fs.open(dir + '/' + path, "r");

		if (fd) {
			let data = fd.read("all");
			fd.close();

			return data;
		}
	}

	return null;
};

let read_json_file = (path) => {
	let data = read_data_file(path);

	if (data != null)  {
		try {
			return json(data);
		}
		catch (e) {
			_log('error', "Unable to parse JSON data in %s: %s", path, e);

			return NaN;
		}
	}

	return null;
};

let format_json = (data) => {
	let rv;

	let format_value = (value) => {
		switch (type(value)) {
		case "object":
			return sprintf("{ /* %d keys */ }", length(value));

		case "array":
			return sprintf("[ /* %d items */ ]", length(value));

		case "string":
			if (length(value) > 64)
				value = substr(value, 0, 64) + "...";

			/* fall through */
			return sprintf("%J", value);

		default:
			return sprintf("%J", value);
		}
	};

	switch (type(data)) {
	case "object":
		rv = "{";

		let k = sort(keys(data));

		for (let i, n in k)
			rv += sprintf("%s %J: %s", i ? "," : "", n, format_value(data[n]));

		rv += " }";
		break;

	case "array":
		rv = "[";

		for (let i, v in data)
			rv += (i ? "," : "") + " " + format_value(v);

		rv += " ]";
		break;

	default:
		rv = format_value(data);
	}

	return rv;
};

let trace_call = (ns, func, args) => {
	let msg = "[call] " +
		(ns ? ns + "." : "") +
		func;

	for (let k, v in args) {
		msg += ' ' + k + ' <';

		switch (type(v)) {
		case "array":
		case "object":
			msg += format_json(v);
			break;

		default:
			msg += v;
		}

		msg += '>';
	}

	switch (TRACE_CALLS) {
	case '1':
	case 'stdout':
		_fs.stdout.write(msg + "\n");
		break;

	case 'stderr':
		_fs.stderr.write(msg + "\n");
		break;
	}
};

/* Captured file contents from mock writefile */
let _captured = {};

/* Prepend mocklib to REQUIRE_SEARCH_PATH */
for (let pattern in REQUIRE_SEARCH_PATH) {
	if (!match(pattern, /\*\.uc$/))
		continue;

	let path = replace(pattern, /\*/, 'mocklib'),
	    stat = _fs.stat(path);

	if (!stat || stat.type != 'file')
		continue;

	if (!length(global.MOCK_SEARCH_PATH))
		global.MOCK_SEARCH_PATH = [ replace(path, /mocklib\.uc$/, '../mocks') ];

	unshift(REQUIRE_SEARCH_PATH, replace(path, /mocklib\.uc$/, 'mocklib/*.uc'));
	break;
}

if (!length(global.MOCK_SEARCH_PATH))
	global.MOCK_SEARCH_PATH = [ './mocks' ];

/* Register global mocklib namespace */
global.mocklib = {
	require: function(module) {
		let path, res, ex;

		if (type(REQUIRE_SEARCH_PATH) == "array" && index(REQUIRE_SEARCH_PATH[0], 'mocklib/*.uc') != -1)
			path = shift(REQUIRE_SEARCH_PATH);

		try {
			res = require(module);
		}
		catch (e) {
			ex = e;
		}

		if (path)
			unshift(REQUIRE_SEARCH_PATH, path);

		if (ex)
			die(ex);

		return res;
	},

	I: (...args) => _log('info', ...args),
	N: (...args) => _log('notice', ...args),
	W: (...args) => _log('warn', ...args),
	E: (...args) => _log('error', ...args),

	format_json,
	read_data_file,
	read_json_file,
	trace_call,

	capture: (path, data) => { _captured[path] = data; },
	read_captured: (path) => _captured[path],
	has_captured: (path) => exists(_captured, path),
	delete_captured: (path) => { delete _captured[path]; },
};

/* Override stdlib functions */
global.system = function(argv, timeout) {
	trace_call(null, "system", { command: argv, timeout });

	return 0;
};

global.time = function() {
	trace_call(null, "time");

	return 1615382640;
};

global.print = ((_orig) => function(...args) {
	if (length(args) == 1 && type(args[0]) in ["array", "object"])
		printf("%s\n", format_json(args[0]));
	else
		_orig(...args);
})(global.print);

global.getenv = function(key) {
	return null;
};

return global.mocklib;
