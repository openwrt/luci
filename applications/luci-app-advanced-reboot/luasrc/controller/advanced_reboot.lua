-- Copyright 2017-2018 Stan Grishin <stangri@melmac.net>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.advanced_reboot", package.seeall)

devices = {
  -- deviceName, boardName, partition1, partition2, offset, envVar1, envVar1Value1, envVar1Value2, envVar2, envVar2Value1, envVar2Value2
  {"Linksys EA3500", "linksys-audi", "mtd3", "mtd5", 32, "boot_part", 1, 2, "bootcmd", "run nandboot", "run altnandboot"},
  {"Linksys E4200v2/EA4500", "linksys-viper", "mtd3", "mtd5", 32, "boot_part", 1, 2, "bootcmd", "run nandboot", "run altnandboot"},
  {"Linksys EA6350v3", "linksys-ea6350v3", "mtd10", "mtd12", 192, "boot_part", 1, 2},
  {"Linksys EA8500", "ea8500", "mtd13", "mtd15", 32, "boot_part", 1, 2},
--  {"Linksys EA9500", "linksys-panamera", "mtd3", "mtd6", 28, "boot_part", 1, 2},
  {"Linksys WRT1200AC", "linksys-caiman", "mtd4", "mtd6", 32, "boot_part", 1, 2, "bootcmd", "run nandboot", "run altnandboot"},
  {"Linksys WRT1900AC", "linksys-mamba", "mtd4", "mtd6", 32, "boot_part", 1, 2, "bootcmd", "run nandboot", "run altnandboot"},
  {"Linksys WRT1900ACv2", "linksys-cobra", "mtd4", "mtd6", 32, "boot_part", 1, 2, "bootcmd", "run nandboot", "run altnandboot"},
  {"Linksys WRT1900ACS", "linksys-shelby", "mtd4", "mtd6", 32, "boot_part", 1, 2, "bootcmd", "run nandboot", "run altnandboot"},
  {"Linksys WRT3200ACM", "linksys-rango", "mtd5", "mtd7", 32, "boot_part", 1, 2, "bootcmd", "run nandboot", "run altnandboot"},
  {"Linksys WRT32X", "linksys-venom", "mtd5", "mtd7", nil, "boot_part", 1, 2, "bootcmd", "run nandboot", "run altnandboot"},
  {"ZyXEL NBG6817","nbg6817","mmcblk0p4","mmcblk0p7", 32, nil, 255, 1}
}

errorMessage = nil
rom_board_name = luci.util.trim(luci.sys.exec("cat /tmp/sysinfo/board_name"))
for i=1, #devices do
  device_board_name = devices[i][2]:gsub('%p','')
  if rom_board_name and rom_board_name:gsub('%p',''):match(device_board_name) then
    device_name = devices[i][1]
    partition_one_mtd = devices[i][3] or nil
    partition_two_mtd = devices[i][4] or nil
    partition_skip = devices[i][5] or nil
    boot_envvar1 = devices[i][6] or nil
    boot_envvar1_partition_one = tonumber(devices[i][7]) or nil
    boot_envvar1_partition_two = tonumber(devices[i][8]) or nil
    boot_envvar2 = devices[i][9] or nil
    boot_envvar2_partition_one = devices[i][10] or nil
    boot_envvar2_partition_two = devices[i][11] or nil
    if partition_one_mtd and partition_skip then
      partition_one_label = luci.util.trim(luci.sys.exec("dd if=/dev/" .. partition_one_mtd .. " bs=1 skip=" .. partition_skip .. " count=128" .. "  2>/dev/null"))
      n, partition_one_version = string.match(partition_one_label, '(Linux)-([%d|.]+)')
    end
    if partition_two_mtd and partition_skip then
      partition_two_label = luci.util.trim(luci.sys.exec("dd if=/dev/" .. partition_two_mtd .. " bs=1 skip=" .. partition_skip .. " count=128" .. "  2>/dev/null"))
      n, partition_two_version = string.match(partition_two_label, '(Linux)-([%d|.]+)')
    end
    if partition_one_label and string.find(partition_one_label, "LEDE") then partition_one_os = "LEDE" end
    if partition_one_label and string.find(partition_one_label, "OpenWrt") then partition_one_os = "OpenWrt" end
    if partition_one_label and string.find(partition_one_label, "Linksys") then partition_one_os = "Linksys" end
    if partition_two_label and string.find(partition_two_label, "LEDE") then partition_two_os = "LEDE" end
    if partition_two_label and string.find(partition_two_label, "OpenWrt") then partition_two_os = "OpenWrt" end
    if partition_two_label and string.find(partition_two_label, "Linksys") then partition_two_os = "Linksys" end
    if device_name and device_name == "ZyXEL NBG6817" then
      if not partition_one_os then partition_one_os = "ZyXEL" end
      if not partition_two_os then partition_two_os = "ZyXEL" end
    end
    if device_name and device_name == "Linksys WRT32X" then
      if not partition_one_os then partition_one_os = "Unknown/Compressed" end
      if not partition_two_os then partition_two_os = "Unknown/Compressed" end
    end
    if not partition_one_os then partition_one_os = "Unknown" end
    if not partition_two_os then partition_two_os = "Unknown" end
    if partition_one_os and partition_one_version then partition_one_os = partition_one_os .. " (Linux " .. partition_one_version .. ")" end
    if partition_two_os and partition_two_version then partition_two_os = partition_two_os .. " (Linux " .. partition_two_version .. ")" end

    if device_name and device_name == "ZyXEL NBG6817" then
      if not zyxelFlagPartition then zyxelFlagPartition = luci.util.trim(luci.sys.exec("source /lib/functions.sh; find_mtd_part 0:DUAL_FLAG")) end
      if not zyxelFlagPartition then
        errorMessage = errorMessage or "" .. luci.i18n.translate("Unable to find Dual Boot Flag Partition." .. " ")
        luci.util.perror(luci.i18n.translate("Unable to find Dual Boot Flag Partition."))
      else
        current_partition = tonumber(luci.sys.exec("dd if=" .. zyxelFlagPartition .. " bs=1 count=1 2>/dev/null | hexdump -n 1 -e '1/1 \"%d\"'"))
      end
    else
      if nixio.fs.access("/usr/sbin/fw_printenv") and nixio.fs.access("/usr/sbin/fw_setenv") then
        current_partition = tonumber(luci.util.trim(luci.sys.exec("/usr/sbin/fw_printenv -n " .. boot_envvar1)))
      end
    end
    other_partition = current_partition == boot_envvar1_partition_two and boot_envvar1_partition_one or boot_envvar1_partition_two
  end
