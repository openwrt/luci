# LuCI Application for HA Cluster

Web interface for managing High Availability clusters on OpenWrt.

## Features

### Quick Setup Tab
- Simple multi-router HA configuration (2 or more nodes)
- Priority configuration
- Peer router management
- VRRP instance management (VIPs grouped by instance fail over atomically)
- Virtual IP (VIP) configuration per interface with instance selector
- Inline VRRP instance creation from VIP modal ("Add new..." option)
- Service synchronization selection
- One-click enable/disable

### Status Tab
- Real-time cluster state (MASTER/BACKUP/FAULT)
- Peer connectivity status
- Service health monitoring (keepalived, owsync, lease-sync)
- DHCP lease sync statistics
- Config sync statistics
- Auto-refresh every 5 seconds

### Advanced Pages
- **Keepalived (Advanced)**: VRRP instance tuning (timing/auth/tracking/unicast) and health checks
- **owsync (Advanced)**: Custom sync groups, exclusions, poll interval
- **DHCP Sync (Advanced)**: lease-sync tuning and logging

## Installation

```bash
apk update
apk add luci-app-ha-cluster
```

## Dependencies

- `ha-cluster` - HA cluster management package
- `luci-base` - LuCI base system
- `rpcd` - RPC daemon

## Files

```
/www/luci-static/resources/
├── view/ha-cluster/
│   ├── simple.js              # Quick Setup interface
│   ├── status.js              # Status dashboard
│   ├── keepalived-advanced.js # Advanced VRRP settings
│   ├── owsync-advanced.js     # Advanced config sync settings
│   └── lease-sync-advanced.js # Advanced DHCP sync settings
└── ha-cluster.css             # Styles

/usr/share/luci/menu.d/
└── luci-app-ha-cluster.json   # Menu definition

/usr/share/rpcd/acl.d/
└── luci-app-ha-cluster.json   # Access control

/usr/libexec/rpcd/
└── ha-cluster                 # RPC backend (shell script)
```

## Usage

1. Navigate to **Services → High Availability** in LuCI
2. Go to **Quick Setup** tab
3. Configure:
   - Enable HA Cluster
   - Set node name and priority
   - Add peer router IP
   - Configure Virtual IPs for each interface
   - Select services to synchronize
4. Save & Apply

## Screenshots

### Quick Setup
Simple form-based configuration for typical multi-router setups:
- Cluster settings (name, priority, type)
- Peer configuration
- Virtual IP addresses
- Service sync options

### Status Dashboard
Real-time monitoring with:
- Cluster state indicator (color-coded)
- Peer health status
- Service status table
- Sync statistics

## Development

### Testing Locally

```bash
# Build the package
make package/luci-app-ha-cluster/compile

# Install on router
scp bin/packages/*/luci/luci-app-ha-cluster_*.apk root@router:/tmp/
ssh root@router apk add /tmp/luci-app-ha-cluster_*.apk

# Clear LuCI cache
ssh root@router rm -rf /tmp/luci-*
```

### Debugging

Enable debug mode in browser console:
```javascript
L.env.sessionid
```

Check RPC calls:
```bash
ubus call ha-cluster status
```

View logs:
```bash
logread | grep luci
logread | grep ha-cluster
```

## License

Apache-2.0

luci-app-ha-cluster has been developed using Claude Code from Anthropic.

## Maintainer

Pierre Gaufillet <pierre.gaufillet@bergamote.eu>
