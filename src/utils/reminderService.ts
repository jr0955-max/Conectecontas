import { FinancialAccount, Company, ReminderSettings, ReminderItem, DEFAULT_REMINDER_SETTINGS, FinancialNotepadState, FinancialNoteItem } from '../types';

export const DEFAULT_FINANCIAL_NOTEPAD: FinancialNotepadState = {
  itens: [
    {
      id: 'default-note-1',
      empresa_id: 1,
      descricao: 'MINHA CASA MINHA VIDA',
      valor: 485.50,
      dataVencimentoAproximada: 'Dia 10',
      destaqueVerde: true,
      concluido: false,
      observacao: 'Prestação do financiamento habitacional',
      categoriaSugerida: 'Habitação',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    },
    {
      id: 'default-note-2',
      empresa_id: 1,
      descricao: 'PREVIDENCIA',
      valor: 320.00,
      dataVencimentoAproximada: 'Dia 15',
      destaqueVerde: true,
      concluido: false,
      observacao: 'Aporte mensal planejado',
      categoriaSugerida: 'Investimentos',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    },
    {
      id: 'default-note-3',
      empresa_id: 1,
      descricao: 'CARTAO DE CREDITO',
      valor: 1250.00,
      dataVencimentoAproximada: 'Dia 20',
      destaqueVerde: true,
      concluido: false,
      observacao: 'Fatura do cartão de compras do mês',
      categoriaSugerida: 'Cartão de Crédito',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    },
  ],
  textoLivre: 'Bloco de Notas Financeiro - Digite contas que você lembrar para não esquecer!\nQuando for o momento, use o botão "Lançar" para enviar diretamente ao Contas a Pagar.',
  ultimaAtualizacao: new Date().toISOString(),
};

export function getNotepadStorageKey(userId?: number): string {
  return userId ? `financial_notepad_state_user_${userId}` : 'financial_notepad_state_default';
}

export function loadFinancialNotepadState(userId?: number): FinancialNotepadState {
  if (typeof window === 'undefined') return DEFAULT_FINANCIAL_NOTEPAD;
  try {
    const raw = localStorage.getItem(getNotepadStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.itens)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Erro ao carregar bloco de notas financeiro:', e);
  }
  return DEFAULT_FINANCIAL_NOTEPAD;
}

export function saveFinancialNotepadState(state: FinancialNotepadState, userId?: number): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getNotepadStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    console.warn('Erro ao salvar bloco de notas financeiro:', e);
  }
}

/**
 * Filtra as anotações do bloco de notas para uma empresa específica
 */
export function getNotesForCompany(state: FinancialNotepadState, companyId?: number): FinancialNoteItem[] {
  if (!state || !Array.isArray(state.itens)) return [];
  if (!companyId || companyId === -1) return state.itens;
  return state.itens.filter((item) => Number(item.empresa_id || 1) === Number(companyId));
}

/**
 * Avalia se uma anotação possui vencimento próximo ou vencendo hoje
 */
export function checkNoteReminderStatus(dataAprox?: string, diasAntecedencia: number = 3): {
  isAlert: boolean;
  label: string;
  badgeClass: string;
  urgencia: 'atrasado' | 'hoje' | 'proximo' | null;
  diffDays: number;
} | null {
  if (!dataAprox) return null;
  const clean = dataAprox.trim();
  const now = new Date();
  const currentDay = now.getDate();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let targetDate: Date | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-').map(Number);
    targetDate = new Date(y, m - 1, d, 0, 0, 0, 0);
  } else {
    const diaMatch = clean.match(/\d{1,2}/);
    if (diaMatch) {
      const dia = parseInt(diaMatch[0], 10);
      if (dia >= 1 && dia <= 31) {
        targetDate = new Date(currentYear, currentMonth, dia, 0, 0, 0, 0);
      }
    }
  }

  if (!targetDate) return null;

  const today = new Date(currentYear, currentMonth, currentDay, 0, 0, 0, 0);
  const diffDays = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return {
      isAlert: true,
      urgencia: 'hoje',
      diffDays,
      label: 'Vence Hoje!',
      badgeClass: 'bg-amber-100 text-amber-900 dark:bg-amber-950/90 dark:text-amber-200 border-amber-400 dark:border-amber-700 animate-pulse font-extrabold',
    };
  } else if (diffDays > 0 && diffDays <= diasAntecedencia) {
    return {
      isAlert: true,
      urgencia: 'proximo',
      diffDays,
      label: `Vence em ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`,
      badgeClass: 'bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-200 border-blue-300 dark:border-blue-700 font-bold',
    };
  } else if (diffDays < 0 && diffDays >= -5) {
    return {
      isAlert: false,
      urgencia: 'atrasado',
      diffDays,
      label: `Venceu há ${Math.abs(diffDays)} dias`,
      badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-semibold',
    };
  }

  return null;
}


/**
 * Retorna a diferença em dias corridos entre a data de vencimento e a data atual (zerando horas).
 * Retorna:
 * < 0 : Atrasada (ex: -1 = ontem)
 * = 0 : Vence hoje
 * > 0 : Vence no futuro (ex: 2 = em 2 dias)
 */
