import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

const ESTADOS = {
  pendiente: { label: 'Pendiente', dot: 'bg-mc-gris', text: 'text-mc-gris', bg: 'bg-gray-50 border-gray-200' },
  enviado: { label: 'Enviado', dot: 'bg-mc-azul', text: 'text-mc-azul', bg: 'bg-blue-50 border-blue-100' },
  respondio: { label: 'Respondió', dot: 'bg-mc-amarillo', text: 'text-mc-tinta', bg: 'bg-yellow-50 border-yellow-200' },
  respondio_no_listado: { label: 'Respondió (no listado)', dot: 'bg-mc-amarillo', text: 'text-mc-tinta', bg: 'bg-yellow-50 border-yellow-200' },
  error: { label: 'Error', dot: 'bg-mc-rojo', text: 'text-mc-rojo', bg: 'bg-red-50 border-red-100' }
}

const CONTACTO_PRUEBA = { nombre: 'Juan', apellido: 'Pérez', variable: '' }

// Mismo reemplazo de tags {campo} que usa el main al mandar el mensaje real,
// para que la vista previa sea 1:1 con lo que se termina enviando.
function renderTemplate(template, contact) {
  return (template || '').replace(/\{(\w+)\}/g, (match, key) => {
    const value = contact?.[key]
    return value !== undefined && value !== null && value !== '' ? String(value) : ''
  })
}

