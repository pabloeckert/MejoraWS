import { describe, it, expect, vi } from 'vitest';
import { formatToJid, type Contact } from '@mejoraws/shared';
import {
  DashboardApiClient,
  contactsToCsv,
  estimateSmartDripWindow,
  getAIModeBadge,
  getSenderBadge,
} from '../api/dashboardClient.js';

const TEST_PHONE_1 = '3764358152';
const TEST_PHONE_2 = '3765007805';
const TEST_JID_1 = formatToJid(TEST_PHONE_1);
const TEST_JID_2 = formatToJid(TEST_PHONE_2);

describe('Dashboard UI — Lógica Operativa y Cliente API v1 (PRD v1.0 Paso 4)', () => {
  it('1. Inbox Unificado: genera las etiquetas de emisor correctas ([Contacto], [Contacto · Difusión], [IA · Retención], [Tú - Celular], [Tú - Web / Celular], [Sistema · Smart Drip])', () => {
    expect(
      getSenderBadge({
        direction: 'INBOUND',
        sender_type: 'CONTACT',
        is_broadcast: false,
        body: 'Hola, consulto por el servicio',
      })
    ).toMatchObject({
      label: '[Contacto]',
      align: 'left',
    });

    expect(
      getSenderBadge({
        direction: 'INBOUND',
        sender_type: 'CONTACT',
        is_broadcast: true,
        body: 'Respondiendo a difusión',
      })
    ).toMatchObject({
      label: '[Contacto · Difusión]',
      align: 'left',
    });

    expect(
      getSenderBadge({
        direction: 'OUTBOUND',
        sender_type: 'AI_AGENT',
        is_broadcast: false,
        body: '¡Hola! Claro, contame qué estás buscando.',
      })
    ).toMatchObject({
      label: '[IA · Retención]',
      align: 'right',
    });

    expect(
      getSenderBadge({
        direction: 'OUTBOUND',
        sender_type: 'HUMAN_OWNER',
        is_broadcast: false,
        body: '[Mensaje desde celular físico] Te llamo en 5 minutos.',
      })
    ).toMatchObject({
      label: '[Tú - Celular]',
      align: 'right',
    });

    expect(
      getSenderBadge({
        direction: 'OUTBOUND',
        sender_type: 'HUMAN_OWNER',
        is_broadcast: false,
        body: 'Respondido directamente desde el panel web.',
      })
    ).toMatchObject({
      label: '[Tú - Web / Celular]',
      align: 'right',
    });

    expect(
      getSenderBadge({
        direction: 'OUTBOUND',
        sender_type: 'SYSTEM_API',
        is_broadcast: false,
        body: 'Recordatorio automático Smart Drip',
      })
    ).toMatchObject({
      label: '[Sistema · Smart Drip]',
      align: 'right',
    });
  });

  it('2. Máquina de Estados IA: provee badges consistentes para AI_RETENTION, HUMAN_TAKEOVER y MUTED', () => {
    const ai = getAIModeBadge('AI_RETENTION');
    const human = getAIModeBadge('HUMAN_TAKEOVER');
    const muted = getAIModeBadge('MUTED');

    expect(ai.code).toBe('AI_RETENTION');
    expect(ai.label).toContain('IA Retención Activa');

    expect(human.code).toBe('HUMAN_TAKEOVER');
    expect(human.label).toContain('Control Humano');

    expect(muted.code).toBe('MUTED');
    expect(muted.label).toContain('Silenciado');
  });

  it('3. Estimador Smart Drip: calcula pausas de lote para 20 destinatarios, detecta fuera de SAFE_HOURS (22:00 -> 08:30) y respeta urgent=true', () => {
    const morningLocal = new Date(2026, 10, 20, 9, 0, 0, 0);
    const batchEstimate = estimateSmartDripWindow(
      20,
      morningLocal.toISOString(),
      false,
      '08:30',
      '20:30'
    );

    expect(batchEstimate.recipientCount).toBe(20);
    expect(batchEstimate.batchPausesCount).toBe(1);
    expect(batchEstimate.minTotalSeconds).toBe(117); // 18 * 4 + 1 * 45
    expect(batchEstimate.maxTotalSeconds).toBe(306); // 18 * 12 + 1 * 90
    expect(batchEstimate.outsideSafeHours).toBe(false);
    expect(batchEstimate.effectiveFirstSendAt.getTime()).toBe(
      morningLocal.getTime()
    );

    const lateNightLocal = new Date(2026, 10, 20, 22, 0, 0, 0);
    const clampedEstimate = estimateSmartDripWindow(
      2,
      lateNightLocal.toISOString(),
      false,
      '08:30',
      '20:30'
    );
    expect(clampedEstimate.outsideSafeHours).toBe(true);
    expect(clampedEstimate.effectiveFirstSendAt.getDate()).toBe(21);
    expect(clampedEstimate.effectiveFirstSendAt.getHours()).toBe(8);
    expect(clampedEstimate.effectiveFirstSendAt.getMinutes()).toBe(30);

    const urgentEstimate = estimateSmartDripWindow(
      2,
      lateNightLocal.toISOString(),
      true,
      '08:30',
      '20:30'
    );
    expect(urgentEstimate.outsideSafeHours).toBe(false);
    expect(urgentEstimate.effectiveFirstSendAt.getTime()).toBe(
      lateNightLocal.getTime()
    );
  });

  it('4. Exportación CSV de Libreta y Difusiones: serializa 3764358152 y 3765007805 con encabezados y escape correcto', () => {
    const sampleContacts: Contact[] = [
      {
        id: 'c-1',
        instance_id: 'principal_v1',
        jid: TEST_JID_1,
        phone_number: '5493764358152',
        push_name: 'Prueba Uno',
        address_book_name: 'Misiones, Prueba 1',
        is_in_broadcast: true,
        broadcast_lists: ['difusion_vip@broadcast'],
        ai_mode: 'AI_RETENTION',
        ai_muted_until: null,
        is_whitelisted: true,
        metadata: {},
        last_interaction_at: new Date(),
        created_at: new Date(),
      },
      {
        id: 'c-2',
        instance_id: 'principal_v1',
        jid: TEST_JID_2,
        phone_number: '5493765007805',
        push_name: 'Prueba Dos',
        address_book_name: 'Prueba "2"',
        is_in_broadcast: false,
        broadcast_lists: [],
        ai_mode: 'HUMAN_TAKEOVER',
        ai_muted_until: null,
        is_whitelisted: false,
        metadata: {},
        last_interaction_at: new Date(),
        created_at: new Date(),
      },
    ];

    const csv = contactsToCsv(sampleContacts);
    const lines = csv.split('\n');

    expect(lines[0]).toBe(
      'ID,Telefono,JID,NombreAgenda,NombreWhatsApp,ModoIA,Whitelist,EnDifusion,ListasDifusion'
    );
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain(
      `c-1,5493764358152,${TEST_JID_1},"Misiones, Prueba 1",Prueba Uno,AI_RETENTION,SI,SI,difusion_vip@broadcast`
    );
    expect(lines[2]).toContain(
      `c-2,5493765007805,${TEST_JID_2},"Prueba ""2""",Prueba Dos,HUMAN_TAKEOVER,NO,NO,`
    );
  });

  it('5. DashboardApiClient: invoca todos los endpoints /api/v1/* con credenciales, headers x-api-key y payloads esperados', async () => {
    const recordedCalls: Array<{
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: Record<string, unknown>;
    }> = [];

    const mockFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const headers = (init?.headers as Record<string, string>) || {};
        const parsedBody = init?.body
          ? (JSON.parse(String(init.body)) as Record<string, unknown>)
          : undefined;
        recordedCalls.push({
          url,
          method: init?.method || 'GET',
          headers,
          body: parsedBody,
        });
        return new Response(
          JSON.stringify({ ok: true, paused: true, jobs: [], contacts: [] }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    ) as unknown as typeof fetch;

    const client = new DashboardApiClient({
      baseUrl: 'http://localhost:3000',
      fetchImpl: mockFetch,
    });

    await client.login('admin', 'admin_pass_2026');
    client.setApiKey('sk_live_test_key');

    await client.getHealth();
    await client.toggleQueue(true);
    await client.createContact({
      phone: TEST_PHONE_1,
      name: 'Prueba Uno',
      is_whitelisted: true,
    });
    await client.setContactWhitelist('c-3765007805', true);
    await client.setConversationMode('c-3764358152', 'HUMAN_TAKEOVER', 24);
    await client.sendManualReply('c-3764358152', {
      text: 'Te escribo directo desde el panel.',
      contentType: 'TEXT',
    });
    await client.scheduleMessages({
      phones: [TEST_PHONE_1, TEST_PHONE_2],
      text: 'Mensaje Smart Drip',
      scheduledFor: '2026-11-20T12:00:00.000Z',
      urgent: false,
    });
    await client.updateAIConfig({ max_auto_turns: 3 });
    await client.createApiKey('Google Apps Script');

    expect(recordedCalls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST http://localhost:3000/api/v1/auth/login',
      'GET http://localhost:3000/api/v1/system/health',
      'POST http://localhost:3000/api/v1/queue/toggle',
      'POST http://localhost:3000/api/v1/contacts',
      'PATCH http://localhost:3000/api/v1/contacts/c-3765007805/whitelist',
      'POST http://localhost:3000/api/v1/conversations/c-3764358152/mode',
      'POST http://localhost:3000/api/v1/conversations/c-3764358152/messages',
      'POST http://localhost:3000/api/v1/messages/schedule',
      'PUT http://localhost:3000/api/v1/ai/config',
      'POST http://localhost:3000/api/v1/keys',
    ]);

    expect(recordedCalls[0].body).toEqual({
      username: 'admin',
      password: 'admin_pass_2026',
    });
    expect(recordedCalls[1].headers['x-api-key']).toBe('sk_live_test_key');
    expect(recordedCalls[2].body).toEqual({ paused: true });
    expect(recordedCalls[3].body).toEqual({
      phone: TEST_PHONE_1,
      name: 'Prueba Uno',
      is_whitelisted: true,
    });
    expect(recordedCalls[4].body).toEqual({ is_whitelisted: true });
    expect(recordedCalls[5].body).toEqual({
      mode: 'HUMAN_TAKEOVER',
      muteHours: 24,
    });
    expect(recordedCalls[6].body).toEqual({
      text: 'Te escribo directo desde el panel.',
      contentType: 'TEXT',
    });
    expect(recordedCalls[7].body).toEqual({
      phones: [TEST_PHONE_1, TEST_PHONE_2],
      text: 'Mensaje Smart Drip',
      scheduledFor: '2026-11-20T12:00:00.000Z',
      urgent: false,
    });
    expect(recordedCalls[8].body).toEqual({ max_auto_turns: 3 });
    expect(recordedCalls[9].body).toEqual({ label: 'Google Apps Script' });
  });
});
