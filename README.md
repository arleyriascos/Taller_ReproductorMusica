# Musongs

Reproductor de música web escrito en TypeScript cuyo núcleo es una lista doblemente enlazada implementada a mano.

## Contexto académico

Proyecto del **Taller Reproductor de Música** del curso **Estructuras de Datos** (profesor Jhonatan Mideros Narvaez), dedicado a las listas doblemente enlazadas.

## Estado

En desarrollo. Por ahora el proyecto contiene solo la base técnica y una pantalla provisional.

Despliegue: https://musongs.vercel.app/

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

Las canciones se seleccionarán desde el computador de cada usuario y se reproducirán directamente en el navegador. Nunca se suben a ningún servidor, y el repositorio ignora los archivos de audio para que no se publiquen por error.

## Documentación y forma de trabajo

- `docs/` contiene el diseño detallado: arquitectura, estructura de datos, interfaz, plan del proyecto y plan de pruebas.
- `CLAUDE.md` contiene las reglas permanentes del proyecto.

El desarrollo se realiza con asistencia de Claude como agente de implementación, bajo la supervisión del estudiante, quien toma las decisiones de arquitectura, revisa cada etapa y hace los commits.
