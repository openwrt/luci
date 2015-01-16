#
# Copyright (C) 2009 Andreas Seidler <tetzlav@subsignal.org>
# Copyright (C) 2012 Jo-Philipp Wich <jow@openwrt.org>
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=freifunk-p2pblock
PKG_RELEASE:=3

PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/freifunk-p2pblock
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=9. Freifunk
  TITLE:=Freifunk p2pblock Addon
  DEPENDS:=+iptables-mod-filter +iptables-mod-ipp2p +l7-protocols +iptables-mod-conntrack-extra
endef

define Package/freifunk-p2pblock/description
  Simple Addon for Freifunk which use iptables layer7-, ipp2p- and recent-modules 
  to block p2p/filesharing traffic
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/freifunk-p2pblock/install
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/freifunk-p2pblock.init $(1)/etc/init.d/freifunk-p2pblock
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DATA) ./files/freifunk-p2pblock.config $(1)/etc/config/freifunk_p2pblock
endef

$(eval $(call BuildPackage,freifunk-p2pblock))
