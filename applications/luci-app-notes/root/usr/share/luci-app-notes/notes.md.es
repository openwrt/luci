# LuCI Notes

Bienvenido a LuCI Notes. Sus notas se almacenan en `/etc/notes.md` y se conservan durante las actualizaciones de paquetes.

Puede reemplazar todo el contenido de esta página con sus propias notas.

El formato Markdown se aplica después de guardar y volver al modo de visualización.

# Markdown

LuCI Notes admite un pequeño subconjunto de Markdown. Los siguientes ejemplos muestran el formato disponible.

---

# Encabezado 1
`# Encabezado 1`

---

## Encabezado 2
`## Encabezado 2`

---

### Encabezado 3
`### Encabezado 3`

---

**Texto en negrita**
`**Texto en negrita**`

---

__También texto en negrita__
`__También texto en negrita__`

---

*Texto en cursiva*
`*Texto en cursiva*`

---

_También texto en cursiva_
`_También texto en cursiva_`

---

`código` en línea como este
\`código\`

---

> Una cita en bloque
`> Una cita en bloque`

---

- Elemento uno de la lista sin ordenar
- Elemento dos de la lista sin ordenar
+ Elemento tres de la lista sin ordenar
+ Elemento cuatro de la lista sin ordenar
* Elemento cinco de la lista sin ordenar
* Elemento seis de la lista sin ordenar
`- Elemento uno de la lista sin ordenar`
`- Elemento dos de la lista sin ordenar`
`+ Elemento tres de la lista sin ordenar`
`+ Elemento cuatro de la lista sin ordenar`
`* Elemento cinco de la lista sin ordenar`
`* Elemento seis de la lista sin ordenar`

---

1. Elemento uno de la lista ordenada
2. Elemento dos de la lista ordenada
`1. Elemento uno de la lista ordenada`
`2. Elemento dos de la lista ordenada`

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

Los caracteres especiales se pueden escapar mediante una barra invertida:

\*\*Este texto no está en negrita porque los asteriscos están escapados\*\*
`\*\*Este texto no está en negrita porque los asteriscos están escapados\*\*`

---

Líneas horizontales:

`---`

---

Los espacios se pueden utilizar para la sangría

## No compatible
- Enlaces
- Imágenes
- Tablas
- Listas anidadas
- Paso directo de HTML (la entrada se escapa y no se interpreta como HTML)
- Vista previa en tiempo real durante la edición

---
