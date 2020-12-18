m = Map("babeld", translate("Babeld Overview"))
m.pageaction = false

s = m:section(NamedSection, "__babeldoverview__")

function s.render(self, sid)
	local tpl = require "luci.template"

	tpl.render_string([[
		<%
		local utl = require "luci.util"
		local v6_port = 33123
		-- FIXME: check if call is correct
		local dump = utl.exec("(echo dump | nc ::1 %d)" % v6_port)
		local t = {}

		for strline in string.gmatch(dump, "[^\n]+") do
			t[#t+1] = strline;
		end

		local babel_version = t[1]
		local babeld_version = t[2]
		local babeld_host = string.split(t[3], " ")[2]
		local babeld_id = string.split(t[4], " ")[2]
		local babeld_status = t[5]

		%>
		<div class="cbi-section-node">
			<h3>Babel-Info</h3>
			<div class="table" id=babel_status_main">
				<div class="tr table-titles">
					<div class="th">Version</div>
					<div class="th">Version-Daemon</div>
					<div class="th">Host</div>
					<div class="th">ID</div>
					<div class="th">Status</div>
				</div>
				<div class="tr">
					<div class="td"><%= babel_version %></div>
					<div class="td"><%= babeld_version %></div>
					<div class="td"><%= babeld_host %></div>
					<div class="td"><%= babeld_id %></div>
					<div class="td"><%= babeld_status %></div>
				</div>
			</div>
		</div>
		
		<%
		local xroutes = {}
		for key,value in ipairs(t) do
			if string.match(value, "xroute") then
				xroutes[#xroutes+1] = value
			end
		end
		%>

		<div class="cbi-section-node">
			<h3>X-Routes</h3>
			<div class="table" id=babel_overview_xroute">
				<div class="tr table-titles">
					<div class="th">Route</div>
					<div class="th">Prefix</div>
					<div class="th">From</div>
					<div class="th">Metric</div>
				</div>
				<%
				for key,route in ipairs(xroutes) do
					local route_sep = string.split(route," ")
				%>
					<div class="tr">
						<div class="td"><%= route_sep[3] %></div>
						<div class="td"><%= route_sep[5] %></div>
						<div class="td"><%= route_sep[7] %></div>
						<div class="td"><%= route_sep[9] %></div>
					</div>
				<%
				end
				%>
			</div>
		</div>
		
		<%
		local routes = {}
		for key,value in ipairs(t) do
			if string.match(value, "add route") then
					routes[#routes+1] = value
			end
		end
		%>

		<div class="cbi-section-node">
			<h3>Routes</h3>
			<div class="table" id=babel_overview_route">
				<div class="tr table-titles">
					<div class="th">Prefix</div>
					<div class="th">From</div>
					<div class="th">Installed</div>
					<div class="th">ID</div>
					<div class="th">Metric</div>
					<div class="th">Ref-Metric</div>
					<div class="th">Via</div>
					<div class="th">Interface</div>
				</div>
				<%
				for key,route in ipairs(routes) do
					local route_sep = string.split(route," ")
				%>

					<div class="tr">
						<div class="td"><%= route_sep[5] %></div>
						<div class="td"><%= route_sep[7] %></div>
						<div class="td"><%= route_sep[9] %></div>
						<div class="td"><%= route_sep[11] %></div>
						<div class="td"><%= route_sep[13] %></div>
						<div class="td"><%= route_sep[15] %></div>
						<div class="td"><%= route_sep[17] %></div>
						<div class="td"><%= route_sep[19] %></div>
					</div>
				<%
				end
				%>
			</div>
		</div>
	]])
end

return m
