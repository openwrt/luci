luadoc -d $2 --no-files $(for f in $(find $1 -name '*.lua' -type f); do if grep -q -- "@return" $f; then echo $f; fi; done)
echo API-Documentation was created in $2.
