#
# Copyright (C) 2026 HH4xModem
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=MDM9207 Modem Manager for HH40V/HH41V
LUCI_DESCRIPTION:=Provides LuCI interface to monitor and control the MDM9207 modem in HH40V and HH41V routers. Features include signal quality monitoring, network mode selection, data usage tracking, and device information display.
LUCI_DEPENDS:=+luci-base +ucode-mod-socket
LUCI_PKGARCH:=all

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Devon Openheim <devopenm@proton.me>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
