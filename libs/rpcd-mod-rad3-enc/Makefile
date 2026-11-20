# cspell:words TOPDIR INSTROOT IPKG Radicale passlib postinst rpcd

include $(TOPDIR)/rules.mk

PKG_NAME:=rpcd-mod-rad3-enc
PKG_VERSION:=20260109

PKG_LICENSE:=Apache-2.0

PKG_BUILD_PARALLEL:=1

include $(INCLUDE_DIR)/package.mk

define Build/Prepare
	true
endef

define Build/Compile
	true
endef

define Package/rpcd-mod-rad3-enc
  SECTION:=libs
  CATEGORY:=Libraries
  TITLE:=Radicale v3 Hashing RPC module
  DEPENDS:=+rpcd +python3 +python3-passlib +radicale3
  PROVIDES:=rpcd-mod-rad2-enc
endef

define Package/rpcd-mod-rad32-enc/description
  Python3 password hashing module for use with Radicale v3 LuCI app
endef

define Package/rpcd-mod-rad3-enc/install
	$(INSTALL_DIR) $(1)/usr/libexec/rpcd
	$(INSTALL_BIN) ./files/rad3-enc $(1)/usr/libexec/rpcd
endef

define Package/rpcd-mod-rad3-enc/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] || /etc/init.d/rpcd reload
endef

$(eval $(call BuildPackage,rpcd-mod-rad3-enc))
