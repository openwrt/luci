module("luci.controller.uvc_streamer", package.seeall)

function index()
       require("luci.i18n")
       luci.i18n.loadc("uvc_streamer")
       if not luci.fs.isfile("/etc/config/uvc-streamer") then
               return
       end

       local page = entry({"admin", "services", "uvc_streamer"}, cbi("uvc_streamer"), luci.i18n.translate("uvc_streamer", "UVC Streaming"), 60)
       page.i18n = "uvc_streamer"
       page.dependent = true
end
