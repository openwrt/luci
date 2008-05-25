module("ffluci.statistics.rrdtool", package.seeall)

require("ffluci.statistics.datatree")
require("ffluci.statistics.rrdtool.colors")
require("ffluci.statistics.rrdtool.definitions")
require("ffluci.util")
require("ffluci.bits")
require("ffluci.fs")


Graph = ffluci.util.class()

function Graph.__init__( self, timespan, opts )

	opts = opts or { }
	opts.width = opts.width or "400"

	self.colors = ffluci.statistics.rrdtool.colors.Instance()
	self.defs   = ffluci.statistics.rrdtool.definitions.Instance()
	self.tree   = ffluci.statistics.datatree.Instance()

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

function Graph._rrdtool( self, png, rrd )
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

	local rrdtool = io.popen( cmdline )
	rrdtool:read("*a")
	rrdtool:close()
end

function Graph._generic( self, optlist )

	local images = { }

	if type(optlist[1]) ~= "table" then
		optlist = { optlist }
	end

	for i, opts in ipairs(optlist) do
		-- remember images
		table.insert( images, opts.image )

		-- insert provided addition rrd options
		self:_push( { "-t", opts.title or "Unknown title" } )
		self:_push( opts.rrd )

		-- construct an array of safe instance names
		local inst_names = { }
		for i, source in ipairs(opts.sources) do
			inst_names[i] = i .. source.name:gsub("[^A-Za-z0-9%-_]","_")
		end

		-- create DEF statements for each instance, find longest instance name
		local longest_name = 0
		for i, source in ipairs(opts.sources) do
			if source.name:len() > longest_name then
				longest_name = source.name:len()
			end

			self:_push( "DEF:" .. inst_names[i] .. "_min=" ..source.rrd .. ":value:MIN" )
			self:_push( "DEF:" .. inst_names[i] .. "_avg=" ..source.rrd .. ":value:AVERAGE" )
			self:_push( "DEF:" .. inst_names[i] .. "_max=" ..source.rrd .. ":value:MAX" )
			self:_push( "CDEF:" .. inst_names[i] .. "_nnl=" .. inst_names[i] .. "_avg,UN,0," .. inst_names[i] .. "_avg,IF" )
		end

		-- create CDEF statement for last instance name
		self:_push( "CDEF:" .. inst_names[#inst_names] .. "_stk=" .. inst_names[#inst_names] .. "_nnl" )

		-- create CDEF statements for each instance
		for i, source in ipairs(inst_names) do
			if i > 1 then
				self:_push(
					"CDEF:" ..
					inst_names[1 + #inst_names - i] .. "_stk=" ..
					inst_names[1 + #inst_names - i] .. "_nnl," ..
					inst_names[2 + #inst_names - i] .. "_stk,+"
				)
			end
		end

		-- create LINE and GPRINT statements for each instance
		for i, source in ipairs(opts.sources) do

			local legend = string.format(
				"%-" .. longest_name .. "s",
				source.name
			)

			local numfmt = opts.number_format or "%6.1lf"

			local line_color
			local area_color

			if type(opts.colors[source.name]) == "string" then
				line_color = opts.colors[source.name]
				area_color = self.colors:from_string( line_color )
			else
				area_color = self.colors:random()
				line_color = self.colors:to_string( area_color )
			end

			area_color = self.colors:to_string(
				self.colors:faded( area_color )
			)

			self:_push( "AREA:"   .. inst_names[i] .. "_stk#" .. area_color )
			self:_push( "LINE1:"  .. inst_names[i] .. "_stk#" .. line_color .. ":" .. legend )
			self:_push( "GPRINT:" .. inst_names[i] .. "_min:MIN:" .. numfmt .. " Min" )
			self:_push( "GPRINT:" .. inst_names[i] .. "_avg:AVERAGE:" .. numfmt .. " Avg" )
			self:_push( "GPRINT:" .. inst_names[i] .. "_max:MAX:" .. numfmt .. " Max" )
			self:_push( "GPRINT:" .. inst_names[i] .. "_avg:LAST:" .. numfmt .. " Last\\l" )
		end
	end

	return images
end

function Graph.render( self, host, plugin, plugin_instance )

	dtype_instances = dtype_instances or { "" }
	local pngs = { }

	-- check for a whole graph handler
	local plugin_def = "ffluci.statistics.rrdtool.definitions." .. plugin
	local stat, def = pcall( require, plugin_def )

	if stat and def and type(def.rrdargs) == "function" then
		for i, png in ipairs( self:_generic( def.rrdargs( self, host, plugin, plugin_instance, dtype ) ) ) do
			table.insert( pngs, png )

			-- exec
			self:_rrdtool( png )

			-- clear args
			self:_clearargs()
		end
	else

		-- no graph handler, iterate over data types
		for i, dtype in ipairs( self.tree:data_types( plugin, plugin_instance ) ) do

			-- check for data type handler
			local dtype_def = plugin_def .. "." .. dtype
			local stat, def = pcall( require, dtype_def )

			if stat and def and type(def.rrdargs) == "function" then
				for i, png in ipairs( self:_generic( def.rrdargs( self, host, plugin, plugin_instance, dtype ) ) ) do
					table.insert( pngs, png )

					-- exec
					self:_rrdtool( png )

					-- clear args
					self:_clearargs()
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

