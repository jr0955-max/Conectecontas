import React, { useState, useMemo, useRef } from 'react';
import { 
  BankAccount, 
  Company, 
  FinancialAccount, 
  OFXStatement, 
  OFXTransaction 
} from '../types';
import { parseOFX, parseBankCSV } from '../utils/ofxParser';
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Sparkles, 
  Check, 
  Plus, 
  Building2, 
  Calendar, 
  DollarSign, 
  RefreshCw, 
  X,
  FileCheck,
  Search,
  Filter
} from 'lucide-react';

interface OfxImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  activeCompanyId: number;
  bankAccounts: BankAccount[];
  accounts: FinancialAccount[];
  currentUserName: string;
  onReconcileAccount: (accountId: number, fitid: string, bankId?: number) => Promise<void>;
  onCreateAndReconcile: (newAccount: Omit<FinancialAccount, 'id'>) => Promise<void>;
  onBatchReconcile: (
    matches: { accountId: number; fitid: string; bankId?: number }[],
    newAccounts: Omit<FinancialAccount, 'id'>[]
  ) => Promise<void>;
}

interface MatchCandidate {
  transaction: OFXTransaction;
  matchedAccount?: FinancialAccount;
  matchScore: 'EXACT' | 'PROBABLE' | 'NONE'; // EXACT = Same val & close date, PROBABLE = Same val, NONE = No match
  actionTaken?: 'RECONCILED' | 'CREATED' | 'IGNORED';
}

