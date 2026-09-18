import React, { useState, useMemo } from 'react';
import { BankAccount, FinancialAccount, Company, BankAccountType } from '../types';
import { 
  Building2, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  DollarSign, 
  Wallet, 
  CheckCircle2, 
  Sparkles,
  TrendingUp,
  TrendingDown,
  X
} from 'lucide-react';

interface BankAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  activeCompanyId: number;
  bankAccounts: BankAccount[];
  accounts: FinancialAccount[];
  onSaveBank: (bank: BankAccount) => Promise<void> | void;
  onDeleteBank: (bankId: number) => Promise<void> | void;
}

const PRESET_BANKS = [
  { name: 'Banco Itaú', cor: '#ea580c', tipo: 'corrente' as BankAccountType },
  { name: 'Banco Bradesco', cor: '#dc2626', tipo: 'corrente' as BankAccountType },
  { name: 'Banco Santander', cor: '#e11d48', tipo: 'corrente' as BankAccountType },
  { name: 'Banco do Brasil', cor: '#eab308', tipo: 'corrente' as BankAccountType },
  { name: 'Caixa Econômica', cor: '#2563eb', tipo: 'corrente' as BankAccountType },
  { name: 'Banco Stone', cor: '#00a868', tipo: 'corrente' as BankAccountType },
  { name: 'InfinitePay', cor: '#00e575', tipo: 'corrente' as BankAccountType },
  { name: 'Nubank PJ', cor: '#8b5cf6', tipo: 'corrente' as BankAccountType },
  { name: 'Banco Inter PJ', cor: '#f97316', tipo: 'corrente' as BankAccountType },
  { name: 'Sicoob / Sicredi', cor: '#059669', tipo: 'corrente' as BankAccountType },
  { name: 'C6 Bank', cor: '#1e293b', tipo: 'corrente' as BankAccountType },
  { name: 'Caixa Físico / Espécie', cor: '#10b981', tipo: 'caixa_fisico' as BankAccountType },
  { name: 'Conta Investimento', cor: '#06b6d4', tipo: 'investimento' as BankAccountType },
  { name: 'Conta Poupança', cor: '#3b82f6', tipo: 'poupanca' as BankAccountType },
];

