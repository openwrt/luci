m = Map("usteer", "Usteer data", translate("Usteer data"))
m.pageaction = false

remoteap = m:section(NamedSection, "__remoteaps__")
clientoverview = m:section(NamedSection, "__remoteinfo__")
hearingmap = m:section(NamedSection, "__hearingmap__")



function clientoverview.render(self, sid)
	local tpl = require "luci.template"
	tpl.render_string([[
		<h2>Connection Info</h2>
		<%
			local utl = require "luci.util"
			local xml = require "luci.xml"
			local statrem = utl.ubus("usteer", "remote_info", { })	
		 	local statloc = utl.ubus("usteer", "local_info", { })
                        local luciip = require "luci.ip"
			local clients = utl.ubus("usteer", "get_clients", { })
		%>
			<div class="cbi-section-node">
				<table class="table" id="usteer_remote_info">
					<tr class="tr table-titles">
						<th class="th">wlan</th>
                                                <th class="th">bssid</th>
 						<th class="th">freq</th>
						<th class="th">n assoc</th>
						<th class="th">noise</th>
						<th class="th">load</th>
						<th class="th">max assoc</th>
                                                <th class="th">roam src</th>
                                                <th class="th">roam tgt</th>
                                                <th class="th">rrm_nr mac</th>
                                                <th class="th">rrm_nr ssid</th>
						<th class="th">rrm_nr hex</th> 
					</tr>
					<%
						local sorted_stat = {}
						for name, data in pairs(statrem) do
						    table.insert(sorted_stat, {name = name, data = data})
						end

						for name, data in pairs(statloc) do
						    table.insert(sorted_stat, {name = name, data = data})
						end
	
						table.sort(sorted_stat, function(a, b)
						if (a.data.rrm_nr[2]==b.data.rrm_nr[2]) then 
							return a.data.freq > b.data.freq
							else return a.data.rrm_nr[2] < b.data.rrm_nr[2] end
						end)
                                               

						for _, entry in ipairs(sorted_stat) do
					
						%>
						<tr class="tr">
							<td class="td"><nobr><%= entry.name  %></nobr></td>
							<td class="td"><%= entry.data.bssid %></td>
							<td class="td"><%= "%d" % entry.data.freq %></td>
                                                        <td class="td"><%= "%d" % entry.data.n_assoc %></td>
                                                        <td class="td"><%= "%d" % entry.data.noise %></td>
                                                        <td class="td"><%= "%d" % entry.data.load %></td>
                                                        <td class="td"><%= "%d" % entry.data.max_assoc %></td>
                                                        <td class="td"><%= "%d" % entry.data.roam_events.source %></td>
                                                        <td class="td"><%= "%d" % entry.data.roam_events.target %></td>
							<%
							local name2, data2
							for name2, data2 in pairs(entry.data.rrm_nr) do
							%>
                                                        <td class="td"><nobr><%= data2 %></nobr></td>
							<%
							end
							%>
						</tr>
					<%		
						end
					%>
				</table>
			</div>


			<div class="cbi-section-node">
				<table class="table" id="usteer_remote_info">
					<tr class="tr table-titles">
						<th class="th">wlan</th>                                                
                                                <th class="th">ssid</th>
 						<th class="th">freq</th>
						<th class="th">load</th>
						<th class="th">n</th>
						<th class="th">hosts</th> 
  
					</tr>
					<%

						local sorted_stat = {}
						for name, data in pairs(statrem) do
						    table.insert(sorted_stat, {name = name, data = data})
						end

						for name, data in pairs(statloc) do
						    table.insert(sorted_stat, {name = name, data = data})
						end

						table.sort(sorted_stat, function(a, b)
                                                   
						    if (a.data.rrm_nr[2]==b.data.rrm_nr[2]) then 
							return a.data.freq > b.data.freq
							else return a.data.rrm_nr[2] < b.data.rrm_nr[2] end  
						end)
                                                

						for _, entry in ipairs(sorted_stat) do
						
					%>
						<tr class="tr">
							<td class="td"><nobr><%= entry.name %></nobr></td>
                                                        <td class="td"><nobr><%= entry.data.rrm_nr[2] %></nobr></td>
							<td class="td"><%= "%d" % entry.data.freq %></td>
							<td class="td"><%= "%d" % entry.data.load %></td>
                                                        <td class="td"><%= "%d" % entry.data.n_assoc %></td>
							<td class="td">
							<%
							local hosts
							if  entry.data.n_assoc>0 then
								local mac,data
								for mac, data in pairs(clients) do
									local name,data2
									for name, data2 in pairs(data) do									
										if data2.connected==true and name==entry.name then
											local ip_address
											local aa= luciip.neighbors({  family = 4,mac = mac }, function(n) ip_address=n.dest end)
											local hostname
											local nslookupstring
											if ip_address~= nil  then
												nslookupstring=tostring(utl.exec("nslookup %s" %{tostring(ip_address)}))
												local start_position = nslookupstring:find("name = ")
												if start_position~=nil then  
													hostname="%s    "  %{nslookupstring:sub(start_position + 7)}  
											%><nobr><b><%= hostname:sub(1,1) %></b><%= hostname:sub(2) %></nobr>   <%
												else 
                                                                                        %><nobr><b><%= tostring(ip_address):sub(1,1) %></b><%= tostring(ip_address):sub(2) %></nobr>   <%
												end
												ip_address="IP %s" %{ip_address}
											else
                                                                                        %><nobr><b><%= tostring(mac):sub(1,1) %></b><%= tostring(mac):sub(2) %></nobr>   <%

											end
										
										end
									end
																	
								end
							end
							%>
                                                        </td>
						</tr>
					<%
						end
					%>
				</table>
			</div>


		<%
			
		%>
	]])
