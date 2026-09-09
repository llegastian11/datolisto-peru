import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

const today = new Date().toISOString().slice(0, 10);
const currentPeriod = today.slice(0, 7);

const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const decimal = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 });

const dniField = { name: "dni", label: "DNI", placeholder: "8 digitos", inputMode: "numeric", maxLength: 8, pattern: "\\d{8}", required: true };
const rucField = { name: "ruc", label: "RUC", placeholder: "11 digitos", inputMode: "numeric", maxLength: 11, pattern: "\\d{11}", required: true };

const holidays2026 = [
  ["2026-01-01", "Ano Nuevo"],
  ["2026-04-02", "Jueves Santo"],
  ["2026-04-03", "Viernes Santo"],
  ["2026-05-01", "Dia del Trabajo"],
  ["2026-06-07", "Dia de la Bandera"],
  ["2026-06-29", "San Pedro y San Pablo"],
  ["2026-07-23", "Dia de la Fuerza Aerea"],
  ["2026-07-28", "Fiestas Patrias"],
  ["2026-07-29", "Fiestas Patrias"],
  ["2026-08-06", "Batalla de Junin"],
  ["2026-08-30", "Santa Rosa de Lima"],
  ["2026-10-08", "Combate de Angamos"],
  ["2026-11-01", "Todos los Santos"],
  ["2026-12-08", "Inmaculada Concepcion"],
  ["2026-12-09", "Batalla de Ayacucho"],
  ["2026-12-25", "Navidad"]
];

const bankCodes = {
  "002": "BCP",
  "003": "Interbank",
  "009": "Scotiabank",
  "011": "BBVA",
  "018": "Banco de la Nacion",
  "023": "Banco de Comercio",
  "038": "BanBif",
  "049": "MiBanco"
};

function apiTool(category, menuTitle, menuSubtitle, title, description, endpoint, fields, resultFields, note, submit) {
  return { kind: "api", category, menuTitle, menuSubtitle, title, description, endpoint, fields, resultFields, note, submit };
}

function tableApiTool(category, menuTitle, menuSubtitle, title, description, endpoint, fields, columns, keys, submit) {
  return {
    kind: "api-table",
    category,
    menuTitle,
    menuSubtitle,
    title,
    description,
    endpoint,
    fields,
    columns,
    keys,
    note: "Consulta externa referencial. Puede no devolver datos si la fuente no expone informacion para ese caso.",
    submit
  };
}

function localTool(category, menuTitle, menuSubtitle, title, description, fields, calculate, note, submit) {
  return { kind: "local", category, menuTitle, menuSubtitle, title, description, fields, calculate, note, submit };
}

function n(value) {
  return Number(String(value || "0").replace(",", ".")) || 0;
}

function resultCards(rows) {
  return { type: "cards", rows };
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
  return resultCards([["Monto bruto", money.format(gross)], ["Retencion", money.format(retention)], ["Neto a recibir", money.format(gross - retention)]]);
}

function calculateAfp(data) {
  const salary = n(data.salary);
  const mandatory = salary * (n(data.mandatory) / 100);
  const commission = salary * (n(data.commission) / 100);
  const insurance = salary * (n(data.insurance) / 100);
  return resultCards([
    ["Aporte obligatorio", money.format(mandatory)],
    ["Comision", money.format(commission)],
    ["Seguro", money.format(insurance)],
    ["Descuento total", money.format(mandatory + commission + insurance)],
    ["Neto estimado", money.format(salary - mandatory - commission - insurance)]
  ]);
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
  return resultCards([["Formato", valid ? "Valido" : "Invalido"], ["Banco referencial", valid ? bankCodes[cci.slice(0, 3)] || "No identificado" : "-"], ["Longitud", `${cci.length} digitos`]]);
}

function calculateHoliday(data) {
  const found = holidays2026.find(([date]) => date === data.date);
  const next = holidays2026.find(([date]) => date >= data.date);
  return {
    type: "mixed",
    cards: [["Fecha", data.date], ["Resultado", found ? found[1] : "No figura como feriado nacional 2026"], ["Proximo feriado", next ? `${next[0]} - ${next[1]}` : "Sin proximos en 2026"]],
    table: { items: holidays2026.map(([date, name]) => ({ date, name })), columns: ["Fecha", "Feriado"], keys: ["date", "name"] }
  };
}

