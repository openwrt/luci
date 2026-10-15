# luci-app-fwlive

LuCI **Firewall Live View** — client-side JS view polling `ubus fwlive poll` (firewall-only log lines), with rule labels via `fwlive rules`, optional reverse DNS via `fwlive resolve`, and opt-in WAN zone logging via `enable_wan_logging` / `disable_wan_logging`.

## Package layout (OpenWrt / LuCI conventions)

| Path | Role |
|------|------|
| `Makefile` | `LUCI_TITLE`, `LUCI_DEPENDS`, includes `luci.mk` |
| `htdocs/luci-static/resources/view/status/fwlive.js` | LuCI view (`view.extend`) |
| `htdocs/luci-static/resources/fwlive/log.js` | Parser/filter module (`CLASSIFY_SPEC` + LuCI helpers) |
| `htdocs/luci-static/resources/fwlive/proto.js` | Protocol filter pair (select + custom field; typed custom wins) |
| `htdocs/luci-static/resources/fwlive/constants.js` | Shared view constants (`baseclass.extend` module) |
| `htdocs/luci-static/resources/fwlive/css.js` | Inline stylesheet string (`styleText` for `E('style', …)`) |
| `htdocs/luci-static/resources/fwlive/tint.js` | Row-tint paint helpers (`baseclass.extend` module) |
| `htdocs/luci-static/resources/fwlive/links.js` | Link-builder helpers (pure + filter-aware; no host) |
| `htdocs/luci-static/resources/fwlive/chips.js` | Filter-chip DOM renderer (`renderFilterChips`) |
| `htdocs/luci-static/resources/fwlive/logging.js` | Logging toolbar and empty-state DOM renderers |
| `htdocs/luci-static/resources/fwlive/table.js` | Table thead/rows DOM renderer (`renderThead`, `renderRows`) |
| `htdocs/luci-static/resources/fwlive/buffer.js` | Ring-buffer apply/merge helpers (pause ingest + resume merge) |
| `htdocs/luci-static/resources/fwlive/poll-coordinator.js` | Request coalescing, visibility, cadence, and disposal |
| `htdocs/luci-static/resources/fwlive/render-policy.js` | Pure weak-device display-cap and render-cost decisions |
| `htdocs/luci-static/resources/fwlive/render-scheduler.js` | Epoch-safe frame coalescing and render token-bucket state |
| `htdocs/luci-static/resources/fwlive/hostname.js` | Hostname cache LRU + failure TTL helpers |
| `root/usr/share/luci/menu.d/*.json` | Menu entry (`admin/status/fwlive`) |
| `root/usr/share/rpcd/acl.d/*.json` | ubus ACL (read + write for logging enable/disable) |
| `root/usr/libexec/rpcd/fwlive` | rpcd plugin (`rules`, `poll`, `resolve`, `logging_status`, `enable_wan_logging`, `disable_wan_logging`) |
| `root/usr/libexec/fwlive-adaptive-cap.sh` | Layer 1 adaptive poll cap (sourced by `rpcd/fwlive`) |
| `root/usr/libexec/fwlive-logging.sh` | WAN zone logging helpers |
| `root/lib/upgrade/keep.d/luci-app-fwlive` | Keep `/etc/fwlive/` across sysupgrade |
| `/etc/fwlive/wan-log-baseline` | Written on first **Enable logging** (and best-effort on already-on enable); `prerm` restores it on uninstall. After disable, a successful `fw4 reload` drops the marker when the fwlive generation is unchanged; this includes a `firewall_commit_raced` reply when an external UCI commit raced verification. This prevents `prerm` from restoring the stale pre-enable value over later operator changes. A later fwlive toggle, pending firewall changes detected before the disable commit, or reload failure keeps the marker. If logging is already off but the marker remains, Disable retries `fw4 reload`; pending UCI changes detected before that retry return `firewall_changes_pending` without reloading, and reload failure returns `firewall_reload_failed` while retaining the marker. UCI changes staged during reload are preserved and do not by themselves prevent marker retirement when the generation is unchanged. Lock, read, or generation mismatch also keeps it for uninstall recovery. Restore is skipped (file kept; `fwlive` syslog only) when there is no WAN zone, the lock is unavailable, firewall changes are pending, the commit does not verify, reload fails, or the value after reload does not match the baseline. Disable of a pre-existing/foreign log bit is not snapshotted, so uninstall will not restore that bit. |
| `root/usr/libexec/fwlive-log-filter.sh` | Server-side firewall-only filter (`isFirewallEvent` parity) |
| `root/usr/libexec/fwlive-is-firewall-event.sh` | Shared filter logic (sourced by filter + tests) |
| `root/usr/libexec/fwlive-is-firewall-event.awk` | **Generated** standalone classifier from `CLASSIFY_SPEC`; loaded by `fwlive-is-firewall-event.sh` |
| `po/templates/luci-app-fwlive.pot` | i18n template (English msgid scaffolding) |

No `luasrc/` — modern JS-only app.

## Dependencies

- `luci-base`, `logd`, `jsonfilter` (declared in `LUCI_DEPENDS`; `rpcd` via `luci-base`)
- Optional reverse DNS uses BusyBox `nslookup` (stock image; not a package depend)
- No hard `firewall4` dependency
- Menu depends on ACL only (no `fs` AND of `nft`+`iptables` — that hid the entry on stock fw3 and fw4)
- Runtime backend detection selects **fw4/nft** on supported **23.05+** images; log lines tagged **iptables** still classify. OpenWrt **21.02** / **22.03** are unsupported

The rpcd plugin invokes its read helpers directly and does not require GNU
`timeout`. The `log.read` ubus invocation uses ubus's native five-second reply
timeout after object lookup; this does not cancel a remote method already
running. Existing line, byte, and count limits still apply, and reverse DNS
stops starting lookups after its elapsed-time budget. Other helpers have no
fwlive deadline. Stock rpcd kills the plugin process after its configured
execution timeout (30 seconds), but does not kill its descendants; helpers can
outlive the request. This is an accepted maintenance tradeoff, to be
reconsidered if users report reliability problems.

