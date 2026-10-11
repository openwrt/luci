# LuCI Notes

Witamy w LuCI Notes. Notatki są przechowywane w `/etc/notes.md` i zachowywane podczas aktualizacji pakietów.

Możesz zastąpić całą zawartość tej strony własnymi notatkami.

Formatowanie Markdown jest stosowane po zapisaniu i powrocie do trybu podglądu.

# Markdown

LuCI Notes obsługuje niewielki podzbiór Markdown. Poniższe przykłady pokazują dostępne formatowanie.

---

# Nagłówek 1
`# Nagłówek 1`

---

## Nagłówek 2
`## Nagłówek 2`

---

### Nagłówek 3
`### Nagłówek 3`

---

**Pogrubiony tekst**
`**Pogrubiony tekst**`

---

__Również pogrubiony tekst__
`__Również pogrubiony tekst__`

---

*Tekst kursywą*
`*Tekst kursywą*`

---

_Również tekst kursywą_
`_Również tekst kursywą_`

---

`kod`
\`kod\`

---

> Cytat blokowy
`> Cytat blokowy`

---

- Element listy nieuporządkowanej jeden
- Element listy nieuporządkowanej dwa
+ Element listy nieuporządkowanej trzy
+ Element listy nieuporządkowanej cztery
* Element listy nieuporządkowanej pięć
* Element listy nieuporządkowanej sześć
`- Element listy nieuporządkowanej jeden`
`- Element listy nieuporządkowanej dwa`
`+ Element listy nieuporządkowanej trzy`
`+ Element listy nieuporządkowanej cztery`
`* Element listy nieuporządkowanej pięć`
`* Element listy nieuporządkowanej sześć`

---

1. Element listy uporządkowanej jeden
2. Element listy uporządkowanej dwa
`1. Element listy uporządkowanej jeden`
`2. Element listy uporządkowanej dwa`

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

Znaki specjalne można poprzedzić ukośnikiem odwrotnym:

\*\*Ten tekst nie jest pogrubiony, ponieważ gwiazdki zostały poprzedzone ukośnikiem\*\*
`\*\*Ten tekst nie jest pogrubiony, ponieważ gwiazdki zostały poprzedzone ukośnikiem\*\*`

---

Linie poziome:

`---`

---

Spacje mogą służyć do wcięć

## Nieobsługiwane
- Linki
- Obrazy
- Tabele
- Listy zagnieżdżone
- Bezpośredni HTML (dane wejściowe są kodowane i nieinterpretowane)
- Podgląd na żywo podczas edycji

---
