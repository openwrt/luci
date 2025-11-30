# LuCI OpenWrt.org Theme

The official OpenWrt LuCI theme with dark mode support.

## Features

- 🌙 **Dark Mode Support**
  - Toggle via the 🌙/☀️ button in the top menu bar
  - Automatically follows system dark mode preference
  - User preference is saved to browser local storage

## Dark Mode

### How to Toggle

1. **Manual**: Click the 🌙 icon on the right side of the top menu bar
2. **Automatic**: Automatically detects system dark mode preference on first visit

### Supported Pages

- All standard LuCI pages
- Real-time graphs (System Load / Bandwidth / Wireless)
- Channel Analysis
- Page loading transitions

## Installation

This theme is included in the standard LuCI feeds. Install via:

```bash
opkg install luci-theme-openwrt
```

## Development

### File Structure

```
luci-theme-openwrt/
├── htdocs/luci-static/
│   ├── openwrt.org/
│   │   └── cascade.css      # Main stylesheet (includes dark mode)
│   └── resources/
│       └── menu-openwrt.js  # Menu and dark mode toggle logic
└── ucode/template/themes/openwrt.org/
    ├── header.ut            # Page header template
    └── footer.ut            # Page footer template
```

### CSS Variables

Dark mode is implemented using CSS variables. Main variables are defined at the end of `cascade.css`:

- `--bg-primary` - Primary background color
- `--bg-content` - Content area background
- `--bg-section` - Card/section background
- `--text-primary` - Primary text color
- `--text-link` - Link color
- `--accent-color` - Accent color

## License

Apache License 2.0
