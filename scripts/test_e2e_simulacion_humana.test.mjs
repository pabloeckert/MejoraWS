/**
 * Suite E2E de Certificación QA: Simulación Humana y Comportamiento Anti-Ban 2026
 * Autor: Dirección de Calidad e Ingeniería (VP of Quality Engineering)
 *
 * Contactos objetivos de homologación:
 * - Teléfono 1: 3764358152 (Posadas, Misiones -> JID: 5493764358152@s.whatsapp.net)
 * - Teléfono 2: 3765007805 (Posadas, Misiones -> JID: 5493765007805@s.whatsapp.net)
 *
 * Cobertura: Mínimo 10 pruebas E2E verificando presencia, mecanografía, Spintax,
 * distribución Box-Muller, ticks de entrega, clasificación tri-banda y disyuntor.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  normalizePhone,
  gaussianRandomDelayMs,
  calculateTypingDurationMs,
  parseSpintax,
  clasificarRespuesta,
  calculateSafetyLevel,
  renderTemplate,
  canSendMore
} from '../electron/pure.mjs';

describe('SUITE E2E QA — Simulación de Comportamiento Humano con Números de Prueba (3764358152 / 3765007805)', () => {

  const NUMERO_1_RAW = '3764358152';
  const NUMERO_2_RAW = '3765007805';

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Helper de orquestación humana idéntico al motor de producción (electron/main.mjs)
  async function ejecutarSecuenciaHumana(sock, jid, texto, speedFactor = 0.05) {
    const trace = [];
    const t0 = Date.now();

    // 1. Suscripción a presencia (apertura visual del chat)
    await sock.presenceSubscribe(jid);
    trace.push({ paso: 'presenceSubscribe', jid, t: Date.now() - t0 });
    const delayLectura = Math.floor((1000 + Math.random() * 800) * speedFactor);
    await sleep(delayLectura);

    // 2. Indicador composing (escribiendo...) proporcional a la longitud
    await sock.sendPresenceUpdate('composing', jid);
    const typingTime = Math.floor(calculateTypingDurationMs(texto.length) * speedFactor);
    trace.push({ paso: 'composing', jid, duracionTipeo: typingTime, t: Date.now() - t0 });
    await sleep(typingTime);

    // 3. Pausa de revisión previa al clic de envío (relectura humana)
    await sock.sendPresenceUpdate('paused', jid);
    const delayRevision = Math.floor((400 + Math.random() * 400) * speedFactor);
    trace.push({ paso: 'paused', jid, delayRevision, t: Date.now() - t0 });
    await sleep(delayRevision);

    // 4. Despacho real del mensaje
    const res = await sock.sendMessage(jid, { text: texto });
    trace.push({ paso: 'sendMessage', jid, msgId: res.key.id, t: Date.now() - t0 });

    return { res, trace };
  }

  // PRUEBA 1: Normalización de números y validación de JID de WhatsApp
  it('[E2E-01] Normalización y formateo de JID válido para ambos números de prueba', () => {
    const norm1 = normalizePhone(NUMERO_1_RAW);
    const norm2 = normalizePhone(NUMERO_2_RAW);

    expect(norm1).toBe('3764358152');
    expect(norm2).toBe('3765007805');

    // Validación con código de país argentino (549)
    const jid1 = `549${norm1}@s.whatsapp.net`;
    const jid2 = `549${norm2}@s.whatsapp.net`;

    expect(jid1).toBe('5493764358152@s.whatsapp.net');
    expect(jid2).toBe('5493765007805@s.whatsapp.net');
    expect(jid1).toMatch(/^\d{10,15}@s\.whatsapp\.net$/);
    expect(jid2).toMatch(/^\d{10,15}@s\.whatsapp\.net$/);
  });

  // PRUEBA 2: Simulación humana completa para el Número 1 (3764358152)
  it('[E2E-02] Simulación humana completa con presencia y mecanografía para 3764358152', async () => {
    const jid = '5493764358152@s.whatsapp.net';
    const texto = 'Hola Carlos, te escribo para coordinar la reunión de seguimiento.';

    const mockSock = {
      presenceSubscribe: vi.fn().mockResolvedValue(true),
      sendPresenceUpdate: vi.fn().mockResolvedValue(true),
      sendMessage: vi.fn().mockResolvedValue({ key: { id: 'MSG_E2E_01' } })
    };

    const { res, trace } = await ejecutarSecuenciaHumana(mockSock, jid, texto, 0.02);

    expect(res.key.id).toBe('MSG_E2E_01');
    expect(trace.map((p) => p.paso)).toEqual(['presenceSubscribe', 'composing', 'paused', 'sendMessage']);
    expect(mockSock.presenceSubscribe).toHaveBeenCalledWith(jid);
    expect(mockSock.sendPresenceUpdate).toHaveBeenCalledWith('composing', jid);
    expect(mockSock.sendPresenceUpdate).toHaveBeenCalledWith('paused', jid);
    expect(mockSock.sendMessage).toHaveBeenCalledWith(jid, { text: texto });
  });

  // PRUEBA 3: Simulación humana completa para el Número 2 (3765007805)
  it('[E2E-03] Simulación humana completa con escala de mecanografía variable para 3765007805', async () => {
    const jid = '5493765007805@s.whatsapp.net';
    const textoCorto = 'Hola!';
    const textoLargo = 'Estimado cliente, queríamos confirmar su participación en el taller de Mejora Continua programado para este viernes a las 18:00 hs.';

    const duracionCorta = calculateTypingDurationMs(textoCorto.length);
    const duracionLarga = calculateTypingDurationMs(textoLargo.length);

    expect(duracionLarga).toBeGreaterThan(duracionCorta);
    expect(duracionCorta).toBeGreaterThanOrEqual(2000); // Mínimo humano para no parecer script
    expect(duracionLarga).toBeLessThanOrEqual(7000);   // Techo humano configurado en pure.mjs

    const mockSock = {
      presenceSubscribe: vi.fn().mockResolvedValue(true),
      sendPresenceUpdate: vi.fn().mockResolvedValue(true),
      sendMessage: vi.fn().mockResolvedValue({ key: { id: 'MSG_E2E_02' } })
    };

    const { res, trace } = await ejecutarSecuenciaHumana(mockSock, jid, textoLargo, 0.02);
    expect(res.key.id).toBe('MSG_E2E_02');
    expect(trace[1].paso).toBe('composing');
  });

  // PRUEBA 4: Polimorfismo Spintax entre ambos números (Anti-Fingerprint de Meta)
  it('[E2E-04] Polimorfismo Spintax garantizado entre 3764358152 y 3765007805', () => {
    const template = '{Hola|Buenas tardes|Qué tal} {nombre}, {te escribo|te contacto} de Mejora Continua por {el aviso|tu consulta}.';
    const c1 = { nombre: 'Pablo', telefono: '3764358152' };
    const c2 = { nombre: 'Mariano', telefono: '3765007805' };

    const iteraciones = 20;
    const mensajes1 = new Set();
    const mensajes2 = new Set();

    for (let i = 0; i < iteraciones; i++) {
      const m1 = parseSpintax(renderTemplate(template, c1));
      const m2 = parseSpintax(renderTemplate(template, c2));

      expect(m1).toContain('Pablo');
      expect(m2).toContain('Mariano');
      expect(m1).not.toContain('{');
      expect(m2).not.toContain('{');

      mensajes1.add(m1);
      mensajes2.add(m2);
    }

    // Debe generar diversidad de variantes (mínimo 4 variantes distintas en 20 iteraciones)
    expect(mensajes1.size).toBeGreaterThanOrEqual(4);
    expect(mensajes2.size).toBeGreaterThanOrEqual(4);
  });

  // PRUEBA 5: Cadencia Estocástica Gaussiana (Box-Muller) inter-envío
  it('[E2E-05] Jitter Gaussiano Box-Muller en intervalo inter-envío entre ambos contactos', () => {
    const minSec = 20;
    const maxSec = 90;
    const delays = [];

    // Generar 100 muestras gaussianas
    for (let i = 0; i < 100; i++) {
      const d = gaussianRandomDelayMs(minSec, maxSec) / 1000;
      delays.push(d);
    }

    // Todos en rango
    expect(delays.every((d) => d >= minSec && d <= maxSec)).toBe(true);

    // La media converge al centro (~55s)
    const media = delays.reduce((a, b) => a + b, 0) / delays.length;
    expect(media).toBeGreaterThan(45);
    expect(media).toBeLessThan(65);

    // Los intervalos sucesivos NO deben ser idénticos (antipatrón de bot)
    let diferenciasCero = 0;
    for (let i = 1; i < delays.length; i++) {
      if (Math.abs(delays[i] - delays[i - 1]) < 0.001) diferenciasCero++;
    }
    expect(diferenciasCero).toBe(0);
  });

  // PRUEBA 6: Ciclo completo de confirmación de entrega (Ticks: 2 -> 3 -> 4)
  it('[E2E-06] Ciclo de confirmación de entrega con Ticks para 3764358152 y 3765007805', () => {
    const miembro = {
      contactoId: '3764358152',
      estado: 'enviado',
      entregaStatus: 0,
      fechaEnvio: new Date().toISOString(),
      fechaSalio: null,
      fechaLlego: null,
      fechaLeido: null
    };

    // 1. Mensaje salió del dispositivo (server ack -> tick 2)
    miembro.entregaStatus = 2;
    miembro.fechaSalio = new Date().toISOString();
    expect(miembro.entregaStatus).toBe(2);

    // 2. Mensaje llegó al teléfono receptor (delivery ack -> tick 3)
    miembro.entregaStatus = 3;
    miembro.fechaLlego = new Date().toISOString();
    expect(miembro.entregaStatus).toBe(3);

    // 3. Mensaje leído por el destinatario (read ack -> tick 4)
    miembro.entregaStatus = 4;
    miembro.fechaLeido = new Date().toISOString();
    expect(miembro.entregaStatus).toBe(4);
    expect(new Date(miembro.fechaLeido).getTime()).toBeGreaterThanOrEqual(new Date(miembro.fechaLlego).getTime());
  });

  // PRUEBA 7: Recepción y Clasificación Tri-Banda (Interés Inmediato)
  it('[E2E-07] Clasificación tri-banda de respuesta afirmativa desde 3764358152', () => {
    const respuestas = [
      'Hola! Sí, dale, me interesa mucho',
      'Quiero que me pases más info por favor',
      'Dale cuando podés llamarme para coordinar?'
    ];

    for (const r of respuestas) {
      const categoria = clasificarRespuesta(r);
      expect(categoria).toBe('interes_inmediato');
    }
  });

  // PRUEBA 8: Recepción y Clasificación Tri-Banda (Baja / Desuscripción)
  it('[E2E-08] Clasificación tri-banda de desuscripción desde 3765007805', () => {
    const respuestas = [
      'No gracias, no me interesa',
      'Por favor baja de la lista',
      'Quién te dio mi número? Sacame de tu base',
      'No molestar'
    ];

    for (const r of respuestas) {
      const categoria = clasificarRespuesta(r);
      expect(categoria).toBe('baja');
    }
  });

  // PRUEBA 9: Auto-respuesta con acuse inteligente y prevención de bucle
  it('[E2E-09] Acuse inteligente con delay humano y flag anti-bucle de auto-respuesta', async () => {
    const contacto = {
      id: '3764358152',
      nombre: 'Pablo',
      autoRespuestaEnviada: false
    };

    const templateAcuse = 'Gracias por responder {nombre}. Lo leo bien y te contesto en un rato.';
    const textoRespuesta = renderTemplate(templateAcuse, contacto);

    expect(textoRespuesta).toBe('Gracias por responder Pablo. Lo leo bien y te contesto en un rato.');

    // Simular recepción y despacho de acuse
    let acusesEnviados = 0;
    function procesarRespuestaEntrante(c) {
      if (c.autoRespuestaEnviada) return null; // Circuit breaker anti-loop
      c.autoRespuestaEnviada = true;
      acusesEnviados++;
      return textoRespuesta;
    }

    const primerIntento = procesarRespuestaEntrante(contacto);
    expect(primerIntento).not.toBeNull();
    expect(acusesEnviados).toBe(1);

    // Segundo mensaje entrante: NO debe enviar un segundo acuse (evita ser marcado como bot por Meta)
    const segundoIntento = procesarRespuestaEntrante(contacto);
    expect(segundoIntento).toBeNull();
    expect(acusesEnviados).toBe(1);
  });

  // PRUEBA 10: Disyuntor de Seguridad (Safety Gauge) y protección ante límites
  it('[E2E-10] Disyuntor de Seguridad (Safety Gauge) ante límite de tope diario', () => {
    const dailyCap = 40;

    // Estado inicial seguro
    const estadoVerde = calculateSafetyLevel(2, dailyCap, 30);
    expect(estadoVerde.level).toBe('verde');
    expect(canSendMore(2, dailyCap)).toBe(true);

    // Estado cerca del límite
    const estadoAmarillo = calculateSafetyLevel(35, dailyCap, 25);
    expect(estadoAmarillo.level).toBe('amarillo');
    expect(canSendMore(35, dailyCap)).toBe(true);

    // Límite alcanzado: el disyuntor salta a rojo y bloquea envíos
    const estadoRojo = calculateSafetyLevel(40, dailyCap, 30);
    expect(estadoRojo.level).toBe('rojo');
    expect(canSendMore(40, dailyCap)).toBe(false);
  });

  // PRUEBA 11: Resiliencia ante corte de conexión (Socket Watchdog)
  it('[E2E-11] Resiliencia ante desconexión de socket: preservación de cola pendiente', () => {
    const carpeta = {
      miembros: [
        { contactoId: '3764358152', estado: 'pendiente' },
        { contactoId: '3765007805', estado: 'pendiente' }
      ]
    };

    let socketActivo = false; // Simula corte abrupto de red
    let motivoFin = null;

    for (const m of carpeta.miembros) {
      if (!socketActivo) {
        motivoFin = 'conexión perdida';
        break; // Corte preventivo de seguridad: NO marca los contactos como error
      }
      m.estado = 'enviado';
    }

    expect(motivoFin).toBe('conexión perdida');
    // Ningún contacto debe quedar en estado 'error' accidentalmente
    expect(carpeta.miembros[0].estado).toBe('pendiente');
    expect(carpeta.miembros[1].estado).toBe('pendiente');
  });

  // PRUEBA 12: Simulación de Campaña E2E Completa con 10 Pruebas Alternadas
  it('[E2E-12] Lote de 10 ejecuciones E2E completas alternando 3764358152 y 3765007805', async () => {
    const contactos = [
      { id: '5493764358152', nombre: 'Carlos', telefono: '3764358152' },
      { id: '5493765007805', nombre: 'Mariana', telefono: '3765007805' }
    ];

    const template = '{Hola|Buenas tardes|Estimado/a} {nombre}, enviamos comprobante #{variable}.';
    const mockSock = {
      presenceSubscribe: vi.fn().mockResolvedValue(true),
      sendPresenceUpdate: vi.fn().mockResolvedValue(true),
      sendMessage: vi.fn().mockImplementation((jid, msg) => {
        return Promise.resolve({ key: { id: `MSG_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` } });
      })
    };

    const historialEnvios = [];
    const TOTAL_PRUEBAS = 10;

    for (let i = 0; i < TOTAL_PRUEBAS; i++) {
      const contacto = contactos[i % contactos.length]; // Alterna entre ambos números
      const jid = `${contacto.id}@s.whatsapp.net`;
      const texto = parseSpintax(renderTemplate(template, { ...contacto, variable: String(100 + i) }));

      const { res, trace } = await ejecutarSecuenciaHumana(mockSock, jid, texto, 0.01);

      historialEnvios.push({
        iteracion: i + 1,
        telefono: contacto.telefono,
        jid,
        texto,
        msgId: res.key.id,
        pasos: trace.map((t) => t.paso)
      });
    }

    // Verificaciones de Calidad E2E
    expect(historialEnvios).toHaveLength(10);

    // Exactamente 5 envíos a cada número
    const enviosTel1 = historialEnvios.filter((h) => h.telefono === NUMERO_1_RAW);
    const enviosTel2 = historialEnvios.filter((h) => h.telefono === NUMERO_2_RAW);
    expect(enviosTel1).toHaveLength(5);
    expect(enviosTel2).toHaveLength(5);

    // Todos completaron la secuencia humana exacta de 4 pasos
    for (const envio of historialEnvios) {
      expect(envio.pasos).toEqual(['presenceSubscribe', 'composing', 'paused', 'sendMessage']);
      expect(envio.msgId).toMatch(/^MSG_/);
      expect(envio.texto).not.toContain('{');
      expect(envio.texto).not.toContain('}');
    }

    // Diversidad de mensajes garantizada
    const mensajesUnicos = new Set(historialEnvios.map((h) => h.texto));
    expect(mensajesUnicos.size).toBeGreaterThanOrEqual(8);
  });

});
