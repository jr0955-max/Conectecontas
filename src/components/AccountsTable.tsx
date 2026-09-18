import React, { useState, useEffect, useMemo } from 'react';
import { 
  FinancialAccount, 
  AccountType, 
  AccountStatus,
  DEFAULT_CATEGORIES,
  Company,
  BankAccount,
  CostCenter,
  User,
  getUserEffectivePermissions
} from '../types';
import { 
  Plus, 
  Search, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  ArrowDownCircle, 
  ArrowUpCircle,
  Filter,
  Calendar,
  Layers,
  Tag,
  Download,
  Upload,
  Building2,
  Check,
  X,
  Edit2,
  Save,
  ArrowRight,
  History,
  CreditCard,
  Repeat,
  FileSpreadsheet,
  TrendingUp,
  PieChart,
  Landmark,
  ShieldCheck,
  Eye,
  Lock,
  Webhook,
  Zap,
  QrCode,
  Barcode,
  Send,
  FileText,
  Camera,
} from 'lucide-react';
import { BankPaymentModal } from './BankPaymentModal';
import { CameraScannerModal } from './CameraScannerModal';

interface AccountsTableProps {
  accounts: FinancialAccount[];
  empresaId: number;
  companies?: Company[];
  bankAccounts?: BankAccount[];
  costCenters?: CostCenter[];
  currentUser?: User;
  onAddAccount: (account: Omit<FinancialAccount, 'id'>) => void;
  onEditAccount?: (account: FinancialAccount) => void;
  onToggleStatus: (id: number) => void;
  onDeleteAccount: (id: number) => void;
  onAccountPaidViaBank?: (result: any) => void;
  onBulkImportAccounts?: (imported: Omit<FinancialAccount, 'id'>[]) => void;
  onOpenCsvModal?: (initialTab?: 'export' | 'import') => void;
  onOpenSqliteModal?: () => void;
  onSelectCompany?: (id: number) => void;
  onOpenAccountHistory?: (account: FinancialAccount) => void;
  onOpenRecurringModal?: () => void;
  onOpenOfxModal?: () => void;
  onOpenBankAccountsModal?: () => void;
  onOpenCostCentersModal?: () => void;
  onOpenCashflowModal?: () => void;
  onOpenWebhookSimulator?: () => void;
  forcedTab?: 'all' | 'pagar' | 'receber';
  isConsolidated?: boolean;
}

