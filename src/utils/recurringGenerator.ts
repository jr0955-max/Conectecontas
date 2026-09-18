import { FinancialAccount, AccountType, AccountStatus } from '../types';

export interface InstallmentConfig {
  empresa_id: number;
  tipo: AccountType;
  descricao: string;
  totalParcelas: number; // e.g. 12
  valorCalculoTipo: 'total' | 'parcela'; // se o valor informado é o total a dividir ou o valor de cada parcela
  valorInformado: number;
  dataPrimeiroVencimento: string; // YYYY-MM-DD
  categoria?: string;
  banco_id?: number;
  centro_custo_id?: number;
  observacoes?: string;
  statusInicial?: AccountStatus;
  usuario_nome?: string;
}

export interface RecurringConfig {
  empresa_id: number;
  tipo: AccountType;
  descricao: string;
  valor: number;
  dataPrimeiroVencimento: string; // YYYY-MM-DD
  frequencia: 'mensal' | 'semanal' | 'quinzenal' | 'anual';
  repeticoes: number; // e.g. 12 meses
  categoria?: string;
  banco_id?: number;
  centro_custo_id?: number;
  observacoes?: string;
  statusInicial?: AccountStatus;
  usuario_nome?: string;
}

/**
 * Calculates next date based on frequency and interval index
 */
export function calculateNextDate(startDateStr: string, index: number, frequency: 'mensal' | 'semanal' | 'quinzenal' | 'anual'): string {
  const [yearStr, monthStr, dayStr] = startDateStr.split('-');
  const baseYear = parseInt(yearStr, 10);
  const baseMonth = parseInt(monthStr, 10) - 1; // 0-indexed
  const baseDay = parseInt(dayStr, 10);

  if (frequency === 'mensal') {
    const targetDate = new Date(baseYear, baseMonth + index, 1);
    // Find last day of target month to prevent overflow (e.g. Jan 31 -> Feb 28)
    const lastDayOfTargetMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
    const actualDay = Math.min(baseDay, lastDayOfTargetMonth);
    const result = new Date(targetDate.getFullYear(), targetDate.getMonth(), actualDay);
    return formatDate(result);
  }

  if (frequency === 'semanal') {
    const d = new Date(baseYear, baseMonth, baseDay);
    d.setDate(d.getDate() + (index * 7));
    return formatDate(d);
  }

  if (frequency === 'quinzenal') {
    const d = new Date(baseYear, baseMonth, baseDay);
    d.setDate(d.getDate() + (index * 15));
    return formatDate(d);
  }

  if (frequency === 'anual') {
    const targetDate = new Date(baseYear + index, baseMonth, 1);
    const lastDayOfTargetMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
    const actualDay = Math.min(baseDay, lastDayOfTargetMonth);
    const result = new Date(targetDate.getFullYear(), targetDate.getMonth(), actualDay);
    return formatDate(result);
  }

  return startDateStr;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Generates an array of accounts for an installment schedule (e.g. 1/12, 2/12 ... 12/12)
 */
export function generateInstallmentAccounts(config: InstallmentConfig): Omit<FinancialAccount, 'id'>[] {
  const {
    empresa_id,
    tipo,
    descricao,
    totalParcelas,
    valorCalculoTipo,
    valorInformado,
    dataPrimeiroVencimento,
    categoria = 'Geral',
    banco_id,
    centro_custo_id,
    observacoes,
    statusInicial = 'Pendente',
    usuario_nome = 'Sistema',
  } = config;

  if (totalParcelas <= 0) return [];

  const recorrencia_id = `rec_parc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const accounts: Omit<FinancialAccount, 'id'>[] = [];

  let valorParcelaIndividual = 0;
  let valorResidualUltimaParcela = 0;

  if (valorCalculoTipo === 'total') {
    // Total divided by N with rounding
    valorParcelaIndividual = Math.round((valorInformado / totalParcelas) * 100) / 100;
    const somaCalculada = valorParcelaIndividual * totalParcelas;
    const diferenca = Math.round((valorInformado - somaCalculada) * 100) / 100;
    valorResidualUltimaParcela = valorParcelaIndividual + diferenca;
  } else {
    // Exact installment value specified
    valorParcelaIndividual = valorInformado;
    valorResidualUltimaParcela = valorInformado;
  }

  for (let i = 1; i <= totalParcelas; i++) {
    const isLast = i === totalParcelas;
    const valorItem = isLast ? valorResidualUltimaParcela : valorParcelaIndividual;
    const dataVenc = calculateNextDate(dataPrimeiroVencimento, i - 1, 'mensal');

    accounts.push({
      empresa_id,
      tipo,
      descricao: `${descricao} (${i}/${totalParcelas})`,
      valor: valorItem,
      data_vencimento: dataVenc,
      status: statusInicial,
      categoria,
      banco_id: banco_id ? Number(banco_id) : undefined,
      centro_custo_id: centro_custo_id ? Number(centro_custo_id) : undefined,
      observacoes: observacoes ? `${observacoes} [Parcelamento ${i}/${totalParcelas}]` : `Parcela ${i} de ${totalParcelas}`,
      parcela_atual: i,
      total_parcelas: totalParcelas,
      recorrencia_id,
      recorrencia_tipo: 'parcelado',
      criado_por: usuario_nome,
      criado_em: new Date().toISOString(),
      excluido: false,
    });
  }

  return accounts;
}

/**
 * Generates an array of accounts for a fixed recurring frequency schedule (e.g. Monthly rent for 12 months)
 */
export function generateRecurringAccounts(config: RecurringConfig): Omit<FinancialAccount, 'id'>[] {
  const {
    empresa_id,
    tipo,
    descricao,
    valor,
    dataPrimeiroVencimento,
    frequencia,
    repeticoes,
    categoria = 'Geral',
    banco_id,
    centro_custo_id,
    observacoes,
    statusInicial = 'Pendente',
    usuario_nome = 'Sistema',
  } = config;

  if (repeticoes <= 0) return [];

  const recorrencia_id = `rec_fix_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const accounts: Omit<FinancialAccount, 'id'>[] = [];

  for (let i = 0; i < repeticoes; i++) {
    const dataVenc = calculateNextDate(dataPrimeiroVencimento, i, frequencia);
    const frequenciaLabel = frequencia === 'mensal' ? 'Mês' : frequencia === 'semanal' ? 'Semana' : frequencia === 'quinzenal' ? 'Quinzena' : 'Ano';

    accounts.push({
      empresa_id,
      tipo,
      descricao: repeticoes > 1 ? `${descricao} (${i + 1}/${repeticoes})` : descricao,
      valor: Number(valor),
      data_vencimento: dataVenc,
      status: statusInicial,
      categoria,
      banco_id: banco_id ? Number(banco_id) : undefined,
      centro_custo_id: centro_custo_id ? Number(centro_custo_id) : undefined,
      observacoes: observacoes ? `${observacoes} [Recorrência ${frequenciaLabel} ${i + 1}/${repeticoes}]` : `Recorrência ${frequencia} ${i + 1}/${repeticoes}`,
      parcela_atual: i + 1,
      total_parcelas: repeticoes,
      recorrencia_id,
      recorrencia_tipo: frequencia,
      criado_por: usuario_nome,
      criado_em: new Date().toISOString(),
      excluido: false,
    });
  }

  return accounts;
}
