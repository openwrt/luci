--[[

Luci statistics - irq plugin diagram definition
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id: stat-genconfig 2272 2008-06-03 22:42:01Z nbd $

]]--

module("luci.statistics.rrdtool.definitions.irq.irq", package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )

	return {
		data = {
			types = { "irq" }
		}
	}
end
