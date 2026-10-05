# Musongs

Reproductor de música web escrito en TypeScript cuyo núcleo es una lista doblemente enlazada implementada a mano.

## Contexto académico

Proyecto del **Taller Reproductor de Música** del curso **Estructuras de Datos** (profesor Jhonatan Mideros Narvaez), dedicado a las listas doblemente enlazadas.

## Estado

Versión completa de la entrega: reproductor, playlists, columna derecha con «Sonando» y «Estructura», arrastrar y soltar, columnas redimensionables, modo aleatorio sobre la lista doblemente enlazada, «Explorar» con Audius, atajos de teclado y persistencia local.

Despliegue: https://musongs.vercel.app/

## Funcionalidades

- **Cargar música local**: botones «Cargar canciones» (varios archivos) y «Cargar carpeta». Se leen título, artista, álbum, carátula y duración de cada archivo; si faltan, se usa el nombre del archivo y una carátula genérica. Al terminar aparece un resumen: canciones agregadas, duplicadas, no compatibles e ignoradas.
- **Biblioteca**: reúne todas las canciones cargadas, sin repetidas. Es una lista doblemente enlazada.
- **Playlists**: crear, renombrar, duplicar y eliminar. Cada playlist es su propia lista doblemente enlazada y puede contener la misma canción más de una vez.
- **Agregar una canción al inicio, al final o en cualquier posición**: desde el botón «+» de una fila (eliges la playlist de destino) o desde «Agregar canción» en la cabecera de una playlist (eliges la canción de la biblioteca). Las posiciones fuera de rango se rechazan con un mensaje.
- **Quitar canciones**: en una playlist se quita solo esa aparición; en la biblioteca, tras confirmar, se quita de la biblioteca y de todas las playlists.
- **Reproducción real** en el navegador: reproducir y pausar, siguiente y anterior (siguen los enlaces `next` y `prev` del nodo actual y se desactivan en los extremos), avance automático al terminar una canción, barra de progreso para saltar, tiempo actual y duración, volumen y silencio.
- **Botón para reproducir una playlist** (también la Biblioteca): empieza desde la primera canción; si esa lista ya está sonando, pausa y reanuda.
- **Repetir**: desactivado, toda la lista (al llegar al final vuelve a la primera canción, y «anterior» en la primera va a la última) o una canción (se repite al terminar). La lista no se vuelve circular: el reproductor decide cuándo saltar al otro extremo.
- **Buscar en la lista visible** por título, artista o álbum, sin importar mayúsculas ni tildes (la «ñ» cuenta como letra distinta). La búsqueda solo oculta filas: no cambia la lista ni el orden de «siguiente» y «anterior».
- **Reproduciendo ahora**: una vista con la carátula grande y los controles. La pestaña «A continuación» muestra las canciones que siguen recorriendo los enlaces `next` desde el nodo actual, y «Anteriores» las que quedaron atrás recorriendo los enlaces `prev`; al tocar una se reproduce desde ahí.
- **Letras sincronizadas**: en la pestaña «Letra» la línea actual se resalta y se puede tocar una línea para saltar a ese momento. La letra se toma, en este orden, de un archivo `.lrc` con el mismo nombre que la canción y en la misma carpeta, de la letra incluida en el propio archivo de audio o, si no hay ninguna, de [LRCLIB](https://lrclib.net). A LRCLIB solo se envían el título, el artista, el álbum y la duración, y solo cuando abres la pestaña «Letra»; nunca se envía el audio.
- **Mover canciones**: los botones «Subir» y «Bajar» de cada fila cambian la posición de la canción dentro de la lista (se desactivan en los extremos y se ocultan mientras hay una búsqueda activa). Por debajo, la operación `moveNode` desvincula el mismo nodo y lo vuelve a enlazar en la nueva posición, sin crear ni destruir nodos.
- **Duplicar playlist**: el botón «Duplicar» de la cabecera (también en la Biblioteca) crea una copia con nodos nuevos que comparten las mismas canciones, y la muestra.
- **Columna derecha con dos pestañas**: «Sonando» (carátula grande, título, artista, tarjetas con la canción anterior y la siguiente según los enlaces `prev` y `next`, y «A continuación» con las próximas 8) y «Estructura». El botón del reproductor muestra u oculta toda la columna, y se recuerda si estaba abierta y en qué pestaña.
- **Biblioteca guardada en el navegador**: al recargar la página tus playlists, el orden y las preferencias (volumen, silencio, repetir) vuelven solos, y las canciones se pueden reproducir sin volver a seleccionarlas porque el audio se guarda en el almacenamiento del navegador (IndexedDB), en tu computador. Abajo en el menú lateral se ve cuánto ocupa («N canciones en este navegador · X MB») y «Borrar datos guardados» lo elimina todo tras confirmar. Si el navegador no puede guardar el audio (modo privado, sin espacio), las canciones aparecen como «Archivo no disponible» y un aviso permite reconectarlas con «Cargar carpeta».
- **Panel «Estructura»**: muestra en vivo la lista doblemente enlazada de la playlist que estás viendo. Cada canción aparece como un nodo con su índice, sus enlaces `prev` y `next` y las marcas `head`, `tail` y `current`; el resumen indica `length`, `head` y `tail`. Al agregar, mover o quitar una canción, el recuadro «Última operación» la muestra como código (`append()`, `prepend()`, `insert(i)`, `removeNode()`…) y con una frase como «Se insertó «Brisa» entre «Aurora» y «Cometa»», y los nodos cuyos enlaces cambiaron se iluminan un instante. Con «siguiente» y «anterior» se ve cómo `current` avanza por los enlaces. En listas largas se muestran 15 nodos antes y 15 después del actual. Tocar un nodo lo reproduce. Es la segunda pestaña de la columna derecha: en el computador está visible; en tableta y celular se abre con el botón del reproductor.
- **Controles del sistema** (Media Session): en el celular la pantalla de bloqueo y la notificación muestran la canción con su carátula y permiten pausar, cambiar de canción y adelantar; en el computador funcionan las teclas multimedia.
- La canción actual se resalta en la lista que se está reproduciendo con unas barras animadas, y el título de la pestaña muestra lo que suena.
- **Saltar canciones no disponibles**: «siguiente», «anterior» y el avance automático siguen los enlaces hasta la primera canción disponible (con «repetir toda la lista» dan la vuelta, como máximo una vez); si no hay ninguna, la reproducción se detiene.
- **Arrastrar y soltar**: cada fila tiene un asa «Arrastrar para mover» (con el mouse o con una pulsación larga de 300 ms en pantallas táctiles) para cambiar su posición con una línea que marca el destino, desplazamiento automático en los bordes y cancelación con Escape. Arrastrar una fila sobre una playlist del menú lateral la agrega al final. También se pueden soltar archivos o carpetas del computador sobre la lista: en la Biblioteca se insertan en el lugar donde sueltas, y en una playlist además se agregan al final de la Biblioteca. Los botones «Subir» y «Bajar» siguen siendo la alternativa con teclado. No funciona mientras hay una búsqueda activa ni en «Explorar».
- **Columnas redimensionables** (escritorio, desde 1100 px): separadores entre el menú lateral, la lista y la columna derecha, con mouse o con las flechas (16 px, Mayús 64 px); doble clic o Inicio restablecen el ancho. Los anchos se recuerdan.
- **Aleatorio**: sin tocar el orden original, el reproductor recorre una copia mezclada (se clona la playlist y se mezcla con Fisher–Yates usando solo `moveNode`; la canción que suena pasa a la cabeza). «Sonando» muestra «Orden aleatorio» y la posición del nodo (`nodo [i] · length N`), y «Estructura» muestra la lista mezclada. Se activa desde el reproductor o la cabecera de la lista y se recuerda.
- **Cabecera de la playlist**: carátula generada con la inicial sobre un degradado fijo para cada playlist, nombre, «N canciones · M min», reproducir, aleatorio, «Agregar canciones» (varias a la vez, con filtro y posición), «Importar aquí» (archivos nuevos van a la Biblioteca y a esa playlist), renombrar y eliminar. Cada fila muestra el «Origen» (archivo local o Audius) y, al pasar el mouse o enfocar, un botón para reproducir.
- **Explorar** (Audius): música libre de [Audius](https://audius.co). Busca por texto o por género, muestra los resultados como una lista doblemente enlazada temporal (siguiente, anterior, repetir y aleatorio funcionan sobre ella) y permite agregar canciones a la Biblioteca o a una playlist; solo se guardan las direcciones, no el audio. Sin internet aparece «No se pudo conectar con Audius» y tus canciones locales siguen sonando.
- **Atajos de teclado**: Espacio reproducir o pausar · Mayús+→ / Mayús+← siguiente y anterior · → / ← adelantar o retroceder 5 s · ↑ / ↓ volumen · M silenciar · S aleatorio · R repetir · L «Reproduciendo ahora» · E columna derecha · / buscar · ? lista de atajos. No actúan mientras escribes ni con un diálogo abierto.
- Diseño adaptable (escritorio, tableta y móvil con menú lateral), tema claro u oscuro según el sistema, uso completo con teclado y respeto por «reducir movimiento».

## Tecnologías

- TypeScript (modo `strict`)
- Vite
- Vitest para las pruebas
- HTML y CSS sin frameworks de interfaz
- Fuentes Manrope y JetBrains Mono desde Google Fonts

## Cómo ejecutarlo

Requiere Node.js 22.12 o superior.

```bash
npm install
npm run dev
npm test
npm run build
```

- `npm run dev`: inicia el servidor de desarrollo.
- `npm test`: ejecuta las pruebas.
- `npm run build`: verifica los tipos y genera la versión de producción en `dist/`.

## Privacidad

**Archivos locales.** Las canciones se seleccionan desde el computador de cada usuario y se reproducen directamente en el navegador. Nunca se suben a ningún servidor: la copia que se guarda para no tener que volver a elegirlas queda en el almacenamiento del propio navegador (IndexedDB) y se borra con «Borrar datos guardados». El repositorio ignora los archivos de audio para que no se publiquen por error.

**Audius (streaming).** «Explorar» consulta la API pública de Audius por internet y reproduce las canciones directamente desde Audius. A Audius solo se envía el texto que buscas o el género elegido; tus archivos locales, sus nombres y sus metadatos nunca se envían. Del audio de Audius no se guarda ninguna copia: en tu navegador solo quedan las direcciones de las canciones que agregas a tu biblioteca.

**Letras.** La búsqueda de letras en LRCLIB recibe el título, el artista, el álbum y la duración de la canción cuando no hay letra local y abres la pestaña «Letra».

## Documentación y forma de trabajo

- `docs/` contiene el diseño detallado: arquitectura, estructura de datos, interfaz, plan del proyecto y plan de pruebas.
- `CLAUDE.md` contiene las reglas permanentes del proyecto.

El desarrollo se realiza con asistencia de Claude como agente de implementación, bajo la supervisión del estudiante, quien toma las decisiones de arquitectura, revisa cada etapa y hace los commits.
