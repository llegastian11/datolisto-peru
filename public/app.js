const form = document.querySelector("#tool-form");
const workspace = document.querySelector(".workspace");
const title = document.querySelector("#tool-title");
const description = document.querySelector("#tool-description");
const note = document.querySelector("#tool-note");
const message = document.querySelector("#message");
const result = document.querySelector("#result");
const servicesToggle = document.querySelector("#services-toggle");
const servicesDropdown = document.querySelector("#services-dropdown");
const calculatorsToggle = document.querySelector("#calculators-toggle");
const calculatorsDropdown = document.querySelector("#calculators-dropdown");
const moduleList = document.querySelector("#module-list");
const scrollBackdrop = document.querySelector(".scroll-backdrop");
const mobileToggle = document.querySelector("#mobile-toggle");
const mainNav = document.querySelector("#main-nav");
const toolStatus = document.querySelector("#tool-status");

const today = new Date().toISOString().slice(0, 10);
const currentPeriod = today.slice(0, 7);

const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const decimal = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 });

const rucField = { name: "ruc", label: "RUC", placeholder: "Ingresa 11 dígitos", inputmode: "numeric", maxlength: 11, pattern: "\\d{11}", required: true };
const dniField = { name: "dni", label: "DNI", placeholder: "Ingresa 8 dígitos", inputmode: "numeric", maxlength: 8, pattern: "\\d{8}", required: true };

const holidays2026 = [
  ["2026-01-01", "Año Nuevo"],
  ["2026-04-02", "Jueves Santo"],
  ["2026-04-03", "Viernes Santo"],
  ["2026-05-01", "Día del Trabajo"],
  ["2026-06-07", "Día de la Bandera"],
  ["2026-06-29", "San Pedro y San Pablo"],
  ["2026-07-23", "Día de la Fuerza Aérea"],
  ["2026-07-28", "Fiestas Patrias"],
  ["2026-07-29", "Fiestas Patrias"],
  ["2026-08-06", "Batalla de Junín"],
  ["2026-08-30", "Santa Rosa de Lima"],
  ["2026-10-08", "Combate de Angamos"],
  ["2026-11-01", "Todos los Santos"],
  ["2026-12-08", "Inmaculada Concepción"],
  ["2026-12-09", "Batalla de Ayacucho"],
  ["2026-12-25", "Navidad"]
];

const bankCodes = {
  "002": "BCP",
  "003": "Interbank",
  "009": "Scotiabank",
  "011": "BBVA",
  "018": "Banco de la Nación",
  "023": "Banco de Comercio",
  "038": "BanBif",
  "049": "MiBanco"
};

