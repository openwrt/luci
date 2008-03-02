module(..., package.seeall)

function dispatcher(request)
	require("ffluci.template").render("header")
	print("Hello there, Mr. Administrator")
	require("ffluci.template").render("footer")
end

menu = {
	descr   = "Administrative",
	order   = 10,
	entries = {
		{action = "index", descr = "Hello"}
	}
}