# Hoy Toca Plan · Málaga

Agenda pública y gratuita de planes familiares y actividades infantiles en Málaga y su provincia.

**Web oficial:** https://juanan88.github.io/hoy-toca-plan/

## Funcionamiento

Este repositorio público contiene solamente la web del navegador, los JSON publicados y el workflow de GitHub Pages; **no incluye rastreadores, programas Python, tests internos ni secretos**.

Las actualizaciones, la importación verificada de actividades por IA y las comprobaciones de calidad se procesan en un motor privado. Después se exportan **únicamente 12 archivos autorizados** y GitHub Pages comprueba que su catálogo coincide con el desplegado.

Los datos son informativos: horarios, plazas, precios y edades deben confirmarse siempre con los organizadores. La disponibilidad de entradas no está verificada.

## Nueva dirección

La dirección canónica y oficial es `https://juanan88.github.io/hoy-toca-plan/`. La antigua `https://juanan88.github.io/pequeplan-malaga/` corresponde a una instalación anterior y puede dejar de estar disponible cuando su código histórico se privatice. Cambia los marcadores por la URL nueva.

## Publicación

`.github/workflows/pages.yml` revisa los archivos permitidos, valida el JSON, publica en GitHub Pages y compara el HTML y el hash del catálogo servidos realmente.
