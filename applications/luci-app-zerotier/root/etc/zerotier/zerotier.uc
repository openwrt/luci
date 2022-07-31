{%

let ifnames = o_ifnames;
let ip_segments = o_ip_segments;

if (ifnames) {
	ifnames = split(ifnames, /[ \t\n]/);
}

if (ip_segments) {
	ip_segments = split(ip_segments, /[ \t\n]/);
}

%}

chain forward {
{% for (let ifname in ifnames): %}
	iifname {{ ifname }} counter accept comment "!fw4: Zerotier allow inbound forward {{ ifname }}"
	oifname {{ ifname }} counter accept comment "!fw4: Zerotier allow outbound forward {{ ifname }}"
{% endfor %}
}

chain srcnat {
{% for (let ifname in ifnames): %}
    oifname {{ ifname }} counter masquerade comment "!fw4: Zerotier {{ ifname }} outbound postrouting masq"
{% endfor %}
{% if (length(ip_segments)): %}
{% for (let ip_segment in ip_segments): %}
	ip saddr {{ ip_segment }} counter masquerade comment "!fw4: Zerotier {{ ip_segment }} postrouting masq"
{% endfor %}
{% endif %}
}
