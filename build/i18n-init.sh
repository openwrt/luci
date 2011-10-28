#!/bin/sh

for lang in $(cd po; echo ?? ??_??); do
	for file in $(cd po/templates; echo *.pot); do
		if [ ! -f "po/$lang/${file%.pot}.po" ]; then
			msginit --no-translator -l "$lang" -i "po/templates/$file" -o "po/$lang/${file%.pot}.po"
			svn add "po/$lang/${file%.pot}.po"
		fi
	done
done
