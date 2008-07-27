module("luci.lpk.util", package.seeall)

function getopt( arg, options )
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
				end
			else
				tab[ jopt ] = true
			end
			y = y + 1
		end
    else 
    	table.insert(args, v)
    end
  end
  return tab, args
end