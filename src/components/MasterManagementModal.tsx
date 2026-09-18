import React, { useState, useMemo } from 'react';
import { 
  X, 
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
  Crown, 
  ArrowRight,
  ExternalLink,
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
  ChevronDown,
  ChevronUp,
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
  PERMISSION_DEFINITIONS,
  DEFAULT_ROLE_PERMISSIONS,
  getUserEffectivePermissions
} from '../types';

interface MasterManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  companies: Company[];
  userCompanies: UserCompanyLink[];
  accounts: FinancialAccount[];
  currentUser: User;
  onApproveUser: (
    userId: number, 
    companyAction: 'create_new' | 'link_existing', 
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
}

export const MasterManagementModal: React.FC<MasterManagementModalProps> = ({
  isOpen,
  onClose,
  users,
  companies,
  userCompanies,
  accounts,
  currentUser,
  onApproveUser,
  onRejectUser,
  onUpdateUserStatus,
  onUpdateUserRole,
  onResetUserPassword,
  onDeleteUser,
  onUpdateUserCompanies,
  onUpdateUserGranularPermissions,
}) => {
  const [activeTab, setActiveTab] = useState<'pendentes' | 'usuarios' | 'empresas' | 'metricas'>('pendentes');
  
  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | UserStatus>('todos');

  // Approval Modal Sub-state
  const [approvingUser, setApprovingUser] = useState<User | null>(null);
  const [approvalCompanyAction, setApprovalCompanyAction] = useState<'create_new' | 'link_existing'>('create_new');
  const [approvalCompanyName, setApprovalCompanyName] = useState('');
  const [approvalCompanyCnpj, setApprovalCompanyCnpj] = useState('');
  const [approvalSelectedCompanyId, setApprovalSelectedCompanyId] = useState<number>(companies[0]?.id || 1);
  const [approvalRole, setApprovalRole] = useState<UserRole>('admin');
  const [approvalCustomPermissions, setApprovalCustomPermissions] = useState<UserPermissions>(DEFAULT_ROLE_PERMISSIONS.admin);
  const [showApprovalCustomPerms, setShowApprovalCustomPerms] = useState(false);
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);

  // Granular Permissions Modal Sub-state (for active users)
  const [editingPermissionsUser, setEditingPermissionsUser] = useState<User | null>(null);
  const [editPermissionsRole, setEditPermissionsRole] = useState<UserRole>('admin');
  const [editPermissionsMap, setEditPermissionsMap] = useState<UserPermissions>(DEFAULT_ROLE_PERMISSIONS.admin);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [permissionsSuccessMsg, setPermissionsSuccessMsg] = useState('');

  // Reject Modal Sub-state
  const [rejectingUser, setRejectingUser] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Password Reset Sub-state
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');

  // Company Link Editing Sub-state
  const [editingCompaniesUser, setEditingCompaniesUser] = useState<User | null>(null);
  const [editAcessoTodas, setEditAcessoTodas] = useState(false);
  const [editCompanyIds, setEditCompanyIds] = useState<number[]>([]);

  // Delete User Confirmation Modal Sub-state
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

  // Derived lists
  const pendingUsers = useMemo(() => {
    return users.filter((u) => (u.status === 'pendente' || (!u.status && !u.is_master && Number(u.id) > 3)));
  }, [users]);

  const activeUsers = useMemo(() => {
    return users.filter((u) => u.status === 'ativo' || (!u.status && (u.is_master || Number(u.id) <= 3)));
  }, [users]);

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

  if (!isOpen) return null;

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

  // Granular Permissions Editor
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
    }, 1800);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        
        {/* TOP BANNER MASTER */}
        <div className="px-6 py-5 bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Painel Master & Gestão de Cadastros
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Aprovação de novos clientes, isolamento estrito de empresas e controle granular de menus e leitura.
              </p>
            </div>
          </div>

          <button
            id="close-master-modal-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* METRICS HEADER CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:px-6 bg-slate-900/60 border-b border-slate-800 text-xs">
          <div 
            onClick={() => setActiveTab('pendentes')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'pendentes'
                ? 'bg-amber-950/40 border-amber-500/50 shadow-md shadow-amber-500/10'
                : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-semibold">Aguardando Liberação</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-400">
                {pendingUsers.length}
              </span>
              <span className="text-[10px] text-slate-400">novos cadastros</span>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('usuarios')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'usuarios'
                ? 'bg-blue-950/40 border-blue-500/50 shadow-md shadow-blue-500/10'
                : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-semibold">Usuários Liberados</span>
              <UserCheck className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-blue-400">
                {activeUsers.length}
              </span>
              <span className="text-[10px] text-slate-400">ativos</span>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('empresas')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'empresas'
                ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-semibold">Empresas Isoladas</span>
              <Building2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-400">
                {companies.length}
              </span>
              <span className="text-[10px] text-slate-400">CNPJs</span>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('metricas')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'metricas'
                ? 'bg-purple-950/40 border-purple-500/50 shadow-md shadow-purple-500/10'
                : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-semibold">Total Bloqueados</span>
              <Lock className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-purple-400">
                {blockedUsers.length}
              </span>
              <span className="text-[10px] text-slate-400">bloqueados</span>
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-900 shrink-0 text-xs font-bold">
          <button
            onClick={() => setActiveTab('pendentes')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'pendentes'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Cadastros Pendentes ({pendingUsers.length})</span>
            {pendingUsers.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block ml-1" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('usuarios')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'usuarios'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Gestão de Usuários & Menus ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('empresas')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'empresas'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Empresas & Vínculos ({companies.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('metricas')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'metricas'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Métricas do Sistema</span>
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* ================= ABA 1: SOLICITAÇÕES PENDENTES ================= */}
          {activeTab === 'pendentes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Fila de Clientes Aguardando Liberação</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {pendingUsers.length} solicitações
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Ao aprovar, você define a empresa isolada e o nível de acesso (Admin, Operador ou Somente Leitura).
                  </p>
                </div>
              </div>

              {pendingUsers.length === 0 ? (
                <div className="py-12 px-4 text-center bg-slate-950/40 rounded-2xl border border-slate-800/80 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Nenhum cadastro pendente no momento!</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Todas as solicitações de acesso já foram revisadas e liberadas pelo Super Admin Master.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingUsers.map((user) => (
                    <div 
                      key={user.id}
                      className="bg-slate-800/70 border border-amber-500/30 hover:border-amber-500/60 rounded-2xl p-5 space-y-4 transition-all shadow-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-black text-sm">
                            {user.nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white leading-tight">{user.nome}</h4>
                            <p className="text-xs text-slate-400 font-mono">{user.email}</p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Pendente
                        </span>
                      </div>

                      <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-700/60 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-blue-400" />
                            <span>Empresa Solicitada:</span>
                          </span>
                          <span className="font-bold text-slate-200">
                            {user.empresa_solicitada || 'Nova Empresa'}
                          </span>
                        </div>

                        {user.cnpj_solicitado && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">CNPJ Informado:</span>
                            <span className="font-mono text-slate-300">{user.cnpj_solicitado}</span>
                          </div>
                        )}

                        {user.telefone && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-emerald-400" />
                              <span>WhatsApp / Contato:</span>
                            </span>
                            <span className="font-medium text-emerald-400">{user.telefone}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                          <span>Data da Solicitação:</span>
                          <span>{user.criado_em || 'Recente'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setRejectingUser(user)}
                          className="flex-1 py-2 px-3 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-transparent hover:border-rose-800"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Recusar</span>
                        </button>
                        
                        <button
                          type="button"
                          id={`approve-user-btn-${user.id}`}
                          onClick={() => handleOpenApprovalModal(user)}
                          className="flex-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-emerald-950/40"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Aprovar & Configurar Acesso</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= ABA 2: TODOS OS USUÁRIOS & PERMISSÕES ================= */}
          {activeTab === 'usuarios' && (
            <div className="space-y-4">
              
              {/* Search & Status Filters */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome, email, empresa ou telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto text-xs font-semibold">
                  <button
                    onClick={() => setStatusFilter('todos')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                      statusFilter === 'todos'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Todos ({users.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('ativo')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                      statusFilter === 'ativo'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Ativos ({activeUsers.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('pendente')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                      statusFilter === 'pendente'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Pendentes ({pendingUsers.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('bloqueado')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                      statusFilter === 'bloqueado'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Bloqueados ({blockedUsers.length})
                  </button>
                </div>
              </div>

              {/* Users Table / List */}
              <div className="bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
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
                          <tr key={user.id} className="hover:bg-slate-900/50 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isUserMaster 
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
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
                                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                      <Phone className="w-2.5 h-2.5 text-emerald-400" />
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
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Ativo</span>
                                </span>
                              )}
                              {userStatus === 'pendente' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/60">
                                  <Clock className="w-3 h-3" />
                                  <span>Pendente</span>
                                </span>
                              )}
                              {userStatus === 'bloqueado' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800/60">
                                  <Lock className="w-3 h-3" />
                                  <span>Bloqueado</span>
                                </span>
                              )}
                              {userStatus === 'rejeitado' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
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
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
                                  >
                                    Aprovar
                                  </button>
                                )}

                                {!isSelf && (
                                  <>
                                    {/* Edit Granular Permissions & Menus */}
                                    <button
                                      id={`perm-btn-${user.id}`}
                                      onClick={() => handleOpenEditPermissions(user)}
                                      title="Editar Permissões & Menus (Somente Leitura, Menus Restritos)"
                                      className="p-1.5 text-slate-300 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Sliders className="w-4 h-4" />
                                    </button>

                                    {/* Toggle Block / Unblock */}
                                    {userStatus === 'ativo' ? (
                                      <button
                                        onClick={() => onUpdateUserStatus(user.id, 'bloqueado')}
                                        title="Bloquear acesso imediatamente"
                                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                      >
                                        <Lock className="w-4 h-4" />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => onUpdateUserStatus(user.id, 'ativo')}
                                        title="Liberar / Ativar acesso"
                                        className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                      >
                                        <Unlock className="w-4 h-4" />
                                      </button>
                                    )}

                                    {/* Edit Companies */}
                                    <button
                                      onClick={() => handleOpenEditCompanies(user)}
                                      title="Editar empresas permitidas (Isolamento)"
                                      className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Building2 className="w-4 h-4" />
                                    </button>

                                    {/* Reset Password */}
                                    <button
                                      onClick={() => {
                                        setResettingUser(user);
                                        setNewPassword('');
                                        setResetSuccessMsg('');
                                      }}
                                      title="Redefinir senha deste usuário"
                                      className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <KeyRound className="w-4 h-4" />
                                    </button>

                                    {/* Delete User */}
                                    <button
                                      onClick={() => setUserToDelete(user)}
                                      title="Excluir usuário"
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

          {/* ================= ABA 3: EMPRESAS & CLIENTES ================= */}
          {activeTab === 'empresas' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Empresas Cadastradas e Isolamento Multi-Empresa
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cada empresa possui seus próprios lançamentos, contas bancárias e centros de custos separados.
                  </p>
                </div>
              </div>

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
                      className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 space-y-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white leading-tight">{comp.nome}</h4>
                            <p className="text-[11px] font-mono text-slate-400">{comp.cnpj || 'CNPJ não informado'}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono bg-slate-900 px-2 py-0.5 rounded text-slate-400">
                          ID: #{comp.id}
                        </span>
                      </div>

                      {/* Totals Summary */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <div>
                          <span className="text-[10px] text-slate-400 block">A Pagar:</span>
                          <span className="font-bold text-rose-400">R$ {totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">A Receber:</span>
                          <span className="font-bold text-emerald-400">R$ {totalReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      {/* Linked Administrators */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[11px] font-semibold text-slate-400 block">
                          Usuários com Acesso Exclusivo a esta Empresa:
                        </span>
                        <div className="space-y-1">
                          {linkedUsers.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">
                              Apenas Administradores Globais / Masters
                            </span>
                          ) : (
                            linkedUsers.map((u) => (
                              <div key={u.id} className="flex items-center justify-between text-xs bg-slate-900/40 px-2.5 py-1 rounded-lg">
                                <span className="font-medium text-slate-200 truncate">{u.nome}</span>
                                <span className="text-[10px] text-slate-400">{u.role === 'leitor' ? 'Somente Leitura' : u.role === 'operador' ? 'Operador' : 'Admin'}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= ABA 4: MÉTRICAS DO SISTEMA ================= */}
          {activeTab === 'metricas' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 bg-slate-800/80 border border-slate-700/60 rounded-2xl space-y-2">
                  <span className="text-xs text-slate-400 font-semibold block">Total de Lançamentos Financeiros</span>
                  <div className="text-3xl font-black text-white">
                    {accounts.filter((a) => !a.excluido).length}
                  </div>
                  <p className="text-[11px] text-slate-400">Sincronizados em tempo real no Firestore</p>
                </div>

                <div className="p-5 bg-slate-800/80 border border-slate-700/60 rounded-2xl space-y-2">
                  <span className="text-xs text-slate-400 font-semibold block">Volume Financeiro Total</span>
                  <div className="text-2xl font-black text-blue-400">
                    R$ {accounts.filter((a) => !a.excluido).reduce((sum, a) => sum + Number(a.valor || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-[11px] text-slate-400">Somatório global de todas as empresas</p>
                </div>

                <div className="p-5 bg-slate-800/80 border border-slate-700/60 rounded-2xl space-y-2">
                  <span className="text-xs text-slate-400 font-semibold block">Taxa de Liberação de Cadastros</span>
                  <div className="text-3xl font-black text-emerald-400">
                    {users.length > 0 ? `${Math.round((activeUsers.length / users.length) * 100)}%` : '100%'}
                  </div>
                  <p className="text-[11px] text-slate-400">{activeUsers.length} aprovados de {users.length} cadastrados</p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <span>Painel Master exclusivo de <strong>{currentUser.nome}</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
          >
            Fechar Painel
          </button>
        </div>

      </div>

      {/* ================= MODAL SUB-POPUP: APROVAR E LIBERAR USUÁRIO ================= */}
      {approvingUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-5 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Liberar Acesso do Cliente</h3>
                  <p className="text-xs text-slate-400">{approvingUser.nome} ({approvingUser.email})</p>
                </div>
              </div>
              <button
                onClick={() => setApprovingUser(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              
              {/* 1. Opção da Empresa (Isolamento Estrito) */}
              <div className="space-y-2">
                <label className="font-bold text-slate-200 block">
                  1. Configuração da Empresa (Isolamento de Dados):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setApprovalCompanyAction('create_new')}
                    className={`p-3 rounded-xl border text-left font-semibold cursor-pointer transition-colors ${
                      approvalCompanyAction === 'create_new'
                        ? 'bg-blue-950/60 border-blue-500 text-blue-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="block font-bold text-white mb-0.5">Criar Empresa Exclusiva (Isolada)</span>
                    <span className="text-[11px] opacity-80">Garante que este cliente só vê seus próprios lançamentos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setApprovalCompanyAction('link_existing')}
                    className={`p-3 rounded-xl border text-left font-semibold cursor-pointer transition-colors ${
                      approvalCompanyAction === 'link_existing'
                        ? 'bg-blue-950/60 border-blue-500 text-blue-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="block font-bold text-white mb-0.5">Vincular a Existente</span>
                    <span className="text-[11px] opacity-80">Dar acesso a uma empresa já cadastrada</span>
                  </button>
                </div>
              </div>

              {approvalCompanyAction === 'create_new' ? (
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">Nome da Empresa do Cliente:</label>
                    <input
                      type="text"
                      value={approvalCompanyName}
                      onChange={(e) => setApprovalCompanyName(e.target.value)}
                      placeholder="Ex: Minha Empresa Ltda"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">CNPJ (opcional):</label>
                    <input
                      type="text"
                      value={approvalCompanyCnpj}
                      onChange={(e) => setApprovalCompanyCnpj(e.target.value)}
                      placeholder="00.000.000/0001-00"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <label className="font-semibold text-slate-300 block">Selecione a Empresa:</label>
                  <select
                    value={approvalSelectedCompanyId}
                    onChange={(e) => setApprovalSelectedCompanyId(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-medium"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} {c.cnpj ? `(${c.cnpj})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 2. Perfil de Acesso */}
              <div className="space-y-2">
                <label className="font-bold text-slate-200 block">
                  2. Perfil de Acesso e Regras de Negócio:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleApprovalRoleChange('admin')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      approvalRole === 'admin'
                        ? 'bg-blue-950/80 border-blue-500 text-blue-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-white mb-0.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                      <span>Admin da Empresa</span>
                    </div>
                    <span className="text-[10px] opacity-80 block">Acesso completo na empresa dele</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApprovalRoleChange('operador')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      approvalRole === 'operador'
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-white mb-0.5">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Operador</span>
                    </div>
                    <span className="text-[10px] opacity-80 block">Lançamentos e baixas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApprovalRoleChange('leitor')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      approvalRole === 'leitor'
                        ? 'bg-purple-950/80 border-purple-500 text-purple-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-white mb-0.5">
                      <Eye className="w-3.5 h-3.5 text-purple-400" />
                      <span>Somente Leitura</span>
                    </div>
                    <span className="text-[10px] opacity-80 block">Apenas consulta e relatórios</span>
                  </button>
                </div>
              </div>

              {/* 3. Permissões de Menus Granulares (Expandível) */}
              <div className="border border-slate-800 rounded-xl bg-slate-950/80 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowApprovalCustomPerms(!showApprovalCustomPerms)}
                  className="w-full p-3 flex items-center justify-between text-left font-bold text-slate-200 hover:bg-slate-900 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span>Personalizar Permissões de Menus e Ações</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                      {Object.values(approvalCustomPermissions).filter(Boolean).length} ativas
                    </span>
                  </div>
                  {showApprovalCustomPerms ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {showApprovalCustomPerms && (
                  <div className="p-3.5 pt-0 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-60 overflow-y-auto">
                    {PERMISSION_DEFINITIONS.map((def) => {
                      const isChecked = Boolean(approvalCustomPermissions[def.key]);
                      return (
                        <label
                          key={def.key}
                          className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                            isChecked 
                              ? 'bg-slate-900 border-indigo-500/40 text-slate-200'
                              : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleApprovalPerm(def.key)}
                            className="mt-0.5 rounded text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                          />
                          <div>
                            <span className={`font-semibold block ${isChecked ? 'text-white' : 'text-slate-400'}`}>
                              {def.label}
                            </span>
                            <span className="text-[10px] text-slate-400 block leading-tight">
                              {def.description}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setApprovingUser(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="confirm-approval-action-btn"
                disabled={isProcessingApproval}
                onClick={handleConfirmApproval}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-emerald-950 disabled:opacity-50"
              >
                {isProcessingApproval ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Liberando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar e Liberar Acesso</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL SUB-POPUP: EDITAR PERMISSÕES & MENUS DE USUÁRIO ATIVO ================= */}
      {editingPermissionsUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-5 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Configurar Menus & Permissões</h3>
                  <p className="text-xs text-slate-400">{editingPermissionsUser.nome} ({editingPermissionsUser.email})</p>
                </div>
              </div>
              <button
                onClick={() => setEditingPermissionsUser(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {permissionsSuccessMsg ? (
              <div className="p-4 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-emerald-300">{permissionsSuccessMsg}</p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                
                {/* Escolha Rápida de Perfil */}
                <div className="space-y-2">
                  <label className="font-bold text-slate-200 block">
                    Perfil Base:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditPermissionsRoleChange('admin')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                        editPermissionsRole === 'admin'
                          ? 'bg-blue-950/80 border-blue-500 text-blue-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-white mb-0.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                        <span>Administrador</span>
                      </div>
                      <span className="text-[10px] opacity-80 block">Acesso a todos os menus e cadastros</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEditPermissionsRoleChange('operador')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                        editPermissionsRole === 'operador'
                          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-white mb-0.5">
                        <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Operador</span>
                      </div>
                      <span className="text-[10px] opacity-80 block">Lançamentos e quitações</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEditPermissionsRoleChange('leitor')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                        editPermissionsRole === 'leitor'
                          ? 'bg-purple-950/80 border-purple-500 text-purple-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-white mb-0.5">
                        <Eye className="w-3.5 h-3.5 text-purple-400" />
                        <span>Somente Leitura</span>
                      </div>
                      <span className="text-[10px] opacity-80 block">Apenas consulta (sem edição)</span>
                    </button>
                  </div>
                </div>

                {/* Lista de Permissões Específicas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-200">
                      Permissões de Menus e Operações (Granular):
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {Object.values(editPermissionsMap).filter(Boolean).length} de {PERMISSION_DEFINITIONS.length} ativas
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto p-1">
                    {PERMISSION_DEFINITIONS.map((def) => {
                      const isChecked = Boolean(editPermissionsMap[def.key]);
                      return (
                        <label
                          key={def.key}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                            isChecked 
                              ? 'bg-slate-950 border-indigo-500/50 text-slate-200'
                              : 'bg-slate-950/50 border-slate-800 text-slate-500'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleEditPerm(def.key)}
                            className="mt-0.5 rounded text-indigo-600 focus:ring-0 w-4 h-4"
                          />
                          <div>
                            <span className={`font-bold block text-xs ${isChecked ? 'text-white' : 'text-slate-400'}`}>
                              {def.label}
                            </span>
                            <span className="text-[10.5px] text-slate-400 block leading-tight mt-0.5">
                              {def.description}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingPermissionsUser(null)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isSavingPermissions}
                    onClick={handleSaveUserPermissions}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-950 disabled:opacity-50"
                  >
                    {isSavingPermissions ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Salvar Permissões</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL SUB-POPUP: RECUSAR USUÁRIO ================= */}
      {rejectingUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Recusar Solicitação</h3>
                <p className="text-xs text-slate-400">de {rejectingUser.nome}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-300 block">Motivo da recusa (opcional):</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex: Dados incompletos ou empresa não validada..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRejectingUser(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmRejection}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Confirmar Recusa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL SUB-POPUP: REDEFINIR SENHA ================= */}
      {resettingUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Redefinir Senha</h3>
                  <p className="text-xs text-slate-400">{resettingUser.nome}</p>
                </div>
              </div>
              <button onClick={() => setResettingUser(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {resetSuccessMsg ? (
              <div className="p-4 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-emerald-300">{resetSuccessMsg}</p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Nova Senha Provisória:</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 pr-9 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResettingUser(null)}
                    className="flex-1 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={newPassword.length < 6}
                    onClick={handleSaveResetPassword}
                    className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold rounded-xl cursor-pointer"
                  >
                    Salvar Nova Senha
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL SUB-POPUP: EDITAR EMPRESAS VINCULADAS ================= */}
      {editingCompaniesUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-blue-500/40 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Empresas Permitidas (Isolamento)</h3>
                  <p className="text-xs text-slate-400">{editingCompaniesUser.nome}</p>
                </div>
              </div>
              <button onClick={() => setEditingCompaniesUser(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-center gap-2.5 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editAcessoTodas}
                  onChange={(e) => setEditAcessoTodas(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0 w-4 h-4"
                />
                <div>
                  <span className="font-bold text-white block">Acesso Global a TODAS as Empresas</span>
                  <span className="text-[10px] text-slate-400 block">Deixe desmarcado para isolar o cliente em apenas uma empresa</span>
                </div>
              </label>

              {!editAcessoTodas && (
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  <span className="font-semibold text-slate-400 block mb-1">Selecione as Empresas Permitidas:</span>
                  {companies.map((c) => {
                    const isSelected = editCompanyIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => toggleCompanyInEdit(c.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-950/60 border-blue-500 text-white font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span className="truncate">{c.nome}</span>
                        {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingCompaniesUser(null)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditCompanies}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl cursor-pointer"
              >
                Salvar Vínculos
              </button>
            </div>
          </div>
        </div>
      )}

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
