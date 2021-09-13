m = Map("dawn", "Network Overview", translate("Network Overview"))
m.pageaction = false

s = m:section(NamedSection, "__networkoverview__")

function s.render(self, sid)
	local tpl = require "luci.template"
	local json = require "luci.json"
	local utl = require "luci.util"
	tpl.render_string([[
		<%
			local status = require "luci.tools.ieee80211"
			local utl = require "luci.util"
			local sys = require "luci.sys"
			local xml = require "luci.xml"
			local hosts = sys.net.host_hints()
			local stat = utl.ubus("dawn", "get_network", { })
			local name, macs
			for name, macs in pairs(stat) do
		%>
			<div class="cbi-section-node">
				<h3>SSID: <%= xml.pcdata(name) %></h3>
				<table class="table" id=network_overview_main">
					<tr class="tr table-titles">
						<th class="th">AP</th>
						<th class="th">Clients</th>
					</tr>
					<%
						local mac, data
						for mac, data in pairs(macs) do
					%>
						<tr class="tr">
							<td class="td" style="vertical-align: top;">
								<table class="table" id="ap-<%= mac %>">
									<tr class="tr table-titles">
										<th class="th">Hostname</th>
										<th class="th">Interface</th>
										<th class="th">MAC</th>
										<th class="th">Utilization</th>
										<th class="th">Frequency</th>
										<th class="th">Stations</th>
										<th class="th">HT Sup</th>
										<th class="th">VHT Sup</th>
									</tr>
									<tr class="tr">
										<td class="td"><%= xml.pcdata(data.hostname) %></td>
										<td class="td"><%= xml.pcdata(data.iface) %></td>
										<td class="td"><%= mac %></td>
										<td class="td"><%= "%.2f" %(data.channel_utilization / 2.55) %> %</td>
										<td class="td"><%= "%.3f" %( data.freq / 1000 ) %> GHz (Channel: <%= "%d" %( status.frequency_to_channel(data.freq) ) %>)</td>
										<td class="td"><%= "%d" % data.num_sta %></td>
										<td class="td"><%= (data.ht_support == true) and "available" or "not available" %></td>
										<td class="td"><%= (data.vht_support == true) and "available" or "not available" %></td>
									</tr>
								</table>
							</td>
							<td class="td" style="vertical-align: top;">
								<table class="table" id="clients-<%= mac %>">
									<tr class="tr table-titles">
										<th class="th">MAC</th>
										<th class="th">HT</th>
										<th class="th">VHT</th>
										<th class="th">Signal</th>
									</tr>
									<%
										local mac2, data2
										for clientmac, clientvals in pairs(data) do
											if (type(clientvals) == "table") then
									%>
										<tr class="tr">
											<td class="td"><%= clientmac %></td>
											<td class="td"><%= (clientvals.ht == true) and "available" or "not available" %></td>
											<td class="td"><%= (clientvals.vht == true) and "available" or "not available" %></td>
											<td class="td"><%= "%d" % clientvals.signal %></td>
										</tr>
									<%
											end
										end
									%>
								</table>
							</td>
						</tr>
					<%
						end
					%>
				</table>
			</div>
		<%
			end
		%>
	]])
end

return m
