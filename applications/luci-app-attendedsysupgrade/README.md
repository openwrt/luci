# luci-app-attendedsysupgrade

`luci-app-attendedsysupgrade` is a plugin for the OpenWrt LuCI web interface
that facilitates updates and upgrades for both firmware and software packages. 

Upon installation, it adds a web page to the OpenWrt LuCI web interface
available at `System > Attended Sysupgrade` which provides controls
and configurations for when and where to send build requests.

Build requests include information about the request system's 
CPU architecture/target and its currently installed packages. These are sent
to an _**A**ttended **S**ys**U**pgrade_ server (ASU) which,
if available, will then respond with an install-ready custom firmware image that
includes the latest requested firmware and package updates.

_An option in the configuration page called "Advanced Mode" activates a prompt 
to customize what to include upon a manually-activated build request._

Following a successful build request, the user is prompted with a link to
download a copy of the custom firmware image to their computer and the option to
immediately install the custom firmware image either with or without keeping
currently set system configurations.

The process per image takes between 30 seconds and 5 minutes, and may be down
for a few days during the build rollouts and peak usage that follows major
OpenWrt upgrades.

More information on the backend server and how to host one are available on the
projects page: https://github.com/openwrt/asu
