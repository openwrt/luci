#!/bin/sh

wget -q -O - http://localhost:2006/neighbours|sed -e's/LinkQuality/LQ/;s/Hysteresis/Hyst./;s/Willingness/Will./'
