--    .. "</br>"
--    .. translate("For more information on different options check ")
--		.. [[ <a href="https://adguard.com/en/adguard-dns/overview.html#instruction">]]
--    .. "AdGuard.com" .. [[</a>]] .. ", "
--		.. [[ <a href="https://cleanbrowsing.org/guides/dnsoverhttps">]]
--    .. "CleanBrowsing.org" .. [[</a>]] .. " " .. translate("and") .. " "
--		.. [[ <a href="https://www.quad9.net/doh-quad9-dns-servers/">]]
--    .. "Quad9.net" .. [[</a>]] .. "."
return {
	name = "CleanBrowsing-Family",
	label = _("CleanBrowsing (Family Filter)"),
	url_prefix = "https://doh.cleanbrowsing.org/doh/family-filter/?ct&",
	bootstrap_dns = "185.228.168.168"
}
