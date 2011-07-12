#!/bin/sh
echo -en "Cache-Control: no-cache, max-age=0, no-store, must-revalidate\r\n"
echo -en "Pragma: no-cache\r\n"
echo -en "Expires: -1\r\n"
echo -en "Status: 307 Temporary Redirect\r\n"
echo -en "Location: http://$SERVER_ADDR/cgi-bin/luci/splash\r\n" 
echo -en "\r\n"

cat <<EOT
<?xml version="1.0" encoding="UTF-8"?>
<WISPAccessGatewayParam xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.wballiance.net/wispr_2_0.xsd">
	<Redirect>
		<MessageType>100</MessageType>
		<ResponseCode>0</ResponseCode>
		<AccessProcedure>1.0</AccessProcedure>
		<AccessLocation>12</AccessLocation>
		<LocationName>$SERVER_ADDR</LocationName>
		<LoginURL>http://$SERVER_ADDR/cgi-bin/luci/splash?wispr=1</LoginURL>
		<AbortLoginURL>http://$SERVER_ADDR/</AbortLoginURL>
	</Redirect>
</WISPAccessGatewayParam>
EOT

