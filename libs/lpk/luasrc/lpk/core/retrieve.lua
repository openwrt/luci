module("luci.lpk.core.retrieve", package.seeall)

function process(register)
	print "Now in retrieve"
	print (register.sometext)
	register.retrieved = true
end