m = Map("Hearing Map", translate("Hearing Map"))
m.pageaction = false

s = m:section(NamedSection, "__hearingmap__")

function s.render(self, sid)
    local tpl = require "luci.template"
    tpl.render_string([[
        <ul>
		    <%
            local utl = require "luci.util"
            local status = require "luci.tools.ieee80211"
            local stat = utl.ubus("dawn", "get_hearing_map", { })
            local name, macs
            for name, macs in pairs(stat) do
            %>
                <li>
                    <strong>SSID is: </strong><%= name %><br />
                </li>
                <ul>
                <%
                local mac, data
                for mac, data in pairs(macs) do
                %>
                <li>
                    <strong>Client MAC is: </strong><%= mac %><br />
                </li>
                <ul>
                <%
                local mac2, data2
                for mac2, data2 in pairs(data) do
                %>
                    <li>
                        <strong>AP is: </strong><%= mac2 %><br />
                        <strong>Frequency is: </strong><%= "%.3f" %( data2.freq / 1000 ) %> GHz (Channel: <%= "%d" %( status.frequency_to_channel(data2.freq) ) %>)<br />
                        <strong>HT support is: </strong><%= (data2.ht_capabilities == true and data2.ht_support == true) and "available" or "not available" %><br />
                        <strong>VHT support is: </strong><%= (data2.vht_capabilities == true and data2.vht_support == true) and "available" or "not available" %><br />
                        <!--
                        <strong>AP HT support is: </strong><%= (data2.ht_support == true) and "available" or "not available" %><br />
                        <strong>AP VHT support is: </strong><%= (data2.vht_support == true) and "available" or "not available" %><br />
                        <strong>Client HT support is: </strong><%= (data2.ht_capabilities == true) and "available" or "not available" %><br />
                        <strong>Client VHT support is: </strong><%= (data2.vht_capabilities == true) and "available" or "not available" %><br />
                        --!>
                        <strong>Signal is: </strong><%= "%d" %data2.signal %><br />
                        <strong>Channel Utilization is: </strong><%= "%d" %data2.channel_utilization %><br />
                        <strong>Station connected to AP is: </strong><%= "%d" %data2.num_sta %><br />
                        <strong>Score is: </strong><%= "%d" %data2.score %><br />
                    </li>
                <%
                end
                %>
                </ul>
            <%
            end
            %>
            </ul>
        <%
        end
        %>
		</ul>
	]])
end

return m