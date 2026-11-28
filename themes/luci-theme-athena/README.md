# Athena LuCI theme

A native ucode/JavaScript theme using HeroUI's framework-independent CSS.
There is no React, Lua compatibility layer, external update service, package
feed configuration or bundled private key. Installation registers Athena under
System → System → Language and Style without changing the selected theme.

The theme includes light, dark and system appearance, responsive navigation,
native LuCI form/table adapters, status summaries, and optional local login
assets. The asset RPC has scoped ACLs and validates paths, formats and sizes.
Normal LuCI UCI save/apply and application polling remain in place. Upgrades
preserve uploaded assets. Uninstalling Athena removes its registration and
uploaded assets, and selects an installed theme if Athena was active.

## Build and development

The standard LuCI `luci.mk` builds this package from checked-in CSS, JavaScript,
templates and RPC sources. SDK builds and routers do not require Node.js.
Source templates are shipped to avoid binding packages to host ucode bytecode.
Modern CSS is already minified; legacy csstidy is disabled for this package only.

To regenerate CSS on a development host, use the pinned package-lock.json:

```sh
npm ci
npm run build
npm test
```

Strings use LuCI gettext. Generate the initial catalog with
`./build/i18n-scan.pl themes/luci-theme-athena` at the LuCI repository root;
translations should be contributed through OpenWrt Weblate.

Test browser requirement: modern CSS with :has(), color-mix(), and mask support.
The popover and theme-transition integrations have progressive fallbacks;
reduced-motion preferences are respected. See NOTICE and licenses/ for
Bootstrap, HeroUI and Gravity Icons attribution. Apache-2.0 and MIT apply.
