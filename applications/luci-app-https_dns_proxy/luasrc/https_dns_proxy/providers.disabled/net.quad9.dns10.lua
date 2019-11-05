--    .. "</br>"
--    .. translate("For more information on different options check ")
--		.. [[ <a href="https://adguard.com/en/adguard-dns/overview.html#instruction">]]
--    .. "AdGuard.com" .. [[</a>]] .. ", "
--		.. [[ <a href="https://cleanbrowsing.org/guides/dnsoverhttps">]]
--    .. "CleanBrowsing.org" .. [[</a>]] .. " " .. translate("and") .. " "
--		.. [[ <a href="https://www.quad9.net/doh-quad9-dns-servers/">]]
--    .. "Quad9.net" .. [[</a>]] .. "."
return {
	name = "Quad9-Unsecured",
	label = _("Quad 9 (Unsecured)"),
	url_prefix = "https://dns10.quad9.net:5053/dns-query?",
	bootstrap_dns = "9.9.9.10,149.112.112.10"
}
