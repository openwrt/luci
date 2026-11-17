# luci-app-bird-babel

Status page for the Babel protocol of BIRD (Status → Babel), with up to 24
hours of history from the bird-babel-collector package. One view,
`htdocs/luci-static/resources/view/bird-babel/overview.js`, reading the
`bird-babel` ubus object (`status`, `history`, `events`); the ACL only
grants reading those and the `system` UCI config.

These notes explain how the view is built and why, for whoever changes it
next.

## Sections

Cards, notes (zoomed in, router busy), Gateway Route, Graph (topology),
Neighbours, Default route selection (timeline), Link cost, Round trip time,
Events, Interfaces. The time charts show the history the collector has, at
most 24 h: the request is rounded up to 15 minutes (`autoRange()`) so it
stays the same for a while, the charts start where the history begins
(`chartFrom()`). There are no range buttons, zooming is by dragging. Every
section shows the same set of neighbours: those present now or seen in the
shown range or zoom (`visibleKeys()`). A neighbour's network is
only added to its name when another visible one has the same name.

## Data flow

- `status` every 5 s, `history` every 30 s. Sections are patched in place
  (`patchChildren()`); the charts carry event handlers, so they are
  rebuilt as a whole, and only when their inputs change.
- History refreshes only ask for what is new: with an unchanged range, zoom
  and width, the request carries `since` (the last, partly filled bucket)
  and `mergeHistory()` joins it with what the page has, dropping what fell
  out of the range. Polls carry no percentiles; a full query, which brings
  new ones, runs at least every `FULL_EVERY` (5 minutes).
- When the collector turns down a query (it rate limits calls without a
  login) the page says so and retries after 10 s.
- Zoom: dragging across any time chart (pointer events: mouse, touch, pen;
  `touch-action: pan-y` keeps vertical scrolling) zooms all of them; the
  window is fetched at full resolution with `end`. A click or tap zooms
  out.

## Charts

- Link cost is drawn on a log2 axis squashed above `COST_KNEE` (512) by
  `COST_SQUASH` (8, `costPos()`), with a dashed line at the knee, so a few
  very bad links leave room for the usable ones; RTT is linear. Samples
  without usable neighbours on either side are drawn as dots.
- Grey is "no data collected" (the collector's `nodata`: before its history
  begins and while it was not running), hatched is "not present".
- The default route timeline, the neighbour order and the counts on the
  cards follow IPv4, or IPv6 when there is only an IPv6 default route, now
  or in the shown range (`defaultFamily()`), as on IPv6-only meshes. The
  timeline legend names the family. Presence is the same in `roles4` and
  `roles6`, so `seenInRange()` only reads `roles4`.
- The Gateway Route shows the hops the collector traced to the router that
  originates the selected default route, or, until a trace of the current
  route is done, the next hop and the gateway from BIRD with "⋯" in
  between, whose tooltip says when the trace runs. IPv6 is shown as well
  when its route differs from IPv4. No latencies: traces are rare by
  design.

## Development

- No build step; the view is plain LuCI JS. Check the syntax with
  `node --check` on the file wrapped in a function (it is a module body).
- Methods that only build DOM (`renderRoute()`, `mergeHistory()`, ...) can
  be tested in node by extracting them from the file and stubbing `E()`,
  `_()` and `String.prototype.format`.
- Regenerate the translation template after changing strings:
  `./build/i18n-scan.pl applications/luci-app-bird-babel > applications/luci-app-bird-babel/po/templates/bird-babel.pot`
  (needs xgettext and the Perl module Text::Balanced).
- A public page without login, like falter's OLSR pages, needs a menu entry
  under `freifunk/` and an `unauthenticated` ACL for the three ubus methods;
  that belongs to the distribution, not to this package.
