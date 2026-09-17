import { describe, it, expect } from 'vitest';
import { obtenerContactos, reportarInteraccion } from './contactosService';

describe('contactosService (Integración MejoraWS -> contactos-api)', () => {
  it('debe obtener contactos exitosamente desde contactos-api', async () => {
    const respuesta = await obtenerContactos();
    expect(respuesta).toBeDefined();
    expect(respuesta.total).toBeGreaterThan(0);
    expect(Array.isArray(respuesta.contactos)).toBe(true);

    const testCaptura = respuesta.contactos.find((c) => c.nombre === 'Test Captura');
    expect(testCaptura).toBeDefined();
    expect(testCaptura?.emails).toContain('test@mejora.com');
  });

  it('debe reportar una interacción correctamente con status 201/200', async () => {
    const resultado = await reportarInteraccion({
      numero: '+5493764000000',
      nombre: 'Test Captura',
      estado_respuesta: 'respondido',
      mensaje: 'Prueba de sincronización horizontal MejoraWS',
    });

    expect(resultado).toBeDefined();
    expect(resultado.persona_id).toBeDefined();
  });
});
