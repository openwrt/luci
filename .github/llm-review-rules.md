# LLM review rules — openwrt/luci

LuCI-specific patterns to flag. The review routine reads this at
session start. General contribution rules (commit subject prefix,
Signed-off-by, real-name author, line length) live in
[`CONTRIBUTING.md`](../CONTRIBUTING.md) and are already enforced by
the formality CI bot — don't duplicate those checks.

## Out-of-tree luci apps

A few `luci-app-*` packages are maintained in their own repositories,
not in `openwrt/luci`. PRs that re-introduce or modify these in-tree
should be redirected upstream rather than reviewed line by line
(recurring example: PRs #8462 and #8625 against
`luci-app-https-dns-proxy`):

- `luci-app-https-dns-proxy` --> https://github.com/mossdef-org/luci-app-https-dns-proxy

When a PR's diff matches one of these package paths, flag it and link
the upstream repo.

## Backend coupling across repos

A new UCI option or service interaction in LuCI is only useful if a
backend actually reads it. Recurring failure mode (PRs #8498, #8533,
#8590): the LuCI frontend exposes an option whose name does not appear
in any backend, so the setting silently does nothing.

When a PR adds a UCI field or RPC call, check that a consumer exists:

- `luci-mod-network`, `luci-proto-*` --> `netifd` (and its proto
  handler scripts under `/lib/netifd/proto/`)
- `luci-app-firewall` --> `firewall4` (`/usr/share/firewall4/`)
- `luci-app-<pkg>` --> the `<pkg>` package itself, usually in
  `feeds/packages` or `feeds/routing`

If the option name does not appear in any consumer (grep the relevant
`~/extra/<repo>-<ref>` tree), flag as "frontend-only with no backend
consumer" and ask which daemon or script reads it. When the change
depends on a not-yet-merged PR in another repo, that dependency should
be called out in the PR description.
