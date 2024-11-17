# HowTo: Create Themes
**Note:** You have already read the [Module Reference](./Modules.md) and the [Template Reference](./Templates.md).

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
* ipkg
* htdocs
  * luci-static
    * `mytheme`
* luasrc
  * view
   * themes
      * `mytheme`
* root
  * etc
   * uci-defaults


## Designing
Create two LuCI HTML-Templates named `header.htm` and `footer.htm` under `luasrc/view/themes/mytheme`.
The `header.htm` will be included at the beginning of each rendered page and the `footer.htm` at the end.
So your `header.htm` will probably contain a DOCTYPE description, headers,
the menu and layout of the page and the `footer.htm` will close all remaining open tags and may add a footer bar.
But hey that's your choice: you are the designer ;-).

Just make sure your `header.htm` begins with the following lines:
```
<%
require("luci.http").prepare_content("text/html")
-%>
```

This ensures your content is sent to the client with the right content type.
Of course you can adapt `text/html` to your needs.


Put any stylesheets, Javascripts, images, ... into `htdocs/luci-static/mytheme`.
Refer to this directory in your header and footer templates as: `<%=media%>`.
That means for a stylesheet `htdocs/luci-static/mytheme/cascade.css` you would write:
```html
<link rel="stylesheet" href="<%=media%>/cascade.css" />
```

## Making the theme selectable
If you are done with your work there are two last steps to do.
To make your theme OpenWrt-capable and selectable on the settings page, create a file `root/etc/uci-defaults/luci-theme-mytheme` with the following contents:
```sh
#!/bin/sh
uci batch <<-EOF
	set luci.themes.MyTheme=/luci-static/mytheme
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
