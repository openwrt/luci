# Creating Themes
**Note:** You have already read the [Module Reference](./Modules.md).

We assume you want to call your new theme `mytheme`.
Replace `mytheme` with your module name every time this is mentioned in this Howto.

## Creating the structure
At first create a new theme directory `themes/luci-theme-mytheme`.

Create a `Makefile` inside your theme directory with the following content:
```Makefile
include $(TOPDIR)/rules.mk

LUCI_TITLE:=Title of mytheme

include ../../luci.mk
# call BuildPackage - OpenWrt buildroot signature
```

Create the following directory structure inside your theme directory.
* htdocs
  * luci-static
    * `mytheme`
    * resources
* root
  * etc
    * uci-defaults
* ucode
  * template
    * themes
      * `mytheme`


## Designing
Create two LuCI ucode Templates named `header.ut` and `footer.ut` under `ucode/template/themes/mytheme`.
The `header.ut` will be included at the beginning of each rendered page and the `footer.ut` at the end.
So your `header.ut` will probably contain a DOCTYPE description, headers,
the menu and layout of the page and the `footer.ut` will close all remaining open tags and may add a footer bar.
But hey that's your choice: you are the designer ;-).

Just make sure your `header.ut` begins with the following lines:
```
{%
  import { getuid, getspnam } from 'luci.core';

  const boardinfo = ubus.call('system', 'board');

  http.prepare_content('text/html; charset=UTF-8');
-%}
```

This ensures your content is sent to the client with the right content type.
Of course you can adapt `text/html` to your needs.


Put any stylesheets, Javascripts, images, ... into `htdocs/luci-static/mytheme`.
Refer to this directory in your header and footer templates as: `{{ media }}`.
That means for an icon `htdocs/luci-static/mytheme/logo.svg` you would write:

```html
<link rel="icon" href="{{ media }}/logo.svg" sizes="any">
```

## Making the theme selectable
If you are done with your work there are two last steps to do.
To make your theme OpenWrt-capable and selectable on the settings page, create a file `root/etc/uci-defaults/luci-theme-mytheme` with the following contents:

```sh
#!/bin/sh
uci batch <<-EOF
	set luci.themes.MyTheme=/luci-static/mytheme
  set luci.main.mediaurlbase=/luci-static/mytheme
	commit luci
EOF
exit 0
```

and another file `ipkg/postinst` with the following content:
```sh
#!/bin/sh
[ -n "${IPKG_INSTROOT}" ] || {
	( . /etc/uci-defaults/luci-theme-mytheme ) && rm -f /etc/uci-defaults/luci-theme-mytheme
}
```

This correctly registers the template with LuCI when it gets installed.

That's all. Now send your theme to the LuCI developers to get it into the development repository - if you like.
