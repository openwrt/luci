# SPDX-License-Identifier: MIT

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI Support for lanstat
LUCI_DEPENDS:=+luci-base +lanstat
LUCI_PKGARCH:=all

PKG_LICENSE:=MIT
PKG_MAINTAINER:=Junwei Huang <hjw@live.cn>

include ../../luci.mk

define Package/luci-app-lanstat/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	/etc/init.d/rpcd reload 2>/dev/null
	exit 0
}
endef

# call BuildPackage - OpenWrt buildroot signature
