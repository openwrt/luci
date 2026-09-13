#
# Copyright (C) 2026 Ivan Kvashonkin
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-theme-footstrap
# luci.mk keys the Build/Prepare hook name on LUCI_NAME, which defaults to the checkout's
# directory name — a differently-named checkout symlinked into a feed would silently skip the
# hook below. Pin it.
LUCI_NAME:=luci-theme-footstrap

PKG_MAINTAINER:=Ivan Kvashonkin <vizzlef@gmail.com>

LUCI_TITLE:=Footstrap Theme
LUCI_DESCRIPTION:=A standalone LuCI theme with a collapsible sidebar or top bar, light/dark \
	modes, a menu search and a client-side page router
# +luci-base is the WHOLE list, and keeping it that way is a design constraint: the theme ships no
# framework and every page it draws is drawn by luci-base's own view JS.
LUCI_DEPENDS:=+luci-base
LUCI_PKGARCH:=all

# csstidy is old enough to mangle :has() and color-mix(), both of which this sheet uses heavily —
# it silently drops the declarations and the layout goes with them. The stylesheet is already
# minified (see the note below), so there is nothing for it to win back.
LUCI_MINIFY_CSS:=0
#
# The JS keeps luci.mk's default jsmin. The catch, and why the source is written the way it is:
# jsmin decides `/` = regex-or-division from a ONE-character lookback, and `n` (of `return`) and
# `>` (of `=>`) are not on its allow-list — so `return /re/` makes it eat the rest of the file AND
# EXIT 0 (openwrt/luci#8299). Every regex literal in this theme's JS is therefore parenthesised.

# Apache-2.0, and not a free choice: the stylesheet began as a fork of luci-theme-bootstrap's
# cascade.css, the ucode templates derive from LuCI's own, and a few JS helpers are verbatim
# copies. The notices travel with it.
#
# The theme carries NO webfonts: --fs-font-sans and --fs-font-mono name Manrope and JetBrains Mono
# first and the system stack after, so a machine with either installed uses it and one without
# falls through silently. Nothing here is Font Software, so there is no OFL half to declare.
PKG_LICENSE:=Apache-2.0
PKG_LICENSE_FILES:=LICENSE

# /etc/config/footstrap is SHIPPED as an empty stub and WRITTEN AT RUNTIME: Appearance -> "Save as
# default" has rpcd uci-set the router-wide axes into that very file (fs-prefs.js saveAsDefault()).
# Without this define the package manager owns it as an ordinary file and REPLACES it on upgrade,
# so an admin's saved defaults are wiped by an ordinary package upgrade, silently, reported as
# success. OpenWrt honours this for BOTH formats (include/package-pack.mk: KEEP_$(1) -> apk
# .conffiles, ipk CONTROL/conffiles). Any future root/etc/config/* must be listed here too.
define Package/luci-theme-footstrap/conffiles
/etc/config/footstrap
endef

