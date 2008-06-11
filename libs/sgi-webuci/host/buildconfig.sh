#!/bin/sh
CWD=$1
cat <<EOF
Port 8080
ErrorLog /dev/stderr
AccessLog /dev/stderr
DocumentRoot $CWD/www
DirectoryMaker $CWD/usr/lib/boa/boa_indexer
KeepAliveMax 1000
KeepAliveTimeout 10
MimeTypes $CWD/etc/mime.types
DefaultType text/plain
CGIPath $CWD/bin:$CWD/usr/bin:$CWD/usr/local/bin

AddType application/x-httpd-cgi cgi
AddType application/x-httpd-cgi sh

ScriptAlias /cgi-bin/ $CWD/www/cgi-bin
PluginRoot $CWD/usr/lib/boa
EOF