const tools = {
  dni: apiTool("Identidad", "DNI", "Nombres y apellidos", "Consulta básica por DNI", "Obtén nombres y apellidos para completar formularios con menos errores.", "/api/dni", [dniField], [
    ["nombres", "Nombres"],
    ["apellidoPaterno", "Apellido paterno"],
    ["apellidoMaterno", "Apellido materno"],
    ["codigoVerificacion", "Código verificación"],
    ["fuente", "Fuente"]
  ], "La consulta debe tener una finalidad legítima. No muestra dirección, fecha de nacimiento, sexo, foto ni otros datos sensibles.", "Consultar DNI"),

  dniRuc: apiTool("Identidad", "DNI-RUC", "RUC asociado a DNI", "Consulta DNI-RUC", "Verifica si un DNI tiene RUC asociado.", "/api/dni-ruc", [dniField], [
    ["mensaje", "Resultado"],
    ["ruc", "RUC asociado"],
    ["fuente", "Fuente"]
  ], "Este módulo solo confirma la relación DNI-RUC que devuelve el proveedor. No reemplaza una validación tributaria completa.", "Consultar DNI-RUC"),

  ruc: apiTool("SUNAT", "RUC", "Datos del contribuyente", "Consulta RUC", "Consulta razón social, estado, condición y ubicación fiscal básica.", "/api/ruc", [rucField], [
    ["razonSocial", "Razón social"],
    ["estado", "Estado"],
    ["condicion", "Condición"],
    ["direccion", "Dirección"],
    ["departamento", "Departamento"],
    ["provincia", "Provincia"],
    ["distrito", "Distrito"],
    ["fuente", "Fuente"]
  ], "Los datos se obtienen de la consulta RUC de SUNAT mediante el proveedor configurado.", "Consultar RUC"),

  rucRepresentantes: tableApiTool("SUNAT", "Representantes RUC", "Representantes legales", "Representantes legales por RUC", "Lista representantes legales registrados para un RUC.", "/api/ruc-representantes", [rucField], ["Tipo", "Documento", "Nombre", "Cargo", "Desde"], ["tipoDocumento", "numeroDocumento", "nombre", "cargo", "fechaDesde"], "Consultar representantes"),
  rucEstablecimientos: tableApiTool("SUNAT", "Establecimientos", "Anexos SUNAT", "Establecimientos anexos", "Lista establecimientos anexos asociados a un RUC.", "/api/ruc-establecimientos", [rucField], ["Código", "Tipo", "Dirección", "Distrito", "Ubigeo"], ["codigo", "tipo", "direccion", "distrito", "ubigeo"], "Consultar establecimientos"),
  rucDomicilio: apiTool("SUNAT", "Domicilio fiscal", "Dirección fiscal", "Domicilio fiscal RUC", "Consulta el domicilio fiscal registrado en SUNAT.", "/api/ruc-domicilio", [rucField], [
    ["tipo", "Tipo"],
    ["direccion", "Dirección"],
    ["departamento", "Departamento"],
    ["provincia", "Provincia"],
    ["distrito", "Distrito"],
    ["ubigeo", "Ubigeo"]
  ], "Úsalo como referencia operativa. La fuente es SUNAT mediante proveedor.", "Consultar domicilio"),
  rucDeuda: tableApiTool("SUNAT", "Deuda coactiva", "Cobranza SUNAT", "Deuda coactiva RUC", "Consulta registros de deuda coactiva asociados a un RUC.", "/api/ruc-deuda", [rucField], ["Monto", "Periodo", "Inicio cobranza", "Entidad"], ["monto", "periodo", "fechaInicio", "entidad"], "Consultar deuda"),
  rucTrabajadores: tableApiTool("SUNAT", "Trabajadores", "Declarados por periodo", "Trabajadores declarados", "Consulta trabajadores, pensionistas y prestadores informados por periodo.", "/api/ruc-trabajadores", [rucField], ["Periodo", "Trabajadores", "Pensionistas", "Prestadores"], ["periodo", "trabajadores", "pensionistas", "prestadores"], "Consultar trabajadores"),

  exchange: apiTool("Finanzas", "Tipo de cambio", "Compra y venta por fecha", "Tipo de cambio", "Consulta compra y venta por fecha para referencia operativa.", "/api/tipo-cambio", [
    { name: "fecha", label: "Fecha", type: "date", value: today, required: true }
  ], [
    ["moneda", "Moneda"],
    ["fecha", "Fecha"],
    ["compra", "Compra"],
    ["venta", "Venta"],
    ["fuente", "Fuente"]
  ], "La disponibilidad depende del proveedor y de la fecha consultada.", "Consultar tipo de cambio"),

  exchangeCalc: localTool("Finanzas", "Conversor USD/PEN", "Cálculo con tasa manual", "Conversor de moneda", "Convierte montos con una tasa ingresada manualmente.", [
    { name: "amount", label: "Monto", type: "number", step: "0.01", min: "0", value: "100", required: true },
    { name: "rate", label: "Tipo de cambio", type: "number", step: "0.001", min: "0", value: "3.50", required: true },
    { name: "direction", label: "Dirección", type: "select", options: [["usdToPen", "USD a PEN"], ["penToUsd", "PEN a USD"]], required: true }
  ], calculateExchange, "Es un cálculo referencial. Usa el módulo Tipo de cambio para consultar una tasa por fecha.", "Convertir"),

  cpe: apiTool("Comprobantes", "CPE", "Validación individual", "Validación CPE", "Valida comprobantes electrónicos individuales con los datos mínimos del documento.", "/api/cpe", [
    { name: "ruc_emisor", label: "RUC emisor", placeholder: "11 dígitos", inputmode: "numeric", maxlength: 11, pattern: "\\d{11}", required: true },
    { name: "codigo_tipo_documento", label: "Tipo", type: "select", required: true, options: [["01", "Factura"], ["03", "Boleta"], ["07", "Nota de crédito"], ["08", "Nota de débito"]] },
    { name: "serie_documento", label: "Serie", placeholder: "F001", maxlength: 8, required: true },
    { name: "numero_documento", label: "Número", placeholder: "650", inputmode: "numeric", maxlength: 20, required: true },
    { name: "fecha_de_emision", label: "Fecha de emisión", type: "date", value: today, required: true },
    { name: "total", label: "Total", type: "number", placeholder: "159.30", step: "0.01", min: "0.01", required: true }
  ], [
    ["mensaje", "Resultado"],
    ["estadoComprobante", "Estado comprobante"],
    ["estadoEmpresa", "Estado empresa"],
    ["condicionEmpresa", "Condición empresa"],
    ["observaciones", "Observaciones"],
    ["fuente", "Fuente"]
  ], "Necesitas los datos exactos del comprobante: emisor, tipo, serie, número, fecha y total.", "Validar CPE"),

  afp: tableApiTool("Laboral", "Comisiones AFP", "Por periodo", "Comisiones AFP", "Consulta comisiones, prima de seguro y aporte obligatorio por periodo.", "/api/afp", [
    { name: "periodo", label: "Periodo", type: "month", value: currentPeriod, required: true }
  ], ["AFP", "Flujo %", "Mixta saldo %", "Seguro %", "Aporte %", "Rem. máxima"], ["afp", "comisionFlujo", "comisionMixtaSaldo", "primaSeguro", "aporteObligatorio", "remuneracionMaxima"], "Consultar AFP"),

  igv: localTool("Calculadoras", "IGV", "Con y sin impuesto", "Calculadora IGV", "Calcula base imponible, IGV y total.", [
    { name: "amount", label: "Monto", type: "number", step: "0.01", min: "0", value: "118", required: true },
    { name: "mode", label: "Modo", type: "select", options: [["included", "El monto incluye IGV"], ["add", "Agregar IGV al monto"]], required: true }
  ], calculateIgv, "Usa una tasa IGV de 18%.", "Calcular IGV"),

  recibo: localTool("Calculadoras", "Recibo por honorarios", "Retención referencial", "Recibo por honorarios", "Calcula retención de cuarta categoría y neto a recibir.", [
    { name: "gross", label: "Monto bruto", type: "number", step: "0.01", min: "0", value: "1500", required: true },
    { name: "retention", label: "Retención %", type: "number", step: "0.01", min: "0", value: "8", required: true }
  ], calculateReceipt, "Cálculo referencial. Verifica la obligación de retener según el caso concreto.", "Calcular recibo"),

  afpCalc: localTool("Laboral", "AFP estimada", "Descuento mensual", "Calculadora AFP estimada", "Estima aporte obligatorio, prima y comisión sobre remuneración.", [
    { name: "salary", label: "Remuneración", type: "number", step: "0.01", min: "0", value: "2500", required: true },
    { name: "commission", label: "Comisión %", type: "number", step: "0.01", min: "0", value: "1.55", required: true },
    { name: "insurance", label: "Prima seguro %", type: "number", step: "0.01", min: "0", value: "1.70", required: true },
    { name: "mandatory", label: "Aporte obligatorio %", type: "number", step: "0.01", min: "0", value: "10", required: true }
  ], calculateAfp, "Los porcentajes son editables. Puedes copiarlos del módulo Comisiones AFP.", "Calcular descuento"),

  cci: localTool("Utilidades", "Validador CCI", "Formato bancario", "Validador CCI", "Valida longitud y reconoce banco por código inicial cuando es posible.", [
    { name: "cci", label: "CCI", placeholder: "20 dígitos", inputmode: "numeric", maxlength: 20, pattern: "\\d{20}", required: true }
  ], calculateCci, "No consulta saldos ni datos bancarios privados; solo valida formato referencial.", "Validar CCI"),

  holidays: localTool("Utilidades", "Feriados Perú", "Calendario 2026", "Feriados Perú 2026", "Revisa feriados nacionales y si una fecha coincide con uno.", [
    { name: "date", label: "Fecha", type: "date", value: today, required: true }
  ], calculateHoliday, "Lista referencial de feriados nacionales 2026. Los días no laborables especiales pueden cambiar por norma.", "Revisar fecha"),

  cts: localTool("Laboral", "CTS", "Estimación simple", "Calculadora CTS", "Estima CTS semestral a partir de sueldo, asignación familiar y meses computables.", [
    { name: "salary", label: "Sueldo mensual", type: "number", step: "0.01", min: "0", value: "2500", required: true },
    { name: "family", label: "Asignación familiar", type: "number", step: "0.01", min: "0", value: "0", required: true },
    { name: "months", label: "Meses computables", type: "number", step: "1", min: "0", max: "6", value: "6", required: true }
  ], calculateCts, "Fórmula referencial simplificada. No contempla todos los conceptos variables.", "Calcular CTS"),

  gratificacion: localTool("Laboral", "Gratificación", "Estimación simple", "Calculadora de gratificación", "Estima gratificación legal con bonificación extraordinaria.", [
    { name: "salary", label: "Sueldo mensual", type: "number", step: "0.01", min: "0", value: "2500", required: true },
    { name: "months", label: "Meses completos", type: "number", step: "1", min: "0", max: "6", value: "6", required: true },
    { name: "health", label: "Bonificación", type: "select", options: [["0.09", "EsSalud 9%"], ["0.0675", "EPS 6.75%"]], required: true }
  ], calculateBonus, "Cálculo referencial para régimen laboral privado común.", "Calcular gratificación")
};

