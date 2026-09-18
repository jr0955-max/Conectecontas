import React, { useMemo } from 'react';
import { 
  LayoutDashboard, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  BarChart3, 
  Code2, 
  Database, 
  Building2, 
  Users, 
  LogOut, 
  ShieldCheck, 
  Download, 
  X, 
  Monitor,
  FileSpreadsheet,
  UploadCloud,
  DownloadCloud,
  FileText,
  Trash2,
  History,
  RotateCcw,
  HardDrive,
  Repeat,
  TrendingUp,
  Landmark,
  Layers,
  Crown,
  Eye,
  KeyRound,
  CreditCard,
  Lock,
  Pencil,
  Plus,
  Globe
} from 'lucide-react';
import { User, Company, getUserEffectivePermissions } from '../types';

interface SidebarProps {
  currentView: 'all' | 'pagar' | 'receber';
  onChangeView: (view: 'all' | 'pagar' | 'receber') => void;
  onOpenCompanyModal: () => void;
  onOpenChartModal: () => void;
  onOpenPythonModal: () => void;
  onOpenSqliteModal: () => void;
  onOpenUsersModal: () => void;
  onOpenMasterModal?: () => void;
  onOpenSubscriptionModal?: () => void;
  pendingApprovalsCount?: number;
  onOpenAuditLogModal?: () => void;
  onOpenTrashModal?: () => void;
  onOpenBackupModal?: () => void;
  onOpenExtratoModal?: () => void;
  onOpenCsvModal?: (initialTab?: 'export' | 'import') => void;
  onOpenResetModal?: () => void;
  onOpenRecurringModal?: () => void;
  onOpenOfxModal?: () => void;
  onOpenBankAccountsModal?: () => void;
  onOpenCostCentersModal?: () => void;
  onOpenCashflowModal?: () => void;
  onOpenBankingModal?: () => void;
  onOpenWebhookModal?: () => void;
  onOpenSecurityModal?: () => void;
  onDownloadAppPy: () => void;
  currentUser: User;
  onLogout: () => void;
  companiesCount: number;
  companiesList?: Company[];
  selectedCompanyId?: number;
  onSelectCompany?: (id: number) => void;
  trashCount?: number;
  auditLogsCount?: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onChangeView,
  onOpenCompanyModal,
  onOpenChartModal,
  onOpenPythonModal,
  onOpenSqliteModal,
  onOpenUsersModal,
  onOpenMasterModal,
  onOpenSubscriptionModal,
  pendingApprovalsCount = 0,
  onOpenAuditLogModal,
  onOpenTrashModal,
  onOpenBackupModal,
  onOpenExtratoModal,
  onOpenCsvModal,
  onOpenResetModal,
  onOpenRecurringModal,
  onOpenOfxModal,
  onOpenBankAccountsModal,
  onOpenCostCentersModal,
  onOpenCashflowModal,
  onOpenBankingModal,
  onOpenSecurityModal,
  onDownloadAppPy,
  currentUser,
  onLogout,
  companiesCount,
  companiesList = [],
  selectedCompanyId,
  onSelectCompany,
  trashCount = 0,
  auditLogsCount = 0,
  isOpenMobile,
  onCloseMobile,
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

  const isReadOnlyRole = currentUser.role === 'leitor' || (!permissions.pode_adicionar_contas && !permissions.pode_editar_contas);

  // Check if sections have at least one visible item
  const hasFinancialTools = 
    (onOpenRecurringModal && permissions.pode_adicionar_contas) ||
    (onOpenOfxModal && permissions.pode_importar_extrato) ||
    (onOpenBankAccountsModal && permissions.pode_gerenciar_bancos) ||
    (onOpenCostCentersModal && permissions.pode_gerenciar_centros_custo) ||
    (onOpenExtratoModal && permissions.pode_importar_extrato) ||
    (onOpenCsvModal && (permissions.pode_exportar_relatorios || permissions.pode_adicionar_contas));

