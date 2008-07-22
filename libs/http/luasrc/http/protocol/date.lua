--[[

HTTP protocol implementation for LuCI - date handling
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

--- LuCI http protocol implementation - date helper class.
-- This class contains functions to parse, compare and format http dates.
module("luci.http.protocol.date", package.seeall)

MONTHS = {
	"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug",
	"Sep", "Oct", "Nov", "Dec"
}

--- The "TZ" table contains lowercased timezone names associated with their
-- corresponding time offsets sepcified in seconds.
-- @class table
TZ = {
	-- DST zones
	["brst"]  =   -2*3600;	 -- Brazil Summer Time (East Daylight)
	["adt"]   =   -3*3600;	 -- Atlantic Daylight
	["edt"]   =   -4*3600;	 -- Eastern Daylight
	["cdt"]   =   -5*3600;	 -- Central Daylight
	["mdt"]   =   -6*3600;	 -- Mountain Daylight
	["pdt"]   =   -7*3600;	 -- Pacific Daylight
	["ydt"]   =   -8*3600;	 -- Yukon Daylight
	["hdt"]   =   -9*3600;	 -- Hawaii Daylight
	["bst"]   =    1*3600;	 -- British Summer
	["mest"]  =    2*3600;	 -- Middle European Summer
	["sst"]   =    2*3600;	 -- Swedish Summer
	["fst"]   =    2*3600;	 -- French Summer
	["eest"]  =    3*3600;	 -- Eastern European Summer
	["cest"]  =    2*3600;	 -- Central European Daylight
	["wadt"]  =    8*3600;	 -- West Australian Daylight
	["kdt"]   =   10*3600;	 -- Korean Daylight
	["eadt"]  =   11*3600;	 -- Eastern Australian Daylight
	["nzdt"]  =   13*3600;	 -- New Zealand Daylight

	-- zones
	["gmt"]   =   0;		 -- Greenwich Mean
	["ut"]    =   0;		 -- Universal (Coordinated)
	["utc"]   =   0;
	["wet"]   =   0;		 -- Western European
	["wat"]   =  -1*3600;	 -- West Africa
	["azost"] =  -1*3600;	 -- Azores Standard Time
	["cvt"]   =  -1*3600;	 -- Cape Verde Time
	["at"]    =  -2*3600;	 -- Azores
	["fnt"]   =  -2*3600;	 -- Brazil Time (Extreme East - Fernando Noronha)
	["ndt"]   =  -2*3600+1800;-- Newfoundland Daylight
	["art"]   =  -3*3600;	 -- Argentina Time
	["nft"]   =  -3*3600+1800;-- Newfoundland
	["mnt"]   =  -4*3600;	 -- Brazil Time (West Standard - Manaus)
	["ewt"]   =  -4*3600;	 -- U.S. Eastern War Time
	["ast"]   =  -4*3600;	 -- Atlantic Standard
	["bot"]   =  -4*3600;	 -- Bolivia Time
	["vet"]   =  -4*3600;	 -- Venezuela Time
	["est"]   =  -5*3600;	 -- Eastern Standard
	["cot"]   =  -5*3600;	 -- Colombia Time
	["act"]   =  -5*3600;	 -- Brazil Time (Extreme West - Acre)
	["pet"]   =  -5*3600;	 -- Peru Time
	["cst"]   =  -6*3600;	 -- Central Standard
	["cest"]  =   2*3600;	 -- Central European Summer
	["mst"]   =  -7*3600;	 -- Mountain Standard
	["pst"]   =  -8*3600;	 -- Pacific Standard
	["yst"]   =  -9*3600;	 -- Yukon Standard
	["hst"]   = -10*3600;	 -- Hawaii Standard
	["cat"]   = -10*3600;	 -- Central Alaska
	["ahst"]  = -10*3600;	 -- Alaska-Hawaii Standard
	["taht"]  = -10*3600;	 -- Tahiti Time
	["nt"]    = -11*3600;	 -- Nome
	["idlw"]  = -12*3600;	 -- International Date Line West
	["cet"]   =   1*3600;	 -- Central European
	["mez"]   =   1*3600;	 -- Central European (German)
	["met"]   =   1*3600;	 -- Middle European
	["mewt"]  =   1*3600;	 -- Middle European Winter
	["swt"]   =   1*3600;	 -- Swedish Winter
	["set"]   =   1*3600;	 -- Seychelles
	["fwt"]   =   1*3600;	 -- French Winter
	["west"]  =   1*3600;	 -- Western Europe Summer Time
	["eet"]   =   2*3600;	 -- Eastern Europe; USSR Zone 1
	["ukr"]   =   2*3600;	 -- Ukraine
	["sast"]  =   2*3600;	 -- South Africa Standard Time
	["bt"]    =   3*3600;	 -- Baghdad; USSR Zone 2
	["eat"]   =   3*3600;	 -- East Africa Time
	["irst"]  =   3*3600+1800;-- Iran Standard Time
	["zp4"]   =   4*3600;	 -- USSR Zone 3
	["msd"]   =   4*3600;	 -- Moscow Daylight Time
	["sct"]   =   4*3600;	 -- Seychelles Time
	["zp5"]   =   5*3600;	 -- USSR Zone 4
	["azst"]  =   5*3600;	 -- Azerbaijan Summer Time
	["mvt"]   =   5*3600;	 -- Maldives Time
	["uzt"]   =   5*3600;	 -- Uzbekistan Time
	["ist"]   =   5*3600+1800;-- Indian Standard
	["zp6"]   =   6*3600;	 -- USSR Zone 5
	["lkt"]   =   6*3600;	 -- Sri Lanka Time
	["pkst"]  =   6*3600;	 -- Pakistan Summer Time
	["yekst"] =   6*3600;	 -- Yekaterinburg Summer Time
	["wast"]  =   7*3600;	 -- West Australian Standard
	["ict"]   =   7*3600;	 -- Indochina Time
	["wit"]   =   7*3600;	 -- Western Indonesia Time
	["cct"]   =   8*3600;	 -- China Coast; USSR Zone 7
	["wst"]   =   8*3600;	 -- West Australian Standard
	["hkt"]   =   8*3600;	 -- Hong Kong
	["bnt"]   =   8*3600;	 -- Brunei Darussalam Time
	["cit"]   =   8*3600;	 -- Central Indonesia Time
	["myt"]   =   8*3600;	 -- Malaysia Time
	["pht"]   =   8*3600;	 -- Philippines Time
	["sgt"]   =   8*3600;	 -- Singapore Time
	["jst"]   =   9*3600;	 -- Japan Standard; USSR Zone 8
	["kst"]   =   9*3600;	 -- Korean Standard
	["east"]  =  10*3600;	 -- Eastern Australian Standard
	["gst"]   =  10*3600;	 -- Guam Standard; USSR Zone 9
	["nct"]   =  11*3600;	 -- New Caledonia Time
	["nzt"]   =  12*3600;	 -- New Zealand
	["nzst"]  =  12*3600;	 -- New Zealand Standard
	["fjt"]   =  12*3600;	 -- Fiji Time
	["idle"]  =  12*3600;	 -- International Date Line East
}

--- Return the time offset in seconds between the UTC and given time zone.
-- @param tz	Symbolic or numeric timezone specifier
-- @return		Time offset to UTC in seconds
function tz_offset(tz)

	if type(tz) == "string" then

		-- check for a numeric identifier
		local s, v = tz:match("([%+%-])([0-9]+)")
		if s == '+' then s = 1 else s = -1 end
		if v then v = tonumber(v) end

		if s and v then
			return s * 60 * ( math.floor( v / 100 ) * 60 + ( v % 100 ) )

		-- lookup symbolic tz
		elseif TZ[tz:lower()] then
			return TZ[tz:lower()]
		end

	end

	-- bad luck
	return 0
end

--- Parse given HTTP date string and convert it to unix epoch time.
-- @param data	String containing the date
-- @return		Unix epoch time
function to_unix(date)

	local wd, day, mon, yr, hr, min, sec, tz = date:match(
		"([A-Z][a-z][a-z]), ([0-9]+) " ..
		"([A-Z][a-z][a-z]) ([0-9]+) " ..
		"([0-9]+):([0-9]+):([0-9]+) " ..
		"([A-Z0-9%+%-]+)"
	)

	if day and mon and yr and hr and min and sec then
		-- find month
		local month = 1
		for i = 1, 12 do
			if MONTHS[i] == mon then
				month = i
				break
			end
		end

		-- convert to epoch time
		return tz_offset(tz) + os.time( {
			year  = yr,
			month = month,
			day   = day,
			hour  = hr,
			min   = min,
			sec   = sec
		} )
	end

	return 0
end

--- Convert the given unix epoch time to valid HTTP date string.
-- @param time	Unix epoch time
-- @return		String containing the formatted date
function to_http(time)
	return os.date( "%a, %d %b %Y %H:%M:%S GMT", time )
end

--- Compare two dates which can either be unix epoch times or HTTP date strings.
-- @param d1	The first date or epoch time to compare
-- @param d2	The first date or epoch time to compare
-- @return		-1  -  if d1 is lower then d2
-- @return		0   -  if both dates are equal
-- @return		1   -  if d1 is higher then d2
function compare(d1, d2)

	if d1:match("[^0-9]") then d1 = to_unix(d1) end
	if d2:match("[^0-9]") then d2 = to_unix(d2) end

	if d1 == d2 then
		return 0
	elseif d1 < d2 then
		return -1
	else
		return 1
	end
end
