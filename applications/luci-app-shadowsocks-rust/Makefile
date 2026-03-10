include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-shadowsocks-rust
PKG_LICENSE:=GPL-3.0
PKG_MAINTAINER:=Jove Yu <yushijun110@gmail.com>

LUCI_TITLE:=LuCI support for Shadowsocks Rust
LUCI_DEPENDS:=+luci-base +shadowsocks-rust-config
LUCI_PKGARCH:=all
LUCI_LANGUAGES:=zh_Hans

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
