#
# Copyright (C) 2007-2008 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#
# $Id:$
#
# Author: Michael Geddes

include $(TOPDIR)/rules.mk

PKG_NAME:=zoneinfo
PKG_VERSION:=2009c
PKG_RELEASE:=2

PKG_SOURCE:=tzdata$(PKG_VERSION).tar.gz
PKG_SOURCE_CODE:=tzcode${PKG_VERSION}.tar.gz
PKG_SOURCE_URL:=http://source.icu-project.org/repos/icu/data/trunk/tzdata/mirror/
PKG_MD5SUM:=ec8fa00a07f3e1d598d5d722cc0ab697

include $(INCLUDE_DIR)/package.mk

define Download/tzcode
   FILE=$(PKG_SOURCE_CODE)
   URL=$(PKG_SOURCE_URL)
   MD5SUM=5a6aa9cbf477334f31e427cb59adf72f
endef

$(eval $(call Download,tzcode))

define Package/zoneinfo/default
  SUBMENU:=ZoneInfo
  TITLE:=Zone Information
  SECTION:=luci
  CATEGORY:=LuCI
endef

define Package/zoneinfo-core
$(call Package/zoneinfo/Default)
  TITLE:=Zone Information (core)
endef

define Package/zoneinfo-simple
$(call Package/zoneinfo/Default)
  TITLE:=Zone Information (simple)
endef

define Package/zoneinfo-africa
$(call Package/zoneinfo/Default)
  TITLE:=Zone Information (Africa)
endef

define Package/zoneinfo-northamerica
$(call Package/zoneinfo/Default)
  TITLE:=Zone Information (NorthAmerica)
endef

define Package/zoneinfo-southamerica
$(call Package/zoneinfo/Default)
  TITLE:=Zone Information (SouthAmerica)
endef

define Package/zoneinfo-poles
$(call Package/zoneinfo/Default)
  TITLE:=Zone Information (Arctic, Antarctic)
endef

define Package/zoneinfo-asia
$(call Package/zoneinfo/Default)
  TITLE:=Zone Information (Asia)
endef

define Package/zoneinfo-atlantic
$(call Package/zoneinfo/Default)
  TITLE:=Zone Information (Atlantic)
endef

define Package/zoneinfo-australia-nz
$(call Package/zoneinfo/Default)
  TITLE:=Zone Information (Australia-NZ)
endef

define Package/zoneinfo-pacific
$(call Package/zoneinfo/Default)
  TITLE:=Zone Information (Pacific)
endef

define Package/zoneinfo-europe
$(call Package/zoneinfo/Default)
  TITLE:=Zone Information (Europe)
endef

define Package/zoneinfo-india
$(call Package/zoneinfo/Default)
  TITLE:=Zone Information (India)
endef

define Package/zoneinfo-middleeast
$(call Package/zoneinfo/Default)
  TITLE:=Zone Information (MiddleEast)
endef

define Build/Prepare
	(cd $(PKG_BUILD_DIR) && tar -xzf $(DL_DIR)/$(PKG_SOURCE_CODE) && tar -xzf $(DL_DIR)/$(PKG_SOURCE))
endef

define Build/Compile
	CFLAGS="$(HOST_CFLAGS)" \
	$(MAKE) -C $(PKG_BUILD_DIR) -f Makefile \
		$(HOST_CONFIGURE_OPTS) \
		CC="$(HOSTCC)" \
		LD="\$$$$(CC)" \
		CPPFLAGS="$(HOST_CPPFLAGS)" \
		LDFLAGS="$(HOST_LDFLAGS)" \
		TOPDIR="$(PKG_INSTALL_DIR)" \
		TZDIR="$(PKG_INSTALL_DIR)/zoneinfo" \
		install
endef


