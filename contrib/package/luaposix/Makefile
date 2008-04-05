include $(TOPDIR)/rules.mk

PKG_NAME:=luaposix
PKG_VERSION:=5.1.2
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=http://luaforge.net/frs/download.php/3063
PKG_MD5SUM:=31deeb4add91f76b3c2d36aae2888d81

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

include $(INCLUDE_DIR)/package.mk

define Package/luaposix
  SECTION:=lib
  CATEGORY:=Libraries
  TITLE:=Lua Posix library
  URL:=http://luaforge.net/projects/luaposix/
  DEPENDS:=+liblua-luci
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
		LUAINC=$(STAGING_DIR)/usr/include
endef

define Package/luaposix/install		
	$(INSTALL_DIR) $(1)/usr/lib/lua
	$(STRIP) $(PKG_BUILD_DIR)/posix.so
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/posix.so $(1)/usr/lib/lua
endef

$(eval $(call BuildPackage,luaposix))
