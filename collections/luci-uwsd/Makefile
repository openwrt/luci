#
# Copyright (C) 2023 Jo-Philipp Wich <jo@mein.io>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TYPE:=col
LUCI_BASENAME:=uwsd

LUCI_TITLE:=LuCI interface with uwsd WebSocket support
LUCI_DESCRIPTION:=Standard LuCI component collection with WebSocket support and uwsd backend server.
LUCI_DEPENDS:= \
	+uwed +luci-mod-admin-full +luci-theme-bootstrap \
	+luci-app-firewall +luci-app-opkg +luci-proto-ppp +IPV6:luci-proto-ipv6 \
	+rpcd-mod-rrdns

PKG_LICENSE:=Apache-2.0

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
