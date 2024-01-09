include $(TOPDIR)/rules.mk

LUCI_TITLE:=Radicale v2.x CalDAV/CardDAV Server
LUCI_DEPENDS:=+luci-base +luci-compat +radicale2 +rpcd-mod-rad2-enc

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Daniel F. Dickinson <dfdpublic@wildtechgarden.ca>

LUA_TARGET:=source

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
