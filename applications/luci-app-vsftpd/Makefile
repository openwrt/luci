#
# Copyright (C) 2008-2014 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=vsftpd - FTP module
LUCI_DEPENDS:=@((PACKAGE_vsftpd||PACKAGE_vsftpd-tls)&&VSFTPD_USE_UCI_SCRIPTS)
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
