
include $(TOPDIR)/rules.mk

# cspell:words TOPDIR LUCI Radicale buildroot rpcd

LUCI_TITLE:=Radicale v3 CalDAV/CardDAV Server
LUCI_DEPENDS:=+luci-base +radicale3 +rpcd-mod-rad3-enc

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Daniel F. Dickinson <dfdpublic@wildtechgarden.ca>
PROVIDES:=luci-app-radicale2

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
