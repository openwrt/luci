include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-notes
PKG_VERSION:=0.1.0
PKG_RELEASE:=1

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Viktors Zilinskis <viktors.zilinskis@gmail.com>

LUCI_TITLE:=LuCI Notes
LUCI_DESCRIPTION:=Simple Markdown notes application for LuCI.
LUCI_DEPENDS:=+luci-base +rpcd +rpcd-mod-ucode
LUCI_PKGARCH:=all

define Package/luci-app-notes/conffiles
/etc/notes.md
endef

define Package/luci-app-notes/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/usr/libexec/luci-app-notes-init 2>/dev/null || true
	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	/etc/init.d/rpcd reload 2>/dev/null || true
	/etc/init.d/ucitrack reload 2>/dev/null || true
}
exit 0
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
