m = Map("dawn", "Hearing Map", translate("Hearing Map"))
m.pageaction = false

s = m:section(NamedSection, "__hearingmap__")

function s.render(self, sid)
	local tpl = require "luci.template"
	tpl.render_string([[
		<%
			local utl = require "luci.util"
			local xml = require "luci.xml"
			local status = require "luci.tools.ieee80211"
			local stat = utl.ubus("dawn", "get_hearing_map", { })
			local name, macs

			for name, macs in pairs(stat) do
		%>
			<div class="cbi-section-node">
				<h3>SSID: <%= xml.pcdata(name) %></h3>
				<table class="table" id="dawn_hearing_map">
					<tr class="tr table-titles">
						<th class="th">Client MAC</th>
						<th class="th">AP MAC</th>
						<th class="th">Frequency</th>
						<th class="th">HT Sup</th>
						<th class="th">VHT Sup</th>
						<th class="th">Signal</th>
						<th class="th">RCPI</th>
						<th class="th">RSNI</th>
						<th class="th">Channel Utilization</th>
						<th class="th">Station connect to AP</th>
						<th class="th">Score</th>
					</tr>
					<%
						local mac, data
						for mac, data in pairs(macs) do

							local mac2, data2
							local count_loop = 0
							for mac2, data2 in pairs(data) do
					%>
						<tr class="tr">
							<td class="td"><%= (count_loop == 0) and mac or "" %></td>
							<td class="td"><%= mac2 %></td>
							<td class="td"><%= "%.3f" %( data2.freq / 1000 ) %> GHz Channel: <%= "%d" %( status.frequency_to_channel(data2.freq) ) %></td>
							<td class="td"><%= (data2.ht_capabilities == true and data2.ht_support == true) and "True" or "False" %></td>
							<td class="td"><%= (data2.vht_capabilities == true and data2.vht_support == true) and "True" or "False" %></td>
							<td class="td"><%= "%d" % data2.signal %></td>
							<td class="td"><%= "%d" % data2.rcpi %></td>
							<td class="td"><%= "%d" % data2.rsni %></td>
							<td class="td"><%= "%.2f" % (data2.channel_utilization / 2.55) %> %</td>
							<td class="td"><%= "%d" % data2.num_sta %></td>
							<td class="td"><%= "%d" % data2.score %></td>
						</tr>
					<%
								count_loop = count_loop + 1
							end
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