let activeTool = "dni";

function apiTool(category, menuTitle, menuSubtitle, title, description, endpoint, fields, resultFields, note, submit) {
  return { kind: "api", category, menuTitle, menuSubtitle, title, description, endpoint, fields, resultFields, note, submit };
}

function tableApiTool(category, menuTitle, menuSubtitle, title, description, endpoint, fields, columns, keys, submit) {
  return { kind: "api-table", category, menuTitle, menuSubtitle, title, description, endpoint, fields, columns, keys, note: "Consulta desde proveedor externo. Puede no devolver datos si SUNAT no expone información para ese RUC o periodo.", submit };
}

function localTool(category, menuTitle, menuSubtitle, title, description, fields, calculate, note, submit) {
  return { kind: "local", category, menuTitle, menuSubtitle, title, description, fields, calculate, note, submit };
}

function n(value) {
  return Number(String(value || "0").replace(",", ".")) || 0;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);
}

function setMessage(text, type = "info") {
  message.textContent = text;
  message.classList.toggle("error", type === "error");
  message.classList.toggle("success", type === "success");
}

function cleanNumericInputs() {
  form.querySelectorAll("[inputmode='numeric']").forEach((input) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, Number(input.maxLength || 99));
    });
  });
}

function renderField(field) {
  if (field.type === "select") {
    const options = field.options.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
    return `<label class="control" for="${field.name}"><span>${field.label}</span><select name="${field.name}" id="${field.name}" ${field.required ? "required" : ""}>${options}</select></label>`;
  }

  const attrs = [
    `name="${field.name}"`,
    `id="${field.name}"`,
    field.type ? `type="${field.type}"` : `type="text"`,
    field.placeholder ? `placeholder="${field.placeholder}"` : "",
    field.inputmode ? `inputmode="${field.inputmode}"` : "",
    field.maxlength ? `maxlength="${field.maxlength}"` : "",
    field.pattern ? `pattern="${field.pattern}"` : "",
    field.step ? `step="${field.step}"` : "",
    field.min ? `min="${field.min}"` : "",
    field.max ? `max="${field.max}"` : "",
    field.value ? `value="${field.value}"` : "",
    field.required ? "required" : ""
  ].filter(Boolean).join(" ");

  return `<label class="control" for="${field.name}"><span>${field.label}</span><input ${attrs} /></label>`;
}

