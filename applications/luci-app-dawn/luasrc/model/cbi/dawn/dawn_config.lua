m = Map("dawn", translate("Dawn Configuration"), translate(""))
s = m:section(TypedSection, "metric", "Metric", "Metric"); s.anonymous = true;
s:option(Value, "ht_support", "High Throughput Support")
s:option(Value, "no_ht_support", "No High Throughput Support")
s:option(Value, "vht_support", "Very High Throughput Support")
s:option(Value, "no_vht_support", "No Very High Throughput Support")
s:option(Value, "rssi", "RSSI")
s:option(Value, "low_rssi", "Low RSSI")
s:option(Value, "freq", "5GHz")
s:option(Value, "chan_util", "Channel Utilization")
s:option(Value, "max_chan_util", "Above Maximum Channel Utilization")

s = m:section(TypedSection, "metric", "Threshold", "Thresholds"); s.anonymous = true;
s:option(Value, "bandwidth_threshold", "Bandwidth Threshold")
s:option(Value, "rssi_val", "RSSI Threshold")
s:option(Value, "low_rssi_val", "Low RSSI Threshold")
s:option(Value, "chan_util_val", "Channel Utilization Threshold")
s:option(Value, "max_chan_util_val", "Maximaum Channel Utilization Threshold")
s:option(Value, "min_probe_count", "Minimum Probe Count")
s:option(Value, "min_number_to_kick", "Minimum Number After Kicking Client")

s = m:section(TypedSection, "metric", "Evaluate", "What should be evaluated?"); s.anonymous = true;
s:option(Flag, "kicking", "Activate Kicking")
s:option(Flag, "eval_probe_req", "Evaluate Probe Requests")
s:option(Flag, "eval_auth_req", "Evaluate Authentication Requests")
s:option(Flag, "eval_assoc_req", "Evaluate Association Requests")
s:option(Flag, "use_station_count", "Use Station Count")

s = m:section(TypedSection, "metric", "IEE802.11", "Reasons for denying"); s.anonymous = true;
s:option(Value, "deny_auth_reason", "Denying Authentication")
s:option(Value, "deny_assoc_reason", "Denying Association")

s = m:section(TypedSection, "times", "Time Configuration", "Time Configs"); s.anonymous = true;
s:option(Value, "update_client", "Update Client Information Interval")
s:option(Value, "denied_req_threshold", "Checking if client is connected")
s:option(Value, "remove_client", "Remove Client Information")
s:option(Value, "remove_probe", "Remove Hearing Map Information")
s:option(Value, "update_hostapd", "Check for new Hostapd Sockets")
s:option(Value, "update_tcp_con", "Check for new Routers")
s:option(Value, "update_chan_util", "Update Channel Utilization Interval")

return m