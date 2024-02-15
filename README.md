# LuCI Documentation

See Wiki [LuCI Technical Reference](https://openwrt.org/docs/techref/luci)

## API Reference

- [Client side JavaScript APIs](jsapi/)
- [How to i18n your module](i18n): internationalization via \*.po and \*.pot files
- [How to make LuCI JS Modules](https://github.com/openwrt/luci/tree/master/applications/luci-app-example): see the luci-app-example in the repo
- [How to use the JSON-RPC](JsonRpcHowTo)
- [How to make themes](ThemesHowTo)
- [LuCI Modules Reference](Modules): can be JS based or Lua (deprecated)

## Deprecated API Reference (older Lua based APIs)

- [CBI models reference](CBI):CBI models are Lua files describing the structure of an UCI config file and the resulting HTML form to be evaluated by the CBI parser
- [How to make LuCI Lua Modules](ModulesHowTo): No new Lua modules for client side display are accepted, but some server side things are still done in Lua
- [LMO - Lua Machine Objects](LMO): to pack language strings into a more efficient form for Lua
- [Server side Lua APIs](api/index.html)
- [Templates](Templates): template processor which parses HTML-files to Lua functions and allows to store precompiled template files

## Archived

- [LuCI-0.10](LuCI-0.10): No longer used, but useful reference if you encounter older LuCI versions.