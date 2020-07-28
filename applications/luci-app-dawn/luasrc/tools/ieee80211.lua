module("luci.tools.ieee80211", package.seeall)

function frequency_to_channel(freq)
	if (freq == 2484) then
		return 14;
	elseif (freq < 2484) then
		return (freq - 2407) / 5;
	elseif (freq >= 4910 and freq <= 4980) then
		return (freq - 4000) / 5;
	elseif (freq <= 45000) then
		return (freq - 5000) / 5;
	elseif (freq >= 58320 and freq <= 64800) then
		return (freq - 56160) / 2160;
	else
		return 0;
	end
end

