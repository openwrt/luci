# LuCI Orbi BLE Service

`luci-app-orbi-ble` provides **Services > Orbi BLE Service** for Bluetooth Low
Energy (BLE) Central management through the `ble-service` package. It displays
the service phase, controller, device cache, RSSI in dBm and connection state.
Users can start or stop the service, scan for ten seconds, connect or
disconnect a listed device, and refresh the displayed state.

This is an Orbi-specific draft for the Netgear RBR50/RBS50 v1 family. The
backend accepts only the exact RBR50/RBS50 v1 board identities; RBS50
end-to-end validation is still pending. Although the view has no
board-specific code, this is not a general solution for arbitrary OpenWrt
Bluetooth hardware. USB adapters and generic initialization hooks are outside
this draft's scope.

This is not a GATT Peripheral/Server implementation. It provides no pairing,
trust management, application-specific GATT controls or automatic device
connection. It does not install a daemon, listener or anonymous API.

## Dependencies and access

The application requires `luci-base` and the companion `ble-service` package,
which supplies the rpcd object `ble`. Hardware setup is the backend's
responsibility; this page does not manipulate UARTs or controller firmware.
The backend source is published independently as
[`openwrt-orbi-ble-service` v0.1.0](https://github.com/Leo-ATP/openwrt-orbi-ble-service/tree/v0.1.0)
at commit `a30ce307d2a12d0c50b9296116ed6a0c73992d3f`. The companion
packages-feed package is responsible for fetching, building and installing
that release. `luci-app-orbi-ble` contains only the LuCI frontend and
authenticated ACL; it does not vendor the backend source. The companion
package is an upstream dependency of this draft and is not assumed to be
present in an unmodified packages feed.

LuCI uses its existing authenticated RPC session. The `luci-app-orbi-ble` ACL
grants read access only to `ble.status` and write access only to `ble.start`,
`ble.stop`, `ble.scan`, `ble.connect` and `ble.disconnect`. Read-only users can
refresh but cannot invoke mutations. No shell, file, UCI or anonymous session
permissions are added.

## RPC and lifecycle

| Method | Parameters |
| --- | --- |
| `status`, `start`, `stop` | `{}` |
| `scan` | `{"seconds":10}` |
| `connect`, `disconnect` | `{"address":"02:00:00:00:00:01"}` (illustrative address) |

Replies use the service's existing `ok`, optional `error`, and `state`
envelope. `state.phase` is one of `stopped`, `starting`, `ready`, `stopping`
or `failed`; `ok: true` alone does not mean the service is ready. Error codes
and `retryable` may be absent. Failed states and backend errors remain
visible. When the service is already inactive, the immediate Stop reply may
be successful while retaining its saved `failed` state. After shutdown enters
`stopping`, a `failed` state is still reported as an error, even if `ok` is
true. It can reflect initialization, runtime or cleanup errors of the current
daemon instance, not necessarily a new Stop error.

Only user-triggered Start/Stop follow transitional states, with a one-second
gap between status requests and a 240-second total deadline. The page does
not poll when idle, scan on load/start/refresh, or retry a mutation. It stops
following a detached or replaced view. Status, lifecycle and device RPC waits
are bounded at 8, 10 and 18 seconds respectively, covering the backend's
6, 8 and 16-second RPC limits. Browser timeouts do not cancel server work.

All controls share one in-flight action guard. After an uncertain mutation,
read-only status reconciliation updates the view without hiding the original
error. If status cannot be obtained, including on initial page load, an
explicit error is shown and mutations remain disabled until a successful
manual refresh. Late replies cannot overwrite a newer action or a
replacement view.

## Device-list policy

The service currently exposes only devices with a meaningful BlueZ
name/alias; empty names and address-only aliases are omitted from the list.
This is a presentation policy, not a controller discovery limitation.

The backend uses the trimmed BlueZ `Device1.Alias`, which may be a
user-assigned alias rather than an advertised name. Address comparison
ignores colon, hyphen, underscore, dot and whitespace separators; aliases
containing only separators are also omitted. This policy can hide legitimate
unnamed devices and remains an upstream discussion point.

LuCI consumes the returned list without applying another name filter.
Refresh reads the current cache and connection state; it does not imply a
fresh scan. Names, addresses, details and errors are inserted as text.

## Local checks

From the LuCI repository root, using the existing Node.js and ESLint tools:

```sh
node --check applications/luci-app-orbi-ble/htdocs/luci-static/resources/view/orbi-ble.js
node --test applications/luci-app-orbi-ble/tests/orbi-ble.test.mjs
npx eslint applications/luci-app-orbi-ble
```

The fixtures use synthetic addresses and a small LuCI DOM/RPC model,
including text-vs-HTML and boolean-attribute semantics. They exercise the
wire contract, permissions, empty/device lists, errors, lifecycle deadlines,
duplicate actions, late replies and view replacement. They do not validate
an installed package, real controller, radio discovery or GATT connection.

This is the LuCI frontend for the Orbi-specific BLE Central service and is
limited to its six management methods. This application and its tests are
licensed under Apache-2.0; see the repository's `LICENSE`.
