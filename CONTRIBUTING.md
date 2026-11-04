# Contributing Guidelines

## Translations

Use [Weblate](https://hosted.weblate.org/engage/openwrt/?utm_source=widget) instead of direct editing of the `*.po` files. This also applies to translations written with an LLM.

A pull request should not change existing `*.po` files, not even their line references. Weblate breaks easily when such a change is merged while the same files have unmerged changes in Weblate or in an open pull request from Weblate, and the conflicts then have to be fixed by hand. The `.po` files are synced with the templates separately.

A pull request may add or update the translation template, `po/templates/<name>.pot`. Update it with `./build/i18n-scan.pl <app folder> > <app folder>/po/templates/<name>.pot`, because `./build/i18n-sync.sh` also rewrites the `.po` files. A new application should also add one untranslated `.po` file, so that Weblate notices it.

LuCI can render translated strings as HTML, so a wrong or malicious translation can break a page or inject script into the admin interface. Translations therefore belong on Weblate, where the translators of each language can see and correct them, not in your pull request or in another repository.

## Application sources

The sources of an application, including its JavaScript, its menu and ACL files and its translation template, live in this repository next to its Makefile. Do not fetch them from another repository or a release archive at build time. A version bump would then show only a new hash here, while the code and the translations inside the archive could change without any review. If you develop the application elsewhere, send each change here as a pull request.

## AI policy

This is the short version. [AI_POLICY.md](AI_POLICY.md) explains how to disclose, what your `Signed-off-by` covers, how to test and how the review bot fits in.

> [!WARNING]
> You **must** disclose any LLM usage in your pull request, description or commit messages.

We support the use of LLMs for coding, but we hold a high bar for all contributions, and we expect a human in the loop who genuinely understands the work an LLM produces on their behalf. You add your `Signed-off-by` yourself, never a tool, and it covers the parts an LLM wrote.

> [!IMPORTANT]
> Don't rely on LLMs to write the whole thing for you when communicating with the maintainers, and don't post wall-of-text comments.

We expect comments on our projects to be written by humans. The readers are humans, and we'd like to hear from you, not from a model. We may hide or remove any comments that we believe are LLM-generated. Commit messages and pull request and issue descriptions are different: an LLM may draft them, and you disclose that as described above.

If you're using an LLM to edit your comments, or to translate them as a non-native English speaker, keep them short, review before posting, and make sure they say what you mean.

> [!CAUTION]
> Do not use autonomous agents for contributing to our projects.

We will close any pull requests that we believe were created autonomously. The same goes for untested pull requests opened in bulk.

## Patches and pull requests

If you want to contribute a change to LuCI, please either send a patch using git send-email or open a pull request (PR) against the openwrt/luci repository.

Regardless of whether you send a patch or open a pull request, please try to follow these rules:

* Have a useful commit subject prefixed with the component name, with your commit subject having a reasonable number of characters. Your title after the component name must start with a lowercase letter.
    (E.g.: "luci-mod-admin-full: wifi channel selection on STA networks")
* In your commit message, shortly explain the changes made and - if applicable - the reasoning behind them, with your message having a reasonable number of characters per line. You cannot have an empty commit message.
* Keep the explanation in proportion to the change. A one-line fix needs a few sentences in the commit message and pull request description, not a page.
* Commit message of each commit **must** include a Signed-off-by line. Your first and last name should be used. Using a GitHub noreply email address will not be accepted.
    (See <https://openwrt.org/submitting-patches#sign_your_work>)

In case you like to send patches by mail, please use the [OpenWrt Development List](https://lists.openwrt.org/mailman/listinfo/openwrt-devel), although patches to luci are preferred in [the luci repo on GitHub](https://github.com/openwrt/luci/pulls).

If you are sending via the OpenWrt list, include a `[luci]` tag in your subject line. For general information on patch submission, follow the [OpenWrt patch submission guideline](https://openwrt.org/submitting-patches).

## Advice on pull requests

Pull requests are the easiest way to contribute changes to git repos at GitHub. They are the preferred contribution method, as they offer a nice way for commenting and amending the proposed changes.

* You need a local "fork" of the Github repo.
* Create and use a "feature branch" that isn't named "master" or "main" for your changes. That separates the changes in the pull request from your other changes and makes it easy to edit/amend commits in the pull request. Workflow using `feature_x` as the example:
  - Update your local git fork to the tip (of the master, usually)
  - Create the feature branch with `git checkout -b feature_x`
  - Edit changes and commit them locally
  - Push them to your GitHub fork by `git push -u origin feature_x`. That creates the `feature_x` branch at your GitHub fork and sets it as the remote of this branch
  - When you now visit GitHub, you should see a proposal to create a pull request.

* If you later need to add new commits to the pull request, you can simply commit the changes to the local branch and then use `git push` to automatically update the pull request.

* If you need to change something in the existing pull request (e.g. to add a missing signed-off-by line to the commit message), you can use `git push -f` to overwrite the original commits. That is easy and safe when using a feature branch. Example workflow:
  - Checkout the feature branch by `git checkout feature_x`
  - Edit changes and commit them locally. If you are just updating the commit message in the last commit, you can use `git commit --amend` to do that
  - If you added several new commits or made other changes that require cleaning up, you can use `git rebase -i HEAD~X` (X = number of commits to edit) to possibly squash some commits
  - Push the changed commits to GitHub with `git push -f` to overwrite the original commits in the "feature_x" branch with the new ones. The pull request will be automatically updated.

## If you have commit access

* Do **not** use `git push --force`.
* Use pull requests if you are unsure and to suggest changes to other developers.

## Gaining commit access

* Commit access will be granted to responsible contributors who have made useful pull requests and/or feedback or patches to this repository or OpenWrt in general. Please include your request for commit access in your next pull request or ticket.

## Release branches

* Branches named `openwrt-xx.yy` (e.g. `openwrt-25.12`) are release branches.
* These branches are built with the respective OpenWrt release and are created during the release stabilisation phase.
* Please **only** cherry-pick or commit security and bug-fixes to these branches.
* Do **not** add new packages and do **not** do major upgrades of packages here.
* If you are unsure if your change is suitable, please use a pull request.