export function getDaysDifference(dueDateStr: string): number {
  if (!dueDateStr) return 999;
  const parts = dueDateStr.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return 999;
  
  // Data de vencimento no fuso horário local
  const due = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  
  // Hoje no fuso horário local
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  
  const diffTime = due.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Filtra e classifica as contas a pagar que necessitam de alerta com base nas configurações do usuário.
 */
export function calculateReminders(
  accounts: FinancialAccount[],
  settings: ReminderSettings,
  companies: Company[] = []
): ReminderItem[] {
  if (!settings.enabled) return [];

  const companyMap = new Map<number, string>();
  companies.forEach((c) => {
    companyMap.set(Number(c.id), c.nome);
  });

  const reminders: ReminderItem[] = [];

  // Consideramos apenas contas do tipo 'pagar', que estão 'Pendente' e não foram excluídas
  const pendingBills = accounts.filter(
    (a) => a.tipo === 'pagar' && a.status === 'Pendente' && !a.excluido
  );

  for (const account of pendingBills) {
    const diff = getDaysDifference(account.data_vencimento);
    let urgencia: 'atrasado' | 'hoje' | 'proximo' | null = null;

    if (diff < 0) {
      if (settings.avisar_em_atraso) {
        urgencia = 'atrasado';
      }
    } else if (diff === 0) {
      if (settings.avisar_vencendo_hoje) {
        urgencia = 'hoje';
      }
    } else if (diff > 0 && diff <= settings.dias_antecedencia) {
      if (settings.avisar_com_antecedencia) {
        urgencia = 'proximo';
      }
    }

    if (urgencia) {
      reminders.push({
        account,
        diasAteVencimento: diff,
        urgencia,
        empresaNome: companyMap.get(Number(account.empresa_id)),
      });
    }
  }

  // Ordenação: 
  // 1. Atrasadas primeiro (mais antigas primeiro)
  // 2. Vencendo hoje
  // 3. Vencendo nos próximos dias (ordem crescente de dias)
  reminders.sort((a, b) => {
    return a.diasAteVencimento - b.diasAteVencimento;
  });

  return reminders;
}

/**
 * Toca um som suave de alerta financeiro usando Web Audio API nativa.
 * Não requer arquivos externos e roda perfeitamente em qualquer navegador.
 */
export function playReminderChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Tom 1: Re5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.001, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Tom 2: La5 (880.00 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, ctx.currentTime + 0.12);
    gain2.gain.setValueAtTime(0.001, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.6);
  } catch (e) {
    // Interações iniciais podem ser bloqueadas até o usuário interagir com a tela
  }
}

/**
 * Solicita autorização para Notificações do Navegador
 */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return await Notification.requestPermission();
}

/**
 * Dispara uma notificação nativa do sistema operacional / navegador
 */
export function sendBrowserNotification(title: string, body: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
      });
    } catch (e) {
      console.debug('Aviso ao disparar notificação:', e);
    }
  }
}

/**
 * Chave de armazenamento no localStorage
 */
export function getReminderStorageKey(userId?: number): string {
  return `fin_reminder_settings_${userId || 'default'}`;
}

/**
 * Carrega as preferências de lembrete do usuário
 */
export function loadReminderSettings(userId?: number): ReminderSettings {
  if (typeof window === 'undefined') return DEFAULT_REMINDER_SETTINGS;
  try {
    const key = getReminderStorageKey(userId);
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_REMINDER_SETTINGS,
        ...parsed,
        dias_antecedencia: Math.max(1, Math.min(60, Number(parsed.dias_antecedencia) || 3)),
      };
    }
  } catch (e) {
    console.warn('Erro ao carregar configurações de lembrete:', e);
  }
  return DEFAULT_REMINDER_SETTINGS;
}

/**
 * Salva as preferências de lembrete do usuário
 */
export function saveReminderSettings(settings: ReminderSettings, userId?: number): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getReminderStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(settings));
  } catch (e) {
    console.warn('Erro ao salvar configurações de lembrete:', e);
  }
}

/**
 * Formata descrição da urgência de um lembrete em português amigável
 */
export function formatReminderDueDate(diff: number, dateStr: string): { label: string; badgeClass: string } {
  const [y, m, d] = dateStr.split('-');
  const formattedDate = `${d}/${m}/${y}`;

  if (diff < 0) {
    const absDiff = Math.abs(diff);
    return {
      label: absDiff === 1 ? 'Venceu ontem' : `Venceu há ${absDiff} dias (${formattedDate})`,
      badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800',
    };
  }

  if (diff === 0) {
    return {
      label: `Vence Hoje! (${formattedDate})`,
      badgeClass: 'bg-amber-100 text-amber-900 dark:bg-amber-950/90 dark:text-amber-200 border-amber-400 dark:border-amber-700 animate-pulse',
    };
  }

  if (diff === 1) {
    return {
      label: `Vence amanhã (${formattedDate})`,
      badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-300 dark:border-blue-800',
    };
  }

  return {
    label: `Vence em ${diff} dias (${formattedDate})`,
    badgeClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  };
}