function groupedTools() {
  return Object.entries(tools).reduce((groups, [key, tool]) => {
    groups[tool.category] ||= [];
    groups[tool.category].push([key, tool]);
    return groups;
  }, {});
}

function renderNavigation() {
  const groups = groupedTools();
  const queryGroups = Object.fromEntries(Object.entries(groups).map(([category, entries]) => [
    category,
    entries.filter(([, tool]) => tool.kind !== "local")
  ]).filter(([, entries]) => entries.length));
  const calculatorGroups = Object.fromEntries(Object.entries(groups).map(([category, entries]) => [
    category,
    entries.filter(([, tool]) => tool.kind === "local")
  ]).filter(([, entries]) => entries.length));

  servicesDropdown.innerHTML = renderDropdownGroups(queryGroups);
  calculatorsDropdown.innerHTML = renderDropdownGroups(calculatorGroups);
  moduleList.innerHTML = Object.entries(groups).map(([category, entries]) => `
    <div class="service-category">${category}</div>
    ${entries.map(([key, tool]) => serviceButton(key, tool, "module")).join("")}
  `).join("");

  document.querySelectorAll("[data-tool]").forEach((item) => {
    item.addEventListener("click", () => {
      renderTool(item.dataset.tool);
      closeServicesMenu();
      document.querySelector("#consulta").scrollIntoView({ behavior: "smooth", block: "center" });
      closeMobileMenu();
    });
  });
}

