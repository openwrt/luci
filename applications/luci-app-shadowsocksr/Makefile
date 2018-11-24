#
# Copyright (C) 2016-2017 Jian Chang <aa65535@live.com>
# Copyright (C) 2018 XiaoShan mivm.cn
#
# This is free software, licensed under the GNU General Public License v3.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-shadowsocksr
PKG_VERSION:=1.9.0
PKG_RELEASE:=1

PKG_LICENSE:=GPLv3
PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=Jian Chang <aa65535@live.com>

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
	SECTION:=luci
	CATEGORY:=LuCI
	SUBMENU:=3. Applications
	TITLE:=LuCI Support for shadowsocksr-libev
	PKGARCH:=all
	DEPENDS:=+iptables +ipset
endef

define Package/$(PKG_NAME)/description
	LuCI Support for shadowsocks-libev.
endef

define Build/Prepare
	$(foreach po,$(wildcard ${CURDIR}/files/luci/i18n/*.po), \
		po2lmo $(po) $(PKG_BUILD_DIR)/$(patsubst %.po,%.lmo,$(notdir $(po)));)
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
	if [ -f /etc/uci-defaults/luci-shadowsocksr ]; then
		( . /etc/uci-defaults/luci-shadowsocksr ) && \
		rm -f /etc/uci-defaults/luci-shadowsocksr
	fi
	rm -rf /tmp/luci-indexcache /tmp/luci-modulecache
fi
exit 0
endef

define Package/$(PKG_NAME)/conffiles
/etc/config/shadowsocksr
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/i18n
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/shadowsocksr.*.lmo $(1)/usr/lib/lua/luci/i18n/
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/controller
	$(INSTALL_DATA) ./files/luci/controller/*.lua $(1)/usr/lib/lua/luci/controller/
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/model/cbi/shadowsocksr
	$(INSTALL_DATA) ./files/luci/model/cbi/shadowsocksr/*.lua $(1)/usr/lib/lua/luci/model/cbi/shadowsocksr/
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/view/shadowsocksr
	$(INSTALL_DATA) ./files/luci/view/shadowsocksr/*.htm $(1)/usr/lib/lua/luci/view/shadowsocksr/
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DATA) ./files/root/etc/config/shadowsocksr $(1)/etc/config/shadowsocksr
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/root/etc/init.d/shadowsocksr $(1)/etc/init.d/shadowsocksr
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./files/root/etc/uci-defaults/luci-shadowsocksr $(1)/etc/uci-defaults/luci-shadowsocksr
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/root/usr/bin/ssr-rules$(2) $(1)/usr/bin/ssr-rules
	
	$(INSTALL_DIR) $(1)/etc/shadowsocksr
	$(INSTALL_DATA) ./files/root/etc/shadowsocksr/* $(1)/etc/shadowsocksr/
	$(INSTALL_DIR) $(1)/usr/share/shadowsocksr
	$(INSTALL_BIN) ./files/root/usr/share/shadowsocksr/*.sh $(1)/usr/share/shadowsocksr/
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
