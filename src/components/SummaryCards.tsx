import React from 'react';
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  CalendarDays,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { FinancialAccount } from '../types';

interface SummaryCardsProps {
  accounts: FinancialAccount[];
  isConsolidated?: boolean;
  companiesCount?: number;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ 
  accounts, 
  isConsolidated = false,
  companiesCount = 1 
}) => {
  // Filter only active accounts (excluding soft-deleted)
  const activeAccounts = accounts.filter((a) => !a.excluido);

  // Contas a pagar e receber
  const isPaidStatus = (status: string) => {
    const s = String(status || '').toLowerCase().trim();
    return s === 'pago' || s === 'recebido' || s === 'paid' || s === 'concluido' || s === 'liquidado';
  };

  const isPendenteStatus = (status: string) => {
    const s = String(status || '').toLowerCase().trim();
    return s === 'pendente' || s === 'pending' || s === 'vencido' || s === 'aberto';
  };

  const contasPagar = activeAccounts.filter((a) => a.tipo === 'pagar');
  const contasReceber = activeAccounts.filter((a) => a.tipo === 'receber');

  const totalPagar = contasPagar.reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
  const pagoPagar = contasPagar
    .filter((a) => isPaidStatus(a.status))
    .reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
  const pendentePagar = Math.max(0, totalPagar - pagoPagar);
  const qtdPendentePagar = contasPagar.filter((a) => !isPaidStatus(a.status)).length;

  const totalReceber = contasReceber.reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
  const recebidoReceber = contasReceber
    .filter((a) => isPaidStatus(a.status))
    .reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
  const pendenteReceber = Math.max(0, totalReceber - recebidoReceber);
  const qtdPendenteReceber = contasReceber.filter((a) => !isPaidStatus(a.status)).length;

  const saldoPrevisto = totalReceber - totalPagar;
  const saldoRealizado = recebidoReceber - pagoPagar;

  // Cálculo de meses preenchidos e médias mensais
  const mesesGastos = new Map<string, number>();
  contasPagar.forEach((a) => {
    const mes = a.data_vencimento ? a.data_vencimento.substring(0, 7) : 'Sem data';
    mesesGastos.set(mes, (mesesGastos.get(mes) || 0) + (Number(a.valor) || 0));
  });

  const mesesReceitas = new Map<string, number>();
  contasReceber.forEach((a) => {
    const mes = a.data_vencimento ? a.data_vencimento.substring(0, 7) : 'Sem data';
    mesesReceitas.set(mes, (mesesReceitas.get(mes) || 0) + (Number(a.valor) || 0));
  });

  const todosMeses = Array.from(new Set([...mesesGastos.keys(), ...mesesReceitas.keys()])).filter(
    (m) => m !== 'Sem data'
  );
  const numMeses = todosMeses.length || (accounts.length > 0 ? 1 : 0);

  const mediaMensalGastos = numMeses > 0 ? totalPagar / numMeses : 0;
  const mediaMensalReceitas = numMeses > 0 ? totalReceber / numMeses : 0;

  // Próximos vencimentos
  const proximoVencPagar = contasPagar
    .filter((a) => !isPaidStatus(a.status))
    .sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''))[0]?.data_vencimento;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-4 mb-6">
      
      {/* 1. Main KPI Cards (Clean Minimalism) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        
        {/* Card 1: Saldo Atual em Caixa (Realizado) */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-gray-100 dark:border-slate-800 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                Saldo Atual em Caixa (Realizado)
              </p>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                Efetivo
              </span>
            </div>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              saldoRealizado >= 0 
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' 
                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
            }`}>
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          
          <h2 className={`text-3xl font-bold tracking-tight mt-1 ${
            saldoRealizado >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {formatCurrency(saldoRealizado)}
          </h2>
          
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800/80 flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Receitas Recebidas:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(recebidoReceber)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Despesas Pagas:</span>
              <span className="font-bold text-rose-500 dark:text-rose-400">-{formatCurrency(pagoPagar)}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-dashed border-gray-200 dark:border-slate-800 text-[11px]">
              <span className="text-gray-400">Saldo Projetado (c/ pendentes):</span>
              <span className={`font-semibold ${saldoPrevisto >= 0 ? 'text-gray-700 dark:text-gray-300' : 'text-rose-500'}`}>
                {formatCurrency(saldoPrevisto)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Contas a Receber */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-gray-100 dark:border-slate-800 transition-all">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              Contas a Receber (Total)
            </p>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight mt-1">
            {formatCurrency(totalReceber)}
          </h2>
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800/80 flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Já Recebido (Baixado):</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(recebidoReceber)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Pendente a Receber:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{formatCurrency(pendenteReceber)}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-dashed border-gray-200 dark:border-slate-800 text-[11px] text-gray-400">
              <span>{qtdPendenteReceber} conta(s) pendente(s)</span>
              <span>{contasReceber.length - qtdPendenteReceber} recebida(s)</span>
            </div>
          </div>
        </div>

        {/* Card 3: Contas a Pagar */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-gray-100 dark:border-slate-800 transition-all">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              Contas a Pagar (Total)
            </p>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-500 dark:text-rose-400 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-rose-500 dark:text-rose-400 tracking-tight mt-1">
            {formatCurrency(totalPagar)}
          </h2>
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800/80 flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Já Pago (Baixado):</span>
              <span className="font-bold text-rose-500 dark:text-rose-400">{formatCurrency(pagoPagar)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Pendente de Pagamento:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{formatCurrency(pendentePagar)}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-dashed border-gray-200 dark:border-slate-800 text-[11px] text-gray-400">
              <span>{proximoVencPagar ? `Próximo: ${proximoVencPagar}` : `${qtdPendentePagar} pendente(s)`}</span>
              <span>{contasPagar.length - qtdPendentePagar} paga(s)</span>
            </div>
          </div>
        </div>

      </div>

      {/* 2. Secondary Mini Metrics (Médias Mensais & Meses Analisados) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        
        <div className="bg-white dark:bg-slate-900 p-3.5 px-4 rounded-xl border border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Média Mensal Receitas</p>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 font-mono">{formatCurrency(mediaMensalReceitas)}</p>
            </div>
          </div>
          <span className="text-[11px] text-gray-400 font-medium">/ mês</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 px-4 rounded-xl border border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-500 dark:text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Média Mensal Gastos</p>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 font-mono">{formatCurrency(mediaMensalGastos)}</p>
            </div>
          </div>
          <span className="text-[11px] text-gray-400 font-medium">/ mês</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 px-4 rounded-xl border border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <CalendarDays className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Meses Preenchidos</p>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 font-mono">{numMeses} {numMeses === 1 ? 'mês ativo' : 'meses ativos'}</p>
            </div>
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
            SQLite Sync
          </span>
        </div>

      </div>

    </div>
  );
};
