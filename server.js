import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const distDir = join(root, "dist");

async function loadEnv() {
  try {
    const env = await readFile(join(root, ".env"), "utf8");
    for (const line of env.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env is optional in production environments.
  }
}

await loadEnv();

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const apiToken = process.env.APIPERU_TOKEN || "";
const siteUrl = (process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || `http://${host}:${port}`).replace(/\/$/, "");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

const buckets = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

const validators = {
  dni: /^\d{8}$/,
  ruc: /^\d{11}$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  period: /^\d{4}-\d{2}$/,
  documentType: /^(01|03|07|08)$/,
  serie: /^[A-Z0-9]{1,8}$/i,
  number: /^\d{1,20}$/
};

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  });
  res.end(JSON.stringify(payload));
}

function text(res, status, contentType, body) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function applySiteTemplate(content) {
  return content.replaceAll("__SITE_URL__", siteUrl);
}

function getIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  return Array.isArray(forwarded) ? forwarded[0] : (forwarded || req.socket.remoteAddress || "local").split(",")[0].trim();
}

function checkRateLimit(ip) {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || now - bucket.startedAt > WINDOW_MS) {
    buckets.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= MAX_REQUESTS;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 20_000) throw new Error("Payload demasiado grande.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function requireFields(body, fields) {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || String(body[field]).trim() === "") {
      return `Falta el campo ${field}.`;
    }
  }
  return "";
}

function assertFormat(value, regex, message) {
  return regex.test(String(value || "").trim()) ? "" : message;
}

function assertDate(value, message) {
  const raw = String(value || "").trim();
  if (!validators.date.test(raw)) return message;
  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw ? message : "";
}

async function callApiPeru(path, body) {
  if (!apiToken) {
    return {
      status: 503,
      payload: { error: "El servicio de consultas no está disponible temporalmente." }
    };
  }

  const response = await fetch(`https://apiperu.dev/api/${path}`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));
  if (payload.success === true) {
    return { status: 200, payload };
  }

  if (typeof payload.message === "string" && payload.message.includes('"success":true')) {
    const embedded = payload.message.match(/\{[\s\S]*\}/);
    if (embedded) {
      try {
        return { status: 200, payload: JSON.parse(embedded[0]) };
      } catch {
        // Fall through to the provider error below.
      }
    }
  }

  if (!response.ok || payload.success === false) {
    return {
      status: response.status || 502,
      payload: { error: payload.message || "No se pudo completar la consulta con el proveedor." }
    };
  }

  return { status: 200, payload };
}

function normalizeDni(payload, dni) {
  const data = payload.data || {};
  return {
    dni,
    nombres: data.nombres || "",
    nombreCompleto: data.nombre_completo || "",
    apellidoPaterno: data.apellido_paterno || "",
    apellidoMaterno: data.apellido_materno || "",
    codigoVerificacion: data.codigo_verificacion || "",
    fuente: "ApiPeruDev"
  };
}

function normalizeRuc(payload, ruc) {
  const data = payload.data || {};
  return {
    ruc: data.ruc || ruc,
    razonSocial: data.nombre_o_razon_social || "",
    estado: data.estado || "",
    condicion: data.condicion || "",
    direccion: data.direccion_completa || data.direccion || "",
    departamento: data.departamento || "",
    provincia: data.provincia || "",
    distrito: data.distrito || "",
    ubigeo: Array.isArray(data.ubigeo) ? data.ubigeo.join(" / ") : data.ubigeo_sunat || "",
    agenteRetencion: data.es_agente_de_retencion || "",
    buenContribuyente: data.es_buen_contribuyente || "",
    fuente: "ApiPeruDev / SUNAT"
  };
}

function normalizePlace(data = {}) {
  return {
    codigo: data.codigo || "",
    tipo: data.tipo_de_establecimiento || "",
    actividad: data.actividad_economica || "",
    direccion: data.direccion_completa || data.direccion || "",
    departamento: data.departamento || "",
    provincia: data.provincia || "",
    distrito: data.distrito || "",
    ubigeo: Array.isArray(data.ubigeo) ? data.ubigeo.join(" / ") : data.ubigeo_sunat || ""
  };
}

function normalizeList(payload, mapper, source = "ApiPeruDev / SUNAT") {
  const rows = Array.isArray(payload.data) ? payload.data : [];
  return {
    total: rows.length,
    items: rows.map(mapper),
    fuente: source
  };
}

function normalizeRucRepresentantes(payload) {
  return normalizeList(payload, (item) => ({
    tipoDocumento: item.tipo_de_documento || "",
    numeroDocumento: item.numero_de_documento || "",
    nombre: item.nombre || "",
    cargo: item.cargo || "",
    fechaDesde: item.fecha_desde || ""
  }));
}

function normalizeRucEstablecimientos(payload) {
  return normalizeList(payload, normalizePlace);
}

