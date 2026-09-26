import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  ArrowRight, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Sliders, 
  ChevronRight,
  TrendingDown,
  Sparkles,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';
import { FinancialAccount, Company } from '../types';
import { getDaysDifference, formatReminderDueDate } from '../utils/reminderService';

interface UpcomingPayablesChartProps {
  accounts: FinancialAccount[];
  companies?: Company[];
  darkMode: boolean;
  onQuickPayAccount?: (account: FinancialAccount) => void;
  onViewAllPayables?: () => void;
}

export const UpcomingPayablesChart: React.FC<UpcomingPayablesChartProps> = ({
  accounts,
  companies = [],
  darkMode,
  onQuickPayAccount,
  onViewAllPayables,
}) => {
  // Modo de visualização do gráfico: 'acumulado' (Até 7d, Até 15d, Até 30d) ou 'intervalos' (1-7d, 8-15d, 16-30d)
  const [viewMode, setViewMode] = useState<'acumulado' | 'intervalos'>('acumulado');
  // Período selecionado para detalhamento interativo
  const [selectedHorizon, setSelectedHorizon] = useState<'7' | '15' | '30'>('7');
  const [showAccountsList, setShowAccountsList] = useState<boolean>(true);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Mapeamento de empresas
  const companyMap = useMemo(() => {
    const map = new Map<number, string>();
    companies.forEach((c) => map.set(Number(c.id), c.nome));
    return map;
  }, [companies]);

  // Filtra e classifica as contas pendentes a pagar utilizando a lógica do reminderService
  const payablesData = useMemo(() => {
    const pendingBills = accounts.filter(
      (a) => a.tipo === 'pagar' && a.status === 'Pendente' && !a.excluido
    );

    // Contas categorizadas por horizonte utilizando getDaysDifference
    const overdueBills: FinancialAccount[] = [];
    const billsIn7Days: FinancialAccount[] = [];
    const billsIn15Days: FinancialAccount[] = [];
    const billsIn30Days: FinancialAccount[] = [];

    // Sub-intervalos
    const interval1to7: FinancialAccount[] = [];
    const interval8to15: FinancialAccount[] = [];
    const interval16to30: FinancialAccount[] = [];

    for (const bill of pendingBills) {
      const diff = getDaysDifference(bill.data_vencimento);

      if (diff < 0) {
        overdueBills.push(bill);
      } else {
        // Horizontes acumulados
        if (diff <= 7) {
          billsIn7Days.push(bill);
          interval1to7.push(bill);
        } else if (diff <= 15) {
          interval8to15.push(bill);
        } else if (diff <= 30) {
          interval16to30.push(bill);
        }

        if (diff <= 15) {
          billsIn15Days.push(bill);
        }
        if (diff <= 30) {
          billsIn30Days.push(bill);
        }
      }
    }

    // Totais acumulados
    const total7 = billsIn7Days.reduce((s, a) => s + Number(a.valor || 0), 0);
    const total15 = billsIn15Days.reduce((s, a) => s + Number(a.valor || 0), 0);
    const total30 = billsIn30Days.reduce((s, a) => s + Number(a.valor || 0), 0);

    // Totais dos intervalos
    const totalInt7 = interval1to7.reduce((s, a) => s + Number(a.valor || 0), 0);
    const totalInt15 = interval8to15.reduce((s, a) => s + Number(a.valor || 0), 0);
    const totalInt30 = interval16to30.reduce((s, a) => s + Number(a.valor || 0), 0);

    // Total de contas vencidas
    const totalOverdue = overdueBills.reduce((s, a) => s + Number(a.valor || 0), 0);

    return {
      billsIn7Days,
      billsIn15Days,
      billsIn30Days,
      interval1to7,
      interval8to15,
      interval16to30,
      overdueBills,
      total7,
      total15,
      total30,
      totalInt7,
      totalInt15,
      totalInt30,
      totalOverdue,
    };
  }, [accounts]);

  // Estrutura de dados para o Recharts de acordo com o modo escolhido
  const chartData = useMemo(() => {
    if (viewMode === 'acumulado') {
      return [
        {
          key: '7',
          name: 'Próximos 7 Dias',
          shortName: '7 Dias',
          descricao: 'Vencimentos até 1 semana',
          valor: payablesData.total7,
          quantidade: payablesData.billsIn7Days.length,
          color: '#f59e0b', // Amber / Laranja
          accentClass: 'text-amber-500',
        },
        {
          key: '15',
          name: 'Próximos 15 Dias',
          shortName: '15 Dias',
          descricao: 'Vencimentos até 1 quinzena',
          valor: payablesData.total15,
          quantidade: payablesData.billsIn15Days.length,
          color: '#3b82f6', // Azul Royal
          accentClass: 'text-blue-500',
        },
        {
          key: '30',
          name: 'Próximos 30 Dias',
          shortName: '30 Dias',
          descricao: 'Vencimentos até 1 mês',
          valor: payablesData.total30,
          quantidade: payablesData.billsIn30Days.length,
          color: '#6366f1', // Índigo / Roxo
          accentClass: 'text-indigo-500',
        },
      ];
    } else {
      return [
        {
          key: '7',
          name: '1 a 7 Dias',
          shortName: '1 a 7d',
          descricao: '1ª semana de saídas',
          valor: payablesData.totalInt7,
          quantidade: payablesData.interval1to7.length,
          color: '#f59e0b',
          accentClass: 'text-amber-500',
        },
        {
          key: '15',
          name: '8 a 15 Dias',
          shortName: '8 a 15d',
          descricao: '2ª semana de saídas',
          valor: payablesData.totalInt15,
          quantidade: payablesData.interval8to15.length,
          color: '#3b82f6',
          accentClass: 'text-blue-500',
        },
        {
          key: '30',
          name: '16 a 30 Dias',
          shortName: '16 a 30d',
          descricao: '3ª e 4ª semanas de saídas',
          valor: payablesData.totalInt30,
          quantidade: payablesData.interval16to30.length,
          color: '#6366f1',
          accentClass: 'text-indigo-500',
        },
      ];
    }
  }, [viewMode, payablesData]);

  // Contas exibidas no detalhamento conforme o período selecionado
  const selectedAccounts = useMemo(() => {
    let list: FinancialAccount[] = [];
    if (viewMode === 'acumulado') {
      if (selectedHorizon === '7') list = payablesData.billsIn7Days;
      else if (selectedHorizon === '15') list = payablesData.billsIn15Days;
      else list = payablesData.billsIn30Days;
    } else {
      if (selectedHorizon === '7') list = payablesData.interval1to7;
      else if (selectedHorizon === '15') list = payablesData.interval8to15;
      else list = payablesData.interval16to30;
    }

    // Ordena por vencimento mais próximo
    return [...list].sort((a, b) => {
      const diffA = getDaysDifference(a.data_vencimento);
      const diffB = getDaysDifference(b.data_vencimento);
      return diffA - diffB;
    });
  }, [viewMode, selectedHorizon, payablesData]);

  // Tooltip customizado para o Recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1.5 min-w-[190px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1">
            <span className="font-bold text-slate-200">{data.name}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
              {data.quantidade} conta(s)
            </span>
          </div>
          <div className="pt-0.5">
            <p className="text-[10px] text-slate-400">Total a Pagar no Período:</p>
            <p className="text-base font-extrabold" style={{ color: data.color }}>
              {formatCurrency(data.valor)}
            </p>
          </div>
          <p className="text-[10px] text-slate-400 italic">
            {data.descricao}
          </p>
        </div>
      );
    }
    return null;
  };

  const totalAllPeriod = payablesData.total30;
  const maxBarValue = Math.max(...chartData.map((d) => d.valor), 100);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-200 dark:border-slate-800 p-5 sm:p-6 space-y-6 transition-colors">
      
      {/* 1. Header com Título, Explicação e Controles de Visualização */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>Previsão de Contas a Pagar</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
                  7, 15 e 30 Dias
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Lógica inteligente de lembretes e horizontes de vencimento a curto e médio prazo
              </p>
            </div>
          </div>
        </div>

        {/* Controles: Alternador Acumulado vs Intervalos + Ação */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Alternador de Modo */}
          <div className="bg-gray-100 dark:bg-slate-800 p-1 rounded-xl flex items-center text-xs font-semibold">
            <button
              onClick={() => setViewMode('acumulado')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'acumulado'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs font-bold'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              title="Exibe o somatório total até 7, 15 e 30 dias"
            >
              Acumulado
            </button>
            <button
              onClick={() => setViewMode('intervalos')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'intervalos'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs font-bold'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              title="Exibe o valor fatiado por intervalos (1-7d, 8-15d, 16-30d)"
            >
              Fatiado por Período
            </button>
          </div>

          {onViewAllPayables && (
            <button
              onClick={onViewAllPayables}
              className="px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-750 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Ver Todas a Pagar</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Cards de KPIs Resumidos dos 3 Horizontes (7, 15 e 30 dias) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        
        {/* Card 7 Dias */}
        <div 
          onClick={() => setSelectedHorizon('7')}
          className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden group ${
            selectedHorizon === '7'
              ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/80 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-gray-50/70 dark:bg-slate-800/50 border-gray-200 dark:border-slate-750 hover:bg-gray-100/70 dark:hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>{viewMode === 'acumulado' ? 'Próximos 7 Dias' : '1 a 7 Dias'}</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              {viewMode === 'acumulado' ? payablesData.billsIn7Days.length : payablesData.interval1to7.length} contas
            </span>
          </div>

          <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {formatCurrency(viewMode === 'acumulado' ? payablesData.total7 : payablesData.totalInt7)}
          </p>

          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
            {totalAllPeriod > 0
              ? `${Math.round(((viewMode === 'acumulado' ? payablesData.total7 : payablesData.totalInt7) / totalAllPeriod) * 100)}% das saídas do mês`
              : 'Sem contas no período'}
          </p>
        </div>

        {/* Card 15 Dias */}
        <div 
          onClick={() => setSelectedHorizon('15')}
          className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden group ${
            selectedHorizon === '15'
              ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800/80 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-gray-50/70 dark:bg-slate-800/50 border-gray-200 dark:border-slate-750 hover:bg-gray-100/70 dark:hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <span>{viewMode === 'acumulado' ? 'Próximos 15 Dias' : '8 a 15 Dias'}</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
              {viewMode === 'acumulado' ? payablesData.billsIn15Days.length : payablesData.interval8to15.length} contas
            </span>
          </div>

          <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-2">
            {formatCurrency(viewMode === 'acumulado' ? payablesData.total15 : payablesData.totalInt15)}
          </p>

          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
            {totalAllPeriod > 0
              ? `${Math.round(((viewMode === 'acumulado' ? payablesData.total15 : payablesData.totalInt15) / totalAllPeriod) * 100)}% das saídas do mês`
              : 'Sem contas no período'}
          </p>
        </div>

        {/* Card 30 Dias */}
        <div 
          onClick={() => setSelectedHorizon('30')}
          className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden group ${
            selectedHorizon === '30'
              ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800/80 ring-2 ring-indigo-500/20 shadow-xs'
              : 'bg-gray-50/70 dark:bg-slate-800/50 border-gray-200 dark:border-slate-750 hover:bg-gray-100/70 dark:hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-indigo-500" />
              <span>{viewMode === 'acumulado' ? 'Próximos 30 Dias' : '16 a 30 Dias'}</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
              {viewMode === 'acumulado' ? payablesData.billsIn30Days.length : payablesData.interval16to30.length} contas
            </span>
          </div>

          <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
            {formatCurrency(viewMode === 'acumulado' ? payablesData.total30 : payablesData.totalInt30)}
          </p>

          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
            Média diária de saída: {formatCurrency(payablesData.total30 / 30)}/dia
          </p>
        </div>

      </div>

      {/* Alerta Adicional se houver Contas Vencidas / Em Atraso */}
      {payablesData.overdueBills.length > 0 && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="text-rose-900 dark:text-rose-200">
              Atenção: Você tem <strong>{payablesData.overdueBills.length} conta(s) em atraso</strong> totalizando{' '}
              <strong>{formatCurrency(payablesData.totalOverdue)}</strong> fora do horizonte futuro.
            </span>
          </div>
          {onViewAllPayables && (
            <button
              onClick={onViewAllPayables}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 underline shrink-0 cursor-pointer"
            >
              Regularizar Agora
            </button>
          )}
        </div>
      )}

      {/* 3. Gráfico de Barras com Recharts */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
            <span>Comparativo Visual das Saídas Financeiras</span>
            <span className="text-[10px] text-gray-400">({viewMode === 'acumulado' ? 'Valores acumulados no tempo' : 'Fatias por semana/quinzena'})</span>
          </span>
          <span className="text-[11px] text-gray-400">
            Clique nas colunas para filtrar o detalhamento
          </span>
        </div>

        <div className="h-64 sm:h-72 w-full pt-2">
          {maxBarValue === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-2 text-gray-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-60" />
              <p className="text-xs font-semibold">Nenhuma conta a pagar prevista para os próximos 30 dias!</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload.length) {
                    const key = e.activePayload[0].payload.key;
                    if (key) setSelectedHorizon(key);
                  }
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={darkMode ? '#334155' : '#E2E8F0'}
                />
                <XAxis
                  dataKey="shortName"
                  stroke={darkMode ? '#94A3B8' : '#64748B'}
                  fontSize={12}
                  fontWeight={600}
                  tickLine={false}
                  dy={10}
                />
                <YAxis
                  stroke={darkMode ? '#94A3B8' : '#64748B'}
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="valor"
                  radius={[8, 8, 0, 0]}
                  cursor="pointer"
                  animationDuration={800}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={`cell-${entry.key}`}
                      fill={entry.color}
                      opacity={selectedHorizon === entry.key ? 1 : 0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 4. Detalhamento Interativo das Contas do Horizonte Selecionado */}
      <div className="pt-2 border-t border-gray-100 dark:border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              Contas do Período ({selectedHorizon === '7' ? '7 Dias' : selectedHorizon === '15' ? '15 Dias' : '30 Dias'})
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
              {selectedAccounts.length} lançamento(s)
            </span>
          </div>

          <button
            onClick={() => setShowAccountsList((prev) => !prev)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 cursor-pointer"
          >
            {showAccountsList ? 'Ocultar Detalhes' : 'Ver Detalhes'}
          </button>
        </div>

        {showAccountsList && (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {selectedAccounts.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-slate-500 py-3 text-center italic">
                Nenhuma conta a pagar agendada para este horizonte selecionado.
              </p>
            ) : (
              selectedAccounts.map((account) => {
                const diff = getDaysDifference(account.data_vencimento);
                const statusInfo = formatReminderDueDate(diff, account.data_vencimento);
                const empresaNome = companyMap.get(Number(account.empresa_id));

                return (
                  <div
                    key={account.id}
                    className="p-3 rounded-xl border border-gray-100 dark:border-slate-800/80 bg-gray-50/50 dark:bg-slate-850 hover:bg-gray-100/70 dark:hover:bg-slate-800 transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusInfo.badgeClass}`}>
                          {statusInfo.label}
                        </span>
                        {empresaNome && (
                          <span className="text-[10px] text-gray-400 font-medium truncate max-w-[130px]">
                            {empresaNome}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-gray-900 dark:text-slate-100 truncate">
                        {account.descricao}
                      </p>
                      {account.categoria && (
                        <p className="text-[10px] text-gray-500 dark:text-slate-400">
                          {account.categoria}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                        {formatCurrency(Number(account.valor || 0))}
                      </span>

                      {onQuickPayAccount && (
                        <button
                          onClick={() => onQuickPayAccount(account)}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-2xs"
                          title="Dar baixa e marcar como pago agora"
                        >
                          Dar Baixa
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

    </div>
  );
};
