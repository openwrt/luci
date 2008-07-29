module("luci.lpk.util", package.seeall)

function getopt( arg, options )
	options = options or ""
	local tab = {}
	local args = {}
	for k, v in ipairs(arg) do
		if v:sub(1, 2) == "--" then
			local x = v:find( "=", 1, true )
			if x then
				tab[ v:sub( 3, x-1 ) ] = v:sub( x+1 )
			else 
			    tab[ v:sub( 3 ) ] = true
			end
		elseif v:sub( 1, 1 ) == "-" then
			local y = 2
			local l = #v
			local jopt
			while ( y <= l ) do
				jopt = v:sub( y, y )
				if options:find( jopt, 1, true ) then
					if y < l then
						tab[ jopt ] = v:sub( y+1 )
						y = l
					else
						tab[ jopt ] = arg[ k + 1 ]
						arg[ k + 1 ] = ""
					end
				else
					tab[ jopt ] = true
				end
				y = y + 1
			end
	    elseif #v > 0 then
	    	table.insert(args, v)
	    end
	end
	return tab, args
end

function splash()
	require("luci.lpk")
	luci.util.perror(string.format("%s v%s\n%s",
	 luci.lpk.__appname__, luci.lpk.__version__, luci.lpk.__cpyrght__))
	luci.util.perror([[
	
Usage:
 lpk [options] <command> [arguments]
 lpk [options] install|remove pkg1 [pkg2] [...] [pkgn]

Commands:
 install	-	Install packages
 remove		-	Remove packages
 purge		-	Remove packages and their configuration files
 
Options:
 --force-depends	-	Ignore unresolvable dependencies
]])
end