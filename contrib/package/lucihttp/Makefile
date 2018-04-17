include $(TOPDIR)/rules.mk

PKG_NAME:=lucihttp
PKG_RELEASE:=1

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL=https://github.com/jow-/lucihttp.git
PKG_SOURCE_DATE:=2018-04-17
PKG_SOURCE_VERSION:=b46a6ca5faf3d7c65447fdc5e65ae8eca7bda88d
PKG_MIRROR_HASH:=2ce8032254e94b45d7007e4849f18aff035f8da8c491679737fdd81a02b9fc4d
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
  ABI_VERSION:=$(PKG_VERSION)
  TITLE:=LuCI HTTP utility library
endef

define Package/liblucihttp-lua
  SECTION:=libs
  CATEGORY:=Libraries
  DEPENDS:=+liblucihttp +liblua
  TITLE:=Lua binding for the LuCI HTTP utility library
endef

TARGET_CFLAGS += -I$(STAGING_DIR)/usr/include

CMAKE_OPTIONS = \
	-DLUAPATH=/usr/lib/lua \
	-DBUILD_LUA=$(if $(CONFIG_PACKAGE_liblucihttp-lua),ON,OFF) \
	-DBUILD_TESTS=OFF

define Package/liblucihttp/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/liblucihttp.so $(1)/usr/lib/
endef

define Package/liblucihttp-lua/install
	$(INSTALL_DIR) $(1)/usr/lib/lua
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/lua/lucihttp.so $(1)/usr/lib/lua/
endef

$(eval $(call BuildPackage,liblucihttp))
$(eval $(call BuildPackage,liblucihttp-lua))
