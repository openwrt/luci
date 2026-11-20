# luci-app-sfp-info

Visual dashboard for SFP/QSFP optical transceiver diagnostics via `ethtool --json -m`.

## Features

- Auto-detection of all SFP/SFP+/QSFP+/QSFP28 modules on network interfaces
- Real-time display of temperature, voltage, bias current, TX/RX power
- Alarm and warning status with inline labels
- Auto-refresh every 10 seconds
- Supports SFF-8472 (SFP), SFF-8636 (QSFP), and CMIS (QSFP-DD/OSFP)

## Dependencies

- `luci-base`
- `ethtool-full` (>= 7.0 for JSON output support)
- `ucode-mod-math` (mW to dBm conversion in the rpcd backend)

## RPC API

The backend provides one ubus method under `luci.sfp-info`:

**list** -- Returns full diagnostics for all detected SFP interfaces:
```
ubus call luci.sfp-info list
```
