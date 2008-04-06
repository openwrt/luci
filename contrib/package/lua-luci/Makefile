# 
# Copyright (C) 2006 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.

include $(TOPDIR)/rules.mk

PKG_NAME:=lua-luci
PKG_VERSION:=5.1.3
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.bz2
PKG_SOURCE_URL:=https://dev.leipzig.freifunk.net/svn/ff-luci/trunk/contrib/package-source/
PKG_MD5SUM:=98b12c767a5eed92169b01537e988c7f

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

X_HOST_DIR:=$(BUILD_DIR_HOST)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/lua-luci/Default
  SUBMENU:=LUA
  SECTION:=lang
  CATEGORY:=Languages
  TITLE:=LUA programming language
  URL:=http://www.lua.org/
endef

define Package/lua-luci/Default/description
 Lua is a powerful light-weight programming language designed for extending 
 applications. Lua is also frequently used as a general-purpose, stand-alone 
 language. Lua is free software.
endef

define Package/liblua-luci
$(call Package/lua-luci/Default)
  SUBMENU:=
  SECTION:=libs
  CATEGORY:=Libraries
  TITLE+= (libraries)
endef

define Package/liblua-luci/description
$(call Package/lua-luci/Default/description)
 This package contains the LUA shared libraries, needed by other programs.
endef

define Package/lua-luci
$(call Package/lua-luci/Default)
  DEPENDS:=+liblua-luci +libreadline +libncurses
  TITLE+= (interpreter)
endef

define Package/lua-luci/description
$(call Package/lua-luci/Default/description)
 This package contains the LUA language interpreter.
endef

define Package/luac-luci
$(call Package/lua-luci/Default)
  DEPENDS:=+liblua-luci
  TITLE+= (compiler)
endef

define Package/luac/description
$(call Package/lua-luci/Default/description)
 This package contains the LUA language compiler.
endef

define Package/lua-luci-examples
$(call Package/lua-luci/Default)
  DEPENDS:=lua-luci
  TITLE+= (examples)
endef

define Package/lua-luci-examples/description
$(call Package/lua-luci/Default/description)
 This package contains LUA language examples.
endef

define Build/Configure
endef

define Build/Compile
	cp $(PKG_BUILD_DIR)/src $(PKG_BUILD_DIR)/src-host -R
	$(MAKE) -C $(PKG_BUILD_DIR) \
		CC="$(TARGET_CROSS)gcc" \
		LD="$(TARGET_CROSS)ld" \
		AR="$(TARGET_CROSS)ar rcu" \
		RANLIB="$(TARGET_CROSS)ranlib" \
		INSTALL_ROOT=/usr \
		MYCFLAGS="$(TARGET_CPPFLAGS) $(TARGET_CFLAGS)" \
		MYLDFLAGS="$(TARGET_LDFLAGS)" \
		PKG_VERSION=$(PKG_VERSION) \
		all linux 
	rm -rf $(PKG_INSTALL_DIR)
	mkdir -p $(PKG_INSTALL_DIR)
	$(MAKE) -C $(PKG_BUILD_DIR) \
		INSTALL_TOP="$(PKG_INSTALL_DIR)/usr" \
		install
	$(MAKE) -C $(PKG_BUILD_DIR)/src-host luac-host
	mkdir -p $(X_HOST_DIR)
	cp $(PKG_BUILD_DIR)/src-host/luac-host $(X_HOST_DIR)/luac
endef

define Build/InstallDev
	mkdir -p $(1)/usr/include
	$(CP) $(PKG_INSTALL_DIR)/usr/include/lua{,lib,conf}.h $(1)/usr/include/
	$(CP) $(PKG_INSTALL_DIR)/usr/include/lauxlib.h $(1)/usr/include/
	$(CP) $(PKG_INSTALL_DIR)/usr/include/lnum_config.h $(1)/usr/include/
	mkdir -p $(1)/usr/lib
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/liblua.{a,so.*} $(1)/usr/lib/
	ln -sf liblua.so.$(PKG_VERSION) $(1)/usr/lib/liblua.so
	ln -sf liblua.so.$(PKG_VERSION) $(1)/usr/lib/liblualib.so
endef

define Package/liblua-luci/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/liblua.so.* $(1)/usr/lib/
	echo "Replaces: liblua" >> $(1)/CONTROL/control
	echo "Conflicts: liblua" >> $(1)/CONTROL/control
endef

define Package/lua-luci/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/bin/lua $(1)/usr/bin/
	echo "Replaces: lua" >> $(1)/CONTROL/control
	echo "Conflicts: lua" >> $(1)/CONTROL/control
endef

define Package/luac-luci/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/bin/luac $(1)/usr/bin/
	echo "Replaces: luac" >> $(1)/CONTROL/control
	echo "Conflicts: luac" >> $(1)/CONTROL/control
endef

define Package/lua-luci-examples/install
	$(INSTALL_DIR) $(1)/usr/share/lua/examples
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/test/*.lua \
		$(1)/usr/share/lua/examples/
endef

$(eval $(call BuildPackage,liblua-luci))
$(eval $(call BuildPackage,lua-luci))
$(eval $(call BuildPackage,luac-luci))
$(eval $(call BuildPackage,lua-luci-examples))
