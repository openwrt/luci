include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-ispapp
PKG_VERSION:=1.0.1
PKG_RELEASE:=2

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL:=https://github.com/ispapp/ispapp-linux-client.git
PKG_SOURCE_SUBDIR:=$(PKG_NAME)
PKG_SOURCE_VERSION:=main/luci-app-ispapp
PKG_SOURCE:=$(PKG_NAME).tar.gz

LUCI_TITLE:=Ispapp Agent
LUCI_DEPENDS:=+luci-base +luasocket +luasec +rpcd
LUCI_PKGARCH:=all
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=kmoz000 <abdelkarim@ispapp.co>

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
  SECTION:=net
  CATEGORY:=Network
  TITLE:=LuCI Support of Ispapp.co Agent
  URL:=https://ispapp.co
endef

define Package/$(PKG_NAME)/conffiles
/etc/config/ispapp
endef

define Package/$(PKG_NAME)/description
LuCI Support of Ispapp.co Agent
endef

define Build/Prepare
	$(call Build/Prepare/Default)
	# Fetch the repository
	git clone --branch main/luci-app-ispapp $(PKG_SOURCE_URL) $(PKG_BUILD_DIR)
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh
[ -n "${IPKG_INSTROOT}" ] || {
	if [ -f /etc/uci-defaults/50_luci-ispapp ]; then
		( . /etc/uci-defaults/50_luci-ispapp ) && rm -f /etc/uci-defaults/50_luci-ispapp
	fi
	
	if [ -x /etc/init.d/ispapp ]; then
		chmod +x /etc/init.d/ispapp
		/etc/init.d/ispapp enable
		/etc/init.d/ispapp start
	fi
	if [ -f /usr/libexec/rpcd/ispapp ]; then
		chmod +x /usr/libexec/rpcd/ispapp
		/etc/init.d/rpcd reload
	fi
	exit 0
}
endef

# Call the LuCI build rules
include $(TOPDIR)/feeds/luci/luci.mk

# Build the package
$(eval $(call BuildPackage,$(PKG_NAME)))
