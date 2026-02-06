include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for WiFi Station History
LUCI_DEPENDS:=+luci-base +rpcd-mod-iwinfo +ucode +ucode-mod-fs +ucode-mod-ubus
LUCI_DESCRIPTION:=Track and display history of WiFi associated stations

PKG_LICENSE:=Apache-2.0

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
