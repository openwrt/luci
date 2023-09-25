#
# Copyright (C) 2008-2014 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TYPE:=col
LUCI_BASENAME:=lighttpd

LUCI_TITLE:=LuCI Configuration Interface with Lighttpd as webserver
LUCI_DESCRIPTION:=Standard set including full admin with ppp support, package management and the default Bootstrap theme
LUCI_DEPENDS:= \
	+luci \
	+lighttpd \
	+lighttpd-mod-alias \
	+lighttpd-mod-cgi

PKG_LICENSE:=Apache-2.0

define Package/luci-lighttpd/postinst
#!/bin/sh
if [ -z "$$IPKG_INSTROOT" ]; then
  rm /var/log/lighttpd/error.log
  /etc/init.d/lighttpd restart
fi
endef

define Package/luci-lighttpd/postrm
#!/bin/sh
if [ -z "$$IPKG_INSTROOT" ]; then
  rm /var/log/lighttpd/error.log
  /etc/init.d/lighttpd restart
fi
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
