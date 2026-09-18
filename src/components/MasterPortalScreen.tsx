import React, { useState, useMemo } from 'react';
import { 
  Crown, 
  ShieldCheck, 
  UserCheck, 
  UserX, 
  Clock, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  Mail, 
  KeyRound, 
  Trash2, 
  Search, 
  Sparkles, 
  Lock, 
  Unlock, 
  ArrowRight, 
  Users, 
  Check, 
  RefreshCw, 
  TrendingUp, 
  Sliders, 
  Eye, 
  EyeOff, 
  FileText, 
  CreditCard, 
  PieChart, 
  Shield, 
  Layers, 
  ChevronRight, 
  LogOut, 
  Briefcase, 
  ExternalLink,
  DollarSign,
  Activity,
  Calendar,
  Filter,
  Plus,
  Webhook,
  Play,
  HardDrive,
  Cloud,
  LayoutDashboard,
  Loader2
} from 'lucide-react';
import { 
  User, 
  Company, 
  UserCompanyLink, 
  FinancialAccount, 
  UserStatus, 
  UserRole,
  UserPermissions,
  AuditLog,
  Tenant,
  BillingInvoice,
  PERMISSION_DEFINITIONS,
  DEFAULT_ROLE_PERMISSIONS,
  getUserEffectivePermissions,
  isPlatformOwnerTenant,
  isTenantActive
} from '../types';
import { TenantManagementTab } from './TenantManagementTab';
import { MasterMercadoPagoTab } from './MasterMercadoPagoTab';
import { WebhookSimulatorModal } from './WebhookSimulatorModal';

interface MasterPortalScreenProps {
  currentUser: User;
  users: User[];
  companies: Company[];
  userCompanies: UserCompanyLink[];
  accounts: FinancialAccount[];
  auditLogs?: AuditLog[];
  tenants?: Tenant[];
  billingInvoices?: BillingInvoice[];
  onRefreshInvoices?: () => void;
  onEnterFinancialApp?: (targetCompanyId?: number) => void;
  onLogout: () => void;
  onApproveUser: (
    userId: number, 
    companyAction: 'create_new' | 'link_existing' | 'all_companies', 
    companyData: { name: string; cnpj?: string; existingCompanyId?: number },
    role: UserRole,
    customPermissions?: Partial<UserPermissions>
  ) => Promise<void> | void;
  onRejectUser: (userId: number, motivo?: string) => Promise<void> | void;
  onUpdateUserStatus: (userId: number, newStatus: UserStatus) => Promise<void> | void;
  onUpdateUserRole: (userId: number, newRole: UserRole, isMaster: boolean) => Promise<void> | void;
  onResetUserPassword: (userId: number, newPasswordPlain: string) => Promise<void> | void;
  onDeleteUser: (userId: number) => Promise<void> | void;
  onUpdateUserCompanies: (userId: number, acessoTodas: boolean, companyIds: number[]) => Promise<void> | void;
  onUpdateUserGranularPermissions?: (userId: number, permissions: Partial<UserPermissions>, role?: UserRole) => Promise<void> | void;
  onUpdateUserProfile?: (userId: number, data: { nome: string; email: string; senha?: string }) => Promise<{ success: boolean; error?: string }> | { success: boolean; error?: string };
  onSaveCompany?: (name: string, cnpj?: string) => Promise<void> | void;
  onSaveTenant?: (tenant: Partial<Tenant> & { id?: number }) => Promise<void>;
  onDeleteTenant?: (tenantId: number) => Promise<void>;
  onExtendTenantLicense?: (tenantId: number, daysToAdd: number) => Promise<void>;
  onUpdateTenantStatus?: (tenantId: number, status: 'ativo' | 'inativo' | 'expirado') => Promise<void>;
  onWipeAllData?: () => Promise<void>;
  onAccountReconciled?: (accountId: number, txId: string, provider: string) => void;
  onOpenBackupModal?: () => void;
}

