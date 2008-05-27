module("luci.statistics.rrdtool", package.seeall)

require("luci.statistics.datatree")
require("luci.statistics.rrdtool.colors")
require("luci.statistics.rrdtool.definitions")
require("luci.util")
require("luci.bits")
require("luci.fs")


Graph = luci.util.class()

function Graph.__init__( self, timespan, opts )

	opts = opts or { }
	opts.width = opts.width or "400"

	self.colors = luci.statistics.rrdtool.colors.Instance()
	self.defs   = luci.statistics.rrdtool.definitions.Instance()
	self.tree   = luci.statistics.datatree.Instance()

	-- rrdtool defalt args
	self.args   = {
		"-a", "PNG",
		"-s", "NOW-" .. ( timespan or 900 ),
		"-w", opts.width
	}
end

function Graph.mktitle( self, host, plugin, plugin_instance, dtype, dtype_instance )
	local t = host .. "/" .. plugin
	if type(plugin_instance) == "string" and plugin_instance:len() > 0 then
		t = t .. "-" .. plugin_instance
	end
	t = t .. "/" .. dtype
	if type(dtype_instance) == "string" and dtype_instance:len() > 0 then
		t = t .. "-" .. dtype_instance
	end
	return t
end

function Graph.mkrrdpath( self, ... )
	return string.format( "/tmp/%s.rrd", self:mktitle( ... ) )
end

function Graph.mkpngpath( self, ... )
	return string.format( "/tmp/rrdimg/%s.png", self:mktitle( ... ) )
end

function Graph._push( self, elem )

	if type(elem) == "string" then
		table.insert( self.args, elem )
	else
		for i, item in ipairs(elem) do
			table.insert( self.args, item )
		end
	end

	return( self.args )
end

function Graph._clearargs( self )
	for i = #self.args, 7, -1 do
		table.remove( self.args, i )
	end
end

function Graph._forcelol( self, list )
	if type(list[1]) ~= "table" then
		return( { list } )
	end
	return( list )
end

function Graph._rrdtool( self, png, rrd )

	-- prepare directory
	local dir = png:gsub("/[^/]+$","")
	luci.fs.mkdir( dir, true )

	-- construct commandline
	local cmdline = "rrdtool graph " .. png

	for i, opt in ipairs(self.args) do

		opt = opt .. ""    -- force string
		
		if rrd then
			opt = opt:gsub( "{file}", rrd )
		end

		if opt:match("[^%w]") then
			cmdline = cmdline .. " '" .. opt .. "'"
		else
			cmdline = cmdline .. " " .. opt
		end
	end

	-- execute rrdtool
	local rrdtool = io.popen( cmdline )
	rrdtool:close()
end

