# AI policy

This file expands on the short [AI policy](CONTRIBUTING.md#ai-policy) from the
Contributing Guidelines. If these two disagree, the short one applies and this
one needs to be updated.

## Scope

This policy applies to all code contributions, alongside issues and pull
requests surrounding this codebase. This includes:

- Issue and PR descriptions
- Issue and PR comments
- Code review comments
- Commit messages

## Permitted usage

- Writing or changing code with an LLM, as long as you understand every line
  and can explain it in review.
- Letting an LLM draft a commit message, pull request description or issue
  description, as long as you review it, cut it down and disclose it.
- Editing, shortening or translating a comment you wrote yourself.
- Asking an LLM to review your own change before you submit it. If you fix
  what it finds yourself, nothing from the review ends up in your pull request,
  so the review needs no disclosure. If you take code or text it wrote,
  disclose it.

## Forbidden usage

- Comments in discussions that an LLM wrote for you. You write your comments.
- Pull requests, pushes or comments that a tool publishes without you reading
  and approving each one first. This is what we mean by autonomous agents.
- Posting an LLM review of someone else's pull request from your account.
- Opening pull requests in bulk from a tool's output, such as the same change
  split across many applications, without building, testing and following up
  on each one.
- Adding translations that an LLM wrote to a pull request. Translations are
  done on Weblate.
- Hiding or understating how much an LLM was involved.

## Disclosure

Tick the checkbox in the pull request template and say in the description
what the LLM was used for. For example: "The view and the commit message were
drafted with an LLM. I reviewed both and tested them on my router." You do not
need to name the tool or model. In an issue, say it in the issue description.
In a patch sent by mail, say it in the commit message. What matters is that
reviewers can tell at a glance where and how AI was involved in your
contribution.

> [!IMPORTANT]
> Do not add `Co-authored-by:` or other trailers that name a tool, and do not
> link to the chat or agent session. A trailer lists the tool as an author
> but says nothing about how it was used. A session link usually works only
> for you. The `Co-authored-by:` that GitHub adds when you commit a
> suggestion from the review bot is fine.

## Signed-off-by

Only you add your `Signed-off-by`, never a tool. With it you certify the
[Developer Certificate of Origin](https://openwrt.org/submitting-patches#sign_your_work)
for the whole change, including the parts an LLM wrote. That includes making
sure no code was copied from a source under an incompatible license. The
other [commit rules](CONTRIBUTING.md#patches-and-pull-requests) still apply.

## Translations and sources

Translations follow the [translation rules](CONTRIBUTING.md#translations):
they are done on Weblate, not in your pull request. A pull request may add or
update the translation template, but it leaves existing `*.po` files to
Weblate and adds no translated strings. An application keeps its sources in
this repository. See
[application sources](CONTRIBUTING.md#application-sources). Both rules exist
so that the code is reviewed here and the translations stay where the
translators of each language can see and correct them.

## Testing

An LLM-assisted change needs the same testing as any other change. Build the
package, install it on a device or in a VM, for example x86/64 or armsr/armv8
in QEMU, and try every page you changed in a browser. Fill in the versions the
pull request template asks for, and add a screenshot for a visible change.
Never claim a test you did not run.

## Keep it short

Commit messages and pull request descriptions say what changes and why. Issue
descriptions say what is wrong or what you propose, and why. Leave out
summaries of the diff, long test logs and filler. Match the length to the
change: a one-line fix needs a few sentences, not a page. A reviewer should be
able to read the description in a minute.

For a larger effort, agree on the direction in an issue before you open a
series of pull requests, and keep that issue to a short list of open points
with only the links a reader needs.

## Review bot

The project's own review bot (currently the
[openwrt-ai](https://github.com/openwrt-ai) account) posts automated reviews
on pull requests. Its comments are advisory, and maintainers decide which of
them need to be addressed. The rules above apply to contributors, not to this
bot.

## Enforcement

> [!WARNING]
> If we suspect undisclosed AI usage in a contribution, we will ask for
> disclosure. If you refuse to provide one, we will reject the contribution, and
> close your PR or issue.

We may hide or remove comments that break these rules. The rules apply to
maintainers' contributions too.
