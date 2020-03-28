m = Map("Network Overview", translate("Network Overview"))
m.pageaction = false

s = m:section(NamedSection, "__networkoverview__")

function s.render(self, sid)
	local tpl = require "luci.template"
	local json = require "luci.json"
	local utl = require "luci.util"
	tpl.render_string([[
		<table class="table" style="border: 1px solid grey;">
			<thead style="background-color: grey; color: white;">
				<tr>
						<th>SSID</th>
						<th>MAC</th>
						<th>Channel Utilization</th>
						<th>Frequency</th>
						<th>Stations</th>
						<th>HT Sup</th>
						<th>VHT Sup</th>
				</tr>
			</thead>
			<tbody>
			<%
			local status = require "luci.tools.ieee80211"
			local utl = require "luci.util"
			local sys = require "luci.sys"
			local hosts = sys.net.host_hints()
			local stat = utl.ubus("dawn", "get_network", { })
			local name, macs
			for name, macs in pairs(stat) do
				local mac, data
				for mac, data in pairs(macs) do
			%>
				<tr class="center">
					<td><%= name %></td>
					<td><%= mac %></td>
					<td><%= "%.2f" %(data.channel_utilization / 2.55) %> %</td>
					<td><%= "%.3f" %( data.freq / 1000 ) %> GHz (Channel: <%= "%d" %( status.frequency_to_channel(data.freq) ) %>)</td>
					<td><%= "%d" %data.num_sta %></td>
					<td><%= (data.ht_support == true) and "available" or "not available" %></td>
					<td><%= (data.vht_support == true) and "available" or "not available" %></td>
				</tr>
				<tr>
					<td colspan="7"><hr></td>
				</tr>
				<tr>
					<td colspan="2" class="center"><strong>Clients</strong></td>
					<td colspan="4">
					<table class="table" style="border: 1px solid grey;">
					<thead style="background-color: grey; color: white;">
						<tr>
							<th>MAC</th>
							<th>HT</th>
							<th>VHT</th>
							<th>Signal</th>
						</tr>
					</thead>
					<tbody>
					<%
					local mac2, data2
					for clientmac, clientvals in pairs(data) do
						if (type(clientvals) == "table") then 
					%>
						<tr class="center">
							<td><%= clientmac %></td>
							<td><%= (clientvals.ht == true) and "available" or "not available" %></td>
							<td><%= (clientvals.vht == true) and "available" or "not available" %></td>
							<td><%= "%d" %clientvals.signal %></td>
						</tr>
					<%
						end
					end
					%>
					</tbody>
					</table>
				</tr>
				<tr>
					<td colspan="7"><hr></td>
				</tr>
				<%
				end
				%>
			<%
			end
			%>
			</tbody>
		</table>
	]])
end

return m