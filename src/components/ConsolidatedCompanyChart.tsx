import React from 'react';
import { Company, FinancialAccount, CompanySummaryMetric } from '../types';
import { 
  Building2, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight,
  PieChart as PieChartIcon,
  BarChart3,
  CheckCircle2,
  ExternalLink
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
  Cell
} from 'recharts';

interface ConsolidatedCompanyChartProps {
  companies: Company[];
  accounts: FinancialAccount[];
  darkMode: boolean;
  onSelectCompany: (companyId: number) => void;
}

export const ConsolidatedCompanyChart: React.FC<ConsolidatedCompanyChartProps> = ({
  companies,
  accounts,
  darkMode,
  onSelectCompany,
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Calculate metrics per company (excluding soft-deleted accounts)
  const companyMetrics: CompanySummaryMetric[] = companies.map((comp) => {
    const compAccounts = accounts.filter((a) => Number(a.empresa_id) === Number(comp.id) && !a.excluido);
    const pagarList = compAccounts.filter((a) => a.tipo === 'pagar');
    const receberList = compAccounts.filter((a) => a.tipo === 'receber');

    const totalPagar = pagarList.reduce((sum, a) => sum + a.valor, 0);
    const totalReceber = receberList.reduce((sum, a) => sum + a.valor, 0);
    const pago = pagarList.filter((a) => a.status === 'Pago').reduce((sum, a) => sum + a.valor, 0);
    const recebido = receberList.filter((a) => a.status === 'Recebido').reduce((sum, a) => sum + a.valor, 0);

    return {
      empresa_id: Number(comp.id),
      empresa_nome: comp.nome,
      cnpj: comp.cnpj,
      totalReceber,
      totalPagar,
      saldo: totalReceber - totalPagar,
      recebido,
      pago,
      qtdContas: compAccounts.length,
    };
  });

  // Consolidated totals
  const totalReceitasGeral = companyMetrics.reduce((sum, c) => sum + c.totalReceber, 0);
  const totalGastosGeral = companyMetrics.reduce((sum, c) => sum + c.totalPagar, 0);
  const saldoConsolidadoGeral = totalReceitasGeral - totalGastosGeral;
  const totalRecebidoRealizado = companyMetrics.reduce((sum, c) => sum + c.recebido, 0);
  const totalPagoRealizado = companyMetrics.reduce((sum, c) => sum + c.pago, 0);
  const saldoRealizadoGeral = totalRecebidoRealizado - totalPagoRealizado;

  // Chart data formatted for Recharts
  const chartData = companyMetrics.map((c) => ({
    name: c.empresa_nome.length > 15 ? c.empresa_nome.substring(0, 13) + '...' : c.empresa_nome,
    fullName: c.empresa_nome,
    empresa_id: c.empresa_id,
    receber: c.totalReceber,
    pagar: c.totalPagar,
    saldo: c.saldo,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataItem = payload[0]?.payload;
      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl text-xs border border-slate-700">
          <p className="font-bold text-sm mb-2 text-slate-100 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <span>{dataItem?.fullName || label}</span>
          </p>
          <p className="text-blue-400 flex items-center justify-between gap-4">
            <span>Contas a Receber:</span>
            <span className="font-mono font-bold">{formatCurrency(dataItem?.receber || 0)}</span>
          </p>
          <p className="text-rose-400 flex items-center justify-between gap-4 mt-1">
            <span>Contas a Pagar:</span>
            <span className="font-mono font-bold">{formatCurrency(dataItem?.pagar || 0)}</span>
          </p>
          <div className="border-t border-slate-700 mt-2 pt-1.5 flex items-center justify-between gap-4 text-emerald-300 font-bold">
            <span>Saldo Líquido:</span>
            <span className="font-mono">
              {formatCurrency(dataItem?.saldo || 0)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header do Somatório Consolidado */}
      <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-blue-800/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">
                  Somatório Consolidado do Grupo Empresarial
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-200 border border-blue-400/30">
                  {companies.length} Empresas
                </span>
              </div>
              <p className="text-xs text-blue-200/80 mt-0.5">
                Visão unificada das receitas, despesas e saldos de todas as filiais e empresas cadastradas
              </p>
            </div>
          </div>

          {/* KPI Pills Header */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/10 text-right">
              <span className="text-[10px] text-blue-200 uppercase font-semibold block">Total Receber</span>
              <span className="font-bold font-mono text-sm text-emerald-300">{formatCurrency(totalReceitasGeral)}</span>
            </div>

            <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/10 text-right">
              <span className="text-[10px] text-blue-200 uppercase font-semibold block">Total Pagar</span>
              <span className="font-bold font-mono text-sm text-rose-300">{formatCurrency(totalGastosGeral)}</span>
            </div>

            <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/10 text-right">
              <span className="text-[10px] text-blue-200 uppercase font-semibold block">Saldo Consolidado</span>
              <span className={`font-bold font-mono text-base ${saldoConsolidadoGeral >= 0 ? 'text-white' : 'text-rose-300'}`}>
                {formatCurrency(saldoConsolidadoGeral)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Gráfico Comparativo das Empresas (Bar Chart) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xs border border-gray-100 dark:border-slate-800 transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-3 border-b border-gray-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Gráfico Comparativo por Empresa (R$)</span>
            </h3>
            <p className="text-xs text-gray-400">
              Comparativo direto de volume de entradas e saídas de cada CNPJ/Empresa
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <div className="w-2.5 h-2.5 bg-blue-600 rounded-sm"></div> Receitas
            </span>
            <span className="flex items-center gap-1.5 text-rose-500 dark:text-rose-400">
              <div className="w-2.5 h-2.5 bg-rose-500 rounded-sm"></div> Despesas
            </span>
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></div> Saldo Projetado
            </span>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400 text-xs">
            Nenhuma empresa cadastrada para exibir o gráfico.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#F1F5F9'} />
                <XAxis 
                  dataKey="name" 
                  stroke={darkMode ? '#94A3B8' : '#64748B'} 
                  fontSize={11}
                  tickLine={false}
                  interval={0}
                />
                <YAxis 
                  stroke={darkMode ? '#94A3B8' : '#64748B'} 
                  fontSize={11}
                  tickFormatter={(v) => `R$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  formatter={(val) => (
                    val === 'receber' ? 'Contas a Receber' : val === 'pagar' ? 'Contas a Pagar' : 'Saldo Projetado'
                  )}
                />
                <Bar dataKey="receber" name="receber" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pagar" name="pagar" fill="#EF4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saldo" name="saldo" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 3. Tabela Demonstrativa de Somatório por Empresa */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-100 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">
              Demonstrativo Financeiro Consolidado por Empresa
            </h3>
            <p className="text-xs text-gray-400">
              Detalhamento de receitas, despesas, saldos e participação no faturamento global
            </p>
          </div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Valores em Reais (BRL)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-100 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 uppercase">Empresa</th>
                <th className="py-3 px-4 uppercase">CNPJ</th>
                <th className="py-3 px-4 text-right uppercase text-blue-600 dark:text-blue-400">Contas a Receber</th>
                <th className="py-3 px-4 text-right uppercase text-rose-500 dark:text-rose-400">Contas a Pagar</th>
                <th className="py-3 px-4 text-right uppercase">Saldo Projetado</th>
                <th className="py-3 px-4 text-right uppercase">Realizado (Caixa)</th>
                <th className="py-3 px-4 text-center uppercase">Part. Receita</th>
                <th className="py-3 px-4 text-center uppercase">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-mono">
              {companyMetrics.map((item) => {
                const partPercent = totalReceitasGeral > 0 
                  ? ((item.totalReceber / totalReceitasGeral) * 100).toFixed(1) 
                  : '0.0';

                return (
                  <tr 
                    key={item.empresa_id}
                    className="hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-sans font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <span>{item.empresa_nome}</span>
                    </td>

                    <td className="py-3 px-4 text-gray-500 dark:text-gray-400">
                      {item.cnpj || '—'}
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(item.totalReceber)}
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-rose-500 dark:text-rose-400">
                      {formatCurrency(item.totalPagar)}
                    </td>

                    <td className={`py-3 px-4 text-right font-bold text-sm ${
                      item.saldo >= 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {formatCurrency(item.saldo)}
                    </td>

                    <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300 font-semibold">
                      {formatCurrency(item.recebido - item.pago)}
                    </td>

                    <td className="py-3 px-4 text-center font-sans">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                        {partPercent}%
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center font-sans">
                      <button
                        onClick={() => onSelectCompany(item.empresa_id)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 inline-flex items-center gap-1 transition-colors cursor-pointer"
                        title="Ver detalhes desta empresa"
                      >
                        <span>Abrir</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {/* Linha de Total Consolidado */}
              <tr className="bg-blue-50/50 dark:bg-slate-800/90 font-bold border-t-2 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white">
                <td className="py-3.5 px-4 font-sans uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  TOTAL DO GRUPO
                </td>
                <td className="py-3.5 px-4 font-sans text-gray-500">
                  {companies.length} filiais
                </td>
                <td className="py-3.5 px-4 text-right text-blue-700 dark:text-blue-300 text-sm">
                  {formatCurrency(totalReceitasGeral)}
                </td>
                <td className="py-3.5 px-4 text-right text-rose-600 dark:text-rose-400 text-sm">
                  {formatCurrency(totalGastosGeral)}
                </td>
                <td className="py-3.5 px-4 text-right text-base text-gray-900 dark:text-white">
                  {formatCurrency(saldoConsolidadoGeral)}
                </td>
                <td className="py-3.5 px-4 text-right text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(saldoRealizadoGeral)}
                </td>
                <td className="py-3.5 px-4 text-center font-sans">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                    100.0%
                  </span>
                </td>
                <td className="py-3.5 px-4 text-center text-[10px] text-gray-400 font-sans">
                  CONSOLIDADO
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
