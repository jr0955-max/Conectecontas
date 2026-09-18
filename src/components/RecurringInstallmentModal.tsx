import React, { useState, useMemo } from 'react';
import { Company, BankAccount, CostCenter, FinancialAccount, AccountType } from '../types';
import { 
  generateInstallmentAccounts, 
  generateRecurringAccounts, 
  InstallmentConfig, 
  RecurringConfig 
} from '../utils/recurringGenerator';
import { 
  Repeat, 
  Layers, 
  Calendar, 
  DollarSign, 
  Check, 
  Sparkles, 
  AlertCircle, 
  CreditCard, 
  ArrowRight, 
  X, 
  CheckCircle2,
  Building2,
  HelpCircle
} from 'lucide-react';

interface RecurringInstallmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  activeCompanyId: number;
  bankAccounts: BankAccount[];
  costCenters: CostCenter[];
  currentUserName: string;
  onGenerateBatch: (accounts: Omit<FinancialAccount, 'id'>[]) => Promise<void>;
}

export const RecurringInstallmentModal: React.FC<RecurringInstallmentModalProps> = ({
  isOpen,
  onClose,
  companies,
  activeCompanyId,
  bankAccounts,
  costCenters,
  currentUserName,
  onGenerateBatch,
}) => {
  const [activeTab, setActiveTab] = useState<'parcelamento' | 'recorrente'>('parcelamento');

  // Form state
  const [tipo, setTipo] = useState<AccountType>('pagar');
  const [empresaId, setEmpresaId] = useState<number>(activeCompanyId > 0 ? activeCompanyId : (companies[0]?.id || 1));
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('Serviços');
  const [bancoId, setBancoId] = useState<string>('');
  const [centroCustoId, setCentroCustoId] = useState<string>('');
  const [observacoes, setObservacoes] = useState('');

  // Installment tab specific
  const [totalParcelas, setTotalParcelas] = useState<number>(12);
  const [valorCalculoTipo, setValorCalculoTipo] = useState<'total' | 'parcela'>('total');
  const [valorInformado, setValorInformado] = useState<string>('1200');
  const [dataPrimeiroVencimento, setDataPrimeiroVencimento] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Recurring tab specific
  const [frequencia, setFrequencia] = useState<'mensal' | 'semanal' | 'quinzenal' | 'anual'>('mensal');
  const [repeticoes, setRepeticoes] = useState<number>(12);
  const [valorRecorrente, setValorRecorrente] = useState<string>('500');

  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter available banks & cost centers for company
  const availableBanks = useMemo(() => {
    return bankAccounts.filter((b) => b.empresa_id === empresaId);
  }, [bankAccounts, empresaId]);

  const availableCostCenters = useMemo(() => {
    return costCenters.filter((cc) => cc.empresa_id === 0 || cc.empresa_id === empresaId);
  }, [costCenters, empresaId]);

  // Live preview of generated accounts before saving
  const previewAccounts = useMemo(() => {
    if (!descricao.trim()) return [];

    if (activeTab === 'parcelamento') {
      const valNum = parseFloat(valorInformado.replace(',', '.')) || 0;
      if (valNum <= 0 || totalParcelas <= 0) return [];

      const config: InstallmentConfig = {
        empresa_id: empresaId,
        tipo,
        descricao: descricao.trim(),
        totalParcelas: Number(totalParcelas),
        valorCalculoTipo,
        valorInformado: valNum,
        dataPrimeiroVencimento,
        categoria,
        banco_id: bancoId ? Number(bancoId) : undefined,
        centro_custo_id: centroCustoId ? Number(centroCustoId) : undefined,
        observacoes,
        usuario_nome: currentUserName,
      };

      return generateInstallmentAccounts(config);
    } else {
      const valNum = parseFloat(valorRecorrente.replace(',', '.')) || 0;
      if (valNum <= 0 || repeticoes <= 0) return [];

      const config: RecurringConfig = {
        empresa_id: empresaId,
        tipo,
        descricao: descricao.trim(),
        valor: valNum,
        dataPrimeiroVencimento,
        frequencia,
        repeticoes: Number(repeticoes),
        categoria,
        banco_id: bancoId ? Number(bancoId) : undefined,
        centro_custo_id: centroCustoId ? Number(centroCustoId) : undefined,
        observacoes,
        usuario_nome: currentUserName,
      };

      return generateRecurringAccounts(config);
    }
  }, [
    activeTab,
    tipo,
    empresaId,
    descricao,
    totalParcelas,
    valorCalculoTipo,
    valorInformado,
    dataPrimeiroVencimento,
    categoria,
    bancoId,
    centroCustoId,
    observacoes,
    frequencia,
    repeticoes,
    valorRecorrente,
    currentUserName,
  ]);

  const totalCalculadoGeral = useMemo(() => {
    return previewAccounts.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  }, [previewAccounts]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!descricao.trim()) {
      setFeedback({ type: 'error', text: 'Preencha a descrição do lançamento.' });
      return;
    }

    if (previewAccounts.length === 0) {
      setFeedback({ type: 'error', text: 'Verifique os valores e quantidades informados.' });
      return;
    }

    setIsGenerating(true);
    setFeedback(null);

    try {
      await onGenerateBatch(previewAccounts);
      setFeedback({
        type: 'success',
        text: `Sucesso! ${previewAccounts.length} lançamentos gerados com cálculo automático de vencimento.`,
      });
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Erro ao gerar lançamentos em lote.' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div id="recurring-installment-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div id="recurring-installment-modal-card" className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950/60 to-slate-900 px-6 py-5 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Repeat className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Lançamentos Recorrentes & Parcelamento Automático
              </h2>
              <p className="text-xs text-slate-400">
                Gere despesas fixas (aluguel, salários) ou compras parceladas (1/12, 2/12) com datas automáticas.
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

        {/* Tab Selection */}
        <div className="bg-slate-800/90 border-b border-slate-700/80 px-6 pt-3 flex gap-4">
          <button
            id="tab-parcelamento-automatico"
            onClick={() => {
              setActiveTab('parcelamento');
              setFeedback(null);
            }}
            className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'parcelamento'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Parcelamento Automático (1/N, 2/N)
          </button>

          <button
            id="tab-despesa-recorrente"
            onClick={() => {
              setActiveTab('recorrente');
              setFeedback(null);
            }}
            className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'recorrente'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Repeat className="w-4 h-4" />
            Despesa / Receita Recorrente Fixa (Mensal, etc.)
          </button>
        </div>

        {/* Feedback Bar */}
        {feedback && (
          <div className={`mx-6 mt-4 p-3 rounded-xl text-sm border flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Main Content Layout */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form Setup (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              1. Configuração do Lançamento
            </h3>

            {/* Tipo: Pagar ou Receber */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setTipo('pagar')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  tipo === 'pagar'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Conta a Pagar (Despesa)
              </button>
              <button
                type="button"
                onClick={() => setTipo('receber')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  tipo === 'receber'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Conta a Receber (Receita)
              </button>
            </div>

            {/* Empresa Pertencente */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Empresa *
              </label>
              <select
                value={empresaId}
                onChange={(e) => setEmpresaId(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Descrição Base *
              </label>
              <input
                type="text"
                required
                placeholder={activeTab === 'parcelamento' ? 'Ex: Notebook Dell Inspiron' : 'Ex: Aluguel Escritório Sede'}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
              />
            </div>

            {/* Tab: Parcelamento Specific Inputs */}
            {activeTab === 'parcelamento' && (
              <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nº de Parcelas
                    </label>
                    <select
                      value={totalParcelas}
                      onChange={(e) => setTotalParcelas(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                    >
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 36, 48, 60].map((n) => (
                        <option key={n} value={n}>
                          {n}x Parcelas
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Modo de Cálculo
                    </label>
                    <select
                      value={valorCalculoTipo}
                      onChange={(e) => setValorCalculoTipo(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                    >
                      <option value="total">Valor Total a Dividir</option>
                      <option value="parcela">Valor de Cada Parcela</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {valorCalculoTipo === 'total' ? 'Valor Total da Compra/Venda (R$)' : 'Valor por Parcela (R$)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={valorInformado}
                    onChange={(e) => setValorInformado(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500 font-mono"
                  />
                </div>
              </div>
            )}

            {/* Tab: Recorrente Specific Inputs */}
            {activeTab === 'recorrente' && (
              <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Frequência
                    </label>
                    <select
                      value={frequencia}
                      onChange={(e) => setFrequencia(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                    >
                      <option value="mensal">Mensal (Todo Mês)</option>
                      <option value="quinzenal">Quinzenal (A cada 15 dias)</option>
                      <option value="semanal">Semanal (A cada 7 dias)</option>
                      <option value="anual">Anual (Uma vez por ano)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Duração / Repetições
                    </label>
                    <select
                      value={repeticoes}
                      onChange={(e) => setRepeticoes(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                    >
                      {[3, 6, 12, 24, 36, 48, 60].map((n) => (
                        <option key={n} value={n}>
                          {n} vezes ({frequencia === 'mensal' ? `${n} meses` : `${n} repetições`})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Valor Recorrente de Cada Período (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={valorRecorrente}
                    onChange={(e) => setValorRecorrente(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500 font-mono"
                  />
                </div>
              </div>
            )}

            {/* Data Primeiro Vencimento */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Data do 1º Vencimento *
              </label>
              <input
                type="date"
                required
                value={dataPrimeiroVencimento}
                onChange={(e) => setDataPrimeiroVencimento(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
              />
            </div>

            {/* Conta Bancária & Centro de Custo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Conta Bancária
                </label>
                <select
                  value={bancoId}
                  onChange={(e) => setBancoId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-blue-500"
                >
                  <option value="">Não vincular a banco</option>
                  {availableBanks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nome_banco}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Centro de Custo
                </label>
                <select
                  value={centroCustoId}
                  onChange={(e) => setCentroCustoId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-blue-500"
                >
                  <option value="">Não vincular a centro</option>
                  {availableCostCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Categoria */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Categoria
              </label>
              <input
                type="text"
                placeholder="Ex: Equipamentos, Aluguel, Folha"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          {/* Right Column: Dynamic Preview Table (7 cols) */}
          <div className="lg:col-span-7 flex flex-col bg-slate-950/80 rounded-2xl border border-slate-800 p-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  2. Pré-Visualização das Datas & Parcelas
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {previewAccounts.length} lançamento(s) gerados automaticamente
                </p>
              </div>

              <div className="text-right">
                <div className="text-[11px] text-slate-400">Total Consolidado</div>
                <div className="text-base font-extrabold text-blue-400">
                  {totalCalculadoGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </div>
            </div>

            {/* Preview List */}
            <div className="flex-1 overflow-y-auto max-h-[380px] space-y-2 pr-1">
              {previewAccounts.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-sm">
                  Preencha a descrição e os valores ao lado para visualizar a lista gerada.
                </div>
              ) : (
                previewAccounts.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 text-xs hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-[11px]">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          {item.descricao}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span className="text-slate-300">Vencimento: {item.data_vencimento}</span>
                          {item.categoria && <span className="text-slate-500">• {item.categoria}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`font-bold ${tipo === 'receber' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {Number(item.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-sm">
                        Pendente
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Generate Button */}
            <div className="pt-4 mt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Os lançamentos serão sincronizados na nuvem e no SQLite local.
              </span>
              <button
                id="btn-confirm-generate-recurring"
                onClick={handleGenerate}
                disabled={isGenerating || previewAccounts.length === 0}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all"
              >
                <Check className="w-4 h-4" />
                {isGenerating ? 'Gerando Lançamentos...' : `Confirmar e Gerar ${previewAccounts.length} Lançamentos`}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-900 px-6 py-3.5 border-t border-slate-800 flex justify-end">
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
