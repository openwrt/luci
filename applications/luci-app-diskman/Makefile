include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-diskman
PKG_VERSION:=0.2.13
PKG_RELEASE:=1

PKG_MAINTAINER:=lisaac <lisaac.cn@gmail.com>
PKG_LICENSE:=AGPL-3.0

LUCI_TITLE:=Disk Manager interface for LuCI
LUCI_DEPENDS:= \
	+luci-compat +blkid +e2fsprogs +parted +smartmontools +dosfstools \
	+kmod-fs-msdos +kmod-fs-ntfs3 +kmod-fs-exfat +exfat-mkfs \
	+exfat-fsck +kmod-nls-cp932 +kmod-nls-cp936 +kmod-nls-cp950 \
	+PACKAGE_$(PKG_NAME)_INCLUDE_btrfs_progs:btrfs-progs \
	+PACKAGE_$(PKG_NAME)_INCLUDE_lsblk:lsblk \
	+PACKAGE_$(PKG_NAME)_INCLUDE_mdadm:mdadm \
	+PACKAGE_$(PKG_NAME)_INCLUDE_kmod_md_raid456:mdadm \
	+PACKAGE_$(PKG_NAME)_INCLUDE_kmod_md_raid456:kmod-md-raid456 \
	+PACKAGE_$(PKG_NAME)_INCLUDE_kmod_md_linears:mdadm \
	+PACKAGE_$(PKG_NAME)_INCLUDE_kmod_md_linears:kmod-md-linear

define Package/luci-app-diskman/config
config PACKAGE_$(PKG_NAME)_INCLUDE_btrfs_progs
	depends on PACKAGE_$(PKG_NAME)
	bool "Include btrfs-progs"
	default y

config PACKAGE_$(PKG_NAME)_INCLUDE_lsblk
	depends on PACKAGE_$(PKG_NAME)
	bool "Include lsblk"
	default y

config PACKAGE_$(PKG_NAME)_INCLUDE_mdadm
	depends on PACKAGE_$(PKG_NAME)
	bool "Include mdadm"
	default n

config PACKAGE_$(PKG_NAME)_INCLUDE_kmod_md_raid456
	depends on PACKAGE_$(PKG_NAME)_INCLUDE_mdadm
	bool "Include kmod-md-raid456"
	default n

config PACKAGE_$(PKG_NAME)_INCLUDE_kmod_md_linears
	depends on PACKAGE_$(PKG_NAME)_INCLUDE_mdadm
	bool "Include kmod-md-linear"
	default n
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
