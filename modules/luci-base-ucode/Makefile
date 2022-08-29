#
# Copyright (C) 2022 Jo-Philipp Wich <jo@mein.io>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-base-ucode

LUCI_TYPE:=mod
LUCI_BASENAME:=base-ucode

LUCI_TITLE:=LuCI core ucode runtime
LUCI_DEPENDS:=\
	+luci-base \
	+ucode \
	+ucode-mod-fs \
	+ucode-mod-uci \
	+ucode-mod-ubus \
	+ucode-mod-math \
	+ucode-mod-lua \
	+ucode-mod-html \
	+rpcd-mod-ucode \
	+liblucihttp-ucode

PKG_LICENSE:=MIT

define Package/luci-base-ucode/postinst
#!/bin/sh

if [ -z "$${PKG_INSTROOT}" ] && [ -f /etc/config/uhttpd ]; then
	if ! uci -q get uhttpd.main.ucode_prefix | grep -sq /cgi-bin/luci-ucode; then
		uci add_list uhttpd.main.ucode_prefix='/cgi-bin/luci-ucode=/usr/share/ucode/luci/uhttpd.uc'
		uci commit uhttpd
		service uhttpd reload
	fi
fi

exit 0
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
