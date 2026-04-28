// src/i18n/messages.ts
// Internationalization de mensajes de error y respuestas del sistema
// Soporta: español (es) e inglés (en)

export type Locale = 'es' | 'en'

interface Messages {
  // Errores de validación
  validation: {
    required: string
    invalidFormat: string
    tooLong: string
    tooShort: string
    invalidPhone: string
    invalidEmail: string
  }
  // Errores de autenticación
  auth: {
    noToken: string
    invalidToken: string
    expiredToken: string
    invalidPassword: string
    accessDenied: string
  }
  // Errores de recursos
  resource: {
    notFound: string
    alreadyExists: string
    createFailed: string
    updateFailed: string
    deleteFailed: string
  }
  // Errores de rate limiting
  rateLimit: {
    exceeded: string
    retryAfter: string
  }
  // Errores de sistema
  system: {
    internalError: string
    serviceUnavailable: string
    databaseError: string
    llmUnavailable: string
    whatsappDisconnected: string
  }
  // Errores de GDPR
  gdpr: {
    consentRequired: string
    exportFailed: string
    eraseFailed: string
    contactNotFound: string
  }
  // Errores de campañas
  campaigns: {
    noContacts: string
    limitReached: string
    alreadyRunning: string
    notFound: string
  }
  // Respuestas exitosas
  success: {
    created: string
    updated: string
    deleted: string
    sent: string
    imported: string
    exported: string
  }
}

const messages: Record<Locale, Messages> = {
  es: {
    validation: {
      required: 'Este campo es requerido',
      invalidFormat: 'Formato inválido',
      tooLong: 'Excede la longitud máxima',
      tooShort: 'No alcanza la longitud mínima',
      invalidPhone: 'Número de teléfono inválido',
      invalidEmail: 'Email inválido',
    },
    auth: {
      noToken: 'Token no proporcionado',
      invalidToken: 'Token inválido',
      expiredToken: 'Token expirado',
      invalidPassword: 'Contraseña inválida',
      accessDenied: 'Acceso denegado',
    },
    resource: {
      notFound: 'Recurso no encontrado',
      alreadyExists: 'El recurso ya existe',
      createFailed: 'Error al crear el recurso',
      updateFailed: 'Error al actualizar el recurso',
      deleteFailed: 'Error al eliminar el recurso',
    },
    rateLimit: {
      exceeded: 'Demasiadas solicitudes',
      retryAfter: 'Intentá nuevamente en {seconds} segundos',
    },
    system: {
      internalError: 'Error interno del servidor',
      serviceUnavailable: 'Servicio no disponible',
      databaseError: 'Error de base de datos',
      llmUnavailable: 'Servicio de IA no disponible',
      whatsappDisconnected: 'WhatsApp desconectado',
    },
    gdpr: {
      consentRequired: 'Se requiere consentimiento para procesar datos',
      exportFailed: 'Error al exportar datos',
      eraseFailed: 'Error al borrar datos',
      contactNotFound: 'Contacto no encontrado',
    },
    campaigns: {
      noContacts: 'No hay contactos para esta audiencia',
      limitReached: 'Límite diario de mensajes alcanzado',
      alreadyRunning: 'La campaña ya está en ejecución',
      notFound: 'Campaña no encontrada',
    },
    success: {
      created: 'Creado exitosamente',
      updated: 'Actualizado exitosamente',
      deleted: 'Eliminado exitosamente',
      sent: 'Mensaje enviado',
      imported: 'Importación completada',
      exported: 'Exportación completada',
    },
  },

  en: {
    validation: {
      required: 'This field is required',
      invalidFormat: 'Invalid format',
      tooLong: 'Exceeds maximum length',
      tooShort: 'Below minimum length',
      invalidPhone: 'Invalid phone number',
      invalidEmail: 'Invalid email address',
    },
    auth: {
      noToken: 'No token provided',
      invalidToken: 'Invalid token',
      expiredToken: 'Token expired',
      invalidPassword: 'Invalid password',
      accessDenied: 'Access denied',
    },
    resource: {
      notFound: 'Resource not found',
      alreadyExists: 'Resource already exists',
      createFailed: 'Failed to create resource',
      updateFailed: 'Failed to update resource',
      deleteFailed: 'Failed to delete resource',
    },
    rateLimit: {
      exceeded: 'Too many requests',
      retryAfter: 'Please try again in {seconds} seconds',
    },
    system: {
      internalError: 'Internal server error',
      serviceUnavailable: 'Service unavailable',
      databaseError: 'Database error',
      llmUnavailable: 'AI service unavailable',
      whatsappDisconnected: 'WhatsApp disconnected',
    },
    gdpr: {
      consentRequired: 'Consent is required to process data',
      exportFailed: 'Failed to export data',
      eraseFailed: 'Failed to erase data',
      contactNotFound: 'Contact not found',
    },
    campaigns: {
      noContacts: 'No contacts found for this audience',
      limitReached: 'Daily message limit reached',
      alreadyRunning: 'Campaign is already running',
      notFound: 'Campaign not found',
    },
    success: {
      created: 'Created successfully',
      updated: 'Updated successfully',
      deleted: 'Deleted successfully',
      sent: 'Message sent',
      imported: 'Import completed',
      exported: 'Export completed',
    },
  },
}

/**
 * Obtiene mensajes para un locale específico
 */
export function getMessages(locale: Locale = 'es'): Messages {
  return messages[locale] || messages.es
}

/**
 * Obtiene un mensaje formateado con variables
 */
export function t(locale: Locale, path: string, vars?: Record<string, string | number>): string {
  const msgs = getMessages(locale)
  const keys = path.split('.')
  let result: any = msgs

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key]
    } else {
      return path // Fallback: devolver el path si no encuentra el mensaje
    }
  }

  if (typeof result !== 'string') return path

  // Reemplazar variables {var}
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      result = result.replace(`{${k}}`, String(v))
    }
  }

  return result
}

/**
 * Detecta el locale desde el header Accept-Language
 */
export function detectLocale(acceptLanguage?: string): Locale {
  if (!acceptLanguage) return 'es'
  const lang = acceptLanguage.toLowerCase()
  if (lang.startsWith('en')) return 'en'
  return 'es'
}
