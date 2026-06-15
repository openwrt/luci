let mocklib = global.mocklib; // ucode-lsp disable

return {
	readfile: function(path, limit) {
		/* Check captured content first (from mock writefile) */
		if (mocklib.has_captured(path)) {
			mocklib.trace_call("fs", "readfile", { path, limit, source: "captured" });
			let data = mocklib.read_captured(path);
			return limit ? substr(data, 0, limit) : data;
		}

		let file = sprintf("fs/open~%s.txt", replace(path, /[^A-Za-z0-9_-]+/g, '_')),
		    mock = mocklib.read_data_file(file);

		if (mock == null) {
			/* Silently return null for missing fixtures */
			return null;
		}

		mocklib.trace_call("fs", "readfile", { path, limit });

		return limit ? substr(mock, 0, limit) : mock;
	},

	writefile: function(path, data) {
		mocklib.capture(path, data);
		mocklib.trace_call("fs", "writefile", { path, length: length(data) });

		return length(data);
	},

	popen: (cmdline, mode) => {
		let read = (!mode || index(mode, "r") != -1),
		    path = sprintf("fs/popen~%s.txt", replace(cmdline, /[^A-Za-z0-9_-]+/g, '_')),
		    mock = mocklib.read_data_file(path);

		if (read && mock == null) {
			/* Silently return empty-read handle for missing fixtures */
			return {
				read: function(amount) { return ''; },
				write: function() {},
				close: function() {},
				error: function() { return null; }
			};
		}

		mocklib.trace_call("fs", "popen", { cmdline, mode });

		return {
			read: function(amount) {
				let rv;

				switch (amount) {
				case "all":
					rv = mock;
					mock = "";
					break;

				case "line":
					let i = index(mock, "\n");
					i = (i > -1) ? i + 1 : length(mock);
					rv = substr(mock, 0, i);
					mock = substr(mock, i);
					break;

				default:
					let n = +amount;
					n = (n > 0) ? n : 0;
					rv = substr(mock, 0, n);
					mock = substr(mock, n);
					break;
				}

				return rv;
			},

			write: function() {},
			close: function() {},

			error: function() {
				return null;
			}
		};
	},

	stat: function(path) {
		/* Check captured content first */
		if (mocklib.has_captured(path)) {
			mocklib.trace_call("fs", "stat", { path, source: "captured" });
			return { type: "file" };
		}

		let file = sprintf("fs/stat~%s.json", replace(path, /[^A-Za-z0-9_-]+/g, '_')),
		    mock = mocklib.read_json_file(file);

		if (!mock || mock != mock) {
			/* No fixture: fall back to reasonable defaults */
			if (match(path, /\/$/))
				mock = { type: "directory" };
			else
				mock = { type: "file" };
		}

		mocklib.trace_call("fs", "stat", { path });

		return mock;
	},

	glob: function(pattern) {
		mocklib.trace_call("fs", "glob", { pattern });

		/* Return empty array — tests use devices.json fixture directly */
		return [];
	},

	unlink: function(path) {
		mocklib.delete_captured(path);
		mocklib.trace_call("fs", "unlink", { path });

		return true;
	},

	error: () => "Unspecified error"
};
