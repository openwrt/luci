# Example app for js based Luci

This app is meant to be a kind of template, example or starting point for developing new LuCI apps.

## Application structure

See `structure.md` for details on how to lay out a LuCI application.

## Working with this example app

Install the app on your OpenWrt installation. This can be an actual router/device, or something like a QEMU virtual machine.

`opkg install luci-app-example`

Visit the web UI for the device/virtual machine where the package was installed, log in to OpenWrt, and **Example** should be present in the navigation menu.

## Editing the code

You can either do direct editing on the device/virtual machine, or use something like sshfs to have remote access from your development computer.

By default, the code is minified by the build process, which makes editing it non-trivial. You can either change the build process, or just copy the file content from the git repository and replace the content on disk.

Javascript code can be found on the device/virtual machine in `/www/luci-static/resources/view/example/`.

## [form.js](./htdocs/luci-static/resources/view/example/form.js)

This is a JS view that uses the **form.Map** approach to providing a form that can change the configuration. It relies on UCI access, and the relevant ACL declarations are in `root/usr/share/rpcd/acl.d/luci-app-example.json`.

The declarations are `luci-app-example > read > uci` and `luci-app-example > write > uci`. Note that for both permissions, the node name "example" is provided as a list argument to the interface type (**uci**); this maps to `/etc/config/example`.

Since form.Map and form.JSONMap create Promises, you cannot embed them inside a `E()`-built structure.

## [htmlview.js](./htdocs/luci-static/resources/view/example/htmlview.js)

This is a read-only view that uses `E()` to create DOM nodes.

Data is fetched via the function defined in `load()` - these loads are done as **Promises**, with the promise results stored in an array. Multiple load functions results are available in the array, and can be accessed via a single argument passed to the `render()` function.

This code relies on the same ACL grants as form.js.

The signature for `E()` is `E(node_type, {node attributes}, [child nodes])`.

## rpc.js

The RPC JS page is read-only, and demonstrates using RPC calls to get data. It also demonstrates using the JSONMap form object for mapping a configuration to a form, but makes the form read-only for display purposes.

The configuration is stored in `/etc/config/example`. The file must exist and created on device boot by UCI defaults script in `/root/etc/uci-defaults/80_example`. The [developer guide](https://openwrt.org/docs/guide-developer/uci-defaults) has more details about UCI defaults.

The RPCd script is stored as `/usr/libexec/rpcd/luci.example`, and can be called via ubus.

It relies on RPC access, and the relevant ACL declarations are in `root/usr/share/rpcd/acl.d/luci-app-example.json`.

The declaration is `luci-app-example > read > ubus > luci.example`; the list of names under this key is the list of APIs that can be called.

# Installation

To install the luci-app-example to your OpenWrt instance (assuming your OpenWRT instance is on 192.168.1.1):
```
scp -r root/* root@192.168.1.1:/
scp -r htdocs/* root@192.168.1.1:/www/
# execute the UCI defaults script to create the /etc/config/example
ssh root@192.168.1.1 "sh /etc/uci-defaults/80_example"
```

Then you need to re-login to the web interface and you'll see a new Example item in main menu.

# ACLs

A small note on ACLs. They are global for the entire web UI - the declaration of **luci-app-example** in a file called `acl.d/luci-app-example` is just a naming convention; nothing enforces that only the code in **luci-app-example** is mutating `/etc/config/example`. Once the ACL is defined to allow reads/writes to a UCI node, any code running from the web UI can make changes to that node.
