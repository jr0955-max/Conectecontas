import React, { useState } from 'react';
import { 
  X, 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Building2, 
  Key, 
  Check, 
  AlertCircle,
  CheckCircle2,
  Trash2,
  Lock,
  UserCheck,
  Edit2,
  Save,
  KeyRound,
  Crown
} from 'lucide-react';
import { User, Company, UserCompanyLink } from '../types';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  companies: Company[];
  userCompanies: UserCompanyLink[];
  currentUser: User;
  onSelectActiveUser: (user: User) => void;
  onOpenMasterModal?: () => void;
  onAddUser: (
    nome: string, 
    email: string, 
    senha: string, 
    acessoTodas: boolean, 
    companyIds: number[]
  ) => { success: boolean; error?: string };
  onEditUser: (
    userId: number,
    data: {
      nome: string;
      email: string;
      senha?: string;
      acessoTodas: boolean;
      companyIds: number[];
    }
  ) => { success: boolean; error?: string };
  onUpdateUserPermissions: (
    userId: number, 
    acessoTodas: boolean, 
    companyIds: number[]
  ) => void;
  onDeleteUser: (userId: number) => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  users,
  companies,
  userCompanies,
  currentUser,
  onSelectActiveUser,
  onOpenMasterModal,
  onAddUser,
  onEditUser,
  onUpdateUserPermissions,
  onDeleteUser,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  
  // Add User state
  const [newNome, setNewNome] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newSenha, setNewSenha] = useState('');
  const [newAcessoTodas, setNewAcessoTodas] = useState(false);
  const [newSelectedCompanies, setNewSelectedCompanies] = useState<number[]>(
    companies.length > 0 ? [companies[0].id] : []
  );
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState(false);

  // Full Edit User state
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNovaSenha, setEditNovaSenha] = useState('');
  const [editAcessoTodas, setEditAcessoTodas] = useState(false);
  const [editCompanyIds, setEditCompanyIds] = useState<number[]>([]);
  const [editError, setEditError] = useState('');

  if (!isOpen) return null;

  const handleStartEdit = (user: User) => {
    setEditingUserId(user.id);
    setEditNome(user.nome);
    setEditEmail(user.email);
    setEditNovaSenha('');
    setEditAcessoTodas(user.acesso_todas_empresas);
    const linked = userCompanies
      .filter((uc) => uc.usuario_id === user.id)
      .map((uc) => uc.empresa_id);
    setEditCompanyIds(linked);
    setEditError('');
  };

  const handleSaveFullEdit = (userId: number) => {
    setEditError('');

    if (!editNome.trim() || !editEmail.trim()) {
      setEditError('Nome e e-mail são obrigatórios.');
      return;
    }

    if (editNovaSenha.trim() && editNovaSenha.trim().length < 6) {
      setEditError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (!editAcessoTodas && editCompanyIds.length === 0) {
      setEditError('Selecione ao menos uma empresa ou habilite acesso global.');
      return;
    }

    const res = onEditUser(userId, {
      nome: editNome.trim(),
      email: editEmail.trim().toLowerCase(),
      senha: editNovaSenha.trim() || undefined,
      acessoTodas: editAcessoTodas,
      companyIds: editCompanyIds,
    });

    if (res.success) {
      setEditingUserId(null);
      setEditError('');
    } else {
      setEditError(res.error || 'Erro ao atualizar dados do usuário.');
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setAddSuccess(false);

    if (!newNome.trim() || !newEmail.trim() || !newSenha.trim()) {
      setAddError('Preencha todos os campos obrigatórios.');
      return;
    }

    if (newSenha.length < 6) {
      setAddError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (!newAcessoTodas && newSelectedCompanies.length === 0) {
      setAddError('Selecione ao menos uma empresa para o novo usuário.');
      return;
    }

    const res = onAddUser(
      newNome.trim(),
      newEmail.trim().toLowerCase(),
      newSenha,
      newAcessoTodas,
      newSelectedCompanies
    );

    if (res.success) {
      setAddSuccess(true);
      setNewNome('');
      setNewEmail('');
      setNewSenha('');
      setNewAcessoTodas(false);
      setTimeout(() => {
        setAddSuccess(false);
        setActiveTab('list');
      }, 1000);
    } else {
      setAddError(res.error || 'Erro ao cadastrar usuário.');
    }
  };

  const toggleNewCompany = (id: number) => {
    if (newSelectedCompanies.includes(id)) {
      setNewSelectedCompanies(newSelectedCompanies.filter((cid) => cid !== id));
    } else {
      setNewSelectedCompanies([...newSelectedCompanies, id]);
    }
  };

  const toggleEditCompany = (id: number) => {
    if (editCompanyIds.includes(id)) {
      setEditCompanyIds(editCompanyIds.filter((cid) => cid !== id));
    } else {
      setEditCompanyIds([...editCompanyIds, id]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Controle & Edição de Usuários
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Gerencie nomes, e-mails, redefinição de senhas e permissões multiempresa
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Header */}
        <div className="flex items-center justify-between px-6 pt-3 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 gap-2 shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('list')}
              className={`py-2 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'list'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Usuários Cadastrados ({users.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('add')}
              className={`py-2 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'add'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Cadastrar Novo Usuário</span>
            </button>
          </div>

          {onOpenMasterModal && (
            <button
              onClick={() => {
                onClose();
                onOpenMasterModal();
              }}
              className="mb-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-900 dark:text-amber-200 border border-amber-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span>Abrir Painel Master & Liberações</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          
          {/* TAB 1: LIST & EDIT USERS */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {users.map((u) => {
                const isCurrent = u.id === currentUser.id;
                const isEditing = editingUserId === u.id;
                
                // Get linked companies
                const userCompanyIds = userCompanies
                  .filter((uc) => uc.usuario_id === u.id)
                  .map((uc) => uc.empresa_id);
                const linkedCompanyNames = companies
                  .filter((c) => userCompanyIds.includes(c.id))
                  .map((c) => c.nome);

                return (
                  <div
                    key={u.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isEditing
                        ? 'bg-blue-50/40 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20'
                        : isCurrent
                        ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/80 ring-1 ring-blue-500/20'
                        : 'bg-white dark:bg-slate-800/40 border-gray-100 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                          isCurrent
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {u.nome.charAt(0).toUpperCase()}
                        </div>
                        
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 dark:text-white text-sm">
                              {u.nome}
                            </span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                                Você está usando
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 dark:text-gray-400 font-mono text-[11px]">
                            {u.email}
                          </p>
                        </div>
                      </div>

                      {/* Right Action buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {!isCurrent && (
                          <button
                            onClick={() => {
                              onSelectActiveUser(u);
                              onClose();
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                            <span>Alternar para este</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (isEditing) setEditingUserId(null);
                            else handleStartEdit(u);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                            isEditing 
                              ? 'bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200' 
                              : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                          }`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>{isEditing ? 'Cancelar' : 'Editar Usuário'}</span>
                        </button>

                        {users.length > 1 && !isCurrent && (
                          <button
                            onClick={() => onDeleteUser(u.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Excluir usuário"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Non-editing View: permissions summary */}
                    {!isEditing ? (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
                        <span className="text-gray-500 dark:text-gray-400 font-medium text-[11px] mr-1">
                          Empresas permitidas:
                        </span>
                        {u.acesso_todas_empresas ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Acesso Global (Todas as Empresas)</span>
                          </span>
                        ) : linkedCompanyNames.length > 0 ? (
                          linkedCompanyNames.map((name, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-700/60 text-gray-700 dark:text-gray-300 font-medium text-[11px] flex items-center gap-1"
                            >
                              <Building2 className="w-3 h-3 text-gray-400" />
                              <span>{name}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 text-[11px] italic">
                            Nenhuma empresa vinculada
                          </span>
                        )}
                      </div>
                    ) : (
                      /* Complete Inline User Editor (Name, Email, Password, Permissions) */
                      <div className="mt-3 pt-3 border-t border-blue-200 dark:border-slate-700 space-y-3.5 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-gray-200 dark:border-slate-800">
                        <div className="flex items-center justify-between pb-1 border-b border-gray-100 dark:border-slate-800">
                          <span className="font-bold text-gray-900 dark:text-white text-xs flex items-center gap-1.5">
                            <Edit2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>Editando Dados & Permissões do Usuário</span>
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">ID: #{u.id}</span>
                        </div>

                        {editError && (
                          <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{editError}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                              Nome Completo *
                            </label>
                            <input
                              type="text"
                              value={editNome}
                              onChange={(e) => setEditNome(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                              placeholder="Nome do usuário"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                              E-mail de Login *
                            </label>
                            <input
                              type="email"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono"
                              placeholder="email@empresa.com"
                            />
                          </div>
                        </div>

                        {/* Nova Senha (Opcional) */}
                        <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg border border-amber-200/80 dark:border-amber-900/40">
                          <label className="text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 mb-1">
                            <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Redefinir Senha (opcional):</span>
                          </label>
                          <input
                            type="password"
                            value={editNovaSenha}
                            onChange={(e) => setEditNovaSenha(e.target.value)}
                            placeholder="Deixe em branco para manter a senha atual (ou digite a nova com 6+ caracteres)"
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                          />
                        </div>

                        {/* Permissões de Empresas */}
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-900 dark:text-white text-xs">
                              Permissão de Visualização Multiempresa:
                            </span>
                            <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer font-semibold">
                              <input
                                type="checkbox"
                                checked={editAcessoTodas}
                                onChange={(e) => setEditAcessoTodas(e.target.checked)}
                                className="rounded bg-gray-100 dark:bg-slate-800 border-gray-300 text-blue-600"
                              />
                              <span>Acesso Global (Todas as Empresas)</span>
                            </label>
                          </div>

                          {!editAcessoTodas ? (
                            <div className="space-y-1.5 max-h-36 overflow-y-auto p-1">
                              {companies.map((c) => (
                                <label
                                  key={c.id}
                                  className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-750"
                                >
                                  <span className="font-medium text-gray-800 dark:text-gray-200">{c.nome}</span>
                                  <input
                                    type="checkbox"
                                    checked={editCompanyIds.includes(c.id)}
                                    onChange={() => toggleEditCompany(c.id)}
                                    className="rounded text-blue-600 w-4 h-4"
                                  />
                                </label>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              ✓ Este usuário poderá visualizar, lançar e filtrar dados de todas as empresas cadastradas.
                            </p>
                          )}
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => setEditingUserId(null)}
                            className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveFullEdit(u.id)}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Salvar Alterações</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: ADD USER */}
          {activeTab === 'add' && (
            <form onSubmit={handleCreateSubmit} className="space-y-4 max-w-lg mx-auto py-2">
              {addError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              {addSuccess && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Usuário cadastrado com sucesso!</span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Oliveira"
                  value={newNome}
                  onChange={(e) => setNewNome(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                  E-mail de Acesso *
                </label>
                <input
                  type="email"
                  required
                  placeholder="carlos@empresa.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                  Senha Inicial * (mínimo 6 dígitos)
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newSenha}
                  onChange={(e) => setNewSenha(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>

              {/* Permissão de Empresas */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    Permissões de Acesso
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={newAcessoTodas}
                      onChange={(e) => setNewAcessoTodas(e.target.checked)}
                      className="rounded bg-gray-100 dark:bg-slate-800 border-gray-300 text-blue-600"
                    />
                    <span>Acesso a todas as empresas</span>
                  </label>
                </div>

                {!newAcessoTodas ? (
                  <div className="space-y-1.5 border border-gray-200 dark:border-slate-700 p-2.5 rounded-lg max-h-40 overflow-y-auto">
                    <span className="text-[11px] text-gray-400 block mb-1">
                      Selecione quais empresas este usuário poderá ver:
                    </span>
                    {companies.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700"
                      >
                        <span className="text-gray-800 dark:text-gray-200">{c.nome}</span>
                        <input
                          type="checkbox"
                          checked={newSelectedCompanies.includes(c.id)}
                          onChange={() => toggleNewCompany(c.id)}
                          className="rounded text-blue-600 w-4 h-4"
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Este usuário poderá visualizar e manipular lançamentos de todas as empresas.</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Cadastrar Usuário</span>
              </button>
            </form>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};

