include $(TOPDIR)/rules.mk

PKG_NAME:=ucode-mod-lua
PKG_RELEASE:=1
PKG_LICENSE:=ISC
PKG_MAINTAINER:=Jo-Philipp Wich <jo@mein.io>

include $(INCLUDE_DIR)/package.mk

define Package/ucode-mod-lua
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=ucode to Lua bridge library
  DEPENDS:=+libucode +liblua
endef

define Package/ucode-mod-lua/install
	$(INSTALL_DIR) $(1)/usr/lib/ucode
	$(CP) $(PKG_BUILD_DIR)/lua.so $(1)/usr/lib/ucode/
endef

define Build/Configure
endef

define Build/Compile
	$(TARGET_CC) $(TARGET_CFLAGS) $(TARGET_LDFLAGS) $(FPIC) \
		-Wall -ffunction-sections -Wl,--gc-sections -shared -Wl,--no-as-needed -llua \
		-o $(PKG_BUILD_DIR)/lua.so $(PKG_BUILD_DIR)/lua.c
endef

$(eval $(call BuildPackage,ucode-mod-lua))
