#
# Copyright (C) 2026 HAProxy Manager contributors
#
# This is free software, licensed under the MIT License.
#

include $(TOPDIR)/rules.mk

PKG_VERSION:=0.6.1
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=Philipp Shklyaev <job@umk0.ru>
LUCI_MAINTAINER:=$(PKG_MAINTAINER)

LUCI_TITLE:=LuCI HAProxy Manager
LUCI_DESCRIPTION:=Manage Web and TCP HAProxy services, firewall access, and recovery points.
LUCI_DEPENDS:=+luci-base +rpcd +rpcd-mod-file +haproxy
LUCI_PKGARCH:=all

define Package/luci-app-haproxy-manager/conffiles
/etc/config/haproxy_manager
endef

define Package/luci-app-haproxy-manager/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/usr/libexec/haproxy-manager/migrate >/dev/null 2>&1 || logger -t haproxy-manager "Configuration migration failed"
	rm -f /tmp/luci-indexcache.* 2>/dev/null || true
	rm -rf /tmp/luci-modulecache/ 2>/dev/null || true
	/etc/init.d/rpcd reload >/dev/null 2>&1 || true
	/usr/libexec/haproxy-manager/recover package install >/dev/null 2>&1 &
}
exit 0
endef

define Package/luci-app-haproxy-manager/prerm
#!/bin/sh
case "$${PKG_UPGRADE:-0}:$${1:-}" in
	1:*|*:upgrade) exit 0 ;;
esac
[ -n "$${IPKG_INSTROOT}" ] || {
	/usr/libexec/haproxy-manager/uninstall >/dev/null 2>&1 ||
		logger -t haproxy-manager "Package runtime cleanup failed"
}
exit 0
endef

define Package/luci-app-haproxy-manager/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	rm -f /tmp/luci-indexcache.* 2>/dev/null || true
	rm -rf /tmp/luci-modulecache/ 2>/dev/null || true
	/etc/init.d/rpcd reload >/dev/null 2>&1 || true
}
exit 0
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
