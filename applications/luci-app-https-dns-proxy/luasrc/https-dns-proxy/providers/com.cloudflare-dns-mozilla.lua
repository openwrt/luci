return {
	name = "Cloudflare-Mozilla-TRR",
	label = _("Cloudflare (Mozilla’s Trusted Recursive Resolver (TRR) program)"),
	resolver_url = "https://mozilla.cloudflare-dns.com/dns-query",
	bootstrap_dns = "1.1.1.1,1.0.0.1,2606:4700:4700::1111,2606:4700:4700::1001",
	help_link = "https://developers.cloudflare.com/1.1.1.1/privacy/firefox",
	help_link_text = "Cloudflare Resolver for Firefox"
}
