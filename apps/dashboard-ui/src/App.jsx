import React, { useState, useEffect, useMemo } from 'react';
import { formatToJid, parseRecipientsText } from '@mejoraws/shared';
import {
  DashboardApiClient,
  contactsToCsv,
  estimateSmartDripWindow,
  getAIModeBadge,
  getSenderBadge,
} from './api/dashboardClient';

const api = new DashboardApiClient();

const INITIAL_SANDBOX_CONTACTS = [
  {
    id: 'contact-demo-3764358152',
    instance_id: 'principal_v1',
    jid: formatToJid('3764358152'),
    phone_number: '5493764358152',
    push_name: 'Contacto Prueba 1',
    address_book_name: 'Prueba Misiones 1 (3764358152)',
    is_in_broadcast: true,
    broadcast_lists: ['difusion_clientes_vip@broadcast'],
    ai_mode: 'AI_RETENTION',
    ai_muted_until: null,
    is_whitelisted: true,
    metadata: {},
    last_interaction_at: new Date(),
    created_at: new Date(),
  },
  {
    id: 'contact-demo-3765007805',
    instance_id: 'principal_v1',
    jid: formatToJid('3765007805'),
    phone_number: '5493765007805',
    push_name: 'Contacto Prueba 2',
    address_book_name: 'Prueba Misiones 2 (3765007805)',
    is_in_broadcast: true,
    broadcast_lists: ['difusion_clientes_vip@broadcast'],
    ai_mode: 'HUMAN_TAKEOVER',
    ai_muted_until: new Date(Date.now() + 24 * 3600 * 1000),
    is_whitelisted: true,
    metadata: {
      last_ai_alert: {
        reason: 'KEYWORD_MATCH',
        summaryTwoLines:
          'El contacto consultó precio y disponibilidad de reunión.\nRequiere seguimiento humano directo para cierre.',
      },
    },
    last_interaction_at: new Date(),
    created_at: new Date(),
  },
];

const INITIAL_SANDBOX_MESSAGES = {
  'contact-demo-3764358152': [
    {
      id: 'msg-1',
      whatsapp_message_id: 'wa_demo_1',
      contact_id: 'contact-demo-3764358152',
      direction: 'INBOUND',
      sender_type: 'CONTACT',
      content_type: 'TEXT',
      body: 'Hola! Quería consultar cómo funciona el servicio de atención continua.',
      media_url: null,
      media_filename: null,
      is_broadcast: false,
      status: 'DELIVERED',
      created_at: new Date(Date.now() - 600000),
    },
    {
      id: 'msg-2',
      whatsapp_message_id: 'wa_demo_2',
      contact_id: 'contact-demo-3764358152',
      direction: 'OUTBOUND',
      sender_type: 'AI_AGENT',
      content_type: 'TEXT',
      body: '¡Hola! Qué gusto saludarte. Te acompañamos con programación inteligente y atención personalizada. ¿Para qué rubro lo estás evaluando?',
      media_url: null,
      media_filename: null,
      is_broadcast: false,
      status: 'READ',
      created_at: new Date(Date.now() - 540000),
    },
  ],
  'contact-demo-3765007805': [
    {
      id: 'msg-3',
      whatsapp_message_id: 'wa_demo_3',
      contact_id: 'contact-demo-3765007805',
      direction: 'INBOUND',
      sender_type: 'CONTACT',
      content_type: 'TEXT',
      body: 'Hola, me interesa saber el precio y coordinar una reunión esta semana.',
      media_url: null,
      media_filename: null,
      is_broadcast: false,
      status: 'DELIVERED',
      created_at: new Date(Date.now() - 300000),
    },
    {
      id: 'msg-4',
      whatsapp_message_id: 'wa_demo_4',
      contact_id: 'contact-demo-3765007805',
      direction: 'OUTBOUND',
      sender_type: 'HUMAN_OWNER',
      content_type: 'TEXT',
      body: '¡Hola! Te escribo directo para pasarte la propuesta y coordinar horario.',
      media_url: null,
      media_filename: null,
      is_broadcast: false,
      status: 'SENT',
      created_at: new Date(Date.now() - 120000),
    },
  ],
};