function normalizeRucDomicilio(payload) {
  const data = payload.data || {};
  return {
    ...normalizePlace(data),
    fuente: "ApiPeruDev / SUNAT"
  };
}

function normalizeRucDeuda(payload) {
  return normalizeList(payload, (item) => ({
    monto: item.monto || "",
    periodo: item.periodo_tibutario || item.periodo_tributario || "",
    fechaInicio: item.fecha_inicio_cobranza || "",
    entidad: item.entidad_asociada || ""
  }));
}

function normalizeRucTrabajadores(payload) {
  return normalizeList(payload, (item) => ({
    periodo: item.periodo || "",
    trabajadores: item.trabajadores ?? "",
    pensionistas: item.pensionistas ?? "",
    prestadores: item.prestadores_servicio ?? ""
  }));
}

function normalizeExchange(payload) {
  const data = payload.data || {};
  return {
    moneda: data.moneda || "USD",
    fecha: data.fecha_busqueda || data.date || "",
    compra: data.compra ?? data.purchase ?? "",
    venta: data.venta ?? data.sale ?? "",
    fuente: "ApiPeruDev"
  };
}

function normalizeCpe(payload) {
  const data = payload.data || {};
  return {
    mensaje: payload.message || data.comprobante_estado_descripcion || "",
    estadoComprobante: data.comprobante_estado_descripcion || "",
    codigoEstadoComprobante: data.comprobante_estado_codigo || "",
    estadoEmpresa: data.empresa_estado_description || data.empresa_estado_descripcion || "",
    condicionEmpresa: data.empresa_condicion_descripcion || "",
    observaciones: Array.isArray(data.observaciones) ? data.observaciones : [],
    fuente: "ApiPeruDev / SUNAT"
  };
}

function normalizeAfp(payload) {
  const rows = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload.comisiones) ? payload.comisiones : []);
  return {
    periodo: (rows[0] && rows[0].periodo) || "",
    items: rows.map((item) => ({
      afp: item.afp || "",
      comisionFija: item.comision_fija ?? "",
      comisionFlujo: item.comision_flujo ?? "",
      comisionMixtaFlujo: item.comision_mixta_flujo ?? "",
      comisionMixtaSaldo: item.comision_mixta_saldo ?? "",
      primaSeguro: item.prima_de_seguro ?? "",
      aporteObligatorio: item.aporte_obligatorio ?? "",
      remuneracionMaxima: item.remunaracion_maxima ?? item.remuneracion_maxima ?? ""
    })),
    fuente: "ApiPeruDev"
  };
}

async function handleApi(req, res, route) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    json(res, 400, { error: "Solicitud inválida." });
    return;
  }

  const validationError = route.validate(body);
  if (validationError) {
    json(res, 400, { error: validationError });
    return;
  }

  const ip = getIp(req);
  if (!checkRateLimit(ip)) {
    json(res, 429, { error: "Demasiadas consultas. Intenta nuevamente en un minuto." });
    return;
  }

  try {
    const upstream = await callApiPeru(route.path, route.mapBody(body));
    if (upstream.status !== 200) {
      json(res, upstream.status, upstream.payload);
      return;
    }
    json(res, 200, route.normalize(upstream.payload, body));
  } catch {
    json(res, 502, { error: "El proveedor de consulta no respondió correctamente." });
  }
}

