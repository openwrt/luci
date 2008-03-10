-- This example demonstrates the simple view dispatcher which is the
-- most simple way to provide content as it directly renders the
-- associated template

-- This example consists of:
-- ffluci/controller/index/example-simpleview.lua (this file)
-- ffluci/view/example-simpleview/index.htm (the template for action "index")
-- ffluci/view/example-simpleview/foo.htm (the template for action "foo")
-- ffluci/i18n/example-simpleview.de (the german language file for this module)

-- Try the following address(es) in your browser:
-- ffluci/index/example-simpleview
-- ffluci/index/example-simpleview/index
-- ffluci/index/example-simpleview/foo

module(..., package.seeall)

dispatcher = require("ffluci.dispatcher").simpleview

menu = {
	descr = "Example Simpleview",
	order = 20,
	entries = {
		{action = "index", descr = "Simpleview Index"},
		{action = "foo", descr = "Simpleview Foo"}
	}
}