function Graph._generic( self, opts )

	local images     = { }
	local rrasingle  = false	-- XXX: fixme

	-- internal state variables
	local _stack_neg    = { }
	local _stack_pos    = { }
	local _longest_name = 0
	local _has_totals   = false

	-- some convenient aliases
	local _ti	    = table.insert
	local _sf	    = string.format

	-- local helper: create definitions for min, max, avg and create *_nnl (not null) variable from avg
	function __def(source)

		local inst = source.sname
		local rrd  = source.rrd
		local ds   = source.ds

		if not ds or ds:len() == 0 then ds = "value" end

		local rv = { _sf( "DEF:%s_avg=%s:%s:AVERAGE", inst, rrd, ds ) }

		if not rrasingle then
			_ti( rv, _sf( "DEF:%s_min=%s:%s:MIN", inst, rrd, ds ) )
			_ti( rv, _sf( "DEF:%s_max=%s:%s:MAX", inst, rrd, ds ) )
		end

		_ti( rv, _sf( "CDEF:%s_nnl=%s_avg,UN,0,%s_avg,IF", inst, inst, inst ) )

		return rv
	end

	-- local helper: create cdefs depending on source options like flip and overlay
	function __cdef(source)

		local rv = { }
		local prev

		-- find previous source, choose stack depending on flip state
		if source.flip then
			prev = _stack_neg[#_stack_neg]
		else
			prev = _stack_pos[#_stack_pos]
		end

		-- is first source in stack or overlay source: source_stk = source_nnl
		if not prev or source.overlay then
			-- create cdef statement
			_ti( rv, _sf( "CDEF:%s_stk=%s_nnl", source.sname, source.sname ) )

		-- is subsequent source without overlay: source_stk = source_nnl + previous_stk
		else
			-- create cdef statement				
			_ti( rv, _sf(
				"CDEF:%s_stk=%s_nnl,%s_stk,+", source.sname, source.sname, prev
			) )
		end

		-- create multiply by minus one cdef if flip is enabled
		if source.flip then

			-- create cdef statement: source_stk = source_stk * -1
			_ti( rv, _sf( "CDEF:%s_neg=%s_stk,-1,*", source.sname, source.sname ) )

			-- push to negative stack if overlay is disabled
			if not source.overlay then
				_ti( _stack_neg, source.sname )
			end

		-- no flipping, push to positive stack if overlay is disabled
		elseif not source.overlay then

			-- push to positive stack
			_ti( _stack_pos, source.sname )
		end

		-- calculate total amount of data if requested
		if source.total then
			_ti( rv, _sf(
				"CDEF:%s_avg_sample=%s_avg,UN,0,%s_avg,IF,sample_len,*",
				source.sname, source.sname, source.sname
			) )

			_ti( rv, _sf(
				"CDEF:%s_avg_sum=PREV,UN,0,PREV,IF,%s_avg_sample,+",
				source.sname, source.sname, source.sname
			) )
		end


		return rv
	end

	-- local helper: create cdefs required for calculating total values
	function __cdef_totals()
		if _has_totals then
			return {
				_sf( "CDEF:mytime=%s_avg,TIME,TIME,IF", opts.sources[1].sname ),
				"CDEF:sample_len_raw=mytime,PREV(mytime),-",
				"CDEF:sample_len=sample_len_raw,UN,0,sample_len_raw,IF"
			}
		else
			return { }
		end
	end

	-- local helper: create line and area statements
	function __area(source)

		local line_color
		local area_color
		local legend
		local var

		-- find colors: try source, then opts.colors; fall back to random color
		if type(source.color) == "string" then
			line_color = source.color
			area_color = self.colors:from_string( line_color )
		elseif type(opts.colors[source.name:gsub("[^%w]","_")]) == "string" then
			line_color = opts.colors[source.name:gsub("[^%w]","_")]
			area_color = self.colors:from_string( line_color )
		else
			area_color = self.colors:random()
			line_color = self.colors:to_string( area_color )
		end

		-- derive area background color from line color
		area_color = self.colors:to_string( self.colors:faded( area_color ) )

		-- choose source_stk or source_neg variable depending on flip state
		if source.flip then
			var = "neg"
		else
			var = "stk"
		end

		-- create legend
		legend = _sf( "%-" .. _longest_name .. "s", source.name )

		-- create area and line1 statement
		return {
			_sf( "AREA:%s_%s#%s", source.sname, var, area_color ),
			_sf( "LINE1:%s_%s#%s:%s", source.sname, var, line_color, legend )
		}
	end

	-- local helper: create gprint statements
	function __gprint(source)

		local rv     = { }
		local numfmt = opts.number_format or "%6.1lf"
		local totfmt = opts.totals_format or "%5.1lf%s"

		-- don't include MIN if rrasingle is enabled
		if not rrasingle then
			_ti( rv, _sf( "GPRINT:%s_min:MIN:%s Min", source.sname, numfmt ) )
		end

		-- always include AVERAGE
		_ti( rv, _sf( "GPRINT:%s_avg:AVERAGE:%s Avg", source.sname, numfmt ) )

		-- don't include MAX if rrasingle is enabled
		if not rrasingle then
			_ti( rv, _sf( "GPRINT:%s_max:MAX:%s Max", source.sname, numfmt ) )
		end

		-- include total count if requested else include LAST
		if source.total then
			_ti( rv, _sf( "GPRINT:%s_avg_sum:LAST:(ca. %s Total)", source.sname, totfmt ) )
		else
			_ti( rv, _sf( "GPRINT:%s_avg:LAST:%s Last", source.sname, numfmt ) )
		end

		-- end label line
		rv[#rv] = rv[#rv] .. "\\l"


		return rv					
	end


	-- remember images
	_ti( images, opts.image )

	-- insert provided addition rrd options
	self:_push( { "-t", opts.title or "Unknown title" } )
	self:_push( opts.rrd )

	-- store index and safe instance name within each source object,
	-- find longest instance name
	for i, source in ipairs(opts.sources) do

		if source.name:len() > _longest_name then
			_longest_name = source.name:len()
		end

		if source.total then
			_has_totals = true
		end

		source.index = i
		source.sname = i .. source.name:gsub("[^A-Za-z0-9%-_]","_")
	end

	-- create DEF statements for each instance, find longest instance name
	for i, source in ipairs(opts.sources) do
		self:_push( __def( source ) )
	end

	-- create CDEF required for calculating totals
	self:_push( __cdef_totals() )

	-- create CDEF statements for each instance in reversed order
	for i, source in ipairs(opts.sources) do
		self:_push( __cdef( opts.sources[1 + #opts.sources - i] ) )
	end

	-- create LINE1, AREA and GPRINT statements for each instance
	for i, source in ipairs(opts.sources) do
		self:_push( __area( source ) )
		self:_push( __gprint( source ) )
	end

	return images
end

function Graph.render( self, host, plugin, plugin_instance )

	dtype_instances = dtype_instances or { "" }
	local pngs = { }

	-- check for a whole graph handler
	local plugin_def = "luci.statistics.rrdtool.definitions." .. plugin
	local stat, def = pcall( require, plugin_def )

	if stat and def and type(def.rrdargs) == "function" then
		for i, opts in ipairs( self:_forcelol( def.rrdargs( self, host, plugin, plugin_instance, dtype ) ) ) do
			for i, png in ipairs( self:_generic( opts ) ) do
				table.insert( pngs, png )

				-- exec
				self:_rrdtool( png )

				-- clear args
				self:_clearargs()
			end
		end
	else

		-- no graph handler, iterate over data types
		for i, dtype in ipairs( self.tree:data_types( plugin, plugin_instance ) ) do

			-- check for data type handler
			local dtype_def = plugin_def .. "." .. dtype
			local stat, def = pcall( require, dtype_def )

			if stat and def and type(def.rrdargs) == "function" then
				for i, opts in ipairs( self:_forcelol( def.rrdargs( self, host, plugin, plugin_instance, dtype ) ) ) do
					for i, png in ipairs( self:_generic( opts ) ) do
						table.insert( pngs, png )

						-- exec
						self:_rrdtool( png )

						-- clear args
						self:_clearargs()
					end
				end
			else

				-- no data type handler, fall back to builtin definition
				if type(self.defs.definitions[dtype]) == "table" then

					-- iterate over data type instances
					for i, inst in ipairs( self.tree:data_instances( plugin, plugin_instance, dtype ) ) do

						local title = self:mktitle( host, plugin, plugin_instance, dtype, inst )
						local png   = self:mkpngpath( host, plugin, plugin_instance, dtype, inst )
						local rrd   = self:mkrrdpath( host, plugin, plugin_instance, dtype, inst )

						self:_push( { "-t", title } )
						self:_push( self.defs.definitions[dtype] )

						table.insert( pngs, png )

						-- exec
						self:_rrdtool( png, rrd )

						-- clear args
						self:_clearargs()
					end
				end
			end
		end
	end

	return pngs
end

