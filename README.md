# Hoy Toca Plan · Málaga

Agenda pública de planes y actividades infantiles en Málaga y provincia.

**Web pública:** https://juanan88.github.io/hoy-toca-plan/

Este repositorio contiene únicamente la interfaz web, los datos publicados y el flujo de despliegue de GitHub Pages. La recopilación y validación se realizan en un repositorio privado separado; no hay rastreadores ni código Python en este repositorio.

Los datos son orientativos: las fechas, plazas, precios y recomendaciones de edad deben comprobarse con cada organizador. La disponibilidad de entradas no está verificada.

**Migración:** la web anterior en https://juanan88.github.io/pequeplan-malaga/ se mantiene disponible durante la transición. No se debe desactivar hasta confirmar la publicación y actualización automática de esta nueva URL.

## Publicación

GitHub Pages se genera mediante GitHub Actions con el workflow `.github/workflows/pages.yml`. La rama `main` almacena los archivos visibles públicamente. La carpeta `data/` contiene información publicada y no debe recibir secretos ni datos personales.