function calculateCts(data) {
  const computable = n(data.salary) + n(data.family);
  const months = Math.min(n(data.months), 6);
  return resultCards([["Remuneracion computable", money.format(computable)], ["Meses", months], ["CTS estimada", money.format((computable / 12) * months)]]);
}

function calculateBonus(data) {
  const bonus = n(data.salary) * (Math.min(n(data.months), 6) / 6);
  const extra = bonus * n(data.health);
  return resultCards([["Gratificacion", money.format(bonus)], ["Bonificacion extraordinaria", money.format(extra)], ["Total estimado", money.format(bonus + extra)]]);
}

const tools = {
  dni: apiTool("Personas", "DNI", "Nombres y apellidos", "Consulta por DNI", "Ingresa 8 digitos y obtén nombres y apellidos para completar formularios sin errores.", "/api/dni", [dniField], [["nombres", "Nombres"], ["apellidoPaterno", "Apellido paterno"], ["apellidoMaterno", "Apellido materno"], ["codigoVerificacion", "Codigo verificacion"], ["fuente", "Fuente"]], "No muestra direccion, fecha de nacimiento, sexo, foto ni datos sensibles.", "Consultar DNI"),
  dniRuc: apiTool("Personas", "DNI-RUC", "RUC asociado", "Consulta DNI-RUC", "Verifica si un DNI tiene RUC asociado segun el proveedor.", "/api/dni-ruc", [dniField], [["mensaje", "Resultado"], ["ruc", "RUC asociado"], ["fuente", "Fuente"]], "Resultado referencial. No reemplaza validacion tributaria completa.", "Consultar DNI-RUC"),
  ruc: apiTool("Empresas", "RUC", "Datos del contribuyente", "Consulta RUC", "Consulta razon social, estado, condicion y ubicacion fiscal basica.", "/api/ruc", [rucField], [["razonSocial", "Razon social"], ["estado", "Estado"], ["condicion", "Condicion"], ["direccion", "Direccion"], ["departamento", "Departamento"], ["provincia", "Provincia"], ["distrito", "Distrito"], ["fuente", "Fuente"]], "Datos obtenidos mediante proveedor externo conectado a fuentes publicas.", "Consultar RUC"),
  rucRepresentantes: tableApiTool("Empresas", "Representantes RUC", "Representantes legales", "Representantes legales", "Lista representantes registrados para un RUC.", "/api/ruc-representantes", [rucField], ["Tipo", "Documento", "Nombre", "Cargo", "Desde"], ["tipoDocumento", "numeroDocumento", "nombre", "cargo", "fechaDesde"], "Consultar representantes"),
  rucEstablecimientos: tableApiTool("Empresas", "Establecimientos", "Anexos SUNAT", "Establecimientos anexos", "Lista establecimientos anexos asociados a un RUC.", "/api/ruc-establecimientos", [rucField], ["Codigo", "Tipo", "Direccion", "Distrito", "Ubigeo"], ["codigo", "tipo", "direccion", "distrito", "ubigeo"], "Consultar establecimientos"),
  rucDomicilio: apiTool("Empresas", "Domicilio fiscal", "Direccion fiscal", "Domicilio fiscal RUC", "Consulta domicilio fiscal registrado.", "/api/ruc-domicilio", [rucField], [["tipo", "Tipo"], ["direccion", "Direccion"], ["departamento", "Departamento"], ["provincia", "Provincia"], ["distrito", "Distrito"], ["ubigeo", "Ubigeo"]], "Uso referencial operativo.", "Consultar domicilio"),
  rucDeuda: tableApiTool("Empresas", "Deuda coactiva", "Cobranza", "Deuda coactiva RUC", "Consulta registros de deuda coactiva asociados a un RUC.", "/api/ruc-deuda", [rucField], ["Monto", "Periodo", "Inicio cobranza", "Entidad"], ["monto", "periodo", "fechaInicio", "entidad"], "Consultar deuda"),
  rucTrabajadores: tableApiTool("Empresas", "Trabajadores", "Declarados", "Trabajadores declarados", "Consulta trabajadores, pensionistas y prestadores por periodo.", "/api/ruc-trabajadores", [rucField], ["Periodo", "Trabajadores", "Pensionistas", "Prestadores"], ["periodo", "trabajadores", "pensionistas", "prestadores"], "Consultar trabajadores"),
  exchange: apiTool("Economia", "Tipo de cambio", "Compra y venta", "Tipo de cambio", "Consulta compra y venta por fecha.", "/api/tipo-cambio", [{ name: "fecha", label: "Fecha", type: "date", value: today, required: true }], [["moneda", "Moneda"], ["fecha", "Fecha"], ["compra", "Compra"], ["venta", "Venta"], ["fuente", "Fuente"]], "Disponibilidad depende del proveedor y fecha consultada.", "Consultar tipo de cambio"),
  cpe: apiTool("Tributacion", "CPE", "Validacion comprobante", "Validacion CPE", "Valida comprobantes electronicos con datos minimos.", "/api/cpe", [
    { name: "ruc_emisor", label: "RUC emisor", placeholder: "11 digitos", inputMode: "numeric", maxLength: 11, pattern: "\\d{11}", required: true },
    { name: "codigo_tipo_documento", label: "Tipo", type: "select", options: [["01", "Factura"], ["03", "Boleta"], ["07", "Nota de credito"], ["08", "Nota de debito"]], required: true },
    { name: "serie_documento", label: "Serie", placeholder: "F001", maxLength: 8, required: true },
    { name: "numero_documento", label: "Numero", placeholder: "650", inputMode: "numeric", maxLength: 20, required: true },
    { name: "fecha_de_emision", label: "Fecha de emision", type: "date", value: today, required: true },
    { name: "total", label: "Total", type: "number", placeholder: "159.30", step: "0.01", min: "0.01", required: true }
  ], [["mensaje", "Resultado"], ["estadoComprobante", "Estado comprobante"], ["estadoEmpresa", "Estado empresa"], ["condicionEmpresa", "Condicion empresa"], ["observaciones", "Observaciones"], ["fuente", "Fuente"]], "Necesitas emisor, tipo, serie, numero, fecha y total exactos.", "Validar CPE"),
  afp: tableApiTool("Laboral", "Comisiones AFP", "Por periodo", "Comisiones AFP", "Consulta comisiones, prima y aporte obligatorio por periodo.", "/api/afp", [{ name: "periodo", label: "Periodo", type: "month", value: currentPeriod, required: true }], ["AFP", "Flujo %", "Mixta saldo %", "Seguro %", "Aporte %", "Rem. maxima"], ["afp", "comisionFlujo", "comisionMixtaSaldo", "primaSeguro", "aporteObligatorio", "remuneracionMaxima"], "Consultar AFP"),
  igv: localTool("Calculadoras", "IGV", "Con y sin impuesto", "Calculadora IGV", "Calcula base imponible, IGV y total.", [{ name: "amount", label: "Monto", type: "number", step: "0.01", min: "0", value: "118", required: true }, { name: "mode", label: "Modo", type: "select", options: [["included", "El monto incluye IGV"], ["add", "Agregar IGV al monto"]], required: true }], calculateIgv, "Usa tasa IGV 18%.", "Calcular IGV"),
  recibo: localTool("Calculadoras", "Recibo por honorarios", "Retencion", "Recibo por honorarios", "Calcula retencion de cuarta categoria y neto a recibir.", [{ name: "gross", label: "Monto bruto", type: "number", step: "0.01", min: "0", value: "1500", required: true }, { name: "retention", label: "Retencion %", type: "number", step: "0.01", min: "0", value: "8", required: true }], calculateReceipt, "Calculo referencial.", "Calcular recibo"),
  afpCalc: localTool("Laboral", "AFP estimada", "Descuento mensual", "Calculadora AFP", "Estima aporte, prima y comision sobre remuneracion.", [{ name: "salary", label: "Remuneracion", type: "number", step: "0.01", min: "0", value: "2500", required: true }, { name: "commission", label: "Comision %", type: "number", step: "0.01", min: "0", value: "1.55", required: true }, { name: "insurance", label: "Prima seguro %", type: "number", step: "0.01", min: "0", value: "1.70", required: true }, { name: "mandatory", label: "Aporte obligatorio %", type: "number", step: "0.01", min: "0", value: "10", required: true }], calculateAfp, "Porcentajes editables.", "Calcular descuento"),
  cci: localTool("Utilidades", "Validador CCI", "Formato bancario", "Validador CCI", "Valida longitud y reconoce banco por codigo inicial.", [{ name: "cci", label: "CCI", placeholder: "20 digitos", inputMode: "numeric", maxLength: 20, pattern: "\\d{20}", required: true }], calculateCci, "No consulta saldos ni datos bancarios privados.", "Validar CCI"),
  holidays: localTool("Utilidades", "Feriados Peru", "Calendario 2026", "Feriados Peru 2026", "Revisa feriados nacionales.", [{ name: "date", label: "Fecha", type: "date", value: today, required: true }], calculateHoliday, "Lista referencial 2026.", "Revisar fecha"),
  cts: localTool("Laboral", "CTS", "Estimacion", "Calculadora CTS", "Estima CTS semestral.", [{ name: "salary", label: "Sueldo mensual", type: "number", step: "0.01", min: "0", value: "2500", required: true }, { name: "family", label: "Asignacion familiar", type: "number", step: "0.01", min: "0", value: "0", required: true }, { name: "months", label: "Meses computables", type: "number", step: "1", min: "0", max: "6", value: "6", required: true }], calculateCts, "Formula referencial simplificada.", "Calcular CTS"),
  gratificacion: localTool("Laboral", "Gratificacion", "Estimacion", "Calculadora de gratificacion", "Estima gratificacion legal con bonificacion.", [{ name: "salary", label: "Sueldo mensual", type: "number", step: "0.01", min: "0", value: "2500", required: true }, { name: "months", label: "Meses completos", type: "number", step: "1", min: "0", max: "6", value: "6", required: true }, { name: "health", label: "Bonificacion", type: "select", options: [["0.09", "EsSalud 9%"], ["0.0675", "EPS 6.75%"]], required: true }], calculateBonus, "Calculo referencial para regimen privado comun.", "Calcular gratificacion")
};

