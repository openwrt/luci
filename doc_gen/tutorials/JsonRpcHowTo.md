# Using the JSON-RPC API

LuCI provides some of its libraries to external applications through a [JSON-RPC](https://en.wikipedia.org/wiki/JSON-RPC) API.
This Howto shows how to use it and provides information about available functions.

See also 
* wiki [rpcd](https://openwrt.org/docs/techref/rpcd)
* wiki [ubus](https://openwrt.org/docs/techref/ubus)

## Basics
The API is installed by default.

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

If you want to call any exported library which requires an authentication token you have to append it as a URL parameter auth to the RPC-Server URL.
E.g. instead of calling `/cgi-bin/luci/rpc/LIBRARY` you should call `/cgi-bin/luci/rpc/LIBRARY?auth=TOKEN`.

If your JSON-RPC client is Cookie-aware (like most browsers are) you will receive the authentication token also with a session cookie and probably don't have to append it to the RPC-Server URL.


## Exported Libraries
### uci
The UCI-Library `/rpc/uci` offers functionality to interact with the Universal Configuration Interface.

**Exported Functions:**

See [LuCI API](LuCI.uci.html)

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

See [fs API](LuCI.fs.html)


**Note:** All functions are exported as they are except for `readfile` which encodes its return value in [Base64](https://en.wikipedia.org/wiki/Base64) and `writefile` which only accepts Base64 encoded data as second argument.


