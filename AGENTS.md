# Instructions for coding agents

This file summarizes rules from [CONTRIBUTING.md](CONTRIBUTING.md),
[AI_POLICY.md](AI_POLICY.md) and the pull request template. Those files are
the source of truth. Read them before you change anything.

- Never add a `Signed-off-by` tag. The human adds it.
- Never push, open a pull request or post a comment unless the human has read
  and approved it first.
- Never write a comment on an issue or pull request for the human. The human
  writes comments. You may edit, shorten or translate one the human wrote.
- Remind the human to say in the pull request what the LLM was used for. Do
  not add `Co-authored-by:` or other trailers that name a tool, and do not add
  links to the chat or agent session.
- Keep commit messages, pull request and issue descriptions short and in
  proportion to the change: what changes and why. No diff summaries, no long
  logs.
- Keep comments to a reasonable level. Do not overexplain, add comments to or
  remove comments from unrelated parts of the codebase.
- Start the commit subject with the package name and a lowercase title, for
  example `luci-app-foo: fix the status page`.
- Never change existing `*.po` files, also not by running
  `build/i18n-sync.sh`, and never add translated strings. Translations are
  done on Weblate. You may add or update `po/templates/<name>.pot` with
  `build/i18n-scan.pl`. A new application also adds one untranslated `.po`
  file, so that Weblate notices it.
- Keep an application's sources in this repository next to its Makefile.
  Never fetch them at build time from another repository or a release archive.
- If the Makefile of a package you change sets `PKG_VERSION`, increment it.
- Test every changed page in a browser on a device or in QEMU before the human
  submits it. Report the OpenWrt, LuCI and browser versions, and never claim a
  test that did not run.
- Never open pull requests in bulk without a build, a test and follow-up by
  the human for each one.
