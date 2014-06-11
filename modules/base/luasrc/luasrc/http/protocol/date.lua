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

require("luci.sys.zoneinfo")


MONTHS = {
	"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug",
	"Sep", "Oct", "Nov", "Dec"
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
		elseif luci.sys.zoneinfo.OFFSET[tz:lower()] then
			return luci.sys.zoneinfo.OFFSET[tz:lower()]
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
