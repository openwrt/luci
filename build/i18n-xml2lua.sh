#!/bin/sh
# Copyright (C) 2008  Alina Friedrichsen <x-alina@gmx.net>
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions
# are met:
# 1. Redistributions of source code must retain the above copyright
#    notice, this list of conditions and the following disclaimer.
# 2. Redistributions in binary form must reproduce the above copyright
#    notice, this list of conditions and the following disclaimer in the
#    documentation and/or other materials provided with the distribution.
#
# THIS SOFTWARE IS PROVIDED BY THE AUTHOR AND CONTRIBUTORS ``AS IS'' AND
# ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
# IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
# ARE DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE LIABLE
# FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
# DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
# OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
# HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
# LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
# OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
# SUCH DAMAGE.

i18n_xml2lua() {
	echo '<?xml version="1.0" encoding="utf-8"?>'
	echo
	echo '<i18n:msgs xmlns:i18n="http://luci.freifunk-halle.net/2008/i18n#" xmlns="http://www.w3.org/1999/xhtml">'
	echo
	LANG=C sed -e 's/^\s*\([A-Za-z][0-9A-Za-z_]*\)\s*[=]\s*\[\[/<i18n:msg xml:id="\1">/' -e 's/\]\]\s*$/<\/i18n:msg>/' -e 's/^\s*\([A-Za-z][0-9A-Za-z_]*\)\s*[=]\s*["]\(.*\)["]\s*$/<i18n:msg xml:id="\1">\2<\/i18n:msg>/' -e 's/^\s*$//'
	echo
	echo '</i18n:msgs>'
	return 0
}

for file in "$@"; do
	i18n_xml2lua < "$file" > "$(dirname "$file")/$(basename "$file" .lua).xml" || exit 1
done
