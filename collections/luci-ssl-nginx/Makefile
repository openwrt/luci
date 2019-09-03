include $(TOPDIR)/rules.mk

LUCI_TYPE:=col
LUCI_BASENAME:=ssl-nginx

LUCI_TITLE:=LuCI with HTTPS support on Nginx (OpenSSL as SSL backend)
LUCI_DESCRIPTION:=LuCI with OpenSSL as the SSL backend (libustream-openssl). \
 OpenSSL cmd tools (openssl-util) are used by Nginx for SSL key generation \
 instead of the default px5g. (If px5g is installed, Nginx will prefer that.)
LUCI_DEPENDS:= \
	+nginx-ssl +uwsgi-cgi-plugin +luci-mod-admin-full +luci-theme-bootstrap \
	+luci-app-firewall +luci-app-opkg +luci-proto-ppp +libiwinfo-lua \
	+IPV6:luci-proto-ipv6 +rpcd-mod-rrdns +openssl-util

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Ansuel Smith <ansuelsmth@gmail.com>

define Package/luci-ssl-nginx/conffiles
/etc/uwsgi/sites/luci.ini
/etc/nginx/conf.d/luci.conf
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
