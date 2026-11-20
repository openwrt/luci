# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright 2017-2026 MOSSDeF, Stan Grishin (stangri@melmac.ca).

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-advanced-reboot
PKG_LICENSE:=AGPL-3.0-or-later
PKG_MAINTAINER:=Stan Grishin <stangri@melmac.ca>
PKG_VERSION:=1.1.2
PKG_RELEASE:=6

LUCI_TITLE:=Advanced Linksys Reboot Web UI
LUCI_URL:=https://github.com/mossdef-org/luci-app-advanced-reboot/
LUCI_DESCRIPTION:=Provides Web UI (found under System/Advanced Reboot) to reboot supported Linksys and ZyXEL routers to\
	an alternative partition. Also provides Web UI to shut down (power off) your device. 	Supported dual-partition\
	routers are listed at https://docs.mossdef.org/luci-app-advanced-reboot/
LUCI_DEPENDS:=+luci-base +jshn

define Package/$(PKG_NAME)/config
# shown in make menuconfig <Help>
help
	$(LUCI_TITLE)
	.
	Version: $(PKG_VERSION)-$(PKG_RELEASE)
endef

# Consolidate individual device JSON files into devices.json in the build tree.
# luci.mk's Build/Prepare calls Build/Prepare/$(LUCI_NAME) as a per-package hook.
# The merged file lands in root/ so luci.mk's install step copies it automatically.
define Build/Prepare/luci-app-advanced-reboot
	@if [ -d $(PKG_BUILD_DIR)/root/usr/share/advanced-reboot/devices ] \
		&& ls $(PKG_BUILD_DIR)/root/usr/share/advanced-reboot/devices/*.json >/dev/null 2>&1; then \
			sep=''; printf '[' > $(PKG_BUILD_DIR)/root/usr/share/advanced-reboot/devices.json; \
			for f in $(PKG_BUILD_DIR)/root/usr/share/advanced-reboot/devices/*.json; do \
				printf '%s' "$$$$sep" >> $(PKG_BUILD_DIR)/root/usr/share/advanced-reboot/devices.json; \
				cat "$$$$f" >> $(PKG_BUILD_DIR)/root/usr/share/advanced-reboot/devices.json; \
				sep=','; \
			done; \
			printf ']' >> $(PKG_BUILD_DIR)/root/usr/share/advanced-reboot/devices.json; \
	fi
	@rm -rf $(PKG_BUILD_DIR)/root/usr/share/advanced-reboot/devices.disabled
	@if grep -q '"device"' $(PKG_BUILD_DIR)/root/usr/share/advanced-reboot/devices.json 2>/dev/null; then \
		rm -rf $(PKG_BUILD_DIR)/root/usr/share/advanced-reboot/devices; \
	else \
		rm -f $(PKG_BUILD_DIR)/root/usr/share/advanced-reboot/devices.json; \
	fi
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
