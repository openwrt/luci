#!/bin/sh
echo -en "Status: 302 Moved\r\n"
echo -en "Location: http://$SERVER_ADDR/cgi-bin/luci/splash\r\n\r\n" 
