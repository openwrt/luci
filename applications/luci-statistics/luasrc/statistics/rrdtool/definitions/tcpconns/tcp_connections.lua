--[[

Luci statistics - tcpconns plugin diagram definition
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.statistics.rrdtool.definitions.tcpconns.tcp_connections", package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )

	return {
		data = {
			instances = {
				tcp_connections = {
			                "SYN_SENT", "SYN_RECV", "LISTEN", "ESTABLISHED",
					"LAST_ACK", "TIME_WAIT", "CLOSING", "CLOSE_WAIT",
					"CLOSED", "FIN_WAIT1", "FIN_WAIT2"
				}
			}
		}
	}
end
