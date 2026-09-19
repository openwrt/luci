# luci-app-veracrypt

Optional LuCI UI for console VeraCrypt. It is not part of the `veracrypt`
package. Install `veracrypt` from the packages feed, then this app.

`DEPENDS` includes `+veracrypt`, so `apk add luci-app-veracrypt` pulls the
CLI. The pages call `veracrypt --text` only (no VeraCrypt GUI toolkit).

Passwords use `veracrypt --stdin`, not `--password` on the command line.

CLI reference: https://www.veracrypt.fr/en/Command%20Line%20Usage.html
