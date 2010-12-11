#!/bin/sh
echo -en "Cache-Control: no-cache, max-age=0, no-store, must-revalidate\r\n"
echo -en "Pragma: no-cache\r\n"
echo -en "expires: -1\r\n"
echo -en "Status: 307 Temporary Redirect\r\n"
echo -en "Location: http://$SERVER_ADDR/cgi-bin/luci/splash\r\n\r\n" 
