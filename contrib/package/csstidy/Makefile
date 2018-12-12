include $(TOPDIR)/rules.mk

PKG_NAME:=csstidy
PKG_RELEASE:=1

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL=https://github.com/jow-/csstidy-cpp.git
PKG_SOURCE_DATE:=2018-12-12.1
PKG_SOURCE_VERSION:=33594b4783cc944da8197b2209c2a47af3aa42a4
PKG_MIRROR_HASH:=3c9ba0c244e850bb897e08cb1c96d4e861a93a8a26871b5a0d54cf88c60422f5

PKG_LICENSE:=LGPL-2.1
PKG_LICENSE_FILES:=COPYING

PKG_MAINTAINER:=Jo-Philipp Wich <jo@mein.io>

include $(INCLUDE_DIR)/host-build.mk
include $(INCLUDE_DIR)/package.mk

define Package/csstidy
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=CSSTidy parser and optimiser
  DEPENDS:=+libstdcpp
endef

define Package/csstidy/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/csstidy/csstidy $(1)/usr/bin/
endef


define Host/Install
	$(INSTALL_DIR) $(STAGING_DIR_HOSTPKG)/bin/
	$(INSTALL_BIN) $(HOST_BUILD_DIR)/csstidy/csstidy $(1)/bin/
endef

$(eval $(call HostBuild))
$(eval $(call BuildPackage,csstidy))
