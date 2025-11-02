#
# Copyright (C) 2008-2017 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-privoxy

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Paul Donald <newtwen+github@gmail.com>

LUCI_TITLE:=LuCI Support for Privoxy WEB proxy
LUCI_DEPENDS:=+luci-base +privoxy

define Package/$(PKG_NAME)/config
# shown in make menuconfig <Help>
help
	$(LUCI_TITLE)
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
