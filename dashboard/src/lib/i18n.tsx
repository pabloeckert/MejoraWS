// dashboard/src/lib/i18n.ts
// Lightweight i18n for the dashboard — no external dependencies
// Supports ES (default) and EN

'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type Locale = 'es' | 'en'

const translations: Record<Locale, Record<string, string>> = {
  es: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.pipeline': 'Pipeline',
    'nav.contacts': 'Contactos',
    'nav.campaigns': 'Campañas',
    'nav.analytics': 'Analytics',
    'nav.chat': 'Chat',
    'nav.config': 'Config',
    'nav.logout': 'Salir',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.messages_today': 'Mensajes Hoy',
    'dashboard.contacts': 'Contactos',
    'dashboard.active_deals': 'Deals Activos',
    'dashboard.closed_revenue': 'Revenue Cerrado',
    'dashboard.llm_status': 'Estado LLM',
    'dashboard.warmup': 'Anti-Ban Warm-up',
    'dashboard.recent_messages': 'Últimos Mensajes',
    'dashboard.no_messages': 'Sin mensajes recientes',
    'dashboard.live': 'En vivo',
    'dashboard.polling': 'Polling',
    'dashboard.whatsapp_connected': 'WhatsApp Conectado',
    'dashboard.disconnected': 'Desconectado',
    'dashboard.bot_active': 'Bot Activo',

    // Pipeline
    'pipeline.title': 'Pipeline de Ventas',
    'pipeline.new': 'Nuevo',
    'pipeline.contacted': 'Contactado',
    'pipeline.interested': 'Interesado',
    'pipeline.proposal': 'Propuesta',
    'pipeline.negotiation': 'Negociación',
    'pipeline.won': 'Ganado',
    'pipeline.lost': 'Perdido',

    // Contacts
    'contacts.title': 'Contactos',
    'contacts.search': 'Buscar contactos...',
    'contacts.import': 'Importar',
    'contacts.export': 'Exportar',
    'contacts.add': 'Agregar contacto',
    'contacts.phone': 'Teléfono',
    'contacts.email': 'Email',
    'contacts.company': 'Empresa',
    'contacts.score': 'Score',
    'contacts.tags': 'Tags',

    // Campaigns
    'campaigns.title': 'Campañas',
    'campaigns.create': 'Crear campaña',
    'campaigns.execute': 'Ejecutar',
    'campaigns.pause': 'Pausar',
    'campaigns.sent': 'Enviados',
    'campaigns.delivered': 'Entregados',
    'campaigns.read': 'Leídos',
    'campaigns.replied': 'Respondidos',

    // Analytics
    'analytics.title': 'Analytics',
    'analytics.overview': 'Resumen',
    'analytics.messages': 'Mensajes',
    'analytics.funnel': 'Funnel',
    'analytics.sentiment': 'Sentimiento',
    'analytics.timing': 'Timing',
    'analytics.quality': 'Calidad',
    'analytics.export_csv': 'Exportar CSV',

    // Config
    'config.title': 'Configuración',
    'config.bot_name': 'Nombre del bot',
    'config.personality': 'Personalidad',
    'config.tone': 'Tono',
    'config.language': 'Idioma',
    'config.knowledge_base': 'Knowledge Base',
    'config.save': 'Guardar',
    'config.industry': 'Industria',
    'config.industry_templates': 'Plantillas por industria',

    // Chat
    'chat.title': 'Chat',
    'chat.select_contact': 'Seleccioná un contacto',
    'chat.type_message': 'Escribí un mensaje...',
    'chat.send': 'Enviar',

    // Login
    'login.title': 'MejoraWS',
    'login.subtitle': 'CRM WhatsApp Autónomo con IA',
    'login.password': 'Contraseña',
    'login.submit': 'Ingresar',
    'login.error': 'Contraseña incorrecta',
    'login.loading': 'Ingresando...',

    // Onboarding
    'onboarding.welcome': 'Bienvenido',
    'onboarding.welcome_desc': 'Conoce MejoraWS',
    'onboarding.import': 'Importar contactos',
    'onboarding.import_desc': 'Carga tu base de contactos',
    'onboarding.personality': 'Personalidad del bot',
    'onboarding.personality_desc': 'Define cómo responderá tu IA',
    'onboarding.test': 'Prueba el bot',
    'onboarding.test_desc': 'Envía un mensaje de prueba',
    'onboarding.ready': '¡Listo!',
    'onboarding.ready_desc': 'Tu bot está funcionando',
    'onboarding.skip': 'Saltar wizard',
    'onboarding.next': 'Siguiente',
    'onboarding.back': 'Atrás',
    'onboarding.start': 'Comenzar',

    // Common
    'common.loading': 'Cargando...',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.close': 'Cerrar',
    'common.confirm': 'Confirmar',
    'common.yes': 'Sí',
    'common.no': 'No',
    'common.all': 'Todos',
    'common.none': 'Ninguno',
    'common.total': 'Total',
    'common.active': 'Activo',
    'common.inactive': 'Inactivo',
    'common.search': 'Buscar...',
  },
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.pipeline': 'Pipeline',
    'nav.contacts': 'Contacts',
    'nav.campaigns': 'Campaigns',
    'nav.analytics': 'Analytics',
    'nav.chat': 'Chat',
    'nav.config': 'Settings',
    'nav.logout': 'Logout',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.messages_today': 'Messages Today',
    'dashboard.contacts': 'Contacts',
    'dashboard.active_deals': 'Active Deals',
    'dashboard.closed_revenue': 'Closed Revenue',
    'dashboard.llm_status': 'LLM Status',
    'dashboard.warmup': 'Anti-Ban Warm-up',
    'dashboard.recent_messages': 'Recent Messages',
    'dashboard.no_messages': 'No recent messages',
    'dashboard.live': 'Live',
    'dashboard.polling': 'Polling',
    'dashboard.whatsapp_connected': 'WhatsApp Connected',
    'dashboard.disconnected': 'Disconnected',
    'dashboard.bot_active': 'Bot Active',

    // Pipeline
    'pipeline.title': 'Sales Pipeline',
    'pipeline.new': 'New',
    'pipeline.contacted': 'Contacted',
    'pipeline.interested': 'Interested',
    'pipeline.proposal': 'Proposal',
    'pipeline.negotiation': 'Negotiation',
    'pipeline.won': 'Won',
    'pipeline.lost': 'Lost',

    // Contacts
    'contacts.title': 'Contacts',
    'contacts.search': 'Search contacts...',
    'contacts.import': 'Import',
    'contacts.export': 'Export',
    'contacts.add': 'Add contact',
    'contacts.phone': 'Phone',
    'contacts.email': 'Email',
    'contacts.company': 'Company',
    'contacts.score': 'Score',
    'contacts.tags': 'Tags',

    // Campaigns
    'campaigns.title': 'Campaigns',
    'campaigns.create': 'Create campaign',
    'campaigns.execute': 'Execute',
    'campaigns.pause': 'Pause',
    'campaigns.sent': 'Sent',
    'campaigns.delivered': 'Delivered',
    'campaigns.read': 'Read',
    'campaigns.replied': 'Replied',

    // Analytics
    'analytics.title': 'Analytics',
    'analytics.overview': 'Overview',
    'analytics.messages': 'Messages',
    'analytics.funnel': 'Funnel',
    'analytics.sentiment': 'Sentiment',
    'analytics.timing': 'Timing',
    'analytics.quality': 'Quality',
    'analytics.export_csv': 'Export CSV',

    // Config
    'config.title': 'Settings',
    'config.bot_name': 'Bot name',
    'config.personality': 'Personality',
    'config.tone': 'Tone',
    'config.language': 'Language',
    'config.knowledge_base': 'Knowledge Base',
    'config.save': 'Save',
    'config.industry': 'Industry',
    'config.industry_templates': 'Industry templates',

    // Chat
    'chat.title': 'Chat',
    'chat.select_contact': 'Select a contact',
    'chat.type_message': 'Type a message...',
    'chat.send': 'Send',

    // Login
    'login.title': 'MejoraWS',
    'login.subtitle': 'Autonomous WhatsApp CRM with AI',
    'login.password': 'Password',
    'login.submit': 'Sign in',
    'login.error': 'Incorrect password',
    'login.loading': 'Signing in...',

    // Onboarding
    'onboarding.welcome': 'Welcome',
    'onboarding.welcome_desc': 'Meet MejoraWS',
    'onboarding.import': 'Import contacts',
    'onboarding.import_desc': 'Load your contact base',
    'onboarding.personality': 'Bot personality',
    'onboarding.personality_desc': 'Define how your AI responds',
    'onboarding.test': 'Test the bot',
    'onboarding.test_desc': 'Send a test message',
    'onboarding.ready': "You're ready!",
    'onboarding.ready_desc': 'Your bot is running',
    'onboarding.skip': 'Skip wizard',
    'onboarding.next': 'Next',
    'onboarding.back': 'Back',
    'onboarding.start': 'Get started',

    // Common
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.all': 'All',
    'common.none': 'None',
    'common.total': 'Total',
    'common.active': 'Active',
    'common.inactive': 'Inactive',
    'common.search': 'Search...',
  },
}

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextType>({
  locale: 'es',
  setLocale: () => {},
  t: (key) => key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('locale') as Locale
      if (stored && (stored === 'es' || stored === 'en')) return stored
      // Detect from browser
      const browserLang = navigator.language.split('-')[0]
      if (browserLang === 'en') return 'en'
    }
    return 'es'
  })

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', newLocale)
    }
  }, [])

  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    let text = translations[locale]?.[key] || translations['es']?.[key] || key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(`{${k}}`, String(v))
      }
    }
    return text
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export const useI18n = () => useContext(I18nContext)
export const useTranslation = () => useI18n().t
