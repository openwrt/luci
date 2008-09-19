include $(TOPDIR)/rules.mk

PKG_NAME:=luasocket
PKG_VERSION:=2.0.2
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=http://dev.luci.freifunk-halle.net/sources/\
		http://luaforge.net/frs/download.php/2664/
PKG_MD5SUM:=41445b138deb7bcfe97bff957503da8e

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

include $(INCLUDE_DIR)/package.mk

define Package/luasocket
  SECTION:=lang
  CATEGORY:=Languages
  SUBMENU:=LUA
  TITLE:=Socket support for Lua
  URL:=http://luaforge.net/projects/luasockets/
  DEPENDS:=+liblua
endef

define Build/Configure
endef

define Build/Compile
	for i in $(PKG_BUILD_DIR)/src/*.lua; do luac -s -o $$$$i $$$$i; done
	$(call Build/Compile/Default)
endef

MAKE_FLAGS += LD="$(TARGET_CC)" CFLAGS="$(TARGET_CFLAGS) -I$(STAGING_DIR)/usr/include -pedantic -Wall -fpic" LDFLAGS="$(TARGET_LDFLAGS) -shared -fpic"

define Package/luasocket/install
	$(MAKE) -C$(PKG_BUILD_DIR) install INSTALL_TOP_SHARE=$(1)/usr/lib/lua INSTALL_TOP_LIB=$(1)/usr/lib/lua
endef

$(eval $(call BuildPackage,luasocket))
