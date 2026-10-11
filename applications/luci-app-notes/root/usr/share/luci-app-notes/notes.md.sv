# LuCI Notes

Välkommen till LuCI Notes. Dina anteckningar lagras i `/etc/notes.md` och bevaras vid paketuppgraderingar.

Du kan ersätta allt på den här sidan med dina egna anteckningar.

Markdown-formatering tillämpas när du har sparat och återgått till visningsläget.

# Markdown

LuCI Notes stöder en mindre delmängd av Markdown. Exemplen nedan visar den formatering som är tillgänglig.

---

# Rubrik 1
`# Rubrik 1`

---

## Rubrik 2
`## Rubrik 2`

---

### Rubrik 3
`### Rubrik 3`

---

**Fet text**
`**Fet text**`

---

__Också fet text__
`__Också fet text__`

---

*Kursiv text*
`*Kursiv text*`

---

_Också kursiv text_
`_Också kursiv text_`

---

Infogad `kod` så här
\`kod\`

---

> Ett blockcitat
`> Ett blockcitat`

---

- Oordnad listpost ett
- Oordnad listpost två
+ Oordnad listpost tre
+ Oordnad listpost fyra
* Oordnad listpost fem
* Oordnad listpost sex
`- Oordnad listpost ett`
`- Oordnad listpost två`
`+ Oordnad listpost tre`
`+ Oordnad listpost fyra`
`* Oordnad listpost fem`
`* Oordnad listpost sex`

---

1. Ordnad listpost ett
2. Ordnad listpost två
`1. Ordnad listpost ett`
`2. Ordnad listpost två`

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

Specialtecken kan föregås av ett omvänt snedstreck:

\*\*Den här texten är inte fet eftersom asteriskerna föregås av omvända snedstreck\*\*
`\*\*Den här texten är inte fet eftersom asteriskerna föregås av omvända snedstreck\*\*`

---

Horisontella linjer:

`---`

---

Blanksteg kan användas för indrag

## Stöds inte
- Länkar
- Bilder
- Tabeller
- Nästlade listor
- HTML-genomsläpp (indata kodas och tolkas inte som HTML)
- Liveförhandsvisning under redigering

---