const apiRoutes = {
  "/api/dni": {
    path: "dni",
    validate: (body) => assertFormat(body.dni, validators.dni, "El DNI debe tener exactamente 8 dígitos."),
    mapBody: (body) => ({ dni: String(body.dni).trim() }),
    normalize: (payload, body) => normalizeDni(payload, String(body.dni).trim())
  },
  "/api/dni-ruc": {
    path: "dni-ruc",
    validate: (body) => assertFormat(body.dni, validators.dni, "El DNI debe tener exactamente 8 dígitos."),
    mapBody: (body) => ({ dni: String(body.dni).trim() }),
    normalize: (payload) => ({
      mensaje: payload.message || "",
      ruc: (payload.data && payload.data.ruc) || "",
      fuente: "ApiPeruDev"
    })
  },
  "/api/ruc": {
    path: "ruc",
    validate: (body) => assertFormat(body.ruc, validators.ruc, "El RUC debe tener exactamente 11 dígitos."),
    mapBody: (body) => ({ ruc: String(body.ruc).trim() }),
    normalize: (payload, body) => normalizeRuc(payload, String(body.ruc).trim())
  },
  "/api/ruc-representantes": {
    path: "ruc-representantes",
    validate: (body) => assertFormat(body.ruc, validators.ruc, "El RUC debe tener exactamente 11 dígitos."),
    mapBody: (body) => ({ ruc: String(body.ruc).trim() }),
    normalize: normalizeRucRepresentantes
  },
  "/api/ruc-establecimientos": {
    path: "ruc-establecimientos-anexos",
    validate: (body) => assertFormat(body.ruc, validators.ruc, "El RUC debe tener exactamente 11 dígitos."),
    mapBody: (body) => ({ ruc: String(body.ruc).trim() }),
    normalize: normalizeRucEstablecimientos
  },
  "/api/ruc-domicilio": {
    path: "ruc-domicilio-fiscal",
    validate: (body) => assertFormat(body.ruc, validators.ruc, "El RUC debe tener exactamente 11 dígitos."),
    mapBody: (body) => ({ ruc: String(body.ruc).trim() }),
    normalize: normalizeRucDomicilio
  },
  "/api/ruc-deuda": {
    path: "ruc-deuda-coactiva",
    validate: (body) => assertFormat(body.ruc, validators.ruc, "El RUC debe tener exactamente 11 dígitos."),
    mapBody: (body) => ({ ruc: String(body.ruc).trim() }),
    normalize: normalizeRucDeuda
  },
  "/api/ruc-trabajadores": {
    path: "ruc-trabajadores",
    validate: (body) => assertFormat(body.ruc, validators.ruc, "El RUC debe tener exactamente 11 dígitos."),
    mapBody: (body) => ({ ruc: String(body.ruc).trim() }),
    normalize: normalizeRucTrabajadores
  },
  "/api/tipo-cambio": {
    path: "tipo-de-cambio",
    validate: (body) => assertDate(body.fecha, "La fecha debe tener formato yyyy-mm-dd."),
    mapBody: (body) => ({ fecha: String(body.fecha).trim() }),
    normalize: normalizeExchange
  },
  "/api/cpe": {
    path: "cpe",
    validate: (body) => {
      const missing = requireFields(body, ["ruc_emisor", "codigo_tipo_documento", "serie_documento", "numero_documento", "fecha_de_emision", "total"]);
      if (missing) return missing;
      return assertFormat(body.ruc_emisor, validators.ruc, "El RUC emisor debe tener exactamente 11 dígitos.")
        || assertFormat(body.codigo_tipo_documento, validators.documentType, "El tipo debe ser 01, 03, 07 u 08.")
        || assertFormat(body.serie_documento, validators.serie, "La serie debe tener entre 1 y 8 caracteres.")
        || assertFormat(body.numero_documento, validators.number, "El número debe contener solo dígitos.")
        || assertDate(body.fecha_de_emision, "La fecha de emisión debe tener formato yyyy-mm-dd.")
        || (Number.isFinite(Number(body.total)) && Number(body.total) > 0 ? "" : "El total debe ser un número mayor que cero.");
    },
    mapBody: (body) => ({
      ruc_emisor: String(body.ruc_emisor).trim(),
      codigo_tipo_documento: String(body.codigo_tipo_documento).trim(),
      serie_documento: String(body.serie_documento).trim().toUpperCase(),
      numero_documento: String(body.numero_documento).trim(),
      fecha_de_emision: String(body.fecha_de_emision).trim(),
      total: Number(body.total)
    }),
    normalize: normalizeCpe
  },
  "/api/afp": {
    path: "comisiones-afp",
    validate: (body) => assertFormat(body.periodo, validators.period, "El periodo debe tener formato yyyy-mm."),
    mapBody: (body) => ({ periodo: String(body.periodo).trim() }),
    normalize: normalizeAfp
  }
};

async function serveStatic(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  if (url.pathname === "/health") {
    json(res, 200, { status: "ok" });
    return;
  }
  if (url.pathname === "/robots.txt") {
    text(res, 200, mimeTypes[".txt"], `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
    return;
  }
  if (url.pathname === "/sitemap.xml") {
    const pages = [""].map((path) => `
  <url>
    <loc>${siteUrl}/${path}</loc>
    <changefreq>weekly</changefreq>
    <priority>${path ? "0.8" : "1.0"}</priority>
  </url>`).join("");
    text(res, 200, mimeTypes[".xml"], `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages}\n</urlset>\n`);
    return;
  }

  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(decodeURIComponent(requestPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(distDir, safePath);

  if (!filePath.startsWith(distDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    let file;
    try {
      file = await readFile(filePath);
    } catch {
      file = await readFile(join(publicDir, safePath));
    }
    const ext = extname(filePath);
    const body = ext === ".html" ? applySiteTemplate(file.toString("utf8")) : file;
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
      "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY"
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer((req, res) => {
  const route = apiRoutes[req.url || ""];
  if (req.method === "POST" && route) {
    handleApi(req, res, route);
    return;
  }
  if ((req.url || "").startsWith("/api/")) {
    json(res, 404, { error: "Endpoint no encontrado." });
    return;
  }
  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res);
    return;
  }
  json(res, 405, { error: "Método no permitido." });
});

server.listen(port, host, () => {
  console.log(`DatoListo Perú disponible en http://${host}:${port}`);
});
