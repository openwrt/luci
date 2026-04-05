# Contributing Guidelines

## Translations

Use [Weblate](https://hosted.weblate.org/engage/openwrt/?utm_source=widget) instead of direct editing of the `*.po` files.

## Patches and Pull Requests:

If you want to contribute a change to LuCI, please either send a patch using git send-email
or open a "Pull Request" against the openwrt/luci repository.

Regardless of whether you send a patch or open a pull request, please try to follow these rules:

* Have a useful commit subject prefixed with the component name, with your commit subject having a reasonable number of characters. Your title after the component name must start with a lowercase letter.
    (E.g.: "luci-mod-admin-full: wifi channel selection on STA networks")
* In your commit message, shortly explain the changes made and - if applicable - the reasoning behind them, with your message having a reasonable number of characters per line. You cannot have an empty commit message.
* Commit message of each commit **must** include a Signed-off-by line. Your first and last name should be used. Using a GitHub noreply email address will not be accepted.
    (See <https://openwrt.org/submitting-patches#sign_your_work>)

In case you like to send patches by mail, please use the [OpenWrt Development List](https://lists.openwrt.org/mailman/listinfo/openwrt-devel), although patches to luci are preferred in [the luci repo on GitHub](https://github.com/openwrt/luci/pulls).

If you are sending via the OpenWrt list, include a `[luci]` tag in your subject line.
For general information on patch submission, follow the [OpenWrt patch submission guideline](https://openwrt.org/submitting-patches).

## Advice on Pull Requests:

Pull Requests are the easiest way to contribute changes to git repos at GitHub. They are the preferred contribution method, as they offer a nice way for commenting and amending the proposed changes.

* You need a local "fork" of the Github repo.
* Create and use a "feature branch" that isn't named "master" or "main" for your changes. That separates the changes in the Pull Request from your other changes and makes it easy to edit/amend commits in the Pull Request. Workflow using `feature_x` as the example:
  - Update your local git fork to the tip (of the master, usually)
  - Create the feature branch with `git checkout -b feature_x`
  - Edit changes and commit them locally
  - Push them to your GitHub fork by `git push -u origin feature_x`. That creates the `feature_x` branch at your GitHub fork and sets it as the remote of this branch
  - When you now visit GitHub, you should see a proposal to create a Pull Request.

* If you later need to add new commits to the Pull Request, you can simply commit the changes to the local branch and then use `git push` to automatically update the Pull Request.

* If you need to change something in the existing Pull Request (e.g. to add a missing signed-off-by line to the commit message), you can use `git push -f` to overwrite the original commits. That is easy and safe when using a feature branch. Example workflow:
  - Checkout the feature branch by `git checkout feature_x`
  - Edit changes and commit them locally. If you are just updating the commit message in the last commit, you can use `git commit --amend` to do that
  - If you added several new commits or made other changes that require cleaning up, you can use `git rebase -i HEAD~X` (X = number of commits to edit) to possibly squash some commits
  - Push the changed commits to GitHub with `git push -f` to overwrite the original commits in the "feature_x" branch with the new ones. The Pull Request will be automatically updated.

## If you have commit access:

* Do **NOT** use `git push --force`.
* Use Pull Requests if you are unsure and to suggest changes to other developers.

## Gaining commit access:

* Commit access will be granted to responsible contributors who have made
  useful Pull Requests and / or feedback or patches to this repository or
  OpenWrt in general. Please include your request for commit access in your
  next Pull Request or ticket.

## Release branches:

* Branches named `openwrt-xx.yy` (e.g. `openwrt-18.06`) are release branches.
* These branches are built with the respective OpenWrt release and are created
  during the release stabilisation phase.
* Please ONLY cherry-pick or commit security and bug-fixes to these branches.
* Do **NOT** add new packages and do **NOT** do major upgrades of packages here.
* If you are unsure if your change is suitable, please use a Pull Request.
