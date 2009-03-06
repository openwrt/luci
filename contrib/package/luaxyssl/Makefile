include $(TOPDIR)/rules.mk

PKG_BRANCH:=trunk
PKG_NAME:=luaxyssl
PKG_RELEASE:=1
PKG_SOURCE_URL:=http://luaxyssl.googlecode.com/svn/$(PKG_BRANCH)
PKG_REV:=65
PKG_VERSION:=0.2+svn$(PKG_REV)
PKG_SOURCE_SUBDIR:=$(PKG_NAME)-$(PKG_VERSION)
PKG_SOURCE:=$(PKG_SOURCE_SUBDIR).tar.gz
PKG_SOURCE_PROTO:=svn
PKG_SOURCE_VERSION:=$(PKG_REV)

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

include $(INCLUDE_DIR)/package.mk

define Package/luaxyssl
  SECTION:=lang
  CATEGORY:=Languages
  SUBMENU:=LUA
  TITLE:=xyssl-Bindings for Lua
  URL:=http://code.google.com/p/luaxyssl
  DEPENDS:=@BROKEN +liblua +libxyssl
endef

define Build/Configure
endef

define Build/Compile
	$(TARGET_CC) $(TARGET_CFLAGS) $(TARGET_LDFLAGS) -shared -fpic -pedantic -Wall \
	-I$(STAGING_DIR)/usr/include \
	-DXYSSL=9 \
	-o $(PKG_BUILD_DIR)/lxyssl.so -lxyssl $(PKG_BUILD_DIR)/lxyssl.c
endef

define Package/luaxyssl/install
	$(INSTALL_DIR) $(1)/usr/lib/lua
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/lxyssl.so $(1)/usr/lib/lua
endef

$(eval $(call BuildPackage,luaxyssl))
