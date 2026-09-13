# luci-app-attendedsysupgrade

`luci-app-attendedsysupgrade` is an app for the OpenWrt LuCI web interface
that facilitates updates and upgrades for both firmware and software packages. 

It appears at `System → Attended Sysupgrade` in the web interface
where controls and configurations for _when_ it should check for
firmware upgrades and _where_ it should send build requests are provided.

Build requests include information about the request system's 
CPU architecture/target and its currently installed packages. These are sent
to an **A**ttended **S**ys**U**pgrade server (ASU) which,
if available, will then respond with an install-ready custom firmware image that
includes the latest requested firmware and package updates.

By default, this plugin only prompts to send a build request when firmware
upgrades are detected and the user interactively selects to upgrade.

_Customizable build requests are directly available via the
`Search for firmware upgrades` button when `Advanced Mode` is active._

Following a successful build request, a prompt appears with information about
the custom firmware image. The user  may select to install either with
or without the existing system configuration. 
There is also an option to download a separate copy
of that custom image via the web browser. Selecting `Install firmware image`
closes the prompt and the install proceeds with a system reboot.

ASU servers typically take between 30 seconds and 5 minutes
to process each build request and prepare a custom image.

> [!NOTE]
> Following the announcement of a major OpenWrt upgrade, availability of
> ASU servers may become limited for a few days as target builds are rolled out
> and servers contend with sharply increased demand.

## Further reading
If you would like more information about the backend server (and how to
host one yourself), please visit the [ASU Server repository](https://github.com/openwrt/asu).

Support is available at the official
[LuCI Attended Sysupgrade support thread](https://forum.openwrt.org/t/luci-attended-sysupgrade-support-thread).

<sub>`luci-app-attendedsysupgrade` is proudly installed in OpenWrt by default
since the release of 
[OpenWrt 25.12.0](https://openwrt.org/releases/25.12/notes-25.12.0#integration_of_attended_sysupgrade).</sub>