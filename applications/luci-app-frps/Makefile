# This is free software, licensed under the Apache License, Version 2.0

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI Support for frp server
LUCI_DEPENDS:=+luci-base +frps
LUCI_EXTRA_DEPENDS:=frps (>=0.71.0-r2)

PKG_LICENSE:=Apache-2.0

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
