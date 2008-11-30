function initialize()
	local lucittpd = require "luci.ttpd.server"
	server = lucittpd.Server(lucittpd.VHost())
end

function register()
	local filehnd = require "luci.ttpd.handler.file"
	local filehandler = filehnd.Simple(os.getenv("LUCI_SYSROOT") .. "/www")
	server:get_default_vhost():set_default_handler(filehandler)
end

function accept()
	server:process({
		_read = function(...)
			local chunk, err = webuci_read(...)
			return chunk or (err and error(err, 0))
		end,

		_write = function(...)
			local chunk, err = webuci_write(...)
			return chunk or (err and error(err, 0))
		end,

		_close = function(...)
			local chunk, err = webuci_close(...)
			return chunk or (err and error(err, 0))
		end,

		_sendfile = function(...)
			local chunk, err = webuci_sendfile(...)
			return chunk or (err and error(err, 0))
		end
	})
end