export const OfxImportModal: React.FC<OfxImportModalProps> = ({
  isOpen,
  onClose,
  companies,
  activeCompanyId,
  bankAccounts,
  accounts,
  currentUserName,
  onReconcileAccount,
  onCreateAndReconcile,
  onBatchReconcile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statement, setStatement] = useState<OFXStatement | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(
    activeCompanyId > 0 ? activeCompanyId : (companies[0]?.id || 1)
  );

  const [filterType, setFilterType] = useState<'all' | 'unmatched' | 'matched'>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Available banks for selected company
  const availableBanks = useMemo(() => {
    return bankAccounts.filter((b) => b.empresa_id === selectedCompanyId);
  }, [bankAccounts, selectedCompanyId]);

  // Set default bank if available
  React.useEffect(() => {
    if (availableBanks.length > 0 && !selectedBankId) {
      const defaultBank = availableBanks.find((b) => b.padrao) || availableBanks[0];
      setSelectedBankId(String(defaultBank.id));
    }
  }, [availableBanks, selectedBankId]);

  // Company accounts available for matching (active company, not deleted)
  const activeCompanyAccounts = useMemo(() => {
    return accounts.filter((a) => a.empresa_id === selectedCompanyId && !a.excluido);
  }, [accounts, selectedCompanyId]);

  // Auto-Match Engine
  const matchCandidates: MatchCandidate[] = useMemo(() => {
    if (!statement || statement.transacoes.length === 0) return [];

    const candidates: MatchCandidate[] = [];
    const usedAccountIds = new Set<number>();

    statement.transacoes.forEach((trn) => {
      const targetType = trn.tipo === 'CREDIT' ? 'receber' : 'pagar';
      const trnDate = new Date(trn.data).getTime();

      // 1. Check if already reconciled with this fitid
      const alreadyReconciled = activeCompanyAccounts.find(
        (a) => a.conciliado_fitid === trn.fitid || (a.conciliado && Math.abs(a.valor - trn.valor) < 0.01 && a.data_vencimento === trn.data)
      );

      if (alreadyReconciled) {
        usedAccountIds.add(alreadyReconciled.id);
        candidates.push({
          transaction: trn,
          matchedAccount: alreadyReconciled,
          matchScore: 'EXACT',
          actionTaken: 'RECONCILED',
        });
        return;
      }

      // 2. Look for exact match (same type, same value, within +/- 5 days)
      const exactMatch = activeCompanyAccounts.find((a) => {
        if (usedAccountIds.has(a.id)) return false;
        if (a.tipo !== targetType) return false;
        if (Math.abs(a.valor - trn.valor) > 0.05) return false;

        const accDate = new Date(a.data_vencimento).getTime();
        const diffDays = Math.abs(trnDate - accDate) / (1000 * 60 * 60 * 24);
        return diffDays <= 5;
      });

      if (exactMatch) {
        usedAccountIds.add(exactMatch.id);
        candidates.push({
          transaction: trn,
          matchedAccount: exactMatch,
          matchScore: 'EXACT',
        });
        return;
      }

      // 3. Look for probable match (same type, same value, any date)
      const probableMatch = activeCompanyAccounts.find((a) => {
        if (usedAccountIds.has(a.id)) return false;
        if (a.tipo !== targetType) return false;
        return Math.abs(a.valor - trn.valor) <= 0.05;
      });

      if (probableMatch) {
        usedAccountIds.add(probableMatch.id);
        candidates.push({
          transaction: trn,
          matchedAccount: probableMatch,
          matchScore: 'PROBABLE',
        });
        return;
      }

      // 4. No match found -> suggest creating new account
      candidates.push({
        transaction: trn,
        matchScore: 'NONE',
      });
    });

    return candidates;
  }, [statement, activeCompanyAccounts]);

  const stats = useMemo(() => {
    const total = matchCandidates.length;
    const exact = matchCandidates.filter((c) => c.matchScore === 'EXACT').length;
    const probable = matchCandidates.filter((c) => c.matchScore === 'PROBABLE').length;
    const none = matchCandidates.filter((c) => c.matchScore === 'NONE').length;
    return { total, exact, probable, none };
  }, [matchCandidates]);

  // Filtered view of candidates
  const filteredCandidates = useMemo(() => {
    if (filterType === 'matched') {
      return matchCandidates.filter((c) => c.matchScore === 'EXACT' || c.matchScore === 'PROBABLE');
    }
    if (filterType === 'unmatched') {
      return matchCandidates.filter((c) => c.matchScore === 'NONE');
    }
    return matchCandidates;
  }, [matchCandidates, filterType]);

  if (!isOpen) return null;

  const handleFileProcess = (file: File) => {
    const reader = new FileReader();
    setFileName(file.name);

    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      try {
        let parsed: OFXStatement;
        if (file.name.toLowerCase().endsWith('.csv')) {
          parsed = parseBankCSV(content);
        } else {
          parsed = parseOFX(content);
        }

        if (parsed.transacoes.length === 0) {
          setFeedback({
            type: 'error',
            text: 'Nenhuma transação encontrada no arquivo. Verifique se o extrato está no formato OFX ou CSV bancário padrão.',
          });
        } else {
          setStatement(parsed);
          setFeedback({
            type: 'success',
            text: `Extrato importado com sucesso: ${parsed.transacoes.length} transações identificadas!`,
          });
        }
      } catch (err: any) {
        setFeedback({
          type: 'error',
          text: `Erro ao processar arquivo: ${err.message || 'Formato incompatível'}`,
        });
      }
    };

    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileProcess(file);
  };

  // Reconcile individual matched item
  const handleSingleReconcile = async (candidate: MatchCandidate) => {
    if (!candidate.matchedAccount) return;
    setIsProcessing(true);
    try {
      await onReconcileAccount(
        candidate.matchedAccount.id,
        candidate.transaction.fitid,
        selectedBankId ? Number(selectedBankId) : undefined
      );
      setFeedback({
        type: 'success',
        text: `Lançamento "${candidate.matchedAccount.descricao}" conciliado e baixado com sucesso!`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Erro na conciliação.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Create new account from bank transaction and mark conciliated
  const handleCreateAndReconcile = async (candidate: MatchCandidate) => {
    const trn = candidate.transaction;
    setIsProcessing(true);
    try {
      const newAcc: Omit<FinancialAccount, 'id'> = {
        empresa_id: selectedCompanyId,
        tipo: trn.tipo === 'CREDIT' ? 'receber' : 'pagar',
        descricao: trn.memo,
        valor: trn.valor,
        data_vencimento: trn.data,
        status: 'Pago', // Already settled in bank
        categoria: trn.tipo === 'CREDIT' ? 'Receita Bancária' : 'Despesa Bancária',
        banco_id: selectedBankId ? Number(selectedBankId) : undefined,
        banco_origem: statement?.banco_nome || 'Extrato Bancário',
        documento_ref: trn.fitid,
        conciliado: true,
        conciliado_em: new Date().toISOString(),
        conciliado_fitid: trn.fitid,
        conciliado_por: currentUserName,
        criado_por: currentUserName,
        criado_em: new Date().toISOString(),
        excluido: false,
      };

      await onCreateAndReconcile(newAcc);
      setFeedback({
        type: 'success',
        text: `Novo lançamento "${trn.memo}" criado e conciliado!`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Erro ao criar lançamento.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Batch reconcile all confident matches & create remaining
  const handleBatchAutoReconcile = async () => {
    setIsProcessing(true);
    try {
      const matchesToReconcile: { accountId: number; fitid: string; bankId?: number }[] = [];
      const newAccountsToCreate: Omit<FinancialAccount, 'id'>[] = [];

      matchCandidates.forEach((c) => {
        if (c.actionTaken === 'RECONCILED') return;

        if (c.matchScore === 'EXACT' && c.matchedAccount) {
          matchesToReconcile.push({
            accountId: c.matchedAccount.id,
            fitid: c.transaction.fitid,
            bankId: selectedBankId ? Number(selectedBankId) : undefined,
          });
        }
      });

      if (matchesToReconcile.length === 0) {
        setFeedback({ type: 'error', text: 'Nenhuma correspondência exata pendente para conciliar.' });
        setIsProcessing(false);
        return;
      }

      await onBatchReconcile(matchesToReconcile, newAccountsToCreate);
      setFeedback({
        type: 'success',
        text: `${matchesToReconcile.length} lançamento(s) conciliados e atualizados com sucesso!`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Erro na conciliação em lote.' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div id="ofx-import-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div id="ofx-import-modal-card" className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950/60 to-slate-900 px-6 py-5 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Conciliação Bancária com Arquivos OFX / Extratos
              </h2>
              <p className="text-xs text-slate-400">
                Importe extratos de qualquer banco (Itaú, Bradesco, Santander, Nubank, Inter) para conferência automática.
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

        {/* Modal Main Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Top Bar: Bank & Company Selection + File Drop Zone */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Selects (4 cols) */}
            <div className="md:col-span-4 space-y-3 bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Empresa Destino
                </label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-emerald-500"
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
                  Conta Bancária no Sistema
                </label>
                <select
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="">Selecione a conta bancária...</option>
                  {availableBanks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nome_banco} ({b.tipo_conta})
                    </option>
                  ))}
                </select>
              </div>

              {statement && (
                <div className="mt-2 pt-3 border-t border-slate-700 text-xs text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Banco do Extrato:</span>
                    <span className="font-semibold text-slate-200">{statement.banco_nome}</span>
                  </div>
                  {statement.numero_conta && (
                    <div className="flex justify-between">
                      <span>Conta Detectada:</span>
                      <span className="font-mono text-slate-200">{statement.numero_conta}</span>
                    </div>
                  )}
                  {statement.saldo_final !== undefined && (
                    <div className="flex justify-between">
                      <span>Saldo no Extrato:</span>
                      <span className="font-bold text-emerald-400">
                        {statement.saldo_final.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Drop Zone (8 cols) */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`md:col-span-8 border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : statement
                  ? 'border-emerald-500/60 bg-emerald-500/5'
                  : 'border-slate-700 hover:border-slate-500 bg-slate-800/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".ofx,.qfx,.csv,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-full mb-2">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-white">
                {fileName ? fileName : 'Clique ou arraste seu arquivo OFX ou CSV bancário aqui'}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Formatos suportados: .OFX, .QFX, .CSV (Extratos bancários de qualquer banco)
              </p>
              {statement && (
                <div className="mt-3 text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full font-medium flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5" />
                  {statement.transacoes.length} transações prontas para conciliação
                </div>
              )}
            </div>
          </div>

          {/* Statement Reconciliation Table */}
          {statement && (
            <div className="space-y-4">
              {/* Summary Stats & Bulk Actions */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800/90 p-4 rounded-2xl border border-slate-700">
                {/* Stats Chips */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      filterType === 'all'
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    Todos ({stats.total})
                  </button>

                  <button
                    onClick={() => setFilterType('matched')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      filterType === 'matched'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Identificados ({stats.exact + stats.probable})
                  </button>

                  <button
                    onClick={() => setFilterType('unmatched')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      filterType === 'unmatched'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    Não Encontrados ({stats.none})
                  </button>
                </div>

                {/* Bulk Action Button */}
                {stats.exact > 0 && (
                  <button
                    id="btn-batch-auto-reconcile"
                    onClick={handleBatchAutoReconcile}
                    disabled={isProcessing}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    Conciliar Automaticamente {stats.exact} Identificados
                  </button>
                )}
              </div>

              {/* Transactions Comparison Grid */}
              <div className="space-y-2.5">
                {filteredCandidates.map((candidate, idx) => {
                  const trn = candidate.transaction;
                  const acc = candidate.matchedAccount;
                  const isCredit = trn.tipo === 'CREDIT';

                  return (
                    <div
                      key={trn.id || idx}
                      className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        candidate.actionTaken === 'RECONCILED'
                          ? 'bg-emerald-950/20 border-emerald-600/40'
                          : candidate.matchScore === 'EXACT'
                          ? 'bg-slate-800/90 border-emerald-500/50 hover:border-emerald-400'
                          : candidate.matchScore === 'PROBABLE'
                          ? 'bg-slate-800/90 border-amber-500/40 hover:border-amber-400'
                          : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600'
                      }`}
                    >
                      {/* Left: Extrato Info */}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isCredit ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                          }`}>
                            {isCredit ? 'CRÉDITO (Entrada)' : 'DÉBITO (Saída)'}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            {trn.data}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white leading-tight">
                          {trn.memo}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          FITID: {trn.fitid}
                        </div>
                      </div>

                      {/* Middle: Amount & Match Status */}
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-[11px] text-slate-400">Valor no Extrato</div>
                          <div className={`text-base font-extrabold ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {(isCredit ? '+' : '-') + trn.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                        </div>

                        <div className="min-w-[170px] text-xs">
                          {acc ? (
                            <div className="p-2 bg-slate-900/90 rounded-xl border border-slate-700/60">
                              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                                <span>No Sistema:</span>
                                <span className={acc.status === 'Pago' ? 'text-emerald-400' : 'text-amber-400'}>
                                  {acc.status}
                                </span>
                              </div>
                              <div className="font-semibold text-slate-200 line-clamp-1">
                                {acc.descricao}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                Venc: {acc.data_vencimento}
                              </div>
                            </div>
                          ) : (
                            <div className="p-2 bg-slate-900/40 rounded-xl border border-dashed border-slate-700 text-slate-500 text-center">
                              Não cadastrado no sistema
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 justify-end">
                        {acc ? (
                          acc.conciliado ? (
                            <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-1.5">
                              <Check className="w-4 h-4" />
                              Já Conciliado
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSingleReconcile(candidate)}
                              disabled={isProcessing}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Conciliar & Baixar
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => handleCreateAndReconcile(candidate)}
                            disabled={isProcessing}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Criar & Conciliar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-900 px-6 py-4 border-t border-slate-800 flex justify-between items-center">
          <div className="text-xs text-slate-400">
            A conciliação atualiza o status dos lançamentos e os vincula ao extrato oficial do banco.
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
