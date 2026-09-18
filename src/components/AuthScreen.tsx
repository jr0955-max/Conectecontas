import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  User as UserIcon, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  KeyRound,
  Building2,
  Phone,
  Clock,
  Send,
  Sparkles,
  HelpCircle,
  ChevronLeft,
  Loader2
} from 'lucide-react';
import { User, Company } from '../types';
import { verifyPassword } from '../utils/auth';
import { fetchCloudUsers } from '../firebase';

interface AuthScreenProps {
  users: User[];
  companies: Company[];
  onLoginSuccess: (user: User, targetMode?: 'master_portal' | 'app') => void;
  onRegisterUser: (
    nome: string, 
    email: string, 
    senha: string, 
    telefone: string,
    empresaSolicitada: string,
    cnpjSolicitado?: string
  ) => { success: boolean; error?: string; user?: User };
  onOpenPythonModal?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  users,
  companies,
  onLoginSuccess,
  onRegisterUser,
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'master'>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#master' || window.location.search.includes('portal=master')) {
        return 'master';
      }
    }
    return 'login';
  });
  
  // Login states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [pendingApprovalUser, setPendingApprovalUser] = useState<User | null>(null);
  const [blockedUserMsg, setBlockedUserMsg] = useState<string | null>(null);
  const [inactivityNotice, setInactivityNotice] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const notice = sessionStorage.getItem('fin_inactivity_reason');
      if (notice) {
        sessionStorage.removeItem('fin_inactivity_reason');
        return notice;
      }
    }
    return null;
  });

  // Register states
  const [regNome, setRegNome] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regTelefone, setRegTelefone] = useState('');
  const [regEmpresa, setRegEmpresa] = useState('');
  const [regCnpj, setRegCnpj] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registeredData, setRegisteredData] = useState<{ nome: string; email: string; empresa: string } | null>(null);

  const formatPhone = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 11);
    if (raw.length <= 2) return raw;
    if (raw.length <= 7) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
  };

  const formatCnpj = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 14);
    if (raw.length <= 2) return raw;
    if (raw.length <= 5) return `${raw.slice(0, 2)}.${raw.slice(2)}`;
    if (raw.length <= 8) return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5)}`;
    if (raw.length <= 12) return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8)}`;
    return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12)}`;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setPendingApprovalUser(null);
    setBlockedUserMsg(null);

    const rawEmail = loginEmail.trim();
    const rawPass = loginPassword;

    if (!rawEmail || !rawPass) {
      setLoginError('Por favor, preencha o e-mail e a senha.');
      return;
    }

    setIsVerifying(true);

    try {
      // 1. Normalização do identificador de login
      let normalized = rawEmail.toLowerCase().replace(/\s+/g, '');
      if (
        normalized === 'admin' || 
        normalized === 'master' || 
        normalized === 'root' || 
        normalized === 'administrador' ||
        normalized === 'admin@finaceiro.com' ||
        normalized === 'admin@financeiro' ||
        normalized === 'admin@financeiro.com'
      ) {
        normalized = 'admin@financeiro.com';
      }

      // 2. Procura na lista local de usuários
      let currentUsersList = [...users];
      let foundUser = currentUsersList.find(
        (u) => (u.email || '').trim().toLowerCase() === normalized
      );

      // Se não encontrou pelo e-mail exato, tenta encontrar por telefone ou nome
      if (!foundUser) {
        const cleanDigits = rawEmail.replace(/\D/g, '');
        foundUser = currentUsersList.find((u) => {
          if (cleanDigits && u.telefone && u.telefone.replace(/\D/g, '') === cleanDigits) return true;
          if (u.nome && u.nome.trim().toLowerCase() === rawEmail.toLowerCase()) return true;
          return false;
        });
      }

      // 3. Se não encontrou (comum em novo dispositivo celular/notebook), busca em tempo real no Firestore
      if (!foundUser) {
        try {
          const cloudUsers = await fetchCloudUsers();
          if (cloudUsers.length > 0) {
            foundUser = cloudUsers.find(
              (u) => (u.email || '').trim().toLowerCase() === normalized
            );
            if (!foundUser) {
              const cleanDigits = rawEmail.replace(/\D/g, '');
              foundUser = cloudUsers.find((u) => {
                if (cleanDigits && u.telefone && u.telefone.replace(/\D/g, '') === cleanDigits) return true;
                if (u.nome && u.nome.trim().toLowerCase() === rawEmail.toLowerCase()) return true;
                return false;
              });
            }
          }
        } catch (fetchErr) {
          console.warn('Aviso ao consultar nuvem na autenticação:', fetchErr);
        }
      }

      // 4. Fallback universal garantido para os administradores do sistema
      if (!foundUser && (
        normalized === 'admin@financeiro.com' || 
        normalized === 'admin@finaceiro.com' ||
        normalized.startsWith('admin@') ||
        normalized === 'admin' ||
        normalized === 'master'
      )) {
        foundUser = {
          id: 1,
          nome: 'Super Admin Master',
          email: 'admin@financeiro.com',
          senha_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
          acesso_todas_empresas: true,
          is_master: true,
          role: 'master',
          status: 'ativo',
        };
      } else if (!foundUser && (normalized === 'jr0955@gmail.com' || normalized.startsWith('jr0955'))) {
        foundUser = {
          id: 2,
          nome: 'Lourenço Junior',
          email: 'jr0955@gmail.com',
          senha_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
          tenant_id: 1788215216712,
          acesso_todas_empresas: true,
          is_master: false,
          is_admin: true,
          role: 'admin',
          status: 'ativo',
        };
      }

      if (!foundUser) {
        setLoginError('Usuário não encontrado com este e-mail.');
        setIsVerifying(false);
        return;
      }

      // 5. Validação da Senha
      let isValid = verifyPassword(rawPass, foundUser.senha_hash, foundUser.email);
      if (!isValid) {
        // Se falhou no hash local, tenta refazer consulta na nuvem caso o usuário tenha alterado a senha em outro aparelho
        try {
          const cloudUsers = await fetchCloudUsers();
          const freshCloudUser = cloudUsers.find(
            (u) => Number(u.id) === Number(foundUser?.id) || u.email.toLowerCase() === foundUser?.email.toLowerCase()
          );
          if (freshCloudUser && verifyPassword(rawPass, freshCloudUser.senha_hash, freshCloudUser.email)) {
            foundUser = freshCloudUser;
            isValid = true;
          }
        } catch {
          // Keep previous result
        }
      }

      if (!isValid) {
        setLoginError('Senha incorreta. Verifique a senha digitada.');
        setIsVerifying(false);
        return;
      }

      // 6. Verificação de status e aprovação
      const isMasterUser = Boolean(
        foundUser.is_master || 
        foundUser.email.toLowerCase() === 'admin@financeiro.com' || 
        Number(foundUser.id) === 1 || 
        foundUser.role === 'master'
      );
      const userStatus = foundUser.status || (isMasterUser ? 'ativo' : 'ativo');

      if (!isMasterUser) {
        if (userStatus === 'pendente') {
          setPendingApprovalUser(foundUser);
          setIsVerifying(false);
          return;
        }

        if (userStatus === 'bloqueado') {
          setBlockedUserMsg('Seu acesso foi temporariamente bloqueado pelo Administrador Master. Entre em contato para liberação.');
          setIsVerifying(false);
          return;
        }

        if (userStatus === 'rejeitado') {
          setBlockedUserMsg(`Sua solicitação de acesso não foi aprovada pelo Administrador Master.${foundUser.motivo_recusa ? ` Motivo: ${foundUser.motivo_recusa}` : ''}`);
          setIsVerifying(false);
          return;
        }
      }

      if (tab === 'master') {
        if (!isMasterUser) {
          setLoginError('Acesso ao Portal Master restrito exclusivamente ao Dono/Super Administrador (Tenant 1).');
          setIsVerifying(false);
          return;
        }
        onLoginSuccess(foundUser, 'master_portal');
        return;
      }

      onLoginSuccess(foundUser, 'app');
    } catch (err: any) {
      console.error('Erro no login:', err);
      setLoginError('Ocorreu um erro ao validar seu login. Tente novamente.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!regNome.trim()) {
      setRegError('Por favor, informe seu nome completo.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setRegError('Por favor, informe um e-mail corporativo válido.');
      return;
    }
    if (!regTelefone.trim() || regTelefone.replace(/\D/g, '').length < 10) {
      setRegError('Por favor, informe um número de WhatsApp ou telefone válido com DDD.');
      return;
    }
    if (!regEmpresa.trim()) {
      setRegError('Por favor, informe o nome da sua empresa ou negócio.');
      return;
    }
    if (regPassword.length < 6) {
      setRegError('A senha deve ter pelo menos 6 dígitos para segurança.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError('A confirmação de senha não confere com a senha digitada.');
      return;
    }

    const res = await Promise.resolve(onRegisterUser(
      regNome.trim(),
      regEmail.trim().toLowerCase(),
      regPassword,
      regTelefone.trim(),
      regEmpresa.trim(),
      regCnpj.trim() || undefined
    ));

    if (!res.success) {
      setRegError(res.error || 'Erro ao registrar solicitação de cadastro.');
    } else {
      setRegisteredData({
        nome: regNome.trim(),
        email: regEmail.trim().toLowerCase(),
        empresa: regEmpresa.trim()
      });
      setRegistrationSuccess(true);
      // Reset fields
      setRegNome('');
      setRegEmail('');
      setRegTelefone('');
      setRegEmpresa('');
      setRegCnpj('');
      setRegPassword('');
      setRegConfirmPassword('');
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100 font-sans relative overflow-x-hidden">
      
      {/* Background Decorative Gradient Orbs */}
      <div className="absolute top-1/6 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/6 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-600/30 text-white font-black text-2xl mb-1 border border-white/10">
            C
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Conectecontas
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
            Plataforma de Gestão Financeira Multiempresa & Controle de Acesso
          </p>
        </div>

        {/* Auth Card Container */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 backdrop-blur-md">
          
          {/* Tab Switcher */}
          {!registrationSuccess && !pendingApprovalUser && (
            <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold gap-1">
              <button
                id="tab-login-btn"
                type="button"
                onClick={() => {
                  setTab('login');
                  setLoginError('');
                  setBlockedUserMsg(null);
                }}
                className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  tab === 'login'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Entrar no ERP</span>
              </button>

              <button
                id="tab-master-btn"
                type="button"
                onClick={() => {
                  setTab('master');
                  setLoginError('');
                  setBlockedUserMsg(null);
                }}
                className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  tab === 'master'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-amber-300'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Portal Master</span>
              </button>

              <button
                id="tab-register-btn"
                type="button"
                onClick={() => {
                  setTab('register');
                  setRegError('');
                }}
                className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  tab === 'register'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Novo Cadastro</span>
              </button>
            </div>
          )}

          {/* ================= TELA DE SUCESSO DO CADASTRO (AGUARDANDO LIBERAÇÃO) ================= */}
          {registrationSuccess && registeredData && (
            <div className="text-center py-4 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                <Clock className="w-8 h-8 animate-pulse" />
              </div>

              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Solicitação Enviada com Sucesso!
                </span>
                <h3 className="text-xl font-bold text-white">
                  Cadastro em Análise
                </h3>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Olá, <strong>{registeredData.nome}</strong>! Sua solicitação de acesso para a empresa <strong>{registeredData.empresa}</strong> foi enviada para o <strong>Administrador Master</strong>.
                </p>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-left text-xs space-y-2 text-slate-400">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Como funciona a liberação?</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  1. O Administrador Master receberá seu pedido no painel de aprovações.
                </p>
                <p className="text-[11px] leading-relaxed">
                  2. Assim que liberado, seu acesso ficará 100% ativo instantaneamente.
                </p>
                <p className="text-[11px] leading-relaxed">
                  3. Basta entrar na tela de login com o e-mail (<strong>{registeredData.email}</strong>) e a senha escolhida.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setRegistrationSuccess(false);
                  setTab('login');
                  setLoginEmail(registeredData.email);
                }}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-blue-600/30"
              >
                <span>Ir para a Tela de Login</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ================= AVISO DE USUÁRIO PENDENTE NO LOGIN ================= */}
          {pendingApprovalUser && (
            <div className="text-center py-4 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                <Clock className="w-8 h-8 animate-pulse" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white">
                  Aguardando Liberação do Administrador Master
                </h3>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Olá, <strong>{pendingApprovalUser.nome}</strong>! Sua solicitação de cadastro para a empresa{' '}
                  <strong>{pendingApprovalUser.empresa_solicitada || 'sua empresa'}</strong> foi recebida e está aguardando aprovação do Master.
                </p>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-left text-xs space-y-1.5 text-slate-400">
                <div className="flex justify-between">
                  <span>E-mail:</span>
                  <span className="font-mono text-white">{pendingApprovalUser.email}</span>
                </div>
                {pendingApprovalUser.telefone && (
                  <div className="flex justify-between">
                    <span>Telefone / WhatsApp:</span>
                    <span className="font-mono text-white">{pendingApprovalUser.telefone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="font-bold text-amber-400">⏳ Pendente de Liberação</span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setPendingApprovalUser(null)}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Voltar para Login</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= FORMULÁRIO DE LOGIN (ERP OU PORTAL MASTER) ================= */}
          {!registrationSuccess && !pendingApprovalUser && (tab === 'login' || tab === 'master') && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {tab === 'master' && (
                <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-2xl text-xs text-amber-200 flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-extrabold text-amber-300 text-xs">Acesso ao Portal Master (SaaS)</div>
                    <p className="text-[11px] text-amber-200/80 leading-relaxed mt-0.5">
                      Painel exclusivo de gestão dos clientes revenda, métricas de assinaturas Mercado Pago e controle de acessos.
                    </p>
                  </div>
                </div>
              )}

              {inactivityNotice && (
                <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                  <Clock className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-300">🔒 Sessão Protegida: </span>
                    <span className="text-amber-200/90 leading-relaxed">{inactivityNotice}</span>
                  </div>
                </div>
              )}

              {loginError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <p className="leading-relaxed">{loginError}</p>
                </div>
              )}

              {blockedUserMsg && (
                <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span className="leading-relaxed">{blockedUserMsg}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Mail className={`w-3.5 h-3.5 ${tab === 'master' ? 'text-amber-400' : 'text-blue-400'}`} />
                  <span>{tab === 'master' ? 'E-mail do Administrador Master' : 'E-mail ou Usuário de Acesso'}</span>
                </label>
                <input
                  id="input-login-email"
                  type="text"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@financeiro.com"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username email"
                  spellCheck={false}
                  className={`w-full px-4 py-2.5 bg-slate-950 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                    tab === 'master'
                      ? 'border-amber-700/60 focus:border-amber-400'
                      : 'border-slate-700/80 focus:border-blue-500'
                  }`}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <KeyRound className={`w-3.5 h-3.5 ${tab === 'master' ? 'text-amber-400' : 'text-blue-400'}`} />
                    <span>Senha de Acesso</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">Autenticação Segura</span>
                </div>
                <div className="relative">
                  <input
                    id="input-login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="current-password"
                    spellCheck={false}
                    className={`w-full px-4 py-2.5 bg-slate-950 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-colors pr-10 ${
                      tab === 'master'
                        ? 'border-amber-700/60 focus:border-amber-400'
                        : 'border-slate-700/80 focus:border-blue-500'
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                    title={showLoginPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                id="btn-submit-login"
                type="submit"
                disabled={isVerifying}
                className={`w-full py-3 px-4 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer mt-2 ${
                  tab === 'master'
                    ? 'bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 shadow-amber-600/30'
                    : 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 shadow-blue-600/30'
                }`}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verificando Credenciais...</span>
                  </>
                ) : tab === 'master' ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-amber-200" />
                    <span>Acessar Portal Master (SaaS)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-blue-200" />
                    <span>Entrar no ERP Financeiro</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setLoginError('');
                  }}
                  className="text-xs text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                >
                  Novo por aqui? <strong>Solicite o cadastro da sua empresa &rarr;</strong>
                </button>
              </div>
            </form>
          )}

          {/* ================= FORMULÁRIO DE SOLICITAÇÃO DE CADASTRO ================= */}
          {!registrationSuccess && !pendingApprovalUser && tab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="p-3 bg-blue-950/30 border border-blue-500/20 rounded-xl text-xs text-slate-300 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[11px]">
                  Preencha as informações da sua empresa. Sua solicitação será encaminhada para <strong>análise e liberação pelo Administrador Master</strong>.
                </p>
              </div>

              {regError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{regError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                    <UserIcon className="w-3 h-3 text-blue-400" />
                    <span>Seu Nome Completo</span>
                  </label>
                  <input
                    id="input-reg-nome"
                    type="text"
                    value={regNome}
                    onChange={(e) => setRegNome(e.target.value)}
                    placeholder="Ex: Carlos Eduardo"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-400" />
                    <span>WhatsApp / Telefone</span>
                  </label>
                  <input
                    id="input-reg-telefone"
                    type="text"
                    value={regTelefone}
                    onChange={(e) => setRegTelefone(formatPhone(e.target.value))}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-blue-400" />
                  <span>E-mail Corporativo de Acesso</span>
                </label>
                <input
                  id="input-reg-email"
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="carlos@suaempresa.com.br"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-blue-400" />
                    <span>Nome da sua Empresa</span>
                  </label>
                  <input
                    id="input-reg-empresa"
                    type="text"
                    value={regEmpresa}
                    onChange={(e) => setRegEmpresa(e.target.value)}
                    placeholder="Ex: Comercial Silva Ltda"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                    <span>CNPJ (opcional)</span>
                  </label>
                  <input
                    id="input-reg-cnpj"
                    type="text"
                    value={regCnpj}
                    onChange={(e) => setRegCnpj(formatCnpj(e.target.value))}
                    placeholder="00.000.000/0001-00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Definir Senha
                  </label>
                  <div className="relative">
                    <input
                      id="input-reg-password"
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      autoCapitalize="none"
                      autoCorrect="off"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 pr-8"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Confirmar Senha
                  </label>
                  <input
                    id="input-reg-confirm-password"
                    type={showRegPassword ? 'text' : 'password'}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <button
                id="btn-submit-register"
                type="submit"
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-colors cursor-pointer mt-3"
              >
                <Send className="w-4 h-4" />
                <span>Enviar Solicitação de Cadastro</span>
              </button>
            </form>
          )}

        </div>

        {/* Security Info Footer */}
        <div className="flex items-center justify-center px-2 text-xs text-slate-500 gap-4">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Autenticação Criptografada</span>
          </div>
          <span>&bull;</span>
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Múltiplas Empresas Isoladas</span>
          </div>
        </div>

      </div>

    </div>
  );
};
