# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright 2017-2026 MOSSDeF, Stan Grishin (stangri@melmac.ca).

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-https-dns-proxy
PKG_LICENSE:=AGPL-3.0-or-later
PKG_MAINTAINER:=Stan Grishin <stangri@melmac.ca>
PKG_VERSION:=2025.12.29
PKG_RELEASE:=4

LUCI_TITLE:=DNS Over HTTPS Proxy Web UI
LUCI_URL:=https://github.com/mossdef-org/luci-app-https-dns-proxy/
LUCI_DESCRIPTION:=Provides Web UI for DNS Over HTTPS Proxy
LUCI_DEPENDS:=+luci-base +https-dns-proxy

define Package/$(PKG_NAME)/config
# shown in make menuconfig <Help>
help
	$(LUCI_TITLE)
	.
	Version: $(PKG_VERSION)-$(PKG_RELEASE)
endef

# Consolidate individual provider JSON files into providers.json in the build tree.
# luci.mk's Build/Prepare calls Build/Prepare/$(LUCI_NAME) as a per-package hook.
# The merged file lands in root/ so luci.mk's install step copies it automatically.
define Build/Prepare/luci-app-https-dns-proxy
	@if [ -d $(PKG_BUILD_DIR)/root/usr/share/https-dns-proxy/providers ] \
		&& ls $(PKG_BUILD_DIR)/root/usr/share/https-dns-proxy/providers/*.json >/dev/null 2>&1; then \
			sep=''; printf '[' > $(PKG_BUILD_DIR)/root/usr/share/https-dns-proxy/providers.json; \
			for f in $(PKG_BUILD_DIR)/root/usr/share/https-dns-proxy/providers/*.json; do \
				printf '%s' "$$$$sep" >> $(PKG_BUILD_DIR)/root/usr/share/https-dns-proxy/providers.json; \
				cat "$$$$f" >> $(PKG_BUILD_DIR)/root/usr/share/https-dns-proxy/providers.json; \
				sep=','; \
			done; \
			printf ']' >> $(PKG_BUILD_DIR)/root/usr/share/https-dns-proxy/providers.json; \
	fi
	@if grep -q '"title"' $(PKG_BUILD_DIR)/root/usr/share/https-dns-proxy/providers.json 2>/dev/null; then \
		rm -rf $(PKG_BUILD_DIR)/root/usr/share/https-dns-proxy/providers; \
	else \
		rm -f $(PKG_BUILD_DIR)/root/usr/share/https-dns-proxy/providers.json; \
	fi
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
