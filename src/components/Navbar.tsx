import React, { useMemo, useState, useRef, useEffect } from 'react';
import { 
  Building2, 
  ChevronDown, 
  Menu, 
  Users, 
  LogOut, 
  ShieldCheck, 
  Cloud, 
  RefreshCw,
  Crown,
  Lock,
  Bell,
  Clock,
  AlertCircle,
  CheckCircle2,
  Sliders,
  X,
  ChevronRight,
  Calendar,
  StickyNote,
  Highlighter,
  Plus,
  Trash2,
  Send,
  Check,
  Pencil
} from 'lucide-react';
import { Company, User, Tenant, getUserEffectivePermissions, FinancialAccount, ReminderItem, ReminderSettings, FinancialNoteItem, FinancialNotepadState } from '../types';
import { formatReminderDueDate, checkNoteReminderStatus } from '../utils/reminderService';
import { ArrowLeftRight } from 'lucide-react';

interface NavbarProps {
  companies: Company[];
  selectedCompanyId: number;
  onSelectCompany: (id: number) => void;
  onOpenCompanyModal: () => void;
  onOpenChartModal?: () => void;
  onOpenPythonModal?: () => void;
  onOpenSqliteModal?: () => void;
  onOpenUsersModal: () => void;
  onOpenMasterModal?: () => void;
  onOpenSubscriptionModal?: () => void;
  onOpenBackupModal?: () => void;
  onOpenSecurityModal?: () => void;
  onOpenResetModal?: () => void;
  timeoutMinutes?: number;
  pendingApprovalsCount?: number;
  onOpenCsvModal?: (initialTab?: 'export' | 'import') => void;
  onOpenExtratoModal?: () => void;
  onDownloadAppPy?: () => void;
  currentUser: User;
  tenant?: Tenant;
  onSwitchCompanyScreen?: () => void;
  onLogout: () => void;
  darkMode: boolean;
  onToggleTheme: () => void;
  onOpenMobileMenu: () => void;
  currentViewTitle: string;
  onForceSync?: () => void;
  isSyncing?: boolean;
  isSilentSyncing?: boolean;
  lastAutoSyncTime?: Date | null;
  reminders?: ReminderItem[];
  reminderSettings?: ReminderSettings;
  onOpenReminderSettings?: () => void;
  onQuickPayAccount?: (account: FinancialAccount) => void;
  notepadState?: FinancialNotepadState;
  onSaveNotepad?: (newState: FinancialNotepadState) => void;
  onOpenNotepadModal?: (initialEditItemId?: string) => void;
  onLaunchNoteToAccount?: (item: FinancialNoteItem) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  companies,
  selectedCompanyId,
  onSelectCompany,
  onOpenCompanyModal,
  onOpenUsersModal,
  onOpenMasterModal,
  onOpenSubscriptionModal,
  onOpenBackupModal,
  onOpenSecurityModal,
  onOpenResetModal,
  timeoutMinutes = 15,
  pendingApprovalsCount = 0,
  currentUser,
  tenant,
  onSwitchCompanyScreen,
  onLogout,
  darkMode,
  onToggleTheme,
  onOpenMobileMenu,
  currentViewTitle,
  onForceSync,
  isSyncing,
  isSilentSyncing,
  lastAutoSyncTime,
  reminders = [],
  reminderSettings,
  onOpenReminderSettings,
  onQuickPayAccount,
  notepadState,
  onSaveNotepad,
  onOpenNotepadModal,
  onLaunchNoteToAccount,
}) => {
  const isMaster = Boolean(
    currentUser?.is_master || 
    Number(currentUser?.id) === 1 || 
    currentUser?.email?.toLowerCase() === 'admin@financeiro.com' ||
    currentUser?.role === 'master'
  );

  const permissions = useMemo(() => {
    return getUserEffectivePermissions(currentUser);
  }, [currentUser]);

  const isConsolidated = selectedCompanyId === -1;
  const currentCompany = companies.find((c) => c.id === selectedCompanyId);

  const [isRemindersOpen, setIsRemindersOpen] = useState(false);
  const [remindersTab, setRemindersTab] = useState<'vencimentos' | 'bloco_notas'>('vencimentos');
  const [reminderFilter, setReminderFilter] = useState<'all' | 'atrasado' | 'hoje' | 'proximo'>('all');
  const [quickNoteDesc, setQuickNoteDesc] = useState('');
  const [quickNoteValor, setQuickNoteValor] = useState('');
  const [quickNoteDia, setQuickNoteDia] = useState('');
  const [quickNoteGreen, setQuickNoteGreen] = useState(true);
  const remindersDropdownRef = useRef<HTMLDivElement>(null);

  const handleQuickAddNote = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickNoteDesc.trim() || !onSaveNotepad) return;

    let valorNum: number | null = null;
    if (quickNoteValor) {
      const sanitized = quickNoteValor.replace(/[^\d.,]/g, '').replace(',', '.');
      const parsed = parseFloat(sanitized);
      if (!isNaN(parsed) && parsed > 0) valorNum = parsed;
    }

    const targetEmpresaId = selectedCompanyId && selectedCompanyId > 0 
      ? selectedCompanyId 
      : (companies[0]?.id ? Number(companies[0].id) : 1);

    const newItem: FinancialNoteItem = {
      id: `note-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      descricao: quickNoteDesc.trim(),
      valor: valorNum,
      dataVencimentoAproximada: quickNoteDia.trim() || undefined,
      destaqueVerde: quickNoteGreen,
      concluido: false,
      empresa_id: targetEmpresaId,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };

    const currentState = notepadState || { itens: [], textoLivre: '', ultimaAtualizacao: new Date().toISOString() };
    const updated: FinancialNotepadState = {
      ...currentState,
      itens: [newItem, ...currentState.itens],
      ultimaAtualizacao: new Date().toISOString(),
    };

    onSaveNotepad(updated);
    setQuickNoteDesc('');
    setQuickNoteValor('');
    setQuickNoteDia('');
  };

  const currentScopedNotes = useMemo(() => {
    const all = notepadState?.itens || [];
    if (selectedCompanyId && selectedCompanyId > 0) {
      return all.filter((it) => Number(it.empresa_id || 1) === Number(selectedCompanyId));
    }
    return all;
  }, [notepadState?.itens, selectedCompanyId]);

  const handleToggleNoteItem = (id: string) => {
    if (!notepadState || !onSaveNotepad) return;
    const updatedItens = notepadState.itens.map((it) => it.id === id ? { ...it, concluido: !it.concluido } : it);
    onSaveNotepad({ ...notepadState, itens: updatedItens, ultimaAtualizacao: new Date().toISOString() });
  };

  const handleToggleNoteGreen = (id: string) => {
    if (!notepadState || !onSaveNotepad) return;
    const updatedItens = notepadState.itens.map((it) => it.id === id ? { ...it, destaqueVerde: !it.destaqueVerde } : it);
    onSaveNotepad({ ...notepadState, itens: updatedItens, ultimaAtualizacao: new Date().toISOString() });
  };

  const handleDeleteNoteItem = (id: string) => {
    if (!notepadState || !onSaveNotepad) return;
    const updatedItens = notepadState.itens.filter((it) => it.id !== id);
    onSaveNotepad({ ...notepadState, itens: updatedItens, ultimaAtualizacao: new Date().toISOString() });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        remindersDropdownRef.current &&
        !remindersDropdownRef.current.contains(event.target as Node)
      ) {
        setIsRemindersOpen(false);
      }
    };
    if (isRemindersOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isRemindersOpen]);

  const overdueCount = reminders.filter((r) => r.urgencia === 'atrasado').length;
  const todayCount = reminders.filter((r) => r.urgencia === 'hoje').length;
  const upcomingCount = reminders.filter((r) => r.urgencia === 'proximo').length;
  const totalReminderAmount = reminders.reduce((sum, r) => sum + Number(r.account.valor || 0), 0);

  const displayedReminders = useMemo(() => {
    if (reminderFilter === 'all') return reminders;
    return reminders.filter((r) => r.urgencia === reminderFilter);
  }, [reminders, reminderFilter]);

  return (
    <header className="h-20 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-8 shrink-0 transition-colors">
      
      {/* Left Title Area */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
          title="Abrir menu lateral"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>{currentViewTitle}</span>
            {isConsolidated && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                Consolidado
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Monitoramento multiempresa &bull; <span className="font-semibold text-blue-600 dark:text-blue-400">
              {isConsolidated ? `Visão Geral de Todas as ${companies.length} Empresas` : (currentCompany?.nome || 'Nenhuma empresa')}
            </span>
          </p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        
        {/* Cloud Realtime Sync Interactive Button */}
        <button 
          id="cloud-status-badge"
          onClick={onForceSync}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
            isSyncing
              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
              : isSilentSyncing
              ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300'
              : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
          }`}
          title={
            isSyncing
              ? 'Sincronizando com o Servidor Central e Firebase...'
              : isSilentSyncing
              ? 'Sincronização silenciosa agendada em andamento...'
              : lastAutoSyncTime
              ? `Nuvem Firestore e Servidor Central sincronizados (${lastAutoSyncTime.toLocaleTimeString('pt-BR')}). Backup 100% atualizado. Clique para forçar sincronização manual.`
              : 'Nuvem Google Firestore ativa. Clique para forçar sincronização instantânea com o celular e outros dispositivos.'
          }
        >
          {isSyncing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
          ) : isSilentSyncing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600 dark:text-teal-400" />
          ) : (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
          <Cloud className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {isSyncing ? 'Sincronizando...' : isSilentSyncing ? 'Backup automático...' : 'Nuvem Conectada'}
          </span>
        </button>

        {/* Multi-company Select Dropdown */}
        {companies.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <div className="relative flex items-center">
              <select
                id="header-company-select"
                value={selectedCompanyId}
                onChange={(e) => onSelectCompany(Number(e.target.value))}
                className={`appearance-none rounded-lg px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold pr-8 focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-[150px] sm:max-w-[200px] truncate transition-colors ${
                  isConsolidated
                    ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800'
                    : 'bg-gray-100 dark:bg-slate-800 border-0 text-gray-800 dark:text-gray-100'
                }`}
              >
                {(currentUser.acesso_todas_empresas || isMaster || currentUser.role === 'admin' || currentUser.is_admin) && companies.length > 1 && (
                  <option value={-1} className="bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold">
                    🌐 Todas as Empresas (Consolidado)
                  </option>
                )}
                {companies.map((comp) => (
                  <option 
                    key={comp.id} 
                    value={comp.id} 
                    className="bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 font-normal"
                  >
                    {comp.nome}
                  </option>
                ))}
              </select>
              <div className="absolute right-2.5 pointer-events-none text-gray-500">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>

            {onSwitchCompanyScreen && (
              <button
                id="btn-switch-company-screen"
                onClick={onSwitchCompanyScreen}
                title="Trocar de Subempresa (Abrir Seleção em Tela Cheia)"
                className="hidden sm:flex items-center gap-1 px-2.5 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-blue-500" />
                <span>Trocar</span>
              </button>
            )}

            {(permissions.pode_gerenciar_empresas || isMaster || currentUser.role === 'admin' || currentUser.is_admin) && onOpenCompanyModal && (
              <button
                id="btn-navbar-manage-companies"
                onClick={onOpenCompanyModal}
                title="Cadastrar e Editar Empresas / CNPJs"
                className="hidden md:flex items-center gap-1 px-2.5 py-2 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold cursor-pointer border border-blue-200 dark:border-blue-800/60 transition-colors"
              >
                <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Empresas</span>
              </button>
            )}
          </div>
        ) : (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium px-2 py-1 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900/40">
            Nenhuma empresa vinculada
          </span>
        )}

        {/* Usuários & Permissões Button (Restrito por permissão) */}
        {(permissions.pode_gerenciar_usuarios || isMaster) && (
          <button
            id="btn-open-users-header"
            onClick={onOpenUsersModal}
            title="Gerenciar Usuários e Permissões"
            className="p-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <Users className="w-4 h-4 text-indigo-500" />
          </button>
        )}

        {/* Botão de Atalho Rápido para o Bloco de Notas Financeiro */}
        {onOpenNotepadModal && (
          <button
            id="btn-header-notepad"
            onClick={() => onOpenNotepadModal()}
            title={`Bloco de Notas Financeiro (${currentScopedNotes.length} contas anotadas a lembrar${selectedCompanyId && selectedCompanyId > 0 ? ` - ${currentCompany?.nome}` : ''})`}
            className="p-2 rounded-lg transition-all cursor-pointer relative shrink-0 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center gap-1.5"
          >
            <StickyNote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden xl:inline text-xs font-bold">Bloco de Notas</span>
            {currentScopedNotes.length > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center text-white bg-emerald-600 shadow-xs">
                {currentScopedNotes.length > 99 ? '99+' : currentScopedNotes.length}
              </span>
            )}
          </button>
        )}

        {/* Central de Notificações / Lembretes Financeiros */}
        <div className="relative" ref={remindersDropdownRef}>
          <button
            id="btn-header-reminders-bell"
            onClick={() => setIsRemindersOpen((prev) => !prev)}
            title={`Lembretes Financeiros (${reminders.length} contas a pagar no radar)`}
            className={`p-2 rounded-lg transition-all cursor-pointer relative shrink-0 ${
              isRemindersOpen
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/30'
                : reminders.length > 0
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            <Bell className="w-4 h-4" />
            
            {reminders.length > 0 && (
              <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center text-white shadow-xs ${
                overdueCount > 0
                  ? 'bg-rose-600 animate-pulse'
                  : todayCount > 0
                  ? 'bg-amber-600'
                  : 'bg-blue-600'
              }`}>
                {reminders.length > 99 ? '99+' : reminders.length}
              </span>
            )}
          </button>

          {/* Dropdown Popover de Lembretes */}
          {isRemindersOpen && (
            <div className="absolute right-0 top-full mt-2 w-88 sm:w-[420px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
              
              {/* Header do Dropdown */}
              <div className="p-3.5 border-b border-gray-100 dark:border-slate-800/80 bg-gray-50/80 dark:bg-slate-850 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <span>Lembretes Financeiros</span>
                    </h3>
                    <p className="text-[10px] text-gray-500 dark:text-slate-400">
                      Vencimentos no radar & anotações de contas
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {onOpenReminderSettings && (
                    <button
                      onClick={() => {
                        setIsRemindersOpen(false);
                        onOpenReminderSettings();
                      }}
                      className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Configurar prazo de antecedência"
                    >
                      <Sliders className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsRemindersOpen(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Fechar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Seletor de Abas: Vencimentos Oficiais vs Bloco de Notas */}
              <div className="grid grid-cols-2 p-1.5 bg-gray-100/90 dark:bg-slate-800/90 border-b border-gray-200/80 dark:border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setRemindersTab('vencimentos')}
                  className={`py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    remindersTab === 'vencimentos'
                      ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-xs'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5 text-amber-500" />
                  <span>Vencimentos ({reminders.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRemindersTab('bloco_notas')}
                  className={`py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    remindersTab === 'bloco_notas'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                      : 'text-gray-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                  }`}
                >
                  <StickyNote className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Bloco de Notas ({currentScopedNotes.length})</span>
                </button>
              </div>

              {remindersTab === 'vencimentos' ? (
                <>
                  {/* Totalizador Financeiro */}
                  {reminders.length > 0 && (
                    <div className="px-4 py-2 bg-amber-50/50 dark:bg-amber-950/20 border-b border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-gray-600 dark:text-slate-400">Total a Pagar no Radar:</span>
                      <span className="font-bold text-amber-700 dark:text-amber-300">
                        {totalReminderAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  )}

                  {/* Filtros rápidos */}
                  {reminders.length > 0 && (
                    <div className="p-2 border-b border-gray-100 dark:border-slate-800/80 flex items-center gap-1 overflow-x-auto text-[11px]">
                      <button
                        onClick={() => setReminderFilter('all')}
                        className={`px-2 py-1 rounded-lg font-semibold transition-colors cursor-pointer shrink-0 ${
                          reminderFilter === 'all'
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        Todas ({reminders.length})
                      </button>

                      {overdueCount > 0 && (
                        <button
                          onClick={() => setReminderFilter('atrasado')}
                          className={`px-2 py-1 rounded-lg font-semibold transition-colors cursor-pointer shrink-0 ${
                            reminderFilter === 'atrasado'
                              ? 'bg-rose-600 text-white'
                              : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                          }`}
                        >
                          Atrasadas ({overdueCount})
                        </button>
                      )}

                      {todayCount > 0 && (
                        <button
                          onClick={() => setReminderFilter('hoje')}
                          className={`px-2 py-1 rounded-lg font-semibold transition-colors cursor-pointer shrink-0 ${
                            reminderFilter === 'hoje'
                              ? 'bg-amber-600 text-white'
                              : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                          }`}
                        >
                          Hoje ({todayCount})
                        </button>
                      )}

                      {upcomingCount > 0 && (
                        <button
                          onClick={() => setReminderFilter('proximo')}
                          className={`px-2 py-1 rounded-lg font-semibold transition-colors cursor-pointer shrink-0 ${
                            reminderFilter === 'proximo'
                              ? 'bg-indigo-600 text-white'
                              : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                          }`}
                        >
                          A Vencer ({upcomingCount})
                        </button>
                      )}
                    </div>
                  )}

                  {/* Lista com scroll */}
                  <div className="p-3 space-y-2 overflow-y-auto flex-1 max-h-72">
                    {displayedReminders.length === 0 ? (
                      <div className="py-8 text-center space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-80" />
                        <p className="text-xs font-bold text-gray-700 dark:text-slate-300">
                          Nenhum lembrete pendente
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 max-w-[240px] mx-auto">
                          Não há contas a pagar no prazo de {reminderSettings?.dias_antecedencia || 3} dias. Tudo em dia!
                        </p>
                      </div>
                    ) : (
                      displayedReminders.map((rem) => {
                        const statusInfo = formatReminderDueDate(
                          rem.diasAteVencimento,
                          rem.account.data_vencimento
                        );
                        return (
                          <div
                            key={rem.account.id}
                            className="p-2.5 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex flex-col gap-1.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusInfo.badgeClass} mb-1`}>
                                  {statusInfo.label}
                                </span>
                                <p className="text-xs font-bold text-gray-900 dark:text-slate-100 truncate">
                                  {rem.account.descricao}
                                </p>
                                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-slate-400 pt-0.5">
                                  {rem.account.categoria && <span>{rem.account.categoria}</span>}
                                  {rem.empresaNome && isConsolidated && (
                                    <>
                                      <span>•</span>
                                      <span className="truncate max-w-[120px] font-medium">{rem.empresaNome}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400 block">
                                  {Number(rem.account.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>

                                {onQuickPayAccount && (permissions.pode_quitar_contas || isMaster) && (
                                  <button
                                    onClick={() => {
                                      onQuickPayAccount(rem.account);
                                    }}
                                    className="mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-2xs"
                                    title="Marcar como Pago agora"
                                  >
                                    Dar Baixa
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer do Dropdown */}
                  <div className="p-3 border-t border-gray-100 dark:border-slate-800/80 bg-gray-50/80 dark:bg-slate-850 flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 dark:text-slate-400">
                      {reminders.length} no radar
                    </span>

                    {onOpenReminderSettings && (
                      <button
                        onClick={() => {
                          setIsRemindersOpen(false);
                          onOpenReminderSettings();
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Configurar Antecedência</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                /* Aba: Bloco de Notas de Contas a Lembrar */
                <div className="flex flex-col flex-1 overflow-hidden">
                  {/* Totalizador do Bloco de Notas */}
                  <div className="px-4 py-2 bg-emerald-50/60 dark:bg-emerald-950/20 border-b border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                      Total Anotado a Lembrar {selectedCompanyId && selectedCompanyId > 0 ? `(${currentCompany?.nome})` : ''}:
                    </span>
                    <span className="font-extrabold text-emerald-700 dark:text-emerald-400">
                      {currentScopedNotes.reduce((acc, it) => acc + (it.valor || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>

                  {/* Formulário Rápido de Inserção */}
                  <form onSubmit={handleQuickAddNote} className="p-3 border-b border-gray-100 dark:border-slate-800 bg-amber-50/30 dark:bg-slate-850/60 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder={selectedCompanyId && selectedCompanyId > 0 ? `Anotar para ${currentCompany?.nome}...` : "Ex: MINHA CASA MINHA VIDA..."}
                        value={quickNoteDesc}
                        onChange={(e) => setQuickNoteDesc(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400"
                      />
                      <input
                        type="text"
                        placeholder="R$"
                        value={quickNoteValor}
                        onChange={(e) => setQuickNoteValor(e.target.value)}
                        className="w-20 px-2 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400"
                      />
                      <input
                        type="text"
                        placeholder="Dia"
                        value={quickNoteDia}
                        onChange={(e) => setQuickNoteDia(e.target.value)}
                        className="w-14 px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400"
                        title="Dia de vencimento (ex: 10)"
                      />
                      <button
                        type="button"
                        onClick={() => setQuickNoteGreen((prev) => !prev)}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                          quickNoteGreen
                            ? 'bg-emerald-500 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700'
                        }`}
                        title={quickNoteGreen ? 'Marca-Texto Verde Ativado' : 'Ativar Marca-Texto Verde'}
                      >
                        <Highlighter className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="submit"
                        disabled={!quickNoteDesc.trim()}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer shadow-2xs transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Chips de Atalhos Rápidos */}
                    <div className="flex items-center gap-1 overflow-x-auto text-[10px] pt-0.5 pb-0.5">
                      {['MINHA CASA MINHA VIDA', 'PREVIDENCIA', 'CARTAO DE CREDITO', 'ALUGUEL'].map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setQuickNoteDesc(item)}
                          className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-emerald-600 hover:border-emerald-400 transition-colors cursor-pointer whitespace-nowrap font-medium"
                        >
                          + {item}
                        </button>
                      ))}
                    </div>
                  </form>

                  {/* Lista de Itens do Bloco */}
                  <div className="p-3 space-y-2 overflow-y-auto flex-1 max-h-64">
                    {currentScopedNotes.length === 0 ? (
                      <div className="py-6 text-center space-y-1.5">
                        <StickyNote className="w-7 h-7 text-amber-500 mx-auto opacity-70" />
                        <p className="text-xs font-bold text-gray-700 dark:text-slate-300">
                          Nenhuma conta no bloco de notas {selectedCompanyId && selectedCompanyId > 0 ? `desta empresa` : ''}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 max-w-[240px] mx-auto">
                          Digite contas que você lembrou acima para manter nesta empresa.
                        </p>
                      </div>
                    ) : (
                      currentScopedNotes.map((note) => {
                        const reminderInfo = checkNoteReminderStatus(note.dataVencimentoAproximada);
                        return (
                          <div
                            key={note.id}
                            className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                              note.concluido
                                ? 'opacity-50 bg-gray-100 dark:bg-slate-800/40 border-gray-200 dark:border-slate-800'
                                : note.destaqueVerde
                                ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/80 shadow-2xs'
                                : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => handleToggleNoteItem(note.id)}
                                className={`w-5 h-5 rounded flex items-center justify-center border transition-colors cursor-pointer shrink-0 ${
                                  note.concluido
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : 'border-slate-300 dark:border-slate-600 hover:border-emerald-500'
                                }`}
                                title={note.concluido ? 'Desmarcar' : 'Concluir'}
                              >
                                {note.concluido && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </button>

                              <div className="min-w-0 flex-1">
                                <p className={`text-xs font-black truncate ${
                                  note.concluido
                                    ? 'line-through text-slate-400'
                                    : note.destaqueVerde
                                    ? 'bg-emerald-200/90 dark:bg-emerald-900/80 text-emerald-950 dark:text-emerald-100 px-1 rounded inline-block'
                                    : 'text-slate-900 dark:text-white'
                                }`}>
                                  {note.descricao}
                                </p>
                                
                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                  {note.dataVencimentoAproximada && (
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                                      <Calendar className="w-2.5 h-2.5" />
                                      {note.dataVencimentoAproximada.toLowerCase().includes('dia')
                                        ? note.dataVencimentoAproximada
                                        : `Dia ${note.dataVencimentoAproximada}`}
                                    </span>
                                  )}

                                  {/* Badge de Lembrete Financeiro Integrado */}
                                  {reminderInfo && !note.concluido && (
                                    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded border ${reminderInfo.badgeClass}`}>
                                      <Bell className="w-2 h-2" />
                                      {reminderInfo.label}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {note.valor != null && note.valor > 0 && (
                                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                                  {note.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              )}

                              {/* Botão de Editar Lançamento */}
                              <button
                                type="button"
                                onClick={() => {
                                  setIsRemindersOpen(false);
                                  if (onOpenNotepadModal) onOpenNotepadModal(note.id);
                                }}
                                className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                title="Editar este lançamento do bloco de notas"
                              >
                                <Pencil className="w-3.5 h-3.5 text-blue-500" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleNoteGreen(note.id)}
                                className={`p-1 rounded border transition-colors cursor-pointer ${
                                  note.destaqueVerde
                                    ? 'bg-emerald-500 text-white border-emerald-600'
                                    : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700'
                                }`}
                                title="Destacar com marca-texto verde"
                              >
                                <Highlighter className="w-3 h-3" />
                              </button>

                              {!note.lancadoNoSistema && onLaunchNoteToAccount && (
                                <button
                                  type="button"
                                  onClick={() => onLaunchNoteToAccount(note)}
                                  className="px-2 py-1 rounded text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shadow-2xs flex items-center gap-0.5"
                                  title="Lançar esta conta no Contas a Pagar agora"
                                >
                                  <Send className="w-2.5 h-2.5" />
                                  <span>Lançar</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeleteNoteItem(note.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors cursor-pointer"
                                title="Excluir do bloco"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer do Bloco de Notas */}
                  <div className="p-3 border-t border-gray-100 dark:border-slate-800/80 bg-gray-50/80 dark:bg-slate-850 flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 dark:text-slate-400">
                      {currentScopedNotes.length} contas no bloco {selectedCompanyId && selectedCompanyId > 0 ? `(${currentCompany?.nome})` : ''}
                    </span>

                    {onOpenNotepadModal && (
                      <button
                        onClick={() => {
                          setIsRemindersOpen(false);
                          onOpenNotepadModal();
                        }}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Abrir Bloco Completo</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>


        {/* Logged-in User Profile Badge & Logout */}
        <div className="pl-2 border-l border-gray-200 dark:border-slate-800 flex items-center gap-2">
          <div
            className="flex items-center gap-2 p-1.5 rounded-lg text-left"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-xs ${
              isMaster ? 'bg-amber-500 text-slate-950' : 'bg-blue-600 text-white'
            }`}>
              {isMaster ? <Crown className="w-4 h-4" /> : currentUser.nome.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[120px] flex items-center gap-1">
                <span>{currentUser.nome}</span>
                {isMaster && <span className="text-[10px] text-amber-500">👑</span>}
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-0.5">
                {isMaster ? (
                  <span className="text-amber-500 font-bold">Master</span>
                ) : currentUser.role === 'leitor' ? (
                  <span className="text-sky-500">Leitor (Consulta)</span>
                ) : currentUser.acesso_todas_empresas ? (
                  <>
                    <ShieldCheck className="w-2.5 h-2.5" />
                    <span>Global</span>
                  </>
                ) : (
                  <span>Acesso Restrito</span>
                )}
              </span>
            </div>
          </div>

          {/* Acesso discreto ao Portal Master para o Dono do Sistema */}
          {isMaster && onOpenMasterModal && (
            <button
              id="btn-nav-switch-to-master"
              onClick={onOpenMasterModal}
              title="Acessar Portal Master (Gestão de Clientes e Revenda SaaS)"
              className="px-2 py-1 text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1 border border-transparent hover:border-amber-500/30"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden lg:inline text-[11px] font-semibold text-amber-600 dark:text-amber-400">Portal SaaS</span>
            </button>
          )}

          {onOpenSecurityModal && (
            <button
              id="btn-nav-security"
              onClick={onOpenSecurityModal}
              title={`Segurança da Sessão: Bloqueio automático em ${timeoutMinutes} min de inatividade`}
              className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
            >
              <Lock className="w-4 h-4" />
              <span className="hidden xl:inline text-[10px] font-extrabold">{timeoutMinutes}m</span>
            </button>
          )}

          <button
            id="btn-nav-logout"
            onClick={onLogout}
            title="Encerrar Sessão (Logout)"
            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

      </div>

    </header>
  );
};

