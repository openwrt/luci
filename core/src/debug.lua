module("luci.debug", package.seeall)
__file__ = debug.getinfo(1, 'S').source:sub(2)