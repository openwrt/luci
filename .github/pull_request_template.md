<!-- 

Thank you for your contribution to the luci repository.

Please read this before creating your PR.

Review https://github.com/openwrt/luci/blob/master/CONTRIBUTING.md
especially if this is your first time to contribute to this repo.

MUST NOT:
- add a PR from your *main* branch - put it on a separate branch
- add merge commits to your PR: rebase locally and force-push

MUST:
- increment any PKG_VERSION in the affected Makefile
- set to draft if this PR depends on other PRs to e.g. openwrt/openwrt
- each commit subject line starts with '<package name>: title' 
- each commit has a valid `Signed-off-by: ` (S.O.B.) with a reachable email
	* Forgot? `git commit --amend ; git push -f`
	* Tip: use `git commit --signoff`

MAY:
- your S.O.B. *may* be a nickname
- delete the below *optional* entries that do not apply
- skip a `<package name>: title` first line subject if the commit is house-keeping or chore

-->

- [ ] This PR is not from my *main* or *master* branch :poop:, but a *separate* branch :white_check_mark:
- [ ] Each commit has a valid :black_nib: `Signed-off-by: <my@email.address>` row (via `git commit --signoff`)
- [ ] Each commit and PR title has a valid :memo: `<package name>: title` first line subject for packages
- [ ] Incremented :up: any `PKG_VERSION` in the Makefile
- [ ] Tested on: (architecture, openwrt version, browser) :white_check_mark:
- [ ] \( Preferred ) Mention: @ the original code author for feedback
- [ ] \( Preferred ) Screenshot or mp4 of changes:
- [ ] \( Optional ) Closes: e.g. openwrt/luci#issue-number
- [ ] \( Optional ) Depends on: e.g. openwrt/packages#pr-number in sister repo
- [ ] Description: (describe the changes proposed in this PR)
