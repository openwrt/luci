-- Copyright 2008 Freifunk Leipzig / Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.statistics.i18n", package.seeall)

require("luci.util")
require("luci.i18n")


Instance = luci.util.class()


function Instance.__init__( self, graph )
	self.i18n  = luci.i18n
	self.graph = graph
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

function Instance._translate( self, key, alt )
	local val = self.i18n.string(key)
	if val ~= key then
		return val
	else
		return alt
	end
end

function Instance.title( self, plugin, pinst, dtype, dinst, user_title )

	local title = user_title or
		"p=%s/pi=%s/dt=%s/di=%s" % {
			plugin,
			(pinst and #pinst > 0) and pinst or "(nil)",
			(dtype and #dtype > 0) and dtype or "(nil)",
			(dinst and #dinst > 0) and dinst or "(nil)"
		}

	return self:_subst( title, {
		plugin = plugin,
		pinst  = pinst,
		dtype  = dtype,
		dinst  = dinst
	} )

end

function Instance.label( self, plugin, pinst, dtype, dinst, user_label )

	local label = user_label or
		"dt=%s/di=%s" % {
			(dtype and #dtype > 0) and dtype or "(nil)",
			(dinst and #dinst > 0) and dinst or "(nil)"
		}

	return self:_subst( label, {
		plugin = plugin,
		pinst  = pinst,
		dtype  = dtype,
		dinst  = dinst
	} )

end

function Instance.ds( self, source )

	local label = source.title or self:_translate(
		string.format( "stat_ds_%s_%s_%s", source.type, source.instance, source.ds ),
		self:_translate(
			string.format( "stat_ds_%s_%s", source.type, source.instance ),
			self:_translate(
				string.format( "stat_ds_label_%s__%s", source.type, source.ds ),
				self:_translate(
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
