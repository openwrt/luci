# OpenWrt luci feed

[![Translation status](https://hosted.weblate.org/widgets/openwrt/-/svg-badge.svg)](https://hosted.weblate.org/engage/openwrt/?utm_source=widget)

## Description

This is the OpenWrt "luci"-feed containing LuCI - OpenWrt Configuration Interface.

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

 Including taffydb in the Project
To ensure that the required taffydb dependency is available in your project, follow these steps:

Install taffydb
Run the following command in your project directory to install taffydb:

bash
Copy code
npm install taffydb --save-dev
Why taffydb?
taffydb is a lightweight JavaScript database used in this project for efficient data management. It is required to run certain scripts, such as generating documentation via jsdoc.

Regenerate API Documentation
Once taffydb is installed, you can regenerate the API documentation using:

bash
Copy code
npm run doc
This command ensures that the documentation is built using the jsdoc tool and the necessary dependencies.
## License

See [LICENSE](LICENSE) file.
 
## Package Guidelines

See [CONTRIBUTING.md](CONTRIBUTING.md) file.

## Translation status

[![Translation status](https://hosted.weblate.org/widgets/openwrt/-/multi-auto.svg)](https://hosted.weblate.org/engage/openwrt/?utm_source=widget)
