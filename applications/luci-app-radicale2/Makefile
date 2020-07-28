include $(TOPDIR)/rules.mk

LUCI_TITLE:=Radicale v2.x CalDAV/CardDAV Server
LUCI_DEPENDS:=+luci-compat +radicale2 +rpcd-mod-rad2-enc
LUCI_PKGARCH:=all

PKG_LICENSE:=Apache-2.0

LUA_TARGET:=source

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