const categoryCopy = {
  Personas: "Identidad y datos basicos.",
  Empresas: "RUC, domicilio y anexos.",
  Tributacion: "Comprobantes y obligaciones.",
  Economia: "Moneda y referencias.",
  Laboral: "AFP, CTS y planilla.",
  Calculadoras: "Calculos rapidos.",
  Utilidades: "Validadores y calendario."
};

const icons = {
  Personas: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  Empresas: "M3 21h18 M5 21V7l8-4v18 M19 21V11l-6-4 M9 9h1 M9 13h1 M9 17h1 M14 13h1 M14 17h1",
  Tributacion: "M7 3h10v18H7z M9 7h6 M9 11h6 M9 15h3",
  Economia: "M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6",
  Laboral: "M16 21v-2a4 4 0 0 0-8 0v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 8v6 M23 11h-6",
  Calculadoras: "M6 3h12v18H6z M9 7h6 M9 11h1 M14 11h1 M9 15h1 M14 15h1",
  Utilidades: "M12 3l7 4v5c0 5-3 8-7 9-4-1-7-4-7-9V7z",
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16 M21 21l-4.3-4.3",
  lock: "M7 11V8a5 5 0 0 1 10 0v3 M6 11h12v10H6z",
  shield: "M12 3l7 4v5c0 5-3 8-7 9-4-1-7-4-7-9V7z",
  document: "M7 3h7l3 3v15H7z M14 3v4h4 M9 13h6 M9 17h6",
  menu: "M4 7h16 M4 12h16 M4 17h16"
};