function renderDropdownGroups(groups) {
  return Object.entries(groups).map(([category, entries]) => `
    <div class="service-category">${category}</div>
    ${entries.map(([key, tool]) => serviceButton(key, tool, "service-item")).join("")}
  `).join("");
}

function serviceButton(key, tool, className) {
  return `
    <button class="${className}" data-tool="${key}" type="button" role="menuitem">
      <span>${tool.menuTitle}</span>
      <small>${tool.menuSubtitle}</small>
    </button>
  `;
}

function renderTool(toolKey) {
  activeTool = toolKey;
  const tool = tools[toolKey];
  workspace.classList.remove("tool-swapped");
  void workspace.offsetWidth;
  workspace.classList.add("tool-swapped");
  title.textContent = tool.title;
  description.textContent = tool.description;
  note.textContent = tool.note;
  toolStatus.textContent = tool.kind === "local" ? "Cálculo local" : "Consulta externa";
  setMessage("");

  document.querySelectorAll("[data-tool]").forEach((item) => item.classList.toggle("active", item.dataset.tool === toolKey));

  form.className = `lookup-form ${tool.fields.length > 1 ? "wide" : ""}`;
  form.innerHTML = `
    <div class="form-grid">
      ${tool.fields.map(renderField).join("")}
    </div>
    <button type="submit"><span>${tool.submit}</span><span aria-hidden="true">→</span></button>
  `;

  result.className = "result";
  result.innerHTML = '<div class="empty-state">El resultado aparecerá aquí después de completar la consulta.</div>';
  cleanNumericInputs();
}

function renderResultFields(fields, data = {}) {
  return fields.map(([key, label]) => {
    const raw = data[key];
    const value = Array.isArray(raw) ? (raw.length ? raw.join(", ") : "Sin observaciones") : (raw ?? "");
    return `<div class="field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value === "" ? "-" : value)}</strong></div>`;
  }).join("");
}

