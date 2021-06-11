include $(TOPDIR)/rules.mk

PKG_NAME:=lucihttp
PKG_RELEASE:=1

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL=https://github.com/jow-/lucihttp.git
PKG_SOURCE_DATE:=2021-06-11
PKG_SOURCE_VERSION:=3dc89af443410c9eae7a0ff091bd7fb4c5d48f41
PKG_MIRROR_HASH:=6024a34c514a7231bcc36486abfb3e43e6c17490ac8d838f202a43ce259cda03
CMAKE_INSTALL:=1

PKG_LICENSE:=ISC
PKG_LICENSE_FILES:=LICENSE

PKG_MAINTAINER:=Jo-Philipp Wich <jo@mein.io>
PKG_CONFIG_DEPENDS:=CONFIG_PACKAGE_liblucihttp-lua

include $(INCLUDE_DIR)/package.mk
include $(INCLUDE_DIR)/cmake.mk

define Package/liblucihttp
  SECTION:=libs
  CATEGORY:=Libraries
  TITLE:=LuCI HTTP utility library
  ABI_VERSION:=0
endef

define Package/liblucihttp-lua
  SECTION:=libs
  CATEGORY:=Libraries
  DEPENDS:=+liblucihttp +liblua
  TITLE:=Lua binding for the LuCI HTTP utility library
endef

TARGET_CFLAGS += -I$(STAGING_DIR)/usr/include

CMAKE_OPTIONS += \
	-DLUAPATH=/usr/lib/lua \
	-DBUILD_LUA=$(if $(CONFIG_PACKAGE_liblucihttp-lua),ON,OFF) \
	-DBUILD_TESTS=OFF

define Build/InstallDev
	$(INSTALL_DIR) $(1)/usr/lib
	$(INSTALL_DIR) $(1)/usr/include
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/liblucihttp.so* $(1)/usr/lib/
	$(CP) $(PKG_INSTALL_DIR)/usr/include/* $(1)/usr/include/
endef

define Package/liblucihttp/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/liblucihttp.so.* $(1)/usr/lib/
endef

define Package/liblucihttp-lua/install
	$(INSTALL_DIR) $(1)/usr/lib/lua
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/lua/lucihttp.so $(1)/usr/lib/lua/
endef

$(eval $(call BuildPackage,liblucihttp))
$(eval $(call BuildPackage,liblucihttp-lua))