end


function hearingmap.render(self, sid)
	local tpl = require "luci.template"
	tpl.render_string([[
		<h2>Hearing map </h2>
		<%
			local utl = require "luci.util"
			local xml = require "luci.xml"
			local luciip = require "luci.ip"
			local clients = utl.ubus("usteer", "get_clients", { })


			-- sort on mac number
			local sorted_clients = {}
			for mac, data in pairs(clients) do
			    table.insert(sorted_clients, {mac = mac, data = data})
			end
	
			table.sort(sorted_clients, function(a, b)
			    return a.mac < b.mac
			end)


			for _, entry in ipairs(sorted_clients) do
				local ip_address
				local aa= luciip.neighbors({  family = 4,mac = entry.mac }, function(n) ip_address=n.dest end)
				local hostname
				local nslookupstring
				if ip_address~= nil  then
					nslookupstring=tostring(utl.exec("nslookup %s" %{tostring(ip_address)}))
					local start_position = nslookupstring:find("name = ")
					if start_position~=nil then  
					hostname="  Host: <nobr>%s</nobr> "  %{nslookupstring:sub(start_position + 7)}  
					end
					ip_address="  IP: %s " %{ip_address}
				end

		%>
			<div class="cbi-section-node">

				<h3>mac: <%= entry.mac %> <%= ip_address  %> <%=  hostname %>  </h3>
				<table class="table" id="usteer_client_map">
					<tr class="tr table-titles">
						<th class="th">wlan</th>
						<th class="th">connected</th>
						<th class="th">signal</th>
					</tr>
					<%
						-- sort on wlan name 
						local name,data2
						local sorted_entry = {}
						for name, data2 in pairs(entry.data) do
						    table.insert(sorted_entry, {name = name, connected  = data2.connected, signal=data2.signal})
						end
				
						table.sort(sorted_entry, function(a, b)
						    return a.name < b.name
						end)

						 for _, entry2 in ipairs(sorted_entry) do
					%>
						<tr class="tr">
							<td class="td"><nobr><%= entry2.name %></nobr></td>
							<td class="td"><%= entry2.connected %></td>
							<td class="td"><%= "%d" % entry2.signal %></td>
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



function remoteap.render(self, sid)
	local tpl = require "luci.template"
	tpl.render_string([[
		<h2>Remote hosts</h2>
		<%
			local utl = require "luci.util"
			local xml = require "luci.xml"
			local stat = utl.ubus("usteer", "remote_hosts", { })				
			local sorted_stat = {}
			for ip, data in pairs(stat) do
			    table.insert(sorted_stat, {ip = ip, id = data.id})
			end
			-- sort table on ip number
			table.sort(sorted_stat, function(a, b)
			    return a.ip < b.ip
			end)
		%>
			<div class="cbi-section-node">			
				<table class="table" id="usteer_remote_ap">
					<tr class="tr table-titles">
						<th class="th">Remote host IP</th>
						<th class="th">id</th>
					</tr>
					<%
						for _, entry in ipairs(sorted_stat) do 
					%>
						<tr class="tr">
							<td class="td"><%= entry.ip %></td>
							<td class="td"><%= "%d" % entry.id %></td>
						</tr>
					<%
						end
					%>
				</table>
			</div>
	]])
end

return m
