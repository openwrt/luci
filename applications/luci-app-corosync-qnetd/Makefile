# SPDX-License-Identifier: Apache-2.0

include $(TOPDIR)/rules.mk

PKG_LICENSE:=Apache-2.0
LUCI_MAINTAINER:=Christian Sandberg <chrsandb@gmail.com>

LUCI_TITLE:=LuCI support for Corosync QNetd
LUCI_DESCRIPTION:=Configure, enroll and monitor a Corosync QNetd quorum server
LUCI_DEPENDS:=+corosync-qnetd +rpcd-mod-ucode
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
