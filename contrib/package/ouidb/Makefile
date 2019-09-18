#
# Copyright (C) 2019 TDT AG <development@tdt.de> 
# This is free software, licensed under the GNU General Public License v2.
# See https://www.gnu.org/licenses/gpl-2.0.txt for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=ouidb
PKG_RELEASE:=1

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL=https://github.com/jfisbein/ouidb-json.git
PKG_SOURCE_DATE:=2019-09-18
PKG_SOURCE_VERSION:=c45622bbcc29644a03202ce6ac0a618e8af417c3
PKG_SOURCE_SUBDIR:=$(PKG_NAME)-$(PKG_SOURCE_VERSION)
PKG_SOURCE:=$(PKG_SOURCE_SUBDIR).tar.gz
PKG_MIRROR_HASH:=13d59c76a3cee23a6183da4bec57591bb9e0689dedfba1c9350830cfe9ca2945
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_SOURCE_SUBDIR)

PKG_MAINTAINER:=Florian Eckert <fe@dev.tdt.de>

include $(INCLUDE_DIR)/package.mk

define Package/ouidb
  SECTION:=libs
  CATEGORY:=Libraries
  TITLE:=OUI Database
endef

define Package/ouidb/description
A json version of the OUI Database published at https://linuxnet.ca/ieee/oui/
endef

define Build/Prepare
	$(call Build/Prepare/Default)
	$(CP) ./script/* $(PKG_BUILD_DIR)/
endef

define Build/Compile
	$(STAGING_DIR_HOST)/bin/$(PYTHON) $(PKG_BUILD_DIR)/convert.py \
		$(PKG_BUILD_DIR)/ouidb.json > $(PKG_BUILD_DIR)/ouidb-mini.json
endef

define Package/ouidb/install
	$(INSTALL_DIR) $(1)/usr/share/luci
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/ouidb-mini.json \
		$(1)/usr/share/luci/ouidb.json
endef

$(eval $(call BuildPackage,ouidb))
