#
# Copyright (C) 2015 OpenWrt.org
#
# This is free software, licensed under the Apache License, Version 2.0 .

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Network UPS Tools Configuration
LUCI_DEPENDS:=+luci-base +nut +nut-upsmon +nut-server +nut-upsc +nut-web-cgi +nut-upscmd

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Daniel F. Dickinson <dfdpublic@wildtechgarden.ca> \
		Paul Donald <newtwen+github@gmail.com>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
