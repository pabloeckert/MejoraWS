const { contextBridge, ipcRenderer } = require('electron')

// API expuesta al renderer. Nada de acceso directo a Node/fs desde React,
// todo pasa por estos canales controlados.
contextBridge.exposeInMainWorld('mejora', {
  // Carpetas — una por cada uso (el cumple, los ferreteros, los asociados...)
  listarCarpetas: () => ipcRenderer.invoke('carpetas:list'),
  crearCarpeta: (datos) => ipcRenderer.invoke('carpetas:create', datos),
  activarCarpeta: (id) => ipcRenderer.invoke('carpetas:activar', id),
  actualizarCarpeta: (datos) => ipcRenderer.invoke('carpetas:update', datos),
  borrarCarpeta: (id) => ipcRenderer.invoke('carpetas:delete', id),

  // Contactos (siempre los de la carpeta abierta)
  importContacts: (rows) => ipcRenderer.invoke('contacts:import', rows),
  addContactManual: (data) => ipcRenderer.invoke('contacts:addManual', data),
  updateContact: (data) => ipcRenderer.invoke('contacts:update', data),
  deleteContacts: (ids) => ipcRenderer.invoke('contacts:delete', ids),
  setIncluido: (ids, incluido) => ipcRenderer.invoke('contacts:setIncluido', { ids, incluido }),
  setEstadoBulk: (ids, estado) => ipcRenderer.invoke('contacts:setEstado', { ids, estado }),
  clearAllContacts: () => ipcRenderer.invoke('contacts:clearAll'),
  validateContacts: (ids) => ipcRenderer.invoke('contacts:validate', ids),
  getContacts: () => ipcRenderer.invoke('contacts:list'),

  // Reset total de la app
  resetTotal: () => ipcRenderer.invoke('app:resetTotal'),

  // Modo demostración (Fase 7 de MejoraSuite) — activo por default
  getDemoMode: () => ipcRenderer.invoke('demo:get'),
  setDemoMode: (value) => ipcRenderer.invoke('demo:set', value),

  // Config (plantilla, delays, tope diario, keywords de auto-respuesta)
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config) => ipcRenderer.invoke('config:set', config),

  // WhatsApp
  connectWa: () => ipcRenderer.invoke('wa:connect'),
  logoutWa: () => ipcRenderer.invoke('wa:logout'),

  // Campaña de envío
  startCampaign: (onlyIds) => ipcRenderer.invoke('campaign:start', onlyIds),
  stopCampaign: () => ipcRenderer.invoke('campaign:stop'),
  pauseCampaign: () => ipcRenderer.invoke('campaign:pause'),
  resumeCampaign: () => ipcRenderer.invoke('campaign:resume'),

  // Exportar a CSV (se abre con Excel)
  exportar: (tipo) => ipcRenderer.invoke('export:run', tipo),
  revelarArchivo: (filePath) => ipcRenderer.invoke('export:reveal', filePath),

  // Log de actividad (para monitoreo personal)
  getLogSummary: () => ipcRenderer.invoke('logs:summary'),
  copyLogSummary: () => ipcRenderer.invoke('logs:copy'),
  openLogsFolder: () => ipcRenderer.invoke('logs:open'),

  // IA — revisión de copy y generación de variantes
  reviewTemplateAI: (template) => ipcRenderer.invoke('ai:reviewTemplate', template),

  // Suite — embebido de MejoraContactos (Fase 2 de MejoraSuite)
  showContactos: (bounds) => ipcRenderer.invoke('contactos:show', bounds),
  hideContactos: () => ipcRenderer.invoke('contactos:hide'),
  updateContactosBounds: (bounds) => ipcRenderer.invoke('contactos:updateBounds', bounds),

  // Suite — token del bridge, para pegar a mano en MejoraContactos (Fase 3)
  copyBridgeToken: () => ipcRenderer.invoke('bridge:copyToken'),

  // Eventos en tiempo real (main -> renderer)
  onQr: (cb) => ipcRenderer.on('wa:qr', (_e, dataUrl) => cb(dataUrl)),
  onStatus: (cb) => ipcRenderer.on('wa:status', (_e, status) => cb(status)),
  onContactsUpdated: (cb) => ipcRenderer.on('contacts:updated', (_e, contacts) => cb(contacts)),
  onCampaignProgress: (cb) => ipcRenderer.on('campaign:progress', (_e, progress) => cb(progress)),
  onDemoModeChanged: (cb) => ipcRenderer.on('demo:changed', (_e, value) => cb(value)),

  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('wa:qr')
    ipcRenderer.removeAllListeners('wa:status')
    ipcRenderer.removeAllListeners('contacts:updated')
    ipcRenderer.removeAllListeners('campaign:progress')
    ipcRenderer.removeAllListeners('demo:changed')
  }
})
