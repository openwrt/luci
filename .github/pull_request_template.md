<!-- 

Thank you for your contribution to the LuCI repository.

/************************************************/
/*   PLEASE READ THIS BEFORE CREATING YOUR PR   */
/************************************************/

Review the Contributing Guidelines: https://github.com/openwrt/luci/blob/master/CONTRIBUTING.md
(Especially if this is your first time to contribute to this repo.)

MUST NOT:
- Add a PR from your *main* branch - instead, put it on a separate branch.
- Add merge commits to your PR - instead, rebase locally and force-push.

MUST:
- Increment any PKG_VERSION in the affected Makefile.
- Set to draft if this PR depends on other PRs as well (e.g. openwrt/openwrt).
- Have each commit subject line starting with '<package name>: title', and the title starting in lowercase, with a reasonable number of characters total.
- Have a commit comment as it cannot be empty, with a reasonable number of characters per line.
- Have each commit with a valid `Signed-off-by: ` (S.O.B.) with a reachable email (GitHub noreply emails are not accepted).
	* Forgot? `git commit --amend ; git push -f`
	* Tip: use `git commit --signoff`

MAY:
- Your S.O.B. *may* be a nickname.
- Delete the *optional* entries in the checklist that do not apply.
- Skip a `<package name>: title` first line subject if the commit is for house-keeping or a chore.

-->

## Pull Request details

### Description
<!-- Describe the changes proposed in this PR. -->


### Screenshot or video of changes _(If applicable)_
<!-- Insert your screenshot or .mp4 here. -->


### Maintainer _(Preferred)_
<!-- You can find this by checking the history of the package Makefile. -->
@<github-user>

---

## Tested on
**OpenWrt version:** 
**LuCI version:** 
**Web browser:** 

---

## Checklist
- [ ] This PR is not from my *main* or *master* branch :poop:, but a *separate* branch. :white_check_mark:
- [ ] Each commit has a valid :black_nib: `Signed-off-by: <my@email.address>` row (via `git commit --signoff`).
- [ ] Each commit and PR title has a valid :memo: `<package name>: title` first line subject for packages.
- [ ] Incremented :up: any `PKG_VERSION` in the Makefile.
- [ ] _(Optional)_ Includes what Issue it closes (e.g. openwrt/luci#issue-number).
- [ ] _(Optional)_ Includes what it depends on (e.g. openwrt/packages#pr-number in sister repo).
