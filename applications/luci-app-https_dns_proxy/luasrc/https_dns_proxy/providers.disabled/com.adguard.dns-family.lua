--    .. "</br>"
--    .. translate("For more information on different options check ")
--		.. [[ <a href="https://adguard.com/en/adguard-dns/overview.html#instruction">]]
--    .. "AdGuard.com" .. [[</a>]] .. ", "
--		.. [[ <a href="https://cleanbrowsing.org/guides/dnsoverhttps">]]
--    .. "CleanBrowsing.org" .. [[</a>]] .. " " .. translate("and") .. " "
--		.. [[ <a href="https://www.quad9.net/doh-quad9-dns-servers/">]]
--    .. "Quad9.net" .. [[</a>]] .. "."
return {
	name = "AdGuard-Family",
	label = _("AdGuard (Family Protection)"),
	url_prefix = "https://dns-family.adguard.com/dns-query?ct&",
	bootstrap_dns = "176.103.130.132,176.103.130.134"
}
