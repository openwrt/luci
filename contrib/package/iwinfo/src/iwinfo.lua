#!/usr/bin/lua

require "iwinfo"

function printf(fmt, ...)
	print(string.format(fmt, ...))
end

function s(x)
	if x == nil then
		return "?"
	else
		return tostring(x)
	end
end

function n(x)
	if x == nil then
		return 0
	else
		return tonumber(x)
	end
end

function print_info(api, dev)
	local iw = iwinfo[api]
	local enc = iw.encryption(dev)

	printf("%-9s Type: %s  ESSID: \"%s\"",
		dev, api, s(iw.ssid(dev)))

	printf("          Access Point: %s",
		s(iw.bssid(dev)))

	printf("          Mode: %s  Channel: %d (%.3f GHz)",
		iw.mode(dev), n(iw.channel(dev)), n(iw.frequency(dev)) / 1000)

	printf("          Tx-Power: %s dBm  Link Quality: %s/%s",
		s(iw.txpower(dev)), s(iw.quality(dev)), s(iw.quality_max(dev)))

	printf("          Signal: %s dBm  Noise: %s dBm",
		s(iw.signal(dev)), s(iw.noise(dev)))

	printf("          Bit Rate: %.1f MBit/s",
		n(iw.bitrate(dev)) / 1000)

	printf("          Encryption: %s",
		s(enc and enc.description))

	print("")
end

function print_scan(api, dev)
	local iw = iwinfo[api]
	local sr = iw.scanlist(dev)
	local si, se

	if sr and #sr > 0 then
		for si, se in ipairs(sr) do
			printf("Cell %02d - Address: %s", si, se.bssid)
			printf("          ESSID: \"%s\"",
				s(se.ssid))

			printf("          Mode: %s  Channel: %d",
				s(se.mode), n(se.channel))

			printf("          Signal: %s dBm  Quality: %d/%d",
				s(se.signal), n(se.quality), n(se.quality_max))

			printf("          Encryption: %s",
				s(se.encryption.description))

			print("")
		end
	else
		print("No scan results or scanning not possible")
		print("")
	end
end

function print_txpwrlist(api, dev)
	local iw = iwinfo[api]
	local pl = iw.txpwrlist(dev)
	local cp = n(iw.txpower(dev))
	local pe

	if pl and #pl > 0 then
		for _, pe in ipairs(pl) do
			printf("%s%3d dBm (%4d mW)",
				(cp == pe.dbm) and "*" or " ",
				n(pe.dbm), n(pe.mw))
		end
	else
		print("No TX power information available")
	end

	print("")
end

function print_freqlist(api, dev)
	local iw = iwinfo[api]
	local fl = iw.freqlist(dev)
	local cc = n(iw.channel(dev))
	local fe

	if fl and #fl > 0 then
		for _, fe in ipairs(fl) do
			printf("%s %.3f GHz (Channel %d)",
				(cc == fe.channel) and "*" or " ",
				n(fe.mhz) / 1000, n(fe.channel))
		end
	else
		print("No frequency information available")
	end

	print("")
end

function print_assoclist(api, dev)
	local iw = iwinfo[api]
	local al = iw.assoclist(dev)
	local ai, ae

	if al and next(al) then
		for ai, ae in pairs(al) do
			printf("%s  %s dBm", ai, s(ae.signal))
		end
	else
		print("No client connected or no information available")
	end

	print("")
end


if #arg ~= 2 then
	print("Usage:")
	print("	iwinfo <device> info")
	print("	iwinfo <device> scan")
	print("	iwinfo <device> txpowerlist")
	print("	iwinfo <device> freqlist")
	print("	iwinfo <device> assoclist")
	os.exit(1)
end

local dev = arg[1]
local api = iwinfo.type(dev)
if not api then
	print("No such wireless device: " .. dev)
	os.exit(1)
end


if arg[2]:match("^i") then
	print_info(api, dev)

elseif arg[2]:match("^s") then
	print_scan(api, dev)

elseif arg[2]:match("^t") then
	print_txpwrlist(api, dev)

elseif arg[2]:match("^f") then
	print_freqlist(api, dev)

elseif arg[2]:match("^a") then
	print_assoclist(api, dev)

else
	print("Unknown command: " .. arg[2])
end
