#
# Copyright (C) 2008-2014 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Freifunk Community Meta-Package
LUCI_DEPENDS:= \
	+iptables-mod-nat-extra +iptables-mod-ipopt +luci-app-splash \
	+olsrd +olsrd-mod-dyn-gw-plain +olsrd-mod-jsoninfo +olsrd-mod-nameservice \
	+olsrd-mod-watchdog +kmod-tun +ip +freifunk-watchdog +luci-app-olsr \
	+luci-app-olsr-services +freifunk-gwcheck +freifunk-mapupdate

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature

