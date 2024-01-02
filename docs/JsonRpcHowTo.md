# HowTo: Using the JSON-RPC API

See [online wiki](https://github.com/openwrt/luci/wiki/JsonRpcHowTo) for latest version.

LuCI provides some of its libraries to external applications through a [JSON-RPC](https://en.wikipedia.org/wiki/JSON-RPC) API.
This Howto shows how to use it and provides information about available functions.

See also 
* wiki [rpcd](https://openwrt.org/docs/techref/rpcd)
* wiki [ubus](https://openwrt.org/docs/techref/ubus)

## Basics
To enable the API, install the following package and restart `uhttpd`:

```bash
opkg install luci-mod-rpc luci-lib-ipkg luci-compat
/etc/init.d/uhttpd restart
```

LuCI comes with an efficient JSON De-/Encoder together with a JSON-RPC-Server which implements the JSON-RPC 1.0 and 2.0 (partly) specifications.
The LuCI JSON-RPC server offers several independent APIs.
Therefore you have to use **different URLs for every exported library**.
Assuming your LuCI-Installation can be reached through `/cgi-bin/luci`, any exported library can be reached via `/cgi-bin/luci/rpc/LIBRARY`.


## Authentication
Most exported libraries will require a valid authentication to be called with.
If you get an `HTTP 403 Forbidden` status code you are probably missing a valid authentication token.
To get such a token you have to call the `login` method of the RPC-Library `auth`.
Following our example from above this login function would be provided at `/cgi-bin/luci/rpc/auth`.
The function accepts 2 parameters: `username` and `password` (of a valid user account on the host system) and returns an authentication token.

Example:
```sh
curl http://<hostname>/cgi-bin/luci/rpc/auth --data '
{
  "id": 1,
  "method": "login",
  "params": [
    "youruser",
    "somepassword"
  ]
}'
```

response:
```json
{"id":1,"result":"65e60c5a93b2f2c05e61681bf5e94b49","error":null}
```

If you want to call any exported library which requires an authentication token you have to append it as an URL parameter auth to the RPC-Server URL.
E.g. instead of calling `/cgi-bin/luci/rpc/LIBRARY` you should call `/cgi-bin/luci/rpc/LIBRARY?auth=TOKEN`.

If your JSON-RPC client is Cookie-aware (like most browsers are) you will receive the authentication token also with a session cookie and probably don't have to append it to the RPC-Server URL.


## Exported Libraries
### uci
The UCI-Library `/rpc/uci` offers functionality to interact with the Universal Configuration Interface.

**Exported Functions:**
* [(string) add(config, type)](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.model.uci.html#Cursor.add)
* [(integer) apply(config)](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.model.uci.html#Cursor.apply)
* [(object) changes([config])](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.model.uci.html#Cursor.changes)
* [(boolean) commit(config)](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.model.uci.html#Cursor.commit)
* [(boolean) delete(config, section[, option])](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.model.uci.html#Cursor.delete)
* [(boolean) delete_all(config[, type])](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.model.uci.html#Cursor.delete_all)
* [(array) foreach(config[, type])](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.model.uci.html#Cursor.foreach)
* [(mixed) get(config, section[, option])](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.model.uci.html#Cursor.get)
* [(object) get_all(config[, section])](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.model.uci.html#Cursor.get_all)
* [(mixed) get_state(config, section[, option])](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.model.uci.html#Cursor.get)
* [(boolean) revert(config)](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.model.uci.html#Cursor.revert)
* [(name) section(config, type, name, values)](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.model.uci.html#Cursor.section)
* [(boolean) set(config, section, option, value)](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.model.uci.html#Cursor.set)
* [(boolean) tset(config, section, values)](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.model.uci.html#Cursor.tset)

Example:
```sh
curl http://<hostname>/cgi-bin/luci/rpc/uci?auth=yourtoken --data '
{
  "method": "get_all",
  "params": [ "network" ]
}'
```

### fs
The Filesystem library `/rpc/fs` offers functionality to interact with the filesystem on the host machine.

**Exported Functions:**

* [Complete luci.fs library](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.fs.html)

**Note:** All functions are exported as they are except for `readfile` which encodes its return value in [Base64](https://en.wikipedia.org/wiki/Base64) and `writefile` which only accepts Base64 encoded data as second argument.
Note that both functions will only be available when the `luasocket` packet is installed on the host system.

### sys
The System library `/rpc/sys` offers functionality to interact with the operating system on the host machine.

**Exported Functions:**
* [Complete luci.sys library](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.sys.html)
* [Complete luci.sys.group library](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.sys.group.html) prefixing the method name with `group.methodname`.
* [Complete luci.sys.net library](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.sys.net.html) prefixing the method name with `net.methodname`.
* [Complete luci.sys.process library](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.sys.process.html) prefixing the method name with `process.methodname`.
* [Complete luci.sys.user library](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.sys.user.html) with prefix `user`.
* [Complete luci.sys.wifi library](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.sys.wifi.html) with prefix `wifi`.

Example:
```sh
curl http://<hostname>/cgi-bin/luci/rpc/sys?auth=yourtoken --data '
{
  "method": "net.conntrack"
}'
```

### ipkg
The IPKG library `/rpc/ipkg` offers functionality to interact with the package manager (IPKG or OPKG) on the host machine.

**Exported Functions:**
* [Complete luci.model.ipkg library](https://htmlpreview.github.io/?https://raw.githubusercontent.com/openwrt/luci/master/docs/api/modules/luci.model.ipkg.html)