export default function App() {
  // Autenticación
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginApiKey, setLoginApiKey] = useState('');
  const [loginError, setLoginError] = useState('');
  const [offlineSandboxMode, setOfflineSandboxMode] = useState(false);

  // Navegación de los 5 módulos PRD § 7
  const [activeTab, setActiveTab] = useState('inbox'); // inbox | scheduler | contacts | ai | connection
  const [toast, setToast] = useState(null);

  // Estado global de salud y métricas
  const [health, setHealth] = useState({
    ok: true,
    instanceName: 'principal_v1',
    whatsapp: {
      state: 'connected',
      instanceName: 'principal_v1',
      phone: '5493764000000',
    },
    queuePaused: false,
    metrics: {
      sentToday: 14,
      receivedToday: 9,
      pendingJobs: 2,
      failedToday: 0,
    },
    enforceWhitelist: true,
  });

  // Estado de contactos y conversaciones
  const [contacts, setContacts] = useState(INITIAL_SANDBOX_CONTACTS);
  const [selectedContactId, setSelectedContactId] = useState(
    INITIAL_SANDBOX_CONTACTS[0].id
  );
  const [messagesByContact, setMessagesByContact] = useState(
    INITIAL_SANDBOX_MESSAGES
  );
  const [inboxSearch, setInboxSearch] = useState('');
  const [inboxModeFilter, setInboxModeFilter] = useState('ALL');
  const [onlyBroadcastFilter, setOnlyBroadcastFilter] = useState(false);

  // Respuesta manual en Inbox
  const [replyText, setReplyText] = useState('');
  const [replyMediaUrl, setReplyMediaUrl] = useState('');
  const [replyContentType, setReplyContentType] = useState('TEXT');

  // Programador Smart Drip
  const [schedPhonesInput, setSchedPhonesInput] = useState(
    '3764358152, 3765007805'
  );
  const [schedText, setSchedText] = useState(
    '{Hola|Buen día} {nombre}, te compartimos las novedades de la semana.'
  );
  const [schedContentType, setSchedContentType] = useState('TEXT');
  const [schedMediaUrl, setSchedMediaUrl] = useState('');
  const [schedMediaFilename, setSchedMediaFilename] = useState('');
  const [schedDateTime, setSchedDateTime] = useState(() => {
    const d = new Date(Date.now() + 3600 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [schedUrgent, setSchedUrgent] = useState(false);
  const [schedIdempotencyKey, setSchedIdempotencyKey] = useState('');
  const [scheduledJobs, setScheduledJobs] = useState([]);

  // Alta manual de contacto en Libreta
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactWhitelisted, setNewContactWhitelisted] = useState(true);

  // Configuración IA (Módulo 4)
  const [aiConfig, setAiConfig] = useState({
    id: 1,
    is_global_enabled: true,
    system_prompt:
      'Eres el asistente de atención y retención de Mejora Continua. Tu tono es empático, profesional, natural y humano. Respondes con brevedad para clarificar y contener sin usar frases robóticas ni avisos de transferencia.',
    model_name: 'gpt-4o-mini',
    max_auto_turns: 2,
    handoff_keywords: [
      'precio',
      'comprar',
      'reunion',
      'llamame',
      'asesor',
      'info',
      'costo',
    ],
    auto_mute_hours_on_human_reply: 24,
    alert_webhook_url: '',
  });
  const [keywordsInput, setKeywordsInput] = useState(
    'precio, comprar, reunion, llamame, asesor, info, costo'
  );

  // Llaves API (Módulo 5)
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newlyCreatedRawKey, setNewlyCreatedRawKey] = useState('');

  const showNotice = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const refreshAllFromApi = async () => {
    if (offlineSandboxMode) return;
    try {
      const [healthRes, contactsRes, jobsRes, aiRes, keysRes] =
        await Promise.all([
          api.getHealth(),
          api.listContacts(),
          api.listScheduledJobs(),
          api.getAIConfig(),
          api.listApiKeys(),
        ]);

      setHealth(healthRes);
      if (contactsRes.contacts?.length) {
        setContacts(contactsRes.contacts);
        if (!selectedContactId) {
          setSelectedContactId(contactsRes.contacts[0].id);
        }
      }
      setScheduledJobs(jobsRes.jobs || []);
      if (aiRes.config) {
        setAiConfig(aiRes.config);
        setKeywordsInput((aiRes.config.handoff_keywords || []).join(', '));
      }
      setApiKeys(keysRes.keys || []);
    } catch {
      // Si la API no está levantada aún, se conserva el estado local sin romper la UI
    }
  };

  useEffect(() => {
    if (isAuthenticated && !offlineSandboxMode) {
      refreshAllFromApi();
    }
  }, [isAuthenticated, offlineSandboxMode]);

  useEffect(() => {
    if (!isAuthenticated || offlineSandboxMode || !selectedContactId) return;
    api
      .getConversationMessages(selectedContactId)
      .then((res) => {
        setMessagesByContact((prev) => ({
          ...prev,
          [selectedContactId]: res.messages || [],
        }));
      })
      .catch(() => {});
  }, [isAuthenticated, offlineSandboxMode, selectedContactId]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      if (loginApiKey.trim()) {
        api.setApiKey(loginApiKey.trim());
        const h = await api.getHealth();
        setHealth(h);
        setCurrentUser('api_key_master');
        setOfflineSandboxMode(false);
        setIsAuthenticated(true);
        return;
      }

      const res = await api.login(loginUsername, loginPassword);
      setCurrentUser(res.user || loginUsername);
      setOfflineSandboxMode(false);
      setIsAuthenticated(true);
    } catch (err) {
      setLoginError(
        err instanceof Error
          ? `${err.message}. También podés ingresar en Modo Sandbox Local para operar la interfaz.`
          : 'Error de autenticación'
      );
    }
  };

  const handleEnterSandbox = () => {
    setOfflineSandboxMode(true);
    setCurrentUser('admin (Sandbox Local)');
    setIsAuthenticated(true);
    showNotice(
      'Modo Sandbox Local activo con los números 3764358152 y 3765007805 precargados.'
    );
  };

  const handleToggleQueuePanic = async () => {
    const nextPaused = !health.queuePaused;
    if (!offlineSandboxMode) {
      try {
        const res = await api.toggleQueue(nextPaused);
        setHealth((h) => ({ ...h, queuePaused: res.paused }));
        showNotice(
          res.paused
            ? 'COLA PAUSADA (Botón de Pánico activado)'
            : 'Cola de salida reanudada',
          res.paused ? 'warning' : 'success'
        );
        return;
      } catch (err) {
        showNotice(err.message, 'error');
        return;
      }
    }

    setHealth((h) => ({ ...h, queuePaused: nextPaused }));
    showNotice(
      nextPaused
        ? 'COLA PAUSADA en Sandbox (Botón de Pánico activado)'
        : 'Cola de salida reanudada en Sandbox',
      nextPaused ? 'warning' : 'success'
    );
  };

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (onlyBroadcastFilter && !c.is_in_broadcast) return false;
      if (inboxModeFilter !== 'ALL' && c.ai_mode !== inboxModeFilter) {
        return false;
      }
      if (inboxSearch.trim()) {
        const q = inboxSearch.toLowerCase();
        const match =
          (c.address_book_name || '').toLowerCase().includes(q) ||
          (c.push_name || '').toLowerCase().includes(q) ||
          (c.phone_number || '').toLowerCase().includes(q) ||
          (c.jid || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [contacts, onlyBroadcastFilter, inboxModeFilter, inboxSearch]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) || contacts[0],
    [contacts, selectedContactId]
  );

  const currentMessages = useMemo(
    () =>
      selectedContact ? messagesByContact[selectedContact.id] || [] : [],
    [messagesByContact, selectedContact]
  );

  const handleSwitchAIMode = async (contactId, nextMode) => {
    if (!offlineSandboxMode) {
      try {
        const res = await api.setConversationMode(contactId, nextMode);
        setContacts((prev) =>
          prev.map((c) => (c.id === contactId ? res.contact : c))
        );
        showNotice(`Modo cambiado a ${nextMode}`);
        return;
      } catch (err) {
        showNotice(err.message, 'error');
        return;
      }
    }

    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              ai_mode: nextMode,
              ai_muted_until:
                nextMode === 'HUMAN_TAKEOVER'
                  ? new Date(Date.now() + 24 * 3600 * 1000)
                  : null,
            }
          : c
      )
    );
    showNotice(`Modo cambiado a ${nextMode}`);
  };

  const handleSendManualReply = async (e) => {
    e.preventDefault();
    if (!selectedContact || (!replyText.trim() && !replyMediaUrl.trim())) {
      return;
    }

    if (!offlineSandboxMode) {
      try {
        const res = await api.sendManualReply(selectedContact.id, {
          text: replyText,
          mediaUrl: replyMediaUrl || undefined,
          contentType: replyContentType,
        });
        setMessagesByContact((prev) => ({
          ...prev,
          [selectedContact.id]: [
            ...(prev[selectedContact.id] || []),
            res.message,
          ],
        }));
        setContacts((prev) =>
          prev.map((c) =>
            c.id === selectedContact.id
              ? { ...c, ai_mode: 'HUMAN_TAKEOVER' }
              : c
          )
        );
        setReplyText('');
        setReplyMediaUrl('');
        showNotice(
          'Respuesta enviada. Conversación pasada a HUMAN_TAKEOVER automáticamente.'
        );
        return;
      } catch (err) {
        showNotice(err.message, 'error');
        return;
      }
    }

    const newMsg = {
      id: `msg-${Date.now()}`,
      whatsapp_message_id: `wa_local_${Date.now()}`,
      contact_id: selectedContact.id,
      direction: 'OUTBOUND',
      sender_type: 'HUMAN_OWNER',
      content_type: replyContentType,
      body: replyText || '[Adjunto]',
      media_url: replyMediaUrl || null,
      media_filename: null,
      is_broadcast: false,
      status: 'SENT',
      created_at: new Date(),
    };
    setMessagesByContact((prev) => ({
      ...prev,
      [selectedContact.id]: [...(prev[selectedContact.id] || []), newMsg],
    }));
    setContacts((prev) =>
      prev.map((c) =>
        c.id === selectedContact.id
          ? {
              ...c,
              ai_mode: 'HUMAN_TAKEOVER',
              ai_muted_until: new Date(Date.now() + 24 * 3600 * 1000),
            }
          : c
      )
    );
    setReplyText('');
    setReplyMediaUrl('');
    showNotice(
      'Respuesta enviada desde el panel. IA silenciada en HUMAN_TAKEOVER por 24h.'
    );
  };

  const parsedTargetPhones = useMemo(
    () =>
      schedPhonesInput
        .split(/[,;\n]+/)
        .map((p) => p.trim())
        .filter(Boolean),
    [schedPhonesInput]
  );

  const dripEstimate = useMemo(
    () =>
      estimateSmartDripWindow(
        parsedTargetPhones.length || 1,
        schedDateTime ? new Date(schedDateTime).toISOString() : '',
        schedUrgent
      ),
    [parsedTargetPhones.length, schedDateTime, schedUrgent]
  );

  const handleSchedFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseRecipientsText(text);
      if (parsed.length > 0) {
        const phones = parsed.map((p) => p.telefono).join(', ');
        setSchedPhonesInput(phones);
        showNotice(`Importados ${parsed.length} destinatario(s) del archivo ${file.name}`);
      } else {
        showNotice('No se encontraron teléfonos válidos en el archivo', 'error');
      }
    } catch (err) {
      showNotice('Error al leer el archivo: ' + (err.message || 'desconocido'), 'error');
    }
  };

  const handleScheduleSubmit = async (sendImmediately = false) => {
    if (!parsedTargetPhones.length) {
      showNotice('Ingresá al menos un teléfono destino', 'error');
      return;
    }

    if (!offlineSandboxMode) {
      try {
        if (sendImmediately && parsedTargetPhones.length === 1) {
          const res = await api.sendMessageNow({
            phone: parsedTargetPhones[0],
            text: schedText,
            contentType: schedContentType,
            mediaUrl: schedMediaUrl || undefined,
            mediaFilename: schedMediaFilename || undefined,
            idempotency_key: schedIdempotencyKey || undefined,
            urgent: schedUrgent,
          });
          setScheduledJobs((prev) => [res.job, ...prev]);
          showNotice(
            res.duplicated
              ? 'Envío duplicado bloqueado por idempotencia'
              : 'Mensaje encolado para despacho inmediato'
          );
          return;
        }

        const isoDate = sendImmediately
          ? new Date().toISOString()
          : new Date(schedDateTime).toISOString();
        const res = await api.scheduleMessages({
          phones: parsedTargetPhones,
          text: schedText,
          contentType: schedContentType,
          mediaUrl: schedMediaUrl || undefined,
          mediaFilename: schedMediaFilename || undefined,
          scheduledFor: isoDate,
          idempotency_key: schedIdempotencyKey || undefined,
          urgent: schedUrgent,
        });
        setScheduledJobs((prev) => [...res.jobs, ...prev]);
        showNotice(
          `Programados ${res.count} envíos con distribución Smart Drip`
        );
        return;
      } catch (err) {
        showNotice(err.message, 'error');
        return;
      }
    }

    const baseTime = sendImmediately
      ? new Date()
      : dripEstimate.effectiveFirstSendAt;
    const simulatedJobs = parsedTargetPhones.map((phone, idx) => ({
      id: `job-${Date.now()}-${idx}`,
      idempotency_key: schedIdempotencyKey
        ? `${schedIdempotencyKey}:${idx}`
        : null,
      contact_id: phone,
      payload: {
        body: schedText,
        content_type: schedContentType,
        media_url: schedMediaUrl || undefined,
        media_filename: schedMediaFilename || undefined,
        urgent: schedUrgent,
      },
      scheduled_for: baseTime,
      effective_send_at: new Date(baseTime.getTime() + idx * 7000),
      status: 'PENDING',
      attempts: 0,
      error_log: null,
      created_at: new Date(),
    }));
    setScheduledJobs((prev) => [...simulatedJobs, ...prev]);
    showNotice(
      `Encolados ${simulatedJobs.length} trabajos con distribución Smart Drip`
    );
  };

  const handleCancelJob = async (jobId) => {
    if (!offlineSandboxMode) {
      try {
        await api.cancelScheduledJob(jobId);
        setScheduledJobs((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, status: 'CANCELLED' } : j
          )
        );
        showNotice('Trabajo programado cancelado');
        return;
      } catch (err) {
        showNotice(err.message, 'error');
        return;
      }
    }
    setScheduledJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: 'CANCELLED' } : j))
    );
    showNotice('Trabajo cancelado en Sandbox');
  };

  const handleCreateContact = async (e) => {
    e.preventDefault();
    if (!newContactPhone.trim()) return;

    if (!offlineSandboxMode) {
      try {
        const res = await api.createContact({
          phone: newContactPhone.trim(),
          name: newContactName.trim() || undefined,
          is_whitelisted: newContactWhitelisted,
        });
        setContacts((prev) => [
          res.contact,
          ...prev.filter((c) => c.id !== res.contact.id),
        ]);
        setNewContactPhone('');
        setNewContactName('');
        showNotice(`Contacto ${res.contact.jid} guardado`);
        return;
      } catch (err) {
        showNotice(err.message, 'error');
        return;
      }
    }

    const jid = formatToJid(newContactPhone.trim());
    const created = {
      id: `contact-${Date.now()}`,
      instance_id: 'principal_v1',
      jid,
      phone_number: jid.split('@')[0],
      push_name: newContactName.trim() || null,
      address_book_name: newContactName.trim() || null,
      is_in_broadcast: false,
      broadcast_lists: [],
      ai_mode: 'AI_RETENTION',
      ai_muted_until: null,
      is_whitelisted: newContactWhitelisted,
      metadata: {},
      last_interaction_at: new Date(),
      created_at: new Date(),
    };
    setContacts((prev) => [created, ...prev]);
    setNewContactPhone('');
    setNewContactName('');
    showNotice(`Contacto ${jid} agregado a la libreta`);
  };

  const handleToggleWhitelist = async (contact) => {
    const nextVal = !contact.is_whitelisted;
    if (!offlineSandboxMode) {
      try {
        const res = await api.setContactWhitelist(contact.id, nextVal);
        setContacts((prev) =>
          prev.map((c) => (c.id === contact.id ? res.contact : c))
        );
        showNotice(
          nextVal
            ? `${contact.phone_number} autorizado en Whitelist`
            : `${contact.phone_number} removido de Whitelist`
        );
        return;
      } catch (err) {
        showNotice(err.message, 'error');
        return;
      }
    }

    setContacts((prev) =>
      prev.map((c) =>
        c.id === contact.id ? { ...c, is_whitelisted: nextVal } : c
      )
    );
    showNotice(
      nextVal
        ? `${contact.phone_number} autorizado en Whitelist`
        : `${contact.phone_number} removido de Whitelist`
    );
  };

  const handleSyncContacts = async () => {
    if (!offlineSandboxMode) {
      try {
        const res = await api.syncContacts();
        if (res.contacts?.length) {
          setContacts(res.contacts);
        }
        showNotice(
          `Sincronizados ${res.synced} contactos y listas @broadcast desde Evolution API`
        );
        return;
      } catch (err) {
        showNotice(err.message, 'error');
        return;
      }
    }
    showNotice(
      'Libreta sincronizada (3764358152 y 3765007805 activos en lista @broadcast)'
    );
  };

  const handleExportCsv = () => {
    const csv = contactsToCsv(filteredContacts);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contactos_mejoraws_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice(`Exportados ${filteredContacts.length} contactos a CSV`);
  };

  const handleSaveAIConfig = async (e) => {
    e.preventDefault();
    const keywords = keywordsInput
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    const patch = {
      ...aiConfig,
      handoff_keywords: keywords,
    };

    if (!offlineSandboxMode) {
      try {
        const res = await api.updateAIConfig(patch);
        setAiConfig(res.config);
        showNotice('Configuración del Copiloto IA actualizada');
        return;
      } catch (err) {
        showNotice(err.message, 'error');
        return;
      }
    }
    setAiConfig(patch);
    showNotice('Configuración del Copiloto IA actualizada en Sandbox');
  };

  const handleCreateApiKey = async (e) => {
    e.preventDefault();
    if (!newKeyLabel.trim()) return;

    if (!offlineSandboxMode) {
      try {
        const res = await api.createApiKey(newKeyLabel.trim());
        setNewlyCreatedRawKey(res.apiKey);
        setApiKeys((prev) => [res.record, ...prev]);
        setNewKeyLabel('');
        showNotice('Nueva llave x-api-key generada');
        return;
      } catch (err) {
        showNotice(err.message, 'error');
        return;
      }
    }

    const simulatedRaw = `sk_live_${Math.random()
      .toString(16)
      .slice(2)}${Date.now().toString(16)}`;
    const record = {
      id: `key-${Date.now()}`,
      label: newKeyLabel.trim(),
      key_hash: 'sha256_preview_hash',
      is_active: true,
      created_at: new Date(),
    };
    setNewlyCreatedRawKey(simulatedRaw);
    setApiKeys((prev) => [record, ...prev]);
    setNewKeyLabel('');
    showNotice('Nueva llave x-api-key generada en Sandbox');
  };

  // ============================================================================
  // PANTALLA DE LOGIN MAESTRO (PRD § 1.7)
  // ============================================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="space-y-2 text-center">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              PRD v1.0 · WhatsApp Vía A (Self-Hosted)
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              MejoraWS · Panel Maestro
            </h1>
            <p className="text-sm text-slate-400">
              Mensajería Privada, Programación Smart Drip y Copiloto IA con Traspaso Invisible
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-700/60 text-xs text-rose-200">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Usuario Administrador (ADMIN_USER)
              </label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="admin"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Contraseña Maestra (ADMIN_PASSWORD)
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="••••••••••••"
              />
            </div>

            <div className="pt-1 border-t border-slate-800">
              <label className="block text-xs font-medium text-slate-400 mb-1">
                O ingresar con Master API Key (x-api-key opcional)
              </label>
              <input
                type="password"
                value={loginApiKey}
                onChange={(e) => setLoginApiKey(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                placeholder="sk_live_..."
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition cursor-pointer"
            >
              Iniciar Sesión Segura (JWT HttpOnly)
            </button>
          </form>

          <div className="pt-3 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={handleEnterSandbox}
              className="w-full py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
            >
              Abrir en Modo Sandbox Operativo (Pruebas 3764358152 / 3765007805)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Notificación flotante */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium ${
            toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-600 text-rose-100'
              : toast.type === 'warning'
              ? 'bg-amber-950/90 border-amber-500 text-amber-100'
              : 'bg-emerald-950/90 border-emerald-600 text-emerald-100'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* BARRA SUPERIOR DE GOBERNANZA Y BOTÓN DE PÁNICO */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white">MejoraWS</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {health.instanceName}
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                  health.whatsapp?.state === 'connected'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                {health.whatsapp?.state === 'connected'
                  ? '● WhatsApp Conectado'
                  : '○ Requiere QR / Reconexión'}
              </span>
              {health.enforceWhitelist && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  Cortafuegos Whitelist Activo
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Sesión: <strong className="text-slate-200">{currentUser}</strong> ·
              Enviados hoy: <strong>{health.metrics?.sentToday ?? 0}</strong> ·
              Recibidos: <strong>{health.metrics?.receivedToday ?? 0}</strong> ·
              En cola: <strong>{health.metrics?.pendingJobs ?? 0}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggleQueuePanic}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer border ${
              health.queuePaused
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400'
                : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500'
            }`}
          >
            {health.queuePaused
              ? '▶ Reanudar Cola Global'
              : '⏸ Botón de Pánico (Pausar Cola)'}
          </button>

          <button
            type="button"
            onClick={() => {
              api.logout().catch(() => {});
              setIsAuthenticated(false);
            }}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer"
          >
            Salir
          </button>
        </div>
      </header>

      {/* NAVEGACIÓN DE LOS 5 MÓDULOS MANDATORIOS (PRD § 7) */}
      <nav className="bg-slate-900/50 border-b border-slate-800 px-6 flex gap-2 overflow-x-auto">
        {[
          { id: 'inbox', label: '1. Inbox Unificado & Handoff IA' },
          { id: 'scheduler', label: '2. Programador Smart Drip' },
          { id: 'contacts', label: '3. Libreta, Difusiones & Whitelist' },
          { id: 'ai', label: '4. Copiloto IA & Reglas Retención' },
          { id: 'connection', label: '5. Conexión QR & API Keys' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'border-emerald-500 text-emerald-300 bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {/* ====================================================================
            MÓDULO 1: INBOX UNIFICADO Y CONTROL AI_RETENTION / HUMAN_TAKEOVER
           ==================================================================== */}
        {activeTab === 'inbox' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-190px)] min-h-[560px]">
            {/* Lista lateral de conversaciones */}
            <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-800 space-y-3">
                <input
                  type="text"
                  value={inboxSearch}
                  onChange={(e) => setInboxSearch(e.target.value)}
                  placeholder="Buscar por nombre, teléfono o JID..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <div className="flex flex-wrap gap-1.5">
                  {['ALL', 'AI_RETENTION', 'HUMAN_TAKEOVER', 'MUTED'].map(
                    (mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setInboxModeFilter(mode)}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                          inboxModeFilter === mode
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {mode === 'ALL' ? 'Todos' : mode}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-800/70">
                {filteredContacts.map((c) => {
                  const modeBadge = getAIModeBadge(c.ai_mode);
                  const isSelected = selectedContact?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedContactId(c.id)}
                      className={`w-full text-left p-4 transition cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800/90 border-l-4 border-l-emerald-500'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-white truncate">
                          {c.address_book_name || c.push_name || c.phone_number}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${modeBadge.badgeClass}`}
                        >
                          {c.ai_mode}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                        <span>+{c.phone_number}</span>
                        {c.is_in_broadcast && (
                          <span className="text-[10px] text-amber-300">
                            ★ En Difusión
                          </span>
                        )}
                      </div>
                      {c.metadata?.last_ai_alert && (
                        <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 whitespace-pre-line">
                          ⚡ {c.metadata.last_ai_alert.summaryTwoLines}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hilo de conversación y traspaso invisible */}
            <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
              {selectedContact ? (
                <>
                  <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/80">
                    <div>
                      <h2 className="font-bold text-base text-white">
                        {selectedContact.address_book_name ||
                          selectedContact.push_name ||
                          selectedContact.phone_number}
                      </h2>
                      <p className="text-xs text-slate-400">
                        JID: <code>{selectedContact.jid}</code> · Whitelist:{' '}
                        <strong>
                          {selectedContact.is_whitelisted
                            ? 'Autorizado'
                            : 'Bloqueado'}
                        </strong>
                      </p>
                    </div>

                    {/* Conmutador de Estado IA (AI_RETENTION / HUMAN_TAKEOVER / MUTED) */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleSwitchAIMode(selectedContact.id, 'AI_RETENTION')
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                          selectedContact.ai_mode === 'AI_RETENTION'
                            ? 'bg-violet-600 text-white border-violet-500'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        🤖 AI_RETENTION
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleSwitchAIMode(
                            selectedContact.id,
                            'HUMAN_TAKEOVER'
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                          selectedContact.ai_mode === 'HUMAN_TAKEOVER'
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        👤 HUMAN_TAKEOVER
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleSwitchAIMode(selectedContact.id, 'MUTED')
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                          selectedContact.ai_mode === 'MUTED'
                            ? 'bg-rose-600 text-white border-rose-500'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        🔕 MUTED
                      </button>
                    </div>
                  </div>

                  {/* Mensajes del hilo */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950/60">
                    {currentMessages.map((m) => {
                      const badge = getSenderBadge(m);
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${
                            badge.align === 'right'
                              ? 'items-end'
                              : 'items-start'
                          }`}
                        >
                          <div
                            className={`max-w-xl rounded-2xl border p-3.5 space-y-1.5 ${badge.bubbleClass}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${badge.badgeClass}`}
                              >
                                {badge.label}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {m.status}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">
                              {m.body}
                            </p>
                            {m.media_url && (
                              <a
                                href={m.media_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block text-xs text-emerald-300 underline"
                              >
                                📎 Ver adjunto ({m.content_type})
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Caja de intervención humana directa */}
                  <form
                    onSubmit={handleSendManualReply}
                    className="p-4 border-t border-slate-800 bg-slate-900 space-y-2"
                  >
                    <div className="flex gap-2">
                      <select
                        value={replyContentType}
                        onChange={(e) => setReplyContentType(e.target.value)}
                        className="px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200"
                      >
                        <option value="TEXT">Texto</option>
                        <option value="URL">URL con Preview</option>
                        <option value="IMAGE">Imagen</option>
                        <option value="PDF">PDF</option>
                        <option value="DOCUMENT">Documento</option>
                      </select>
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Escribir respuesta como dueño (pasa automáticamente a HUMAN_TAKEOVER)..."
                        className="flex-1 px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer"
                      >
                        Enviar Ahora
                      </button>
                    </div>
                    {replyContentType !== 'TEXT' && (
                      <input
                        type="text"
                        value={replyMediaUrl}
                        onChange={(e) => setReplyMediaUrl(e.target.value)}
                        placeholder="URL pública del archivo multimedia o PDF (https://...)"
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
                      />
                    )}
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
                  Seleccioná un contacto para abrir la conversación.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====================================================================
            MÓDULO 2: PROGRAMADOR INTELIGENTE (SMART DRIP + MULTIMEDIA)
           ==================================================================== */}
        {activeTab === 'scheduler' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">
                  Programador Inteligente & Distribución Smart Drip
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setSchedPhonesInput('3764358152, 3765007805')
                  }
                  className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 cursor-pointer"
                >
                  Cargar números de prueba (3764358152 / 3765007805)
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">
                    Destinatarios (separados por coma o salto de línea)
                  </label>
                  <label className="text-xs text-sky-400 hover:text-sky-300 cursor-pointer flex items-center gap-1">
                    <span>📁 Importar desde archivo (.csv, .txt)</span>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      className="hidden"
                      onChange={handleSchedFileImport}
                    />
                  </label>
                </div>
                <textarea
                  rows={2}
                  value={schedPhonesInput}
                  onChange={(e) => setSchedPhonesInput(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
                  placeholder="3764358152, 3765007805"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tipo de Contenido (PRD § 1.4)
                  </label>
                  <select
                    value={schedContentType}
                    onChange={(e) => setSchedContentType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
                  >
                    <option value="TEXT">Texto + Spintax</option>
                    <option value="URL">URL con Vista Previa</option>
                    <option value="IMAGE">Imagen con Epígrafe</option>
                    <option value="PDF">Documento PDF</option>
                    <option value="DOCUMENT">Archivo Adjunto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Fecha y Hora Programada (ISO Local)
                  </label>
                  <input
                    type="datetime-local"
                    value={schedDateTime}
                    onChange={(e) => setSchedDateTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
                  />
                </div>
              </div>

              {schedContentType !== 'TEXT' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={schedMediaUrl}
                    onChange={(e) => setSchedMediaUrl(e.target.value)}
                    placeholder="URL del adjunto / PDF / Imagen (https://...)"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={schedMediaFilename}
                    onChange={(e) => setSchedMediaFilename(e.target.value)}
                    placeholder="Nombre del archivo (ej. propuesta_comercial.pdf)"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Mensaje (soporta variables {'{nombre}'}, {'{telefono}'} y Spintax {'{Hola|Buen día}'})
                </label>
                <textarea
                  rows={4}
                  value={schedText}
                  onChange={(e) => setSchedText(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <input
                  type="text"
                  value={schedIdempotencyKey}
                  onChange={(e) => setSchedIdempotencyKey(e.target.value)}
                  placeholder="Llave de idempotencia opcional (ej. camp-nov-01)"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                />
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schedUrgent}
                    onChange={(e) => setSchedUrgent(e.target.checked)}
                    className="rounded border-slate-600"
                  />
                  Envío Urgente (ignorar ventana SAFE_HOURS 08:30–20:30)
                </label>
              </div>

              {/* Previsualización matemática Smart Drip */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                <div className="font-semibold text-emerald-300">
                  Cálculo Anti-Baneo Smart Drip ({dripEstimate.recipientCount}{' '}
                  destinatario/s):
                </div>
                <p className="text-slate-300">
                  • Jitter por mensaje: <strong>4s a 12s</strong> (+ simulación
                  humana <code>"composing"</code> de <strong>1.5s a 4s</strong>).
                </p>
                <p className="text-slate-300">
                  • Pausas largas de lote (45s–90s cada 15 envíos):{' '}
                  <strong>{dripEstimate.batchPausesCount}</strong> pausa/s.
                </p>
                <p className="text-slate-300">
                  • Ventana total estimada:{' '}
                  <strong>
                    {dripEstimate.minTotalSeconds}s –{' '}
                    {dripEstimate.maxTotalSeconds}s
                  </strong>
                  .
                </p>
                {dripEstimate.outsideSafeHours && (
                  <p className="text-amber-300 font-medium">
                    ⚠ La hora elegida cae fuera de SAFE_HOURS (08:30–20:30). Se
                    pospondrá automáticamente al{' '}
                    {dripEstimate.effectiveFirstSendAt.toLocaleString()}.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleScheduleSubmit(false)}
                  className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer"
                >
                  📅 Programar Lote Smart Drip
                </button>
                <button
                  type="button"
                  onClick={() => handleScheduleSubmit(true)}
                  className="px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs cursor-pointer"
                >
                  ⚡ Encolar para Envío Inmediato
                </button>
              </div>
            </div>

            {/* Cola de trabajos programados */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col">
              <h3 className="text-base font-bold text-white mb-3">
                Trabajos en Cola (`scheduled_jobs`)
              </h3>
              <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[480px]">
                {scheduledJobs.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No hay trabajos programados registrados en este momento.
                  </p>
                ) : (
                  scheduledJobs.map((job) => (
                    <div
                      key={job.id}
                      className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">
                          Job #{String(job.id).slice(0, 10)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-semibold ${
                            job.status === 'COMPLETED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : job.status === 'CANCELLED' ||
                                job.status === 'FAILED'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>
                      <p className="text-slate-300 truncate">
                        {job.payload?.body}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span>
                          Salida efectiva:{' '}
                          {new Date(job.effective_send_at).toLocaleString()}
                        </span>
                        {job.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => handleCancelJob(job.id)}
                            className="text-rose-400 hover:underline cursor-pointer"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            MÓDULO 3: LIBRETA DE CONTACTOS, DIFUSIONES & WHITELIST
           ==================================================================== */}
        {activeTab === 'contacts' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Libreta de Contactos, Captura de Difusiones (`@broadcast`) y Cortafuegos Whitelist
                  </h2>
                  <p className="text-xs text-slate-400">
                    Con ENFORCE_WHITELIST=true, solo los contactos autorizados en esta tabla pueden recibir mensajes.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSyncContacts}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    🔄 Sincronizar Libreta desde WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    ⬇ Exportar CSV ({filteredContacts.length})
                  </button>
                </div>
              </div>

              {/* Formulario para agregar contacto */}
              <form
                onSubmit={handleCreateContact}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800"
              >
                <input
                  type="text"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  placeholder="Teléfono (ej. 3764358152)"
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                />
                <input
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="Nombre agendado"
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                />
                <label className="flex items-center gap-2 text-xs text-slate-300 px-2">
                  <input
                    type="checkbox"
                    checked={newContactWhitelisted}
                    onChange={(e) => setNewContactWhitelisted(e.target.checked)}
                  />
                  Habilitar en Whitelist
                </label>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer"
                >
                  + Agregar Contacto
                </button>
              </form>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyBroadcastFilter}
                    onChange={(e) => setOnlyBroadcastFilter(e.target.checked)}
                  />
                  Mostrar únicamente contactos capturados en Listas de Difusión (`@broadcast`)
                </label>
                <span className="text-xs text-slate-400">
                  Total: {filteredContacts.length} contacto/s
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase">
                    <tr>
                      <th className="py-3 px-4">Nombre</th>
                      <th className="py-3 px-4">Teléfono / JID Canónico</th>
                      <th className="py-3 px-4">Listas Difusión</th>
                      <th className="py-3 px-4">Estado IA</th>
                      <th className="py-3 px-4">Cortafuegos Whitelist</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredContacts.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-medium text-white">
                          {c.address_book_name || c.push_name || 'Sin nombre'}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          <div>+{c.phone_number}</div>
                          <code className="text-[10px] text-slate-500">
                            {c.jid}
                          </code>
                        </td>
                        <td className="py-3 px-4">
                          {c.is_in_broadcast ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              {(c.broadcast_lists || []).join(', ') ||
                                '@broadcast'}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                            {c.ai_mode}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleWhitelist(c)}
                            className={`px-3 py-1 rounded font-semibold cursor-pointer ${
                              c.is_whitelisted
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {c.is_whitelisted
                              ? '✓ Autorizado'
                              : '✕ Bloqueado'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            MÓDULO 4: CONFIGURACIÓN DEL COPILOTO IA Y REGLAS DE RETENCIÓN
           ==================================================================== */}
        {activeTab === 'ai' && (
          <form
            onSubmit={handleSaveAIConfig}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 max-w-3xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Motor de IA de Retención y Traspaso Invisible (PRD § 3)
                </h2>
                <p className="text-xs text-slate-400">
                  Configura el System Prompt, número máximo de turnos automáticos y palabras clave de escalado al dueño.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-emerald-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiConfig.is_global_enabled}
                  onChange={(e) =>
                    setAiConfig((prev) => ({
                      ...prev,
                      is_global_enabled: e.target.checked,
                    }))
                  }
                />
                Copiloto IA Global Activo
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Modelo LLM (`model_name`)
                </label>
                <input
                  type="text"
                  value={aiConfig.model_name}
                  onChange={(e) =>
                    setAiConfig((prev) => ({
                      ...prev,
                      model_name: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Máximo de Turnos IA (`max_auto_turns`)
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={aiConfig.max_auto_turns}
                  onChange={(e) =>
                    setAiConfig((prev) => ({
                      ...prev,
                      max_auto_turns: Number(e.target.value) || 2,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Horas de Silencio por Intervención Humana
                </label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={aiConfig.auto_mute_hours_on_human_reply}
                  onChange={(e) =>
                    setAiConfig((prev) => ({
                      ...prev,
                      auto_mute_hours_on_human_reply:
                        Number(e.target.value) || 24,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                System Prompt de Retención (Prohibida jerga robótica o avisos de transferencia)
              </label>
              <textarea
                rows={4}
                value={aiConfig.system_prompt}
                onChange={(e) =>
                  setAiConfig((prev) => ({
                    ...prev,
                    system_prompt: e.target.value,
                  }))
                }
                className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Palabras Clave de Escalado Instantáneo (`handoff_keywords`, separadas por coma)
              </label>
              <input
                type="text"
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Webhook de Alerta Instantánea al Dueño (`alert_webhook_url`)
              </label>
              <input
                type="text"
                value={aiConfig.alert_webhook_url || ''}
                onChange={(e) =>
                  setAiConfig((prev) => ({
                    ...prev,
                    alert_webhook_url: e.target.value || null,
                  }))
                }
                placeholder="https://hooks.tu-dominio.com/whatsapp-handoff-alert"
                className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer"
            >
              Guardar Configuración de IA
            </button>
          </form>
        )}

        {/* ====================================================================
            MÓDULO 5: CONEXIÓN QR WHATSAPP Y GESTIÓN DE API KEYS
           ==================================================================== */}
        {activeTab === 'connection' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white">
                Estado de Línea Principal (`Evolution API v2`)
              </h2>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <p>
                  Instancia: <strong>{health.instanceName}</strong>
                </p>
                <p>
                  Estado de conexión:{' '}
                  <strong className="text-emerald-300">
                    {health.whatsapp?.state}
                  </strong>
                </p>
                {health.whatsapp?.phone && (
                  <p>
                    Número vinculado: <strong>+{health.whatsapp.phone}</strong>
                  </p>
                )}
              </div>

              {health.whatsapp?.qrCode && (
                <div className="p-4 bg-white rounded-xl text-center">
                  <img
                    src={health.whatsapp.qrCode}
                    alt="Código QR WhatsApp"
                    className="mx-auto max-w-[220px]"
                  />
                </div>
              )}
            </div>

            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white">
                Llaves de Integración Externa (`x-api-key` — Apps Script / n8n / Webhooks)
              </h2>

              <form onSubmit={handleCreateApiKey} className="flex gap-2">
                <input
                  type="text"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder="Etiqueta de la llave (ej. Google Apps Script CRM)"
                  className="flex-1 px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Generar Llave `sk_live_`
                </button>
              </form>

              {newlyCreatedRawKey && (
                <div className="p-3.5 rounded-lg bg-emerald-950/70 border border-emerald-600/60 text-xs space-y-1">
                  <div className="font-bold text-emerald-200">
                    ¡Copiá tu nueva llave ahora! Solo se muestra en texto plano una vez:
                  </div>
                  <code className="block p-2 rounded bg-slate-950 text-emerald-300 select-all">
                    {newlyCreatedRawKey}
                  </code>
                </div>
              )}

              <div className="space-y-2">
                {apiKeys.map((k) => (
                  <div
                    key={k.id}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">{k.label}</div>
                      <div className="text-[10px] text-slate-500">
                        Creada: {new Date(k.created_at).toLocaleString()}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px]">
                      Activa
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
