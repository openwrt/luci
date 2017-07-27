# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-attendedsysupgrade
PKG_VERSION:=0.1
PKG_RELEASE:=1
PKG_LICENSE:=GPL-2.0

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-attendedsysupgrade
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  MAINTAINER:=Paul Spooren <paul@spooren.de>
  TITLE:=Enables easy Sysupgrades via Luci
  DEPENDS:= +luci-base +rpcd-mod-attendedsysupgrade
endef

define Package/luci-app-attendedsysupgrade/description
	add entry to tab "system" to perform a simple oneclick sysupgrade
endef

define Build/Compile
endef

define Build/Configure
endef

define Package/luci-app-attendedsysupgrade/install
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/view/
	$(INSTALL_BIN) ./files/attendedsysupgrade.htm $(1)/usr/lib/lua/luci/view/attendedsysupgrade.htm

	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/controller/
	$(INSTALL_BIN) ./files/attendedsysupgrade.lua $(1)/usr/lib/lua/luci/controller/attendedsysupgrade.lua
endef

$(eval $(call BuildPackage,luci-app-attendedsysupgrade))
