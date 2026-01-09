# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright 2017-2026 MOSSDeF, Stan Grishin (stangri@melmac.ca).

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-advanced-reboot
PKG_LICENSE:=AGPL-3.0-or-later
PKG_MAINTAINER:=Stan Grishin <stangri@melmac.ca>
PKG_VERSION:=1.1.1
PKG_RELEASE:=9

PKG_BUILD_DEPENDS:=jq/host

LUCI_TITLE:=Advanced Linksys Reboot Web UI
LUCI_URL:=https://github.com/stangri/luci-app-advanced-reboot/
LUCI_DESCRIPTION:=Provides Web UI (found under System/Advanced Reboot) to reboot supported Linksys and ZyXEL routers to\
	an alternative partition. Also provides Web UI to shut down (power off) your device. 	Supported dual-partition\
	routers are listed at https://docs.openwrt.melmac.ca/luci-app-advanced-reboot/
LUCI_DEPENDS:=+luci-base +jshn

define Package/$(PKG_NAME)/config
# shown in make menuconfig <Help>
help
	$(LUCI_TITLE)
	.
	Version: $(PKG_VERSION)-$(PKG_RELEASE)
endef

include ../../luci.mk

# Prune individual device JSON directories from the package image.
# The default LuCI install logic from luci.mk copies everything under
# htdocs/, root/, etc. We let it run, then remove folders we keep only
# in source control.
define Package/$(PKG_NAME)/install
	$(call Package/$(PKG_NAME)/install/default,$(1))
	@mkdir -p $(1)/usr/share/advanced-reboot
	@if [ -d $(1)/usr/share/advanced-reboot/devices ] \
		&& ls $(1)/usr/share/advanced-reboot/devices/*.json >/dev/null 2>&1; then \
			$(STAGING_DIR_HOST)/bin/jq -s '.' $(1)/usr/share/advanced-reboot/devices/*.json \
				> $(1)/usr/share/advanced-reboot/devices.json; \
	fi
	@if [ -s $(1)/usr/share/advanced-reboot/devices.json ]; then \
		$(RM) -r $(1)/usr/share/advanced-reboot/devices $(1)/usr/share/advanced-reboot/devices.disabled || true; \
	fi
endef

# call BuildPackage - OpenWrt buildroot signature
