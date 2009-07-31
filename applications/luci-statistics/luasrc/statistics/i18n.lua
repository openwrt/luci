--[[

Luci statistics - diagram i18n helper
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.statistics.i18n", package.seeall)

require("luci.util")
require("luci.i18n")


Instance = luci.util.class()


function Instance.__init__( self, graph )
	self.i18n  = luci.i18n
	self.graph = graph

	self.i18n.loadc("rrdtool")
	self.i18n.loadc("statistics")
end

function Instance._subst( self, str, val )
	str = str:gsub( "%%H",  self.graph.opts.host or "" )
	str = str:gsub( "%%pn", val.plugin or "" )
	str = str:gsub( "%%pi", val.pinst  or "" )
	str = str:gsub( "%%dt", val.dtype  or "" )
	str = str:gsub( "%%di", val.dinst  or "" )
	str = str:gsub( "%%ds", val.dsrc   or "" )

	return str
end

function Instance.title( self, plugin, pinst, dtype, dinst )

	local title = self.i18n.string(
		string.format( "stat_dg_title_%s_%s_%s", plugin, pinst, dtype ),
		self.i18n.string(
			string.format( "stat_dg_title_%s_%s", plugin, pinst ),
			self.i18n.string(
				string.format( "stat_dg_title_%s__%s", plugin, dtype ),
				self.i18n.string(
					string.format( "stat_dg_title_%s", plugin ),
					self.graph:_mkpath( plugin, pinst, dtype )
				)
			)
		)
	)

	return self:_subst( title, {
		plugin = plugin,
		pinst  = pinst,
		dtype  = dtype,
		dinst  = dinst
	} )

end

function Instance.label( self, plugin, pinst, dtype, dinst )

	local label = self.i18n.string(
		string.format( "stat_dg_label_%s_%s_%s", plugin, pinst, dtype ),
		self.i18n.string(
			string.format( "stat_dg_label_%s_%s", plugin, pinst ),
			self.i18n.string(
				string.format( "stat_dg_label_%s__%s", plugin, dtype ),
				self.i18n.string(
					string.format( "stat_dg_label_%s", plugin ),
					self.graph:_mkpath( plugin, pinst, dtype )
				)
			)
		)
	)

	return self:_subst( label, {
		plugin = plugin,
		pinst  = pinst,
		dtype  = dtype,
		dinst  = dinst
	} )

end

function Instance.ds( self, source )

	local label = self.i18n.string(
		string.format( "stat_ds_%s_%s_%s", source.type, source.instance, source.ds ),
		self.i18n.string(
			string.format( "stat_ds_%s_%s", source.type, source.instance ),
			self.i18n.string(
				string.format( "stat_ds_label_%s__%s", source.type, source.ds ),
				self.i18n.string(
					string.format( "stat_ds_%s", source.type ),
					source.type .. "_" .. source.instance:gsub("[^%w]","_") .. "_" .. source.ds
				)
			)
		)
	)

	return self:_subst( label, {
		dtype = source.type,
		dinst = source.instance,
		dsrc  = source.ds
	} )
end
