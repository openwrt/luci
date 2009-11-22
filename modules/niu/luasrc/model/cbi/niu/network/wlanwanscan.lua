local t = Template("niu/network/wlanwanscan")
function t.parse(self, ...)
	local state = Template.parse(self, ...)
	if Map.formvalue({readinput = true}, "cbi.delg.back") then
		return FORM_SKIP
	end 
	if state == FORM_NODATA then
		self.delegator.disallow_pageactions = true
	end
	return state
end
return t