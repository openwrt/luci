module("luci.lpk.core.install", package.seeall)

function entry(register, ...)
	print("Requested install of " .. table.concat(arg, ", "))
	return true
end

function process(register)
	register.sometext = "Test"
	if not register.retreived then
		print("Step down to retreive")
		return "retreive"
	else
		print("Coming up again")
	end
end