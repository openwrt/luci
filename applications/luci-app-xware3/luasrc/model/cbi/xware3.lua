local fs = require "nixio.fs"
local util = require "nixio.util"

local running=(luci.sys.call("pidof etm_xware > /dev/null") == 0)
local button=""
local xunleiinfo=""
local tblXLInfo={}
local detailInfo = "迅雷远程下载尚未运行。"

if running then
	xunleiinfo = luci.sys.exec("wget http://localhost:19000/getsysinfo -qO-")
        button = "&nbsp;&nbsp;&nbsp;&nbsp;" .. translate("运行状态：") .. xunleiinfo	
	m = Map("xware3", translate("Xware3"), translate("迅雷远程下载 正在运行...") .. button)
	string.gsub(string.sub(xunleiinfo, 2, -2),'[^,]+',function(w) table.insert(tblXLInfo, w) end)
	
	detailInfo = [[<p>启动信息：]] .. xunleiinfo .. [[</p>]]
	if tonumber(tblXLInfo[1]) == 0 then
	  detailInfo = detailInfo .. [[<p>状态正常</p>]]
	else
	  detailInfo = detailInfo .. [[<p style="color:red">执行异常</p>]]
	end
	
	if tonumber(tblXLInfo[2]) == 0 then
	  detailInfo = detailInfo .. [[<p style="color:red">网络异常</p>]]
	else
	  detailInfo = detailInfo .. [[<p>网络正常</p>]]
	end
	
	if tonumber(tblXLInfo[4]) == 0 then
	  detailInfo = detailInfo .. [[<p>未绑定]].. [[&nbsp;&nbsp;激活码：]].. tblXLInfo[5] ..[[</p>]]	  
	else
	  detailInfo = detailInfo .. [[<p>已绑定</p>]]
	end

	if tonumber(tblXLInfo[6]) == 0 then
	  detailInfo = detailInfo .. [[<p style="color:red">磁盘挂载检测失败</p>]]
	else
	  detailInfo = detailInfo .. [[<p>磁盘挂载检测成功</p>]]
	end	
else
	m = Map("xware3", "Xware3", "[迅雷远程下载 尚未启动]")
end

-----------
--Xware--
-----------

s = m:section(TypedSection, "xware3_general","Xware基本设置")
s.anonymous = true

s:option(Flag, "enabled", "启用 迅雷远程下载")

if not nixio.fs.access("/usr/bin/etm_xware") then
s:option(Value, "prog_path", "Xware3主程序路径", "<br />Xware3主程序所在路径，例如：/mnt/sda1/xware3。请确认已经将Xware3的主程序etm_xware复制到该目录下。")
end

if running then
	s:option(DummyValue,"opennewwindow" ,"<br /><p align=\"justify\"><script type=\"text/javascript\"></script><input type=\"button\" class=\"cbi-button cbi-button-apply\" value=\"获取启动信息\" onclick=\"window.open('http://'+window.location.host+':19000/getsysinfo')\" /></p>", detailInfo)


	s:option(DummyValue,"opennewwindow" ,"<br /><p align=\"justify\"><script type=\"text/javascript\"></script><input type=\"button\" class=\"cbi-button cbi-button-apply\" value=\"迅雷远程下载页面\" onclick=\"window.open('http://yuancheng.xunlei.com')\" /></p>", "将激活码填进网页即可绑定。")
end

s = m:section(TypedSection, "xware3_mount","Xware挂载点","请在此设置Xware3下载目录所在的“挂载点”。")
s.anonymous = true

local devices = {}
util.consume((fs.glob("/mnt/sd??*")), devices)

device = s:option(DynamicList, "available_mounts", "挂载点")
for i, dev in ipairs(devices) do
	device:value(dev)
end

s = m:section(TypedSection, "xware3_mount","Xware配置文件","编辑Xware3配置文件")
s.anonymous = true

editconf = s:option(Value, "_editconf", "")
editconf.template = "cbi/tvalue"
editconf.rows = 20
editconf.wrap = "off"

function editconf.cfgvalue(self, section)
	return fs.readfile("/etc/xware3.ini") or ""
end
function editconf.write(self, section, value3)
	if value3 then
		value3 = value3:gsub("\r\n?", "\n")
		fs.writefile("/tmp/xware_cfg_tmp", value3)
		if (luci.sys.call("cmp -s /tmp/xware_cfg_tmp /etc/xware3.ini") == 1) then
			fs.writefile("/etc/xware3.ini", value3)
		end
		fs.remove("/tmp/xware_cfg_tmp")
	end
end

return m