export const MasterPortalScreen: React.FC<MasterPortalScreenProps> = ({
  currentUser,
  users,
  companies,
  userCompanies,
  accounts,
  auditLogs = [],
  tenants = [],
  billingInvoices = [],
  onRefreshInvoices,
  onEnterFinancialApp,
  onLogout,
  onApproveUser,
  onRejectUser,
  onUpdateUserStatus,
  onUpdateUserRole,
  onResetUserPassword,
  onDeleteUser,
  onUpdateUserCompanies,
  onUpdateUserGranularPermissions,
  onUpdateUserProfile,
  onSaveCompany,
  onSaveTenant,
  onDeleteTenant,
  onExtendTenantLicense,
  onUpdateTenantStatus,
  onWipeAllData,
  onAccountReconciled,
  onOpenBackupModal,
}) => {
  const [activeTab, setActiveTab] = useState<'pendentes' | 'tenants' | 'mercadopago' | 'usuarios' | 'empresas' | 'auditoria' | 'metricas' | 'webhooks'>('tenants');
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [simProvider, setSimProvider] = useState<'bb' | 'stone' | 'infinitepay'>('bb');
  const [isQuickSimulating, setIsQuickSimulating] = useState(false);
  const [quickSimResult, setQuickSimResult] = useState<any | null>(null);
  
  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | UserStatus>('todos');

  // Super Admin Master Profile Modal (Nome, Usuário / E-mail, Senha)
  const [isEditingMasterProfile, setIsEditingMasterProfile] = useState(false);
  const [profileNome, setProfileNome] = useState(currentUser.nome);
  const [profileEmail, setProfileEmail] = useState(currentUser.email);
  const [profilePassword, setProfilePassword] = useState('');
  const [showProfilePassword, setShowProfilePassword] = useState(false);
  const [profileErrorMsg, setProfileErrorMsg] = useState('');
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [isSavingMasterProfile, setIsSavingMasterProfile] = useState(false);

  // Modal sub-states
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [wipeSuccessMsg, setWipeSuccessMsg] = useState('');
  const [approvingUser, setApprovingUser] = useState<User | null>(null);
  const [approvalCompanyAction, setApprovalCompanyAction] = useState<'create_new' | 'link_existing' | 'all_companies'>('create_new');
  const [approvalCompanyName, setApprovalCompanyName] = useState('');
  const [approvalCompanyCnpj, setApprovalCompanyCnpj] = useState('');
  const [approvalSelectedCompanyId, setApprovalSelectedCompanyId] = useState<number>(companies[0]?.id || 1);
  const [approvalRole, setApprovalRole] = useState<UserRole>('admin');
  const [approvalCustomPermissions, setApprovalCustomPermissions] = useState<UserPermissions>(DEFAULT_ROLE_PERMISSIONS.admin);
  const [showApprovalCustomPerms, setShowApprovalCustomPerms] = useState(false);
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);

  // Granular Permissions Modal
  const [editingPermissionsUser, setEditingPermissionsUser] = useState<User | null>(null);
  const [editPermissionsRole, setEditPermissionsRole] = useState<UserRole>('admin');
  const [editPermissionsMap, setEditPermissionsMap] = useState<UserPermissions>(DEFAULT_ROLE_PERMISSIONS.admin);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [permissionsSuccessMsg, setPermissionsSuccessMsg] = useState('');

  // Reject Modal
  const [rejectingUser, setRejectingUser] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Password Reset
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');

  // Company Link Editing
  const [editingCompaniesUser, setEditingCompaniesUser] = useState<User | null>(null);
  const [editAcessoTodas, setEditAcessoTodas] = useState(false);
  const [editCompanyIds, setEditCompanyIds] = useState<number[]>([]);

  // New Company Modal
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCnpj, setNewCompanyCnpj] = useState('');

  // Delete User Confirmation Modal
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      await onDeleteUser(userToDelete.id);
      setUserToDelete(null);
    } catch (e) {
      console.error('Erro ao excluir usuário:', e);
      setUserToDelete(null);
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Target Company for entering the app
  const [selectedLaunchCompanyId, setSelectedLaunchCompanyId] = useState<number>(-1);

  // Derived lists
  const pendingUsers = useMemo(() => {
    return users.filter((u) => (u.status === 'pendente' || (!u.status && !u.is_master && Number(u.id) > 3)));
  }, [users]);

  const activeUsers = useMemo(() => {
    return users.filter((u) => u.status === 'ativo' || (!u.status && (u.is_master || Number(u.id) <= 3)));
  }, [users]);

  // Clientes SaaS reais (exclui donos da plataforma e matriz pessoal)
  const saasTenants = useMemo(() => {
    return tenants.filter((t) => !isPlatformOwnerTenant(t));
  }, [tenants]);

  const activeSaasTenantsCount = useMemo(() => {
    return saasTenants.filter((t) => isTenantActive(t)).length;
  }, [saasTenants]);

  const blockedUsers = useMemo(() => {
    return users.filter((u) => u.status === 'bloqueado' || u.status === 'rejeitado');
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch = 
        u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.empresa_solicitada && u.empresa_solicitada.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.telefone && u.telefone.includes(searchTerm));
      
      const currentStat = u.status || (u.is_master ? 'ativo' : 'ativo');
      const matchStatus = statusFilter === 'todos' ? true : currentStat === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [users, searchTerm, statusFilter]);

  // Approval Handlers
  const handleOpenApprovalModal = (user: User) => {
    setApprovingUser(user);
    setApprovalCompanyName(user.empresa_solicitada || `Empresa de ${user.nome.split(' ')[0]}`);
    setApprovalCompanyCnpj(user.cnpj_solicitado || '');
    setApprovalCompanyAction('create_new');
    setApprovalSelectedCompanyId(companies[0]?.id || 1);
    setApprovalRole('admin');
    setApprovalCustomPermissions(DEFAULT_ROLE_PERMISSIONS.admin);
    setShowApprovalCustomPerms(false);
  };

  const handleApprovalRoleChange = (role: UserRole) => {
    setApprovalRole(role);
    setApprovalCustomPermissions(DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.admin);
  };

  const toggleApprovalPerm = (key: keyof UserPermissions) => {
    setApprovalCustomPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleConfirmApproval = async () => {
    if (!approvingUser) return;
    setIsProcessingApproval(true);
    try {
      await onApproveUser(
        approvingUser.id,
        approvalCompanyAction,
        {
          name: approvalCompanyName.trim() || 'Minha Empresa',
          cnpj: approvalCompanyCnpj.trim() || undefined,
          existingCompanyId: approvalSelectedCompanyId,
        },
        approvalRole,
        approvalCustomPermissions
      );
      setApprovingUser(null);
    } finally {
      setIsProcessingApproval(false);
    }
  };

  // Granular Permissions Handlers
  const handleOpenEditPermissions = (user: User) => {
    setEditingPermissionsUser(user);
    const effectiveRole = user.role || 'admin';
    setEditPermissionsRole(effectiveRole);
    setEditPermissionsMap(getUserEffectivePermissions(user));
    setPermissionsSuccessMsg('');
  };

  const handleEditPermissionsRoleChange = (role: UserRole) => {
    setEditPermissionsRole(role);
    setEditPermissionsMap(DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.admin);
  };

  const toggleEditPerm = (key: keyof UserPermissions) => {
    setEditPermissionsMap(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSaveUserPermissions = async () => {
    if (!editingPermissionsUser) return;
    setIsSavingPermissions(true);
    try {
      if (onUpdateUserGranularPermissions) {
        await onUpdateUserGranularPermissions(editingPermissionsUser.id, editPermissionsMap, editPermissionsRole);
      } else {
        await onUpdateUserRole(editingPermissionsUser.id, editPermissionsRole, Boolean(editingPermissionsUser.is_master));
      }
      setPermissionsSuccessMsg(`Permissões de ${editingPermissionsUser.nome} atualizadas com sucesso!`);
      setTimeout(() => {
        setEditingPermissionsUser(null);
        setPermissionsSuccessMsg('');
      }, 1200);
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const handleConfirmRejection = async () => {
    if (!rejectingUser) return;
    await onRejectUser(rejectingUser.id, rejectReason.trim() || undefined);
    setRejectingUser(null);
    setRejectReason('');
  };

  const handleSaveResetPassword = async () => {
    if (!resettingUser || newPassword.length < 6) return;
    await onResetUserPassword(resettingUser.id, newPassword);
    setResetSuccessMsg(`Senha do usuário ${resettingUser.nome} redefinida com sucesso!`);
    setTimeout(() => {
      setResettingUser(null);
      setNewPassword('');
      setResetSuccessMsg('');
    }, 1500);
  };

  const handleOpenEditCompanies = (user: User) => {
    setEditingCompaniesUser(user);
    setEditAcessoTodas(Boolean(user.acesso_todas_empresas));
    const linked = userCompanies
      .filter((uc) => Number(uc.usuario_id) === Number(user.id))
      .map((uc) => Number(uc.empresa_id));
    setEditCompanyIds(linked);
  };

  const handleSaveEditCompanies = async () => {
    if (!editingCompaniesUser) return;
    await onUpdateUserCompanies(editingCompaniesUser.id, editAcessoTodas, editCompanyIds);
    setEditingCompaniesUser(null);
  };

  const toggleCompanyInEdit = (companyId: number) => {
    if (editCompanyIds.includes(companyId)) {
      setEditCompanyIds(editCompanyIds.filter((id) => id !== companyId));
    } else {
      setEditCompanyIds([...editCompanyIds, companyId]);
    }
  };

  const handleCreateCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    if (onSaveCompany) {
      await onSaveCompany(newCompanyName.trim(), newCompanyCnpj.trim() || undefined);
    }
    setIsAddingCompany(false);
    setNewCompanyName('');
    setNewCompanyCnpj('');
  };

  const handleOpenMasterProfileModal = () => {
    setProfileNome(currentUser.nome);
    setProfileEmail(currentUser.email);
    setProfilePassword('');
    setShowProfilePassword(false);
    setProfileErrorMsg('');
    setProfileSuccessMsg('');
    setIsEditingMasterProfile(true);
  };

  const handleSaveMasterProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErrorMsg('');
    setProfileSuccessMsg('');

    if (!profileNome.trim()) {
      setProfileErrorMsg('Por favor, informe o nome do Administrador Master.');
      return;
    }
    if (!profileEmail.trim() || !profileEmail.includes('@')) {
      setProfileErrorMsg('Por favor, informe um e-mail / usuário de acesso válido.');
      return;
    }
    if (profilePassword && profilePassword.length < 6) {
      setProfileErrorMsg('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setIsSavingMasterProfile(true);
    try {
      if (onUpdateUserProfile) {
        const res = await onUpdateUserProfile(currentUser.id, {
          nome: profileNome.trim(),
          email: profileEmail.trim().toLowerCase(),
          senha: profilePassword || undefined,
        });
        if (res && !res.success) {
          setProfileErrorMsg(res.error || 'Erro ao atualizar dados do perfil.');
          setIsSavingMasterProfile(false);
          return;
        }
      } else {
        if (profilePassword) {
          await onResetUserPassword(currentUser.id, profilePassword);
        }
      }

      setProfileSuccessMsg('Dados do Super Admin Master atualizados com sucesso!');
      setTimeout(() => {
        setIsEditingMasterProfile(false);
      }, 1200);
    } catch (err: any) {
      setProfileErrorMsg(err?.message || 'Falha ao atualizar dados de perfil.');
    } finally {
      setIsSavingMasterProfile(false);
    }
  };

  const totalVolumeGeral = useMemo(() => {
    return accounts
      .filter((a) => !a.excluido)
      .reduce((sum, a) => sum + Number(a.valor || 0), 0);
  }, [accounts]);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 font-sans flex flex-col antialiased">
      
      {/* ================= TOP HEADER BAR ================= */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        
        {/* Brand & Master Status */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20 border border-amber-400/40">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>Painel Master & Gatekeeper</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Super Admin Exclusivo
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>Gatekeeper de Liberação &bull; Gestão Centralizada de Acessos e Clientes SaaS</span>
            </p>
          </div>
        </div>

        {/* Right Action: Gatekeeper Control & Logout */}
        <div className="flex items-center gap-3">

          {/* Switch to Financial App (Sidebar) */}
          {onEnterFinancialApp && (
            <button
              id="btn-portal-enter-financial-app"
              onClick={() => onEnterFinancialApp(-1)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-blue-600/30 shrink-0"
              title="Acessar o Sistema Financeiro com Menu Lateral Esquerdo Completo"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Ir para Sistema Financeiro</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          
          {/* Backup Google Drive Quick Trigger */}
          {onOpenBackupModal && (
            <button
              id="btn-portal-open-backup-drive"
              onClick={onOpenBackupModal}
              className="px-3.5 py-2 bg-sky-950/80 hover:bg-sky-900 border border-sky-500/50 text-sky-300 hover:text-sky-100 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="Abrir Backup & Sincronização no Google Drive"
            >
              <HardDrive className="w-3.5 h-3.5 text-sky-400" />
              <span>Backup Google Drive</span>
            </button>
          )}

          {/* Webhook Simulator Quick Trigger */}
          <button
            id="btn-portal-open-webhooks"
            onClick={() => setActiveTab('webhooks')}
            className="px-3.5 py-2 bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/50 text-indigo-300 hover:text-indigo-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Simulador de Webhooks Bancários (Banco do Brasil, Stone, InfinitePay)"
          >
            <Webhook className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Simulador Webhooks</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </button>

          {/* Quick Clear Database Action */}
          {onWipeAllData && (
            <button
              id="btn-portal-wipe-all"
              onClick={() => setIsWipeModalOpen(true)}
              className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="Limpar base e redefinir clientes e usuários"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Limpar Base de Dados</span>
            </button>
          )}

          {/* Master Profile & Logout */}
          <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
            <button
              id="btn-portal-profile-header"
              onClick={handleOpenMasterProfileModal}
              className="hidden md:flex flex-col text-right hover:opacity-85 transition-opacity cursor-pointer group"
              title="Clique para editar Nome, Usuário de Login e Senha do Super Admin"
            >
              <span className="text-xs font-bold text-white leading-tight flex items-center gap-1.5 justify-end group-hover:text-amber-300 transition-colors">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                {currentUser.nome}
              </span>
              <span className="text-[10px] text-amber-400/90 font-mono">{currentUser.email}</span>
            </button>

            {/* Edit Master Profile Button */}
            <button
              id="btn-portal-edit-master-profile"
              onClick={handleOpenMasterProfileModal}
              className="px-3 py-2 text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 hover:border-amber-500/60 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Editar Nome, Usuário/E-mail e Senha do Super Admin Master"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Editar Perfil Master</span>
            </button>

            <button
              id="btn-portal-logout"
              onClick={onLogout}
              className="px-3 py-2 text-xs font-bold text-slate-300 hover:text-rose-300 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/60 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              title="Encerrar Sessão Master"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>

        </div>

      </header>

      {/* ================= HERO STATS & METRICS ================= */}
      <section className="bg-slate-900/60 border-b border-slate-800/80 px-4 sm:px-8 py-5">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Metric 1: Pending Approvals */}
          <div 
            onClick={() => setActiveTab('pendentes')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
              activeTab === 'pendentes'
                ? 'bg-amber-950/30 border-amber-500/60 shadow-lg shadow-amber-500/10'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Aguardando Liberação</span>
              </span>
              {pendingUsers.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-pulse">
                  {pendingUsers.length} Novo{pendingUsers.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{pendingUsers.length}</span>
              <span className="text-xs text-slate-400">solicitações pendentes</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Gatekeeper: Libere os cadastros criando ou vinculando empresas.
            </p>
          </div>

          {/* Metric 2: Active Clients & Users */}
          <div 
            onClick={() => setActiveTab('usuarios')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
              activeTab === 'usuarios'
                ? 'bg-blue-950/30 border-blue-500/60 shadow-lg shadow-blue-500/10'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-400" />
                <span>Usuários Liberados</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{activeUsers.length} ativos</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{activeUsers.length}</span>
              <span className="text-xs text-slate-400">de {users.length} cadastrados</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Administradores e operadores com permissões concedidas.
            </p>
          </div>

          {/* Metric 3: Isolated Companies */}
          <div 
            onClick={() => setActiveTab('empresas')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
              activeTab === 'empresas'
                ? 'bg-emerald-950/30 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>Empresas Isoladas</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">100% Seguras</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{companies.length}</span>
              <span className="text-xs text-slate-400">CNPJs cadastrados</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Cada cliente acessa apenas a sua respectiva empresa.
            </p>
          </div>

          {/* Metric 4: SaaS Clients & Licenses */}
          <div 
            onClick={() => setActiveTab('tenants')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
              activeTab === 'tenants'
                ? 'bg-purple-950/30 border-purple-500/60 shadow-lg shadow-purple-500/10'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Clientes SaaS & Licenças</span>
              </span>
              <span className="text-[10px] text-purple-400 font-mono">
                {activeSaasTenantsCount} {activeSaasTenantsCount === 1 ? 'ativo' : 'ativos'}
              </span>
            </div>
            <div className="flex items-baseline gap-1 truncate">
              <span className="text-3xl font-black text-white">
                {saasTenants.length}
              </span>
              <span className="text-xs text-slate-400">
                {saasTenants.length === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Controle de planos, limites e renovação de licenças.
            </p>
          </div>

        </div>
      </section>

      {/* ================= PORTAL NAVIGATION TABS ================= */}
      <div className="border-b border-slate-800 bg-slate-900 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto text-xs font-bold pt-2">
          
          <button
            id="tab-portal-tenants"
            onClick={() => setActiveTab('tenants')}
            className={`pb-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors shrink-0 ${
              activeTab === 'tenants'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Clientes SaaS & Vendas ({saasTenants.length})</span>
          </button>

          <button
            id="tab-portal-mercadopago"
            onClick={() => setActiveTab('mercadopago')}
            className={`pb-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors shrink-0 ${
              activeTab === 'mercadopago'
                ? 'border-sky-400 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4 text-sky-400" />
            <span>Mercado Pago & Assinaturas SaaS</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-sky-500 text-slate-950 font-black">
              R$ 99/mês
            </span>
          </button>

          <button
            id="tab-portal-pendentes"
            onClick={() => setActiveTab('pendentes')}
            className={`pb-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors shrink-0 ${
              activeTab === 'pendentes'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Fila de Liberações</span>
            {pendingUsers.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-slate-950 font-black">
                {pendingUsers.length}
              </span>
            )}
          </button>

          <button
            id="tab-portal-usuarios"
            onClick={() => setActiveTab('usuarios')}
            className={`pb-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors shrink-0 ${
              activeTab === 'usuarios'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Gestão de Usuários & Menus ({users.length})</span>
          </button>

          <button
            id="tab-portal-empresas"
            onClick={() => setActiveTab('empresas')}
            className={`pb-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors shrink-0 ${
              activeTab === 'empresas'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Subempresas & Vínculos ({companies.length})</span>
          </button>

          <button
            id="tab-portal-auditoria"
            onClick={() => setActiveTab('auditoria')}
            className={`pb-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors shrink-0 ${
              activeTab === 'auditoria'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Trilha de Auditoria ({auditLogs.length})</span>
          </button>

          <button
            id="tab-portal-metricas"
            onClick={() => setActiveTab('metricas')}
            className={`pb-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors shrink-0 ${
              activeTab === 'metricas'
                ? 'border-indigo-400 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Métricas & Visão Geral</span>
          </button>

          <button
            id="tab-portal-webhooks"
            onClick={() => setActiveTab('webhooks')}
            className={`pb-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors shrink-0 ${
              activeTab === 'webhooks'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Webhook className="w-4 h-4 text-amber-400" />
            <span>Simulador Webhooks & Conciliação</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500 text-slate-950 font-black">
              BB &bull; Stone &bull; InfinitePay
            </span>
          </button>

          {onOpenBackupModal && (
            <button
              id="tab-portal-backup"
              onClick={onOpenBackupModal}
              className="pb-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors shrink-0 border-transparent text-sky-400 hover:text-sky-300 hover:border-sky-400/50"
              title="Abrir Backup & Sincronização no Google Drive"
            >
              <HardDrive className="w-4 h-4 text-sky-400" />
              <span>Backup Google Drive</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono">
                Nuvem
              </span>
            </button>
          )}

        </div>
      </div>

      {/* ================= MAIN CONTENT AREA ================= */}
      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        
        {/* ================= TAB 0: CLIENTES SAAS (TENANTS) ================= */}
        {activeTab === 'tenants' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <TenantManagementTab
              tenants={tenants}
              companies={companies}
              users={users}
              onSaveTenant={onSaveTenant || (async () => {})}
              onDeleteTenant={onDeleteTenant || (async () => {})}
              onExtendTenantLicense={onExtendTenantLicense || (async () => {})}
              onUpdateTenantStatus={onUpdateTenantStatus || (async () => {})}
              onSelectLaunchCompany={(compId) => setSelectedLaunchCompanyId(compId)}
            />
          </div>
        )}

        {/* ================= TAB MERCADO PAGO SAAS & COBRANÇAS ================= */}
        {activeTab === 'mercadopago' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <MasterMercadoPagoTab
              tenants={tenants}
              currentUser={currentUser}
              invoices={billingInvoices}
              onExtendTenantLicense={onExtendTenantLicense || (async () => {})}
              onUpdateTenantStatus={onUpdateTenantStatus || (async () => {})}
              onRefreshData={onRefreshInvoices}
            />
          </div>
        )}

        {/* ================= TAB 1: FILA DE LIBERAÇÕES ================= */}
        {activeTab === 'pendentes' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 p-4 rounded-2xl border border-amber-500/30">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Solicitações de Novos Clientes & Empresas</span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                    {pendingUsers.length} aguardando
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Aqui você avalia cada solicitação de cadastro, cria uma empresa isolada e define o perfil de acesso (Admin, Operador ou Somente Leitura).
                </p>
              </div>

              {pendingUsers.length > 0 && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-amber-400 font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>Aprovação Segura com Isolamento de CNPJ</span>
                  </span>
                </div>
              )}
            </div>

            {/* Pending List or Empty State */}
            {pendingUsers.length === 0 ? (
              <div className="py-16 px-4 text-center bg-slate-900/60 rounded-3xl border border-slate-800 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">Nenhum cadastro pendente de liberação!</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Todas as solicitações de acesso foram analisadas e liberadas pelo Super Admin Master.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('usuarios')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    <span>Ver Usuários Ativos</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingUsers.map((user) => (
                  <div 
                    key={user.id}
                    className="bg-slate-900/90 border border-amber-500/40 hover:border-amber-500/80 rounded-2xl p-5 space-y-4 transition-all shadow-xl backdrop-blur-sm"
                  >
                    {/* User info header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-black text-base shadow-inner">
                          {user.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white leading-tight">{user.nome}</h4>
                          <p className="text-xs text-slate-400 font-mono">{user.email}</p>
                          {user.telefone && (
                            <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium mt-0.5">
                              <Phone className="w-3 h-3" />
                              <span>{user.telefone}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                        Pendente
                      </span>
                    </div>

                    {/* Requested Company Details Card */}
                    <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                          <Building2 className="w-4 h-4 text-blue-400" />
                          <span>Empresa Solicitada:</span>
                        </span>
                        <span className="font-bold text-white text-right">
                          {user.empresa_solicitada || 'Nova Empresa'}
                        </span>
                      </div>

                      {user.cnpj_solicitado && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">CNPJ Informado:</span>
                          <span className="font-mono text-slate-200">{user.cnpj_solicitado}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                        <span>Data da Solicitação:</span>
                        <span>{user.criado_em || 'Recente'}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setRejectingUser(user)}
                        className="py-2.5 px-3 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700/60 hover:border-rose-800"
                      >
                        <UserX className="w-4 h-4" />
                        <span>Recusar</span>
                      </button>
                      
                      <button
                        type="button"
                        id={`btn-approve-portal-${user.id}`}
                        onClick={() => handleOpenApprovalModal(user)}
                        className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-950/40"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Aprovar & Configurar Acesso</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* ================= TAB 2: GESTÃO DE USUÁRIOS & MENUS ================= */}
        {activeTab === 'usuarios' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome, email, empresa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto text-xs font-semibold">
                <button
                  onClick={() => setStatusFilter('todos')}
                  className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer shrink-0 ${
                    statusFilter === 'todos'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Todos ({users.length})
                </button>
                <button
                  onClick={() => setStatusFilter('ativo')}
                  className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer shrink-0 ${
                    statusFilter === 'ativo'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Ativos ({activeUsers.length})
                </button>
                <button
                  onClick={() => setStatusFilter('pendente')}
                  className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer shrink-0 ${
                    statusFilter === 'pendente'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Pendentes ({pendingUsers.length})
                </button>
                <button
                  onClick={() => setStatusFilter('bloqueado')}
                  className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer shrink-0 ${
                    statusFilter === 'bloqueado'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Bloqueados ({blockedUsers.length})
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Usuário</th>
                      <th className="py-3 px-4">Perfil / Papel</th>
                      <th className="py-3 px-4">Empresas Permitidas</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Controles & Permissões</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredUsers.map((user) => {
                      const isSelf = user.id === currentUser.id;
                      const isUserMaster = Boolean(user.is_master || user.email.toLowerCase() === 'admin@financeiro.com' || Number(user.id) === 1);
                      const userStatus = user.status || (isUserMaster ? 'ativo' : 'ativo');
                      const userRole = user.role || (isUserMaster ? 'master' : 'admin');
                      
                      const linkedCompIds = userCompanies
                        .filter((uc) => Number(uc.usuario_id) === Number(user.id))
                        .map((uc) => Number(uc.empresa_id));
                      const linkedComps = companies.filter((c) => linkedCompIds.includes(Number(c.id)));

                      return (
                        <tr key={user.id} className="hover:bg-slate-850/60 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                isUserMaster 
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-inner' 
                                  : 'bg-blue-600 text-white'
                              }`}>
                                {isUserMaster ? <Crown className="w-4 h-4" /> : user.nome.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-white flex items-center gap-1.5 truncate">
                                  <span>{user.nome}</span>
                                  {isSelf && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-900/60 text-blue-300 border border-blue-700/60">
                                      Você
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                                {user.telefone && (
                                  <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                                    <Phone className="w-2.5 h-2.5" />
                                    <span>{user.telefone}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {isUserMaster ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                <Crown className="w-3 h-3" />
                                <span>Super Admin Master</span>
                              </span>
                            ) : userRole === 'leitor' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-950/80 text-purple-300 border border-purple-800/60">
                                <Eye className="w-3 h-3" />
                                <span>Somente Leitura (Consulta)</span>
                              </span>
                            ) : userRole === 'operador' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                                <CreditCard className="w-3 h-3" />
                                <span>Operador Financeiro</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/60">
                                <ShieldCheck className="w-3 h-3" />
                                <span>Administrador da Empresa</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {user.acesso_todas_empresas ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                                <Check className="w-3 h-3" />
                                <span>Todas ({companies.length} Empresas)</span>
                              </span>
                            ) : linkedComps.length > 0 ? (
                              <div className="space-y-0.5">
                                {linkedComps.slice(0, 2).map((c) => (
                                  <span key={c.id} className="block text-[11px] text-slate-300 truncate max-w-[180px]">
                                    &bull; {c.nome}
                                  </span>
                                ))}
                                {linkedComps.length > 2 && (
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    +{linkedComps.length - 2} outras
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-amber-400 font-medium">
                                Nenhuma empresa vinculada
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {userStatus === 'ativo' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Ativo</span>
                              </span>
                            )}
                            {userStatus === 'pendente' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/60 animate-pulse">
                                <Clock className="w-3 h-3" />
                                <span>Pendente</span>
                              </span>
                            )}
                            {userStatus === 'bloqueado' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800/60">
                                <Lock className="w-3 h-3" />
                                <span>Bloqueado</span>
                              </span>
                            )}
                            {userStatus === 'rejeitado' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                <UserX className="w-3 h-3" />
                                <span>Recusado</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              
                              {userStatus === 'pendente' && (
                                <button
                                  onClick={() => handleOpenApprovalModal(user)}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                                >
                                  Aprovar
                                </button>
                              )}

                              {/* Edit Granular Permissions & Menus (Permitido para todos os usuários) */}
                              <button
                                id={`btn-perm-portal-${user.id}`}
                                onClick={() => handleOpenEditPermissions(user)}
                                title="Configurar Menus e Permissões Específicas"
                                className="p-1.5 text-slate-300 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              >
                                <Sliders className="w-4 h-4" />
                              </button>

                              {/* Password Reset (Disponível para qualquer usuário, inclusive a si mesmo) */}
                              <button
                                onClick={() => {
                                  setResettingUser(user);
                                  setNewPassword('');
                                  setResetSuccessMsg('');
                                }}
                                title="Redefinir / Alterar Senha de Acesso"
                                className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              >
                                <KeyRound className="w-4 h-4" />
                              </button>

                              {(isSelf || user.is_master) && (
                                <button
                                  id={`btn-edit-master-profile-${user.id}`}
                                  onClick={handleOpenMasterProfileModal}
                                  title="Editar Nome, Usuário/E-mail e Senha do Super Admin Master"
                                  className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Crown className="w-4 h-4" />
                                </button>
                              )}

                              {!isSelf && (
                                <>
                                  {/* Toggle Block / Unblock */}
                                  {userStatus === 'ativo' ? (
                                    <button
                                      onClick={() => onUpdateUserStatus(user.id, 'bloqueado')}
                                      title="Bloquear Acesso"
                                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Lock className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => onUpdateUserStatus(user.id, 'ativo')}
                                      title="Liberar Acesso"
                                      className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Unlock className="w-4 h-4" />
                                    </button>
                                  )}

                                  {/* Edit Company Isolation */}
                                  <button
                                    onClick={() => handleOpenEditCompanies(user)}
                                    title="Definir Empresas Permitidas (Isolamento)"
                                    className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Building2 className="w-4 h-4" />
                                  </button>

                                  {/* Delete User */}
                                  <button
                                    onClick={() => setUserToDelete(user)}
                                    title="Excluir Usuário"
                                    className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ================= TAB 3: EMPRESAS & CLIENTES ================= */}
        {activeTab === 'empresas' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-400" />
                  <span>Empresas & Isolamento Multi-Empresa</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Gerencie os CNPJs e acesse diretamente o ambiente financeiro isolado de qualquer empresa.
                </p>
              </div>

              <button
                id="btn-portal-add-company"
                onClick={() => setIsAddingCompany(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Nova Empresa</span>
              </button>
            </div>

            {/* Companies Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {companies.map((comp) => {
                const companyAccounts = accounts.filter((a) => Number(a.empresa_id) === Number(comp.id) && !a.excluido);
                const totalPagar = companyAccounts
                  .filter((a) => a.tipo === 'pagar')
                  .reduce((sum, a) => sum + Number(a.valor || 0), 0);
                const totalReceber = companyAccounts
                  .filter((a) => a.tipo === 'receber')
                  .reduce((sum, a) => sum + Number(a.valor || 0), 0);

                const linkedUsers = users.filter((u) => {
                  if (u.acesso_todas_empresas) return false;
                  return userCompanies.some(
                    (uc) => Number(uc.usuario_id) === Number(u.id) && Number(uc.empresa_id) === Number(comp.id)
                  );
                });

                return (
                  <div 
                    key={comp.id}
                    className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
                            <Building2 className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white leading-tight">{comp.nome}</h4>
                            <p className="text-[11px] font-mono text-slate-400">{comp.cnpj || 'CNPJ não informado'}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono bg-slate-950 px-2 py-0.5 rounded text-slate-400 border border-slate-800">
                          ID: #{comp.id}
                        </span>
                      </div>

                      {/* Totals Summary */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        <div>
                          <span className="text-[10px] text-slate-400 block">A Pagar:</span>
                          <span className="font-bold text-rose-400">R$ {totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">A Receber:</span>
                          <span className="font-bold text-emerald-400">R$ {totalReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      {/* Linked Users */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400 block">
                          Usuários com Acesso Exclusivo:
                        </span>
                        <div className="space-y-1">
                          {linkedUsers.length === 0 ? (
                            <span className="text-[11px] text-slate-500 italic block">
                              Apenas Administradores Globais / Masters
                            </span>
                          ) : (
                            linkedUsers.map((u) => (
                              <div key={u.id} className="flex items-center justify-between text-xs bg-slate-950/60 px-2.5 py-1 rounded-lg border border-slate-800/60">
                                <span className="font-medium text-slate-200 truncate">{u.nome}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{u.role === 'leitor' ? 'Leitor' : u.role === 'operador' ? 'Operador' : 'Admin'}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Launch into this company */}
                    <div className="pt-2">
                      <button
                        onClick={() => onEnterFinancialApp(comp.id)}
                        className="w-full py-2.5 px-3 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-700/80 hover:border-blue-500 shadow-md"
                      >
                        <span>Acessar Financeiro desta Empresa</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* ================= TAB 4: TRILHA DE AUDITORIA ================= */}
        {activeTab === 'auditoria' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-400" />
                  <span>Trilha de Auditoria & Registro de Eventos</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Histórico completo de aprovações, liberações, edições e exclusões realizadas no sistema.
                </p>
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              {auditLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Nenhum registro de auditoria disponível no momento.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Data / Hora</th>
                        <th className="py-3 px-4">Ação</th>
                        <th className="py-3 px-4">Usuário</th>
                        <th className="py-3 px-4">Descrição do Evento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {auditLogs.slice(0, 50).map((log) => (
                        <tr key={log.id} className="hover:bg-slate-850/60 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {log.data_hora ? new Date(log.data_hora).toLocaleString('pt-BR') : 'Recente'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              {log.acao}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-200 whitespace-nowrap">
                            {log.usuario_nome}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {log.descricao}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 5: MÉTRICAS GLOBAIS ================= */}
        {activeTab === 'metricas' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                <span className="text-xs text-slate-400 font-semibold block">Total de Lançamentos Financeiros</span>
                <div className="text-3xl font-black text-white">
                  {accounts.filter((a) => !a.excluido).length}
                </div>
                <p className="text-[11px] text-slate-400">Sincronizados em tempo real no Google Cloud Firestore</p>
              </div>

              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                <span className="text-xs text-slate-400 font-semibold block">Volume Financeiro Total</span>
                <div className="text-2xl font-black text-blue-400">
                  R$ {totalVolumeGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-slate-400">Somatório de todas as empresas cadastradas</p>
              </div>

              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                <span className="text-xs text-slate-400 font-semibold block">Taxa de Liberação de Cadastros</span>
                <div className="text-3xl font-black text-emerald-400">
                  {users.length > 0 ? `${Math.round((activeUsers.length / users.length) * 100)}%` : '100%'}
                </div>
                <p className="text-[11px] text-slate-400">{activeUsers.length} aprovados de {users.length} cadastrados</p>
              </div>

            </div>

            {/* Quick launch into consolidated app */}
            <div className="p-6 bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-slate-900 border border-blue-500/30 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-base font-bold text-white">Pronto para operar no financeiro?</h4>
                <p className="text-xs text-slate-300 max-w-xl">
                  Você pode acessar o fluxo de caixa, DRE, conciliação bancária OFX e contas a pagar/receber clicando no botão abaixo.
                </p>
              </div>
              <button
                onClick={() => onEnterFinancialApp(-1)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer shrink-0"
              >
                <span>Entrar no Sistema Financeiro</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB: SIMULADOR DE WEBHOOKS BANCÁRIOS ================= */}
        {activeTab === 'webhooks' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Header banner */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-3xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-black">
                    <Webhook className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Simulador de Webhooks de Conciliação Bancária
                    </h3>
                    <p className="text-xs text-slate-400">
                      Dispare notificações instantâneas simulando Banco do Brasil (Pix), Stone e InfinitePay.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="btn-open-advanced-webhook-modal"
                    onClick={() => setIsWebhookModalOpen(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-600/20"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Console Avançado & cURL</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 3 Quick Simulation Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Card 1: Banco do Brasil */}
              <div className="p-5 bg-slate-900/90 border border-amber-500/40 rounded-2xl space-y-4 hover:border-amber-500 transition-all flex flex-col justify-between shadow-lg">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">
                        BB
                      </span>
                      <span className="text-sm font-black text-white">Banco do Brasil</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Pix BB
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Dispara o payload Pix BB com <code className="text-amber-300 font-mono">id_fatura_erp_123</code> (R$ 150,00).
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <div className="text-[11px] font-mono text-slate-400 bg-slate-950 p-2 rounded-lg truncate">
                    POST /api/test-webhook?provider=bb
                  </div>
                  <button
                    id="btn-quick-sim-bb"
                    disabled={isQuickSimulating}
                    onClick={async () => {
                      setIsQuickSimulating(true);
                      setQuickSimResult(null);
                      try {
                        const res = await fetch('/api/test-webhook?provider=bb', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            pix: [
                              {
                                endToEndId: `E000000002026${Math.floor(Math.random() * 90000 + 10000)}`,
                                txid: 'id_fatura_erp_123',
                                valor: '150.00',
                                horario: new Date().toISOString(),
                              },
                            ],
                          }),
                        });
                        const data = await res.json();
                        setQuickSimResult({ provider: 'Banco do Brasil', data, ok: res.ok });
                      } catch (err: any) {
                        setQuickSimResult({ provider: 'Banco do Brasil', error: err.message, ok: false });
                      } finally {
                        setIsQuickSimulating(false);
                      }
                    }}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-500/20 transition-all disabled:opacity-50"
                  >
                    {isQuickSimulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>Simular Pagamento BB</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Stone */}
              <div className="p-5 bg-slate-900/90 border border-emerald-500/40 rounded-2xl space-y-4 hover:border-emerald-500 transition-all flex flex-col justify-between shadow-lg">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-xl bg-[#00A868] text-white font-black text-xs flex items-center justify-center">
                        ST
                      </span>
                      <span className="text-sm font-black text-white">Banco Stone</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Conta Stone
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Dispara evento <code className="text-emerald-300 font-mono">charge.paid</code> para <code className="text-emerald-300 font-mono">conta_pagar_456</code> (R$ 250,50).
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <div className="text-[11px] font-mono text-slate-400 bg-slate-950 p-2 rounded-lg truncate">
                    POST /api/test-webhook?provider=stone
                  </div>
                  <button
                    id="btn-quick-sim-stone"
                    disabled={isQuickSimulating}
                    onClick={async () => {
                      setIsQuickSimulating(true);
                      setQuickSimResult(null);
                      try {
                        const res = await fetch('/api/test-webhook?provider=stone', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            event: 'charge.paid',
                            data: {
                              id: `chk_stone_${Math.random().toString(36).substring(2, 9)}`,
                              amount: 25050,
                              metadata: {
                                tenant_id: 'vendedor_x',
                                company_id: 'filial_1',
                                invoice_id: 'conta_pagar_456',
                              },
                            },
                          }),
                        });
                        const data = await res.json();
                        setQuickSimResult({ provider: 'Stone', data, ok: res.ok });
                      } catch (err: any) {
                        setQuickSimResult({ provider: 'Stone', error: err.message, ok: false });
                      } finally {
                        setIsQuickSimulating(false);
                      }
                    }}
                    className="w-full py-2.5 bg-[#00A868] hover:bg-[#009058] text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    {isQuickSimulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>Simular Venda Stone</span>
                  </button>
                </div>
              </div>

              {/* Card 3: InfinitePay */}
              <div className="p-5 bg-slate-900/90 border border-[#00E575]/40 rounded-2xl space-y-4 hover:border-[#00E575] transition-all flex flex-col justify-between shadow-lg">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-xl bg-[#00E575] text-slate-950 font-black text-xs flex items-center justify-center">
                        IP
                      </span>
                      <span className="text-sm font-black text-white">InfinitePay</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-300 border border-green-500/30">
                      Checkout Pix
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Dispara webhook Pix com <code className="text-[#00E575] font-mono">conta_receber_789</code> (R$ 89,90).
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <div className="text-[11px] font-mono text-slate-400 bg-slate-950 p-2 rounded-lg truncate">
                    POST /api/test-webhook?provider=infinitepay
                  </div>
                  <button
                    id="btn-quick-sim-infinitepay"
                    disabled={isQuickSimulating}
                    onClick={async () => {
                      setIsQuickSimulating(true);
                      setQuickSimResult(null);
                      try {
                        const res = await fetch('/api/test-webhook?provider=infinitepay', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            transaction_id: `inf_pay_${Math.random().toString(36).substring(2, 9)}`,
                            status: 'approved',
                            amount: 89.9,
                            payment_method: 'pix',
                            external_reference: 'conta_receber_789',
                          }),
                        });
                        const data = await res.json();
                        setQuickSimResult({ provider: 'InfinitePay', data, ok: res.ok });
                      } catch (err: any) {
                        setQuickSimResult({ provider: 'InfinitePay', error: err.message, ok: false });
                      } finally {
                        setIsQuickSimulating(false);
                      }
                    }}
                    className="w-full py-2.5 bg-[#00E575] hover:bg-[#00c965] text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-green-500/20 transition-all disabled:opacity-50"
                  >
                    {isQuickSimulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>Simular Pix InfinitePay</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Live Result Toast if quick simulated */}
            {quickSimResult && (
              <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in ${
                quickSimResult.ok
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
              }`}>
                <div className="flex items-center gap-3">
                  {quickSimResult.ok ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  )}
                  <div className="text-xs">
                    <span className="font-bold block text-white">
                      {quickSimResult.provider} &bull; {quickSimResult.ok ? 'Conciliação Concluída com Sucesso!' : 'Falha na Simulação'}
                    </span>
                    <span className="text-slate-300">
                      {quickSimResult.data?.message || quickSimResult.error || 'Operação realizada.'}
                    </span>
                  </div>
                </div>

                {quickSimResult.data?.results?.[0] && (
                  <div className="flex items-center gap-2 text-xs bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400">Conta:</span>
                    <span className="font-bold text-white">#{quickSimResult.data.results[0].accountId}</span>
                    <span className="text-slate-400">&bull;</span>
                    <span className="font-bold text-emerald-400">
                      R$ {Number(quickSimResult.data.results[0].valor || 0).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* List of Reconciled Accounts in Real-time */}
            <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-3xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Contas e Status no ERP (Sincronização em Tempo Real)</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Veja os lançamentos mudando de status para "Pago" e exibindo os dados de conciliação do webhook
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-300 bg-slate-800 px-3 py-1 rounded-full">
                  Total de Contas: {accounts.filter((a) => !a.excluido).length}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">ID</th>
                      <th className="py-2.5 px-3">Descrição & Ref</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Valor</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Conciliação Webhook</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {accounts
                      .filter((a) => !a.excluido)
                      .slice(0, 8)
                      .map((acc) => {
                        const isPaid = acc.status === 'Pago' || String(acc.status).toLowerCase() === 'pago';
                        return (
                          <tr key={acc.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-300">
                              #{acc.id}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-white block">{acc.descricao}</span>
                              {acc.documento_ref && (
                                <span className="text-[10px] text-amber-400 font-mono block">
                                  Ref: {acc.documento_ref}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                acc.tipo === 'receber'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}>
                                {acc.tipo}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-bold text-white">
                              R$ {acc.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold inline-flex items-center gap-1.5 ${
                                isPaid
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                                {isPaid ? 'Pago' : 'Pendente'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[11px]">
                              {acc.conciliado ? (
                                <div className="space-y-0.5">
                                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    <span>{acc.banco_origem || 'Conciliado'}</span>
                                  </span>
                                  {acc.conciliado_fitid && (
                                    <span className="text-slate-400 font-mono text-[10px] block truncate max-w-[150px]">
                                      Tx: {acc.conciliado_fitid}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 font-mono text-[11px]">Aguardando webhook...</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* ================= SUB-MODAL: APROVAÇÃO DETALHADA COM ISOLAMENTO ================= */}
      {approvingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            <div className="px-6 py-4 bg-gradient-to-r from-amber-950/60 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Aprovar e Liberar Cadastro</h3>
                  <p className="text-xs text-slate-400">
                    Cliente: <strong>{approvingUser.nome}</strong> ({approvingUser.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setApprovingUser(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              
              {/* Escolha da Empresa / Isolamento */}
              <div className="space-y-3">
                <label className="font-bold text-slate-200 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span>1. Destino da Empresa & Isolamento de Dados:</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setApprovalCompanyAction('create_new')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      approvalCompanyAction === 'create_new'
                        ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-2 text-xs">
                      <input 
                        type="radio" 
                        checked={approvalCompanyAction === 'create_new'} 
                        onChange={() => setApprovalCompanyAction('create_new')}
                        className="text-emerald-500"
                      />
                      <span>Criar Empresa Exclusiva (Isolada)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 pl-5">
                      Cria um novo CNPJ isolado onde apenas este cliente terá acesso.
                    </p>
                  </div>

                  <div
                    onClick={() => setApprovalCompanyAction('link_existing')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      approvalCompanyAction === 'link_existing'
                        ? 'bg-blue-950/40 border-blue-500 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-2 text-xs">
                      <input 
                        type="radio" 
                        checked={approvalCompanyAction === 'link_existing'} 
                        onChange={() => setApprovalCompanyAction('link_existing')}
                        className="text-blue-500"
                      />
                      <span>Vincular a Empresa Já Existente</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 pl-5">
                      Adiciona este usuário a uma empresa que já está cadastrada.
                    </p>
                  </div>
                </div>

                {approvalCompanyAction === 'create_new' && (
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Nome da Empresa que será criada:
                      </label>
                      <input
                        type="text"
                        value={approvalCompanyName}
                        onChange={(e) => setApprovalCompanyName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                        placeholder="Nome da Empresa"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        CNPJ (opcional):
                      </label>
                      <input
                        type="text"
                        value={approvalCompanyCnpj}
                        onChange={(e) => setApprovalCompanyCnpj(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                        placeholder="00.000.000/0001-00"
                      />
                    </div>
                  </div>
                )}

                {approvalCompanyAction === 'link_existing' && (
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Selecione a empresa existente:
                    </label>
                    <select
                      value={approvalSelectedCompanyId}
                      onChange={(e) => setApprovalSelectedCompanyId(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome} {c.cnpj ? `(${c.cnpj})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Perfil de Acesso */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <label className="font-bold text-slate-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span>2. Perfil de Acesso & Papel:</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleApprovalRoleChange('admin')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      approvalRole === 'admin'
                        ? 'bg-blue-950/50 border-blue-500 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                      <span>Admin da Empresa</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Acesso completo a lançamentos, DRE, extratos e relatórios da sua empresa.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApprovalRoleChange('operador')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      approvalRole === 'operador'
                        ? 'bg-emerald-950/50 border-emerald-500 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Operador</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Cadastra e quita lançamentos, sem acesso a dados confidenciais ou exclusões.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApprovalRoleChange('leitor')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      approvalRole === 'leitor'
                        ? 'bg-purple-950/50 border-purple-500 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-purple-400" />
                      <span>Somente Leitura</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Apenas visualiza tabelas e relatórios (sem permissão de edição/criação).
                    </p>
                  </button>
                </div>
              </div>

              {/* Botão de Permissões Granulares Personalizadas */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowApprovalCustomPerms(!showApprovalCustomPerms)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>{showApprovalCustomPerms ? 'Ocultar Permissões Detalhadas' : 'Personalizar Permissões e Menus Específicos &darr;'}</span>
                </button>

                {showApprovalCustomPerms && (
                  <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PERMISSION_DEFINITIONS.map((def) => (
                      <label key={def.key} className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={Boolean(approvalCustomPermissions[def.key])}
                          onChange={() => toggleApprovalPerm(def.key)}
                          className="rounded text-blue-500"
                        />
                        <span className="text-[11px]">{def.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

            </div>

            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setApprovingUser(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-approval-portal"
                onClick={handleConfirmApproval}
                disabled={isProcessingApproval}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50"
              >
                {isProcessingApproval ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>{isProcessingApproval ? 'Liberando...' : 'Confirmar Liberação & Criar Acesso'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= SUB-MODAL: CONFIGURAÇÃO GRANULAR DE PERMISSÕES ================= */}
      {editingPermissionsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center justify-center font-bold">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Configurar Menus & Permissões</h3>
                  <p className="text-xs text-slate-400">
                    Usuário: <strong>{editingPermissionsUser.nome}</strong> ({editingPermissionsUser.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingPermissionsUser(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              
              {permissionsSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{permissionsSuccessMsg}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="font-bold text-slate-300 block">Papel / Perfil Base:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditPermissionsRoleChange('admin')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      editPermissionsRole === 'admin' ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditPermissionsRoleChange('operador')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      editPermissionsRole === 'operador' ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    Operador
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditPermissionsRoleChange('leitor')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      editPermissionsRole === 'leitor' ? 'bg-purple-600 text-white' : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    Somente Leitura
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="font-bold text-slate-300 block">Controle Individual de Menus e Recursos:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950 p-3.5 rounded-2xl border border-slate-800 max-h-72 overflow-y-auto">
                  {PERMISSION_DEFINITIONS.map((def) => (
                    <label key={def.key} className="flex items-start gap-2.5 p-1.5 hover:bg-slate-900 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editPermissionsMap[def.key])}
                        onChange={() => toggleEditPerm(def.key)}
                        className="mt-0.5 rounded text-blue-500"
                      />
                      <div>
                        <span className="font-semibold text-slate-200 block text-[11px]">{def.label}</span>
                        <span className="text-[10px] text-slate-400 leading-tight">{def.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

            </div>

            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingPermissionsUser(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveUserPermissions}
                disabled={isSavingPermissions}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg"
              >
                {isSavingPermissions ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Salvar Permissões</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= SUB-MODAL: REJEITAR CADASTRO ================= */}
      {rejectingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-rose-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UserX className="w-5 h-5 text-rose-400" />
              <span>Recusar Solicitação</span>
            </h3>
            <p className="text-xs text-slate-300">
              Deseja recusar o pedido de acesso de <strong>{rejectingUser.nome}</strong> ({rejectingUser.email})?
            </p>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Motivo da recusa (opcional):</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex: Dados cadastrais incompletos ou empresa não identificada."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500"
                rows={3}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingUser(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRejection}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Confirmar Recusa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SUB-MODAL: RESET DE SENHA ================= */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-400" />
              <span>Redefinir Senha de Acesso</span>
            </h3>
            <p className="text-xs text-slate-300">
              Usuário: <strong>{resettingUser.nome}</strong> ({resettingUser.email})
            </p>

            {resetSuccessMsg && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl">
                {resetSuccessMsg}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Nova Senha Provisória:</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setResettingUser(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveResetPassword}
                disabled={newPassword.length < 6}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Salvar Nova Senha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SUB-MODAL: EMPRESAS PERMITIDAS ================= */}
      {editingCompaniesUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              <span>Isolamento de Empresas</span>
            </h3>
            <p className="text-xs text-slate-300">
              Configurar empresas que o usuário <strong>{editingCompaniesUser.nome}</strong> pode visualizar:
            </p>

            <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={editAcessoTodas}
                onChange={(e) => setEditAcessoTodas(e.target.checked)}
                className="rounded text-blue-500"
              />
              <span className="text-xs font-bold text-white">Acesso Global (Todas as Empresas)</span>
            </label>

            {!editAcessoTodas && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-semibold">Selecione as empresas permitidas:</span>
                {companies.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 py-1 text-xs text-slate-300 hover:text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editCompanyIds.includes(Number(c.id))}
                      onChange={() => toggleCompanyInEdit(Number(c.id))}
                      className="rounded text-blue-500"
                    />
                    <span>{c.nome} {c.cnpj ? `(${c.cnpj})` : ''}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingCompaniesUser(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEditCompanies}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Salvar Vínculos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SUB-MODAL: NOVA EMPRESA ================= */}
      {isAddingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <form onSubmit={handleCreateCompanySubmit} className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              <span>Cadastrar Nova Empresa / CNPJ</span>
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Razão Social / Nome da Empresa:</label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Ex: Minha Empresa Ltda"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">CNPJ (opcional):</label>
                <input
                  type="text"
                  value={newCompanyCnpj}
                  onChange={(e) => setNewCompanyCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingCompany(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Criar Empresa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= SUB-MODAL: EDITAR PERFIL DO SUPER ADMIN MASTER (NOME, USUÁRIO/EMAIL, SENHA) ================= */}
      {isEditingMasterProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
          <form 
            onSubmit={handleSaveMasterProfileSubmit}
            className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-lg p-6 sm:p-7 space-y-5 shadow-2xl shadow-amber-950/30 relative"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center font-black shadow-inner">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Editar Perfil Master (Super Admin)</h3>
                  <p className="text-xs text-amber-400/80">Alteração de Nome, Usuário de Acesso e Senha</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingMasterProfile(false)}
                className="text-slate-400 hover:text-white cursor-pointer p-1 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {profileErrorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{profileErrorMsg}</span>
              </div>
            )}

            {profileSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* Nome */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>Nome do Administrador Master</span>
                </label>
                <input
                  id="input-master-profile-name"
                  type="text"
                  value={profileNome}
                  onChange={(e) => setProfileNome(e.target.value)}
                  placeholder="Ex: Super Admin Master"
                  required
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
                />
              </div>

              {/* Usuário / E-mail */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-amber-400" />
                  <span>Usuário / E-mail de Acesso (Login)</span>
                </label>
                <input
                  id="input-master-profile-email"
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  placeholder="admin@financeiro.com"
                  required
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors font-mono"
                />
                <p className="text-[11px] text-slate-400">
                  Este e-mail será utilizado para autenticar no sistema na tela de login.
                </p>
              </div>

              {/* Nova Senha */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    <span>Nova Senha de Acesso</span>
                  </label>
                  <span className="text-[10px] text-amber-400/80">Opcional (Deixe em branco para manter a atual)</span>
                </div>
                <div className="relative">
                  <input
                    id="input-master-profile-password"
                    type={showProfilePassword ? 'text' : 'password'}
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                    placeholder="Digite a nova senha (mínimo 6 caracteres)"
                    className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowProfilePassword(!showProfilePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-1"
                    title={showProfilePassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showProfilePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditingMasterProfile(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                id="btn-save-master-profile"
                type="submit"
                disabled={isSavingMasterProfile}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
              >
                {isSavingMasterProfile ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Salvar Alterações do Master</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Wipe Confirmation Modal */}
      {isWipeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-rose-900/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Limpar Todas as Empresas & Movimentos</h3>
                <p className="text-xs text-rose-300/80">Ação irreversível de reset para o Super Admin</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Esta ação excluirá todas as empresas cadastradas, clientes SaaS, contas bancárias, centros de custo e movimentações financeiras da nuvem. Apenas o seu acesso <strong>Super Admin Master</strong> permanecerá ativo.
            </p>

            {wipeSuccessMsg ? (
              <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded-xl text-xs font-bold text-center">
                {wipeSuccessMsg}
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isWiping}
                  onClick={() => setIsWipeModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isWiping}
                  onClick={async () => {
                    if (!onWipeAllData) return;
                    setIsWiping(true);
                    try {
                      await onWipeAllData();
                      setWipeSuccessMsg('Todas as empresas e movimentações foram limpas com sucesso!');
                      setTimeout(() => {
                        setIsWiping(false);
                        setIsWipeModalOpen(false);
                        setWipeSuccessMsg('');
                      }, 1500);
                    } catch (err) {
                      setIsWiping(false);
                    }
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-rose-900/30"
                >
                  {isWiping ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Limpando dados...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Confirmar e Limpar Tudo</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Avançado de Simulação de Webhooks */}
      <WebhookSimulatorModal
        isOpen={isWebhookModalOpen}
        onClose={() => setIsWebhookModalOpen(false)}
        accounts={accounts}
        companies={companies}
        onAccountReconciled={onAccountReconciled}
      />

      {/* ================= MODAL DE EXCLUSÃO DE USUÁRIO ================= */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 text-left">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Excluir Cadastro de Usuário</h3>
                <p className="text-xs text-slate-400">Esta ação é permanente e não poderá ser desfeita.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
              <div className="text-sm font-semibold text-white flex items-center justify-between">
                <span>{userToDelete.nome}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider bg-slate-800 text-slate-300">
                  {userToDelete.role}
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono">{userToDelete.email}</div>
              {userToDelete.telefone && (
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <span>Telefone:</span>
                  <span className="text-slate-300">{userToDelete.telefone}</span>
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-900/50 text-xs text-rose-300/90 leading-relaxed">
              Deseja realmente excluir permanentemente o cadastro de <strong>"{userToDelete.nome}"</strong>? Todos os acessos, permissões e dados vinculados a este usuário serão removidos do servidor e da nuvem.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={handleConfirmDeleteUser}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 transition-all cursor-pointer shadow-lg shadow-rose-950/40 flex items-center gap-2 disabled:opacity-60"
              >
                {isDeletingUser ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Excluir Definitivamente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
