# SPDX-License-Identifier: Apache-2.0
#
include $(TOPDIR)/rules.mk

LUCI_TITLE:=Firewall Live View
LUCI_DESCRIPTION:=Live firewall log table (nftables/fw4 and iptables LOG) with filters
LUCI_DEPENDS:=+luci-base +logd +jsonfilter
LUCI_PKGARCH:=all

PKG_VERSION:=0.1.37
PKG_RELEASE:=1


PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Lucas Albers <lucas.b.albers@gmail.com>

include ../../luci.mk

define Package/luci-app-fwlive/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
[ "$$1" = "remove" ] || exit 0
. /usr/libexec/fwlive-logging.sh
# Best-effort restore: always exit 0 so a transient lock/pending-staging
# failure cannot strand the package half-removed. Baseline is kept on
# failure (restore_wan_log_baseline) for admin recovery; helpers are still
# present while this prerm runs.
restore_wan_log_baseline || logger -t fwlive "WAN log baseline restore failed during uninstall"
exit 0
endef

# call BuildPackage - OpenWrt buildroot signature