function Icon({ name, className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d={icons[name] || icons.search} />
    </svg>
  );
}

function groupTools(filter) {
  return Object.entries(tools).reduce((groups, [key, tool]) => {
    if (filter && !filter(tool)) return groups;
    groups[tool.category] ||= [];
    groups[tool.category].push([key, tool]);
    return groups;
  }, {});
}

function Field({ field, value, onChange }) {
  const common = {
    id: field.name,
    name: field.name,
    required: field.required,
    value: value ?? field.value ?? "",
    onChange: (event) => {
      let next = event.target.value;
      if (field.inputMode === "numeric") next = next.replace(/\D/g, "").slice(0, Number(field.maxLength || 99));
      onChange(field.name, next);
    }
  };

  if (field.type === "select") {
    return (
      <label className="control" htmlFor={field.name}>
        <span>{field.label}</span>
        <select {...common}>{field.options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select>
      </label>
    );
  }

  return (
    <label className="control" htmlFor={field.name}>
      <span>{field.label}</span>
      <input {...common} type={field.type || "text"} placeholder={field.placeholder || ""} inputMode={field.inputMode} maxLength={field.maxLength} pattern={field.pattern} step={field.step} min={field.min} max={field.max} />
    </label>
  );
}

function ResultView({ result }) {
  if (!result) return <div className="empty-state">Resultado aparece aqui cuando completes la consulta.</div>;
  if (result.type === "cards") return <Cards rows={result.rows} />;
  if (result.type === "table") return <TableResult {...result.table} />;
  if (result.type === "mixed") {
    return (
      <>
        <Cards rows={result.cards} />
        <TableResult {...result.table} />
      </>
    );
  }
  return null;
}

function Cards({ rows }) {
  return rows.map(([label, value], index) => (
    <motion.div className="field" key={`${label}-${index}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035 }}>
      <span>{label}</span>
      <strong>{Array.isArray(value) ? (value.length ? value.join(", ") : "Sin observaciones") : (value === "" ? "-" : value)}</strong>
    </motion.div>
  ));
}

function TableResult({ items = [], columns = [], keys = [] }) {
  if (!items.length) return <div className="empty-state">Sin registros para mostrar.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {items.map((item, rowIndex) => (
            <tr key={rowIndex}>{keys.map((key) => <td key={key}>{item[key] ?? ""}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Dropdown({ label, groups, onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="nav-menu">
      <button className="nav-link nav-button" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}<span className="chevron" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="dropdown" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {Object.entries(groups).map(([category, entries]) => (
              <div className="dropdown-group" key={category}>
                <strong>{category}</strong>
                {entries.map(([key, tool]) => (
                  <button key={key} type="button" onClick={() => { onSelect(key); setOpen(false); }}>
                    <span>{tool.menuTitle}</span>
                    <small>{tool.menuSubtitle}</small>
                  </button>
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LookupApp() {
  const reduceMotion = useReducedMotion();
  const [activeTool, setActiveTool] = useState("dni");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [values, setValues] = useState({});
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [loading, setLoading] = useState(false);

  const tool = tools[activeTool];
  const queryGroups = useMemo(() => groupTools((item) => item.kind !== "local"), []);
  const calculatorGroups = useMemo(() => groupTools((item) => item.kind === "local"), []);
  const allGroups = useMemo(() => groupTools(), []);

  useEffect(() => {
    const defaults = Object.fromEntries(tool.fields.map((field) => [field.name, field.value || field.options?.[0]?.[0] || ""]));
    setValues(defaults);
    setResult(null);
    setMessage("");
    setMessageType("info");
  }, [activeTool, tool.fields]);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const update = () => {
      const currentY = window.scrollY;
      const limit = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const progress = Math.min(currentY / limit, 1);
      const down = currentY > lastY;
      const shade = currentY < 6 ? 0 : down ? 0.58 + progress * 0.42 : 0.22 + progress * 0.26;
      document.documentElement.style.setProperty("--scroll-shade", String(Math.min(shade, 1)));
      document.body.classList.toggle("has-scrolled", currentY > 6);
      document.body.classList.toggle("scrolling-down", down && currentY > 12);
      document.body.classList.toggle("scrolling-up", !down && currentY > 12);
      lastY = currentY;
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function selectTool(key) {
    setActiveTool(key);
    setMobileOpen(false);
    window.setTimeout(() => document.querySelector("#consulta")?.scrollIntoView({ behavior: "smooth", block: "center" }), 20);
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage(tool.kind === "local" ? "Calculando..." : "Consultando proveedor...");
    setMessageType("info");

    try {
      if (tool.kind === "local") {
        setResult(tool.calculate(values));
        setMessage("Listo.");
        setMessageType("success");
        return;
      }

      const response = await fetch(tool.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo completar la consulta.");

      if (tool.kind === "api-table") {
        setResult({ type: "table", table: { items: data.items || [], columns: tool.columns, keys: tool.keys } });
      } else {
        setResult({ type: "cards", rows: tool.resultFields.map(([key, label]) => [label, data[key]]) });
      }
      setMessage("Consulta completada.");
      setMessageType("success");
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  const pageMotion = reduceMotion ? {} : { initial: false, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-10%" }, transition: { duration: 0.55 } };

  return (
    <>
      <a className="skip-link" href="#consulta">Saltar a la consulta</a>
      <div className="scroll-backdrop" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="DatoListo Peru inicio">
          <img src="/logo.svg" alt="DatoListo Peru" />
        </a>
        <button className="mobile-toggle" type="button" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>
          <Icon name="menu" />
          <span className="sr-only">Menu</span>
        </button>
        <nav className={mobileOpen ? "main-nav open" : "main-nav"} aria-label="Navegacion principal">
          <a className="nav-link" href="#inicio" onClick={() => setMobileOpen(false)}>Inicio</a>
          <a className="nav-link" href="#instrucciones" onClick={() => setMobileOpen(false)}>Instrucciones</a>
          <Dropdown label="Consultas" groups={queryGroups} onSelect={selectTool} />
          <Dropdown label="Calculadoras" groups={calculatorGroups} onSelect={selectTool} />
          <a className="nav-link" href="#preguntas" onClick={() => setMobileOpen(false)}>Ayuda</a>
        </nav>
      </header>

      <main>
        <section id="inicio" className="hero-shell">
          <div className="hero-media" aria-hidden="true">
            <div className="skyline" />
          </div>
          <div className="hero">
            <motion.div className="hero-copy" {...(reduceMotion ? {} : { initial: false, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6 } })}>
              <h1>Consulta datos públicos del Perú en un solo lugar</h1>
              <p>Accede rápido a consultas de DNI, RUC, comprobantes, tipo de cambio y calculadoras utiles para trabajo, negocio y tramites cotidianos.</p>
              <div className="hero-actions" aria-label="Accesos principales">
                {["dni", "ruc", "igv", "exchange"].map((key) => (
                  <button key={key} type="button" onClick={() => selectTool(key)} className={activeTool === key ? "active" : ""}>
                    <Icon name={tools[key].category} />
                    <span>{tools[key].menuTitle}</span>
                  </button>
                ))}
              </div>
              <p className="independent-note">Plataforma independiente. No representa a RENIEC, SUNAT ni otra entidad publica.</p>
            </motion.div>

            <motion.section id="consulta" className="workspace" aria-live="polite" {...(reduceMotion ? {} : { initial: false, animate: { opacity: 1, scale: 1, y: 0 }, transition: { duration: 0.6, delay: 0.1 } })}>
              <div className="tool-tabs">
                {["dni", "ruc", "igv", "exchange"].map((key) => (
                  <button key={key} type="button" className={activeTool === key ? "active" : ""} onClick={() => selectTool(key)}>{tools[key].menuTitle}</button>
                ))}
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={activeTool} initial={reduceMotion ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? {} : { opacity: 0, x: -18 }} transition={{ duration: 0.22 }}>
                  <div className="section-head">
                    <div>
                      <h2>{tool.title}</h2>
                      <p>{tool.description}</p>
                    </div>
                    <span>{tool.kind === "local" ? "Calculo local" : "Consulta externa"}</span>
                  </div>
                  <form className={`lookup-form ${tool.fields.length > 1 ? "wide" : ""}`} onSubmit={submit}>
                    <div className="form-grid">
                      {tool.fields.map((field) => <Field key={field.name} field={field} value={values[field.name]} onChange={(name, value) => setValues((current) => ({ ...current, [name]: value }))} />)}
                    </div>
                    <button type="submit" disabled={loading}>
                      <Icon name="search" />
                      <span>{loading ? "Procesando" : tool.submit}</span>
                    </button>
                  </form>
                  <div className={`message ${messageType}`}>{message}</div>
                  <motion.section className="result" layout>
                    <ResultView result={result} />
                  </motion.section>
                  <div className="legal-note"><strong>Uso responsable</strong><span>{tool.note}</span></div>
                </motion.div>
              </AnimatePresence>
            </motion.section>
          </div>
        </section>

        <motion.section id="instrucciones" className="guide" {...pageMotion}>
          <div className="section-title">
            <span>Como funciona</span>
            <h2>En 4 pasos</h2>
          </div>
          <div className="guide-grid">
            {[
              ["1", "Elige", "Selecciona consulta o calculadora.", "menu"],
              ["2", "Completa", "Ingresa solo los datos pedidos.", "document"],
              ["3", "Procesa", "Pulsa el boton y espera resultado.", "search"],
              ["4", "Verifica", "Revisa fuente y usa como referencia.", "shield"]
            ].map(([number, heading, copy, icon]) => (
              <motion.article className="guide-card" key={number} whileHover={reduceMotion ? {} : { y: -8 }}>
                <span>{number}</span>
                <Icon name={icon} />
                <h3>{heading}</h3>
                <p>{copy}</p>
              </motion.article>
            ))}
          </div>
        </motion.section>

        <motion.section id="servicios" className="services" {...pageMotion}>
          <div className="section-title">
            <span>Servicios</span>
            <h2>Herramientas por categoria</h2>
          </div>
          <div className="service-grid">
            {Object.entries(allGroups).map(([category, entries]) => (
              <motion.article className="service-card" key={category} whileHover={reduceMotion ? {} : { y: -8 }}>
                <Icon name={category} />
                <h3>{category}</h3>
                <p>{categoryCopy[category]}</p>
                <div>
                  {entries.slice(0, 4).map(([key, item]) => <button key={key} type="button" onClick={() => selectTool(key)}>{item.menuTitle}</button>)}
                </div>
              </motion.article>
            ))}
          </div>
        </motion.section>

        <motion.section className="trust-band" {...pageMotion}>
          {[["shield", "No guardamos tus consultas", "Sin historial ni perfiles en esta aplicacion."], ["lock", "Token protegido en servidor", "La credencial del proveedor no llega al navegador."], ["document", "Resultados referenciales", "Cada respuesta indica fuente cuando aplica."]].map(([icon, title, copy]) => (
            <div key={title}>
              <Icon name={icon} />
              <strong>{title}</strong>
              <span>{copy}</span>
            </div>
          ))}
        </motion.section>

        <section id="preguntas" className="faq">
          <div className="section-title">
            <span>Ayuda</span>
            <h2>Preguntas frecuentes</h2>
          </div>
          <div className="faq-list">
            {[
              ["La informacion es oficial?", "No. DatoListo Peru es independiente. Los resultados son referenciales y deben verificarse en la entidad correspondiente."],
              ["Guardan mis consultas?", "No guardamos documentos consultados ni resultados en el servidor de la aplicacion."],
              ["Por que una consulta falla?", "Puede faltar informacion, el proveedor puede limitar el servicio o una fuente externa puede estar temporalmente no disponible."],
              ["Puedo usarlo gratis?", "Si. Las herramientas disponibles funcionan sin crear cuenta."]
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div>
          <img src="/logo.svg" alt="DatoListo Peru" />
          <p>Informacion publica, mas cerca de ti.</p>
        </div>
        <nav aria-label="Footer">
          <a href="#inicio">Inicio</a>
          <a href="#instrucciones">Instrucciones</a>
          <a href="#servicios">Servicios</a>
          <a href="#preguntas">Ayuda</a>
        </nav>
        <p>DatoListo Peru no es entidad gubernamental. Uso responsable.</p>
      </footer>
    </>
  );
}
