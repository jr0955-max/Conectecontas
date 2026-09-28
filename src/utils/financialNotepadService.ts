export interface FinancialNoteItem {
  id: string;
  descricao: string; // Ex: "MINHA CASA MINHA VIDA", "PREVIDENCIA", "CARTAO DE CREDITO"
  valor?: number | null; // Ex: 450.00
  dataVencimentoAproximada?: string; // Ex: "15" ou "2026-10-15" ou "Todo dia 10"
  destaqueVerde: boolean; // Destaque marca-texto verde (como visto no bloco de notas)
  concluido?: boolean; // Marcado/concluído
  observacao?: string;
  categoriaSugerida?: string;
  empresa_id?: number;
  criadoEm: string;
  atualizadoEm: string;
  lancadoNoSistema?: boolean;
  contaIdLancada?: number;
}

export interface FinancialNotepadState {
  itens: FinancialNoteItem[];
  textoLivre: string;
  ultimaAtualizacao: string;
}

export function getNotepadStorageKey(userId?: number): string {
  return `conectecontas_financial_notepad_${userId ? `u${userId}` : 'global'}`;
}

export const INITIAL_NOTEPAD_SAMPLE: FinancialNotepadState = {
  itens: [
    {
      id: 'note-sample-1',
      descricao: 'MINHA CASA MINHA VIDA',
      valor: 480.00,
      dataVencimentoAproximada: '15',
      destaqueVerde: true,
      concluido: false,
      observacao: 'Parcela do financiamento habitacional',
      categoriaSugerida: 'Habitação',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    },
    {
      id: 'note-sample-2',
      descricao: 'PREVIDENCIA',
      valor: 350.00,
      dataVencimentoAproximada: '20',
      destaqueVerde: true,
      concluido: false,
      observacao: 'Aporte mensal de previdência privada',
      categoriaSugerida: 'Investimentos',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    },
    {
      id: 'note-sample-3',
      descricao: 'CARTAO DE CREDITO',
      valor: 1250.00,
      dataVencimentoAproximada: '10',
      destaqueVerde: true,
      concluido: false,
      observacao: 'Fatura fechando dia 05',
      categoriaSugerida: 'Cartão de Crédito',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    },
  ],
  textoLivre: `# Bloco de Notas Financeiro - Contas a Lembrar
• MINHA CASA MINHA VIDA - pagar até dia 15
• PREVIDENCIA - transferência programada dia 20
• CARTAO DE CREDITO - verificar fatura
• Lembrar de solicitar nota fiscal de serviços`,
  ultimaAtualizacao: new Date().toISOString(),
};

/**
 * Carrega o estado do bloco de notas do usuário ou padrão
 */
export function loadFinancialNotepad(userId?: number): FinancialNotepadState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return INITIAL_NOTEPAD_SAMPLE;
  }

  try {
    const key = getNotepadStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) {
      // Fallback para chave legado se existir
      const fallbackRaw = localStorage.getItem('conectecontas_financial_notepad_global');
      if (fallbackRaw) {
        return JSON.parse(fallbackRaw);
      }
      return INITIAL_NOTEPAD_SAMPLE;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.itens)) {
      parsed.itens = [];
    }
    if (typeof parsed.textoLivre !== 'string') {
      parsed.textoLivre = '';
    }
    return parsed;
  } catch (err) {
    console.warn('Erro ao carregar bloco de notas financeiro:', err);
    return INITIAL_NOTEPAD_SAMPLE;
  }
}

/**
 * Salva o estado do bloco de notas no armazenamento local e emite evento
 */
export function saveFinancialNotepad(state: FinancialNotepadState, userId?: number): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    const key = getNotepadStorageKey(userId);
    const updated = {
      ...state,
      ultimaAtualizacao: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(updated));
    // Dispara evento para sincronização em abas ou componentes reativos
    window.dispatchEvent(new CustomEvent('financial_notepad_updated', { detail: updated }));
  } catch (err) {
    console.warn('Erro ao salvar bloco de notas financeiro:', err);
  }
}
