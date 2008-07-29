module("luci.lpk.core.retreive", package.seeall)

function process(register)
	print "Now in retreive"
	print (register.sometext)
	register.retreived = true
end