export const BankAccountsModal: React.FC<BankAccountsModalProps> = ({
  isOpen,
  onClose,
  companies,
  activeCompanyId,
  bankAccounts,
  accounts,
  onSaveBank,
  onDeleteBank,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nomeBanco, setNomeBanco] = useState('');
  const [tipoConta, setTipoConta] = useState<BankAccountType>('corrente');
  const [agencia, setAgencia] = useState('');
  const [numeroConta, setNumeroConta] = useState('');
  const [saldoInicial, setSaldoInicial] = useState('0');
  const [cor, setCor] = useState('#2563eb');
  const [descricao, setDescricao] = useState('');
  const [padrao, setPadrao] = useState(false);
  const [empresaId, setEmpresaId] = useState<number>(activeCompanyId > 0 ? activeCompanyId : (companies[0]?.id || 1));
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter bank accounts for current company or all
  const filteredBanks = useMemo(() => {
    if (activeCompanyId > 0) {
      return bankAccounts.filter((b) => b.empresa_id === activeCompanyId);
    }
    return bankAccounts;
  }, [bankAccounts, activeCompanyId]);

  // Calculate real balances for each bank account
  const bankBalances = useMemo(() => {
    const map: Record<number, { saldoInicial: number; totalEntradas: number; totalSaidas: number; saldoAtual: number; saldoProjetado: number }> = {};

    bankAccounts.forEach((b) => {
      map[b.id] = {
        saldoInicial: b.saldo_inicial || 0,
        totalEntradas: 0,
        totalSaidas: 0,
        saldoAtual: b.saldo_inicial || 0,
        saldoProjetado: b.saldo_inicial || 0,
      };
    });

    accounts.filter((a) => !a.excluido).forEach((acc) => {
      if (!acc.banco_id || !map[acc.banco_id]) return;

      const val = Number(acc.valor) || 0;
      if (acc.tipo === 'receber') {
        if (acc.status === 'Pago') {
          map[acc.banco_id].totalEntradas += val;
          map[acc.banco_id].saldoAtual += val;
        }
        map[acc.banco_id].saldoProjetado += val;
      } else {
        if (acc.status === 'Pago') {
          map[acc.banco_id].totalSaidas += val;
          map[acc.banco_id].saldoAtual -= val;
        }
        map[acc.banco_id].saldoProjetado -= val;
      }
    });

    return map;
  }, [bankAccounts, accounts]);

  // Consolidated total balance
  const consolidatedTotal = useMemo(() => {
    let atual = 0;
    let projetado = 0;
    filteredBanks.forEach((b) => {
      const stats = bankBalances[b.id];
      if (stats) {
        atual += stats.saldoAtual;
        projetado += stats.saldoProjetado;
      }
    });
    return { atual, projetado };
  }, [filteredBanks, bankBalances]);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingId(null);
    setNomeBanco('');
    setTipoConta('corrente');
    setAgencia('');
    setNumeroConta('');
    setSaldoInicial('0');
    setCor('#2563eb');
    setDescricao('');
    setPadrao(filteredBanks.length === 0);
    setEmpresaId(activeCompanyId > 0 ? activeCompanyId : (companies[0]?.id || 1));
    setIsEditing(true);
    setFeedbackMsg(null);
  };

  const handleStartEdit = (b: BankAccount) => {
    setEditingId(b.id);
    setNomeBanco(b.nome_banco);
    setTipoConta(b.tipo_conta);
    setAgencia(b.agencia || '');
    setNumeroConta(b.numero_conta || '');
    setSaldoInicial(String(b.saldo_inicial || 0));
    setCor(b.cor || '#2563eb');
    setDescricao(b.descricao || '');
    setPadrao(Boolean(b.padrao));
    setEmpresaId(b.empresa_id);
    setIsEditing(true);
    setFeedbackMsg(null);
  };

  const handleSelectPreset = (p: { name: string; cor: string; tipo: string }) => {
    setNomeBanco(p.name);
    setCor(p.cor);
    setTipoConta(p.tipo as any);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeBanco.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Informe o nome do banco ou conta.' });
      return;
    }

    setIsSaving(true);
    try {
      const bankData: BankAccount = {
        id: editingId || Date.now(),
        empresa_id: empresaId,
        nome_banco: nomeBanco.trim(),
        tipo_conta: tipoConta,
        agencia: agencia.trim() || undefined,
        numero_conta: numeroConta.trim() || undefined,
        saldo_inicial: parseFloat(saldoInicial.replace(',', '.')) || 0,
        cor,
        descricao: descricao.trim() || undefined,
        padrao,
        criado_em: new Date().toISOString().split('T')[0],
      };

      await onSaveBank(bankData);
      setFeedbackMsg({ type: 'success', text: 'Conta bancária salva com sucesso!' });
      setIsEditing(false);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao salvar conta bancária.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (bankId: number) => {
    const linkedCount = accounts.filter((a) => a.banco_id === bankId && !a.excluido).length;
    if (linkedCount > 0) {
      const confirm = window.confirm(
        `Existem ${linkedCount} lançamento(s) vinculados a esta conta bancária. Deseja realmente remover a conta?`
      );
      if (!confirm) return;
    } else {
      const confirm = window.confirm('Deseja realmente excluir esta conta bancária?');
      if (!confirm) return;
    }

    try {
      await onDeleteBank(bankId);
      setFeedbackMsg({ type: 'success', text: 'Conta bancária removida.' });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Erro ao remover conta bancária.' });
    }
  };

  return (
    <div id="bank-accounts-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div id="bank-accounts-modal-card" className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 px-6 py-5 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Contas Bancárias & Saldos Reais
                <span className="text-xs bg-indigo-500/20 text-indigo-300 font-medium px-2 py-0.5 rounded-full border border-indigo-500/30">
                  {filteredBanks.length} conta(s)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Gerencie contas correntes, caixas físicos e acompanhe o saldo conciliado em tempo real.
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

        {/* Top Consolidated Summary Bar */}
        <div className="bg-slate-800/80 px-6 py-4 border-b border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 bg-slate-900/90 p-3.5 rounded-xl border border-slate-700/50">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Saldo Consolidado Real (Disponível)</div>
              <div className={`text-xl font-extrabold ${consolidatedTotal.atual >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {consolidatedTotal.atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-900/90 p-3.5 rounded-xl border border-slate-700/50">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Saldo Final Projetado (com Pendências)</div>
              <div className={`text-xl font-extrabold ${consolidatedTotal.projetado >= 0 ? 'text-blue-400' : 'text-amber-400'}`}>
                {consolidatedTotal.projetado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Message */}
        {feedbackMsg && (
          <div className={`mx-6 mt-4 p-3 rounded-lg text-sm border flex items-center gap-2 ${
            feedbackMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {!isEditing ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                  Contas Cadastradas ({filteredBanks.length})
                </h3>
                <button
                  id="btn-add-new-bank-account"
                  onClick={handleStartCreate}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-600/20"
                >
                  <Plus className="w-4 h-4" />
                  Nova Conta Bancária
                </button>
              </div>

              {filteredBanks.length === 0 ? (
                <div className="text-center py-12 bg-slate-800/40 rounded-2xl border border-dashed border-slate-700/80 p-8">
                  <Building2 className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-50" />
                  <p className="text-slate-300 font-medium">Nenhuma conta bancária cadastrada</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Cadastre suas contas correntes (Stone, Itaú, Bradesco, etc.) ou caixas físicos para vincular aos lançamentos.
                  </p>
                  <button
                    onClick={handleStartCreate}
                    className="mt-4 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Cadastrar Primeira Conta
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredBanks.map((b) => {
                    const stats = bankBalances[b.id] || { saldoInicial: 0, totalEntradas: 0, totalSaidas: 0, saldoAtual: 0, saldoProjetado: 0 };
                    const company = companies.find((c) => c.id === b.empresa_id);

                    return (
                      <div
                        key={b.id}
                        className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4.5 hover:border-slate-600 transition-all flex flex-col justify-between relative overflow-hidden"
                      >
                        {/* Color accent strip */}
                        <div 
                          className="absolute top-0 left-0 right-0 h-1.5"
                          style={{ backgroundColor: b.cor || '#2563eb' }}
                        />

                        <div>
                          <div className="flex items-start justify-between gap-2 mt-1">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                                style={{ backgroundColor: b.cor || '#2563eb' }}
                              />
                              <div>
                                <h4 className="font-bold text-white text-base leading-tight flex items-center gap-2">
                                  {b.nome_banco}
                                  {b.padrao && (
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                                      Padrão
                                    </span>
                                  )}
                                </h4>
                                {company && activeCompanyId === 0 && (
                                  <div className="text-xs text-indigo-400 font-medium">
                                    {company.nome}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleStartEdit(b)}
                                className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-700 rounded-lg transition-colors"
                                title="Editar Conta"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(b.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded-lg transition-colors"
                                title="Excluir Conta"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Bank details & specs */}
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/40">
                            <div>
                              <span className="text-slate-500">Tipo: </span>
                              <span className="text-slate-300 font-medium capitalize">
                                {b.tipo_conta === 'caixa_fisico' ? 'Caixa Físico' : b.tipo_conta}
                              </span>
                            </div>
                            {b.agencia && (
                              <div>
                                <span className="text-slate-500">Agência: </span>
                                <span className="text-slate-300 font-medium">{b.agencia}</span>
                              </div>
                            )}
                            {b.numero_conta && (
                              <div>
                                <span className="text-slate-500">Conta: </span>
                                <span className="text-slate-300 font-medium">{b.numero_conta}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-slate-500">Saldo Inicial: </span>
                              <span className="text-slate-300 font-medium">
                                {(b.saldo_inicial || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Balance Card at Bottom */}
                        <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between">
                          <div>
                            <div className="text-[11px] text-slate-400">Saldo Real Atual</div>
                            <div className={`text-base font-extrabold ${stats.saldoAtual >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {stats.saldoAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] text-slate-400">Projetado</div>
                            <div className={`text-sm font-semibold ${stats.saldoProjetado >= 0 ? 'text-blue-300' : 'text-amber-400'}`}>
                              {stats.saldoProjetado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Editing / Creation Form */
            <form onSubmit={handleSubmit} className="space-y-5 bg-slate-800/80 p-5 rounded-2xl border border-slate-700">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {editingId ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-slate-400 hover:text-white px-2.5 py-1 bg-slate-700 rounded-lg"
                >
                  Voltar à Lista
                </button>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">
                  Sugestões Rápidas de Bancos:
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_BANKS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-indigo-500 text-slate-300 flex items-center gap-1.5 transition-all"
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.cor }} />
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Empresa Pertencente *
                  </label>
                  <select
                    value={empresaId}
                    onChange={(e) => setEmpresaId(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-indigo-500"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome da Conta / Banco *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: InfinitePay, Banco Stone, Itaú ou Caixa Loja 1"
                    value={nomeBanco}
                    onChange={(e) => setNomeBanco(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tipo de Conta
                  </label>
                  <select
                    value={tipoConta}
                    onChange={(e) => setTipoConta(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="corrente">Conta Corrente</option>
                    <option value="poupanca">Conta Poupança</option>
                    <option value="investimento">Conta Investimento</option>
                    <option value="caixa_fisico">Caixa Físico / Espécie</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Saldo Inicial (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={saldoInicial}
                    onChange={(e) => setSaldoInicial(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Agência (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 3421"
                    value={agencia}
                    onChange={(e) => setAgencia(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Número da Conta (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 58920-4"
                    value={numeroConta}
                    onChange={(e) => setNumeroConta(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cor de Identificação
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={cor}
                      onChange={(e) => setCor(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { label: 'Stone (Verde)', color: '#00a868' },
                        { label: 'InfinitePay (Verde Limão)', color: '#00e575' },
                        { label: 'Itaú (Laranja)', color: '#ea580c' },
                        { label: 'Bradesco (Vermelho)', color: '#dc2626' },
                        { label: 'Nubank (Roxo)', color: '#8b5cf6' },
                        { label: 'Caixa (Azul)', color: '#2563eb' },
                        { label: 'Banco do Brasil (Amarelo)', color: '#eab308' },
                        { label: 'Inter (Laranja)', color: '#f97316' },
                        { label: 'Sicoob/Sicredi', color: '#059669' },
                      ].map((c) => (
                        <button
                          key={c.color}
                          type="button"
                          onClick={() => setCor(c.color)}
                          title={c.label}
                          className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 cursor-pointer ${
                            cor.toLowerCase() === c.color.toLowerCase()
                              ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 border-white'
                              : 'border-slate-700/60'
                          }`}
                          style={{ backgroundColor: c.color }}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-mono text-slate-400">{cor}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="chk-banco-padrao"
                    checked={padrao}
                    onChange={(e) => setPadrao(e.target.checked)}
                    className="w-4 h-4 rounded-sm border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="chk-banco-padrao" className="text-xs text-slate-300 cursor-pointer font-medium">
                    Definir como conta bancária padrão desta empresa
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descrição / Finalidade (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Utilizada para pagamento de folha e tributos"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2.5 text-sm text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 text-sm text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {isSaving ? 'Salvando...' : 'Salvar Conta'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-900 px-6 py-4 border-t border-slate-800 flex justify-end">
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
