-- Copyright 2017 Stan Grishin <stangri@melmac.net>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.advanced_reboot", package.seeall)

-- device, board_name, part1, part2, offset, env_var_1, value_1_1, value_1_2, env_var_2, value_2_1, value_2_2
devices = {
  {"Linksys WRT1200AC", "armada-385-linksys-caiman", "mtd4", "mtd6", 32, "boot_part", 1, 2, "bootcmd", "run nandboot", "run altnandboot"},
  {"Linksys WRT1900AC", "armada-xp-linksys-mamba", "mtd4", "mtd6", 32, "boot_part", 1, 2, "bootcmd", "run nandboot", "run altnandboot"},
  {"Linksys WRT1900ACv2", "armada-385-linksys-cobra", "mtd4", "mtd6", 32, "boot_part", 1, 2, "bootcmd", "run nandboot", "run altnandboot"},
  {"Linksys WRT1900ACS", "armada-385-linksys-shelby", "mtd4", "mtd6", 32, "boot_part", 1, 2, "bootcmd", "run nandboot", "run altnandboot"},
  {"Linksys WRT3200ACM", "armada-385-linksys-rango", "mtd5", "mtd7", 32, "boot_part", 1, 2, "bootcmd", "run nandboot", "run altnandboot"},
  {"Linksys E4200v2/EA4500", "linksys-viper", "mtd3", "mtd5", 32, "boot_part", 1, 2, "bootcmd", "run nandboot", "run altnandboot"},
  {"Linksys EA8500", "ea8500", "mtd13", "mtd15", 32, "boot_part", 1, 2}
}

board_name = luci.util.trim(luci.sys.exec("cat /tmp/sysinfo/board_name"))
for i=1, #devices do
  if board_name and devices[i][2] == board_name then
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
      partition_one_label = luci.util.trim(luci.sys.exec("dd if=/dev/" .. partition_one_mtd .. " bs=1 skip=" .. partition_skip .. " count=25" .. "  2>/dev/null"))
      n, partition_one_version = string.match(partition_one_label, '(Linux)-([%d|.]+)')
    end
    if partition_two_mtd and partition_skip then
      partition_two_label = luci.util.trim(luci.sys.exec("dd if=/dev/" .. partition_two_mtd .. " bs=1 skip=" .. partition_skip .. " count=25" .. "  2>/dev/null"))
      n, partition_two_version = string.match(partition_two_label, '(Linux)-([%d|.]+)')
    end
    if string.find(partition_one_label, "LEDE") then partition_one_os = "LEDE" end
    if string.find(partition_one_label, "OpenWrt") then partition_one_os = "OpenWrt" end
    if string.find(partition_one_label, "Linksys") then partition_one_os = "Linksys" end
    if string.find(partition_two_label, "LEDE") then partition_two_os = "LEDE" end
    if string.find(partition_two_label, "OpenWrt") then partition_two_os = "OpenWrt" end
    if string.find(partition_two_label, "Linksys") then partition_two_os = "Linksys" end
    if not partition_one_os then partition_one_os = "Unknown" end
    if not partition_two_os then partition_two_os = "Unknown" end
    if partition_one_os and partition_one_version then partition_one_os = partition_one_os .. " (Linux " .. partition_one_version .. ")" end
    if partition_two_os and partition_two_version then partition_two_os = partition_two_os .. " (Linux " .. partition_two_version .. ")" end
    if nixio.fs.access("/usr/sbin/fw_printenv") and nixio.fs.access("/usr/sbin/fw_setenv") then
      current_partition = tonumber(luci.util.trim(luci.sys.exec("/usr/sbin/fw_printenv -n " .. boot_envvar1)))
      other_partition = current_partition == boot_envvar1_partition_one and boot_envvar1_partition_two or boot_envvar1_partition_one
    end
  end
end

function index()
  entry({"admin", "system", "advanced_reboot"}, template("advanced_reboot/advanced_reboot"), _("Advanced Reboot"), 90)
  entry({"admin", "system", "advanced_reboot", "reboot"}, post("action_reboot"))
--  if device_name then entry({"admin", "system", "advanced_reboot", "altreboot"}, post("action_altreboot")) end
  entry({"admin", "system", "advanced_reboot", "alternative_reboot"}, post("action_altreboot"))
  entry({"admin", "system", "advanced_reboot", "power_off"}, post("action_poweroff"))
end

function action_reboot()
  luci.template.render("admin_system/applyreboot", {
        title = luci.i18n.translate("Rebooting..."),
        msg   = luci.i18n.translate("The system is rebooting now.<br /> DO NOT POWER OFF THE DEVICE!<br /> Wait a few minutes before you try to reconnect. It might be necessary to renew the address of your computer to reach the device again, depending on your settings."),
        addr  = luci.ip.new(uci.cursor():get("network", "lan", "ipaddr")) or "192.168.1.1"
      })
  luci.sys.reboot()
end

function action_altreboot()
  if luci.http.formvalue("cancel") then
    luci.http.redirect(luci.dispatcher.build_url('admin/system/advanced_reboot'))
    return
  end
  local step = tonumber(luci.http.formvalue("step") or 1)
  if step == 1 then
    if device_name and nixio.fs.access("/usr/sbin/fw_printenv") and nixio.fs.access("/usr/sbin/fw_setenv") then
      luci.template.render("advanced_reboot/alternative_reboot",{})
    else
      luci.template.render("advanced_reboot/advanced_reboot",{})
    end
  elseif step == 2 then
    luci.template.render("admin_system/applyreboot", {
          title = luci.i18n.translate("Rebooting..."),
          msg   = luci.i18n.translate("The system is rebooting to an alternative partition now.<br /> DO NOT POWER OFF THE DEVICE!<br /> Wait a few minutes before you try to reconnect. It might be necessary to renew the address of your computer to reach the device again, depending on your settings."),
          addr  = luci.ip.new(uci.cursor():get("network", "lan", "ipaddr")) or "192.168.1.1"
        })
    if boot_envvar1 then env1 = tonumber(luci.util.trim(luci.sys.exec("/usr/sbin/fw_printenv -n " .. boot_envvar1))) end
    if boot_envvar2 then env2 = luci.util.trim(luci.sys.exec("/usr/sbin/fw_printenv -n " .. boot_envvar2)) end
    if env1 and env1 == boot_envvar1_partition_one then luci.sys.call("/usr/sbin/fw_setenv " .. boot_envvar1 .. " " .. boot_envvar1_partition_two) end
    if env1 and env1 == boot_envvar1_partition_two then luci.sys.call("/usr/sbin/fw_setenv " .. boot_envvar1 .. " " .. boot_envvar1_partition_one) end
    if env2 and env2 == boot_envvar2_partition_one then luci.sys.call("/usr/sbin/fw_setenv " .. boot_envvar2 .. " '" .. boot_envvar2_partition_two .. "'") end
    if env2 and env2 == boot_envvar2_partition_two then luci.sys.call("/usr/sbin/fw_setenv " .. boot_envvar2 .. " '" .. boot_envvar2_partition_one .. "'") end
    luci.sys.reboot()
  end
end

function action_poweroff()
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
          addr  = luci.ip.new(uci.cursor():get("network", "lan", "ipaddr")) or "192.168.1.1"
        })
    luci.sys.call("/sbin/poweroff")
  end
end
