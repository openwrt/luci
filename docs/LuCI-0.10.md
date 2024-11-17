# New in LuCI 0.10

See [online wiki](https://github.com/openwrt/luci/wiki/LuCI-0.10) for latest version.

This document describes new features and incompatibilities to LuCI 0.9.x.
It is targeted at module authors developing external addons to LuCI.

## I18N Changes

### API

The call conventions for the i18n api changed, there is no dedicated translation
key anymore and the english text is used for lookup instead. This was done to
ease the maintenance of language files.

Code that uses `translate()` or `i18n()` must be changed as follows:

```lua
-- old style:
translate("some_text", "Some Text")
translatef("some_format_text", "Some formatted Text: %d", 123)

-- new style:
translate("Some Text")
translatef("Some formatted Text: %d", 123)
```

Likewise for templates:

```html
<!-- old style: -->
<%:some_text Some Text%>

<!-- new style: -->
<%:Some Text%>
```

If code must support both LuCI 0.9.x and 0.10.x versions, it is suggested to write the calls as follows:
```lua
translate("Some Text", "Some Text")
```

An alternative is wrapping translate() calls into a helper function:
```lua
function tr(key, alt)
    return translate(key) or translate(alt) or alt
end
```

... which is used as follows:
```lua
tr("some_key", "Some Text")
```

### Translation File Format

Translation catalogs are now maintained in `*.po` format files.
During build those get translated into [*.lmo archives](https://github.com/openwrt/luci/wiki/LMO).

#### Components built within the LuCI tree

If components using translations are built along with the LuCI tree, the newly added *.po file are automatically
compiled into *.lmo archives during the build process. In order to bundle the appropriate *.lmo files into the
corresponding *.ipk packages, component Makefiles must include a "PO" variable specifying the files to include.

Given a module `applications/example/` which uses `po/en/example.po` and `po/en/example-extra.po`,
the `applications/example/Makefile` must be changed as follows:

```Makefile
PO = example example-extra

include ../../build/config.mk
include ../../build/module.mk
```

#### Standalone components

Authors who externally package LuCI components must prepare required `*.lmo` archives themselves.
To convert existing Lua based message catalogs to the `*.po` format, the `build/i18n-lua2po.pl` helper script can be used.
In order to convert `*.po` files into `*.lmo` files, the standalone `po2lmo` utility must be compiled as follows:

```
$ svn co http://svn.luci.subsignal.org/luci/branches/luci-0.10/libs/lmo
$ cd lmo/
$ make
$ ./src/po2lmo translations.po translations.lmo
```

Note that at the time of writing, the utility program needs Lua headers installed on the system in order to compile properly.

## CBI

### Datatypes

The server side UVL validation has been dropped to reduce space requirements on the target.
Instead it is possible to define datatypes for CBI widgets now:

```lua
opt = section:option(Value, "optname", "Title Text")
opt.datatype = "ip4addr"
```

User provided data is validated once on the frontend via JavaScript and on the server side prior to saving it.
A list of possible datatypes can be found in the [luci.cbi.datatypes](https://github.com/openwrt/luci/blob/master/modules/luci-compat/luasrc/cbi/datatypes.lua) class.

### Validation

Server-side validator functions can now return custom error messages to provide better feedback on invalid input.

```lua
opt = section:option(Value, "optname", "Title Text")

function opt.validate(self, value, section)
    if input_is_valid(value) then
        return value
    else
        return nil, "The value is invalid because ..."
    end
end
```

### Tabs

It is now possible to break up CBI sections into multiple tabs to better organize longer forms.
The TypedSection and NamedSection classes gained two new functions to define tabs, `tab()` and `taboption()`.

```lua
sct = map:section(TypedSection, "name", "type", "Title Text")

sct:tab("general", "General Tab Title", "General Tab Description")
sct:tab("advanced", "Advanced Tab Title", "Advanced Tab Description")

opt = sct:taboption("general", Value, "optname", "Title Text")
```

The `tab()` function declares a new tab and takes up to three arguments:
  * Internal name of the tab, must be unique within the section
  * Title text of the tab
  * Optional description text for the tab

The `taboption()` function wraps `option()` and assigns the option object to the given tab.
It takes up to five arguments:

  * Name of the tab to assign the option to
  * Option type, e.g. Value or DynamicList
  * Option name
  * Title text of the option
  * Optional description text of the option

If tabs are used within a particular section, the `option()` function must not be used,
doing so results in undefined behaviour.

### Hooks

The CBI gained support for `hooks` which can be used to trigger additional actions during the
life-cycle of a map:

```lua
map = Map("config", "Title Text")

function map.on_commit(self)
    -- do something if the UCI configuration got committed
end
```

The following hooks are defined:

* `on_cancel`: The user pressed cancel within a multistep Delegator or a SimpleForm instance 
* `on_init`: The CBI is about to render the Map object
* `on_parse`: The CBI is about to read received HTTP form values
* `on_save`, `on_before_save`: The CBI is about to save modified UCI configuration files
* `on_after_save`: Modified UCI configuration files just got saved
* `on_before_commit`: The CBI is about to commit the changes
* `on_commit`, `on_after_commit`, `on_before_apply`: Modified configurations got committed and the CBI is about to restart associated services
* `on_apply`, `on_after_apply`: All changes where completely applied (only works on Map instances with the apply_on_parse attribute set)

### Sortable Tables

TypedSection instances which use the `cbi/tblsection` template may now use a new attribute `sortable` to allow the user to reorder table rows.

```lua
sct = map:section(TypedSection, "name", "type", "Title Text")
sct.template = "cbi/tblsection"
sct.sortable = true
```

## JavaScript

The LuCI 0.10 branch introduced a new JavaScript file `xhr.js` which provides support routines for `XMLHttpRequest` operations.
Each theme must include this file in the `<head>` area of the document for forms to work correctly.

It should be included like this:

```html
<script src="<%=resource%>/xhr.js"></script>
```
