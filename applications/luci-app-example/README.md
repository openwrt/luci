# Example app for js based Luci

This app is meant to be a kind of template, example or starting point for developing new luci apps.

It provides two pages in the admin backend:
* [htmlview.js](./htdocs/luci-static/resources/view/example/htmlview.js) is based on a view with a form and makes use of internal models.
* [form.js](./htdocs/luci-static/resources/view/example/form.js) uses the `E()` method to create more flexible pages.

The view based page is used to modify the example configuration.

The html view page just shows the configured values.

The configuration is stored in `/etc/config/example`.
The file must exist and created on device boot by UCI defaults script in `/root/etc/uci-defaults/80_example`.
More details about the UCI defaults https://openwrt.org/docs/guide-developer/uci-defaults

To install the luci-app-example to your OpenWrt instance use:
```
scp -r root/* root@192.168.1.1:/
scp -r htdocs/* root@192.168.1.1:/www/
# execute the UCI defaults script to create the /etc/config/example
ssh root@192.168.1.1 "sh /etc/uci-defaults/80_example"
```

Then you need to re-login to LUCI and you'll see a new Example item in main menu.
