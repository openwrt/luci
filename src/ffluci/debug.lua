module("ffluci.debug", package.seeall)
path = require("ffluci.fs").dirname(debug.getinfo(1, 'S').source:sub(2))