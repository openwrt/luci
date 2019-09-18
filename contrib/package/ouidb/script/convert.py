#!/usr/bin/env python

import json
import sys

if len(sys.argv) < 2:
    print('Usage: %s input-file' % sys.argv[0])
    sys.exit(2)

oui = { }

d = json.load(open(sys.argv[1], 'r'))
for obj in d:
    oui[obj.get("prefix")] = obj.get("organization").get("name")
print(json.dumps(oui))
