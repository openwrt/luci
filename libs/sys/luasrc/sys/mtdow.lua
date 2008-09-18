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

WRITE_IMAGE = 0
WRITE_COMBINED = 1
WRITE_EMULATED = 2

ERROR_INTERNAL = 1
ERROR_NOTFOUND = 2
ERROR_RESOURCE = 3
ERROR_NODETECT = 4
ERROR_NOTAVAIL = 5
ERROR_NOSTREAM = 6
ERROR_INVMAGIC = 7

Writer = util.class()

-- x86
EmulatedWriter = util.class(Writer)
EmulatedWriter.blocks = {
	image = {
		magic = "eb48",
		device = "/dev/hda",
		write = WRITE_EMULATED
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

-- Broadcom
CFEWriter = util.class(Writer)
CFEWriter.blocks = {
	image = {
		magic = {"4844", "5735"},
		device = "linux",
		write = WRITE_IMAGE
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

-- Auto Detect
function native_writer()
	local w = Writer()
	
	-- Detect amd64 / x86
	local x86 = {"x86_64", "i386", "i486", "i586", "i686"}
	if util.contains(x86, posix.uname("%m")) then
		return EmulatedWriter()
	end
	
	-- Detect CFE
	if w:_find_mtdblock("cfe") and w:_find_mtdblock("linux") then
		return CFEWriter()
	end
	
	-- Detect Redboot
	if w:_find_mtdblock("RedBoot") and w:_find_mtdblock("vmlinux.bin.l7") then
		return RedWriter()
	end
	
	-- Detect MagicBox
	if fs.readfile("/proc/cpuinfo"):find("MagicBox") then
	 	return CommonWriter() 
	end
end



Writer.MTD = "/sbin/mtd"
Writer.SAFEMTD = "/tmp/mtd"
Writer.IMAGEFIFO = "/tmp/mtdimage.fifo"

function Writer.write_block(self, name, imagestream, appendfile)
	assert(self.blocks[name], ERROR_NOTFOUND)
	local block = self.blocks[name]
	local device = block.device
	device = fs.stat(device) and device or self:_find_mtdblock(device)
	assert(device, ERROR_NODETECT)
	if block.magic then
		imagestream = self:_check_magic(imagestream, block.magic)
	end
	assert(imagestream, ERROR_INVMAGIC)
	
	if appendfile then
		if block.write == WRITE_COMBINED then
			return (self:_write_combined(device, imagestream, appendfile) == 0)
		elseif block.write == WRITE_EMULATED then
			return (self:_write_emulated(device, imagestream, appendfile) == 0)
		else
			error(ERROR_NOTAVAIL)
		end
	else
		return (self:_write_memory(device, imagestream) == 0)
	end
end

function Writer._check_magic(self, imagestream, magic)
	magic = type(magic) == "table" and magic or {magic}
	
	local block = imagestream()
	assert(block, ERROR_NOSTREAM)
	local cm = "%x%x" % {block:byte(1), block:byte(2)}
	
	if util.contains(magic, cm) then
		return ltn12.source.cat(ltn12.source.string(block), imagestream)
	end
end

function Writer._find_mtdblock(self, mtdname)
	local k
	local prefix = "/dev/mtd"
	prefix = prefix .. (fs.stat(prefix) and "/" or "")
	
	for l in io.lines("/proc/mtd") do
		local k = l:match('mtd([%%w-_]+):.*"%s"' % mtdname)
		if k then return prefix..k end
	end
end

function Writer._write_emulated(self, devicename, imagestream, appendfile)
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
	local imageproc = posix.fork()
	assert(imageproc ~= -1, ERROR_RESOURCE)
	if imageproc == 0 then
		fs.unlink(self.IMAGEFIFO)
		assert(posix.mkfifo(self.IMAGEFIFO), ERROR_RESOURCE)
		local imagefifo = io.open(self.IMAGEFIFO, "w")
		assert(imagefifo, ERROR_RESOURCE)
		ltn12.pump.all(imagestream, ltn12.sink.file(imagefifo))
		os.exit(0)
	end
	
	return os.execute( 
		"%s write '%s' '%s' >/dev/null 2>&1" % {
		self.MTD, self.IMAGEFIFO, devicename
		}
	)	
end

function Writer._write_combined(self, devicename, imagestream, appendfile)
	local imageproc = posix.fork()
	assert(imageproc ~= -1, ERROR_RESOURCE)
	if imageproc == 0 then
		fs.unlink(self.IMAGEFIFO)
		assert(posix.mkfifo(self.IMAGEFIFO), ERROR_RESOURCE)
		local imagefifo = io.open(self.IMAGEFIFO, "w")
		assert(imagefifo, ERROR_RESOURCE)
		ltn12.pump.all(imagestream, ltn12.sink.file(imagefifo))
		os.exit(0)
	end
	
	return os.execute( 
		"%s -j '%s' write '%s' '%s' >/dev/null 2>&1" % {
			self.MTD, appendfile, self.IMAGEFIFO, devicename
		}
	)
end

function Writer._refresh_block(self, devicename)
	return os.execute("%s refresh '%s' >/dev/null 2>&1" % {self.MTD, devicename})
end

function Writer._append(self, devicename, appendfile, erase)
	erase = erase and ("-e '%s' " % devicename) or ''
	
	return os.execute( 
		"%s %s jffs2write '%s' '%s' >/dev/null 2>&1" % {
			self.MTD, erase, appendfile, devicename
		}
	)
end