# RELOAD, NOT RESTART: rpcd holds sessions in memory, so `restart` logs out every LuCI user —
# including the admin who just installed the theme. `reload` sends SIGHUP, which re-reads
# /usr/share/rpcd/acl.d/*, and that ACL refresh is the only thing this package needs from rpcd.
# Verified on a live router: a session survives `reload` and dies across `restart`.
define Package/luci-theme-footstrap/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	# uci-defaults registers the theme; refresh rpcd + drop caches so LuCI sees it without a
	# reboot. Calling it ourselves is belt-and-braces: OpenWrt's default_postinst also runs
	# (then deletes) every /etc/uci-defaults/* we ship, so it executes twice per install. It is
	# idempotent: the second pass finds the theme already registered and changes nothing.
	[ -f /etc/uci-defaults/30_luci-theme-footstrap ] && \
		sh /etc/uci-defaults/30_luci-theme-footstrap >/dev/null 2>&1 || true
	rm -f /tmp/luci-indexcache* /tmp/luci-modulecache/* >/dev/null 2>&1 || true
	/etc/init.d/rpcd reload >/dev/null 2>&1 || true
}
exit 0
endef

define Package/luci-theme-footstrap/postrm
#!/bin/sh
# opkg runs the OLD package's postrm with arg "upgrade" during a version upgrade and "remove" on a
# real removal. On upgrade this script MUST change nothing: reverting mediaurlbase and wiping the
# theme registration here is what flipped every updating user back to bootstrap. apk never runs
# this on upgrade (it uses the new package's pre/post-upgrade), so guarding on the arg is correct
# for both managers.
case "$$1" in *upgrade*) exit 0 ;; esac
[ -n "$${IPKG_INSTROOT}" ] || {
	uci -q delete luci.themes.Footstrap
	# Don't leave the active theme pointing at the media dir we just removed. A theme needs its
	# media dir AND its ucode template to render, so a one-part check could hand the UI to a
	# half-removed bootstrap — the blank page this branch exists to avoid.
	case "$$(uci -q get luci.main.mediaurlbase)" in
		/luci-static/footstrap*)
			[ -d /www/luci-static/bootstrap ] && \
			[ -f /usr/share/ucode/luci/template/themes/bootstrap/header.ut ] && \
				uci set luci.main.mediaurlbase=/luci-static/bootstrap ;;
	esac
	uci commit luci
	# The admin-uploaded login background and pattern, kept out of the package on purpose so they
	# survive an upgrade. A real removal is the one time they should go.
	rm -rf /etc/footstrap >/dev/null 2>&1 || true
	rm -f /tmp/luci-indexcache* /tmp/luci-modulecache/* >/dev/null 2>&1 || true
	/etc/init.d/rpcd reload >/dev/null 2>&1 || true	# see the postinst note: reload keeps sessions
}
endef

# THE STYLESHEET IS COMMITTED, NOT GENERATED HERE, and that is a deliberate difference from the
# theme's own repository. There, styles/ is sixteen files in four cascade layers whose ORDER is the
# design, and cascade.css is a build artefact that is not even tracked; a shell script concatenates
# and minifies it at package time. In this tree the other four themes each commit one cascade.css
# and have no build step, and a theme that arrives with its own build system asks a reviewer to
# audit that before they can read a stylesheet. So the sheet is generated upstream of this tree and
# committed here — unmangled and readable, which the release artefact is not.
#
# What is left for this hook is the two things luci.mk cannot do by itself.
define Build/Prepare/luci-theme-footstrap
	# luci.mk's Build/Prepare copies only src/ luasrc/ htdocs/ root/ ucode/ into
	# $(PKG_BUILD_DIR), and PKG_LICENSE_FILES resolves against THAT — so the Apache text has to be
	# put there by hand or the declaration points at nothing.
	$(CP) $(CURDIR)/LICENSE $(PKG_BUILD_DIR)/
	# The version the Appearance tab prints. luci.mk derives PKG_SRC_VERSION from the tree's git
	# history; without this the string stays at the source literal '0.0.0-dev' and every install
	# reports itself as a development build.
	$(SED) "s#const FS_VERSION *= *'[^']*'#const FS_VERSION = '$(if $(PKG_VERSION),$(PKG_VERSION),$(PKG_SRC_VERSION))'#" \
		$(PKG_BUILD_DIR)/htdocs/luci-static/resources/fs-version.js
endef

include ../../luci.mk

# THE LINE BELOW IS LOAD-BEARING AND IT IS NOT A SIGNATURE — do not delete it as boilerplate.
#
# include/scan.mk builds the package list by GREPPING the Makefiles, not by parsing them:
#   find -L package -name Makefile | xargs grep -aHE 'call (Build/DefaultTargets|BuildPackage|KernelPackage)'
# A Makefile that does not match is not in the list, so it is never dumped, no CONFIG_PACKAGE_*
# symbol is emitted for it, and `make package/<name>/compile` answers "No rule to make target" —
# with no error naming the package anywhere in the build.
#
# This theme never calls BuildPackage itself; luci.mk does, at the include above. The grep cannot
# see that. So the only thing that puts this package into the build's list is the literal text on
# the next line — which is why every luci-* Makefile carries it.
# call BuildPackage - OpenWrt buildroot signature
