-- Copyright 2009 Daniel Dickinson
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.luci_voice.luci_voice_diag", package.seeall)

function index()
	local e

	e = entry({"admin", "voice", "diag"}, template("luci_voice/diag_index"), _("Diagnostics"), 90)
	e.index = true
	e.dependent = true
end
