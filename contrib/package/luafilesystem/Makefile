include $(TOPDIR)/rules.mk

PKG_NAME:=luafilesystem
PKG_VERSION:=1.4.0
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=http://luaforge.net/frs/download.php/3158
PKG_MD5SUM:=6f3d247f27820b8f045431ad81bcd3ad

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

include $(INCLUDE_DIR)/package.mk

define Package/luafilesystem
  SECTION:=lib
  CATEGORY:=Libraries
  TITLE:=Lua FS library
  URL:=http://www.keplerproject.org/luafilesystem/
  DEPENDS:=+liblua
  MAINTAINER:=Steven Barth <steven-at-midlink-dot-org>
endef

define Build/Configure
endef

define Build/Compile
	$(MAKE) -C $(PKG_BUILD_DIR) \
		CC="$(TARGET_CROSS)gcc" \
		LD="$(TARGET_CROSS)ld" \
		AR="$(TARGET_CROSS)ar rcu" \
		RANLIB="$(TARGET_CROSS)ranlib" \
		INSTALL_ROOT=/usr \
		LUA_INC=$(STAGING_DIR)/usr/include
endef

define Package/luafilesystem/install		
	$(INSTALL_DIR) $(1)/usr/lib/lua
	$(STRIP) $(PKG_BUILD_DIR)/src/lfs.so
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/src/lfs.so $(1)/usr/lib/lua
endef

$(eval $(call BuildPackage,luafilesystem))
