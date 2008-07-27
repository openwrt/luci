module("luci.lpk.core", package.seeall)
require("luci.util")

Task = luci.util.class()

function Task.__init__(self, machine, register, start)
	self.machine = machine

	-- The queue that has to be processed
	self.work = {start}
	
	-- The queue that has to be processed in case of rollback
	self.done = {}
	
	-- The Task register
	self.register = register
end

function Task.rollback(self)
	if #self.done < 1 then
		return false
	end
	
	local state = table.remove(self.done)
	local ret, err = pcall(state.rollback, state, self.register)
	
	if ret then
		return true
	else
		return false, err
	end
end

function Task.step(self)
	local state = table.remove(self.work)
	local ret, next = pcall(state.process, state, self.register)
	
	if ret then
		if next then
			local nstate = self.machine:state(next)
			if nstate then
				table.insert(self.work, state)
				table.insert(self.work, nstate)
			else
				self.register.error = "Unknown state: " .. next
				return false
			end
		else
			table.insert(self.done, state)
		end
		
		return #self.work > 0 
	else
		self.register.error = next
		return false
	end
end

function Task.perform(self)
	while self:step() do
	end
	
	if not self.register.error then
		return true
	else
		local stat, err
		repeat
			stat, err = self:rollback()
		until not stat
		
		assert(not err, "Machine broken!")
		
		return false, self.register.error
	end	
end


Machine = luci.util.class()

function Machine.__init__(self, namespace)
	self.namespace = namespace or _NAME
end

function Machine.state(self, name)
	local ret, state = pcall(require, self.namespace .. "." .. name)
	return ret and state
end

function Machine.task(self, name, ...)
	local start = self:state(name)
	
	if not start or not start.entry then
		error("No such command: " .. name)
	end
	
	local register = {}
	
	if start:entry(register) then
		return Task(self, register, start)
	else
		return nil, register.error
	end
end 
