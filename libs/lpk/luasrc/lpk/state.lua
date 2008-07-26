module("luci.lpk.state", package.seeall)
require("luci.util")

State = luci.util.class()

function State.__init__()
	self.poststates = {}
	self.prestates  = {}
end

function State.add_poststate(state)
	table.insert(self.poststates, state)
end

function State.add_prestate(state)
	table.insert(self.prestates, state)
end

function State.process()

end

function State.handle()

end
