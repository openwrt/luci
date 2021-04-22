#
# Copyright (C) 2008-2015 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

LUCI_NAME?=$(notdir ${CURDIR})
LUCI_TYPE?=$(word 2,$(subst -, ,$(LUCI_NAME)))
LUCI_BASENAME?=$(patsubst luci-$(LUCI_TYPE)-%,%,$(LUCI_NAME))
LUCI_LANGUAGES:=$(sort $(filter-out templates,$(notdir $(wildcard ${CURDIR}/po/*))))
LUCI_DEFAULTS:=$(notdir $(wildcard ${CURDIR}/root/etc/uci-defaults/*))
LUCI_PKGARCH?=$(if $(realpath src/Makefile),,all)
LUCI_SECTION?=luci
LUCI_CATEGORY?=LuCI
LUCI_URL?=https://github.com/openwrt/luci
LUCI_MAINTAINER?=OpenWrt LuCI community

# Language code titles
LUCI_LANG.ar=العربية (Arabic)
LUCI_LANG.bg=български (Bulgarian)
LUCI_LANG.bn_BD=বাংলা (Bengali)
LUCI_LANG.ca=Català (Catalan)
LUCI_LANG.cs=Čeština (Czech)
LUCI_LANG.de=Deutsch (German)
LUCI_LANG.el=Ελληνικά (Greek)
LUCI_LANG.en=English
LUCI_LANG.es=Español (Spanish)
LUCI_LANG.fi=Suomi (Finnish)
LUCI_LANG.fr=Français (French)
LUCI_LANG.he=עִבְרִית (Hebrew)
LUCI_LANG.hi=हिंदी (Hindi)
LUCI_LANG.hu=Magyar (Hungarian)
LUCI_LANG.it=Italiano (Italian)
LUCI_LANG.ja=日本語 (Japanese)
LUCI_LANG.ko=한국어 (Korean)
LUCI_LANG.mr=Marāṭhī (Marathi)
LUCI_LANG.ms=Bahasa Melayu (Malay)
LUCI_LANG.nb_NO=Norsk (Norwegian)
LUCI_LANG.nl=Nederlands (Dutch)
LUCI_LANG.pl=Polski (Polish)
LUCI_LANG.pt_BR=Português do Brasil (Brazilian Portuguese)
LUCI_LANG.pt=Português (Portuguese)
LUCI_LANG.ro=Română (Romanian)
LUCI_LANG.ru=Русский (Russian)
LUCI_LANG.sk=Slovenčina (Slovak)
LUCI_LANG.sv=Svenska (Swedish)
LUCI_LANG.tr=Türkçe (Turkish)
LUCI_LANG.uk=Українська (Ukrainian)
LUCI_LANG.vi=Tiếng Việt (Vietnamese)
LUCI_LANG.zh_Hans=简体中文 (Chinese Simplified)
LUCI_LANG.zh_Hant=繁體中文 (Chinese Traditional)

# Submenu titles
LUCI_MENU.col=1. Collections
LUCI_MENU.mod=2. Modules
LUCI_MENU.app=3. Applications
LUCI_MENU.theme=4. Themes
LUCI_MENU.proto=5. Protocols
LUCI_MENU.lib=6. Libraries

# Language aliases
LUCI_LC_ALIAS.bn_BD=bn
LUCI_LC_ALIAS.nb_NO=no
LUCI_LC_ALIAS.pt_BR=pt-br
LUCI_LC_ALIAS.zh_Hans=zh-cn
LUCI_LC_ALIAS.zh_Hant=zh-tw

# Default locations
HTDOCS = /www
LUA_LIBRARYDIR = /usr/lib/lua
LUCI_LIBRARYDIR = $(LUA_LIBRARYDIR)/luci


# 1: everything expect po subdir or only po subdir
define findrev
  $(shell \
    if git log -1 >/dev/null 2>/dev/null; then \
      set -- $$(git log -1 --format="%ct %h" --abbrev=7 -- $(if $(1),. ':(exclude)po',po)); \
      if [ -n "$$1" ]; then
        secs="$$(($$1 % 86400))"; \
        yday="$$(date --utc --date="@$$1" "+%y.%j")"; \
        printf 'git-%s.%05d-%s' "$$yday" "$$secs" "$$2"; \
      else \
        echo "unknown"; \
      fi; \
    else \
      ts=$$(find . -type f $(if $(1),-not) -path './po/*' -printf '%T@\n' 2>/dev/null | sort -rn | head -n1 | cut -d. -f1); \
      if [ -n "$$ts" ]; then \
        secs="$$(($$ts % 86400))"; \
        date="$$(date --utc --date="@$$ts" "+%y%m%d")"; \
        printf '%s.%05d' "$$date" "$$secs"; \
      else \
        echo "unknown"; \
      fi; \
    fi \
  )
endef

PKG_NAME?=$(LUCI_NAME)
PKG_RELEASE?=1
PKG_INSTALL:=$(if $(realpath src/Makefile),1)
PKG_BUILD_DEPENDS += lua/host luci-base/host LUCI_CSSTIDY:csstidy/host LUCI_SRCDIET:luasrcdiet/host $(LUCI_BUILD_DEPENDS)
PKG_CONFIG_DEPENDS += CONFIG_LUCI_SRCDIET CONFIG_LUCI_JSMIN CONFIG_LUCI_CSSTIDY

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)

PKG_PO_VERSION?=$(if $(DUMP),x,$(strip $(call findrev)))
PKG_SRC_VERSION?=$(if $(DUMP),x,$(strip $(call findrev,1)))

PKG_GITBRANCH?=$(if $(DUMP),x,$(strip $(shell \
	variant="LuCI"; \
	if git log -1 >/dev/null 2>/dev/null; then \
		branch="$$(git branch --remote --verbose --no-abbrev --contains 2>/dev/null | \
			sed -rne 's|^[^/]+/([^ ]+) [a-f0-9]{40} .+$$|\1|p' | head -n1)"; \
		if [ "$$branch" != "master" ]; then \
			variant="LuCI $$branch branch"; \
		else \
			variant="LuCI Master"; \
		fi; \
	fi; \
	echo "$$variant" \
)))

include $(INCLUDE_DIR)/package.mk

# LUCI_SUBMENU: the submenu-item below the LuCI top-level menu inside OpoenWrt menuconfig
#               usually one of the LUCI_MENU.* definitions
# LUCI_SUBMENU_DEFAULT: the regular SUBMENU defined by LUCI_TYPE or derrived from the packagename
# LUCI_SUBMENU_FORCED: manually forced value SUBMENU to set to by explicit definiton
#                      can be any string, "none" disables the creation of a submenu 
#                      most usefull in combination with LUCI_CATEGORY, to make the package appear
#                      anywhere in the menu structure
LUCI_SUBMENU_DEFAULT=$(if $(LUCI_MENU.$(LUCI_TYPE)),$(LUCI_MENU.$(LUCI_TYPE)),$(LUCI_MENU.app))
LUCI_SUBMENU=$(if $(LUCI_SUBMENU_FORCED),$(LUCI_SUBMENU_FORCED),$(LUCI_SUBMENU_DEFAULT))

define Package/$(PKG_NAME)
  SECTION:=$(LUCI_SECTION)
  CATEGORY:=$(LUCI_CATEGORY)
ifneq ($(LUCI_SUBMENU),none)
  SUBMENU:=$(LUCI_SUBMENU)
endif
  TITLE:=$(if $(LUCI_TITLE),$(LUCI_TITLE),LuCI $(LUCI_NAME) $(LUCI_TYPE))
  DEPENDS:=$(LUCI_DEPENDS)
  VERSION:=$(if $(PKG_VERSION),$(PKG_VERSION),$(PKG_SRC_VERSION))
  $(if $(LUCI_EXTRA_DEPENDS),EXTRA_DEPENDS:=$(LUCI_EXTRA_DEPENDS))
  $(if $(LUCI_PKGARCH),PKGARCH:=$(LUCI_PKGARCH))
  $(if $(PKG_PROVIDES),PROVIDES:=$(PKG_PROVIDES))
  URL:=$(LUCI_URL)
  MAINTAINER:=$(LUCI_MAINTAINER)
endef

ifneq ($(LUCI_DESCRIPTION),)
 define Package/$(PKG_NAME)/description
   $(strip $(LUCI_DESCRIPTION))
 endef
endif

define Build/Prepare
	for d in luasrc htdocs root src; do \
	  if [ -d ./$$$$d ]; then \
	    mkdir -p $(PKG_BUILD_DIR)/$$$$d; \
		$(CP) ./$$$$d/* $(PKG_BUILD_DIR)/$$$$d/; \
	  fi; \
	done
	$(call Build/Prepare/Default)
endef

define Build/Configure
endef

ifneq ($(wildcard ${CURDIR}/src/Makefile),)
 MAKE_PATH := src/
 MAKE_VARS += FPIC="$(FPIC)" LUCI_VERSION="$(PKG_SRC_VERSION)" LUCI_GITBRANCH="$(PKG_GITBRANCH)"

 define Build/Compile
	$(call Build/Compile/Default,clean compile)
 endef
else
 define Build/Compile
 endef
endif

define Package/$(PKG_NAME)/install
	if [ -d $(PKG_BUILD_DIR)/luasrc ]; then \
	  $(INSTALL_DIR) $(1)$(LUCI_LIBRARYDIR); \
	  cp -pR $(PKG_BUILD_DIR)/luasrc/* $(1)$(LUCI_LIBRARYDIR)/; \
	  $(FIND) $(1)$(LUCI_LIBRARYDIR)/ -type f -name '*.luadoc' | $(XARGS) rm; \
	  $(if $(CONFIG_LUCI_SRCDIET),$(call SrcDiet,$(1)$(LUCI_LIBRARYDIR)/),true); \
	  $(call SubstituteVersion,$(1)$(LUCI_LIBRARYDIR)/); \
	else true; fi
	if [ -d $(PKG_BUILD_DIR)/htdocs ]; then \
	  $(INSTALL_DIR) $(1)$(HTDOCS); \
	  cp -pR $(PKG_BUILD_DIR)/htdocs/* $(1)$(HTDOCS)/; \
	  $(if $(CONFIG_LUCI_JSMIN),$(call JsMin,$(1)$(HTDOCS)/),true); \
	  $(if $(CONFIG_LUCI_CSSTIDY),$(call CssTidy,$(1)$(HTDOCS)/),true); \
	else true; fi
	if [ -d $(PKG_BUILD_DIR)/root ]; then \
	  $(INSTALL_DIR) $(1)/; \
	  cp -pR $(PKG_BUILD_DIR)/root/* $(1)/; \
	else true; fi
	if [ -d $(PKG_BUILD_DIR)/src ]; then \
	  $(call Build/Install/Default) \
	  $(CP) $(PKG_INSTALL_DIR)/* $(1)/; \
	else true; fi
endef

ifndef Package/$(PKG_NAME)/postinst
define Package/$(PKG_NAME)/postinst
[ -n "$${IPKG_INSTROOT}" ] || {$(foreach script,$(LUCI_DEFAULTS),
	(. /etc/uci-defaults/$(script)) && rm -f /etc/uci-defaults/$(script))
	rm -f /tmp/luci-indexcache
	rm -rf /tmp/luci-modulecache/
	killall -HUP rpcd 2>/dev/null
	exit 0
}
endef
endif

# some generic macros that can be used by all packages
define SrcDiet
	$(FIND) $(1) -type f -name '*.lua' | while read src; do \
		if LUA_PATH="$(STAGING_DIR_HOSTPKG)/lib/lua/5.1/?.lua" luasrcdiet --noopt-binequiv -o "$$$$src.o" "$$$$src"; \
		then mv "$$$$src.o" "$$$$src"; fi; \
	done
endef

define JsMin
	$(FIND) $(1) -type f -name '*.js' | while read src; do \
		if jsmin < "$$$$src" > "$$$$src.o"; \
		then mv "$$$$src.o" "$$$$src"; fi; \
	done
endef

define CssTidy
	$(FIND) $(1) -type f -name '*.css' | while read src; do \
		if csstidy "$$$$src" --template=highest --remove_last_semicolon=true "$$$$src.o"; \
		then mv "$$$$src.o" "$$$$src"; fi; \
	done
endef

define SubstituteVersion
	$(FIND) $(1) -type f -name '*.htm' | while read src; do \
		$(SED) 's/<%# *\([^ ]*\)PKG_VERSION *%>/\1$(if $(PKG_VERSION),$(PKG_VERSION),$(PKG_SRC_VERSION))/g' \
		    -e 's/"\(<%= *\(media\|resource\) *%>[^"]*\.\(js\|css\)\)"/"\1?v=$(if $(PKG_VERSION),$(PKG_VERSION),$(PKG_SRC_VERSION))"/g' \
			"$$$$src"; \
	done
endef

# additional setting luci-base package
ifeq ($(PKG_NAME),luci-base)
 define Package/luci-base/config
   config LUCI_SRCDIET
	bool "Minify Lua sources"
	default n

   config LUCI_JSMIN
	bool "Minify JavaScript sources"
	default y

   config LUCI_CSSTIDY
        bool "Minify CSS files"
        default y

   menu "Translations"$(foreach lang,$(LUCI_LANGUAGES),

     config LUCI_LANG_$(lang)
	   tristate "$(shell echo '$(LUCI_LANG.$(lang))' | sed -e 's/^.* (\(.*\))$$/\1/') ($(lang))")

   endmenu
 endef
endif


LUCI_BUILD_PACKAGES := $(PKG_NAME)

# 1: LuCI language code
# 2: BCP 47 language tag
define LuciTranslation
  define Package/luci-i18n-$(LUCI_BASENAME)-$(1)
    SECTION:=luci
    CATEGORY:=LuCI
    TITLE:=$(PKG_NAME) - $(1) translation
    HIDDEN:=1
    DEFAULT:=LUCI_LANG_$(2)||(ALL&&m)
    DEPENDS:=$(PKG_NAME)
    VERSION:=$(PKG_PO_VERSION)
    PKGARCH:=all
  endef

  define Package/luci-i18n-$(LUCI_BASENAME)-$(1)/description
    Translation for $(PKG_NAME) - $(LUCI_LANG.$(2))
  endef

  define Package/luci-i18n-$(LUCI_BASENAME)-$(1)/install
	$$(INSTALL_DIR) $$(1)/etc/uci-defaults
	echo "uci set luci.languages.$(subst -,_,$(1))='$(LUCI_LANG.$(2))'; uci commit luci" \
		> $$(1)/etc/uci-defaults/luci-i18n-$(LUCI_BASENAME)-$(1)
	$$(INSTALL_DIR) $$(1)$(LUCI_LIBRARYDIR)/i18n
	$(foreach po,$(wildcard ${CURDIR}/po/$(2)/*.po), \
		po2lmo $(po) \
			$$(1)$(LUCI_LIBRARYDIR)/i18n/$(basename $(notdir $(po))).$(1).lmo;)
  endef

  define Package/luci-i18n-$(LUCI_BASENAME)-$(1)/postinst
	[ -n "$$$${IPKG_INSTROOT}" ] || {
		(. /etc/uci-defaults/luci-i18n-$(LUCI_BASENAME)-$(1)) && rm -f /etc/uci-defaults/luci-i18n-$(LUCI_BASENAME)-$(1)
		exit 0
	}
  endef

  LUCI_BUILD_PACKAGES += luci-i18n-$(LUCI_BASENAME)-$(1)

endef

$(foreach lang,$(LUCI_LANGUAGES),$(eval $(call LuciTranslation,$(firstword $(LUCI_LC_ALIAS.$(lang)) $(lang)),$(lang))))
$(foreach pkg,$(LUCI_BUILD_PACKAGES),$(eval $(call BuildPackage,$(pkg))))
