#
# Copyright (C) 2019-2023 The Sirpdboy Team <herboy2008@gmail.com>    
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Kucat Theme
PKG_NAME:=luci-theme-kucat
LUCI_DEPENDS:=
PKG_VERSION:=2.3.9

define Package/luci-theme-kucat/postinst
#!/bin/sh

rm -Rf /var/luci-modulecache
rm -Rf /var/luci-indexcache
exit 0

endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
