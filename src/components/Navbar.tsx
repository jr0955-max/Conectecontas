import React, { useMemo } from 'react';
import { 
  Building2, 
  ChevronDown, 
  Sun, 
  Moon, 
  Menu, 
  Users, 
  LogOut, 
  ShieldCheck, 
  Cloud, 
  RefreshCw,
  Crown,
  CreditCard,
  HardDrive,
  Lock
} from 'lucide-react';
import { Company, User, Tenant, getUserEffectivePermissions } from '../types';
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
              : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
          }`}
          title="Nuvem Google Firestore ativa. Clique para forçar sincronização instantânea com o celular e outros dispositivos."
        >
          {isSyncing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
          ) : (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
          <Cloud className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isSyncing ? 'Sincronizando...' : 'Nuvem Conectada'}</span>
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

        {/* Gerenciar Empresas Button (Restrito por permissão) */}
        {(permissions.pode_gerenciar_empresas || isMaster) && (
          <button
            id="btn-open-companies-header"
            onClick={onOpenCompanyModal}
            title="Cadastrar / Gerenciar Empresas"
            className="p-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <Building2 className="w-4 h-4" />
          </button>
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

        {/* Sincronizar Nuvem & Celular */}
        {onForceSync && (
          <button
            id="btn-navbar-sync-mobile"
            onClick={onForceSync}
            disabled={isSyncing}
            title="Sincronizar com Celular e Servidor Nuvem"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sincronizar Celular</span>
          </button>
        )}

        {/* Backup Google Drive Button (Restrito por permissão ou Master) */}
        {onOpenBackupModal && (permissions.pode_resetar_banco || isMaster) && (
          <button
            id="btn-navbar-backup-drive"
            onClick={onOpenBackupModal}
            title="Backup e Sincronização no Google Drive"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-colors cursor-pointer shrink-0"
          >
            <HardDrive className="w-3.5 h-3.5 text-sky-500" />
            <span className="hidden md:inline">Backup Google Drive</span>
          </button>
        )}

        {/* Minha Assinatura / Planos Mercado Pago */}
        {onOpenSubscriptionModal && (
          <button
            id="btn-navbar-subscription"
            onClick={onOpenSubscriptionModal}
            title="Minha Assinatura & Planos Mercado Pago"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-colors cursor-pointer shrink-0"
          >
            <CreditCard className="w-3.5 h-3.5 text-sky-500" />
            <span className="hidden sm:inline">Assinatura</span>
          </button>
        )}

        {/* Dark / Light Mode Toggle Button */}
        <button
          id="btn-toggle-theme"
          onClick={onToggleTheme}
          title={darkMode ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          className="p-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-gray-600" />}
        </button>

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

