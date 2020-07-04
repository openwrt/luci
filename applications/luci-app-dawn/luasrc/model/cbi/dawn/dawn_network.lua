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
		local hosts = sys.net.host_hints()
		local stat = utl.ubus("dawn", "get_network", { })
		local name, macs
		for name, macs in pairs(stat) do
		%>

			<div class="cbi-section-node">
	        <h3>SSID: <%= name %></h3>
			<div class="table" id=network_overview_main">
				<div class="tr table-titles">
					<div class="th">AP</div>
					<div class="th">Clients</div>
				</div>
			<%
			local mac, data
			for mac, data in pairs(macs) do
			%>
				<div class="tr">
					<div class="td" style="vertical-align: top;">
						<div class="table" id="ap-<%= mac %>">
							<div class="tr table-titles">
								<div class="th">Hostname</div>
								<div class="th">Interface</div>
								<div class="th">MAC</div>
								<div class="th">Utilization</div>
								<div class="th">Frequency</div>
								<div class="th">Stations</div>
								<div class="th">HT Sup</div>
								<div class="th">VHT Sup</div>
							</div>
							<div class="tr">
								<div class="td"><%= data.hostname %></div>
								<div class="td"><%= data.iface %></div>
								<div class="td"><%= mac %></div>
								<div class="td"><%= "%.2f" %(data.channel_utilization / 2.55) %> %</div>
								<div class="td"><%= "%.3f" %( data.freq / 1000 ) %> GHz (Channel: <%= "%d" %( status.frequency_to_channel(data.freq) ) %>)</div>
								<div class="td"><%= "%d" %data.num_sta %></div>
								<div class="td"><%= (data.ht_support == true) and "available" or "not available" %></div>
								<div class="td"><%= (data.vht_support == true) and "available" or "not available" %></div>
							</div>
							</div>
						</div>
					<div class="td" style="vertical-align: top;">
						<div class="table" id="clients-<%= mac %>">
							<div class="tr table-titles">
								<div class="th">MAC</div>
								<div class="th">HT</div>
								<div class="th">VHT</div>
								<div class="th">Signal</div>
							</div>
							<%
							local mac2, data2
							for clientmac, clientvals in pairs(data) do
								if (type(clientvals) == "table") then
							%>
								<div class="tr">
									<div class="td"><%= clientmac %></div>
									<div class="td"><%= (clientvals.ht == true) and "available" or "not available" %></div>
									<div class="td"><%= (clientvals.vht == true) and "available" or "not available" %></div>
									<div class="td"><%= "%d" %clientvals.signal %></div>
								</div>
								<%
								end
								%>
							<%
							end
							%>
							</div>
						</div>
					</div>
			<%
			end
			%>
			</div>
			</div>
		<%
		end
		%>
	]])
end

return m
