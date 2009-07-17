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
   require("luci.i18n")
   luci.i18n.loadc("voice_core")

   local e = entry({"admin", "voice"}, template("luci_voice/index") , luci.i18n.translate("l_v_adminvoice", "Voice"), 90)
   e.index = true
   e.i18n = "voice_core"

   e = entry({"mini", "voice"}, template("luci_voice/index"), luci.i18n.translate("l_v_minivoice", "Voice"), 90)
   e.index = true
   e.i18n = "voice_core"

   e = entry({"mini", "voice", "phones"}, template("luci_voice/phone_index"), luci.i18n.translate("l_v_miniphones"), 90)
   e.index = true
   e.i18n = "voice_core"

   e = entry({"admin", "voice", "phones"}, template("luci_voice/phone_index"), luci.i18n.translate("l_v_adminphones"), 90)
   e.index = true
   e.i18n = "voice_core"

end
