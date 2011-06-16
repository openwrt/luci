#!/bin/sh
echo -en "Cache-Control: no-cache, max-age=0, no-store, must-revalidate\r\n"
echo -en "Pragma: no-cache\r\n"
echo -en "Expires: -1\r\n"
echo -en "Status: 403 Forbidden\r\n"
echo -en "Content-Type: text/html\r\n\r\n"
#echo -en "Status: 307 Temporary Redirect\r\n"
#echo -en "Location: http://$SERVER_ADDR/cgi-bin/luci/splash\r\n\r\n" 

cat <<EOT
<html>
	<head>
		<title>Splash</title>
		<meta http-equiv="refresh" content="0; url=http://$SERVER_ADDR/cgi-bin/luci/splash" />
	</head>
	<body style="font-family:sans-serif">
		<h1>Splash on $(cat /proc/sys/kernel/hostname)</h1>
		<p>
			Redirecting to authentication for $REMOTE_ADDR on $SERVER_ADDR.<br /><br />
			[<a href="http://$SERVER_ADDR/cgi-bin/luci/splash">Click here to continue...</a>]
		</p>
	</body>
</html>
EOT

