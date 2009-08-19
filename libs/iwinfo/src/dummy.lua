module "iwinfo"

function type()
	return "dummy"
end

dummy = {}

function dummy.channel()
	return 1
end

function dummy.frequency()
	return 2412
end

function dummy.bitrate()
	return 36
end

function dummy.signal()
	return -53
end

function dummy.noise()
	return -96
end

function dummy.quality()
	return 11
end

function dummy.quality_max()
	return 70
end

function dummy.mode()
	return "Master"
end

function dummy.ssid()
	return "OpenWrt"
end

function dummy.bssid()
	return "00:11:22:33:44:55"
end

function dummy.enctype()
	return "WPA2 PSK (CCMP)"
end

function dummy.assoclist()
	return {}
end

function dummy.mbssid_support()
	return 1
end
