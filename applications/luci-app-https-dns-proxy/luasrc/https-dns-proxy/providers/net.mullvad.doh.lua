return {
	name="mullvad",
	label=_("Mullvad"),
	resolver_url="https://doh.mullvad.net/dns-query",
	bootstrap_dns="1.1.1.1,1.0.0.1,2606:4700:4700::1111,2606:4700:4700::1001,8.8.8.8,8.8.4.4,2001:4860:4860::8888,2001:4860:4860::8844",
	help_link="https://mullvad.net/en/help/dns-over-https-and-dns-over-tls/",
	help_link_text="Mullvad.net",
	http2_only = true
}
