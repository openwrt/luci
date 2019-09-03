include $(TOPDIR)/rules.mk

LUCI_TYPE:=col
LUCI_BASENAME:=nginx

LUCI_TITLE:=LuCI interface with Nginx as Webserver
LUCI_DESCRIPTION:=Standard OpenWrt set including full admin with ppp support and the default Bootstrap theme
LUCI_DEPENDS:= \
	+nginx +uwsgi-cgi-plugin +luci-mod-admin-full +luci-theme-bootstrap \
	+luci-app-firewall +luci-app-opkg +luci-proto-ppp +libiwinfo-lua \
	+IPV6:luci-proto-ipv6 +rpcd-mod-rrdns

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Ansuel Smith <ansuelsmth@gmail.com>

define Package/luci-nginx/conffiles
/etc/uwsgi/sites/luci.ini
/etc/nginx/conf.d/luci.conf
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
