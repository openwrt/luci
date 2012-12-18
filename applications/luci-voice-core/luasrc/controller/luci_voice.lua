--[[

Luci Voice Core
(c) 2009 Daniel Dickinson

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

]]--

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