function renderTable(items, columns, keys) {
  if (!items.length) {
    return `<div class="empty-state">Aún no consultado o sin registros para mostrar.</div>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
        <tbody>
          ${items.map((item) => `<tr>${keys.map((key) => `<td>${escapeHtml(item[key] ?? "")}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function getPayload() {
  return Object.fromEntries(new FormData(form).entries());
}

function calculateIgv(data) {
  const amount = n(data.amount);
  const base = data.mode === "included" ? amount / 1.18 : amount;
  const igv = data.mode === "included" ? amount - base : amount * 0.18;
  return resultCards([["Base imponible", money.format(base)], ["IGV 18%", money.format(igv)], ["Total", money.format(base + igv)]]);
}

function calculateReceipt(data) {
  const gross = n(data.gross);
  const retention = gross * (n(data.retention) / 100);
  return resultCards([["Monto bruto", money.format(gross)], ["Retención", money.format(retention)], ["Neto a recibir", money.format(gross - retention)]]);
}

function calculateAfp(data) {
  const salary = n(data.salary);
  const mandatory = salary * (n(data.mandatory) / 100);
  const commission = salary * (n(data.commission) / 100);
  const insurance = salary * (n(data.insurance) / 100);
  return resultCards([["Aporte obligatorio", money.format(mandatory)], ["Comisión", money.format(commission)], ["Seguro", money.format(insurance)], ["Descuento total", money.format(mandatory + commission + insurance)], ["Neto estimado", money.format(salary - mandatory - commission - insurance)]]);
}

function calculateExchange(data) {
  const amount = n(data.amount);
  const rate = n(data.rate);
  const converted = data.direction === "usdToPen" ? amount * rate : amount / Math.max(rate, 0.0001);
  return resultCards([["Monto origen", decimal.format(amount)], ["Tipo de cambio", decimal.format(rate)], ["Resultado", data.direction === "usdToPen" ? money.format(converted) : `US$ ${decimal.format(converted)}`]]);
}

function calculateCci(data) {
  const cci = String(data.cci || "");
  const valid = /^\d{20}$/.test(cci);
  const bank = bankCodes[cci.slice(0, 3)] || "Banco no identificado en tabla local";
  return resultCards([["Formato", valid ? "Válido" : "Inválido"], ["Banco referencial", valid ? bank : "-"], ["Longitud", `${cci.length} dígitos`]]);
}

function calculateHoliday(data) {
  const found = holidays2026.find(([date]) => date === data.date);
  const next = holidays2026.find(([date]) => date >= data.date);
  return result.innerHTML = `
    ${resultCards([["Fecha", data.date], ["Resultado", found ? found[1] : "No figura como feriado nacional 2026"], ["Próximo feriado", next ? `${next[0]} - ${next[1]}` : "Sin próximos en 2026"]], true)}
    ${renderTable(holidays2026.map(([date, name]) => ({ date, name })), ["Fecha", "Feriado"], ["date", "name"])}
  `;
}

function calculateCts(data) {
  const computable = n(data.salary) + n(data.family);
  const months = Math.min(n(data.months), 6);
  const cts = computable / 12 * months;
  return resultCards([["Remuneración computable", money.format(computable)], ["Meses", months], ["CTS estimada", money.format(cts)]]);
}

function calculateBonus(data) {
  const bonus = n(data.salary) * (Math.min(n(data.months), 6) / 6);
  const extra = bonus * n(data.health);
  return resultCards([["Gratificación", money.format(bonus)], ["Bonificación extraordinaria", money.format(extra)], ["Total estimado", money.format(bonus + extra)]]);
}

function resultCards(rows, returnOnly = false) {
  const html = rows.map(([label, value]) => `<div class="field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  if (returnOnly) return html;
  result.innerHTML = html;
  return html;
}

function animateResult() {
  result.classList.remove("result-updated");
  void result.offsetWidth;
  result.classList.add("result-updated");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const tool = tools[activeTool];
  const submit = form.querySelector("button[type='submit']");

  submit.disabled = true;
  submit.innerHTML = "<span>Consultando</span><span aria-hidden=\"true\">...</span>";
  setMessage(tool.kind === "local" ? "Calculando..." : "Consultando proveedor...");

  try {
    const payload = getPayload();
    if (tool.kind === "local") {
      tool.calculate(payload);
      animateResult();
      setMessage("Cálculo completado.", "success");
      return;
    }

    const response = await fetch(tool.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "No se pudo completar la consulta.");
    }

    result.innerHTML = tool.kind === "api-table"
      ? renderTable(data.items || [], tool.columns, tool.keys)
      : renderResultFields(tool.resultFields, data);
    animateResult();
    setMessage("Consulta completada.", "success");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    submit.disabled = false;
    submit.innerHTML = `<span>${tool.submit}</span><span aria-hidden="true">→</span>`;
  }
});

function closeServicesMenu() {
  servicesToggle.setAttribute("aria-expanded", "false");
  servicesDropdown.classList.remove("open");
  calculatorsToggle.setAttribute("aria-expanded", "false");
  calculatorsDropdown.classList.remove("open");
}

function closeMobileMenu() {
  mobileToggle.setAttribute("aria-expanded", "false");
  mainNav.classList.remove("open");
}

mobileToggle.addEventListener("click", () => {
  const isOpen = mobileToggle.getAttribute("aria-expanded") === "true";
  mobileToggle.setAttribute("aria-expanded", String(!isOpen));
  mainNav.classList.toggle("open", !isOpen);
  if (isOpen) closeServicesMenu();
});

mainNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMobileMenu));

