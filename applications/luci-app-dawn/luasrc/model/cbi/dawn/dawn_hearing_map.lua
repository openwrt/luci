m = Map("Hearing Map", translate("Hearing Map"))
m.pageaction = false

s = m:section(NamedSection, "__hearingmap__")

function s.render(self, sid)
    local tpl = require "luci.template"
    tpl.render_string([[
        <style>.hearing_table tr{ border-bottom: 1px solid grey;} tr:nth-child(even){background-color: lightgrey;}</style>
        <%
        local utl = require "luci.util"
        local status = require "luci.tools.ieee80211"
        local stat = utl.ubus("dawn", "get_hearing_map", { })
        local name, macs

        for name, macs in pairs(stat) do
            local count = 0
            for a,b in pairs(macs) do for _ in pairs(b) do count = count + 1 end end
        %>
            <table class="table" style="border: 1px solid grey;">
                <thead style="background-color: grey; color: white;">
                    <tr>
                        <th>SSID</th>
                        <th>Client MAC</th>
                        <th>AP MAC</th>
                        <th>Frequency</th>
                        <th>HT Sup</th>
                        <th>VHT Sup</th>
                        <th>Signal</th>
                        <th>RCPI</th>
                        <th>RSNI</th>
                        <th>Channel<br />Utilization</th>
                        <th>Station connect<br />to AP</th>
                        <th>Score</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="center" style="border: 1px solid grey;">
                        <td rowspan="<%= count + 1 %>" style="background-color: white; border-right: 1px solid grey;"><%= name %></td>
                        <%
                        local mac, data
                        for mac, data in pairs(macs) do
                            local mac2, data2
                            local count_macs = 0
                            local count_loop = 0
                            for _ in pairs(data) do count_macs = count_macs + 1 end

                            for mac2, data2 in pairs(data) do
                        %>
                                <tr class="center" style="border: 1px solid grey;">
                                    <% if (count_macs > 1) then %>
                                        <% if (count_loop == 0 ) then %>
                                            <td rowspan="<%= count_macs %>" style="background-color: white; border-right: 1px solid grey;"><%= mac %></td>
                                        <% end %>
                                    <% else %>
                                        <td><%= mac %></td>
                                    <% end %>
                                    <td><%= mac2 %></td>
                                    <td><%= "%.3f" %( data2.freq / 1000 ) %> GHz<br />(Channel: <%= "%d" %( status.frequency_to_channel(data2.freq) ) %>)</td>
                                    <td><%= (data2.ht_capabilities == true and data2.ht_support == true) and "True" or "False" %></td>
                                    <td><%= (data2.vht_capabilities == true and data2.vht_support == true) and "True" or "False" %></td>
                                    <td><%= "%d" %data2.signal %></td>
                                    <td><%= "%d" %data2.rcpi %></td>
                                    <td><%= "%d" %data2.rsni %></td>
                                    <td><%= "%.2f" %(data2.channel_utilization / 2.55) %> %</td>
                                    <td><%= "%d" %data2.num_sta %></td>
                                    <td><%= "%d" %data2.score %></td>
                                </tr>
                            <%
                            count_loop = count_loop + 1
                            end
                            %>
                        <%
                        end
                        %>
                    </tr>
                </tbody>
            </table>
        <%
        end
        %>
    ]])
end

return m