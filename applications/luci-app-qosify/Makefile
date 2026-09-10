#
# Copyright (C) 2026 Ash Clarke <clarkeaj@hotmail.co.uk>
#
# This is free software, licensed under the MIT License.
#

include $(TOPDIR)/rules.mk

PKG_LICENSE:=MIT
PKG_MAINTAINER:=Ash Clarke <clarkeaj@hotmail.co.uk>

LUCI_TITLE:=LuCI interface for qosify
LUCI_DESCRIPTION:=Web UI for the qosify CAKE/eBPF traffic shaping daemon
LUCI_DEPENDS:=+luci-base +qosify
PKG_PROVIDES:=luci-app-qos

# root/usr/share/qosify-luci/qosify and 00-defaults.conf are verbatim copies of
# package/network/config/qosify/files/qosify.conf and qosify-defaults.conf in
# openwrt/openwrt; re-diff both whenever the qosify package is bumped.

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