servicesToggle.addEventListener("click", () => {
  const isOpen = servicesToggle.getAttribute("aria-expanded") === "true";
  closeServicesMenu();
  servicesToggle.setAttribute("aria-expanded", String(!isOpen));
  servicesDropdown.classList.toggle("open", !isOpen);
});

calculatorsToggle.addEventListener("click", () => {
  const isOpen = calculatorsToggle.getAttribute("aria-expanded") === "true";
  closeServicesMenu();
  calculatorsToggle.setAttribute("aria-expanded", String(!isOpen));
  calculatorsDropdown.classList.toggle("open", !isOpen);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".services-menu")) closeServicesMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeServicesMenu();
    closeMobileMenu();
  }
});

let lastScrollY = window.scrollY;
let ticking = false;

function updateScrollBackdrop() {
  const currentY = window.scrollY;
  const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  const progress = Math.min(currentY / maxScroll, 1);
  const isScrollingDown = currentY > lastScrollY;
  const shade = currentY < 8 ? 0 : (isScrollingDown ? 0.45 + progress * 0.45 : 0.10 + progress * 0.16);
  const target = [232, 242, 237];
  const rgb = target.map((channel) => Math.round(255 + (channel - 255) * shade));

  document.documentElement.style.setProperty("--page-bg", `rgb(${rgb.join(" ")})`);
  scrollBackdrop.style.opacity = currentY < 8 ? "0" : String(Math.min(0.18 + progress * 0.42, 0.6));
  scrollBackdrop.classList.toggle("visible", currentY > 8);
  document.body.classList.toggle("has-scrolled", currentY > 8);
  document.body.classList.toggle("scrolling-down", isScrollingDown && currentY > 12);
  document.body.classList.toggle("scrolling-up", !isScrollingDown && currentY > 12);

  lastScrollY = currentY;
  ticking = false;
}

window.addEventListener("scroll", () => {
  if (!ticking) {
    window.requestAnimationFrame(updateScrollBackdrop);
    ticking = true;
  }
}, { passive: true });

function setupSectionReveals() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

  const targets = document.querySelectorAll(".transparency, .catalog, .guide-head, .guide-card, .faq");
  targets.forEach((target) => target.classList.add("reveal-target"));
  document.body.classList.add("reveal-ready");

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("revealed");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -7%" });

  targets.forEach((target) => observer.observe(target));
}

renderNavigation();
renderTool(activeTool);
setupSectionReveals();
updateScrollBackdrop();
document.querySelector("#current-year").textContent = String(new Date().getFullYear());
