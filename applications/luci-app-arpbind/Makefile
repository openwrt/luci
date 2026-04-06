# SPDX-License-Identifier: Apache-2.0
#
# Copyright (C) 2015 GuoGuo <gch981213@gmail.com>
# Copyright (C) 2025 ImmortalWrt.org

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for ARP binding
LUCI_DEPENDS:=+ip

define Package/luci-app-arpbind/conffiles
/etc/config/arpbind
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