function Badge({ estado }) {
  const cfg = ESTADOS[estado] || ESTADOS.pendiente
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

export default function App() {
  const [status, setStatus] = useState('desconectado')
  const [qr, setQr] = useState(null)
  const [contacts, setContacts] = useState([])
  const [config, setConfigState] = useState(null)
  const [progress, setProgress] = useState(null)
  const [sending, setSending] = useState(false)
  const [logSummary, setLogSummary] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualForm, setManualForm] = useState({ nombre: '', apellido: '', telefono: '', variable: '' })
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [aiReview, setAiReview] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ nombre: '', apellido: '', telefono: '', variable: '' })
  const fileInputRef = useRef(null)

  useEffect(() => {
    window.mejora.getContacts().then(setContacts)
    window.mejora.getConfig().then(setConfigState)
    window.mejora.getLogSummary().then(setLogSummary)

    window.mejora.onQr(setQr)
    window.mejora.onStatus((s) => {
      setStatus(s)
      if (s === 'conectado') setQr(null)
    })
    window.mejora.onContactsUpdated((c) => {
      setContacts(c)
      window.mejora.getLogSummary().then(setLogSummary)
    })
    window.mejora.onCampaignProgress((p) => {
      setProgress(p)
      if (p.status === 'detenido' || p.status === 'tope_diario_alcanzado') setSending(false)
      window.mejora.getLogSummary().then(setLogSummary)
    })

    return () => window.mejora.removeAllListeners()
  }, [])

  const stats = useMemo(() => {
    const total = contacts.length
    const pendientes = contacts.filter((c) => c.estado === 'pendiente').length
    const respondieron = contacts.filter((c) => c.estado.startsWith('respondio')).length
    const enviados = contacts.filter((c) => c.estado === 'enviado').length
    return { total, pendientes, respondieron, enviados }
  }, [contacts])

  const previewText = useMemo(() => {
    if (!config) return ''
    return renderTemplate(config.template, contacts[0] || CONTACTO_PRUEBA)
  }, [config?.template, contacts])

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (filtroEstado !== 'todos' && c.estado !== filtroEstado) return false
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase()
        const nombreCompleto = `${c.nombre || ''} ${c.apellido || ''}`.toLowerCase()
        if (!nombreCompleto.includes(q) && !(c.telefono || '').includes(q)) return false
      }
      return true
    })
  }, [contacts, searchTerm, filtroEstado])

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const isCsv = file.name.toLowerCase().endsWith('.csv')

    if (isCsv) {
      Papa.parse(file, { header: true, skipEmptyLines: true, complete: (res) => importRows(res.data) })
    } else {
      const reader = new FileReader()
      reader.onload = (evt) => {
        const wb = XLSX.read(evt.target.result, { type: 'binary' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        importRows(XLSX.utils.sheet_to_json(sheet))
      }
      reader.readAsBinaryString(file)
    }
    e.target.value = ''
  }

  async function importRows(rows) {
    const res = await window.mejora.importContacts(rows)
    setContacts(await window.mejora.getContacts())

    const partes = [`Se sumaron ${res.added} contactos nuevos.`]
    if (res.duplicados) partes.push(`${res.duplicados} ya estaban en la lista.`)
    if (res.sinTelefono) partes.push(`${res.sinTelefono} filas sin un teléfono reconocible — revisá que el archivo tenga una columna de nombre/teléfono con datos.`)
    partes.push(`Total en la lista: ${res.total}.`)
    alert(partes.join('\n'))
  }

  async function saveConfig(partial) {
    const updated = await window.mejora.setConfig({ ...config, ...partial })
    setConfigState(updated)
  }

  async function startCampaign(onlyIds) {
    const res = await window.mejora.startCampaign(onlyIds)
    if (res?.error) {
      alert(res.error)
      return
    }
    setSending(true)
    setSelectedIds([])
  }

  async function stopCampaign() {
    await window.mejora.stopCampaign()
    setSending(false)
  }

  async function copiarResumen() {
    await window.mejora.copyLogSummary()
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function addManualContact() {
    if (!manualForm.telefono.trim()) {
      alert('Falta el teléfono')
      return
    }
    const res = await window.mejora.addContactManual(manualForm)
    if (res?.error) {
      alert(res.error)
      return
    }
    setContacts(await window.mejora.getContacts())
    setManualForm({ nombre: '', apellido: '', telefono: '', variable: '' })
    setManualOpen(false)
  }

  async function reviewWithAI() {
    setAiLoading(true)
    setAiError('')
    setAiReview(null)
    const res = await window.mejora.reviewTemplateAI(config.template)
    setAiLoading(false)
    if (res?.error) {
      setAiError(res.error)
      return
    }
    setAiReview(res)
  }

  function usarVersionMejorada() {
    if (!aiReview?.versionMejorada) return
    setConfigState({ ...config, template: aiReview.versionMejorada })
    saveConfig({ template: aiReview.versionMejorada })
  }

  // --- Selección ---
  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleSelectAll() {
    const visibleIds = filteredContacts.map((c) => c.id)
    const todosSeleccionados = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id))
    setSelectedIds(todosSeleccionados ? [] : visibleIds)
  }

  async function refrescarContactos() {
    setContacts(await window.mejora.getContacts())
  }

  async function eliminarSeleccionados() {
    if (!confirm(`Eliminar ${selectedIds.length} contacto(s)?\n\nSe borra su historial de envío. No se puede deshacer.`)) return
    await window.mejora.deleteContacts(selectedIds)
    setSelectedIds([])
    await refrescarContactos()
  }

  async function marcarPendienteSeleccionados() {
    await window.mejora.setEstadoBulk(selectedIds, 'pendiente')
    await refrescarContactos()
  }

  async function setIncluidoSeleccionados(incluido) {
    await window.mejora.setIncluido(selectedIds, incluido)
    await refrescarContactos()
  }

  async function enviarSoloSeleccionados() {
    await startCampaign(selectedIds)
  }

  async function toggleIncluidoRow(contact) {
    await window.mejora.setIncluido([contact.id], contact.incluido === false)
    await refrescarContactos()
  }

  // --- Edición individual ---
  function startEdit(contact) {
    setEditingId(contact.id)
    setEditForm({
      nombre: contact.nombre || '',
      apellido: contact.apellido || '',
      telefono: contact.telefono || '',
      variable: contact.variable || ''
    })
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit() {
    const res = await window.mejora.updateContact({ id: editingId, ...editForm })
    if (res?.error) {
      alert(res.error)
      return
    }
    setEditingId(null)
    await refrescarContactos()
  }

  async function deleteOne(id) {
    if (!confirm('Eliminar este contacto?\n\nSe borra su historial de envío. No se puede deshacer.')) return
    await window.mejora.deleteContacts([id])
    await refrescarContactos()
  }

  // --- Zona de peligro ---
  async function vaciarContactos() {
    if (!confirm(`Vaciar los ${contacts.length} contactos de la lista?\n\nSe borra todo su historial de envío. No se puede deshacer.\n\nLa configuración, el log y la sesión de WhatsApp no se tocan.`)) return
    await window.mejora.clearAllContacts()
    setSelectedIds([])
    await refrescarContactos()
  }

  // Electron no soporta window.prompt() (tira "prompt() is not supported"),
  // así que la confirmación por texto se resuelve con un modal propio en vez
  // del prompt() nativo del navegador.
  function resetTotalApp() {
    setResetConfirmText('')
    setResetModalOpen(true)
  }

  async function confirmResetTotal() {
    if (resetConfirmText !== 'RESETEAR') return

    const res = await window.mejora.resetTotal()
    setResetModalOpen(false)
    setSelectedIds([])
    setAiReview(null)
    setApiKeyInput('')
    setConfigState(res.config)
    await refrescarContactos()
    setLogSummary(await window.mejora.getLogSummary())
  }

  if (!config) return null

  const conectado = status === 'conectado'

  return (
    <div className="min-h-screen bg-white">
      {/* Header — lockup horizontal, uso principal según manual de marca */}
      <header className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/brand/lockup-horizontal-color.png" alt="Mejora Continua" className="h-8" />
            <div className="h-6 w-px bg-gray-200" />
            <div>
              <p className="font-heading font-medium text-mc-tinta leading-tight">MejoraContacto</p>
              <p className="text-xs text-mc-gris">Uso personal — lista chica, gente que ya te conoce</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 text-sm ${conectado ? 'text-mc-azul' : 'text-mc-gris'}`}>
              <span className={`w-2 h-2 rounded-full ${conectado ? 'bg-mc-azul' : 'bg-gray-300'}`} />
              {conectado ? 'WhatsApp conectado' : 'WhatsApp desconectado'}
            </span>
            {!conectado ? (
              <button
                onClick={() => window.mejora.connectWa()}
                className="px-4 py-2 rounded-lg bg-mc-azul hover:bg-[#152f66] text-white text-sm font-medium transition-colors"
              >
                Conectar
              </button>
            ) : (
              <button
                onClick={() => window.mejora.logoutWa()}
                className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-mc-tinta transition-colors"
              >
                Cerrar sesión
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* QR — panel flotante, liquid glass acotado: blanco translúcido + blur, sin gradiente */}
        {qr && !conectado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-mc-tinta/40 backdrop-blur-[2px]">
            <div className="bg-white/90 backdrop-blur-md border border-gray-100 rounded-2xl p-8 shadow-xl flex flex-col items-center gap-4 max-w-sm">
              <p className="font-heading font-medium text-mc-tinta">Vinculá tu WhatsApp</p>
              <p className="text-sm text-mc-gris text-center">
                Desde el celu: WhatsApp → Configuración → Dispositivos vinculados → Vincular dispositivo
              </p>
              <img src={qr} alt="QR de WhatsApp" className="w-56 h-56 rounded-lg border border-gray-100" />
            </div>
          </div>
        )}

        {/* Confirmación de reset total — modal propio porque Electron no soporta window.prompt() */}
        {resetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-mc-tinta/40 backdrop-blur-[2px]">
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xl flex flex-col gap-4 max-w-sm">
              <p className="font-heading font-medium text-mc-rojo">Reset total de la app</p>
              <p className="text-sm text-mc-gris">
                Esto borra TODOS los contactos, vuelve la configuración a los valores de fábrica (incluida la API key guardada) y limpia el log de actividad.
              </p>
              <p className="text-sm text-mc-gris">
                La sesión de WhatsApp no se cierra sola — para eso usá "Cerrar sesión" arriba.
              </p>
              <p className="text-sm text-mc-tinta font-medium">
                No se puede deshacer. Escribí RESETEAR para confirmar:
              </p>
              <input
                autoFocus
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmResetTotal()}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setResetModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-mc-tinta transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmResetTotal}
                  disabled={resetConfirmText !== 'RESETEAR'}
                  className="px-4 py-2 rounded-lg bg-mc-rojo hover:bg-[#c00519] text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Confirmar reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bento grid de métricas */}
        <section className="grid grid-cols-4 gap-4">
          <StatCard label="Contactos" value={stats.total} accent="azul" />
          <StatCard label="Pendientes" value={stats.pendientes} accent="gris" />
          <StatCard label="Enviados" value={stats.enviados} accent="azul" />
          <StatCard label="Respondieron" value={stats.respondieron} accent="amarillo" />
        </section>

        {/* Contactos */}
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-medium text-mc-tinta">Contactos</h2>
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
              <button
                onClick={() => setManualOpen((v) => !v)}
                className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-mc-tinta transition-colors"
              >
                + Agregar contacto
              </button>
              <button
                onClick={() => fileInputRef.current.click()}
                className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-mc-tinta transition-colors"
              >
                Importar CSV/Excel
              </button>
              {!sending ? (
                <button
                  onClick={() => startCampaign()}
                  className="px-4 py-2 rounded-lg bg-mc-azul hover:bg-[#152f66] text-white text-sm font-medium transition-colors"
                >
                  Iniciar envío
                </button>
              ) : (
                <button
                  onClick={stopCampaign}
                  className="px-4 py-2 rounded-lg bg-mc-rojo hover:bg-[#c00519] text-white text-sm font-medium transition-colors"
                >
                  Detener
                </button>
              )}
            </div>
          </div>

          {manualOpen && (
            <div className="grid grid-cols-5 gap-2 items-end bg-gray-50 border border-gray-100 rounded-xl p-4">
              <Field label="Nombre">
                <input className="w-full mt-1.5 border border-gray-200 rounded-lg p-2 text-sm"
                  value={manualForm.nombre}
                  onChange={(e) => setManualForm({ ...manualForm, nombre: e.target.value })} />
              </Field>
              <Field label="Apellido">
                <input className="w-full mt-1.5 border border-gray-200 rounded-lg p-2 text-sm"
                  value={manualForm.apellido}
                  onChange={(e) => setManualForm({ ...manualForm, apellido: e.target.value })} />
              </Field>
              <Field label="Teléfono (con cód. país)">
                <input className="w-full mt-1.5 border border-gray-200 rounded-lg p-2 text-sm"
                  placeholder="5493764123456"
                  value={manualForm.telefono}
                  onChange={(e) => setManualForm({ ...manualForm, telefono: e.target.value })} />
              </Field>
              <Field label="Variable (opcional)">
                <input className="w-full mt-1.5 border border-gray-200 rounded-lg p-2 text-sm"
                  value={manualForm.variable}
                  onChange={(e) => setManualForm({ ...manualForm, variable: e.target.value })} />
              </Field>
              <button
                onClick={addManualContact}
                className="px-4 py-2 rounded-lg bg-mc-azul hover:bg-[#152f66] text-white text-sm font-medium transition-colors h-[38px]"
              >
                Guardar
              </button>
            </div>
          )}

          {progress && (
            <p className="text-xs text-mc-gris border-l-2 border-mc-amarillo pl-2">
              {progress.status === 'enviando' &&
                `Enviando... ${progress.enviadosHoy}/${progress.dailyCap} hoy${progress.totalVariantes > 1 ? ` — variante ${progress.variantIndex}/${progress.totalVariantes}` : ''}`}
              {progress.status === 'tope_diario_alcanzado' && 'Tope diario alcanzado — se retoma mañana.'}
              {progress.status === 'detenido' && 'Envío detenido.'}
            </p>
          )}

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-mc-azul/30 focus:border-mc-azul"
            />
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="border border-gray-200 rounded-lg p-2 text-sm text-mc-tinta"
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="enviado">Enviado</option>
              <option value="respondio">Respondió</option>
              <option value="respondio_no_listado">Respondió (no listado)</option>
              <option value="error">Error</option>
            </select>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 flex-wrap">
              <span className="text-xs font-support font-semibold text-mc-azul">{selectedIds.length} seleccionado(s)</span>
              <button onClick={enviarSoloSeleccionados} className="px-3 py-1.5 rounded-lg bg-mc-azul hover:bg-[#152f66] text-white text-xs font-medium transition-colors">
                Enviar solo a estos
              </button>
              <button onClick={() => setIncluidoSeleccionados(true)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-medium text-mc-tinta transition-colors">
                Incluir en próximo envío
              </button>
              <button onClick={() => setIncluidoSeleccionados(false)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-medium text-mc-tinta transition-colors">
                Excluir del próximo envío
              </button>
              <button onClick={marcarPendienteSeleccionados} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-medium text-mc-tinta transition-colors">
                Marcar pendiente
              </button>
              <button onClick={eliminarSeleccionados} className="px-3 py-1.5 rounded-lg bg-mc-rojo hover:bg-[#c00519] text-white text-xs font-medium transition-colors">
                Eliminar
              </button>
            </div>
          )}

          <div className="overflow-auto max-h-96 rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-mc-gris sticky top-0">
                <tr>
                  <th className="px-3 py-2.5 w-8">
                    <input type="checkbox"
                      className="w-4 h-4 accent-[#1A3D84]"
                      checked={filteredContacts.length > 0 && filteredContacts.every((c) => selectedIds.includes(c.id))}
                      onChange={toggleSelectAll} />
                  </th>
                  <th className="text-left font-support font-semibold px-2 py-2.5 w-14">Enviar</th>
                  <th className="text-left font-support font-semibold px-4 py-2.5">Nombre</th>
                  <th className="text-left font-support font-semibold px-4 py-2.5">Teléfono</th>
                  <th className="text-left font-support font-semibold px-4 py-2.5">Estado</th>
                  <th className="text-left font-support font-semibold px-4 py-2.5">Enviado</th>
                  <th className="text-left font-support font-semibold px-4 py-2.5">Respuesta</th>
                  <th className="text-left font-support font-semibold px-4 py-2.5 w-20">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100">
                    {editingId === c.id ? (
                      <>
                        <td className="px-3 py-2"></td>
                        <td className="px-2 py-2"></td>
                        <td className="px-2 py-2" colSpan={4}>
                          <div className="grid grid-cols-4 gap-1.5">
                            <input className="border border-gray-200 rounded p-1.5 text-xs" placeholder="Nombre"
                              value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} />
                            <input className="border border-gray-200 rounded p-1.5 text-xs" placeholder="Apellido"
                              value={editForm.apellido} onChange={(e) => setEditForm({ ...editForm, apellido: e.target.value })} />
                            <input className="border border-gray-200 rounded p-1.5 text-xs" placeholder="Teléfono"
                              value={editForm.telefono} onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })} />
                            <input className="border border-gray-200 rounded p-1.5 text-xs" placeholder="Variable"
                              value={editForm.variable} onChange={(e) => setEditForm({ ...editForm, variable: e.target.value })} />
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right space-x-2" colSpan={2}>
                          <button onClick={saveEdit} className="text-xs text-mc-azul font-medium">Guardar</button>
                          <button onClick={cancelEdit} className="text-xs text-mc-gris font-medium">Cancelar</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2.5">
                          <input type="checkbox" className="w-4 h-4 accent-[#1A3D84]"
                            checked={selectedIds.includes(c.id)}
                            onChange={() => toggleSelect(c.id)} />
                        </td>
                        <td className="px-2 py-2.5">
                          <input type="checkbox" className="w-4 h-4 accent-[#F7CC13]"
                            checked={c.incluido !== false}
                            onChange={() => toggleIncluidoRow(c)}
                            title="Incluir en el próximo envío masivo" />
                        </td>
                        <td className="px-4 py-2.5 text-mc-tinta">{c.nombre} {c.apellido || ''}</td>
                        <td className="px-4 py-2.5 text-mc-gris">{c.telefono}</td>
                        <td className="px-4 py-2.5"><Badge estado={c.estado} /></td>
                        <td className="px-4 py-2.5 text-mc-gris">{c.fechaEnvio ? new Date(c.fechaEnvio).toLocaleString() : '-'}</td>
                        <td className="px-4 py-2.5 text-mc-gris truncate max-w-xs">{c.respuesta || '-'}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap space-x-2">
                          <button onClick={() => startEdit(c)} className="text-xs text-mc-azul font-medium">Editar</button>
                          <button onClick={() => deleteOne(c.id)} className="text-xs text-mc-rojo font-medium">Borrar</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {filteredContacts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-mc-gris text-sm">
                      {contacts.length === 0
                        ? 'Todavía no hay contactos. Importá un CSV/Excel o agregá uno con "+ Agregar contacto".'
                        : 'Ningún contacto coincide con la búsqueda/filtro actual.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Configuración */}
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 space-y-5">
          <h2 className="font-heading font-medium text-mc-tinta">Configuración</h2>

          <div>
            <label className="text-xs font-support font-semibold text-mc-gris uppercase tracking-wide">
              Mensaje inicial — tags disponibles: {'{nombre}'} {'{apellido}'} {'{variable}'}
            </label>
            <div className="grid grid-cols-2 gap-3 mt-1.5">
              <textarea
                className="w-full border border-gray-200 rounded-lg p-3 text-sm text-mc-tinta focus:outline-none focus:ring-2 focus:ring-mc-azul/30 focus:border-mc-azul"
                rows={3}
                value={config.template}
                onChange={(e) => setConfigState({ ...config, template: e.target.value })}
                onBlur={() => saveConfig({ template: config.template })}
              />
              <div className="border border-gray-100 bg-gray-50 rounded-lg p-3 flex flex-col">
                <p className="text-xs font-support font-semibold text-mc-gris uppercase tracking-wide mb-1.5">
                  Vista previa {contacts[0] ? `(con ${contacts[0].nombre})` : '(contacto de prueba)'}
                </p>
                <div className="flex-1 bg-white border border-gray-200 rounded-lg p-2.5 text-sm text-mc-tinta whitespace-pre-wrap">
                  {previewText || <span className="text-mc-gris">El mensaje va a aparecer acá...</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={reviewWithAI}
                disabled={aiLoading}
                className="px-3 py-1.5 rounded-lg border border-mc-azul text-mc-azul hover:bg-blue-50 text-xs font-medium transition-colors disabled:opacity-50"
              >
                {aiLoading ? 'Revisando...' : '✨ Revisar con IA'}
              </button>
              {config.variantes?.length > 0 && (
                <span className="text-xs text-mc-gris">{config.variantes.length} variantes activas — rotan cada 5 envíos</span>
              )}
            </div>

            {aiError && <p className="text-xs text-mc-rojo mt-2">{aiError}</p>}

            {aiReview && (
              <div className="mt-3 border border-gray-100 bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-xs">
                  <span className={aiReview.esClaro ? 'text-mc-azul font-semibold' : 'text-mc-rojo font-semibold'}>
                    {aiReview.esClaro ? '✓ Se entiende bien' : '✗ No queda del todo claro'}
                  </span>
                </p>
                <p className="text-sm text-mc-tinta">{aiReview.feedback}</p>

                {aiReview.correcciones?.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <p className="text-xs font-support font-semibold text-mc-gris uppercase tracking-wide mb-2">
                      Ortografía y redacción — {aiReview.correcciones.length} {aiReview.correcciones.length === 1 ? 'corrección' : 'correcciones'}
                    </p>
                    <ul className="space-y-1.5">
                      {aiReview.correcciones.map((c, i) => (
                        <li key={i} className="text-xs text-mc-tinta">
                          <span className="text-mc-rojo line-through">{c.original}</span>
                          {' → '}
                          <span className="text-mc-azul font-medium">{c.corregido}</span>
                          <span className="text-mc-gris"> — {c.motivo}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <p className="text-xs font-support font-semibold text-mc-gris uppercase tracking-wide mb-1">Versión sugerida</p>
                  <p className="text-sm text-mc-tinta whitespace-pre-wrap">{aiReview.versionMejorada}</p>
                </div>
                <button
                  onClick={usarVersionMejorada}
                  className="px-3 py-1.5 rounded-lg bg-mc-azul hover:bg-[#152f66] text-white text-xs font-medium transition-colors"
                >
                  Usar esta versión
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Delay mín (seg)">
              <input type="number" className="w-full mt-1.5 border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mc-azul/30 focus:border-mc-azul"
                value={config.delayMin}
                onChange={(e) => setConfigState({ ...config, delayMin: Number(e.target.value) })}
                onBlur={() => saveConfig({ delayMin: config.delayMin })} />
            </Field>
            <Field label="Delay máx (seg)">
              <input type="number" className="w-full mt-1.5 border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mc-azul/30 focus:border-mc-azul"
                value={config.delayMax}
                onChange={(e) => setConfigState({ ...config, delayMax: Number(e.target.value) })}
                onBlur={() => saveConfig({ delayMax: config.delayMax })} />
            </Field>
            <Field label="Tope diario">
              <input type="number" className="w-full mt-1.5 border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mc-azul/30 focus:border-mc-azul"
                value={config.dailyCap}
                onChange={(e) => setConfigState({ ...config, dailyCap: Number(e.target.value) })}
                onBlur={() => saveConfig({ dailyCap: config.dailyCap })} />
            </Field>
          </div>

          <Field label="Keywords para auto-respuesta (separadas por coma)">
            <input className="w-full mt-1.5 border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mc-azul/30 focus:border-mc-azul"
              value={(config.keywords || []).join(', ')}
              onChange={(e) => setConfigState({ ...config, keywords: e.target.value.split(',').map((k) => k.trim()) })}
              onBlur={() => saveConfig({ keywords: config.keywords })} />
          </Field>

          <div>
            <label className="text-xs font-support font-semibold text-mc-gris uppercase tracking-wide">
              Auto-respuesta — usá {'{nombre}'} {'{apellido}'} {'{variable}'}
            </label>
            <textarea
              className="w-full mt-1.5 border border-gray-200 rounded-lg p-3 text-sm text-mc-tinta focus:outline-none focus:ring-2 focus:ring-mc-azul/30 focus:border-mc-azul"
              rows={2}
              value={config.replyTemplate}
              onChange={(e) => setConfigState({ ...config, replyTemplate: e.target.value })}
              onBlur={() => saveConfig({ replyTemplate: config.replyTemplate })}
            />
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-mc-tinta">Informe al terminar cada ciclo</p>
                <p className="text-xs text-mc-gris">Te manda un WhatsApp con el resumen de la corrida (enviados, errores, pendientes).</p>
              </div>
              <input type="checkbox" className="w-4 h-4 accent-[#1A3D84]"
                checked={config.reportEnabled}
                onChange={(e) => { setConfigState({ ...config, reportEnabled: e.target.checked }); saveConfig({ reportEnabled: e.target.checked }) }} />
            </div>

            <Field label="Tu número para el informe">
              <input className="w-full mt-1.5 border border-gray-200 rounded-lg p-2.5 text-sm"
                value={config.reportPhone}
                onChange={(e) => setConfigState({ ...config, reportPhone: e.target.value })}
                onBlur={() => saveConfig({ reportPhone: config.reportPhone })} />
            </Field>

            <Field label="API key de Anthropic (para el botón Revisar con IA)">
              <input type="password" className="w-full mt-1.5 border border-gray-200 rounded-lg p-2.5 text-sm"
                placeholder={config.apiKeyConfigured ? '••••••••••• (guardada, cifrada)' : 'sk-ant-...'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                onBlur={() => {
                  if (!apiKeyInput.trim()) return
                  saveConfig({ anthropicApiKey: apiKeyInput.trim() })
                  setApiKeyInput('')
                }} />
              <p className="text-xs text-mc-gris mt-1">
                {config.apiKeyConfigured ? 'Ya tenés una key guardada (cifrada con el sistema operativo). Escribí acá solo si querés reemplazarla.' : 'Se cifra y se guarda solo en tu máquina.'} La sacás en console.anthropic.com → API Keys. Cada revisión consume crédito de tu cuenta.
              </p>
            </Field>
          </div>

          <div className="border-t border-red-100 pt-4 space-y-3">
            <p className="text-sm font-medium text-mc-rojo">Zona de peligro</p>
            <div className="flex gap-2">
              <button
                onClick={vaciarContactos}
                className="px-4 py-2 rounded-lg border border-mc-rojo text-mc-rojo hover:bg-red-50 text-sm font-medium transition-colors"
              >
                Vaciar lista de contactos
              </button>
              <button
                onClick={resetTotalApp}
                className="px-4 py-2 rounded-lg bg-mc-rojo hover:bg-[#c00519] text-white text-sm font-medium transition-colors"
              >
                Reset total de la app
              </button>
            </div>
            <p className="text-xs text-mc-gris">
              "Vaciar" borra solo los contactos. "Reset total" además vuelve toda la configuración
              a los valores de fábrica y limpia el log — ninguna de las dos toca tu sesión de WhatsApp.
            </p>
          </div>
        </section>

        {/* Actividad — log local para pasarle a Claude cada tanto y afinar el sistema */}
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading font-medium text-mc-tinta">Actividad</h2>
              <p className="text-xs text-mc-gris">
                Log local de todo lo que pasa (envíos, respuestas, errores). Copialo y pegalo en un chat con Claude cada tanto para revisar cómo está funcionando.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => window.mejora.openLogsFolder()}
                className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-mc-tinta transition-colors"
              >
                Abrir carpeta
              </button>
              <button
                onClick={copiarResumen}
                className="px-4 py-2 rounded-lg bg-mc-azul hover:bg-[#152f66] text-white text-sm font-medium transition-colors"
              >
                {copiado ? 'Copiado ✓' : 'Copiar resumen'}
              </button>
            </div>
          </div>

          <pre className="text-xs text-mc-tinta bg-gray-50 border border-gray-100 rounded-xl p-4 overflow-auto max-h-64 whitespace-pre-wrap font-mono">
            {logSummary || 'Cargando...'}
          </pre>
        </section>
      </main>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-support font-semibold text-mc-gris uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

const ACCENTS = {
  azul: 'text-mc-azul',
  gris: 'text-mc-gris',
  amarillo: 'text-mc-tinta'
}

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 relative overflow-hidden">
      {accent === 'amarillo' && <span className="absolute top-0 left-0 w-full h-1 bg-mc-amarillo" />}
      <p className="text-xs font-support font-semibold text-mc-gris uppercase tracking-wide">{label}</p>
      <p className={`font-heading text-3xl font-medium mt-2 ${ACCENTS[accent] || 'text-mc-tinta'}`}>{value}</p>
    </div>
  )
}
