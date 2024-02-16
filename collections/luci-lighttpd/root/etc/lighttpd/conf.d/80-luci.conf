# LuCI require root to manage router
server.username  := ""
server.groupname := ""

alias.url += (
  "/cgi-bin/" => server_root + "cgi-bin/"
  "/luci-static/" => server_root +  "luci-static/"
)

$HTTP["url"] =~ "^/cgi-bin" {
  cgi.assign += ( "" => "" )
}
