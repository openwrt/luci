--[[

Luci Voice Core
(c) 2009 Daniel Dickinson

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

]]--

module("luci.controller.luci_voice.luci_voice_diag", package.seeall)

function index()
	local e

	e = entry({"admin", "voice", "diag"}, template("luci_voice/diag_index"), _("Diagnostics"), 90)
	e.index = true
	e.dependent = true
end
