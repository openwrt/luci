include $(TOPDIR)/rules.mk

PKG_LICENSE:=MIT
PKG_MAINTAINER:=Ash Clarke <clarkeaj@hotmail.co.uk>

LUCI_TITLE:=LuCI interface for qosify
LUCI_DESCRIPTION:=Web UI for the qosify CAKE/eBPF traffic shaping daemon
LUCI_DEPENDS:=+qosify
LUCI_PKGARCH:=all
PKG_PROVIDES:=luci-app-qos

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
