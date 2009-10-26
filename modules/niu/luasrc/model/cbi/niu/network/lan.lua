local d = Delegator()
d.allow_finish = true
d.allow_back = true
d.allow_cancel = true

d:add("lan1", load("niu/network/lan1"))

return d