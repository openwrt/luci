include $(TOPDIR)/rules.mk

PKG_NAME:=lucihttp
PKG_RELEASE:=1

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL=https://github.com/jow-/lucihttp.git
PKG_SOURCE_DATE:=2022-07-08
PKG_SOURCE_VERSION:=6e68a1065f3ed1889e5fa053b206bd3aa108bd5f
PKG_MIRROR_HASH:=19e9694f88449c91aa531dfca411c7752358a80bbb4de3aa6bfaf2deecc2db2e
CMAKE_INSTALL:=1

PKG_LICENSE:=ISC
PKG_LICENSE_FILES:=LICENSE

PKG_MAINTAINER:=Jo-Philipp Wich <jo@mein.io>
PKG_CONFIG_DEPENDS:=CONFIG_PACKAGE_liblucihttp-lua CONFIG_PACKAGE_liblucihttp-ucode

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

define Package/liblucihttp-ucode
  SECTION:=libs
  CATEGORY:=Libraries
  DEPENDS:=+liblucihttp +libucode
  TITLE:=ucode binding for the LuCI HTTP utility library
endef

TARGET_CFLAGS += -I$(STAGING_DIR)/usr/include

CMAKE_OPTIONS += \
	-DLUAPATH=/usr/lib/lua \
	-DBUILD_LUA=$(if $(CONFIG_PACKAGE_liblucihttp-lua),ON,OFF) \
	-DBUILD_UCODE=$(if $(CONFIG_PACKAGE_liblucihttp-ucode),ON,OFF) \
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

define Package/liblucihttp-ucode/install
	$(INSTALL_DIR) $(1)/usr/lib/ucode
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/ucode/lucihttp.so $(1)/usr/lib/ucode/
endef

$(eval $(call BuildPackage,liblucihttp))
$(eval $(call BuildPackage,liblucihttp-lua))
$(eval $(call BuildPackage,liblucihttp-ucode))
