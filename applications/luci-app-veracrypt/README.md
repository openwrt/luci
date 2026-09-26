# luci-app-veracrypt

Optional LuCI UI for console VeraCrypt. It is not part of the `veracrypt`
package. CLI package: https://github.com/openwrt/packages/pull/30597

`DEPENDS` includes `+veracrypt`, so `apk add luci-app-veracrypt` pulls the
CLI. The pages call `veracrypt --text` only (no VeraCrypt GUI toolkit).

The current password is passed with `veracrypt --stdin`, never `--password`.
A new password, hidden-volume password or token PIN is also fed on stdin,
not `--new-password` / `--protection-password` / `--token-pin` on argv.

CLI reference: https://www.veracrypt.fr/en/Command%20Line%20Usage.html
