# This is free software, licensed under the Apache License, Version 2.0
#
# Copyright (C) 2024 Hilman Maulana <hilman0.0maulana@gmail.com>

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI for Cloudflared
LUCI_DEPENDS:=+cloudflared
LUCI_DESCRIPTION:=LuCI support for Cloudflare Zero Trust Tunnels

PKG_MAINTAINER:=Hilman Maulana <hilman0.0maulana@gmail.com>, Sergey Ponomarev <stokito@gmail.com>
PKG_VERSION:=1.2
PKG_LICENSE:=Apache-2.0

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