define Package/zoneinfo-core/install
	$(INSTALL_DIR) $(1)/usr/share/zoneinfo
	for i in \
		CET CST6CDT EET EST EST5EDT GB-Eire Eire \
		GB    GMT   GMT+0 GMT-0 GMT0  Greenwich  \
		HST   MET   MST   MST7MDT NZ    NZ-CHAT  \
		PRC   PST8PDT ROC ROK     UCT   UTC      \
		Universal W-SU WET Zulu Etc/*  ; do \
	  $(CP) $(PKG_INSTALL_DIR)/zoneinfo/$$$$i \
	      $(1)/usr/share/zoneinfo ; \
	done
endef

define Package/zoneinfo-simple/install
	$(INSTALL_DIR) $(1)/usr/share/zoneinfo
	for i in Pacific/Honolulu     \
		America/Anchorage   America/Los_Angeles America/Denver   \
		America/Chicago     America/New_York    America/Caracas  \
		America/Sao_Paulo   Europe/London       Europe/Paris     \
		Africa/Cairo        Europe/Moscow       Asia/Dubai       \
		Asia/Karachi        Asia/Dhaka          Asia/Bankok      \
		Asia/Hong_Kong      Asia/Tokyo          Australia/Darwin \
		Australia/Adelaide  Australia/Brisbane  Australia/Sydney \
		Australia/Perth     Pacific/Noumea ; do \
	  $(CP) $(PKG_INSTALL_DIR)/zoneinfo/$$$$i \
	      $(1)/usr/share/zoneinfo ; \
	done
endef

define Package/zoneinfo-africa/install
	$(INSTALL_DIR) $(1)/usr/share/zoneinfo/Africa
	$(CP) $(PKG_INSTALL_DIR)/zoneinfo/Africa/* \
	      $(1)/usr/share/zoneinfo/Africa
endef

define Package/zoneinfo-northamerica/install
	$(INSTALL_DIR) $(1)/usr/share/zoneinfo
	for i in US America Canada Mexico Cuba Jamaica Navajo ; do \
	  $(CP) $(PKG_INSTALL_DIR)/zoneinfo/$$$$i \
	      $(1)/usr/share/zoneinfo ; \
	done
	rm  -rf $(1)/usr/share/zoneinfo/America/Argentina
endef

define Package/zoneinfo-southamerica/install
	$(INSTALL_DIR) $(1)/usr/share/zoneinfo
	for i in Brazil Chile ; do \
	  $(CP) $(PKG_INSTALL_DIR)/zoneinfo/$$$$i \
	      $(1)/usr/share/zoneinfo ; \
	done
	$(INSTALL_DIR) $(1)/usr/share/zoneinfo/America/Argentina
	$(CP) $(PKG_INSTALL_DIR)/zoneinfo/America/Argentina/* \
	      $(1)/usr/share/zoneinfo/America/Argentina
endef

define Package/zoneinfo-poles/install
	$(INSTALL_DIR) $(1)/usr/share/zoneinfo
	for i in Antarctica Arctic ; do \
	  $(CP) $(PKG_INSTALL_DIR)/zoneinfo/$$$$i \
	      $(1)/usr/share/zoneinfo ; \
	done
endef

define Package/zoneinfo-asia/install
	$(INSTALL_DIR) $(1)/usr/share/zoneinfo
	for i in Asia Japan Singapore Hongkong ; do \
	  $(CP) $(PKG_INSTALL_DIR)/zoneinfo/$$$$i \
	      $(1)/usr/share/zoneinfo ; \
	done
endef

define Package/zoneinfo-atlantic/install
	$(INSTALL_DIR) $(1)/usr/share/zoneinfo
	for i in Atlantic Iceland ; do \
	  $(CP) $(PKG_INSTALL_DIR)/zoneinfo/$$$$i \
	      $(1)/usr/share/zoneinfo ; \
	done
endef

define Package/zoneinfo-australia-nz/install
	$(INSTALL_DIR) $(1)/usr/share/zoneinfo
	for i in NZ NZ-CHAT Australia ; do \
	  $(CP) $(PKG_INSTALL_DIR)/zoneinfo/$$$$i \
	      $(1)/usr/share/zoneinfo ; \
	done
endef

define Package/zoneinfo-pacific/install
	$(INSTALL_DIR) $(1)/usr/share/zoneinfo
	for i in Pacific Kwajalein ; do \
	  $(CP) $(PKG_INSTALL_DIR)/zoneinfo/$$$$i \
	      $(1)/usr/share/zoneinfo ; \
	done
endef

define Package/zoneinfo-europe/install
	$(INSTALL_DIR) $(1)/usr/share/zoneinfo
	for i in Europe Portugal Poland ; do \
	  $(CP) $(PKG_INSTALL_DIR)/zoneinfo/$$$$i \
	      $(1)/usr/share/zoneinfo ; \
	done
endef


define Package/zoneinfo-india/install
	$(INSTALL_DIR) $(1)/usr/share/zoneinfo
	for i in Indian ; do \
	  $(CP) $(PKG_INSTALL_DIR)/zoneinfo/$$$$i \
	      $(1)/usr/share/zoneinfo ; \
	done
endef

define Package/zoneinfo-middleeast/install
	$(INSTALL_DIR) $(1)/usr/share/zoneinfo
	for i in Egypt Libya Iran Israel Turkey Mideast ; do \
	  $(CP) $(PKG_INSTALL_DIR)/zoneinfo/$$$$i \
	      $(1)/usr/share/zoneinfo ; \
	done
endef

$(eval $(call BuildPackage,zoneinfo-simple))
$(eval $(call BuildPackage,zoneinfo-core))
$(eval $(call BuildPackage,zoneinfo-africa))
$(eval $(call BuildPackage,zoneinfo-northamerica))
$(eval $(call BuildPackage,zoneinfo-southamerica))
$(eval $(call BuildPackage,zoneinfo-poles))
$(eval $(call BuildPackage,zoneinfo-asia))
$(eval $(call BuildPackage,zoneinfo-atlantic))
$(eval $(call BuildPackage,zoneinfo-australia-nz))
$(eval $(call BuildPackage,zoneinfo-pacific))
$(eval $(call BuildPackage,zoneinfo-europe))
$(eval $(call BuildPackage,zoneinfo-india))
$(eval $(call BuildPackage,zoneinfo-middleeast))

