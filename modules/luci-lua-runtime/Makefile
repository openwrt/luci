#
# Copyright (C) 2022 Jo-Philipp Wich <jo@mein.io>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-lua-runtime

LUCI_TYPE:=mod
LUCI_BASENAME:=lua-runtime

LUCI_TITLE:=LuCI Lua runtime libraries
LUCI_DEPENDS:= \
	+luci-base \
	+lua \
	+luci-lib-base \
	+luci-lib-nixio \
	+luci-lib-ip \
	+luci-lib-jsonc \
	+libubus-lua \
	+liblucihttp-lua \
	+ucode-mod-lua

PKG_LICENSE:=Apache-2.0

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