export const AccountsTable: React.FC<AccountsTableProps> = ({
  accounts,
  empresaId,
  companies = [],
  bankAccounts = [],
  costCenters = [],
  currentUser,
  onAddAccount,
  onEditAccount,
  onToggleStatus,
  onDeleteAccount,
  onAccountPaidViaBank,
  onOpenCsvModal,
  onSelectCompany,
  onOpenAccountHistory,
  onOpenRecurringModal,
  onOpenOfxModal,
  onOpenBankAccountsModal,
  onOpenCostCentersModal,
  onOpenCashflowModal,
  forcedTab = 'all',
  isConsolidated = false,
}) => {
  const isMaster = Boolean(
    currentUser?.is_master || 
    Number(currentUser?.id) === 1 || 
    currentUser?.email?.toLowerCase() === 'admin@financeiro.com'
  );

  const permissions = useMemo(() => {
    return getUserEffectivePermissions(currentUser);
  }, [currentUser]);

  const isReadOnly = currentUser?.role === 'leitor' || (!permissions.pode_adicionar_contas && !permissions.pode_editar_contas);
  const [activeTab, setActiveTab] = useState<'all' | 'pagar' | 'receber'>(
    forcedTab || 'all'
  );
  const [formTipo, setFormTipo] = useState<AccountType>('pagar');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
  const [bankFilter, setBankFilter] = useState<string>('Todos');
  const [costCenterFilter, setCostCenterFilter] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('Todos');

  // Banking Payment Modal & Receipt Modal state
  const [payingAccount, setPayingAccount] = useState<FinancialAccount | null>(null);
  const [viewingReceiptAccount, setViewingReceiptAccount] = useState<FinancialAccount | null>(null);

  // Edit Account Modal state
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [editDescricao, setEditDescricao] = useState('');
  const [editValor, setEditValor] = useState('');
  const [editDataVencimento, setEditDataVencimento] = useState('');
  const [editTipo, setEditTipo] = useState<AccountType>('pagar');
  const [editStatus, setEditStatus] = useState<AccountStatus>('Pendente');
  const [editCategoria, setEditCategoria] = useState('Geral');
  const [editEmpresaId, setEditEmpresaId] = useState<number>(1);
  const [editBancoId, setEditBancoId] = useState<string>('');
  const [editCentroCustoId, setEditCentroCustoId] = useState<string>('');
  const [editObservacoes, setEditObservacoes] = useState('');
  const [editChavePix, setEditChavePix] = useState('');
  const [editCodigoBarras, setEditCodigoBarras] = useState('');
  const [editError, setEditError] = useState('');

  // Transfer Feedback Banner State
  const [transferNotification, setTransferNotification] = useState<{
    descricao: string;
    fromName: string;
    toName: string;
    toId: number;
  } | null>(null);

  // Custom Categories list
  const [categoryList, setCategoryList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('fin_custom_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.from(new Set([...DEFAULT_CATEGORIES, ...parsed]));
      }
    } catch {}
    return DEFAULT_CATEGORIES;
  });

  // Form states for quick add
  const [formEmpresaId, setFormEmpresaId] = useState<number>(
    empresaId > 0 ? empresaId : (companies[0]?.id || 1)
  );
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataVencimento, setDataVencimento] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [status, setStatus] = useState<AccountStatus>('Pendente');
  const [selectedCategoria, setSelectedCategoria] = useState('Geral');
  const [selectedBancoId, setSelectedBancoId] = useState<string>('');
  const [selectedCentroCustoId, setSelectedCentroCustoId] = useState<string>('');
  const [formChavePix, setFormChavePix] = useState('');
  const [formCodigoBarras, setFormCodigoBarras] = useState('');
  const [showBankingFields, setShowBankingFields] = useState(false);

  // Scanner state for table / edit modal
  const [isTableScannerOpen, setIsTableScannerOpen] = useState(false);
  const [tableScannerMode, setTableScannerMode] = useState<'pix' | 'boleto'>('pix');
  const [tableScannerTarget, setTableScannerTarget] = useState<'edit' | 'form'>('edit');
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Available banks and cost centers for active form company
  const availableBanks = bankAccounts.filter((b) => b.empresa_id === formEmpresaId);
  const availableCostCenters = costCenters.filter((cc) => cc.empresa_id === 0 || cc.empresa_id === formEmpresaId);

  // Update target empresaId if prop changes
  useEffect(() => {
    if (empresaId > 0) {
      setFormEmpresaId(empresaId);
    } else if (companies.length > 0) {
      setFormEmpresaId(companies[0].id);
    }
  }, [empresaId, companies]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Sync forcedTab if provided
  useEffect(() => {
    if (forcedTab === 'pagar' || forcedTab === 'receber' || forcedTab === 'all') {
      setActiveTab(forcedTab);
    }
  }, [forcedTab]);

  // Handle adding a new custom category
  const handleAddNewCategory = (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCategoryName.trim();
    if (!cleanName) return;

    if (!categoryList.includes(cleanName)) {
      const updated = [...categoryList, cleanName];
      setCategoryList(updated);
      try {
        localStorage.setItem('fin_custom_categories', JSON.stringify(updated));
      } catch {}
    }

    setSelectedCategoria(cleanName);
    setNewCategoryName('');
    setIsCreatingNewCategory(false);
  };

  // Filter accounts by activeTab and exclude soft-deleted accounts
  const currentAccounts = accounts.filter((a) => !a.excluido && (activeTab === 'all' || a.tipo === activeTab));

  // Extract unique available months for filtering
  const availableMonths = Array.from(
    new Set(currentAccounts.map((a) => a.data_vencimento ? a.data_vencimento.substring(0, 7) : '').filter(Boolean))
  ).sort().reverse();

  // Extract unique categories available in existing data
  const availableCategories = Array.from(
    new Set([...categoryList, ...currentAccounts.map(a => a.categoria).filter(Boolean) as string[]])
  ).sort();

  // Apply search, status, category, bank, cost center, and month filters
  const filteredAccounts = currentAccounts.filter((acc) => {
    const matchesStatus =
      statusFilter === 'Todos' || acc.status === statusFilter;
    const matchesCategory =
      categoryFilter === 'Todas' || (acc.categoria || 'Geral') === categoryFilter;
    const matchesBank =
      bankFilter === 'Todos' || String(acc.banco_id || '') === bankFilter;
    const matchesCostCenter =
      costCenterFilter === 'Todos' || String(acc.centro_custo_id || '') === costCenterFilter;
    const matchesSearch =
      acc.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (acc.categoria && acc.categoria.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesMonth =
      selectedMonth === 'Todos' || acc.data_vencimento.startsWith(selectedMonth);

    return matchesStatus && matchesCategory && matchesBank && matchesCostCenter && matchesSearch && matchesMonth;
  });

  // Calculate monthly cashflow for the mini visual chart (excluding soft-deleted)
  const monthlyFlowMap = new Map<string, { mes: string; pagar: number; receber: number }>();
  accounts.filter((a) => !a.excluido).forEach((acc) => {
    const m = acc.data_vencimento ? acc.data_vencimento.substring(0, 7) : '';
    if (!m) return;
    if (!monthlyFlowMap.has(m)) {
      monthlyFlowMap.set(m, { mes: m, pagar: 0, receber: 0 });
    }
    const curr = monthlyFlowMap.get(m)!;
    if (acc.tipo === 'pagar') curr.pagar += acc.valor;
    else curr.receber += acc.valor;
  });

  const sortedFlow = Array.from(monthlyFlowMap.values()).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-4);
  const maxFlowVal = Math.max(...sortedFlow.map(f => Math.max(f.pagar, f.receber)), 1);

  const totalGastosGerais = accounts.filter(a => a.tipo === 'pagar' && !a.excluido).reduce((s, a) => s + a.valor, 0);
  const totalReceitasGerais = accounts.filter(a => a.tipo === 'receber' && !a.excluido).reduce((s, a) => s + a.valor, 0);
  const qtdMesesGerais = monthlyFlowMap.size || 1;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) return;
    
    const parsedValor = parseFloat(valor.replace(',', '.'));
    if (isNaN(parsedValor) || parsedValor <= 0) return;

    onAddAccount({
      empresa_id: formEmpresaId,
      tipo: activeTab === 'all' ? formTipo : activeTab,
      descricao: descricao.trim(),
      valor: parsedValor,
      data_vencimento: dataVencimento,
      status: status,
      categoria: selectedCategoria.trim() || 'Geral',
      banco_id: selectedBancoId ? Number(selectedBancoId) : undefined,
      centro_custo_id: selectedCentroCustoId ? Number(selectedCentroCustoId) : undefined,
      chave_pix: formChavePix.trim() || undefined,
      codigo_barras: formCodigoBarras.trim() || undefined,
    });

    // Reset form
    setDescricao('');
    setValor('');
    setFormChavePix('');
    setFormCodigoBarras('');
    setShowBankingFields(false);
    setSelectedBancoId('');
    setSelectedCentroCustoId('');
    setStatus('Pendente');
  };

  const handleOpenEdit = (acc: FinancialAccount) => {
    setEditingAccount(acc);
    setEditDescricao(acc.descricao);
    setEditValor(acc.valor.toString());
    setEditDataVencimento(acc.data_vencimento || new Date().toISOString().split('T')[0]);
    setEditTipo(acc.tipo);
    setEditStatus(acc.status);
    setEditCategoria(acc.categoria || 'Geral');
    setEditEmpresaId(Number(acc.empresa_id || (companies[0]?.id || 1)));
    setEditBancoId(acc.banco_id ? String(acc.banco_id) : '');
    setEditCentroCustoId(acc.centro_custo_id ? String(acc.centro_custo_id) : '');
    setEditObservacoes(acc.observacoes || '');
    setEditChavePix(acc.chave_pix || '');
    setEditCodigoBarras(acc.codigo_barras || '');
    setEditError('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    if (!editDescricao.trim()) {
      setEditError('A descrição é obrigatória.');
      return;
    }

    const parsedVal = parseFloat(editValor.toString().replace(',', '.'));
    if (isNaN(parsedVal) || parsedVal <= 0) {
      setEditError('Informe um valor numérico válido maior que zero.');
      return;
    }

    const targetEmpresaId = Number(editEmpresaId);
    const oldEmpresaId = Number(editingAccount.empresa_id);

    if (onEditAccount) {
      onEditAccount({
        ...editingAccount,
        id: Number(editingAccount.id),
        empresa_id: targetEmpresaId,
        tipo: editTipo,
        descricao: editDescricao.trim(),
        valor: parsedVal,
        data_vencimento: editDataVencimento,
        status: editStatus,
        categoria: editCategoria.trim() || 'Geral',
        banco_id: editBancoId ? Number(editBancoId) : undefined,
        centro_custo_id: editCentroCustoId ? Number(editCentroCustoId) : undefined,
        chave_pix: editChavePix.trim() || undefined,
        codigo_barras: editCodigoBarras.trim() || undefined,
        observacoes: editObservacoes.trim() || undefined,
      });
    }

    if (targetEmpresaId !== oldEmpresaId) {
      const fromComp = companies.find((c) => Number(c.id) === oldEmpresaId);
      const toComp = companies.find((c) => Number(c.id) === targetEmpresaId);
      setTransferNotification({
        descricao: editDescricao.trim(),
        fromName: fromComp?.nome || `Empresa #${oldEmpresaId}`,
        toName: toComp?.nome || `Empresa #${targetEmpresaId}`,
        toId: targetEmpresaId,
      });
      setTimeout(() => {
        setTransferNotification(null);
      }, 9000);
    }

    setEditingAccount(null);
  };

  return (
    <div className="space-y-6">
      {/* Transfer Notification Banner */}
      {transferNotification && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-100 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-sm">Lançamento Realocado com Sucesso!</p>
              <p className="text-emerald-800 dark:text-emerald-300">
                O lançamento <strong>"{transferNotification.descricao}"</strong> foi movido para a empresa <strong>{transferNotification.toName}</strong> e sincronizado em tempo real na nuvem.
              </p>
            </div>
          </div>
          {onSelectCompany && empresaId !== -1 && empresaId !== transferNotification.toId && (
            <button
              type="button"
              id="btn-goto-transferred-company"
              onClick={() => {
                onSelectCompany(transferNotification.toId);
                setTransferNotification(null);
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <span>Alternar para {transferNotification.toName}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
      
      {/* 1. Quick Add Transaction Form (Clean Minimalism Card with Category) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-100 dark:border-slate-800 p-5 transition-colors">
        
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${
              activeTab === 'pagar' ? 'bg-rose-500' : 'bg-blue-600'
            }`}>
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Novo Lançamento Financeiro
              </h3>
              <p className="text-xs text-gray-400">
                Cadastre despesas ou receitas com categorização e integração ao SQLite
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Action Tools: Recorrentes, OFX, Bancos, Centros de Custo, Projeção */}
            {onOpenRecurringModal && permissions.pode_adicionar_contas && (
              <button
                type="button"
                id="btn-quick-recurring"
                onClick={onOpenRecurringModal}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Lançamentos Recorrentes & Parcelamento Automático"
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>Parcelar / Recorrente</span>
              </button>
            )}

            {onOpenOfxModal && permissions.pode_importar_extrato && (
              <button
                type="button"
                id="btn-quick-ofx"
                onClick={onOpenOfxModal}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Conciliação Bancária com Leitor OFX / Extratos"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Conciliação OFX</span>
              </button>
            )}

            {onOpenCashflowModal && permissions.pode_ver_projecao && (
              <button
                type="button"
                id="btn-quick-cashflow"
                onClick={onOpenCashflowModal}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Fluxo de Caixa Projetado (30/60/90 dias)"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Fluxo Projetado</span>
              </button>
            )}

            {/* Quick CSV Export/Import Buttons */}
            {onOpenCsvModal && (
              <div className="flex items-center gap-1.5">
                {permissions.pode_adicionar_contas && (
                  <button
                    type="button"
                    id="btn-quick-import-csv"
                    onClick={() => onOpenCsvModal('import')}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Importar planilha Excel / CSV"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Importar CSV</span>
                  </button>
                )}

                {permissions.pode_exportar_relatorios && (
                  <button
                    type="button"
                    id="btn-quick-export-csv"
                    onClick={() => onOpenCsvModal('export')}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Exportar para Excel / CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Exportar CSV</span>
                  </button>
                )}
              </div>
            )}

            {/* Toggle Type Selector Pills */}
            <div className="inline-flex rounded-lg p-1 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
              <button
                id="type-pill-pagar"
                type="button"
                onClick={() => {
                  setFormTipo('pagar');
                  if (activeTab !== 'all') setActiveTab('pagar');
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  (activeTab === 'all' ? formTipo === 'pagar' : activeTab === 'pagar')
                    ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <ArrowDownCircle className="w-3.5 h-3.5" />
                <span>Nova Despesa</span>
              </button>

              <button
                id="type-pill-receber"
                type="button"
                onClick={() => {
                  setFormTipo('receber');
                  if (activeTab !== 'all') setActiveTab('receber');
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  (activeTab === 'all' ? formTipo === 'receber' : activeTab === 'receber')
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <ArrowUpCircle className="w-3.5 h-3.5" />
                <span>Nova Receita</span>
              </button>
            </div>
          </div>
        </div>

        {permissions.pode_adicionar_contas ? (
        <form onSubmit={handleFormSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          
          {/* Se estiver no modo consolidado, exibe seletor de empresa */}
          {isConsolidated && companies.length > 0 && (
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-blue-500" />
                <span>Empresa / Filial *</span>
              </label>
              <select
                id="select-form-company"
                value={formEmpresaId}
                onChange={(e) => setFormEmpresaId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          )}

          {/* Descrição */}
          <div className={isConsolidated ? "lg:col-span-3" : "lg:col-span-3"}>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Descrição do Lançamento *
            </label>
            <input
              id="input-desc"
              type="text"
              required
              placeholder={activeTab === 'pagar' ? 'Ex: Pagamento Servidores AWS' : 'Ex: Consultoria Mobile App'}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
            />
          </div>

          {/* Categoria / Nova Categoria */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <Tag className="w-3 h-3 text-indigo-500" />
                <span>Categoria</span>
              </label>
              {!isCreatingNewCategory && (
                <button
                  type="button"
                  id="btn-open-new-category"
                  onClick={() => setIsCreatingNewCategory(true)}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  + Nova
                </button>
              )}
            </div>

            {isCreatingNewCategory ? (
              <div className="flex items-center gap-1.5">
                <input
                  id="input-new-category-name"
                  type="text"
                  placeholder="Nome da categoria..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewCategory(e);
                    }
                  }}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddNewCategory}
                  className="p-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                  title="Salvar Categoria"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingNewCategory(false)}
                  className="p-1.5 rounded-md bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 cursor-pointer"
                  title="Cancelar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <select
                id="select-categoria"
                value={selectedCategoria}
                onChange={(e) => {
                  if (e.target.value === '__NEW__') {
                    setIsCreatingNewCategory(true);
                  } else {
                    setSelectedCategoria(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="Geral">Geral</option>
                {categoryList.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="__NEW__">+ Nova Categoria...</option>
              </select>
            )}
          </div>

          {/* Conta Bancária */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Landmark className="w-3 h-3 text-emerald-500" />
                Conta Bancária
              </span>
              {onOpenBankAccountsModal && (
                <button
                  type="button"
                  onClick={onOpenBankAccountsModal}
                  className="text-[10px] text-blue-500 hover:underline"
                >
                  Gerenciar
                </button>
              )}
            </label>
            <select
              id="select-banco"
              value={selectedBancoId}
              onChange={(e) => setSelectedBancoId(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="">Sem conta bancária</option>
              {availableBanks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome_banco}
                </option>
              ))}
            </select>
          </div>

          {/* Centro de Custo */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3 text-purple-500" />
                Centro de Custo
              </span>
              {onOpenCostCentersModal && (
                <button
                  type="button"
                  onClick={onOpenCostCentersModal}
                  className="text-[10px] text-purple-500 hover:underline"
                >
                  Gerenciar
                </button>
              )}
            </label>
            <select
              id="select-centro-custo"
              value={selectedCentroCustoId}
              onChange={(e) => setSelectedCentroCustoId(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="">Sem centro</option>
              {availableCostCenters.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Valor */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Valor (R$) *
            </label>
            <input
              id="input-valor"
              type="text"
              required
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 text-gray-900 dark:text-white font-mono focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
            />
          </div>

          {/* Vencimento */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Vencimento *
            </label>
            <input
              id="input-vencimento"
              type="date"
              required
              value={dataVencimento}
              onChange={(e) => setDataVencimento(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 text-gray-900 dark:text-white font-mono focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
            />
          </div>

          {/* Status Inicial */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Status Inicial
            </label>
            <select
              id="select-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as AccountStatus)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer transition-all"
            >
              <option value="Pendente">Pendente</option>
              {activeTab === 'pagar' ? (
                <option value="Pago">Pago</option>
              ) : (
                <option value="Recebido">Recebido</option>
              )}
            </select>
          </div>

          {/* Botão de Enviar */}
          <div className="lg:col-span-2">
            <button
              id="btn-add-account-submit"
              type="submit"
              className={`w-full py-2.5 px-4 text-xs font-bold rounded-lg text-white flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer ${
                activeTab === 'pagar'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{activeTab === 'pagar' ? 'Lançar a Pagar' : 'Lançar a Receber'}</span>
            </button>
          </div>

        </form>
        ) : (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2.5">
              <Eye className="w-4 h-4 text-sky-500 shrink-0" />
              <span>
                <strong>Modo Somente Leitura (Consulta):</strong> Seu perfil possui acesso de visualização aos lançamentos e relatórios. Operações de lançamento e edição estão restritas pelo Administrador.
              </span>
            </div>
            <span className="px-2.5 py-1 rounded text-[11px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 shrink-0 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Consulta Habilitada
            </span>
          </div>
        )}
      </div>

      {/* 2. Grid com Tabela de Movimentações e Fluxo de Caixa Mensal (Clean Minimalism) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Tabela de Lançamentos */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-100 dark:border-slate-800 flex flex-col min-h-0 overflow-hidden transition-colors">
          
          {/* Header da Tabela com Seletor Rápido de Abas e Escopo de Empresa */}
          <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0 bg-gray-50/50 dark:bg-slate-850/50">
            {/* Abas Principais: Todos / A Pagar / A Receber */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex rounded-xl p-1 bg-gray-100 dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700 shadow-2xs">
                <button
                  id="tab-view-all"
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'all'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Todos ({accounts.filter(a => !a.excluido).length})</span>
                </button>

                <button
                  id="tab-view-pagar"
                  type="button"
                  onClick={() => setActiveTab('pagar')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'pagar'
                      ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <ArrowDownCircle className="w-3.5 h-3.5" />
                  <span>A Pagar ({accounts.filter(a => !a.excluido && a.tipo === 'pagar').length})</span>
                </button>

                <button
                  id="tab-view-receber"
                  type="button"
                  onClick={() => setActiveTab('receber')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'receber'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                  <span>A Receber ({accounts.filter(a => !a.excluido && a.tipo === 'receber').length})</span>
                </button>
              </div>

              {/* Indicador de Escopo de Empresa */}
              {empresaId > 0 && !isConsolidated ? (
                <button
                  id="btn-switch-to-consolidated"
                  type="button"
                  onClick={() => onSelectCompany?.(-1)}
                  className="px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
                  title="Clique para alternar para a Visão Consolidada de todas as empresas"
                >
                  <Building2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span className="truncate max-w-[120px]">{companies.find(c => c.id === empresaId)?.nome || `Empresa #${empresaId}`}</span>
                  <span className="bg-sky-200 dark:bg-sky-800 text-sky-900 dark:text-sky-100 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                    Ver Todas
                  </span>
                </button>
              ) : (
                <div className="px-2.5 py-1.5 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 flex items-center gap-1.5 text-xs font-semibold">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Todas as Empresas</span>
                </div>
              )}
            </div>

            {/* Quick Status Filter Pills */}
            <div className="flex items-center gap-1.5">
              <div className="inline-flex rounded-lg p-0.5 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                {['Todos', 'Pendente', activeTab === 'receber' ? 'Recebido' : 'Pago'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                      statusFilter === st
                        ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-2xs'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Search bar & Filters inside Table */}
          <div className="p-3 bg-gray-50/70 dark:bg-slate-800/40 border-b border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[140px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <input
                id="search-accounts-input"
                type="text"
                placeholder="Buscar por descrição, categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Bank Filter Dropdown */}
            {bankAccounts.length > 0 && (
              <select
                id="bank-filter-select"
                value={bankFilter}
                onChange={(e) => setBankFilter(e.target.value)}
                className="text-xs py-1.5 px-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 cursor-pointer max-w-[120px] truncate"
              >
                <option value="Todos">Todos Bancos</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={String(b.id)}>{b.nome_banco}</option>
                ))}
              </select>
            )}

            {/* Cost Center Filter Dropdown */}
            {costCenters.length > 0 && (
              <select
                id="cost-center-filter-select"
                value={costCenterFilter}
                onChange={(e) => setCostCenterFilter(e.target.value)}
                className="text-xs py-1.5 px-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 cursor-pointer max-w-[120px] truncate"
              >
                <option value="Todos">Todos C. Custos</option>
                {costCenters.map((cc) => (
                  <option key={cc.id} value={String(cc.id)}>{cc.nome}</option>
                ))}
              </select>
            )}

            {/* Category Filter Dropdown */}
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
              <select
                id="category-filter-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs py-1.5 px-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 cursor-pointer max-w-[120px] truncate"
              >
                <option value="Todas">Todas Categorias</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {availableMonths.length > 0 && (
              <select
                id="month-filter-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs py-1.5 px-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 cursor-pointer font-mono"
              >
                <option value="Todos">Todos os Meses</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
          </div>

          {/* Tabela */}
          <div className="flex-1 overflow-x-auto min-h-[260px] max-h-[380px]">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-slate-800/60 sticky top-0 z-10 border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-400 uppercase font-semibold tracking-wider">Descrição & Segmentação</th>
                  {isConsolidated && (
                    <th className="text-left px-3 py-3 text-gray-400 uppercase font-semibold tracking-wider">Empresa</th>
                  )}
                  <th className="text-right px-4 py-3 text-gray-400 uppercase font-semibold tracking-wider">Valor</th>
                  <th className="text-center px-4 py-3 text-gray-400 uppercase font-semibold tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-gray-400 uppercase font-semibold tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={isConsolidated ? 5 : 4} className="py-12 text-center text-gray-400 dark:text-gray-500">
                      Nenhum lançamento encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((acc) => {
                    const isPaid = acc.status === 'Pago' || acc.status === 'Recebido';
                    const comp = companies.find((c) => c.id === acc.empresa_id);
                    const bank = bankAccounts.find((b) => b.id === acc.banco_id);
                    const costCenter = costCenters.find((cc) => cc.id === acc.centro_custo_id);

                    return (
                      <tr 
                        key={acc.id} 
                        className="hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                            <span>{acc.descricao}</span>
                            {activeTab === 'all' && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                acc.tipo === 'receber'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                              }`}>
                                {acc.tipo === 'receber' ? '+ Receita' : '- Despesa'}
                              </span>
                            )}
                            {acc.parcela_atual && acc.parcela_total && (
                              <span className="text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-mono font-bold px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800/60">
                                {acc.parcela_atual}/{acc.parcela_total}
                              </span>
                            )}
                            {acc.recorrente && (
                              <span className="text-[10px] bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-bold px-1.5 py-0.2 rounded border border-purple-200 dark:border-purple-800/60 flex items-center gap-0.5">
                                <Repeat className="w-2.5 h-2.5" />
                                Recorrente
                              </span>
                            )}
                            {acc.conciliado && (
                              <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-0.5" title="Conciliado com extrato bancário oficial">
                                <ShieldCheck className="w-2.5 h-2.5" />
                                Conciliado
                              </span>
                            )}
                            {acc.pago_via_api && (
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-300 dark:border-emerald-700 flex items-center gap-0.5" title={`Liquidado via API Bancária (${acc.banco_pagamento || 'BB / Stone'})`}>
                                <Zap className="w-2.5 h-2.5 text-emerald-600" />
                                Pago via API
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] font-mono text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>Venc: {acc.data_vencimento}</span>
                            <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 rounded font-sans font-medium">
                              {acc.categoria || 'Geral'}
                            </span>
                            {acc.chave_pix && (
                              <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-sans font-medium flex items-center gap-1 text-[10px]" title={`Chave Pix: ${acc.chave_pix}`}>
                                <QrCode className="w-2.5 h-2.5" />
                                Pix: {acc.chave_pix.length > 15 ? `${acc.chave_pix.substring(0, 12)}...` : acc.chave_pix}
                              </span>
                            )}
                            {acc.codigo_barras && (
                              <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.2 rounded font-sans font-medium flex items-center gap-1 text-[10px]" title={`Código de Barras: ${acc.codigo_barras}`}>
                                <Barcode className="w-2.5 h-2.5" />
                                Boleto CIP
                              </span>
                            )}
                            {bank && (
                              <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-sans font-medium flex items-center gap-1">
                                <Landmark className="w-2.5 h-2.5" />
                                {bank.nome_banco}
                              </span>
                            )}
                            {costCenter && (
                              <span
                                className="px-1.5 py-0.2 rounded font-sans font-medium text-white text-[10px]"
                                style={{ backgroundColor: costCenter.cor || '#8b5cf6' }}
                              >
                                {costCenter.codigo ? `${costCenter.codigo}: ` : ''}{costCenter.nome}
                              </span>
                            )}
                          </div>
                        </td>

                        {isConsolidated && (
                          <td className="px-3 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 flex items-center gap-1 w-fit">
                              <Building2 className="w-2.5 h-2.5 text-blue-500" />
                              <span className="truncate max-w-[100px]">{comp?.nome || `ID #${acc.empresa_id}`}</span>
                            </span>
                          </td>
                        )}

                        <td className={`px-4 py-3 text-right font-bold font-mono text-sm ${
                          acc.tipo === 'pagar' ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'
                        }`}>
                          {formatCurrency(acc.valor)}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isPaid
                              ? 'bg-green-100 text-green-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}>
                            {acc.status.toUpperCase()}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* BOTÃO DE LIQUIDAÇÃO DIRETA VIA API BANCÁRIA (BB / Stone) */}
                            {acc.tipo === 'pagar' && !isPaid && permissions.pode_editar_contas && (
                              <button
                                id={`pay-bank-acc-${acc.id}`}
                                onClick={() => setPayingAccount(acc)}
                                className="px-2.5 py-1 text-[11px] font-bold rounded transition-all cursor-pointer flex items-center gap-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xs shrink-0"
                                title="Liquidar via API do Banco do Brasil ou Stone"
                              >
                                <Zap className="w-3 h-3 fill-white" />
                                <span>Pagar via Banco</span>
                              </button>
                            )}

                            {/* COMPROVANTE BANCÁRIO (Se liquidado via API) */}
                            {isPaid && (acc.pago_via_api || acc.comprovante_bancario_id) && (
                              <button
                                id={`receipt-acc-${acc.id}`}
                                onClick={() => setViewingReceiptAccount(acc)}
                                className="px-2 py-1 text-[10px] font-bold rounded transition-colors cursor-pointer flex items-center gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 shrink-0"
                                title={`Ver Comprovante Bancário (${acc.comprovante_bancario_id || 'Autenticado'})`}
                              >
                                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                <span>Comprovante</span>
                              </button>
                            )}

                            {permissions.pode_editar_contas ? (
                              <button
                                id={`toggle-acc-${acc.id}`}
                                onClick={() => onToggleStatus(acc.id)}
                                className={`px-2 py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                                  isPaid
                                    ? 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white bg-gray-100 dark:bg-slate-800'
                                    : 'text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-400'
                                }`}
                              >
                                {isPaid ? 'Desmarcar' : 'Concluir'}
                              </button>
                            ) : (
                              <span className="text-[10px] text-gray-400 px-1.5 py-0.5 bg-gray-50 dark:bg-slate-800/60 rounded">
                                {isPaid ? 'Liquidado' : 'Aberto'}
                              </span>
                            )}

                            {onOpenAccountHistory && permissions.pode_ver_auditoria && (
                              <button
                                id={`history-acc-${acc.id}`}
                                onClick={() => onOpenAccountHistory(acc)}
                                className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                                title="Ver Trilha de Auditoria deste Lançamento"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {permissions.pode_editar_contas && (
                              <button
                                id={`edit-acc-${acc.id}`}
                                onClick={() => handleOpenEdit(acc)}
                                className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                                title="Editar Lançamento"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {permissions.pode_excluir_contas && (
                              <button
                                id={`del-acc-${acc.id}`}
                                onClick={() => onDeleteAccount(acc.id)}
                                className="p-1 text-gray-400 hover:text-rose-500 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer da tabela */}
          <div className="p-3.5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Total da lista filtrada:</span>
            <span className="font-bold font-mono text-gray-900 dark:text-white text-sm">
              {formatCurrency(filteredAccounts.reduce((sum, a) => sum + a.valor, 0))}
            </span>
          </div>

        </div>

        {/* Right Column: Fluxo de Caixa Mensal (Clean Minimalism Bar Visualization) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-100 dark:border-slate-800 p-6 flex flex-col justify-between transition-colors">
          
          <div>
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                  Fluxo de Caixa Mensal
                </h3>
                <p className="text-xs text-gray-400">
                  {isConsolidated ? 'Consolidado de todas as empresas' : 'Comparativo de entradas e saídas'}
                </p>
              </div>
              <div className="flex gap-3">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div> Entradas
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400">
                  <div className="w-2 h-2 bg-rose-500 rounded-full"></div> Saídas
                </span>
              </div>
            </div>

            {/* Visual Bars Container */}
            <div className="h-48 flex items-end justify-between gap-3 px-2 pb-2">
              {sortedFlow.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-xs text-gray-400">
                  Adicione lançamentos com datas para ver o gráfico.
                </div>
              ) : (
                sortedFlow.map((flow) => {
                  const recPercent = Math.round((flow.receber / maxFlowVal) * 100);
                  const pagPercent = Math.round((flow.pagar / maxFlowVal) * 100);
                  return (
                    <div key={flow.mes} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full flex justify-center gap-1.5 items-end h-36">
                        {/* Barra de Receitas (Azul) */}
                        <div 
                          className="w-4 bg-blue-600 rounded-t transition-all"
                          style={{ height: `${Math.max(recPercent, 4)}%` }}
                          title={`Receitas: ${formatCurrency(flow.receber)}`}
                        ></div>
                        {/* Barra de Despesas (Vermelho) */}
                        <div 
                          className="w-4 bg-rose-500 rounded-t transition-all"
                          style={{ height: `${Math.max(pagPercent, 4)}%` }}
                          title={`Despesas: ${formatCurrency(flow.pagar)}`}
                        ></div>
                      </div>
                      <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 font-mono">
                        {flow.mes.substring(5)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer de Médias */}
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 text-center shrink-0">
            <div className="border-r border-gray-100 dark:border-slate-800">
              <p className="text-[10px] text-gray-400 font-bold uppercase">Média de Gastos</p>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300 font-mono">
                {formatCurrency(totalGastosGerais / qtdMesesGerais)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase">Média Receitas</p>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300 font-mono">
                {formatCurrency(totalReceitasGerais / qtdMesesGerais)}
              </p>
            </div>
          </div>

        </div>

      </div>

      {/* Edit Transaction Modal */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-gray-100 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${
                  editTipo === 'pagar' ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600' : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600'
                }`}>
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Editar Lançamento #{editingAccount.id}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Modifique os dados do contas a {editTipo === 'pagar' ? 'pagar' : 'receber'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              {editError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
                  {editError}
                </div>
              )}

              {/* Tipo Selector */}
              <div>
                <label className="text-gray-700 dark:text-gray-300 font-semibold block mb-1">
                  Tipo de Lançamento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditTipo('pagar');
                      if (editStatus === 'Recebido') setEditStatus('Pendente');
                    }}
                    className={`py-2 px-3 rounded-lg font-bold border transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                      editTipo === 'pagar'
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                        : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:bg-gray-100'
                    }`}
                  >
                    <ArrowDownCircle className="w-3.5 h-3.5" />
                    <span>Conta a Pagar (Despesa)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditTipo('receber');
                      if (editStatus === 'Pago') setEditStatus('Pendente');
                    }}
                    className={`py-2 px-3 rounded-lg font-bold border transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                      editTipo === 'receber'
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                        : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:bg-gray-100'
                    }`}
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5" />
                    <span>Conta a Receber (Receita)</span>
                  </button>
                </div>
              </div>

              {/* Empresa (if multiple available) */}
              {companies.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-gray-700 dark:text-gray-300 font-semibold flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Empresa Vinculada *</span>
                    </label>
                    <span className="text-[11px] text-gray-400">
                      Mova para outra empresa se necessário
                    </span>
                  </div>
                  <select
                    id="select-edit-empresa"
                    value={editEmpresaId}
                    onChange={(e) => setEditEmpresaId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} {c.cnpj ? `(${c.cnpj})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Descrição */}
              <div>
                <label className="text-gray-700 dark:text-gray-300 font-semibold block mb-1">
                  Descrição / Fornecedor / Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={editDescricao}
                  onChange={(e) => setEditDescricao(e.target.value)}
                  placeholder="Ex: Fornecedor de Matéria Prima, Aluguel..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>

              {/* Valor & Vencimento */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 dark:text-gray-300 font-semibold block mb-1">
                    Valor (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editValor}
                    onChange={(e) => setEditValor(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-gray-700 dark:text-gray-300 font-semibold block mb-1">
                    Data de Vencimento *
                  </label>
                  <input
                    type="date"
                    required
                    value={editDataVencimento}
                    onChange={(e) => setEditDataVencimento(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Conta Bancária & Centro de Custo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 dark:text-gray-300 font-semibold block mb-1">
                    Conta Bancária
                  </label>
                  <select
                    value={editBancoId}
                    onChange={(e) => setEditBancoId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  >
                    <option value="">Sem conta bancária</option>
                    {bankAccounts
                      .filter((b) => b.empresa_id === editEmpresaId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nome_banco}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-gray-700 dark:text-gray-300 font-semibold block mb-1">
                    Centro de Custo
                  </label>
                  <select
                    value={editCentroCustoId}
                    onChange={(e) => setEditCentroCustoId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  >
                    <option value="">Sem centro</option>
                    {costCenters
                      .filter((cc) => cc.empresa_id === 0 || cc.empresa_id === editEmpresaId)
                      .map((cc) => (
                        <option key={cc.id} value={cc.id}>
                          {cc.nome}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Categoria & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 dark:text-gray-300 font-semibold block mb-1">
                    Categoria
                  </label>
                  <select
                    value={editCategoria}
                    onChange={(e) => setEditCategoria(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  >
                    {categoryList.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-gray-700 dark:text-gray-300 font-semibold block mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as AccountStatus)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-medium"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value={editTipo === 'pagar' ? 'Pago' : 'Recebido'}>
                      {editTipo === 'pagar' ? 'Pago (Liquidado)' : 'Recebido (Liquidado)'}
                    </option>
                  </select>
                </div>
              </div>

              {/* Chave Pix & Código de Barras */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-gray-700 dark:text-gray-300 font-semibold block text-xs">
                      Chave Pix (Destino)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setTableScannerTarget('edit');
                        setTableScannerMode('pix');
                        setIsTableScannerOpen(true);
                      }}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
                    >
                      <Camera className="w-3 h-3" />
                      Câmera
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editChavePix}
                    onChange={(e) => setEditChavePix(e.target.value)}
                    placeholder="CPF, CNPJ, E-mail ou Celular"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-gray-700 dark:text-gray-300 font-semibold block text-xs">
                      Código de Barras / Boleto
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setTableScannerTarget('edit');
                        setTableScannerMode('boleto');
                        setIsTableScannerOpen(true);
                      }}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
                    >
                      <Camera className="w-3 h-3" />
                      Câmera
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editCodigoBarras}
                    onChange={(e) => setEditCodigoBarras(e.target.value)}
                    placeholder="Linha digitável do boleto..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono text-xs"
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="text-gray-700 dark:text-gray-300 font-semibold block mb-1">
                  Observações / NF / Documento (Opcional)
                </label>
                <input
                  type="text"
                  value={editObservacoes}
                  onChange={(e) => setEditObservacoes(e.target.value)}
                  placeholder="Ex: NF 45892, Banco Itaú, Maquininha Cielo..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Modal de Liquidação Direta via API Bancária (BB / Stone) */}
      <BankPaymentModal
        isOpen={Boolean(payingAccount)}
        onClose={() => setPayingAccount(null)}
        account={payingAccount}
        company={companies.find((c) => Number(c.id) === Number(payingAccount?.empresa_id))}
        currentUser={currentUser}
        onPaymentSuccess={(result) => {
          if (onAccountPaidViaBank) {
            onAccountPaidViaBank(result);
          }
        }}
      />

      {/* Modal Visualizador de Comprovante de Pagamento Bancário */}
      {viewingReceiptAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Comprovante de Liquidação Bancária
                </h3>
              </div>
              <button
                onClick={() => setViewingReceiptAccount(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Beneficiário:</span>
                <strong className="text-slate-800 dark:text-slate-200 font-semibold">{viewingReceiptAccount.descricao}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Valor Liquidado:</span>
                <strong className="text-rose-600 dark:text-rose-400 font-mono text-sm font-bold">
                  {formatCurrency(viewingReceiptAccount.valor)}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Banco Liquidante:</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium">
                  {viewingReceiptAccount.banco_pagamento || viewingReceiptAccount.banco_origem || 'Banco Integrado (BB / Stone)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Data da Operação:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {viewingReceiptAccount.pago_em ? new Date(viewingReceiptAccount.pago_em).toLocaleString('pt-BR') : viewingReceiptAccount.data_vencimento}
                </span>
              </div>
              {viewingReceiptAccount.chave_pix && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Chave Pix:</span>
                  <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                    {viewingReceiptAccount.chave_pix}
                  </span>
                </div>
              )}
              {viewingReceiptAccount.codigo_barras && (
                <div className="flex flex-col gap-1">
                  <span className="text-slate-400">Linha Digitável:</span>
                  <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300 break-all bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-700">
                    {viewingReceiptAccount.codigo_barras}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 block text-[11px] mb-1">ID de Autenticação / Comprovante:</span>
                <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 break-all">
                  {viewingReceiptAccount.comprovante_bancario_id || viewingReceiptAccount.conciliado_fitid || 'AUT-BB-PIX-SUCCESS'}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingReceiptAccount(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Scanner for Table & Edit Modal */}
      <CameraScannerModal
        isOpen={isTableScannerOpen}
        onClose={() => setIsTableScannerOpen(false)}
        mode={tableScannerMode}
        onScanSuccess={(scanned) => {
          if (tableScannerTarget === 'edit') {
            if (scanned.type === 'pix' && scanned.chavePix) {
              setEditChavePix(scanned.chavePix);
            } else if (scanned.type === 'boleto' && scanned.codigoBarras) {
              setEditCodigoBarras(scanned.codigoBarras);
            }
          } else {
            if (scanned.type === 'pix' && scanned.chavePix) {
              setFormChavePix(scanned.chavePix);
              setShowBankingFields(true);
            } else if (scanned.type === 'boleto' && scanned.codigoBarras) {
              setFormCodigoBarras(scanned.codigoBarras);
              setShowBankingFields(true);
            }
          }
        }}
      />

    </div>
  );
};
