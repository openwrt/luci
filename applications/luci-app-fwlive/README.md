# luci-app-fwlive

LuCI **Firewall Live View** — client-side JS view polling `ubus fwlive poll` (firewall-only log lines), with rule labels via `fwlive rules`, optional reverse DNS via `fwlive resolve`, and opt-in WAN zone logging via `enable_wan_logging` / `disable_wan_logging`.

## Package layout (OpenWrt / LuCI conventions)

| Path | Role |
|------|------|
| `Makefile` | `LUCI_TITLE`, `LUCI_DEPENDS`, includes `luci.mk` |
| `htdocs/luci-static/resources/view/status/fwlive.js` | LuCI view (`view.extend`) |
| `htdocs/luci-static/resources/fwlive/log.js` | Parser/filter module (`CLASSIFY_SPEC` + LuCI helpers) |
| `htdocs/luci-static/resources/fwlive/constants.js` | Shared view constants (`baseclass.extend` module) |
| `htdocs/luci-static/resources/fwlive/css.js` | Inline stylesheet string (`styleText` for `E('style', …)`) |
| `htdocs/luci-static/resources/fwlive/tint.js` | Row-tint paint helpers (`baseclass.extend` module) |
| `htdocs/luci-static/resources/fwlive/links.js` | Link-builder helpers (pure + filter-aware; no host) |
| `htdocs/luci-static/resources/fwlive/chips.js` | Filter-chip DOM renderer (`renderFilterChips`) |
| `htdocs/luci-static/resources/fwlive/logging.js` | Logging toolbar and empty-state DOM renderers |
| `htdocs/luci-static/resources/fwlive/table.js` | Table thead/rows DOM renderer (`renderThead`, `renderRows`) |
| `htdocs/luci-static/resources/fwlive/buffer.js` | Ring-buffer apply/merge helpers (pause ingest + resume merge) |
| `htdocs/luci-static/resources/fwlive/hostname.js` | Hostname cache LRU + failure TTL helpers |
| `htdocs/luci-static/resources/fwlive/proto.js` | Protocol name/number helpers |
| `root/usr/share/luci/menu.d/*.json` | Menu entry (`admin/status/fwlive`) |
| `root/usr/share/rpcd/acl.d/*.json` | ubus ACL (read + write for logging enable/disable) |
| `root/usr/libexec/rpcd/fwlive` | rpcd plugin (`rules`, `poll`, `resolve`, `logging_status`, `enable_wan_logging`, `disable_wan_logging`) |
| `root/usr/libexec/fwlive-logging.sh` | WAN zone logging helpers |
| `/etc/fwlive/wan-log-baseline` | Written on first **Enable logging**; restored on uninstall (`prerm`) |
| `root/usr/libexec/fwlive-log-filter.sh` | Server-side firewall-only filter (`isFirewallEvent` parity) |
| `root/usr/libexec/fwlive-is-firewall-event.sh` | Shared filter logic (sourced by filter + tests) |
| `po/templates/luci-app-fwlive.pot` | i18n template (English msgid scaffolding) |

No `luasrc/` — modern JS-only app.

## Dependencies

- `luci-base`, `logd`, `jsonfilter` (declared in `LUCI_DEPENDS`; `rpcd` via `luci-base`)
- Optional reverse DNS uses BusyBox `nslookup` (stock image; not a package depend)
- No hard `firewall4` dependency
- Menu depends on ACL only (no `fs` AND of `nft`+`iptables` — that hid the entry on stock fw3 and fw4)
- Runtime backend detection selects **fw4/nft** (22.03+) or **iptables LOG** (21.02 fw3); best-effort iptables when nft absent

## Maintenance

Development home is [lucas-albers-lz4/fwlive](https://github.com/lucas-albers-lz4/fwlive).
The copy in `openwrt/luci` is a snapshot. On conflict, the next snapshot from
that repository replaces the luci copy — land fixes upstream of this tree
first.

A `PKG_SOURCE` tarball package was considered and declined: LuCI applications
are in-tree under `applications/`, Weblate owns `po/<lang>/` after merge, and a
tarball would still leave a copy to update on every release. The signed binary
feed stays for non-snapshot users.

## Documentation

- **Users:** [installation guide](https://github.com/lucas-albers-lz4/fwlive/blob/master/docs/user/installation.md)
- **Developers:** [developer documentation](https://github.com/lucas-albers-lz4/fwlive/blob/master/docs/developer/README.md)
