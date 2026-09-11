# luci-app-poe

A LuCI web interface for controlling Power over Ethernet (PoE) on OpenWrt
switches driven by the [`realtek-poe`](https://github.com/Hurricos/realtek-poe)
daemon (e.g. the HPE 1920 PoE models on the `realtek` target).

It adds two pages:

- **Status → PoE** — live per-port status (mode, status, priority, power
  consumption) plus the global power budget and total consumption, refreshed
  automatically. Each port has an immediate on/off toggle (via the `poe` ubus
  `manage` method — note this is **temporary** and resets on reload/reboot).
- **Network → PoE** — edit the persistent configuration in `/etc/config/poe`
  (per-port enable, priority, PoE+) through a normal Save & Apply form.

## Requirements

- OpenWrt 25.x (LuCI 26.x / client-side JS)
- `realtek-poe` installed and running (provides the `poe` ubus object)

## Quick install for development

The view, menu and ACL are interpreted at runtime, so you can copy them straight
onto a running switch:

```sh
cd applications/luci-app-poe   # from the repository root

SW=root@192.168.1.1
ssh $SW 'mkdir -p /www/luci-static/resources/view/poe'
scp -O htdocs/luci-static/resources/view/poe/overview.js $SW:/www/luci-static/resources/view/poe/
scp -O htdocs/luci-static/resources/view/poe/status.js   $SW:/www/luci-static/resources/view/poe/
scp -O root/usr/share/luci/menu.d/luci-app-poe.json      $SW:/usr/share/luci/menu.d/
scp -O root/usr/share/rpcd/acl.d/luci-app-poe.json       $SW:/usr/share/rpcd/acl.d/
ssh $SW '/etc/init.d/rpcd restart; rm -f /tmp/luci-indexcache*; rm -rf /tmp/luci-modulecache'
```

Then open the LuCI web interface and hard-refresh
