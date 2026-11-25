# LuCI BIRD

Open **Services → Bird** to configure BIRD 2 OSPF and inspect neighbors,
interfaces, learned routes, and BFD sessions.

- Configure interfaces, address families, areas, authentication, and route
  installation from the standard forms.
- Configure additional protocol, area, interface, and BFD options from the
  advanced table.
- The native editor requires the dedicated `luci-app-bird-native` ACL grant.
  It grants access to the entire configuration, including authentication keys.
  Applying native configuration switches editing to that mode so the form
  cannot overwrite it.

The application manages `/etc/bird.conf` and prompts before replacing an
unmanaged file. It writes `/etc/bird.conf.pre-luci-bird` on first takeover
and checks BIRD syntax before
replacing the file, and checks whether the previous service state is restored
if applying the candidate fails.
