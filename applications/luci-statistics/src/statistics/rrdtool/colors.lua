module("ffluci.statistics.rrdtool.colors", package.seeall)

require("ffluci.util")
require("ffluci.bits")


Instance = ffluci.util.class()

function Instance.from_string( self, s )
	return {
		ffluci.bits.Hex2Dec(s:sub(1,2)),
		ffluci.bits.Hex2Dec(s:sub(3,4)),
		ffluci.bits.Hex2Dec(s:sub(5,6))
	}
end

function Instance.to_string( self, c )
	return string.format(
		"%02x%02x%02x",
		math.floor(c[1]),
		math.floor(c[2]),
		math.floor(c[3])
	)
end

function Instance.random( self )
	local r   = math.random(256)
	local g   = math.random(256)
	local min = 1
	local max = 256

	if ( r + g ) < 256 then
		min = 256 - r - g
	else
		max = 512 - r - g
	end

	local b = min + math.floor( math.random() * ( max - min ) )

	return { r, g, b }
end

function Instance.faded( self, fg, opts )
	opts = opts or {}
	opts.background = opts.background or { 255, 255, 255 }
	opts.alpha      = opts.alpha      or 0.25

	if type(opts.background) == "string" then
		opts.background = _string_to_color(opts.background)
	end

	local bg = opts.background

	return {
		( opts.alpha * fg[1] ) + ( ( 1.0 - opts.alpha ) * bg[1] ),
		( opts.alpha * fg[2] ) + ( ( 1.0 - opts.alpha ) * bg[2] ),
		( opts.alpha * fg[3] ) + ( ( 1.0 - opts.alpha ) * bg[3] )
	}
end
