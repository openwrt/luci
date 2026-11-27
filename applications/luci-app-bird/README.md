# LuCI BIRD

Open **Services → Bird** to configure BIRD 2 OSPF and inspect neighbors,
interfaces, learned routes and BFD sessions.

The structured editor can configure OSPFv2 and OSPFv3 interfaces, areas,
authentication, and exact-prefix route policies. Changes in its dialogs
remain in the page until **Save & Apply**.

The application manages `/etc/bird.conf`. The first takeover of an existing
file requires confirmation and creates `/etc/bird.conf.pre-luci-bird`.
The app checks the candidate syntax with BIRD and attempts to restore the
previous configuration if applying the candidate fails.

The dedicated `luci-app-bird-native` ACL grants access to the complete
configuration, including authentication keys. Applying from the native
editor switches the file to native management.

The LuCI package build runs the renderer, saved-configuration and rollback
regression tests with the OpenWrt host ucode. To run the same tests locally,
install ucode with its `fs` module and run `sh tests/run.sh`.
