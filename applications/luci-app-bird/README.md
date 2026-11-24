# LuCI BIRD

Open **Services → Bird** to configure BIRD 2 OSPF and inspect neighbors,
interfaces, learned routes, and BFD sessions.

- Configure interfaces, address families, areas, authentication, and route
  installation from the standard forms.
- Configure additional protocol, area, interface, and BFD options from the
  advanced table.
- The native configuration editor is available only to root. Applying native
  configuration switches editing to that mode so the form cannot overwrite it.

The application manages `/etc/bird.conf` and prompts before replacing an
unmanaged file. It keeps a backup on first takeover, checks BIRD syntax before
replacing the file, and checks whether the previous service state is restored
if applying the candidate fails.
