-- Copyright 2011 Manuel Munz <freifunk at somakoma dot de>
-- Licensed to the public under the Apache License 2.0.

module("luci.tools.olsr2", package.seeall)

function metric_color(metric)
	local color = "#bb3333"
	if not metric or metric == 0 then
		color = "#bb3333"
	elseif metric < 4 then
		color = "#00cc00"
	elseif metric < 10 then
		color = "#ffcb05"
	elseif metric < 100 then
		color = "#ff6600"
	end
	return color
end

function willingness_color(willingness)
	local color = "#bb3333"
	if not willingness or willingness == 0 then
		color = "#bb3333"
	elseif willingness < 5 then
		color = "#00cc00"
	elseif willingness < 10 then
		color = "#ffcb05"
	elseif willingness < 15 then
		color = "#ff6600"
	end
	return color
end

function snr_color(snr)
	local color = "#bb3333"
	if not snr or snr == 0 then
		color = "#bb3333"
	elseif snr > 30 then
		color = "#00cc00"
	elseif snr > 20 then
		color = "#ffcb05"
	elseif snr > 5 then
		color = "#ff6600"
	end
	return color
end

