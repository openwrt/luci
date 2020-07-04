m = Map("dawn", "Hearing Map", translate("Hearing Map"))
m.pageaction = false

s = m:section(NamedSection, "__hearingmap__")

function s.render(self, sid)
    local tpl = require "luci.template"
    tpl.render_string([[
        <%
        local utl = require "luci.util"
        local status = require "luci.tools.ieee80211"
        local stat = utl.ubus("dawn", "get_hearing_map", { })
        local name, macs

        for name, macs in pairs(stat) do
        %>
        <div class="cbi-section-node">
	        <h3>SSID: <%= name %></h3>
            <div class="table" id="dawn_hearing_map">
		        <div class="tr table-titles">
                    <div class="th">Client MAC</div>
                    <div class="th">AP MAC</div>
                    <div class="th">Frequency</div>
                    <div class="th">HT Sup</div>
                    <div class="th">VHT Sup</div>
                    <div class="th">Signal</div>
                    <div class="th">RCPI</div>
                    <div class="th">RSNI</div>
                    <div class="th">Channel Utilization</div>
                    <div class="th">Station connect to AP</div>
                    <div class="th">Score</div>
                </div>
                <%
                local mac, data
                for mac, data in pairs(macs) do
                    local mac2, data2
                    local count_loop = 0

                    for mac2, data2 in pairs(data) do
                %>
                        <div class="tr">
                            <% if (count_loop == 0) then %>
                                <div class="td"><%= mac %></div>
                            <% else %>
                                <div></div>
                            <% end %>
                            <div class="td"><%= mac2 %></div>
                            <div class="td"><%= "%.3f" %( data2.freq / 1000 ) %> GHz Channel: <%= "%d" %( status.frequency_to_channel(data2.freq) ) %></div>
                            <div class="td"><%= (data2.ht_capabilities == true and data2.ht_support == true) and "True" or "False" %></div>
                            <div class="td"><%= (data2.vht_capabilities == true and data2.vht_support == true) and "True" or "False" %></div>
                            <div class="td"><%= "%d" %data2.signal %></div>
                            <div class="td"><%= "%d" %data2.rcpi %></div>
                            <div class="td"><%= "%d" %data2.rsni %></div>
                            <div class="td"><%= "%.2f" %(data2.channel_utilization / 2.55) %> %</div>
                            <div class="td"><%= "%d" %data2.num_sta %></div>
                            <div class="td"><%= "%d" %data2.score %></div>
                        </div>
			    <%
			            count_loop = count_loop + 1
                    end
                end
                %>
            </div>
        </div>
        <%
        end
        %>
    </div>
    ]])
end

return m