end

function index()
  entry({"admin", "system", "advanced_reboot"}, template("advanced_reboot/advanced_reboot"), _("Advanced Reboot"), 90)
  entry({"admin", "system", "advanced_reboot", "reboot"}, post("action_reboot"))
  entry({"admin", "system", "advanced_reboot", "alternative_reboot"}, post("action_altreboot"))
  entry({"admin", "system", "advanced_reboot", "power_off"}, post("action_poweroff"))
end

function action_reboot()
  local uci = require "luci.model.uci".cursor()
  luci.template.render("admin_system/applyreboot", {
        title = luci.i18n.translate("Rebooting..."),
        msg   = luci.i18n.translate("The system is rebooting now.<br /> DO NOT POWER OFF THE DEVICE!<br /> Wait a few minutes before you try to reconnect. It might be necessary to renew the address of your computer to reach the device again, depending on your settings."),
        addr  = luci.ip.new(uci:get("network", "lan", "ipaddr")) or "192.168.1.1"
      })
  luci.sys.reboot()
end

function action_altreboot()
  local uci = require "luci.model.uci".cursor()
  local zyxelFlagPartition, zyxelBootFlag, zyxelNewBootFlag, errorCode, curEnvSetting, newEnvSetting
  errorMessage = nil
  errorCode = 0
  if luci.http.formvalue("cancel") then
    luci.http.redirect(luci.dispatcher.build_url('admin/system/advanced_reboot'))
    return
  end
  local step = tonumber(luci.http.formvalue("step") or 1)
  if step == 1 then
    if device_name and nixio.fs.access("/usr/sbin/fw_printenv") and nixio.fs.access("/usr/sbin/fw_setenv") then
      luci.template.render("advanced_reboot/alternative_reboot",{})
    else
      luci.template.render("advanced_reboot/advanced_reboot",{errorMessage = luci.i18n.translate("No access to fw_printenv or fw_printenv!")})
    end
  elseif step == 2 then
    if boot_envvar1 or boot_envvar2 then -- Linksys devices
      if boot_envvar1 then
        curEnvSetting = tonumber(luci.util.trim(luci.sys.exec("/usr/sbin/fw_printenv -n " .. boot_envvar1)))
        if not curEnvSetting then
          errorMessage = errorMessage .. luci.i18n.translate("Unable to obtain firmware environment variable") .. ": " .. boot_envvar1 .. ". "
          luci.util.perror(luci.i18n.translate("Unable to obtain firmware environment variable") .. ": " .. boot_envvar1 .. ".")
        else
          newEnvSetting = curEnvSetting == boot_envvar1_partition_one and boot_envvar1_partition_two or boot_envvar1_partition_one
          errorCode = luci.sys.call("/usr/sbin/fw_setenv " .. boot_envvar1 .. " " .. newEnvSetting)
            if errorCode ~= 0 then
              errorMessage = errorMessage or "" .. luci.i18n.translate("Unable to set firmware environment variable") .. ": " .. boot_envvar1 .. " " .. luci.i18n.translate("to") .. " " .. newEnvSetting .. ". "
              luci.util.perror(luci.i18n.translate("Unable to set firmware environment variable") .. ": " .. boot_envvar1 .. " " .. luci.i18n.translate("to") .. " " .. newEnvSetting .. ".")
            end
        end
      end
      if boot_envvar2 then
        curEnvSetting = luci.util.trim(luci.sys.exec("/usr/sbin/fw_printenv -n " .. boot_envvar2))
        if not curEnvSetting then
          errorMessage = errorMessage or "" .. luci.i18n.translate("Unable to obtain firmware environment variable") .. ": " .. boot_envvar2 .. ". "
          luci.util.perror(luci.i18n.translate("Unable to obtain firmware environment variable") .. ": " .. boot_envvar2 .. ".")
        else
          newEnvSetting = curEnvSetting == boot_envvar2_partition_one and boot_envvar2_partition_two or boot_envvar2_partition_one
          errorCode = luci.sys.call("/usr/sbin/fw_setenv " .. boot_envvar2 .. " '" .. newEnvSetting .. "'")
          if errorCode ~= 0 then
            errorMessage = errorMessage or "" .. luci.i18n.translate("Unable to set firmware environment variable") .. ": " .. boot_envvar2 .. " " .. luci.i18n.translate("to") .. " " .. newEnvSetting .. ". "
            luci.util.perror(luci.i18n.translate("Unable to set firmware environment variable") .. ": " .. boot_envvar2 .. " " .. luci.i18n.translate("to") .. " " .. newEnvSetting .. ".")
          end
        end
      end
    else -- NetGear device
      if not zyxelFlagPartition then zyxelFlagPartition = luci.util.trim(luci.sys.exec("source /lib/functions.sh; find_mtd_part 0:DUAL_FLAG")) end
      if not zyxelFlagPartition then
        errorMessage = errorMessage .. luci.i18n.translate("Unable to find Dual Boot Flag Partition." .. " ")
        luci.util.perror(luci.i18n.translate("Unable to find Dual Boot Flag Partition."))
      else
        zyxelBootFlag = tonumber(luci.sys.exec("dd if=" .. zyxelFlagPartition .. " bs=1 count=1 2>/dev/null | hexdump -n 1 -e '1/1 \"%d\"'"))
        zyxelNewBootFlag = zyxelBootFlag and zyxelBootFlag == 1 and "\\xff" or "\\x01"
        if zyxelNewBootFlag then
          errorCode = luci.sys.call("printf \"" .. zyxelNewBootFlag .. "\" >" .. zyxelFlagPartition )
          if errorCode ~= 0 then
            errorMessage = errorMessage or "" .. luci.i18n.translate("Unable to set Dual Boot Flag Partition entry for partition") .. ": " .. zyxelFlagPartition .. ". "
            luci.util.perror(luci.i18n.translate("Unable to set Dual Boot Flag Partition entry for partition") .. ": " .. zyxelFlagPartition .. ".")
          end
        end
      end
    end
    if not errorMessage then
      luci.template.render("admin_system/applyreboot", {
            title = luci.i18n.translate("Rebooting..."),
            msg   = luci.i18n.translate("The system is rebooting to an alternative partition now.<br /> DO NOT POWER OFF THE DEVICE!<br /> Wait a few minutes before you try to reconnect. It might be necessary to renew the address of your computer to reach the device again, depending on your settings."),
            addr  = luci.ip.new(uci:get("network", "lan", "ipaddr")) or "192.168.1.1"
          })
      luci.sys.reboot()
    else
      luci.template.render("advanced_reboot/advanced_reboot",{
        rom_board_name=rom_board_name,
        device_name=device_name,
        boot_envvar1_partition_one=boot_envvar1_partition_one,
        partition_one_os=partition_one_os,
        boot_envvar1_partition_two=boot_envvar1_partition_two,
        partition_two_os=partition_two_os,
        current_partition=current_partition,
        errorMessage = errorMessage})
    end
  end
end

function action_poweroff()
  local uci = require "luci.model.uci".cursor()
  if luci.http.formvalue("cancel") then
    luci.http.redirect(luci.dispatcher.build_url('admin/system/advanced_reboot'))
    return
  end
  local step = tonumber(luci.http.formvalue("step") or 1)
  if step == 1 then
    if nixio.fs.access("/sbin/poweroff") then
      luci.template.render("advanced_reboot/power_off",{})
    else
      luci.template.render("advanced_reboot/advanced_reboot",{})
    end
  elseif step == 2 then
    luci.template.render("admin_system/applyreboot", {
          title = luci.i18n.translate("Shutting down..."),
          msg   = luci.i18n.translate("The system is shutting down now.<br /> DO NOT POWER OFF THE DEVICE!<br /> It might be necessary to renew the address of your computer to reach the device again, depending on your settings."),
          addr  = luci.ip.new(uci:get("network", "lan", "ipaddr")) or "192.168.1.1"
        })
    luci.sys.call("/sbin/poweroff")
  end
end
