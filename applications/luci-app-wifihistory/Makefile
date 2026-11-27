include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for WiFi Station History
LUCI_DEPENDS:=+luci-base +rpcd-mod-iwinfo +ucode +ucode-mod-fs +ucode-mod-ubus +ucode-mod-uci
LUCI_DESCRIPTION:=Track and display history of WiFi associated stations

PKG_LICENSE:=Apache-2.0

define Package/luci-app-wifihistory/conffiles
/etc/config/wifihistory
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
