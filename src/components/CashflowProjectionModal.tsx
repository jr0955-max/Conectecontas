import React, { useState, useMemo } from 'react';
import { 
  FinancialAccount, 
  BankAccount, 
  Company, 
  CashflowDayProjection 
} from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  DollarSign, 
  AlertTriangle, 
  ShieldCheck, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  Filter, 
  X, 
  Download, 
  Building2,
  ChevronRight
} from 'lucide-react';

interface CashflowProjectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  activeCompanyId: number;
  bankAccounts: BankAccount[];
  accounts: FinancialAccount[];
}

export const CashflowProjectionModal: React.FC<CashflowProjectionModalProps> = ({
  isOpen,
  onClose,
  companies,
  activeCompanyId,
  bankAccounts,
  accounts,
}) => {
  const [periodDays, setPeriodDays] = useState<30 | 60 | 90 | 180>(30);
  const [viewMode, setViewMode] = useState<'diario' | 'semanal'>('diario');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(activeCompanyId);

  // Sync selectedCompanyId when activeCompanyId changes
  React.useEffect(() => {
    setSelectedCompanyId(activeCompanyId);
  }, [activeCompanyId]);

  // Calculate Starting Available Balance (Consolidated from bank accounts)
  const saldoInicialDisponivel = useMemo(() => {
    const targetBanks = bankAccounts.filter((b) => 
      selectedCompanyId === 0 || b.empresa_id === selectedCompanyId
    );

    let total = targetBanks.reduce((acc, b) => acc + (Number(b.saldo_inicial) || 0), 0);

    // Add paid accounts up to today
    const todayStr = new Date().toISOString().split('T')[0];
    accounts
      .filter((a) => !a.excluido && (selectedCompanyId === 0 || a.empresa_id === selectedCompanyId))
      .forEach((acc) => {
        if (acc.status === 'Pago') {
          const val = Number(acc.valor) || 0;
          if (acc.tipo === 'receber') total += val;
          else total -= val;
        }
      });

    return total;
  }, [bankAccounts, accounts, selectedCompanyId]);

  // Generate Daily Projections for the selected horizon
  const dailyProjections = useMemo(() => {
    const projections: CashflowDayProjection[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let saldoAcumulado = saldoInicialDisponivel;

    // Filter relevant pending & future accounts
    const relevantAccounts = accounts.filter((a) => {
      if (a.excluido) return false;
      if (selectedCompanyId !== 0 && a.empresa_id !== selectedCompanyId) return false;
      // Include pending accounts (even if overdue, treat as needing settlement) or future paid accounts
      return a.status !== 'Pago';
    });

    // Group accounts by due date
    const mapByDate: Record<string, { entradas: number; saidas: number; items: FinancialAccount[] }> = {};

    relevantAccounts.forEach((acc) => {
      let dateKey = acc.data_vencimento;
      const accDate = new Date(dateKey);
      
      // If overdue in the past, aggregate into today as immediate demand
      if (accDate < today) {
        dateKey = today.toISOString().split('T')[0];
      }

      if (!mapByDate[dateKey]) {
        mapByDate[dateKey] = { entradas: 0, saidas: 0, items: [] };
      }

      const val = Number(acc.valor) || 0;
      if (acc.tipo === 'receber') {
        mapByDate[dateKey].entradas += val;
      } else {
        mapByDate[dateKey].saidas += val;
      }
      mapByDate[dateKey].items.push(acc);
    });

    // Loop through each day from 0 to periodDays
    for (let i = 0; i < periodDays; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];

      const dayData = mapByDate[dateStr] || { entradas: 0, saidas: 0, items: [] };
      const saldoDia = dayData.entradas - dayData.saidas;
      saldoAcumulado += saldoDia;

      projections.push({
        data: dateStr,
        diaSemana: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
        entradas: dayData.entradas,
        saidas: dayData.saidas,
        saldoDia,
        saldoAcumulado,
        contasNoDia: dayData.items,
      });
    }

    return projections;
  }, [saldoInicialDisponivel, accounts, selectedCompanyId, periodDays]);

  // Aggregate weekly projections
  const weeklyProjections = useMemo(() => {
    const weeks: {
      semanaIndex: number;
      periodoLabel: string;
      dataInicio: string;
      dataFim: string;
      entradas: number;
      saidas: number;
      saldoSemana: number;
      saldoFinalSemana: number;
    }[] = [];

    const totalDays = dailyProjections.length;
    for (let i = 0; i < totalDays; i += 7) {
      const chunk = dailyProjections.slice(i, i + 7);
      if (chunk.length === 0) continue;

      const entradas = chunk.reduce((acc, c) => acc + c.entradas, 0);
      const saidas = chunk.reduce((acc, c) => acc + c.saidas, 0);
      const saldoSemana = entradas - saidas;
      const saldoFinalSemana = chunk[chunk.length - 1].saldoAcumulado;

      const start = chunk[0].data.split('-').reverse().slice(0, 2).join('/');
      const end = chunk[chunk.length - 1].data.split('-').reverse().slice(0, 2).join('/');

      weeks.push({
        semanaIndex: Math.floor(i / 7) + 1,
        periodoLabel: `Semana ${Math.floor(i / 7) + 1} (${start} a ${end})`,
        dataInicio: chunk[0].data,
        dataFim: chunk[chunk.length - 1].data,
        entradas,
        saidas,
        saldoSemana,
        saldoFinalSemana,
      });
    }

    return weeks;
  }, [dailyProjections]);

  // Executive Summary Metrics
  const summary = useMemo(() => {
    const totalEntradas = dailyProjections.reduce((acc, d) => acc + d.entradas, 0);
    const totalSaidas = dailyProjections.reduce((acc, d) => acc + d.saidas, 0);
    const saldoFinal = dailyProjections.length > 0 ? dailyProjections[dailyProjections.length - 1].saldoAcumulado : saldoInicialDisponivel;
    
    let menorSaldo = saldoInicialDisponivel;
    let dataMenorSaldo = new Date().toISOString().split('T')[0];

    dailyProjections.forEach((d) => {
      if (d.saldoAcumulado < menorSaldo) {
        menorSaldo = d.saldoAcumulado;
        dataMenorSaldo = d.data;
      }
    });

    const isRisk = menorSaldo < 0;

    return {
      totalEntradas,
      totalSaidas,
      saldoFinal,
      menorSaldo,
      dataMenorSaldo,
      isRisk,
    };
  }, [dailyProjections, saldoInicialDisponivel]);

  if (!isOpen) return null;

  const handleExportCSV = () => {
    const headers = ['Data', 'Dia', 'Entradas (R$)', 'Saidas (R$)', 'Saldo Liquido (R$)', 'Saldo Acumulado (R$)'];
    const rows = dailyProjections.map((d) => [
      d.data,
      d.diaSemana,
      d.entradas.toFixed(2),
      d.saidas.toFixed(2),
      d.saldoDia.toFixed(2),
      d.saldoAcumulado.toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `projecao_fluxo_caixa_${periodDays}_dias.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="cashflow-projection-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div id="cashflow-projection-modal-card" className="bg-slate-900 border border-slate-700 w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 px-6 py-5 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Fluxo de Caixa Projetado & Previsibilidade
              </h2>
              <p className="text-xs text-slate-400">
                Projeção diária e semanal do saldo bancário consolidado com base nas datas de vencimento.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-slate-800/90 px-6 py-3.5 border-b border-slate-700/70 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Horizon Filter (30, 60, 90, 180) */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-700">
              {([30, 60, 90, 180] as const).map((days) => (
                <button
                  key={days}
                  onClick={() => setPeriodDays(days)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    periodDays === days
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Próximos {days} Dias
                </button>
              ))}
            </div>

            {/* View Mode: Daily or Weekly */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setViewMode('diario')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'diario'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Visão Diária
              </button>
              <button
                onClick={() => setViewMode('semanal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'semanal'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Visão Semanal
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Company Selector */}
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
              className="bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-hidden focus:border-indigo-500"
            >
              <option value={0}>🏢 Todas as Empresas (Consolidado)</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 1. Saldo Inicial Atual */}
            <div className="bg-slate-800/90 p-4 rounded-2xl border border-slate-700/80">
              <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
                <span>Saldo Inicial Hoje</span>
                <Clock className="w-4 h-4 text-slate-500" />
              </div>
              <div className={`text-lg font-extrabold mt-1 ${saldoInicialDisponivel >= 0 ? 'text-white' : 'text-rose-400'}`}>
                {saldoInicialDisponivel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Disponível em bancos e caixa</div>
            </div>

            {/* 2. Total a Receber */}
            <div className="bg-slate-800/90 p-4 rounded-2xl border border-slate-700/80">
              <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
                <span>A Receber no Período</span>
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-lg font-extrabold mt-1 text-emerald-400">
                {summary.totalEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Receitas previstas a faturar</div>
            </div>

            {/* 3. Total a Pagar */}
            <div className="bg-slate-800/90 p-4 rounded-2xl border border-slate-700/80">
              <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
                <span>A Pagar no Período</span>
                <ArrowDownRight className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-lg font-extrabold mt-1 text-rose-400">
                {summary.totalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Despesas e compromissos</div>
            </div>

            {/* 4. Saldo Final Projetado */}
            <div className="bg-slate-800/90 p-4 rounded-2xl border border-slate-700/80">
              <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
                <span>Saldo Final Projetado</span>
                <TrendingUp className="w-4 h-4 text-indigo-400" />
              </div>
              <div className={`text-lg font-extrabold mt-1 ${summary.saldoFinal >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                {summary.saldoFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Em {periodDays} dias no futuro</div>
            </div>

            {/* 5. Pior Momento / Menor Saldo */}
            <div className={`p-4 rounded-2xl border ${
              summary.isRisk 
                ? 'bg-rose-950/30 border-rose-500/50 text-rose-300' 
                : 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
            }`}>
              <div className="text-xs font-medium flex items-center justify-between">
                <span>Menor Saldo Previsto</span>
                {summary.isRisk ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
              </div>
              <div className="text-lg font-extrabold mt-1">
                {summary.menorSaldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="text-[10px] mt-1 opacity-80">
                {summary.isRisk 
                  ? `Alerta: Déficit previsto em ${summary.dataMenorSaldo}` 
                  : `Caixa positivo durante todo o período`}
              </div>
            </div>
          </div>

          {/* Visual Mini Trend Bars */}
          <div className="bg-slate-800/90 p-5 rounded-2xl border border-slate-700/80 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              Curva Visual de Evolução do Saldo Acumulado ({periodDays} Dias)
            </h3>
            
            {/* Visual Balance Bar Chart */}
            <div className="h-28 flex items-end gap-1 pt-4 pb-2 px-1 bg-slate-950/80 rounded-xl border border-slate-800 overflow-x-auto">
              {dailyProjections.map((d, i) => {
                const maxVal = Math.max(...dailyProjections.map((p) => Math.abs(p.saldoAcumulado)), 1000);
                const heightPercent = Math.min(100, Math.max(12, Math.round((Math.abs(d.saldoAcumulado) / maxVal) * 100)));
                const isNegative = d.saldoAcumulado < 0;

                return (
                  <div
                    key={d.data}
                    className="flex-1 min-w-[12px] flex flex-col items-center justify-end group relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-30 pointer-events-none">
                      <div className="bg-slate-900 text-white text-[10px] px-2.5 py-1.5 rounded-lg border border-slate-700 shadow-xl whitespace-nowrap">
                        <div className="font-bold">{d.data} ({d.diaSemana})</div>
                        <div className="text-emerald-400">+ {d.entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                        <div className="text-rose-400">- {d.saidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                        <div className={`font-bold mt-0.5 ${d.saldoAcumulado >= 0 ? 'text-blue-300' : 'text-rose-400'}`}>
                          Saldo: {d.saldoAcumulado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-full rounded-t-xs transition-all ${
                        isNegative ? 'bg-rose-500 hover:bg-rose-400' : 'bg-indigo-500 hover:bg-indigo-400'
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Hoje ({dailyProjections[0]?.data})</span>
              <span>Final do Período ({dailyProjections[dailyProjections.length - 1]?.data})</span>
            </div>
          </div>

          {/* Table Breakdown */}
          <div className="bg-slate-800/90 rounded-2xl border border-slate-700/80 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-700/80 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                {viewMode === 'diario' ? 'Detalhamento Cronológico Diário' : 'Detalhamento Consolidado por Semanas'}
              </h3>
              <span className="text-xs text-slate-400">
                {viewMode === 'diario' ? `${dailyProjections.length} dias projetados` : `${weeklyProjections.length} semanas`}
              </span>
            </div>

            <div className="overflow-x-auto max-h-[340px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Período / Data</th>
                    <th className="py-3 px-4 text-right">Entradas Previstas</th>
                    <th className="py-3 px-4 text-right">Saídas Previstas</th>
                    <th className="py-3 px-4 text-right">Resultado do Período</th>
                    <th className="py-3 px-4 text-right">Saldo Acumulado Projetado</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {viewMode === 'diario' ? (
                    dailyProjections.map((row) => (
                      <tr key={row.data} className="hover:bg-slate-750/50 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-slate-200">
                          <span className="font-bold">{row.data}</span>{' '}
                          <span className="text-slate-500 uppercase text-[10px]">({row.diaSemana})</span>
                          {row.contasNoDia.length > 0 && (
                            <span className="ml-2 text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded-sm">
                              {row.contasNoDia.length} conta(s)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-medium text-emerald-400">
                          {row.entradas > 0 ? row.entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-medium text-rose-400">
                          {row.saidas > 0 ? row.saidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                        </td>
                        <td className={`py-2.5 px-4 text-right font-semibold ${row.saldoDia > 0 ? 'text-emerald-400' : row.saldoDia < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                          {row.saldoDia !== 0 ? (row.saldoDia > 0 ? '+' : '') + row.saldoDia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                        </td>
                        <td className={`py-2.5 px-4 text-right font-extrabold ${row.saldoAcumulado >= 0 ? 'text-blue-300' : 'text-rose-400'}`}>
                          {row.saldoAcumulado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {row.saldoAcumulado >= 0 ? (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                              Positivo
                            </span>
                          ) : (
                            <span className="text-[10px] bg-rose-500/20 text-rose-400 font-bold px-2 py-0.5 rounded-full border border-rose-500/40">
                              Alerta Caixa Negativo
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    weeklyProjections.map((row) => (
                      <tr key={row.semanaIndex} className="hover:bg-slate-750/50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-white">
                          {row.periodoLabel}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-emerald-400">
                          {row.entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-rose-400">
                          {row.saidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className={`py-3 px-4 text-right font-semibold ${row.saldoSemana >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {(row.saldoSemana > 0 ? '+' : '') + row.saldoSemana.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className={`py-3 px-4 text-right font-extrabold ${row.saldoFinalSemana >= 0 ? 'text-blue-300' : 'text-rose-400'}`}>
                          {row.saldoFinalSemana.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.saldoFinalSemana >= 0 ? (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                              Saudável
                            </span>
                          ) : (
                            <span className="text-[10px] bg-rose-500/20 text-rose-400 font-bold px-2 py-0.5 rounded-full border border-rose-500/40">
                              Atenção
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-900 px-6 py-4 border-t border-slate-800 flex justify-between items-center">
          <div className="text-xs text-slate-400">
            A projeção é recalculada em tempo real sempre que novas contas forem criadas ou editadas.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
