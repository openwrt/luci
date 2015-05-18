#!/bin/sh

key_base64=$(uci get fwknopd.@access[0].KEY_BASE64)
key=$(uci get fwknopd.@access[0].KEY)
hmac_key_base64=$(uci get fwknopd.@access[0].HMAC_KEY_BASE64)
hmac_key=$(uci get fwknopd.@access[0].HMAC_KEY)

if [ $key_base64 != "" ]; then
qr="KEY_BASE64:$key_base64"
fi
if [ $key != "" ]; then
qr="$qr KEY:$key"

fi
if [ $hmac_key_base64 != "" ]; then
qr="$qr HMAC_KEY_BASE64:$hmac_key_base64"
fi
if [ $hmac_key != "" ]; then
qr="$qr HMAC_KEY:$hmac_key"
fi

qrencode -o - "$qr"
