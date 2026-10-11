# LuCI Notes

Selamat datang ke LuCI Notes. Nota anda disimpan dalam `/etc/notes.md` dan dikekalkan semasa naik taraf pakej.

Anda boleh menggantikan semua kandungan halaman ini dengan nota anda sendiri.

Pemformatan Markdown digunakan selepas anda menyimpan dan kembali ke mod paparan.

# Markdown

LuCI Notes menyokong subset kecil Markdown. Contoh di bawah menunjukkan pemformatan yang tersedia.

---

# Tajuk 1
`# Tajuk 1`

---

## Tajuk 2
`## Tajuk 2`

---

### Tajuk 3
`### Tajuk 3`

---

**Teks tebal**
`**Teks tebal**`

---

__Juga teks tebal__
`__Juga teks tebal__`

---

*Teks condong*
`*Teks condong*`

---

_Juga teks condong_
`_Juga teks condong_`

---

`kod`
\`kod\`

---

> Petikan
`> Petikan`

---

- Item senarai tidak tersusun satu
- Item senarai tidak tersusun dua
+ Item senarai tidak tersusun tiga
+ Item senarai tidak tersusun empat
* Item senarai tidak tersusun lima
* Item senarai tidak tersusun enam
`- Item senarai tidak tersusun satu`
`- Item senarai tidak tersusun dua`
`+ Item senarai tidak tersusun tiga`
`+ Item senarai tidak tersusun empat`
`* Item senarai tidak tersusun lima`
`* Item senarai tidak tersusun enam`

---

1. Item senarai tersusun satu
2. Item senarai tersusun dua
`1. Item senarai tersusun satu`
`2. Item senarai tersusun dua`

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

Aksara khas boleh di-escape menggunakan garis condong terbalik:

\*\*Teks ini tidak tebal kerana asterisk telah di-escape\*\*
`\*\*Teks ini tidak tebal kerana asterisk telah di-escape\*\*`

---

Garis mendatar:

`---`

---

Ruang boleh digunakan untuk inden

## Tidak disokong
- Pautan
- Imej
- Jadual
- Senarai bersarang
- HTML terus (input di-escape dan tidak ditafsirkan)
- Pratonton langsung semasa menyunting

---
