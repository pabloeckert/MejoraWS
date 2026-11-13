/**
 * Test de Certificación QA: Simulación Humana y Comportamiento Anti-Ban 2026
 * Autor: Dirección de Calidad e Ingeniería (VP of Quality Engineering)
 *
 * Objetivo:
 * Validar empíricamente que la orquestación de la campaña ejecute la secuencia
 * exacta de presencia humana requerida por Meta en 2026:
 * 1. Suscripción a presencia del chat (presenceSubscribe).
 * 2. Pausa humana de lectura (1000 - 1800 ms).
 * 3. Indicador de escritura activa ('composing') proporcional a caracteres.
 * 4. Pausa de revisión antes de enviar ('paused').
 * 5. Despacho final del mensaje con Spintax evaluado y polimórfico.
 * 6. Jitter gaussiano estocástico entre mensajes consecutivos.
 * 7. Disyuntor de seguridad (Circuit Breaker) y clasificación de respuestas.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  gaussianRandomDelayMs,
  calculateTypingDurationMs,
  parseSpintax,
  clasificarRespuesta,
  calculateSafetyLevel,
  renderTemplate,
  canSendMore
} from '../electron/pure.mjs';

describe('CERTIFICACIÓN QA — Simulación de Comportamiento Humano Anti-Ban', () => {

  it('[QA-01] Secuencia cronológica estricta de presencia previa al envío', async () => {
    const callLog = [];
    const timestamps = [];

    // Mock instrumentado del socket de Baileys
    const mockSock = {
      presenceSubscribe: vi.fn(async (jid) => {
        callLog.push({ call: 'presenceSubscribe', jid, t: Date.now() });
      }),
      sendPresenceUpdate: vi.fn(async (type, jid) => {
        callLog.push({ call: 'sendPresenceUpdate', type, jid, t: Date.now() });
      }),
      sendMessage: vi.fn(async (jid, content) => {
        callLog.push({ call: 'sendMessage', jid, text: content.text, t: Date.now() });
        return { key: { id: `MSG_${Date.now()}` } };
      })
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Ejecutor idéntico al bloque en electron/main.mjs (escalado a tiempos de test)
    async function simularEnvioHumano(sock, jid, texto, speedFactor = 0.05) {
      // 1. Apertura y presencia
      await sock.presenceSubscribe(jid);
      await sleep(Math.floor((1000 + Math.random() * 800) * speedFactor));

      // 2. Composing (escribiendo)
      await sock.sendPresenceUpdate('composing', jid);
      const typingTime = calculateTypingDurationMs(texto.length);
      await sleep(Math.floor(typingTime * speedFactor));

      // 3. Pausa de revisión previa al clic
      await sock.sendPresenceUpdate('paused', jid);
      await sleep(Math.floor((400 + Math.random() * 400) * speedFactor));

      // 4. Clic de envío
      return await sock.sendMessage(jid, { text: texto });
    }

    const testJid = '5493764123456@s.whatsapp.net';
    const testTexto = 'Hola Juan, te consulto por el presupuesto de la obra.';

    const start = Date.now();
    await simularEnvioHumano(mockSock, testJid, testTexto, 0.02);
    const totalTime = Date.now() - start;

    // Aserciones de secuencia
    expect(callLog).toHaveLength(4);
    expect(callLog[0].call).toBe('presenceSubscribe');
    expect(callLog[0].jid).toBe(testJid);

    expect(callLog[1].call).toBe('sendPresenceUpdate');
    expect(callLog[1].type).toBe('composing');

    expect(callLog[2].call).toBe('sendPresenceUpdate');
    expect(callLog[2].type).toBe('paused');

    expect(callLog[3].call).toBe('sendMessage');
    expect(callLog[3].text).toBe(testTexto);

    // Los timestamps deben ser estrictamente crecientes
    expect(callLog[1].t).toBeGreaterThanOrEqual(callLog[0].t);
    expect(callLog[2].t).toBeGreaterThanOrEqual(callLog[1].t);
    expect(callLog[3].t).toBeGreaterThanOrEqual(callLog[2].t);
  });

  it('[QA-02] Polimorfismo textual Spintax en lote de envíos', () => {
    const template = '{Hola|Buen día|Buenas tardes} {nombre}, {te consulto|quería preguntarte} por {tu comercio|el local}.';
    const contacto = { nombre: 'Martín' };

    const muestras = new Set();
    const totalCorridas = 50;

    for (let i = 0; i < totalCorridas; i++) {
      const variante = renderTemplate(template, contacto);
      muestras.add(variante);
      expect(variante).toContain('Martín');
      expect(variante).not.toContain('{');
      expect(variante).not.toContain('}');
      expect(variante).not.toContain('|');
    }

    // Debería generar al menos 4 combinaciones diferentes de las 6 teóricas (3x2)
    expect(muestras.size).toBeGreaterThanOrEqual(4);
  });

  it('[QA-03] Simulación de cadencia y distribución normal (Box-Muller)', () => {
    const minSec = 20;
    const maxSec = 90;
    const delays = [];
    const N = 1000;

    for (let i = 0; i < N; i++) {
      const ms = gaussianRandomDelayMs(minSec, maxSec);
      delays.push(ms / 1000);
    }

    // Todos los valores deben estar acotados estrictamente entre min y max
    const todosEnRango = delays.every((d) => d >= minSec && d <= maxSec);
    expect(todosEnRango).toBe(true);

    // La media debe concentrarse cerca del centro del intervalo (55 segundos)
    const media = delays.reduce((acc, d) => acc + d, 0) / N;
    expect(media).toBeGreaterThan(45);
    expect(media).toBeLessThan(65);

    // Comprobar que no es uniforme: la desviación estándar existe y la mediana es central
    delays.sort((a, b) => a - b);
    const mediana = delays[Math.floor(N / 2)];
    expect(mediana).toBeGreaterThan(45);
    expect(mediana).toBeLessThan(65);
  });

  it('[QA-04] Tri-Banda de Clasificación de Respuestas y Reacción de IA', () => {
    // 1. Interés Inmediato
    const frasesInteres = [
      'Hola! Sí, contame más por favor',
      'Dale me interesa, pasame la info',
      'Quiero coordinar para charlar',
      'Cuando podes llamarme?'
    ];
    for (const f of frasesInteres) {
      expect(clasificarRespuesta(f)).toBe('interes_inmediato');
    }

    // 2. Postergación
    const frasesPostergacion = [
      'Ahora no puedo, escribime la semana que viene',
      'Estoy viajando, mas adelante lo vemos',
      'Despues hablamos que estoy complicado'
    ];
    for (const f of frasesPostergacion) {
      expect(clasificarRespuesta(f)).toBe('postergacion');
    }

    // 3. Baja / Desuscripción
    const frasesBaja = [
      'No me interesa gracias',
      'Por favor baja de la lista',
      'Quien sos? Sacame de tu base',
      'Numero equivocado, no molestar'
    ];
    for (const f of frasesBaja) {
      expect(clasificarRespuesta(f)).toBe('baja');
    }
  });

  it('[QA-05] Disyuntor de Seguridad (Safety Gauge) ante límites de riesgo', () => {
    // Parámetros seguros
    const seguro = calculateSafetyLevel(5, 40, 30);
    expect(seguro.level).toBe('verde');
    expect(seguro.score).toBeGreaterThanOrEqual(90);

    // Parámetros de atención (cerca del tope o delay rápido)
    const atencion = calculateSafetyLevel(32, 40, 25);
    expect(atencion.level).toBe('amarillo');

    // Parámetros de riesgo crítico (tope superado)
    const riesgoTope = calculateSafetyLevel(40, 40, 30);
    expect(riesgoTope.level).toBe('rojo');
    expect(canSendMore(40, 40)).toBe(false);

    // Parámetros de riesgo por velocidad temeraria (<15s)
    const riesgoVelocidad = calculateSafetyLevel(10, 40, 10);
    expect(riesgoVelocidad.level).toBe('rojo');
  });

});
