#
# Copyright 2019 Telco Antennas Pty Ltd <nicholas.smith@telcoantennas.com.au>
# SPDX-License-Identifier: Apache-2.0
#

include $(TOPDIR)/rules.mk

# LUCI_TITLE:=Support for ModemManager
# LUCI_DEPENDS:=+modemmanager
#
# include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature


PKG_NAME:=luci-proto-modemmanager
PKG_RELEASE:=1

PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/luci-proto-modemmanager
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=5. Protocols
  TITLE:= Support for ModemManager
  DEPENDS:=+modemmanager
endef

define Package/luci-proto-openconnect/description
	luci protocol interface for ModemManager
endef


define Build/Prepare
endef

define Build/Configure
endef

define Build/Compile
endef


$(eval $(call BuildPackage,luci-proto-modemmanager))
