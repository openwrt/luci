# Device identification

Identification is a display hint, not an authenticated fingerprint. A saved
manual device type takes precedence. Specific hostname or custom-name clues
come next, followed by a small set of vendor hints and the default group.
Names and types never affect routing, firewall rules or DHCP configuration.

Short English words require token boundaries. A generic `switch` means a
network switch; `nintendo-switch` means a console. `gateway` means a router,
and `Cambridge-PC` means a computer. Chinese device keywords are also accepted.

The previous broad OUI tables had no recorded provenance. They were replaced
with the 13 documented entries in `oui-hints.json`. Manufacturer assignments
were checked against the Wireshark project's automatically generated
[manufacturer data](https://www.wireshark.org/download/automated/data/manuf.gz),
which incorporates IEEE registration data. The verification source checksum
is recorded with the entries. Only assignment facts are retained; the complete
database is not bundled.

A manufacturer assignment identifies an organization, not a product. Apple,
Google, HP and other vendors with diverse products therefore have no automatic
device type hint. Ubiquiti and H3C use the general network-device category;
Espressif and Lumi use the general smart-home category. These remain guesses,
and users can override them. Locally administered or randomized MAC addresses
never use vendor hints. Hostname and manual identification still work for them.
