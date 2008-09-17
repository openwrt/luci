--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local io = require "io"
local os = require "os"
local fs = require "luci.fs"
local util = require "luci.util"
local ltn12 = require "luci.ltn12"
local posix = require "posix"

local type, assert, error = type, assert, error

module "luci.sys.mtdow"

local WRITE_IMAGE = 0
local WRITE_COMBINED = 1
local WRITE_EMULATED = 2

Writer = util.class()

-- x86
EmulatedWriter = util.class(Writer)
EmulatedWriter.blocks = {
	image = {
		magic = "eb48",
		device = "/dev/hda",
		write = WRITE_SEPARATELY
	}
}

-- Broadcom
TRXWriter = util.class(Writer)
TRXWriter.blocks = {
	image = {
		magic = {"4844", "5735"},
		device = "linux",
		write = WRITE_COMBINED
	}
}

-- Magicbox
CommonWriter = util.class(Writer)
CommonWriter.blocks = {
	image = {
		device = "linux",
		write = WRITE_COMBINED
	}
}

-- Atheros
RedWriter = util.class(Writer)
RedWriter.blocks = {
	kernel = {
		device = "vmlinux.bin.l7",
		write = WRITE_IMAGE
	},
	rootfs = {
		device = "rootfs",
		write = WRITE_COMBINED
	} 
}

function EmulatedWriter.write_block(self, name, imagestream, appendpattern)
	if appendpattern then
		os.execute("grep rootfs /proc/mtd >/dev/null || "
			.. "{ echo /dev/hda2,65536,rootfs > "
			.. "/sys/module/block2mtd/parameters/block2mtd }")
	end
	return Writer.write_block(self, name, imagestream, appendpattern)
end


Writer.MTD = "/sbin/mtd"
Writer.SAFEMTD = "/tmp/mtd"
Writer.IMAGEFIFO = "/tmp/mtdimage.fifo"

function Writer.write_block(self, name, imagestream, appendfile)
	assert(self.blocks[name], "Undefined block: " % name)
	local block = self.blocks[name]
	local device = block.device
	device = fs.stat(device) and device or self:_find_mtdblock(device)
	assert(device, "Unable to determine device file")
	if block.magic then
		imagestream = self:_check_magic(imagestream, block.magic)
	end
	assert(imagestream, "Invalid image file")
	
	if appendfile then
		if block.write == WRITE_COMBINED then
			return (self:_write_combined(device, imagestream, appendfile) == 0)
		elseif block.write == WRITE_EMULATED then
			return (self:_write_emulated(device, imagestream, appendfile) == 0)
		else
			error("Appending is not supported for selected platform.")
		end
	else
		return (self:_write_memory(device, imagestream) == 0)
	end
end

function Writer._check_magic(self, imagestream, magic)
	magic = type(magic) == "table" and magic or {magic}
	
	local block = imagestream()
	assert(block, "Invalid image stream")
	local cm = "%x%x" % {block:byte(1), block:byte(2)}
	
	if util.contains(magic, cm) then
		return ltn12.source.cat(ltn12.source.string(block), imagestream)
	end
end

function Writer._find_mtdblock(self, mtdname)
	local k
	local prefix = "/dev/mtdblock"
	prefix = prefix .. (fs.stat(prefix) and "/" or "")
	
	for l in io.lines("/proc/mtd") do
		local k = l:match('([%w-_]+):.*-"%s"' % mtdname)
		if k then return prefix..k end
	end
end

function Write._write_emulated(self, devicename, imagestream, appendfile)
	local stat = (self:_write_memory(device, imagestream) == 0)
	stat = stat and (self:_refresh_block("rootfs") == 0)
	local squash = self:_find_mtdblock("rootfs_data")
	if squash then
		stat = stat and (self:_append("rootfs_data", imagestream, true) == 0)
	else
		stat = stat and (self:_append("rootfs", imagestream) == 0)
	end
	return stat
end

function Writer._write_memory(self, devicename, imagestream)
	local devicestream = ltn12.sink.file(io.open(devicename, "w"))
	local stat, err = ltn12.pump.all(imagestream, devicestream)
	if stat then
		return os.execute("sync")
	end
end

function Writer._write_combined(self, devicename, imagestream, appendfile)
	assert(fs.copy(self.MTD, self.SAFEMTD), "Unable to copy mtd writer")
	assert(posix.mkfifo(self.IMAGEFIFO), "Unable to create image pipe")
	
	local imagefifo = io.open(self.IMAGEFIFO, "w")
	
	assert(imagefifo, "Unable to open image pipe")
	
	local imageproc = posix.fork()
	assert(imageproc ~= -1, "Unable to fork()")
	if imageproc == 0 then
		ltn12.pump.all(imagestream, ltn12.sink.file(imagefifo))
		os.exit(0)
	end
	
	return os.execute( 
		"%s -j '%s' write '%s' '%s'" % {
			self.SAFEMTD, appendfile, devicename, self.IMAGEFIFO
		}
	)
end

function Writer._refresh_block(self, devicename)
	assert(fs.copy(self.MTD, self.SAFEMTD), "Unable to copy mtd writer")
	return os.execute("%s refresh '%s'" % {self.SAFEMTD, devicename})
end

function Writer._append(self, devicename, appendfile, erase)
	assert(fs.copy(self.MTD, self.SAFEMTD), "Unable to copy mtd writer")
	erase = erase and ("-e '%s' " % devicename) or ''
	
	return os.execute( 
		"%s %s jffs2write '%s' '%s'" % {
			self.SAFEMTD, erase, appendfile, devicename
		}
	)
end