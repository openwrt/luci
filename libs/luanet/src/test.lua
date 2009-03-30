#!/usr/bin/lua

print("luanet test")
local luanet = require("luanet")

print("sleeping 4 secs")
luanet.sleep(4)

print("---ifconfig---\n")
print("set ip wlan0 -> 192.168.1.2")
print(luanet.ifc_setip("wlan0", "192.168.1.2"))
print("set ip wlan0:1 -> 192.168.2.2")
print(luanet.ifc_setip("wlan0:1", "192.168.2.2"))
print("set mtu wlan0 -> 1400")
print(luanet.ifc_setmtu("wlan0", "1400"))
--print("set down wlan0 ->")
--print(luanet.ifc_down("wlan0"))
--print("set up wlan0 ->")
--print(luanet.ifc_up("wlan0"))
local devs = luanet.ifc_getall()
for i,v in pairs(devs) do
	print("\ndev -> "..i)
	print(devs[i].ip)
	print(devs[i].netmask)
	print(devs[i].broadaddr)
	print(devs[i].mac)
	print(devs[i].mtu)
	print(devs[i].up)
end


print("\n\n---bridge---\n")
print("add bridge br-test ->")
print(luanet.bridge_new("br-test"))

print("add wlan0 to br-test ->")
print(luanet.bridge_addif("br-test", "wlan0"))

print("listing bridges")
local brs = luanet.bridge_getall()
if brs then
	for i,v in pairs(brs) do
		print(i)
		for j,k in pairs(v) do
			print(j.."->"..k)
		end
	end
end
print("del wlan0 from br-test ->")
print(luanet.bridge_delif("br-test", "wlan0"))

print("del bridge br-test ->")
print(luanet.bridge_del("br-test"))


print("\n\n---wifi---\n")
print("set wlan0 essid test123")
print(luanet.iwc_set_essid("wlan0", "test123"))
print("set wifi channel to 3")
print(luanet.iwc_set_channel("wlan0", 3))
print("set wifi to managed")
print(luanet.iwc_set_mode("wlan0", "managed"))
print("\nget all wifi devices")
local wifidevs = luanet.iwc_getall()
if wifidevs then
	for i,v in pairs(wifidevs) do
		print(i)
		for j,k in pairs(v) do
			print("  "..j.."->"..k)
		end
	end
end
local scan = luanet.iwc_scan("wlan0")
print("\nscanning wifi on wlan0")
if scan then
	for i,v in pairs(scan) do
		print("\n"..i)
		print("  mac -> "..v.addr)
		print("  frequency -> "..v.frequency)
		print("  channel -> "..v.channel)
		print("  mode -> "..v.mode)
		print("  essid -> "..v.essid)
		print("  key -> "..v.key)
		print("  wpa1gcipher -> "..(v.wpa1gcipher or ""))
		print("  wpa1pcipher -> "..(v.wpa1pcipher or ""))
		print("  wpa1auth -> "..(v.wpa1auth or ""))
		print("  wpa2gcipher -> "..(v.wpa2gcipher or ""))
		print("  wpa2pcipher -> "..(v.wpa2pcipher or ""))
		print("  wpa2auth -> "..(v.wpa2auth or ""))
		print("  bitrates")
		for j,k in ipairs(v.bitrates) do
			--print(j.."->"..k)
		end
	end
end


print("\n\n---vlan---\n")
print("add wlan0 to vlan0")
print(luanet.vlan_add("wlan0", 0));
print("add wlan0 to vlan1")
print(luanet.vlan_add("wlan0", 1));
print("del wlan0 from all vlans")
print(luanet.vlan_del("wlan0.0"));
print("add wlan0 to vlan6")
print(luanet.vlan_add("wlan0", 6));
local vlans = luanet.vlan_getall()
if vlans then
	for i,v in ipairs(vlans) do
		print(i.."->"..v)
	end
end


print("\n\n---df---\n")

print("getting disc usage")
local discs = luanet.df()
if discs then
	for i,v in ipairs(discs) do
		print(i.."->")
		for k,l in pairs(v) do
			print("  "..k.."->"..l)
		end
	end
end


print("\n\n---b64---\n")
print("test2 -->"..(luanet.b64_encode("test2") or "fail"))
print("dGVzdDI= -->"..(luanet.b64_decode("dGVzdDI=") or "fail"))

