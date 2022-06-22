# luci-theme-argon ([中文](/README_ZH.md))

[1]: https://img.shields.io/badge/license-MIT-brightgreen.svg
[2]: /LICENSE
[3]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg
[4]: https://github.com/jerrykuku/luci-theme-argon/pulls
[5]: https://img.shields.io/badge/Issues-welcome-brightgreen.svg
[6]: https://github.com/jerrykuku/luci-theme-argon/issues/new
[7]: https://img.shields.io/badge/release-v1.7.3-blue.svg?
[8]: https://github.com/jerrykuku/luci-theme-argon/releases
[9]: https://img.shields.io/github/downloads/jerrykuku/luci-theme-argon/total
[10]: https://img.shields.io/badge/Contact-telegram-blue
[11]: https://t.me/jerryk6
[![license][1]][2]
[![PRs Welcome][3]][4]
[![Issue Welcome][5]][6]
[![Release Version][7]][8]
[![Release Count][9]][8]
[![Contact Me][10]][11]

![](/Screenshots/screenshot_pc.jpg)
![](/Screenshots/screenshot_phone.jpg)

A new Luci theme for LEDE/OpenWRT  
Argon is a clean HTML5 theme for LuCI. It is based on luci-theme-material and Argon Template  

## Notice

This branch only matches lean openwrt LuCI 18.06.

## Update log 2022.04.21 [18.06] V1.7.3

- 【v1.7.3】Fix the problem that the left navigation is unresponsive for a long time when accessing the status/firewall page.
- 【v1.7.3】Fix the problem that the login page is inaccessible when the bing wallpaper fails to be obtained.
- 【v1.7.2】Since access to the bing api requires a stable network on the router, the bing api is modified as an option, and the default is the built-in wallpaper display. After logging in, enter the argon-config [new version] to modify it.
- 【v1.7.2】Fixed an issue where the built-in switch could not display the interface icon and rate.
- 【v1.7.1】Fixed an issue where the text at the bottom of the login page would obscure the button at a very small resolution.
- 【v1.7.1】Solve the problem that the return cannot be obtained for a long time when the network speed is slow.
- 【v1.7.1】Adjusted some styles.
- 【v1.7.1】Added an animation effect to the progress bar.
- 【v1.7.0】Fix some color issue in dark mode.
- 【v1.7.0】Automatically set as the default theme when compiling.
- 【v1.7.0】Modify the file structure to adapt to luci-app-argon-config.
- 【v1.6.9】Fix the problem that the login background cannot be displayed on some phones.
- 【v1.6.9】Change Syslog background color to white.
- 【v1.6.9】Remove the dependency of luasocket.
- 【v1.6.8】Remove depends on wget, add depends Luasocket.
- 【v1.6.8】Update font icon, add a default icon of undefined menu.
- 【v1.6.6】Now backgorund allow png jpg gif and mp4 files, random change.
- 【v1.6.6】Add a volume mute button for video background, default is muted.
- 【v1.6.6】login page when keyboard show the bottom text overlay the button on mobile.
- 【v1.6.6】fix select color in dark mode,and add a style for scrollbar.
- 【v1.6.6】jquery update to v3.5.1.
- 【v1.6.4】New: login background image can be customized now, upload image to /www/luci-static/argon/background/ (only jpg, png and gif are allowed). Uploaded images will be displayed if they are present. If you have multiple images in /www/luci-static/argon/background/, they will be displayed randomly upon each login.
- 【v1.6.4】New: force dark mode. Dark mode can now be enabled without client being in "dark mode". To enable: ssh into your router and enter "touch /etc/dark", to disable enter "rm -rf touch /etc/dark" (automatic dark mode).
- 【v1.6.4】New: Argon Version displayed in footer will match ipk version from now on.
- 【v1.6.4】Fix: Font colors.
- 【v1.6.3】Add blur effect for login form.
- 【v1.6.1】New login theme, Request background imge from bing.com, Auto change everyday.
- 【v1.6.1】New theme icon.
- 【v1.6.1】Add more menu category  icon.
- 【v1.6.1】Fix font-size and padding margin.
- 【v1.6.1】Restructure css file.
- 【v1.6.1】Auto adapt to dark mode.

## How to build

Enter in your openwrt/package/lean or other

### Lean lede

```
cd lede/package/lean  
rm -rf luci-theme-argon  
git clone -b 18.06 https://github.com/jerrykuku/luci-theme-argon.git  
make menuconfig #choose LUCI->Theme->Luci-theme-argon  
make -j1 V=s  
```

## Install

### For Lean openwrt 18.06 LuCI

```
wget --no-check-certificate https://github.com/jerrykuku/luci-theme-argon/releases/download/v1.7.0/luci-theme-argon_1.7.0-20200908_all.ipk
opkg install luci-theme-argon*.ipk
```

## Thanks to

luci-theme-material: https://github.com/LuttyYang/luci-theme-material/
