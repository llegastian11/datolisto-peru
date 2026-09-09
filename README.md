# DatoListo Perú

MVP local para una página de consultas gratuitas. Las herramientas llaman a ApiPeruDev desde backend para no exponer el token en el navegador.

## Ejecutar

1. Crea el archivo `.env`:

```bash
cp .env.example .env
```

2. Edita `.env` y coloca tu token:

```bash
APIPERU_TOKEN=tu_token_real
```

Cuando tengas dominio, configura también:

```bash
SITE_URL=https://tu-dominio.com
```

3. Levanta el servidor:

```bash
npm start
```

4. Abre:

```txt
http://127.0.0.1:3000
```

## Publicar en Render

El repositorio incluye `render.yaml` para desplegar la aplicación completa como servicio web.

1. Crea un Blueprint en Render desde este repositorio.
2. Configura `APIPERU_TOKEN` como secreto cuando Render lo solicite.
3. Render asignará la URL pública y la aplicación la usará para SEO, sitemap y enlaces sociales.

El plan gratuito puede suspender el servicio después de un periodo sin tráfico. La primera solicitud posterior puede tardar mientras inicia la instancia.

## Seguridad inicial

- El token del proveedor solo vive en el servidor.
- El frontend nunca llama directamente a ApiPeruDev.
- El servidor valida formatos antes de consultar al proveedor.
- Hay rate limit básico por IP.
- El MVP no guarda DNI ni resultados.
- La interfaz muestra notas de uso responsable por herramienta.

## SEO

- Metadatos básicos, Open Graph y Twitter Cards en `public/index.html`.
- Datos estructurados JSON-LD para `WebApplication`, `Organization` y `FAQPage`.
- `robots.txt` y `sitemap.xml` se generan desde el servidor usando `SITE_URL`.
- Imagen social en `public/og-image.svg`.
- Manifest en `public/site.webmanifest`.

## Endpoints locales

- `POST /api/dni`
- `POST /api/dni-ruc`
- `POST /api/ruc`
- `POST /api/ruc-representantes`
- `POST /api/ruc-establecimientos`
- `POST /api/ruc-domicilio`
- `POST /api/ruc-deuda`
- `POST /api/ruc-trabajadores`
- `POST /api/tipo-cambio`
- `POST /api/cpe`
- `POST /api/afp`

## Módulos activos

- DNI: nombres y apellidos.
- DNI-RUC: disponible en backend para futuras pantallas.
- RUC: datos básicos del contribuyente.
- RUC avanzado: representantes, establecimientos, domicilio fiscal, deuda coactiva y trabajadores.
- Tipo de cambio: compra y venta por fecha.
- Conversor USD/PEN con tasa manual.
- CPE: validación individual de comprobantes.
- AFP: comisiones por periodo.
- Calculadoras: IGV, recibo por honorarios, AFP estimada, CTS y gratificación.
- Utilidades: validador CCI y feriados Perú 2026.

Algunos endpoints de RUC avanzado dependen del plan contratado en ApiPeruDev. Si el plan no tiene acceso, el backend devuelve el mensaje del proveedor sin romper la interfaz.

## Para escalar

- Mover rate limit a Redis cuando haya más de una instancia.
- Agregar captcha en módulos sensibles como DNI.
- Guardar métricas agregadas sin almacenar datos personales.
- Separar proveedores en archivos cuando el servidor crezca.
- Agregar caché corta para consultas públicas como tipo de cambio y AFP.
