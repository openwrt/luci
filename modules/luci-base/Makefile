#
# Copyright (C) 2022 Jo-Philipp Wich <jo@mein.io>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-base
PKG_BUILD_FLAGS:=no-lto

LUCI_TYPE:=mod
LUCI_BASENAME:=base

LUCI_TITLE:=LuCI core runtime
LUCI_DEPENDS:=\
	+rpcd \
	+rpcd-mod-file \
	+rpcd-mod-luci \
	+rpcd-mod-ucode \
	+cgi-io \
	+ucode \
	+ucode-mod-fs \
	+ucode-mod-uci \
	+ucode-mod-ubus \
	+ucode-mod-math \
	+ucode-mod-html \
	+liblucihttp-ucode

PKG_LICENSE:=Apache-2.0

HOST_BUILD_DIR:=$(BUILD_DIR_HOST)/$(PKG_NAME)

include $(INCLUDE_DIR)/host-build.mk

define Package/luci-base/conffiles
/etc/luci-uploads
/etc/config/luci
endef

define Package/luci-base/postinst
#!/bin/sh

if [ -z "$${PKG_INSTROOT}" ] && [ -f /etc/config/uhttpd ]; then
	if ! uci -q get uhttpd.main.ucode_prefix | grep -sq /cgi-bin/luci; then
		uci add_list uhttpd.main.ucode_prefix='/cgi-bin/luci=/usr/share/ucode/luci/uhttpd.uc'
		uci commit uhttpd
		service uhttpd reload
	fi
fi

exit 0
endef

include ../../luci.mk

define Host/Configure
endef

define Host/Compile
	$(MAKE) -C src/ clean po2lmo jsmin
endef

define Host/Install
	$(INSTALL_DIR) $(1)/bin
	$(INSTALL_BIN) src/po2lmo $(1)/bin/po2lmo
	$(INSTALL_BIN) src/jsmin $(1)/bin/jsmin
endef

$(eval $(call HostBuild))

# call BuildPackage - OpenWrt buildroot signature
