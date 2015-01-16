-- Copyright 2009 Daniel Dickinson
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.luci_voice", package.seeall)

function index()
   local e

   e = entry({"admin", "voice"}, template("luci_voice/index") , _("Voice"), 90)
   e.index = true

   e = entry({"mini", "voice"}, template("luci_voice/index"), _("Voice"), 90)
   e.index = true

   e = entry({"mini", "voice", "phones"}, template("luci_voice/phone_index"), _("Phones"), 90)
   e.index = true

   e = entry({"admin", "voice", "phones"}, template("luci_voice/phone_index"), _("Phones"), 90)
   e.index = true

end
