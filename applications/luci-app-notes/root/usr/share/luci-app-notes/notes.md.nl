# LuCI Notes

Welkom bij LuCI Notes. Je notities worden opgeslagen in `/etc/notes.md` en blijven behouden bij pakketupgrades.

Je kunt alle inhoud op deze pagina vervangen door je eigen notities.

Markdown-opmaak wordt toegepast nadat je hebt opgeslagen en bent teruggekeerd naar de weergavemodus.

# Markdown

LuCI Notes ondersteunt een beperkte subset van Markdown. De voorbeelden hieronder tonen de beschikbare opmaak.

---

# Kop 1
`# Kop 1`

---

## Kop 2
`## Kop 2`

---

### Kop 3
`### Kop 3`

---

**Vetgedrukte tekst**
`**Vetgedrukte tekst**`

---

__Ook vetgedrukte tekst__
`__Ook vetgedrukte tekst__`

---

*Cursieve tekst*
`*Cursieve tekst*`

---

_Ook cursieve tekst_
`_Ook cursieve tekst_`

---

Ingesloten `code` zoals hier
\`code\`

---

> Een blokcitaat
`> Een blokcitaat`

---

- Item in ongeordende lijst een
- Item in ongeordende lijst twee
+ Item in ongeordende lijst drie
+ Item in ongeordende lijst vier
* Item in ongeordende lijst vijf
* Item in ongeordende lijst zes
`- Item in ongeordende lijst een`
`- Item in ongeordende lijst twee`
`+ Item in ongeordende lijst drie`
`+ Item in ongeordende lijst vier`
`* Item in ongeordende lijst vijf`
`* Item in ongeordende lijst zes`

---

1. Item in geordende lijst een
2. Item in geordende lijst twee
`1. Item in geordende lijst een`
`2. Item in geordende lijst twee`

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

Speciale tekens kunnen worden ge-escaped met een backslash:

\*\*Deze tekst is niet vetgedrukt omdat de sterretjes zijn ge-escaped\*\*
`\*\*Deze tekst is niet vetgedrukt omdat de sterretjes zijn ge-escaped\*\*`

---

Horizontale lijnen:

`---`

---

Spaties kunnen worden gebruikt om in te springen

## Niet ondersteund
- Links
- Afbeeldingen
- Tabellen
- Geneste lijsten
- Directe HTML (invoer wordt ge-escaped en niet geïnterpreteerd)
- Livevoorbeeld tijdens het bewerken

---
