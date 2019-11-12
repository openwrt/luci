# OpenWrt luci feed

[![Translation status](https://hosted.weblate.org/widgets/openwrt/-/svg-badge.svg)](https://hosted.weblate.org/engage/openwrt/?utm_source=widget)

## Description

This is the OpenWrt "luci"-feed containing LuCI - OpenWrt Configuration Interface.

## Docker Composer
It can map the subject code to the docker container, so that it can be changed automatically.

Open ```.env``` and modify the parameters according to the theme you are editing. (local mapping port, temporary directory, theme file path, etc.)

```
docker-compose up -d theme
```
Then execute docker-compose and then access it via http://localhost:port.
Once everything is done, you can edit the file as you normally would,git etc.


## Usage

This feed is enabled by default. Your feeds.conf.default (or feeds.conf) should contain a line like:
```
src-git luci https://github.com/openwrt/luci.git
```

To install all its package definitions, run:
```
./scripts/feeds update luci
./scripts/feeds install -a -p luci
```

## API Reference

You can browse the generated API documentation directly on Github.

 - [Server side Lua APIs](http://openwrt.github.io/luci/api/index.html)
 - [Client side JavaScript APIs](http://openwrt.github.io/luci/jsapi/index.html)

## Development

Documentation for developing and extending LuCI can be found [in the Wiki](https://github.com/openwrt/luci/wiki)

## License

See [LICENSE](LICENSE) file.
 
## Package Guidelines

See [CONTRIBUTING.md](CONTRIBUTING.md) file.

## Translation status

[![Translation status](https://hosted.weblate.org/widgets/openwrt/-/multi-auto.svg)](https://hosted.weblate.org/engage/openwrt/?utm_source=widget)
