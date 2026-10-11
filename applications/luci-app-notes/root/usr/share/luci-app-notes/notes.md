# LuCI Notes

Welcome to LuCI Notes. Your notes are stored in `/etc/notes.md` and preserved across package upgrades.

You can replace everything on this page with your own notes.

Markdown formatting is applied after you save and return to view mode.

# Markdown

LuCI Notes supports a small subset of Markdown. The examples below show the available formatting.

---

# Header 1
`# Header 1`

---

## Header 2
`## Header 2`

---

### Header 3
`### Header 3`

---

**Bold text**
`**Bold text**`

---

__Also bold text__
`__Also bold text__`

---

*Italic text*
`*Italic text*`

---

_Also italic text_
`_Also italic text_`

---

Inline `code` like this
\`code\`

---

> A blockquote
`> A blockquote`

---

- Unordered list item one
- Unordered list item two
+ Unordered list item three
+ Unordered list item four
* Unordered list item five
* Unordered list item six
`- Unordered list item one`
`- Unordered list item two`
`+ Unordered list item three`
`+ Unordered list item four`
`* Unordered list item five`
`* Unordered list item six`

---

1. Ordered list item one
2. Ordered list item two
`1. Ordered list item one`
`2. Ordered list item two`

---

```
function example() {
    return true;
}
```

\```
function example() {
    return true;
}
\```

---

Special characters can be escaped using a backslash:

\*\*This text is not bold, because asterisks are escaped\*\*
`\*\*This text is not bold, because asterisks are escaped\*\*`

---

Horizontal rules:

`---`

---

Whitesplaces can be used for indentation

## Not supported
- Links
- Images
- Tables
- Nested lists
- HTML passthrough (input is escaped and not interpreted)
- Live preview while editing

---
