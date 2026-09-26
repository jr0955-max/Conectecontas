import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  BankAccount, 
  Company, 
  FinancialAccount, 
  OFXStatement, 
  OFXTransaction 
} from '../types';
import { parseOFX, parseBankCSV, isBankSweepTransaction } from '../utils/ofxParser';
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Sparkles, 
  Check, 
  CheckCheck,
  Plus, 
  Building2, 
  Calendar, 
  DollarSign, 
  RefreshCw, 
  X,
  FileCheck,
  Search,
  Filter,
  Loader2
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

/**
 * Categorização inteligente automática para lançamentos de extrato bancário
 */
function autoDetectCategory(memo: string, type: 'CREDIT' | 'DEBIT' | 'OTHER'): string {
  const sweep = isBankSweepTransaction(memo);
  if (sweep.isSweep) {
    return 'Aplicação/Resgate Automático (BB Rende Fácil)';
  }
  const m = (memo || '').toUpperCase();
  if (type === 'CREDIT') {
    if (m.includes('PIX') || m.includes('RECEB') || m.includes('CRED') || m.includes('VENDA') || m.includes('FATUR')) {
      return 'Vendas & Recebimentos';
    }
    if (m.includes('REND') || m.includes('APLIC') || m.includes('RESGATE') || m.includes('JUROS')) {
      return 'Rendimentos de Aplicação';
    }
    return 'Receitas Operacionais';
  } else {
    if (m.includes('TARIFA') || m.includes('TAXA') || m.includes('IOF') || m.includes('ANUIDADE') || m.includes('PACOTE')) {
      return 'Tarifas Bancárias';
    }
    if (m.includes('ENERGIA') || m.includes('LUZ') || m.includes('AGUA') || m.includes('TELEFONE') || m.includes('INTERNET')) {
      return 'Serviços Públicos & Utilidades';
    }
    if (m.includes('IMPOSTO') || m.includes('DARF') || m.includes('GPS') || m.includes('DAS') || m.includes('TRIB')) {
      return 'Impostos & Taxas';
    }
    if (m.includes('SALARIO') || m.includes('FOLHA') || m.includes('FGTS') || m.includes('BENEF') || m.includes('VALE')) {
      return 'Salários & Encargos';
    }
    if (m.includes('FORNEC') || m.includes('COMPRA') || m.includes('BOLETO')) {
      return 'Estoque & Fornecedores';
    }
    if (m.includes('ALUGUEL') || m.includes('CONDOM')) {
      return 'Aluguel & Instalações';
    }
    return 'Despesas Operacionais';
  }
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
    activeCompanyId > 0 ? Number(activeCompanyId) : (Number(companies[0]?.id) || 1)
  );

  // Sincroniza a empresa de destino sempre que o modal abre ou activeCompanyId muda
  useEffect(() => {
    if (isOpen) {
      if (activeCompanyId > 0 && companies.some((c) => Number(c.id) === Number(activeCompanyId))) {
        setSelectedCompanyId(Number(activeCompanyId));
      } else if (companies.length > 0 && !companies.some((c) => Number(c.id) === Number(selectedCompanyId))) {
        setSelectedCompanyId(Number(companies[0].id));
      }
    }
  }, [isOpen, activeCompanyId, companies]);

  const [filterType, setFilterType] = useState<'all' | 'unmatched' | 'matched' | 'reconciled' | 'sweep'>('all');
  const [ignoreSweepTransactions, setIgnoreSweepTransactions] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Seleção múltipla para aceitação em lote
  const [selectedFitids, setSelectedFitids] = useState<Set<string>>(new Set());
  // Registros conciliados ou criados localmente nesta sessão do modal
  const [locallyReconciledFitids, setLocallyReconciledFitids] = useState<Set<string>>(new Set());

  // Available banks for selected company
  const availableBanks = useMemo(() => {
    return bankAccounts.filter((b) => Number(b.empresa_id) === Number(selectedCompanyId));
  }, [bankAccounts, selectedCompanyId]);

  // Set default bank if available for the currently selected company
  useEffect(() => {
    if (availableBanks.length > 0) {
      const defaultBank = availableBanks.find((b) => b.padrao) || availableBanks[0];
      setSelectedBankId(String(defaultBank.id));
    } else {
      setSelectedBankId('');
    }
  }, [availableBanks, selectedCompanyId]);

  // Detecção inteligente de empresa pelo conteúdo do extrato (ex: se o extrato for de outra unidade)
  const suggestedCompany = useMemo(() => {
    if (!statement || statement.transacoes.length === 0) return null;
    const currentComp = companies.find((c) => Number(c.id) === Number(selectedCompanyId));
    const currentClean = (currentComp?.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const currentWords = currentClean.split(/\s+/).filter((w) => w.length >= 3);

    for (const comp of companies) {
      if (Number(comp.id) === Number(selectedCompanyId)) continue;
      const cleanName = (comp.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const keywords = cleanName.split(/\s+/).filter((w) => w.length >= 4 && !['ltda', 'eireli', 'me', 'epp', 's/a', 'sa', 'lave', 'pegue'].includes(w));
      for (const trn of statement.transacoes) {
        const memoNorm = (trn.memo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        for (const kw of keywords) {
          if (currentWords.some((cw) => cw.includes(kw) || kw.includes(cw))) continue;
          if (memoNorm.includes(kw)) {
            return {
              company: comp,
              keyword: kw,
              sampleMemo: trn.memo
            };
          }
        }
      }
    }
    return null;
  }, [statement, companies, selectedCompanyId]);

  // Company accounts available for matching (active company, not deleted)
  const activeCompanyAccounts = useMemo(() => {
    return accounts.filter((a) => Number(a.empresa_id) === Number(selectedCompanyId) && !a.excluido);
  }, [accounts, selectedCompanyId]);

  // Auto-Match Engine
  const matchCandidates: MatchCandidate[] = useMemo(() => {
    if (!statement || statement.transacoes.length === 0) return [];

    const candidates: MatchCandidate[] = [];
    const usedAccountIds = new Set<number>();

    statement.transacoes.forEach((trn) => {
      const isLocallyReconciled = locallyReconciledFitids.has(trn.fitid);
      const targetType = trn.tipo === 'CREDIT' ? 'receber' : 'pagar';
      const trnDate = new Date(trn.data).getTime();

      // 1. Check if already reconciled with this fitid
      const alreadyReconciled = activeCompanyAccounts.find(
        (a) => a.conciliado_fitid === trn.fitid || (a.conciliado && Math.abs(a.valor - trn.valor) < 0.01 && a.data_vencimento === trn.data)
      );

      if (alreadyReconciled || isLocallyReconciled) {
        if (alreadyReconciled) usedAccountIds.add(alreadyReconciled.id);
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
  }, [statement, activeCompanyAccounts, locallyReconciledFitids]);

  // Candidatos ainda não conciliados (excluindo aplicações automáticas se ignoreSweepTransactions estiver ativo)
  const pendingCandidates = useMemo(() => {
    return matchCandidates.filter((c) => {
      if (c.actionTaken === 'RECONCILED') return false;
      if (ignoreSweepTransactions && c.transaction.isSweep) return false;
      return true;
    });
  }, [matchCandidates, ignoreSweepTransactions]);

  // Contagem e métricas de varredura/sweep (BB Rende Fácil / Aplicação Automática)
  const sweepStats = useMemo(() => {
    if (!statement) return { count: 0, aplicacoes: 0, resgates: 0 };
    let count = 0;
    let aplicacoes = 0;
    let resgates = 0;
    statement.transacoes.forEach((trn) => {
      if (trn.isSweep) {
        count++;
        if (trn.tipo === 'DEBIT') aplicacoes += trn.valor;
        else resgates += trn.valor;
      }
    });
    return { count, aplicacoes, resgates };
  }, [statement]);

  // Totais operacionais reais (excluindo transferências internas de aplicação do banco)
  const operationalTotals = useMemo(() => {
    if (!statement) return { creditTotal: 0, debitTotal: 0, balance: 0 };
    let creditTotal = 0;
    let debitTotal = 0;
    statement.transacoes.forEach((trn) => {
      if (!trn.isSweep) {
        if (trn.tipo === 'CREDIT') creditTotal += trn.valor;
        else debitTotal += trn.valor;
      }
    });
    return { creditTotal, debitTotal, balance: creditTotal - debitTotal };
  }, [statement]);

  // Selecionar todos os pendentes automaticamente ao carregar um novo extrato
  useEffect(() => {
    if (statement && pendingCandidates.length > 0) {
      const pendingFitids = new Set(pendingCandidates.map((c) => c.transaction.fitid));
      setSelectedFitids(pendingFitids);
    }
  }, [statement, pendingCandidates.length]);

  const stats = useMemo(() => {
    const total = matchCandidates.length;
    const pending = pendingCandidates.length;
    const reconciled = total - pending;
    const exact = pendingCandidates.filter((c) => c.matchScore === 'EXACT').length;
    const probable = pendingCandidates.filter((c) => c.matchScore === 'PROBABLE').length;
    const none = pendingCandidates.filter((c) => c.matchScore === 'NONE').length;
    return { total, pending, reconciled, exact, probable, none };
  }, [matchCandidates, pendingCandidates]);

  // Filtered view of candidates
  const filteredCandidates = useMemo(() => {
    if (filterType === 'matched') {
      return matchCandidates.filter((c) => (c.matchScore === 'EXACT' || c.matchScore === 'PROBABLE') && (!ignoreSweepTransactions || !c.transaction.isSweep));
    }
    if (filterType === 'unmatched') {
      return matchCandidates.filter((c) => c.matchScore === 'NONE' && (!ignoreSweepTransactions || !c.transaction.isSweep));
    }
    if (filterType === 'reconciled') {
      return matchCandidates.filter((c) => c.actionTaken === 'RECONCILED');
    }
    if (filterType === 'sweep') {
      return matchCandidates.filter((c) => c.transaction.isSweep);
    }
    if (ignoreSweepTransactions) {
      return matchCandidates.filter((c) => !c.transaction.isSweep);
    }
    return matchCandidates;
  }, [matchCandidates, filterType, ignoreSweepTransactions]);

  if (!isOpen) return null;

  const handleFileProcess = (file: File) => {
    const reader = new FileReader();
    setFileName(file.name);
    setLocallyReconciledFitids(new Set());
    setSelectedFitids(new Set());

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

  // Alternar seleção de um item individual
  const handleToggleSelectOne = (fitid: string) => {
    setSelectedFitids((prev) => {
      const next = new Set(prev);
      if (next.has(fitid)) {
        next.delete(fitid);
      } else {
        next.add(fitid);
      }
      return next;
    });
  };

  // Alternar selecionar todos os itens pendentes
  const handleToggleSelectAll = () => {
    if (selectedFitids.size >= pendingCandidates.length) {
      setSelectedFitids(new Set());
    } else {
      setSelectedFitids(new Set(pendingCandidates.map((c) => c.transaction.fitid)));
    }
  };

  // Reconcile individual matched item
  const handleSingleReconcile = async (candidate: MatchCandidate) => {
    if (!candidate.matchedAccount || isProcessing) return;
    setIsProcessing(true);
    const safetyTimer = setTimeout(() => setIsProcessing(false), 4000);
    try {
      await Promise.race([
        onReconcileAccount(
          candidate.matchedAccount.id,
          candidate.transaction.fitid,
          selectedBankId ? Number(selectedBankId) : undefined
        ),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
      setLocallyReconciledFitids((prev) => new Set(prev).add(candidate.transaction.fitid));
      setSelectedFitids((prev) => {
        const next = new Set(prev);
        next.delete(candidate.transaction.fitid);
        return next;
      });
      setFeedback({
        type: 'success',
        text: `Lançamento "${candidate.matchedAccount.descricao}" aceito e conciliado com sucesso!`,
      });
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', text: err.message || 'Erro na conciliação.' });
    } finally {
      clearTimeout(safetyTimer);
      setIsProcessing(false);
    }
  };

  // Create new account from bank transaction and mark conciliated
  const handleCreateAndReconcile = async (candidate: MatchCandidate) => {
    if (isProcessing) return;
    const trn = candidate.transaction;
    setIsProcessing(true);
    const safetyTimer = setTimeout(() => setIsProcessing(false), 4000);
    try {
      const newAcc: Omit<FinancialAccount, 'id'> = {
        empresa_id: selectedCompanyId,
        tipo: trn.tipo === 'CREDIT' ? 'receber' : 'pagar',
        descricao: trn.memo || (trn.tipo === 'CREDIT' ? 'Recebimento via Extrato OFX' : 'Pagamento via Extrato OFX'),
        valor: trn.valor,
        data_vencimento: trn.data,
        status: 'Pago', // Baixado no banco
        categoria: autoDetectCategory(trn.memo, trn.tipo),
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

      await Promise.race([
        onCreateAndReconcile(newAcc),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
      setLocallyReconciledFitids((prev) => new Set(prev).add(trn.fitid));
      setSelectedFitids((prev) => {
        const next = new Set(prev);
        next.delete(trn.fitid);
        return next;
      });
      setFeedback({
        type: 'success',
        text: `Lançamento "${trn.memo}" aceito e importado para o sistema com sucesso!`,
      });
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', text: err.message || 'Erro ao criar lançamento.' });
    } finally {
      clearTimeout(safetyTimer);
      setIsProcessing(false);
    }
  };

  // BOTÃO PRINCIPAL: Aceitar Todos ou Selecionados em Lote
  const handleAcceptSelectedOrAll = async (onlySelected: boolean = true) => {
    if (isProcessing) return;
    setIsProcessing(true);
    const safetyTimer = setTimeout(() => setIsProcessing(false), 4500);
    try {
      const matchesToReconcile: { accountId: number; fitid: string; bankId?: number }[] = [];
      const newAccountsToCreate: Omit<FinancialAccount, 'id'>[] = [];
      const fitidsProcessed: string[] = [];

      const candidatesToProcess = matchCandidates.filter((c) => {
        if (c.actionTaken === 'RECONCILED' || locallyReconciledFitids.has(c.transaction.fitid)) return false;
        if (ignoreSweepTransactions && c.transaction.isSweep && !selectedFitids.has(c.transaction.fitid)) return false;
        if (onlySelected && selectedFitids.size > 0 && !selectedFitids.has(c.transaction.fitid)) return false;
        return true;
      });

      if (candidatesToProcess.length === 0) {
        setFeedback({
          type: 'error',
          text: 'Nenhum lançamento pendente selecionado para aceitar.',
        });
        clearTimeout(safetyTimer);
        setIsProcessing(false);
        return;
      }

      candidatesToProcess.forEach((c) => {
        const trn = c.transaction;
        fitidsProcessed.push(trn.fitid);

        if (c.matchedAccount) {
          // Lançamento identificado -> concilia e baixa conta existente
          matchesToReconcile.push({
            accountId: c.matchedAccount.id,
            fitid: trn.fitid,
            bankId: selectedBankId ? Number(selectedBankId) : undefined,
          });
        } else {
          // Lançamento novo -> cria como pago e conciliado no sistema
          newAccountsToCreate.push({
            empresa_id: selectedCompanyId,
            tipo: trn.tipo === 'CREDIT' ? 'receber' : 'pagar',
            descricao: trn.memo || (trn.tipo === 'CREDIT' ? 'Recebimento via Extrato OFX' : 'Pagamento via Extrato OFX'),
            valor: Number(trn.valor),
            data_vencimento: trn.data,
            status: 'Pago',
            categoria: autoDetectCategory(trn.memo, trn.tipo),
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
          });
        }
      });

      await Promise.race([
        onBatchReconcile(matchesToReconcile, newAccountsToCreate),
        new Promise((resolve) => setTimeout(resolve, 3500)),
      ]);

      setLocallyReconciledFitids((prev) => {
        const next = new Set(prev);
        fitidsProcessed.forEach((f) => next.add(f));
        return next;
      });
      setSelectedFitids(new Set());

      setFeedback({
        type: 'success',
        text: `Parabéns! ${candidatesToProcess.length} lançamento(s) foram aceitos com sucesso! (${matchesToReconcile.length} conciliados com existentes e ${newAccountsToCreate.length} novos cadastrados).`,
      });
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', text: err.message || 'Erro ao aceitar lançamentos em lote.' });
    } finally {
      clearTimeout(safetyTimer);
      setIsProcessing(false);
    }
  };

  // Conciliar apenas correspondências exatas identificadas
  const handleBatchAutoReconcile = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    const safetyTimer = setTimeout(() => setIsProcessing(false), 4500);
    try {
      const matchesToReconcile: { accountId: number; fitid: string; bankId?: number }[] = [];
      const newAccountsToCreate: Omit<FinancialAccount, 'id'>[] = [];
      const fitidsProcessed: string[] = [];

      matchCandidates.forEach((c) => {
        if (c.actionTaken === 'RECONCILED' || locallyReconciledFitids.has(c.transaction.fitid)) return;

        if (c.matchScore === 'EXACT' && c.matchedAccount) {
          matchesToReconcile.push({
            accountId: c.matchedAccount.id,
            fitid: c.transaction.fitid,
            bankId: selectedBankId ? Number(selectedBankId) : undefined,
          });
          fitidsProcessed.push(c.transaction.fitid);
        }
      });

      if (matchesToReconcile.length === 0) {
        setFeedback({ type: 'error', text: 'Nenhuma correspondência exata pendente para conciliar.' });
        clearTimeout(safetyTimer);
        setIsProcessing(false);
        return;
      }

      await Promise.race([
        onBatchReconcile(matchesToReconcile, newAccountsToCreate),
        new Promise((resolve) => setTimeout(resolve, 3500)),
      ]);
      setLocallyReconciledFitids((prev) => {
        const next = new Set(prev);
        fitidsProcessed.forEach((f) => next.add(f));
        return next;
      });

      setFeedback({
        type: 'success',
        text: `${matchesToReconcile.length} lançamento(s) identificados foram conciliados e atualizados com sucesso!`,
      });
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', text: err.message || 'Erro na conciliação em lote.' });
    } finally {
      clearTimeout(safetyTimer);
      setIsProcessing(false);
    }
  };

  const selectedCount = selectedFitids.size;
  const pendingCount = stats.pending;

  return (
    <div id="ofx-import-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
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
                Importe extratos de qualquer banco (Itaú, Bradesco, Santander, Nubank, Inter, Caixa, BB) para conferência e aceitação automática.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
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
              <div className="bg-slate-900/90 p-3 rounded-xl border border-emerald-500/30">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    Empresa Destino
                  </label>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                    Obrigatório
                  </span>
                </div>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-3 py-2 text-sm text-white font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} {Number(c.id) === Number(activeCompanyId) ? ' (Empresa Atual Selecionada)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-tight">
                  Todos os lançamentos do arquivo serão cadastrados para esta empresa.
                </p>
              </div>

              {/* Banner de sugestão inteligente quando o arquivo detecta menção a outra empresa */}
              {suggestedCompany && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-white">Extrato de outra empresa detectado?</p>
                      <p className="text-amber-300/90 text-[11px] mt-0.5">
                        Identificamos movimentações referentes a <strong>"{suggestedCompany.company.nome}"</strong> no extrato ({suggestedCompany.sampleMemo}).
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCompanyId(suggestedCompany.company.id)}
                    className="w-full py-1.5 px-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                    <span>Mudar destino para {suggestedCompany.company.nome}</span>
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Conta Bancária no Sistema
                </label>
                <select
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
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
                  {statement.transacoes.length} transações lidas do arquivo
                </div>
              )}
            </div>
          </div>

          {/* Statement Reconciliation Table */}
          {statement && (
            <div className="space-y-4">
              {/* BANNER INFORMATIVO BANCO DO BRASIL: BB RENDE FÁCIL / APLICAÇÃO AUTOMÁTICA */}
              {sweepStats.count > 0 && (
                <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-purple-950/60 border border-purple-500/40 rounded-2xl p-4 sm:p-5 text-xs space-y-3 shadow-lg shadow-purple-950/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-purple-500/20 text-purple-300 rounded-xl border border-purple-500/40">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          Extrato com BB Rende Fácil / Aplicação Automática ({sweepStats.count} movimentações)
                        </h4>
                        <p className="text-[11px] text-purple-300/80">
                          Transferências automáticas internas entre conta corrente e investimento do Banco do Brasil
                        </p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2.5 bg-purple-900/50 hover:bg-purple-900/80 px-3.5 py-2 rounded-xl border border-purple-500/40 cursor-pointer text-purple-200 font-semibold select-none transition-all">
                      <input
                        type="checkbox"
                        checked={ignoreSweepTransactions}
                        onChange={(e) => setIgnoreSweepTransactions(e.target.checked)}
                        className="rounded border-purple-400 text-purple-500 focus:ring-purple-400 w-4 h-4 cursor-pointer"
                      />
                      <span>Ignorar Aplicações/Resgates Automáticos (Recomendado)</span>
                    </label>
                  </div>

                  <p className="text-slate-300 leading-relaxed text-[11px] bg-slate-900/80 p-3 rounded-xl border border-purple-500/20">
                    💡 <strong>Por que o Banco do Brasil tem créditos e débitos iguais no extrato?</strong><br />
                    No BB com aplicação diária ativa, todo o saldo excedente do dia é aplicado automaticamente (saída para investimento) e resgatado automaticamente para cobrir pagamentos (entrada). Por isso a soma total de saídas e entradas do extrato bruto é idêntica! Deixando as aplicações desmarcadas, seu <strong>Contas a Pagar</strong> conterá apenas despesas reais com fornecedores e o <strong>Contas a Receber</strong> apenas vendas reais de clientes.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-700/80">
                      <span className="text-[10px] text-slate-400 block">Receitas Reais (Clientes):</span>
                      <span className="font-bold text-emerald-400 text-sm">
                        {operationalTotals.creditTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-700/80">
                      <span className="text-[10px] text-slate-400 block">Despesas Reais (Pagas):</span>
                      <span className="font-bold text-rose-400 text-sm">
                        {operationalTotals.debitTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-700/80">
                      <span className="text-[10px] text-purple-300 block">Aplicações BB Rende Fácil:</span>
                      <span className="font-semibold text-purple-300 text-sm">
                        {sweepStats.aplicacoes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-700/80">
                      <span className="text-[10px] text-purple-300 block">Resgates BB Rende Fácil:</span>
                      <span className="font-semibold text-purple-300 text-sm">
                        {sweepStats.resgates.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Stats & Bulk Actions */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800/90 p-4 rounded-2xl border border-slate-700">
                {/* Stats Chips & Select All */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {/* Select All Checkbox */}
                  {pendingCount > 0 && (
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 bg-slate-900/90 hover:bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl cursor-pointer select-none transition-colors">
                      <input
                        type="checkbox"
                        checked={pendingCount > 0 && selectedCount === pendingCount}
                        onChange={handleToggleSelectAll}
                        className="rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 cursor-pointer w-3.5 h-3.5"
                      />
                      <span>Selecionar Todos ({selectedCount}/{pendingCount})</span>
                    </label>
                  )}

                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      filterType === 'all'
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    Todos ({ignoreSweepTransactions ? stats.total - sweepStats.count : stats.total})
                  </button>

                  <button
                    onClick={() => setFilterType('matched')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      filterType === 'unmatched'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    Novos no Sistema ({stats.none})
                  </button>

                  {sweepStats.count > 0 && (
                    <button
                      onClick={() => setFilterType('sweep')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        filterType === 'sweep'
                          ? 'bg-purple-600 text-white'
                          : 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      BB Rende Fácil ({sweepStats.count})
                    </button>
                  )}

                  {stats.reconciled > 0 && (
                    <button
                      onClick={() => setFilterType('reconciled')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        filterType === 'reconciled'
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-900 text-emerald-400/80 hover:text-emerald-300'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Já Conciliados ({stats.reconciled})
                    </button>
                  )}
                </div>

                {/* Bulk Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* BOTÃO PRINCIPAL: ACEITAR LANÇAMENTOS */}
                  {pendingCount > 0 && (
                    <button
                      id="btn-accept-all-ofx"
                      onClick={() => handleAcceptSelectedOrAll(selectedCount > 0)}
                      disabled={isProcessing}
                      className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer transform active:scale-95"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Aceitando Lançamentos...</span>
                        </>
                      ) : (
                        <>
                          <CheckCheck className="w-4 h-4" />
                          <span>
                            {selectedCount > 0 && selectedCount < pendingCount
                              ? `Aceitar ${selectedCount} Lançamento(s) Selecionado(s)`
                              : `Aceitar Todos os Lançamentos (${pendingCount})`}
                          </span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Botão Secundário: Conciliar Somente Identificados */}
                  {stats.exact > 0 && (
                    <button
                      id="btn-batch-auto-reconcile"
                      onClick={handleBatchAutoReconcile}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                      title="Concilia apenas as contas que já possuem lançamento correspondente no sistema"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Conciliar {stats.exact} Identificados</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Transactions Comparison Grid */}
              <div className="space-y-2.5">
                {filteredCandidates.map((candidate, idx) => {
                  const trn = candidate.transaction;
                  const acc = candidate.matchedAccount;
                  const isCredit = trn.tipo === 'CREDIT';
                  const isReconciled = candidate.actionTaken === 'RECONCILED' || locallyReconciledFitids.has(trn.fitid);
                  const isSelected = selectedFitids.has(trn.fitid);

                  return (
                    <div
                      key={trn.id || trn.fitid || idx}
                      className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isReconciled
                          ? 'bg-emerald-950/20 border-emerald-600/40 opacity-80'
                          : candidate.matchScore === 'EXACT'
                          ? 'bg-slate-800/90 border-emerald-500/50 hover:border-emerald-400'
                          : candidate.matchScore === 'PROBABLE'
                          ? 'bg-slate-800/90 border-amber-500/40 hover:border-amber-400'
                          : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600'
                      }`}
                    >
                      {/* Checkbox de seleção */}
                      <div className="flex items-start md:items-center gap-3 flex-1">
                        {!isReconciled ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOne(trn.fitid)}
                            className="mt-1 md:mt-0 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 cursor-pointer w-4 h-4 shrink-0"
                            title="Selecionar para aceitar"
                          />
                        ) : (
                          <div className="w-4 h-4 flex items-center justify-center shrink-0 text-emerald-400">
                            <Check className="w-4 h-4" />
                          </div>
                        )}

                        {/* Extrato Info */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isCredit ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                            }`}>
                              {isCredit ? 'CRÉDITO (Entrada)' : 'DÉBITO (Saída)'}
                            </span>
                            {trn.isSweep && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-purple-400" />
                                {trn.sweepType === 'resgate' ? 'BB Rende Fácil (Resgate)' : 'BB Rende Fácil (Aplicação)'}
                              </span>
                            )}
                            <span className="text-xs text-slate-400 font-mono">
                              {trn.data}
                            </span>
                            <span className="text-[10px] bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded">
                              {autoDetectCategory(trn.memo, trn.tipo)}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-white leading-tight">
                            {trn.memo}
                          </div>
                          {trn.isSweep && (
                            <div className="text-[11px] text-purple-300/90 font-medium">
                              Movimentação interna de aplicação/resgate do Banco do Brasil (não é conta a pagar nem a receber operacional).
                            </div>
                          )}
                          <div className="text-xs text-slate-400 font-mono">
                            FITID: {trn.fitid}
                          </div>
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
                            <div className="p-2 bg-slate-900/40 rounded-xl border border-dashed border-slate-700 text-slate-400 text-center flex flex-col gap-0.5">
                              <span className="text-[11px] font-semibold text-slate-300">Novo Lançamento</span>
                              <span className="text-[10px] text-slate-500">Será criado e conciliado</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 justify-end">
                        {isReconciled ? (
                          <span className="px-3.5 py-1.5 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-emerald-500/30">
                            <Check className="w-4 h-4" />
                            Aceito & Conciliado
                          </span>
                        ) : acc ? (
                          <button
                            onClick={() => handleSingleReconcile(candidate)}
                            disabled={isProcessing}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                            title="Aceitar e conciliar com a conta existente no sistema"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Aceitar & Conciliar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCreateAndReconcile(candidate)}
                            disabled={isProcessing}
                            className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                            title="Aceitar e cadastrar como novo lançamento pago no sistema"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Aceitar Lançamento
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
        <div className="bg-slate-900 px-6 py-4 border-t border-slate-800 flex flex-wrap justify-between items-center gap-3">
          <div className="text-xs text-slate-400">
            A conciliação aceita e baixa os lançamentos, vinculando-os ao extrato oficial bancário.
          </div>
          <div className="flex items-center gap-2">
            {statement && pendingCount > 0 && (
              <button
                id="btn-footer-accept-all"
                onClick={() => handleAcceptSelectedOrAll(selectedCount > 0)}
                disabled={isProcessing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-600/30"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <CheckCheck className="w-4 h-4" />
                    <span>
                      {selectedCount > 0 && selectedCount < pendingCount
                        ? `Aceitar Selecionados (${selectedCount})`
                        : `Aceitar Todos os Lançamentos (${pendingCount})`}
                    </span>
                  </>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