  const hasAuditTools = 
    (onOpenAuditLogModal && permissions.pode_ver_auditoria) ||
    (onOpenTrashModal && permissions.pode_ver_lixeira) ||
    Boolean(onOpenBackupModal);

  const hasAdminTools = 
    (onOpenMasterModal && isMaster) ||
    permissions.pode_gerenciar_usuarios ||
    permissions.pode_gerenciar_empresas ||
    isMaster ||
    currentUser.role === 'admin' ||
    Boolean(currentUser.is_admin) ||
    permissions.pode_ver_desenvolvedor ||
    permissions.pode_resetar_banco;

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside className={`
        fixed lg:static top-0 bottom-0 left-0 z-40
        w-64 bg-slate-900 dark:bg-slate-950 text-white flex flex-col shrink-0 border-r border-slate-800 transition-transform duration-200 ease-in-out
        ${isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand Header */}
        <div className="p-5 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-sm text-base">
              C
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight block leading-tight">Conectecontas</span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide">MULTIEMPRESA LOCAL</span>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1 text-slate-400 hover:text-white rounded-md"
            title="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Read-Only Badge indicator if applicable */}
        {isReadOnlyRole && !isMaster && (
          <div className="mx-3 mt-3 px-3 py-2 bg-sky-950/70 border border-sky-800/60 rounded-xl flex items-center gap-2 text-sky-300 shadow-xs">
            <Eye className="w-4 h-4 text-sky-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold leading-tight">Acesso Somente Leitura</p>
              <p className="text-[9px] text-sky-400/80 truncate">Modo Consulta & Relatórios</p>
            </div>
          </div>
        )}

        {/* Botão de Destaque Imediato: Backup Google Drive (Fixo no topo da Sidebar) */}
        {onOpenBackupModal && (
          <div className="mx-3 mt-3">
            <button
              id="sidebar-quick-backup-drive"
              onClick={() => {
                onOpenBackupModal();
                onCloseMobile();
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-gradient-to-r from-sky-950/90 via-sky-900/60 to-slate-900 border border-sky-500/50 hover:border-sky-400 text-sky-200 hover:text-white transition-all shadow-md group cursor-pointer"
              title="Abrir Backup & Sincronização no Google Drive"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <HardDrive className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold leading-tight flex items-center gap-1.5">
                    <span>Backup Google Drive</span>
                  </p>
                  <p className="text-[10px] text-sky-400/80 font-normal">Sincronização em Nuvem</p>
                </div>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                1-Clique
              </span>
            </button>
          </div>
        )}

        {/* Navigation links */}
        <div className="px-3 py-4 flex-1 overflow-y-auto space-y-5">
          
          {/* SEÇÃO 1: MENU PRINCIPAL */}
          <div>
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Menu Principal
            </p>
            <nav className="space-y-1">
              <button
                id="nav-btn-dashboard"
                onClick={() => {
                  onChangeView('all');
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left ${
                  currentView === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 opacity-90 shrink-0" />
                <span>Dashboard Geral</span>
              </button>

              <button
                id="nav-btn-pagar"
                onClick={() => {
                  onChangeView('pagar');
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left ${
                  currentView === 'pagar'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <ArrowDownCircle className="w-4 h-4 opacity-90 text-rose-400 shrink-0" />
                <span>Contas a Pagar</span>
              </button>

              <button
                id="nav-btn-receber"
                onClick={() => {
                  onChangeView('receber');
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left ${
                  currentView === 'receber'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <ArrowUpCircle className="w-4 h-4 opacity-90 text-emerald-400 shrink-0" />
                <span>Contas a Receber</span>
              </button>

              {onOpenCashflowModal && permissions.pode_ver_projecao && (
                <button
                  id="nav-btn-cashflow-projection"
                  onClick={() => {
                    onOpenCashflowModal();
                    onCloseMobile();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors rounded-lg text-sm font-medium cursor-pointer text-left"
                >
                  <TrendingUp className="w-4 h-4 opacity-90 text-indigo-400 shrink-0" />
                  <span>Fluxo Projetado (30/60/90d)</span>
                </button>
              )}

              {permissions.pode_ver_graficos && (
                <button
                  id="nav-btn-charts"
                  onClick={() => {
                    onOpenChartModal();
                    onCloseMobile();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors rounded-lg text-sm font-medium cursor-pointer text-left"
                >
                  <BarChart3 className="w-4 h-4 opacity-90 text-blue-400 shrink-0" />
                  <span>Relatórios & Gráficos</span>
                </button>
              )}
            </nav>
          </div>

          {/* SEÇÃO: EMPRESAS CADASTRADAS & EDIÇÃO */}
          <div className="pt-2 border-t border-slate-800/70">
            <div className="flex items-center justify-between px-3 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                  Empresas Cadastradas ({companiesList.length > 0 ? companiesList.length : companiesCount})
                </span>
              </div>
              <button
                id="sidebar-btn-edit-companies-header"
                onClick={() => {
                  onOpenCompanyModal();
                  onCloseMobile();
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-blue-400 hover:text-blue-200 bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/30 transition-colors cursor-pointer shrink-0"
                title="Cadastrar ou Editar Empresas / CNPJs"
              >
                <Pencil className="w-3 h-3" />
                <span>Editar</span>
              </button>
            </div>

            <div className="space-y-1">
              {/* Opção Todas as Empresas (Consolidado) se houver mais de 1 empresa */}
              {companiesList.length > 1 && (
                <button
                  id="sidebar-company-consolidated"
                  onClick={() => {
                    if (onSelectCompany) onSelectCompany(-1);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left ${
                    selectedCompanyId === -1
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">Todas (Consolidado)</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/90 text-indigo-300 shrink-0">
                    {companiesList.length}
                  </span>
                </button>
              )}

              {/* Lista de Empresas Cadastradas */}
              {companiesList.map((comp) => {
                const isSelected = selectedCompanyId === comp.id;
                return (
                  <button
                    key={comp.id}
                    id={`sidebar-company-item-${comp.id}`}
                    onClick={() => {
                      if (onSelectCompany) onSelectCompany(comp.id);
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left group ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <Building2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-blue-400'}`} />
                      <div className="min-w-0 truncate">
                        <span className="truncate block leading-tight">{comp.nome}</span>
                        {comp.cnpj && (
                          <span className={`text-[10px] font-mono block truncate ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                            {comp.cnpj}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-xs" title="Empresa Ativa" />
                    ) : (
                      <span className="text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors">
                        Ativar
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Botão para abrir o modal de Cadastro e Edição de CNPJs */}
              <button
                id="sidebar-btn-manage-add-company"
                onClick={() => {
                  onOpenCompanyModal();
                  onCloseMobile();
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 mt-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer border border-dashed border-blue-500/30 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Cadastrar / Editar CNPJs</span>
              </button>
            </div>
          </div>

          {/* SEÇÃO 2: RECURSOS FINANCEIROS */}
          {hasFinancialTools && (
            <div className="pt-2 border-t border-slate-800/70">
              <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Recursos Financeiros
              </p>
              <nav className="space-y-1">
                {onOpenRecurringModal && permissions.pode_adicionar_contas && (
                  <button
                    id="nav-btn-recurring"
                    onClick={() => {
                      onOpenRecurringModal();
                      onCloseMobile();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors rounded-lg text-sm font-medium cursor-pointer text-left"
                  >
                    <Repeat className="w-4 h-4 opacity-90 text-blue-400 shrink-0" />
                    <span>Lançamentos Recorrentes</span>
                  </button>
                )}

                {onOpenOfxModal && permissions.pode_importar_extrato && (
                  <button
                    id="nav-btn-ofx-reconciliation"
                    onClick={() => {
                      onOpenOfxModal();
                      onCloseMobile();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors rounded-lg text-sm font-medium cursor-pointer text-left"
                  >
                    <FileSpreadsheet className="w-4 h-4 opacity-90 text-emerald-400 shrink-0" />
                    <span>Conciliação OFX / Extrato</span>
                  </button>
                )}

                {onOpenBankAccountsModal && permissions.pode_gerenciar_bancos && (
                  <button
                    id="nav-btn-bank-accounts"
                    onClick={() => {
                      onOpenBankAccountsModal();
                      onCloseMobile();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors rounded-lg text-sm font-medium cursor-pointer text-left"
                  >
                    <Landmark className="w-4 h-4 opacity-90 text-amber-400 shrink-0" />
                    <span>Contas Bancárias Reais</span>
                  </button>
                )}

                {onOpenCostCentersModal && permissions.pode_gerenciar_centros_custo && (
                  <button
                    id="nav-btn-cost-centers"
                    onClick={() => {
                      onOpenCostCentersModal();
                      onCloseMobile();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors rounded-lg text-sm font-medium cursor-pointer text-left"
                  >
                    <Layers className="w-4 h-4 opacity-90 text-purple-400 shrink-0" />
                    <span>Centros de Custos</span>
                  </button>
                )}

                {onOpenBankingModal && (
                  <button
                    id="nav-btn-banking-integrations"
                    onClick={() => {
                      onOpenBankingModal();
                      onCloseMobile();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-emerald-300 hover:text-white bg-emerald-950/30 hover:bg-emerald-900/50 border border-emerald-500/30 transition-colors rounded-lg text-sm font-semibold cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-3">
                      <KeyRound className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Integrações Bancárias</span>
                    </div>
                    <span className="px-1.5 py-0.2 rounded-md text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                      APIs Reais
                    </span>
                  </button>
                )}

                {onOpenExtratoModal && permissions.pode_importar_extrato && (
                  <button
                    id="nav-btn-extratos"
                    onClick={() => {
                      onOpenExtratoModal();
                      onCloseMobile();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors rounded-lg text-sm font-medium cursor-pointer text-left"
                  >
                    <FileText className="w-4 h-4 opacity-90 text-sky-400 shrink-0" />
                    <span>Importar Extratos Texto</span>
                  </button>
                )}

                {onOpenCsvModal && (
                  <>
                    {permissions.pode_exportar_relatorios && (
                      <button
                        id="nav-btn-export-csv"
                        onClick={() => {
                          onOpenCsvModal('export');
                          onCloseMobile();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors rounded-lg text-sm font-medium cursor-pointer text-left"
                      >
                        <DownloadCloud className="w-4 h-4 opacity-90 text-emerald-400 shrink-0" />
                        <span>Exportar CSV</span>
                      </button>
                    )}

                    {permissions.pode_adicionar_contas && (
                      <button
                        id="nav-btn-import-csv"
                        onClick={() => {
                          onOpenCsvModal('import');
                          onCloseMobile();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors rounded-lg text-sm font-medium cursor-pointer text-left"
                      >
                        <UploadCloud className="w-4 h-4 opacity-90 text-teal-400 shrink-0" />
                        <span>Importar CSV</span>
                      </button>
                    )}
                  </>
                )}
              </nav>
            </div>
          )}

          {/* SEÇÃO 3: AUDITORIA & SEGURANÇA */}
          {hasAuditTools && (
            <div className="pt-2 border-t border-slate-800/70">
              <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Auditoria & Segurança
              </p>
              <nav className="space-y-1">
                {onOpenAuditLogModal && permissions.pode_ver_auditoria && (
                  <button
                    id="nav-btn-audit-logs"
                    onClick={() => {
                      onOpenAuditLogModal();
                      onCloseMobile();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors rounded-lg text-sm font-medium cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-3">
                      <History className="w-4 h-4 opacity-90 text-purple-400 shrink-0" />
                      <span>Trilha de Auditoria</span>
                    </div>
                    {auditLogsCount > 0 && (
                      <span className="text-[10px] font-mono font-bold bg-purple-950/80 text-purple-300 border border-purple-800/60 px-1.5 py-0.5 rounded-full shrink-0">
                        {auditLogsCount}
                      </span>
                    )}
                  </button>
                )}

                {onOpenTrashModal && permissions.pode_ver_lixeira && (
                  <button
                    id="nav-btn-trash-bin"
                    onClick={() => {
                      onOpenTrashModal();
                      onCloseMobile();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors rounded-lg text-sm font-medium cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-3">
                      <RotateCcw className="w-4 h-4 opacity-90 text-rose-400 shrink-0" />
                      <span>Lixeira (Recuperação)</span>
                    </div>
                    {trashCount > 0 && (
                      <span className="text-[10px] font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-800/60 px-1.5 py-0.5 rounded-full shrink-0">
                        {trashCount}
                      </span>
                    )}
                  </button>
                )}

                {onOpenBackupModal && (
                  <button
                    id="nav-btn-backup-restore"
                    onClick={() => {
                      onOpenBackupModal();
                      onCloseMobile();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors rounded-lg text-sm font-medium cursor-pointer text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <HardDrive className="w-4 h-4 opacity-90 text-sky-400 shrink-0 group-hover:scale-110 transition-transform" />
                      <span>Backup Google Drive</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-sky-950/80 text-sky-300 border border-sky-800/60 px-1.5 py-0.5 rounded-full shrink-0">
                      Nuvem
                    </span>
                  </button>
                )}
              </nav>
            </div>
          )}

          {/* SEÇÃO 4: ADMINISTRAÇÃO & DADOS */}
          {hasAdminTools && (
            <div className="pt-2 border-t border-slate-800/70">
              <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Administração & Acessos
              </p>
              <nav className="space-y-1">
                {/* Portal Master - Somente Super Admin */}
                {onOpenMasterModal && isMaster && (
                  <button
                    id="nav-btn-master-portal"
                    onClick={() => {
                      onOpenMasterModal();
                      onCloseMobile();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent hover:from-amber-500/25 text-amber-300 border border-amber-500/40 rounded-lg text-sm font-bold transition-all cursor-pointer text-left shadow-xs mb-2"
                  >
                    <div className="flex items-center gap-3">
                      <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Painel Master & Liberações</span>
                    </div>
                    {pendingApprovalsCount > 0 ? (
                      <span className="text-[10px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full shadow-xs animate-bounce shrink-0">
                        {pendingApprovalsCount} pendente{pendingApprovalsCount > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-400/70 font-normal">
                        Gestão
                      </span>
                    )}
                  </button>
                )}

                {(permissions.pode_gerenciar_usuarios || isMaster) && (
                  <button
                    id="nav-btn-users"
                    onClick={() => {
                      onOpenUsersModal();
                      onCloseMobile();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors rounded-lg text-sm font-medium cursor-pointer text-left"
                  >
                    <Users className="w-4 h-4 opacity-90 text-indigo-400 shrink-0" />
                    <span>Usuários & Acessos</span>
                  </button>
                )}

                {(permissions.pode_gerenciar_empresas || isMaster || currentUser.role === 'admin' || currentUser.is_admin) && (
                  <button
                    id="nav-btn-companies"
                    onClick={() => {
                      onOpenCompanyModal();
                      onCloseMobile();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors rounded-lg text-sm font-medium cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Building2 className="w-4 h-4 opacity-90 text-blue-400 shrink-0" />
                      <span className="truncate">Cadastro e Edição de CNPJs</span>
                    </div>
                    <span className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono shrink-0">
                      {companiesCount}
                    </span>
                  </button>
                )}

                {onOpenSubscriptionModal && (
                  <button
                    id="nav-btn-subscription"
                    onClick={() => {
                      onOpenSubscriptionModal();
                      onCloseMobile();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors rounded-lg text-sm font-medium cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-4 h-4 opacity-90 text-sky-400 shrink-0" />
                      <span>Minha Assinatura / Planos</span>
                    </div>
                    <span className="text-[10px] bg-sky-950/80 text-sky-300 border border-sky-800/60 px-1.5 py-0.5 rounded-full shrink-0 font-bold uppercase">
                      Mercado Pago
                    </span>
                  </button>
                )}

                {(permissions.pode_ver_desenvolvedor || isMaster) && (
                  <>
                    <button
                      id="nav-btn-sqlite"
                      onClick={() => {
                        onOpenSqliteModal();
                        onCloseMobile();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors rounded-lg text-sm font-medium cursor-pointer text-left"
                    >
                      <Database className="w-4 h-4 opacity-90 text-teal-400 shrink-0" />
                      <span>Tabelas SQLite (auth)</span>
                    </button>

                    <button
                      id="nav-btn-python"
                      onClick={() => {
                        onOpenPythonModal();
                        onCloseMobile();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors rounded-lg text-sm font-medium cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3">
                        <Monitor className="w-4 h-4 opacity-90 text-blue-400 shrink-0" />
                        <span>Desktop .EXE / Python</span>
                      </div>
                      <span className="text-[10px] bg-blue-600/80 text-white font-bold px-1.5 py-0.5 rounded">
                        Local
                      </span>
                    </button>
                  </>
                )}

                {onOpenResetModal && (permissions.pode_resetar_banco || isMaster) && (
                  <button
                    id="nav-btn-reset-data"
                    onClick={() => {
                      onOpenResetModal();
                      onCloseMobile();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-rose-300/90 hover:text-rose-200 hover:bg-rose-950/40 transition-colors rounded-lg text-sm font-medium cursor-pointer text-left border border-rose-900/30 mt-2"
                  >
                    <Trash2 className="w-4 h-4 opacity-90 text-rose-400 shrink-0" />
                    <span>Limpar Dados de Teste</span>
                  </button>
                )}
              </nav>
            </div>
          )}
        </div>

        {/* Card do Usuário Logado & Logout no Rodapé */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/90 space-y-2.5">
          <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0 ${
              isMaster ? 'bg-amber-500 text-slate-950' : 'bg-blue-600'
            }`}>
              {isMaster ? <Crown className="w-4 h-4" /> : currentUser.nome.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate leading-tight flex items-center gap-1">
                <span>{currentUser.nome}</span>
                {isMaster && <span className="text-[10px] font-black text-amber-400">👑</span>}
              </p>
              <p className="text-[10px] text-slate-400 truncate font-medium">
                {isMaster 
                  ? 'Administrador Master' 
                  : currentUser.role === 'leitor' 
                    ? 'Somente Leitura' 
                    : currentUser.role === 'operador' 
                      ? 'Operador' 
                      : currentUser.acesso_todas_empresas 
                        ? 'Acesso Global' 
                        : 'Acesso Restrito'}
              </p>
            </div>
          </div>

          {onOpenSecurityModal && (
            <button
              id="sidebar-security-btn"
              onClick={() => {
                onOpenSecurityModal();
                onCloseMobile();
              }}
              className="w-full py-1.5 px-3 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center gap-2 border border-slate-700/60 transition-colors cursor-pointer"
              title="Configurar tempo de inatividade e bloqueio automático"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Segurança & Inatividade</span>
            </button>
          )}

          {/* Botão Vermelho Destacado 🚪 Encerrar Sessão */}
          <button
            id="sidebar-logout-btn"
            onClick={onLogout}
            className="w-full py-2 px-3 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>🚪 Encerrar Sessão</span>
          </button>
        </div>
      </aside>
    </>
  );
};


