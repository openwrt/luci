# Contributing Guidelines

Patches and pull-requests:

If you want to contribute a change to LuCI, please either send a patch using git send-email
or open a pull request against the openwrt/luci repository.

Regardless of whether you send a patch or open a pull request, please try to follow these rules:

* Have a useful subject prefixed with the component name  
    (E.g.: "modules/admin-full: fix wifi channel selection on multiple STA networks")
* Shortly explain the changes made and - if applicable - the reasoning behind them
* Include Signed-off-by in the comment  
    (See <https://dev.openwrt.org/wiki/SubmittingPatches#a10.Signyourwork>)
	
In case you like to send patches by mail, please use the [LuCI mailinglist](https://lists.subsignal.org/mailman/listinfo/luci)
or the [OpenWrt Development List](https://lists.openwrt.org/cgi-bin/mailman/listinfo/openwrt-devel).

If you send via the OpenWrt list, include a "[luci]" tag in your subject line.
For general information on patch submission, follow the [OpenWrt patch submission guideline](https://dev.openwrt.org/wiki/SubmittingPatches).


If you have commit access:

* Do NOT use git push --force.
* Use Pull Requests if you are unsure and to suggest changes to other developers.

Gaining commit access:

* Commit access will be granted to responsible contributors who have made
  useful pull requests and / or feedback or patches to this repository or
  OpenWrt in general. Please include your request for commit access in your
  next pull request or ticket.

Release Branches:

* Branches named "luci-X.Y" (e.g. luci-0.12) are release branches.
* These branches are built with the respective OpenWrt release and are created
  during the release stabilisation phase.
* Please ONLY cherry-pick or commit security and bug-fixes to these branches.
* Do NOT add new packages and do NOT do major upgrades of packages here.
* If you are unsure if your change is suitable, please use a pull request.

