# Copyright (C) 2024 Findlay Feng <i@fengch.me>

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for hysteria
LUCI_DEPENDS:=+luci-base +hysteria +hysteria-configs
LUCI_PKGARCH:=all

PKG_LICENSE:=MIT
PKG_MAINTAINER:=Findlay Feng <i@fengch.me>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
