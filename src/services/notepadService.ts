import { FinancialNotepadState, ReminderSettings } from '../types';

/**
 * Consulta o Bloco de Notas Financeiro persistido no servidor.
 * Sincroniza em tempo real entre DuckDNS, IP local (192.168.x.x), Celular e Desktop.
 */
export async function fetchServerNotepad(tenantId?: number, userId?: number): Promise<FinancialNotepadState | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const params = new URLSearchParams();
    if (tenantId) params.set('tenant_id', String(tenantId));
    if (userId) params.set('user_id', String(userId));

    const res = await fetch(`/api/financial-notepad?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-tenant-id': String(tenantId || 1),
        'x-user-id': String(userId || ''),
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && json.notepad && Array.isArray(json.notepad.itens)) {
      return json.notepad;
    }
    return null;
  } catch (err) {
    console.warn('[notepadService] Erro ao buscar bloco de notas do servidor:', err);
    return null;
  }
}

/**
 * Salva o Bloco de Notas Financeiro no servidor central Node.js.
 * Garante que qualquer exclusão, edição ou inserção reflita imediatamente em todas as URLs/dispositivos.
 */
export async function saveServerNotepad(
  notepad: FinancialNotepadState,
  tenantId?: number,
  userId?: number
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('/api/financial-notepad', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': String(tenantId || 1),
        'x-user-id': String(userId || ''),
      },
      signal: controller.signal,
      body: JSON.stringify({
        notepad,
        tenantId: tenantId || 1,
        userId: userId || null,
      }),
    });
    clearTimeout(timeout);
    return res.ok;
  } catch (err) {
    console.warn('[notepadService] Erro ao salvar bloco de notas no servidor:', err);
    return false;
  }
}

/**
 * Consulta as configurações de Lembretes Financeiros salvas no servidor.
 */
export async function fetchServerReminderSettings(tenantId?: number, userId?: number): Promise<ReminderSettings | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const params = new URLSearchParams();
    if (tenantId) params.set('tenant_id', String(tenantId));
    if (userId) params.set('user_id', String(userId));

    const res = await fetch(`/api/reminder-settings?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-tenant-id': String(tenantId || 1),
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && json.settings) {
      return json.settings;
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Salva as configurações de Lembretes Financeiros no servidor central.
 */
export async function saveServerReminderSettings(
  settings: ReminderSettings,
  tenantId?: number,
  userId?: number
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('/api/reminder-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': String(tenantId || 1),
      },
      signal: controller.signal,
      body: JSON.stringify({
        settings,
        tenantId: tenantId || 1,
        userId: userId || null,
      }),
    });
    clearTimeout(timeout);
    return res.ok;
  } catch (err) {
    return false;
  }
}
