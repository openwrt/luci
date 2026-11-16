include $(TOPDIR)/rules.mk

LUCI_TITLE:=CrowdSec Firewall Monitor
LUCI_DESCRIPTION:=Read-only LuCI dashboard for the CrowdSec nftables firewall bouncer.
LUCI_DEPENDS:=+luci-base +crowdsec-firewall-bouncer +rpcd-mod-ucode +ucode-mod-fs
PKG_VERSION:=0.1.0
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Hell Resistor <hellresistor@protonmail.com>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
