# Application structure

```
.
├── htdocs
│   └── luci-static
│       └── resources
│           └── view
│               └── example
│                   ├── form.js
│                   ├── htmlview.js
│                   └── rpc.js
├── Makefile
├── po
│   ├── templates
│   │   └── example.pot
├── README.md
└── root
    ├── etc
    │   ├── luci.example.yaml
    │   └── uci-defaults
    │       └── 80_example
    └── usr
        ├── libexec
        │   └── rpcd
        │       └── luci.example
        └── share
            ├── luci
            │   └── menu.d
            │       └── luci-app-example.json
            └── rpcd
                └── acl.d
                    └── luci-app-example.json

```

Your starting point for this layout is the `applications` directory in the LuCI git repository.

A folder must be created with a name like `luci-app-appname`.

For the rest of this documentation, `appname` is `example`.

## Root files

At least one file must exist in `applications/luci-app-example` - a Makefile. This defines what license is to be applied to the code, and what packages are required for the package to be installed. In this example app, YAML is processed by the Lua code, so **lyaml** is marked as a dependency.

A `README.md` file is also recommended. It should provide context on what the app does, and perhaps instructions on how to test things like RPC calls.

## Javascript code

All JS code is placed under `htdocs/luci-static/resources/view/appname/`, where *appname* is the name without *luci-app-* prepended (in this case, `htdocs/luci-static-resources/view/example`).

## Menu mapping

The JSON file that maps `view/example/*` to menu items is defined in `root/usr/share/luci/menu.d`. The file is named the same as the containing folder for the app, with a **.json** extension - `luci-app-example.json`.

## ACL mapping

The JSON file that defines what APIs may be called is defined in `root/usr/share/rpcd/acl.d/`. The file is named the same as the containing folder for the app, with a **.json** extension - `luci-app-example.json`.

If ACL rights are not granted correctly, the web UI will show an error indicating "Access denied". Fix the ACL file, deploy it to the device/virtual machine, and restart `rpcd`.

Note that there may be legacy UCI (luci-compat) grants ACL in place, permitting read and write for all applications to all UCI resources. This should not be taken as a reason to skip granting the correct ACLs in your application. To ensure your ACLs are correct, you can move `acl.d/luci-compat` out of the way and restart `rpcd`. Put the file back when you've finished testing, as other LuCI applications may depend on it.

## Additional files

LuCI apps do not have to have any additional files such as Lua scripts or UCI default setup. However, here's how you deal with those if needed.

### Installing additional files

Any additional files needed by this application should be placed in `root/` using the directory tree that applies. This example application needs a RPCd script to be installed, so it places a file in `root/usr/libexec/rpcd/` and calls it `luci.example`. Scripts must have their execution bit set, and committed to the git repository with the bit set.

This example application also installs a file in `/etc/` by putting it in `root/etc/luci.example.yaml`.

The OpenWrt packaging system will install these files automatically.

### UCI defaults

UCI defaults are documented in the [OpenWrt wiki](https://openwrt.org/docs/guide-developer/uci-defaults). They create default files in the running system's `/etc/config/` directory.

Place any defaults in the file `root/etc/uci-defaults/appname`, possibly with a number prepended to control sequencing - this example package uses `80_example` as the filename.
