# SPDX-License-Identifier: Apache-2.0
include $(TOPDIR)/rules.mk

LUCI_TITLE:=Athena theme
LUCI_PKGARCH:=all
LUCI_MAINTAINER:=ZHICHENG CHEN <czhic1996@gmail.com>
LUCI_DEPENDS:=+luci-base +rpcd-mod-ucode +ucode-mod-fs +ucode-mod-uci
PKG_VERSION:=0.0.7
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0 AND MIT
PKG_LICENSE_FILES:=LICENSE licenses/gravity-ui-icons-MIT.txt

# Prebuilt modern CSS and source templates are shipped in the repository.
# Legacy csstidy cannot preserve CSS layers, color-mix() and nesting.
LUCI_MINIFY_CSS:=0
LUCI_MINIFY_UT:=0

define Package/luci-theme-athena/conffiles
/etc/config/athena
endef

define Package/luci-theme-athena/postrm
#!/bin/sh
case "$$1" in *upgrade*) exit 0 ;; esac
[ -z "$${IPKG_INSTROOT}" ] || exit 0

uci -q delete luci.themes.Athena
case "$$(uci -q get luci.main.mediaurlbase)" in
	/luci-static/athena|/luci-static/athena/)
		# Prefer Bootstrap when both its assets and template are installed.
		# With no match, LuCI can select from the remaining registrations.
		uci -q delete luci.main.mediaurlbase
		set_theme() {
			case "$$1" in /luci-static/*) ;; *) return 1 ;; esac
			local name="$${1#/luci-static/}"
			case "$$name" in ''|.|..|athena|*[!a-zA-Z0-9_-]*) return 1 ;; esac
			[ -d "/www$$1" ] &&
				[ -f "/usr/share/ucode/luci/template/themes/$$name/header.ut" ] &&
				uci set "luci.main.mediaurlbase=$$1"
		}
		if ! set_theme /luci-static/bootstrap; then
			for theme in $$(uci -q show luci.themes | sed -n 's/^\(luci\.themes\.[a-zA-Z0-9_]*\)=.*/\1/p'); do
				set_theme "$$(uci -q get "$$theme")" && break
			done
		fi
		;;
esac
uci commit luci
rm -rf /www/luci-static/athena/branding
rmdir /www/luci-static/athena 2>/dev/null || true
rm -f /tmp/luci-indexcache*
exit 0
endef

define Build/Prepare/luci-theme-athena
	$(CP) $(CURDIR)/LICENSE $(PKG_BUILD_DIR)/
	$(INSTALL_DIR) $(PKG_BUILD_DIR)/licenses
	$(CP) $(CURDIR)/licenses/gravity-ui-icons-MIT.txt $(PKG_BUILD_DIR)/licenses/
	$(SED) 's|@ATHENA_VERSION@|$(PKG_VERSION)|g' $(PKG_BUILD_DIR)/root/usr/share/rpcd/ucode/luci.athena
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
