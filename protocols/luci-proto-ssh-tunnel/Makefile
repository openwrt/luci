# SPDX-License-Identifier: Apache-2.0

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Support for SSH Tunnel VPN
LUCI_DEPENDS:=+luci-base +netifd +kmod-tun +openssh-client +openssh-keygen \
	+sshpass +python3-light +python3-cryptodomex +python3-urllib
LUCI_PKGARCH:=all
LUCI_MAINTAINER:=Tishkin Daniil <danil.tishkin@yandex.ru>

PKG_LICENSE:=Apache-2.0
PKG_VERSION:=0.1.0
PKG_RELEASE:=9

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
