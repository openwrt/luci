--[[
    Copyright 2011 Iordan Iordanov <iiordanov (AT) gmail.com>

    This file is part of luci-pbx-voicemail.

    luci-pbx-voicemail is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    luci-pbx-voicemail is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with luci-pbx-voicemail.  If not, see <http://www.gnu.org/licenses/>.
]]--

module("luci.controller.pbx-voicemail", package.seeall)

function index()
        entry({"admin", "services", "pbx", "pbx-voicemail"}, cbi("pbx-voicemail"), "Voicemail", 5)
end
