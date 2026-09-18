import React, { useState } from 'react';
import { FinancialAccount, Company } from '../types';
import { 
  X, 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  CalendarDays,
  DollarSign,
  Building2,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface ChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company | undefined;
  companies?: Company[];
  accounts: FinancialAccount[];
  darkMode: boolean;
}

export const ChartModal: React.FC<ChartModalProps> = ({
  isOpen,
  onClose,
  company,
  companies = [],
  accounts,
  darkMode,
}) => {
  const [viewMode, setViewMode] = useState<'selected' | 'consolidated'>(
    company ? 'selected' : 'consolidated'
  );

  if (!isOpen) return null;

  // Se o viewMode for 'selected' e tiver company definida, filtra contas da empresa; senão pega todas
  const accountsToAnalyze = (viewMode === 'selected' && company)
    ? accounts.filter((a) => a.empresa_id === company.id)
    : accounts;

  const contasPagar = accountsToAnalyze.filter((a) => a.tipo === 'pagar');
  const contasReceber = accountsToAnalyze.filter((a) => a.tipo === 'receber');

  // Mapear por mês (YYYY-MM)
  const mesesMap = new Map<string, { mes: string; pagar: number; receber: number; saldo: number }>();

  accountsToAnalyze.forEach((acc) => {
    const mesKey = acc.data_vencimento ? acc.data_vencimento.substring(0, 7) : 'Indefinido';
    if (mesKey === 'Indefinido') return;

    if (!mesesMap.has(mesKey)) {
      mesesMap.set(mesKey, { mes: mesKey, pagar: 0, receber: 0, saldo: 0 });
    }

    const item = mesesMap.get(mesKey)!;
    if (acc.tipo === 'pagar') {
      item.pagar += acc.valor;
    } else {
      item.receber += acc.valor;
    }
    item.saldo = item.receber - item.pagar;
  });

  const chartData = Array.from(mesesMap.values()).sort((a, b) => a.mes.localeCompare(b.mes));

  const totalGastos = contasPagar.reduce((sum, item) => sum + item.valor, 0);
  const totalReceitas = contasReceber.reduce((sum, item) => sum + item.valor, 0);
  const numMeses = chartData.length || (accountsToAnalyze.length > 0 ? 1 : 0);

  const mediaGastos = numMeses > 0 ? totalGastos / numMeses : 0;
  const mediaReceitas = numMeses > 0 ? totalReceitas / numMeses : 0;

  // Comparativo por empresa se estiver no modo consolidado
  const companyMetrics = companies.map((c) => {
    const cAccounts = accounts.filter((a) => a.empresa_id === c.id);
    const rec = cAccounts.filter((a) => a.tipo === 'receber').reduce((s, a) => s + a.valor, 0);
    const pag = cAccounts.filter((a) => a.tipo === 'pagar').reduce((s, a) => s + a.valor, 0);
    return {
      name: c.nome.length > 14 ? c.nome.substring(0, 12) + '...' : c.nome,
      fullName: c.nome,
      receber: rec,
      pagar: pag,
      saldo: rec - pag,
    };
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl text-xs border border-slate-700">
          <p className="font-bold text-sm mb-2 text-slate-200">{label}</p>
          <p className="text-blue-400 flex items-center justify-between gap-4">
            <span>Receitas:</span>
            <span className="font-mono font-bold">{formatCurrency(payload[0]?.value || 0)}</span>
          </p>
          <p className="text-rose-400 flex items-center justify-between gap-4 mt-1">
            <span>Despesas:</span>
            <span className="font-mono font-bold">{formatCurrency(payload[1]?.value || 0)}</span>
          </p>
          <div className="border-t border-slate-700 mt-2 pt-1.5 flex items-center justify-between gap-4 text-emerald-300">
            <span>Saldo:</span>
            <span className="font-mono font-bold">
              {formatCurrency((payload[0]?.value || 0) - (payload[1]?.value || 0))}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Relatório Comparativo Financeiro
                {company && viewMode === 'selected' ? (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold">
                    {company.nome}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold">
                    Consolidado Multiempresa
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Comparativo de Entradas vs Saídas &bull; Médias e projeção de fluxo de caixa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Toggle Mode Pills if companies exist */}
            {companies.length > 1 && (
              <div className="inline-flex rounded-lg p-0.5 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                {company && (
                  <button
                    onClick={() => setViewMode('selected')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      viewMode === 'selected'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Empresa Atual
                  </button>
                )}
                <button
                  onClick={() => setViewMode('consolidated')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    viewMode === 'consolidated'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Todas ({companies.length})
                </button>
              </div>
            )}

            <button
              id="close-chart-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Stat Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-100 dark:border-slate-800">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Meses Analisados</span>
              <div className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                <CalendarDays className="w-4 h-4 text-blue-500" />
                <span>{numMeses} {numMeses === 1 ? 'mês' : 'meses'}</span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-100 dark:border-slate-800">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Média Mensal Receitas</span>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5 font-mono">
                <TrendingUp className="w-4 h-4" />
                <span>{formatCurrency(mediaReceitas)}</span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-100 dark:border-slate-800">
              <span className="text-xs text-rose-500 dark:text-rose-400 font-medium">Média Mensal Gastos</span>
              <div className="text-lg font-bold text-rose-500 dark:text-rose-400 flex items-center gap-1 mt-0.5 font-mono">
                <TrendingDown className="w-4 h-4" />
                <span>{formatCurrency(mediaGastos)}</span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-100 dark:border-slate-800">
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Saldo Projetado Total</span>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-0.5 font-mono">
                <DollarSign className="w-4 h-4" />
                <span>{formatCurrency(totalReceitas - totalGastos)}</span>
              </div>
            </div>
          </div>

          {/* Gráfico de Barras Mensal */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-between">
              <span>Evolução Mensal (R$)</span>
              <span className="text-xs font-normal text-gray-400">
                Receitas (Azul) vs Despesas (Vermelho)
              </span>
            </h3>

            {chartData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-gray-400 text-sm">
                <BarChart3 className="w-10 h-10 mb-2 opacity-40" />
                <p>Nenhum lançamento com data de vencimento encontrada para gerar o gráfico.</p>
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#F1F5F9'} />
                    <XAxis 
                      dataKey="mes" 
                      stroke={darkMode ? '#94A3B8' : '#64748B'} 
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis 
                      stroke={darkMode ? '#94A3B8' : '#64748B'} 
                      fontSize={12}
                      tickFormatter={(v) => `R$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                      formatter={(val) => (val === 'receber' ? 'Contas a Receber (Entradas)' : 'Contas a Pagar (Saídas)')}
                    />
                    <Bar 
                      dataKey="receber" 
                      name="receber" 
                      fill="#2563EB" 
                      radius={[4, 4, 0, 0]} 
                    />
                    <Bar 
                      dataKey="pagar" 
                      name="pagar" 
                      fill="#EF4444" 
                      radius={[4, 4, 0, 0]} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Gráfico Comparativo por Empresa se estiver no modo consolidado */}
          {viewMode === 'consolidated' && companies.length > 1 && (
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-between">
                <span>Comparativo por Empresa (R$)</span>
                <span className="text-xs font-normal text-gray-400">
                  Volume de receitas e despesas por CNPJ/Empresa
                </span>
              </h3>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={companyMetrics} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#F1F5F9'} />
                    <XAxis dataKey="name" stroke={darkMode ? '#94A3B8' : '#64748B'} fontSize={11} tickLine={false} />
                    <YAxis stroke={darkMode ? '#94A3B8' : '#64748B'} fontSize={11} tickFormatter={(v) => `R$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="receber" name="receber" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pagar" name="pagar" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saldo" name="saldo" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Tabela de Detalhamento dos Meses */}
          {chartData.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">
                Detalhamento Mensal
              </h3>
              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 font-bold border-b border-gray-100 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3 uppercase text-gray-400">Mês</th>
                      <th className="py-2.5 px-3 text-right uppercase text-gray-400">Contas a Receber</th>
                      <th className="py-2.5 px-3 text-right uppercase text-gray-400">Contas a Pagar</th>
                      <th className="py-2.5 px-3 text-right uppercase text-gray-400">Saldo do Mês</th>
                      <th className="py-2.5 px-3 text-center uppercase text-gray-400">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-mono">
                    {chartData.map((row) => (
                      <tr key={row.mes} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/50">
                        <td className="py-2 px-3 font-semibold text-gray-900 dark:text-white">{row.mes}</td>
                        <td className="py-2 px-3 text-right text-blue-600 dark:text-blue-400 font-medium">
                          {formatCurrency(row.receber)}
                        </td>
                        <td className="py-2 px-3 text-right text-rose-500 dark:text-rose-400 font-medium">
                          {formatCurrency(row.pagar)}
                        </td>
                        <td className={`py-2 px-3 text-right font-bold ${
                          row.saldo >= 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {formatCurrency(row.saldo)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.saldo >= 0 
                              ? 'bg-green-100 text-green-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-red-100 text-red-700 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}>
                            {row.saldo >= 0 ? 'SUPERÁVIT' : 'DÉFICIT'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50/50 dark:bg-slate-800/40 border-t border-gray-100 dark:border-slate-800 flex justify-end shrink-0">
          <button
            id="btn-close-chart-modal-footer"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
          >
            Fechar Relatório
          </button>
        </div>

      </div>
    </div>
  );
};
