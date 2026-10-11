# LuCI Notes

Vítejte v LuCI Notes. Vaše poznámky jsou uloženy v `/etc/notes.md` a zachovány při aktualizacích balíčků.

Veškerý obsah této stránky můžete nahradit vlastními poznámkami.

Formátování Markdown se použije po uložení a návratu do režimu zobrazení.

# Markdown

LuCI Notes podporuje malou podmnožinu Markdownu. Následující příklady ukazují dostupné formátování.

---

# Nadpis 1
`# Nadpis 1`

---

## Nadpis 2
`## Nadpis 2`

---

### Nadpis 3
`### Nadpis 3`

---

**Tučný text**
`**Tučný text**`

---

__Také tučný text__
`__Také tučný text__`

---

*Text kurzívou*
`*Text kurzívou*`

---

_Také text kurzívou_
`_Také text kurzívou_`

---

`kód`
\`kód\`

---

> Citace
`> Citace`

---

- Položka nečíslovaného seznamu jedna
- Položka nečíslovaného seznamu dva
+ Položka nečíslovaného seznamu tři
+ Položka nečíslovaného seznamu čtyři
* Položka nečíslovaného seznamu pět
* Položka nečíslovaného seznamu šest
`- Položka nečíslovaného seznamu jedna`
`- Položka nečíslovaného seznamu dva`
`+ Položka nečíslovaného seznamu tři`
`+ Položka nečíslovaného seznamu čtyři`
`* Položka nečíslovaného seznamu pět`
`* Položka nečíslovaného seznamu šest`

---

1. Položka číslovaného seznamu jedna
2. Položka číslovaného seznamu dva
`1. Položka číslovaného seznamu jedna`
`2. Položka číslovaného seznamu dva`

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

Speciální znaky lze escapovat zpětným lomítkem:

\*\*Tento text není tučný, protože hvězdičky jsou escapované\*\*
`\*\*Tento text není tučný, protože hvězdičky jsou escapované\*\*`

---

Vodorovné čáry:

`---`

---

Pro odsazení lze použít mezery

## Nepodporováno
- Odkazy
- Obrázky
- Tabulky
- Vnořené seznamy
- Přímé HTML (vstup se escapuje a neinterpretuje)
- Živý náhled při úpravách

---
