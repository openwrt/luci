# Reference: LuCI Modules

See [online wiki](https://github.com/openwrt/luci/wiki/Modules) for latest version.

## Categories

The LuCI modules are divided into several category directories, namely:
* applications - Single applications or plugins for other modules
* i18n - Translation files
* libs - libraries of Luci
* modules - main modules of Luci itself
* protocols - network related plugins
* themes - Frontend themes

Each module goes into a subdirectory of this category-directories.

## Module directory
The contents of a module directory are as follows:

### Makefile
This is the module's makefile. If the module just contains Lua sourcecode or resources then the following Makefile should suffice.
```Makefile
include $(TOPDIR)/rules.mk

LUCI_TITLE:=Title of my example applications
LUCI_DEPENDS:=+some-package +libsome-library +luci-app-anotherthing

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
```
 
If you have C(++) code in your module you should include a `src/` subdirectory containing another Makefile supporting a `clean`, a `compile` and an `install` target.
The `install` target should deploy its files relative to the predefined `$(DESTDIR)` variable, e.g.
```
mkdir -p $(DESTDIR)/usr/bin; cp myexecutable $(DESTDIR)/usr/bin/myexecutable
```

### src
The `src` directory is reserved for C sourcecode.

### luasrc
`luasrc` contains all Lua sourcecode files. These will automatically be stripped or compiled depending on the Make target and are installed in the LuCI installation directory.

### lua
`lua` is equivalent to `luasrc` but containing Lua files will be installed in the Lua document root.

### htdocs
All files under `htdocs` will be copied to the document root of the target webserver.

### root
All directories and files under `root` will be copied to the installation target as they are.

### dist
`dist` is reserved for the builder to create a working installation tree that will represent the filesystem on the target machine.
**DO NOT** put any files there as they will get deleted.

### ipkg
`ipkg` contains IPKG package control files, like `preinst`, `posinst`, `prerm`, `postrm`. `conffiles`.
See IPKG documentation for details.


## OpenWRT feed integration
If you want to add your module to the LuCI OpenWRT feed you have to add several sections to the `contrib/package/luci/Makefile`.

For a Web UI applications this is:

A package description:
```Makefile
define Package/luci-app-YOURMODULE
  $(call Package/luci/webtemplate)
  DEPENDS+=+some-package +some-other-package
  TITLE:=SHORT DESCRIPTION OF YOURMODULE
endef
```

A package installation target:
```Makefile
define Package/luci-app-YOURMODULE/install
  $(call Package/luci/install/template,$(1),applications/YOURMODULE)
endef
```

A module build instruction:
```Makefile
ifneq ($(CONFIG_PACKAGE_luci-app-YOURMODULE),)
  PKG_SELECTED_MODULES+=applications/YOURMODULE
endif
```

A build package call:
```Makefile
$(eval $(call BuildPackage,luci-app-YOURMODULE))
```
