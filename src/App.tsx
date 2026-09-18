import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Company, 
  FinancialAccount, 
  AccountStatus,
  User, 
  UserCompanyLink, 
  AuditLog, 
  AuditAction, 
  SystemBackupSnapshot,
  BankAccount,
  CostCenter,
  UserStatus,
  UserRole,
  UserPermissions,
  Tenant,
  isTenantActive,
  calculateExtendedExpirationDate,
  BillingInvoice
} from './types';
import { 
  INITIAL_COMPANIES, 
  INITIAL_ACCOUNTS, 
  INITIAL_USERS, 
  INITIAL_USER_COMPANIES,
  INITIAL_BANK_ACCOUNTS,
  INITIAL_COST_CENTERS,
  INITIAL_TENANTS
} from './data/initialData';
import { hashPassword } from './utils/auth';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { SummaryCards } from './components/SummaryCards';
import { AccountsTable } from './components/AccountsTable';
import { CompanyModal } from './components/CompanyModal';
import { ChartModal } from './components/ChartModal';
import { PythonCodeModal } from './components/PythonCodeModal';
import { SqliteSchemaModal } from './components/SqliteSchemaModal';
import { UserManagementModal } from './components/UserManagementModal';
import { MasterManagementModal } from './components/MasterManagementModal';
import { CsvModal } from './components/CsvModal';
import { ExtratoImportModal } from './components/ExtratoImportModal';
import { ResetDataModal } from './components/ResetDataModal';
import { AuditLogModal } from './components/AuditLogModal';
import { TrashBinModal } from './components/TrashBinModal';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import { AccountHistoryModal } from './components/AccountHistoryModal';
import { ConsolidatedCompanyChart } from './components/ConsolidatedCompanyChart';
import { BankAccountsModal } from './components/BankAccountsModal';
import { CostCentersModal } from './components/CostCentersModal';
import { RecurringInstallmentModal } from './components/RecurringInstallmentModal';
import { OfxImportModal } from './components/OfxImportModal';
import { CashflowProjectionModal } from './components/CashflowProjectionModal';
import { WebhookSimulatorModal } from './components/WebhookSimulatorModal';
import { BankingIntegrationsModal } from './components/BankingIntegrationsModal';
import { AuthScreen } from './components/AuthScreen';
import { MasterPortalScreen } from './components/MasterPortalScreen';
import { CompanySelectionScreen } from './components/CompanySelectionScreen';
import { TenantBlockedScreen } from './components/TenantBlockedScreen';
import { SubscriptionModal } from './components/SubscriptionModal';
import { InactivityWarningModal } from './components/InactivityWarningModal';
import { SecuritySettingsModal } from './components/SecuritySettingsModal';
import { useInactivityTimeout } from './hooks/useInactivityTimeout';
import { 
  Building2,
  Users,
  ShieldCheck,
  FileSpreadsheet,
  Layers,
  Cloud,
  CheckCircle2,
  History,
  RotateCcw,
  HardDrive,
  Crown
} from 'lucide-react';
import { PYTHON_APP_CODE } from './pythonCode';
import {
  seedCloudDataIfEmpty,
  subscribeToTenants,
  subscribeToCompanies,
  subscribeToUsers,
  subscribeToUserCompanies,
  subscribeToAccounts,
  subscribeToAuditLogs,
  subscribeToBankAccounts,
  subscribeToCostCenters,
  subscribeToBillingInvoices,
  fetchAllCloudData,
  saveCloudTenant,
  deleteCloudTenant,
  saveCloudAccount,
  deleteCloudAccount,
  saveCloudAccountsBatch,
  saveCloudBankAccount,
  deleteCloudBankAccount,
  saveCloudCostCenter,
  deleteCloudCostCenter,
  saveCloudCompany,
  deleteCloudCompany,
  saveCloudUser,
  deleteCloudUser,
  saveCloudUserCompanyLinks,
  clearAllCloudAccounts,
  clearAllCloudDataAndStartFresh,
  resetCloudToInitialData,
  saveCloudAuditLog,
  clearAllCloudAuditLogs,
  restoreFullCloudSnapshot,
  wipeAllDataExceptMaster,
  recalcularSaldoTotal
} from './firebase';
import { 
  fetchServerSystemStore, 
  saveServerSystemStore, 
  registerPublicUserRequest, 
  deleteServerTenant, 
  deleteServerUser, 
  deleteServerAccount,
  saveServerAccount,
  saveServerAccountsBatch
} from './services/systemStoreService';

export default function App() {
  // 0. Multi-tenant SAAS Hierarchy Persistence
  const [tenants, setTenants] = useState<Tenant[]>(() => {
    const saved = localStorage.getItem('fin_tenants');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((t: Tenant) => {
            const em = (t.email || '').trim().toLowerCase();
            const nm = (t.nome || '').trim();
            return em !== 'admin@financeiro.com' && em !== 'admin@finaceiro.com' && nm !== 'Organização Corporativa Matriz';
          });
        }
      } catch (e) {}
    }
    return INITIAL_TENANTS;
  });

  // 1. Users & Authentication Persistence
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('fin_users');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return INITIAL_USERS;
  });

  const [userCompanies, setUserCompanies] = useState<UserCompanyLink[]>(() => {
    const saved = localStorage.getItem('fin_user_companies');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return INITIAL_USER_COMPANIES;
  });

  // Configurações de Segurança & Inatividade
  const [inactivityTimeoutMinutes, setInactivityTimeoutMinutes] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fin_inactivity_timeout_minutes');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    return 15; // 15 minutos padrão
  });

  const [requireLoginOnReopen, setRequireLoginOnReopen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fin_require_login_on_reopen');
      if (saved !== null) return saved === 'true';
    }
    return true; // Ativado por padrão: exige login ao fechar/reabrir do histórico
  });

  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;

    // 1. Se o usuário efetuou logout manualmente
    const isLoggedOut = localStorage.getItem('fin_logged_out') === 'true';
    if (isLoggedOut) return null;

    // 2. Proteção de Reabertura pelo Histórico do Celular / Novo Navegador
    // O sessionStorage é apagado automaticamente pelo navegador ao fechar a aba/aplicativo.
    // Se requireLoginOnReopen estiver ativo (padrão true) e não houver sessão ativa nesta aba, exige senha.
    const shouldRequireLoginOnReopen = localStorage.getItem('fin_require_login_on_reopen') !== 'false';
    const isSessionActiveInCurrentTab = sessionStorage.getItem('fin_session_active') === 'true';

    if (shouldRequireLoginOnReopen && !isSessionActiveInCurrentTab) {
      sessionStorage.setItem(
        'fin_inactivity_reason',
        'Por segurança, informe sua senha para acessar seus lançamentos financeiros.'
      );
      return null;
    }

    // 3. Verificação de Inatividade no Tempo Ocioso
    const timeoutMin = parseInt(localStorage.getItem('fin_inactivity_timeout_minutes') || '15', 10);
    const timeoutMs = (isNaN(timeoutMin) || timeoutMin <= 0 ? 15 : timeoutMin) * 60 * 1000;
    const lastActivity = localStorage.getItem('fin_last_activity');

    if (lastActivity) {
      const lastActivityTime = parseInt(lastActivity, 10);
      if (!isNaN(lastActivityTime) && (Date.now() - lastActivityTime > timeoutMs)) {
        sessionStorage.setItem(
          'fin_inactivity_reason',
          `Sessão encerrada automaticamente após ${timeoutMin} minutos de inatividade.`
        );
        localStorage.removeItem('fin_current_user');
        sessionStorage.removeItem('fin_session_active');
        return null;
      }
    }

    // 4. Se a sessão for válida e ativa, restaura os dados do usuário autenticado
    const saved = localStorage.getItem('fin_current_user');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) {
          localStorage.setItem('fin_last_activity', String(Date.now()));
          sessionStorage.setItem('fin_session_active', 'true');
          return parsed;
        }
      } catch (e) {}
    }

    return null;
  });

  // 2. Companies & Accounts Persistence
  const [companies, setCompanies] = useState<Company[]>(() => {
    const saved = localStorage.getItem('fin_companies');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return INITIAL_COMPANIES;
  });

  const [accounts, setAccounts] = useState<FinancialAccount[]>(() => {
    const saved = localStorage.getItem('fin_accounts');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return INITIAL_ACCOUNTS;
  });

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => {
    const saved = localStorage.getItem('fin_bank_accounts');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return INITIAL_BANK_ACCOUNTS;
  });

  const [costCenters, setCostCenters] = useState<CostCenter[]>(() => {
    const saved = localStorage.getItem('fin_cost_centers');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return INITIAL_COST_CENTERS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('fin_audit_logs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  const [cloudSynced, setCloudSynced] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    isOpen: boolean;
    success: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    success: false,
    title: '',
    message: '',
  });
  const lastRestoredTimestampRef = useRef<number>(0);
  const recentlyDeletedAccountsRef = useRef<Map<number, number>>(new Map());

  // Flow State: Did user choose a subcompany in this session?
  const [hasSelectedCompany, setHasSelectedCompany] = useState<boolean>(() => {
    return localStorage.getItem('fin_has_selected_company') === 'true';
  });

  // SaaS Multi-Tenant License Block State (Triggered when server responds with 403 Forbidden on financial endpoints)
  const [isServerSubscriptionBlocked, setIsServerSubscriptionBlocked] = useState<boolean>(false);

  useEffect(() => {
    const handleBlockedEvent = (e: any) => {
      const userTenantId = Number(currentUser?.tenant_id || 1);
      const isOwner = 
        userTenantId === 1 || 
        userTenantId === 1788215216712 || 
        currentUser?.email?.toLowerCase() === 'admin@financeiro.com' || 
        currentUser?.email?.toLowerCase() === 'jr0955@gmail.com' || 
        Boolean(currentUser?.is_master);

      if (!isOwner) {
        setIsServerSubscriptionBlocked(true);
      }
    };
    window.addEventListener('tenant-subscription-blocked', handleBlockedEvent);
    return () => window.removeEventListener('tenant-subscription-blocked', handleBlockedEvent);
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('fin_has_selected_company', String(hasSelectedCompany));
  }, [hasSelectedCompany]);

  useEffect(() => {
    localStorage.setItem('fin_tenants', JSON.stringify(tenants));
  }, [tenants]);

  useEffect(() => {
    if (companies.length > 0) {
      localStorage.setItem('fin_companies', JSON.stringify(companies));
    }
  }, [companies]);

  useEffect(() => {
    if (accounts.length > 0) {
      localStorage.setItem('fin_accounts', JSON.stringify(accounts));
    }
  }, [accounts]);

  useEffect(() => {
    if (bankAccounts.length > 0) {
      localStorage.setItem('fin_bank_accounts', JSON.stringify(bankAccounts));
    }
  }, [bankAccounts]);

  useEffect(() => {
    if (costCenters.length > 0) {
      localStorage.setItem('fin_cost_centers', JSON.stringify(costCenters));
    }
  }, [costCenters]);

  useEffect(() => {
    if (users.length > 0) {
      localStorage.setItem('fin_users', JSON.stringify(users));
    }
  }, [users]);

  useEffect(() => {
    if (userCompanies.length > 0) {
      localStorage.setItem('fin_user_companies', JSON.stringify(userCompanies));
    }
  }, [userCompanies]);

  useEffect(() => {
    if (auditLogs.length > 0) {
      localStorage.setItem('fin_audit_logs', JSON.stringify(auditLogs));
    }
  }, [auditLogs]);

  // Wipe all data leaving only Master Super Admin
  const handleWipeAllDataAndLeaveMaster = async () => {
    setIsSyncing(true);
    try {
      await wipeAllDataExceptMaster();
      setTenants([]);
      setCompanies([]);
      setAccounts([]);
      setBankAccounts([]);
      setCostCenters([]);
      setUserCompanies([]);
      setAuditLogs([]);
      setUsers(INITIAL_USERS);
      setCurrentUser(INITIAL_USERS[0]);
      localStorage.removeItem('fin_logged_out');
      localStorage.setItem('fin_current_user', JSON.stringify(INITIAL_USERS[0]));
      localStorage.setItem('fin_tenants', JSON.stringify([]));
      localStorage.setItem('fin_companies', JSON.stringify([]));
      localStorage.setItem('fin_accounts', JSON.stringify([]));
      localStorage.setItem('fin_bank_accounts', JSON.stringify([]));
      localStorage.setItem('fin_cost_centers', JSON.stringify([]));
      localStorage.setItem('fin_user_companies', JSON.stringify([]));
      localStorage.setItem('fin_users', JSON.stringify(INITIAL_USERS));
      localStorage.setItem('fin_selected_company', '-1');
      setSelectedCompanyId(-1);
      setHasSelectedCompany(false);
      setMasterScreenMode('master_portal');
    } catch (e) {
      console.error('Erro ao limpar base de dados:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Manual cloud sync trigger
  const handleForceCloudSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      // 1. Salvar estado atual no servidor central (onde o celular ais-pre busca com rapidez)
      const saveOk = await saveServerSystemStore({
        hasCustomData: true,
        companies,
        accounts,
        users,
        userCompanies,
        bankAccounts,
        costCenters,
        tenants,
        auditLogs,
        source: 'manual_navbar_sync_to_mobile',
      });

      // 2. Acionar sincronização Firestore em segundo plano (sem travar o botão se Firestore estiver offline)
      restoreFullCloudSnapshot({
        companies,
        accounts,
        users,
        userCompanies,
        bankAccounts,
        costCenters,
        tenants,
        auditLogs,
      }).catch((cloudErr) => {
        console.debug('Aviso sincronização Firestore background:', cloudErr);
      });

      setCloudSynced(true);

      if (saveOk) {
        setSyncFeedback({
          isOpen: true,
          success: true,
          title: 'Sincronização Concluída!',
          message: `${companies.length} empresa(s) e ${accounts.length} lançamento(s) sincronizados com sucesso no servidor central! Seus dados reais estão prontos para o celular.`,
        });
      } else {
        setSyncFeedback({
          isOpen: true,
          success: false,
          title: 'Aviso de Sincronização',
          message: 'Não foi possível confirmar o salvamento no servidor no momento. Tente novamente em alguns instantes.',
        });
      }
    } catch (err: any) {
      console.warn('Erro na sincronização manual:', err);
      setSyncFeedback({
        isOpen: true,
        success: false,
        title: 'Erro ao Sincronizar',
        message: err?.message || 'Falha de comunicação com o servidor.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Initial cloud seed & real-time subscriptions + mobile reconnect handlers
  useEffect(() => {
    const syncDataDirectly = async () => {
      // If a restore was executed within 30 seconds, do not allow polling to overwrite state
      if (Date.now() - lastRestoredTimestampRef.current < 30000) return;

      try {
        // 1. PRIORIDADE MÁXIMA: Consultar o repositório central do servidor Node/Express
        // Isso resolve imediatamente o problema do celular carregar empresas de teste
        const userTenantId = Number(currentUser?.tenant_id || 1);
        const serverStore = await fetchServerSystemStore(userTenantId);

        // Se o servidor respondeu 403 Forbidden (Assinatura Inativa/Expirada) e o usuário não é Dono/Master
        const isOwnerUser = 
          userTenantId === 1 || 
          userTenantId === 1788215216712 || 
          currentUser?.email?.toLowerCase() === 'admin@financeiro.com' || 
          currentUser?.email?.toLowerCase() === 'jr0955@gmail.com' || 
          Boolean(currentUser?.is_master);

        if (serverStore.isBlocked && !isOwnerUser) {
          setIsServerSubscriptionBlocked(true);
          return;
        } else if (serverStore.success || isOwnerUser) {
          setIsServerSubscriptionBlocked(false);
        }

        if (serverStore.success && serverStore.hasCustomData && serverStore.data) {
          const sData = serverStore.data;
          
          // 1. Merge inteligente de Empresas
          if (Array.isArray(sData.companies) && sData.companies.length > 0) {
            let localCompsList: Company[] = [];
            try {
              const rawComps = localStorage.getItem('fin_companies');
              if (rawComps) localCompsList = JSON.parse(rawComps);
            } catch (e) {}

            const compMap = new Map<number, Company>();
            localCompsList.forEach((c) => { if (c && c.id) compMap.set(Number(c.id), c); });
            sData.companies.forEach((c: Company) => { if (c && c.id) compMap.set(Number(c.id), c); });
            const finalCompanies = Array.from(compMap.values());

            setCompanies(finalCompanies);
            localStorage.setItem('fin_companies', JSON.stringify(finalCompanies));
          }

          // 2. Merge inteligente de Contas (PROTEÇÃO CRÍTICA ANTI-PERDA DE DADOS)
          if (Array.isArray(sData.accounts)) {
            const now = Date.now();
            const safeAccounts = sData.accounts.map((acc: FinancialAccount) => {
              const deletedAt = recentlyDeletedAccountsRef.current.get(Number(acc.id));
              if (deletedAt && (now - deletedAt) < 15000) {
                return { ...acc, excluido: true };
              }
              return acc;
            });

            // Carrega contas locais existentes no navegador antes de qualquer substituição
            let localAccountsList: FinancialAccount[] = [];
            try {
              const rawLocal = localStorage.getItem('fin_accounts');
              if (rawLocal) localAccountsList = JSON.parse(rawLocal);
            } catch (e) {}

            // Guarda snapshot de segurança do cache local caso ainda não tenha sido sobrescrito
            if (localAccountsList.length > safeAccounts.length) {
              try {
                localStorage.setItem('fin_accounts_safety_backup', JSON.stringify({
                  timestamp: Date.now(),
                  count: localAccountsList.length,
                  accounts: localAccountsList,
                }));
              } catch (e) {}
            }

            // Merge inteligente: nunca perde contas que existiam localmente
            const accountMap = new Map<number, FinancialAccount>();
            localAccountsList.forEach((acc) => {
              if (acc && acc.id) accountMap.set(Number(acc.id), acc);
            });
            safeAccounts.forEach((acc) => {
              if (acc && acc.id) accountMap.set(Number(acc.id), acc);
            });

            const finalAccounts = Array.from(accountMap.values());
            setAccounts(finalAccounts);
            localStorage.setItem('fin_accounts', JSON.stringify(finalAccounts));

            // Se o navegador possuía contas que o servidor não tinha (ex: após reinício de contêiner ou novo servidor),
            // envia imediatamente essas contas para o servidor central para que fique 100% atualizado!
            if (finalAccounts.length > safeAccounts.length) {
              console.log(`🛡️ [App.tsx] Sincronização de Resgate: Restaurando ${finalAccounts.length - safeAccounts.length} contas do navegador para o servidor central!`);
              saveServerSystemStore({
                hasCustomData: true,
                companies: sData.companies || [],
                accounts: finalAccounts,
                users: sData.users || [],
                userCompanies: sData.userCompanies || [],
                bankAccounts: sData.bankAccounts || [],
                costCenters: sData.costCenters || [],
                tenants: sData.tenants || [],
                auditLogs: sData.auditLogs || [],
                source: 'client_local_cache_recovery',
              }).catch((e) => console.warn('Aviso ao sincronizar contas recuperadas:', e));
            }
          }
          if (Array.isArray(sData.users) && sData.users.length > 0) {
            setUsers((prev) => {
              const map = new Map<number, User>();
              for (const u of sData.users) map.set(Number(u.id), u);
              for (const pu of prev) {
                if (!map.has(Number(pu.id))) {
                  map.set(Number(pu.id), pu);
                }
              }
              const merged = Array.from(map.values()).sort((a, b) => a.id - b.id);
              localStorage.setItem('fin_users', JSON.stringify(merged));
              return merged;
            });
            setCurrentUser((curr) => {
              if (!curr || localStorage.getItem('fin_logged_out') === 'true') return null;
              const matched = sData.users.find((u) => u.id === curr.id || u.email.toLowerCase() === curr.email.toLowerCase());
              return matched || curr;
            });
          }
          if (Array.isArray(sData.userCompanies) && sData.userCompanies.length > 0) {
            setUserCompanies(sData.userCompanies);
            localStorage.setItem('fin_user_companies', JSON.stringify(sData.userCompanies));
          }
          if (Array.isArray(sData.bankAccounts) && sData.bankAccounts.length > 0) {
            setBankAccounts(sData.bankAccounts);
            localStorage.setItem('fin_bank_accounts', JSON.stringify(sData.bankAccounts));
          }
          if (Array.isArray(sData.costCenters) && sData.costCenters.length > 0) {
            setCostCenters(sData.costCenters);
            localStorage.setItem('fin_cost_centers', JSON.stringify(sData.costCenters));
          }
          if (Array.isArray(sData.tenants) && sData.tenants.length > 0) {
            setTenants(sData.tenants);
            localStorage.setItem('fin_tenants', JSON.stringify(sData.tenants));
          }
          if (Array.isArray(sData.auditLogs) && sData.auditLogs.length > 0) {
            setAuditLogs(sData.auditLogs);
            localStorage.setItem('fin_audit_logs', JSON.stringify(sData.auditLogs));
          }
          setCloudSynced(true);
          return;
        }

        // Se o servidor ainda não tem snapshot gravado, verificar se ESTE navegador possui as empresas reais do usuário
        // (por exemplo, o Preview do computador onde o backup foi aberto ou restaurado)
        const localCompsRaw = localStorage.getItem('fin_companies');
        let localComps: Company[] = [];
        try { if (localCompsRaw) localComps = JSON.parse(localCompsRaw); } catch (e) {}

        const isDemo = localComps.length === 5 && localComps[0]?.nome === 'Matriz - Gestão Empresarial';
        if (localComps.length > 0 && !isDemo) {
          // Salvar no servidor central imediatamente para que o celular leia na hora
          let localAccounts: FinancialAccount[] = [];
          let localUsers: User[] = [];
          let localUserComps: UserCompanyLink[] = [];
          let localBanks: BankAccount[] = [];
          let localCC: CostCenter[] = [];
          let localTenants: Tenant[] = [];
          let localLogs: AuditLog[] = [];
          try { localAccounts = JSON.parse(localStorage.getItem('fin_accounts') || '[]'); } catch (e) {}
          try { localUsers = JSON.parse(localStorage.getItem('fin_users') || '[]'); } catch (e) {}
          try { localUserComps = JSON.parse(localStorage.getItem('fin_user_companies') || '[]'); } catch (e) {}
          try { localBanks = JSON.parse(localStorage.getItem('fin_bank_accounts') || '[]'); } catch (e) {}
          try { localCC = JSON.parse(localStorage.getItem('fin_cost_centers') || '[]'); } catch (e) {}
          try { localTenants = JSON.parse(localStorage.getItem('fin_tenants') || '[]'); } catch (e) {}
          try { localLogs = JSON.parse(localStorage.getItem('fin_audit_logs') || '[]'); } catch (e) {}

          await saveServerSystemStore({
            hasCustomData: true,
            companies: localComps,
            accounts: localAccounts,
            users: localUsers,
            userCompanies: localUserComps,
            bankAccounts: localBanks,
            costCenters: localCC,
            tenants: localTenants,
            auditLogs: localLogs,
            source: 'auto_client_backup_push',
          });
          console.log('✅ Dados reais do Preview salvos no servidor para acesso do celular!');
        }

        // 2. Consulta de fallback ao Firestore caso ativo
        const data = await fetchAllCloudData();
        if (Array.isArray(data.companies) && data.companies.length > 0 && !(data.companies.length === 5 && data.companies[0]?.nome === 'Matriz - Gestão Empresarial')) {
          setCompanies(data.companies);
          localStorage.setItem('fin_companies', JSON.stringify(data.companies));
        }
        if (Array.isArray(data.accounts) && data.accounts.length > 0) {
          setAccounts(data.accounts);
          localStorage.setItem('fin_accounts', JSON.stringify(data.accounts));
        }
        setCloudSynced(true);
      } catch (e) {
        console.debug('Sync direto nuvem:', e);
      }
    };

    // Executar sincronização inicial imediatamente
    syncDataDirectly();

    // 0. Subscribe to cloud tenants
    const unsubTenants = subscribeToTenants((cloudTenants) => {
      if (Date.now() - lastRestoredTimestampRef.current < 30000) return;
      if (Array.isArray(cloudTenants) && cloudTenants.length > 0) {
        setTenants(cloudTenants);
        setCloudSynced(true);
      }
    });

    // 1. Subscribe to cloud companies
    const unsubCompanies = subscribeToCompanies((cloudComps) => {
      if (Date.now() - lastRestoredTimestampRef.current < 30000) return;
      if (Array.isArray(cloudComps) && cloudComps.length > 0) {
        setCompanies(cloudComps);
        setCloudSynced(true);
      }
    });

    // 2. Subscribe to cloud users
    const unsubUsers = subscribeToUsers((cloudUsers) => {
      if (Date.now() - lastRestoredTimestampRef.current < 30000) return;
      if (Array.isArray(cloudUsers) && cloudUsers.length > 0) {
        setUsers(cloudUsers);
        setCurrentUser((curr) => {
          if (!curr || localStorage.getItem('fin_logged_out') === 'true') return null;
          const matched = cloudUsers.find((u) => u.id === curr.id || u.email.toLowerCase() === curr.email.toLowerCase());
          return matched || curr;
        });
        setCloudSynced(true);
      }
    });

    // 3. Subscribe to cloud user company links
    const unsubLinks = subscribeToUserCompanies((cloudLinks) => {
      if (Date.now() - lastRestoredTimestampRef.current < 30000) return;
      if (Array.isArray(cloudLinks) && cloudLinks.length > 0) {
        setUserCompanies(cloudLinks);
        setCloudSynced(true);
      }
    });

    // 4. Subscribe to cloud accounts (Always sync instantly on delete/add/edit)
    const unsubAccounts = subscribeToAccounts((cloudAccs) => {
      if (Date.now() - lastRestoredTimestampRef.current < 30000) return;
      if (Array.isArray(cloudAccs) && cloudAccs.length > 0) {
        setAccounts(cloudAccs);
        setCloudSynced(true);
      }
    });

    // 5. Subscribe to cloud bank accounts
    const unsubBankAccounts = subscribeToBankAccounts((cloudBanks) => {
      if (Date.now() - lastRestoredTimestampRef.current < 30000) return;
      if (Array.isArray(cloudBanks) && cloudBanks.length > 0) {
        setBankAccounts(cloudBanks);
        setCloudSynced(true);
      }
    });

    // 6. Subscribe to cloud cost centers
    const unsubCostCenters = subscribeToCostCenters((cloudCCs) => {
      if (Date.now() - lastRestoredTimestampRef.current < 30000) return;
      if (Array.isArray(cloudCCs) && cloudCCs.length > 0) {
        setCostCenters(cloudCCs);
        setCloudSynced(true);
      }
    });

    // 7. Subscribe to cloud audit logs
    const unsubLogs = subscribeToAuditLogs((cloudLogs) => {
      if (Date.now() - lastRestoredTimestampRef.current < 30000) return;
      if (Array.isArray(cloudLogs) && cloudLogs.length > 0) {
        setAuditLogs(cloudLogs);
      }
    });

    // 8. Subscribe to billing invoices (Mercado Pago payments)
    const unsubInvoices = subscribeToBillingInvoices((cloudInvoices) => {
      if (Array.isArray(cloudInvoices)) {
        setBillingInvoices(cloudInvoices);
      }
    });

    // 9. Mobile Lifecycle: When mobile unlocks or tab regains focus, immediately pull fresh data
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncDataDirectly();
      }
    };

    const handleWindowFocus = () => {
      syncDataDirectly();
    };

    const handleOnline = () => {
      syncDataDirectly();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleOnline);

    // 10. Polling heartbeat every 4 seconds as fallback for mobile battery savers
    const interval = setInterval(syncDataDirectly, 4000);

    return () => {
      unsubTenants();
      unsubCompanies();
      unsubUsers();
      unsubLinks();
      unsubAccounts();
      unsubBankAccounts();
      unsubCostCenters();
      unsubLogs();
      unsubInvoices();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, []);

  const [billingInvoices, setBillingInvoices] = useState<BillingInvoice[]>([]);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('fin_dark_mode');
    return saved !== null ? saved === 'true' : false;
  });

  const [currentView, setCurrentView] = useState<'all' | 'pagar' | 'receber'>('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 3. Modal visibility states
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [isPythonModalOpen, setIsPythonModalOpen] = useState(false);
  const [isSqliteModalOpen, setIsSqliteModalOpen] = useState(false);
  const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState(false);
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isExtratoModalOpen, setIsExtratoModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isAuditLogModalOpen, setIsAuditLogModalOpen] = useState(false);
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isAccountHistoryModalOpen, setIsAccountHistoryModalOpen] = useState(false);
  const [selectedAccountForHistory, setSelectedAccountForHistory] = useState<FinancialAccount | null>(null);
  const [csvModalInitialTab, setCsvModalInitialTab] = useState<'export' | 'import'>('export');

  // Novos Módulos Financeiros Avançados
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [isOfxModalOpen, setIsOfxModalOpen] = useState(false);
  const [isBankAccountsModalOpen, setIsBankAccountsModalOpen] = useState(false);
  const [isCostCentersModalOpen, setIsCostCentersModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [isBankingModalOpen, setIsBankingModalOpen] = useState(false);
  const [bankingInitialProvider, setBankingInitialProvider] = useState<'bb' | 'stone' | 'infinitepay' | 'mercadopago'>('stone');

  // 4. Filter allowed companies based on currentUser permissions & Strict Tenant Isolation
  const scopedCompanies = useMemo(() => {
    if (!currentUser) return [];
    const isMasterUser = Boolean(
      currentUser.is_master ||
      Number(currentUser.id) === 1 ||
      currentUser.email?.toLowerCase() === 'admin@financeiro.com' ||
      currentUser.role === 'master'
    );

    // If super admin master: sees all system companies or scoped
    if (isMasterUser) {
      const userTenantId = Number(currentUser.tenant_id || 1);
      const tenantComps = companies.filter((c) => Number(c.tenant_id || 1) === userTenantId);
      return tenantComps.length > 0 ? tenantComps : companies;
    }

    // Resolvendo tenant id (Lourenço Junior / jr0955@gmail.com possui tenant 1788215216712)
    let userTenantId = Number(currentUser.tenant_id || 1);
    if (userTenantId === 1 && currentUser.email?.toLowerCase() === 'jr0955@gmail.com') {
      userTenantId = 1788215216712;
    }

    // 1. Filtra por tenant
    const tenantComps = companies.filter((c) => Number(c.tenant_id || 1) === userTenantId);
    if (tenantComps.length > 0) return tenantComps;

    // 2. Se não encontrou por tenant, verifica vínculos explícitos em userCompanies
    const allowedCompanyIds = userCompanies
      .filter((uc) => Number(uc.usuario_id) === Number(currentUser.id))
      .map((uc) => Number(uc.empresa_id));
    if (allowedCompanyIds.length > 0) {
      const linked = companies.filter((c) => allowedCompanyIds.includes(Number(c.id)));
      if (linked.length > 0) return linked;
    }

    // 3. Se for admin ou tiver permissão irrestrita, retorna as empresas disponíveis
    if (currentUser.acesso_todas_empresas || currentUser.role === 'admin' || currentUser.is_admin) {
      return companies;
    }

    return [];
  }, [currentUser, companies, userCompanies]);

  const permittedCompanies = useMemo(() => {
    if (!currentUser) return [];
    const isMasterUser = Boolean(
      currentUser.is_master ||
      Number(currentUser.id) === 1 ||
      currentUser.email?.toLowerCase() === 'admin@financeiro.com' ||
      currentUser.role === 'master'
    );

    if (isMasterUser) {
      return scopedCompanies.length > 0 ? scopedCompanies : companies;
    }

    const allowedCompanyIds = userCompanies
      .filter((uc) => Number(uc.usuario_id) === Number(currentUser.id))
      .map((uc) => Number(uc.empresa_id));

    if (currentUser.acesso_todas_empresas || currentUser.role === 'admin' || currentUser.is_admin) {
      if (scopedCompanies.length > 0) return scopedCompanies;
      if (allowedCompanyIds.length > 0) {
        const matched = companies.filter((c) => allowedCompanyIds.includes(Number(c.id)));
        if (matched.length > 0) return matched;
      }
      return companies;
    }
    
    if (allowedCompanyIds.length > 0) {
      const allowed = companies.filter((c) => allowedCompanyIds.includes(Number(c.id)));
      if (allowed.length > 0) return allowed;
    }
    
    return scopedCompanies.length > 0 ? scopedCompanies : companies;
  }, [currentUser, userCompanies, scopedCompanies, companies]);

  // Scoped bank accounts, cost centers, and audit logs strictly isolated by tenant
  const scopedBankAccounts = useMemo(() => {
    if (!currentUser) return [];
    const userTenantId = Number(currentUser.tenant_id || 1);
    return bankAccounts.filter((b) => Number(b.tenant_id || 1) === userTenantId);
  }, [currentUser, bankAccounts]);

  const scopedCostCenters = useMemo(() => {
    if (!currentUser) return [];
    const userTenantId = Number(currentUser.tenant_id || 1);
    return costCenters.filter((cc) => Number(cc.tenant_id || 1) === userTenantId);
  }, [currentUser, costCenters]);

  const scopedAuditLogs = useMemo(() => {
    if (!currentUser) return [];
    const userTenantId = Number(currentUser.tenant_id || 1);
    const permittedCompIds = permittedCompanies.map(c => Number(c.id));
    return auditLogs.filter((l) => 
      (l.tenant_id !== undefined && Number(l.tenant_id || 1) === userTenantId) ||
      (l.empresa_id !== undefined && permittedCompIds.includes(Number(l.empresa_id))) ||
      (l.usuario_id !== undefined && Number(l.usuario_id) === Number(currentUser.id))
    );
  }, [currentUser, auditLogs, permittedCompanies]);

  const scopedUsers = useMemo(() => {
    if (!currentUser) return [];
    const userTenantId = Number(currentUser.tenant_id || 1);
    return users.filter((u) => Number(u.tenant_id || 1) === userTenantId && !u.is_master);
  }, [currentUser, users]);

  const scopedUserCompanies = useMemo(() => {
    if (!currentUser) return [];
    const isMaster = Boolean(
      currentUser.is_master || 
      Number(currentUser.id) === 1 || 
      currentUser.email?.toLowerCase() === 'admin@financeiro.com' ||
      currentUser.role === 'master'
    );
    if (isMaster) {
      return userCompanies;
    }
    const scopedUserIds = scopedUsers.map(u => Number(u.id));
    return userCompanies.filter((uc) => scopedUserIds.includes(Number(uc.usuario_id)));
  }, [currentUser, userCompanies, scopedUsers]);

  // Selected company state (-1 represents Consolidated / All permitted companies)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(() => {
    const saved = localStorage.getItem('fin_selected_company');
    if (saved) {
      const parsed = Number(saved);
      if (parsed === -1 || companies.some((c) => c.id === parsed)) return parsed;
    }
    return -1; // Padrão Consolidado (todas as empresas) para que ao abrir num novo notebook apareçam TODAS as movimentações
  });

  // Adjust selectedCompanyId if current user doesn't have access to it or is restricted
  useEffect(() => {
    const isMaster = Boolean(
      currentUser?.is_master || 
      Number(currentUser?.id) === 1 || 
      currentUser?.email?.toLowerCase() === 'admin@financeiro.com'
    );
    const canSeeAll = isMaster || Boolean(currentUser?.acesso_todas_empresas);
    
    if (!canSeeAll && selectedCompanyId === -1) {
      if (permittedCompanies.length > 0) {
        setSelectedCompanyId(permittedCompanies[0].id);
      }
      return;
    }

    if (permittedCompanies.length > 0) {
      if (selectedCompanyId === -1 && canSeeAll) {
        return;
      }
      const hasAccess = permittedCompanies.some((c) => c.id === selectedCompanyId);
      if (!hasAccess) {
        setSelectedCompanyId(permittedCompanies[0].id);
      }
    }
  }, [permittedCompanies, selectedCompanyId, currentUser]);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('fin_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('fin_user_companies', JSON.stringify(userCompanies));
  }, [userCompanies]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('fin_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('fin_current_user');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('fin_companies', JSON.stringify(companies));
    if (companies.length > 0) {
      try {
        localStorage.setItem('fin_companies_safety_backup', JSON.stringify({
          timestamp: Date.now(),
          count: companies.length,
          companies,
        }));
      } catch (e) {}
    }
  }, [companies]);

  useEffect(() => {
    localStorage.setItem('fin_accounts', JSON.stringify(accounts));
    if (accounts.length > 5) {
      try {
        localStorage.setItem('fin_accounts_safety_backup', JSON.stringify({
          timestamp: Date.now(),
          count: accounts.length,
          accounts,
        }));
      } catch (e) {}
    }
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem('fin_bank_accounts', JSON.stringify(bankAccounts));
  }, [bankAccounts]);

  useEffect(() => {
    localStorage.setItem('fin_cost_centers', JSON.stringify(costCenters));
  }, [costCenters]);

  useEffect(() => {
    localStorage.setItem('fin_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('fin_selected_company', String(selectedCompanyId));
  }, [selectedCompanyId]);

  useEffect(() => {
    localStorage.setItem('fin_dark_mode', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Is Consolidated Mode Active?
  const isConsolidated = selectedCompanyId === -1;

  // Current company object
  const currentCompany = isConsolidated
    ? undefined
    : permittedCompanies.find((c) => Number(c.id) === Number(selectedCompanyId)) || permittedCompanies[0] || undefined;

  // Current Tenant object
  const currentTenant = useMemo(() => {
    if (!currentUser) return null;
    const userTenantId = Number(currentUser.tenant_id || 1);
    return tenants.find((t) => Number(t.id) === userTenantId) || null;
  }, [currentUser, tenants]);

  // Scoped Accounts across the user's entire Tenant (used in charts, CSV export, reconciliation, etc.)
  const tenantScopedAccounts = useMemo(() => {
    if (!currentUser) return [];
    const isMaster = Boolean(
      currentUser.is_master ||
      Number(currentUser.id) === 1 ||
      currentUser.email?.toLowerCase() === 'admin@financeiro.com' ||
      currentUser.role === 'master'
    );
    const permittedCompIds = permittedCompanies.map((c) => Number(c.id));
    if (isMaster) {
      return accounts.filter((a) => !a.excluido && (permittedCompIds.length === 0 || permittedCompIds.includes(Number(a.empresa_id))));
    }
    let userTenantId = Number(currentUser.tenant_id || 1);
    if (userTenantId === 1 && currentUser.email?.toLowerCase() === 'jr0955@gmail.com') {
      userTenantId = 1788215216712;
    }
    return accounts.filter(
      (a) => !a.excluido && (
        Number(a.tenant_id || 1) === userTenantId ||
        permittedCompIds.includes(Number(a.empresa_id))
      )
    );
  }, [currentUser, accounts, permittedCompanies]);

  // Accounts in active scope:
  // If consolidated, all accounts from permitted companies; otherwise, accounts from selected company
  const permittedCompanyIds = permittedCompanies.map((c) => Number(c.id));
  const activeScopedAccounts = useMemo(() => {
    if (!currentUser) return [];
    const isMaster = Boolean(
      currentUser.is_master ||
      Number(currentUser.id) === 1 ||
      currentUser.email?.toLowerCase() === 'admin@financeiro.com' ||
      currentUser.role === 'master'
    );

    let list = isConsolidated
      ? accounts.filter((a) => permittedCompanyIds.includes(Number(a.empresa_id)))
      : accounts.filter((a) => Number(a.empresa_id) === Number(selectedCompanyId));

    if (isMaster) {
      return list.filter((a) => !a.excluido);
    }

    let userTenantId = Number(currentUser?.tenant_id || 1);
    if (userTenantId === 1 && currentUser.email?.toLowerCase() === 'jr0955@gmail.com') {
      userTenantId = 1788215216712;
    }

    return list.filter((a) => !a.excluido && (
      Number(a.tenant_id || 1) === userTenantId ||
      permittedCompanyIds.includes(Number(a.empresa_id))
    ));
  }, [isConsolidated, accounts, permittedCompanyIds, selectedCompanyId, currentUser]);

  // Count of pending approval requests for Master badge
  const pendingApprovalsCount = useMemo(() => {
    return users.filter((u) => u.status === 'pendente').length;
  }, [users]);

  // Is Current User Super Admin Master
  const isCurrentUserMaster = Boolean(
    currentUser?.is_master || 
    Number(currentUser?.id) === 1 || 
    currentUser?.email?.toLowerCase() === 'admin@financeiro.com' ||
    currentUser?.role === 'master'
  );

  // Screen Mode for Master: 'master_portal' (painel pré-app) ou 'app' (sistema financeiro)
  const [masterScreenMode, setMasterScreenMode] = useState<'master_portal' | 'app'>(() => {
    const saved = localStorage.getItem('fin_master_screen_mode');
    return saved === 'master_portal' ? 'master_portal' : 'app';
  });

  useEffect(() => {
    localStorage.setItem('fin_master_screen_mode', masterScreenMode);
  }, [masterScreenMode]);

  // Authentication Handlers
  const handleLoginSuccess = (user: User, targetMode?: 'master_portal' | 'app') => {
    localStorage.removeItem('fin_logged_out');
    localStorage.setItem('fin_current_user', JSON.stringify(user));
    localStorage.setItem('fin_last_activity', String(Date.now()));
    sessionStorage.setItem('fin_session_active', 'true');
    sessionStorage.removeItem('fin_inactivity_reason');
    setCurrentUser(user);
    setHasSelectedCompany(true);
    localStorage.setItem('fin_has_selected_company', 'true');
    const mode = targetMode || 'app';
    setMasterScreenMode(mode);
    localStorage.setItem('fin_master_screen_mode', mode);
  };

  const handleLogout = (customReason?: string) => {
    localStorage.setItem('fin_logged_out', 'true');
    localStorage.removeItem('fin_current_user');
    localStorage.removeItem('fin_last_activity');
    sessionStorage.removeItem('fin_session_active');
    if (customReason) {
      sessionStorage.setItem('fin_inactivity_reason', customReason);
    }
    setHasSelectedCompany(false);
    setCurrentUser(null);
  };

  // Monitoramento Ativo de Inatividade e Auto-Bloqueio
  const {
    showWarning: showInactivityWarning,
    countdown: inactivityCountdown,
    extendSession: extendInactivitySession,
  } = useInactivityTimeout({
    timeoutMinutes: inactivityTimeoutMinutes,
    warningSeconds: 60,
    requireLoginOnReopen,
    onTimeout: (reason) => {
      handleLogout(reason);
    },
    isEnabled: Boolean(currentUser),
  });

  const handleUpdateInactivityTimeout = (minutes: number) => {
    setInactivityTimeoutMinutes(minutes);
    try {
      localStorage.setItem('fin_inactivity_timeout_minutes', String(minutes));
    } catch (e) {}
  };

  const handleUpdateRequireLoginOnReopen = (require: boolean) => {
    setRequireLoginOnReopen(require);
    try {
      localStorage.setItem('fin_require_login_on_reopen', String(require));
    } catch (e) {}
  };

  const handleRegisterUser = (
    nome: string,
    email: string,
    senha: string,
    telefone: string,
    empresaSolicitada: string,
    cnpjSolicitado?: string
  ) => {
    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
    if (existing) {
      return { success: false, error: 'Já existe um usuário cadastrado ou com solicitação pendente para este e-mail.' };
    }

    const nextId = users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;
    const newUser: User = {
      id: nextId,
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      senha_hash: hashPassword(senha),
      acesso_todas_empresas: false,
      status: 'pendente',
      role: 'admin',
      is_master: false,
      telefone: telefone.trim(),
      empresa_solicitada: empresaSolicitada.trim(),
      cnpj_solicitado: cnpjSolicitado?.trim() || undefined,
      criado_em: new Date().toISOString().split('T')[0],
    };

    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    localStorage.setItem('fin_users', JSON.stringify(updatedUsers));

    // 1. Grava no endpoint público do servidor para garantir persistência no system_store.json
    registerPublicUserRequest({
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      senha,
      telefone: telefone.trim(),
      empresaSolicitada: empresaSolicitada.trim(),
      cnpjSolicitado: cnpjSolicitado?.trim() || undefined,
    }).catch((e) => console.warn('Aviso ao registrar via endpoint público:', e));

    // 2. Persiste snapshot local imediatamente no servidor central
    saveServerSystemStore({
      hasCustomData: true,
      companies,
      accounts,
      users: updatedUsers,
      userCompanies,
      bankAccounts,
      costCenters,
      tenants,
      auditLogs,
      source: 'user_registration',
    }).catch((err) => console.warn('Erro ao salvar novo usuário no server store:', err));

    // 3. Persiste no Firestore
    saveCloudUser(newUser).catch((err) => console.warn('Erro ao salvar usuário pendente na nuvem:', err));

    saveCloudAuditLog({
      acao: 'CRIACAO',
      entidade: 'usuario',
      entidade_id: nextId,
      usuario_id: nextId,
      usuario_nome: nome.trim(),
      empresa_id: 0,
      descricao: `Nova solicitação de acesso cadastrada: "${nome.trim()}" (${email.trim()}) - Empresa: "${empresaSolicitada.trim()}"`,
      detalhes: { email, telefone, empresaSolicitada, cnpjSolicitado },
    }).catch((e) => console.warn('Audit log error:', e));

    return { success: true, user: newUser };
  };

  // Master Approval / Rejection Handlers with Guaranteed Dedicated Tenant Isolation
  const handleApproveUser = async (
    userId: number,
    companyAction: 'create_new' | 'link_existing' | 'all_companies',
    companyData?: { name: string; cnpj?: string; existingCompanyId?: number },
    role: UserRole = 'admin',
    customPermissions?: Partial<UserPermissions>
  ) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    let targetCompanyId: number | null = null;
    let targetTenantId: number = Number(target.tenant_id || 0);

    const cloudTasks: Promise<any>[] = [];

    let createdTenant: Tenant | null = null;
    let createdCompany: Company | null = null;
    let createdBank: BankAccount | null = null;
    let createdCC: CostCenter | null = null;
    let createdLink: UserCompanyLink | null = null;

    if (companyAction === 'create_new') {
      const nextTenantId = Date.now();
      targetTenantId = nextTenantId;

      const newTenant: Tenant = {
        id: nextTenantId,
        nome: companyData?.name?.trim() || target.empresa_solicitada || `Empresa de ${target.nome.split(' ')[0]}`,
        email: target.email,
        status: 'ativo',
        expiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        plano: 'Profissional',
        limite_empresas: 5,
        limite_usuarios: 10,
        valor_mensal: 299.90,
        criado_em: new Date().toISOString().split('T')[0],
        observacoes: 'Cliente SaaS aprovado pelo Master com isolamento total',
      };
      createdTenant = newTenant;
      setTenants((prev) => [...prev, newTenant]);
      cloudTasks.push(saveCloudTenant(newTenant).catch((err) => console.warn('Erro ao criar tenant na nuvem:', err)));

      const nextCompId = Date.now() + 10;
      const newCompany: Company = {
        id: nextCompId,
        tenant_id: nextTenantId,
        nome: companyData?.name?.trim() || target.empresa_solicitada || `Matriz ${target.nome.split(' ')[0]}`,
        cnpj: companyData?.cnpj?.trim() || target.cnpj_solicitado || undefined,
        criado_em: new Date().toISOString().split('T')[0],
      };
      createdCompany = newCompany;
      setCompanies((prev) => [...prev, newCompany]);
      cloudTasks.push(saveCloudCompany(newCompany).catch((err) => console.warn('Erro ao criar empresa aprovada:', err)));
      targetCompanyId = nextCompId;

      // Create default Bank Account & Cost Center for this new isolated tenant
      const newBank: BankAccount = {
        id: Date.now() + 20,
        tenant_id: nextTenantId,
        empresa_id: nextCompId,
        nome_banco: 'Conta Corrente Principal',
        tipo_conta: 'corrente',
        saldo_inicial: 0,
        padrao: true,
        descricao: 'Conta operacional principal',
        criado_em: new Date().toISOString().split('T')[0],
      };
      createdBank = newBank;
      setBankAccounts((prev) => [...prev, newBank]);
      cloudTasks.push(saveCloudBankAccount(newBank).catch((err) => console.warn('Erro ao criar conta bancária inicial:', err)));

      const newCC: CostCenter = {
        id: Date.now() + 30,
        tenant_id: nextTenantId,
        empresa_id: nextCompId,
        nome: 'Geral & Operacional',
        codigo: 'CC-01',
        descricao: 'Centro de custos geral',
        criado_em: new Date().toISOString().split('T')[0],
      };
      createdCC = newCC;
      setCostCenters((prev) => [...prev, newCC]);
      cloudTasks.push(saveCloudCostCenter(newCC).catch((err) => console.warn('Erro ao criar centro de custo inicial:', err)));
    } else if (companyAction === 'link_existing' && companyData?.existingCompanyId) {
      targetCompanyId = companyData.existingCompanyId;
      const existingComp = companies.find((c) => Number(c.id) === Number(targetCompanyId));
      if (existingComp) {
        targetTenantId = Number(existingComp.tenant_id || 1);
      }
    }

    const updatedUser: User = {
      ...target,
      tenant_id: targetTenantId || 1,
      status: 'ativo',
      role,
      permissions: customPermissions ? { ...(target.permissions || {}), ...customPermissions } : target.permissions,
      acesso_todas_empresas: companyAction === 'all_companies' || companyAction === 'create_new',
      aprovado_por: currentUser?.nome || 'Admin Master',
      aprovado_em: new Date().toISOString(),
      motivo_recusa: undefined,
    };

    const nextUsersList = users.map((u) => (u.id === userId ? updatedUser : u));
    setUsers(nextUsersList);
    localStorage.setItem('fin_users', JSON.stringify(nextUsersList));
    cloudTasks.push(saveCloudUser(updatedUser).catch((err) => console.warn('Erro ao aprovar usuário na nuvem:', err)));

    if (targetCompanyId && companyAction !== 'all_companies') {
      const nextLinkId = Date.now() + Math.floor(Math.random() * 1000);
      const newLink: UserCompanyLink = {
        id: nextLinkId,
        tenant_id: targetTenantId,
        usuario_id: userId,
        empresa_id: targetCompanyId,
      };
      createdLink = newLink;
      setUserCompanies((prev) => [
        ...prev.filter((uc) => Number(uc.usuario_id) !== Number(userId)),
        newLink,
      ]);
      cloudTasks.push(
        saveCloudUserCompanyLinks(userId, [targetCompanyId]).catch((err) =>
          console.warn('Erro ao vincular empresa para usuário aprovado:', err)
        )
      );
    }

    // Persiste imediatamente no servidor central (system_store.json)
    saveServerSystemStore({
      hasCustomData: true,
      companies: createdCompany ? [...companies, createdCompany] : companies,
      accounts,
      users: nextUsersList,
      userCompanies: createdLink ? [...userCompanies.filter((uc) => Number(uc.usuario_id) !== Number(userId)), createdLink] : userCompanies,
      bankAccounts: createdBank ? [...bankAccounts, createdBank] : bankAccounts,
      costCenters: createdCC ? [...costCenters, createdCC] : costCenters,
      tenants: createdTenant ? [...tenants, createdTenant] : tenants,
      auditLogs,
      source: 'master_approval',
    }).catch((err) => console.warn('Erro ao persistir aprovação no servidor central:', err));

    cloudTasks.push(
      saveCloudAuditLog({
        acao: 'EDICAO',
        entidade: 'usuario',
        entidade_id: userId,
        tenant_id: targetTenantId,
        usuario_id: currentUser ? currentUser.id : 1,
        usuario_nome: currentUser ? currentUser.nome : 'Admin Master',
        empresa_id: targetCompanyId || 0,
        descricao: `Aprovou o acesso do usuário "${target.nome}" (${target.email}) com isolamento dedicado no Cliente SaaS #${targetTenantId}`,
        detalhes: { companyAction, targetCompanyId, targetTenantId, role, customPermissions },
      }).catch((e) => console.warn('Audit log error:', e))
    );

    // Executa todas as gravações no Firestore em paralelo e de forma ultra-rápida.
    // Timeout máximo de 500ms para a resposta do modal, continuando em background se a rede oscilar.
    await Promise.race([
      Promise.allSettled(cloudTasks),
      new Promise((resolve) => setTimeout(resolve, 400)),
    ]);
  };

  const handleUpdateUserGranularPermissions = async (
    userId: number,
    permissions: Partial<UserPermissions>,
    role?: UserRole
  ) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    const updatedUser: User = {
      ...target,
      ...(role ? { role } : {}),
      permissions: {
        ...(target.permissions || {}),
        ...permissions,
      },
    };

    setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));
    if (currentUser && Number(currentUser.id) === Number(userId)) {
      setCurrentUser(updatedUser);
    }
    Promise.allSettled([
      saveCloudUser(updatedUser).catch((err) => console.warn('Erro ao atualizar permissões:', err)),
      saveCloudAuditLog({
        acao: 'EDICAO',
        entidade: 'usuario',
        entidade_id: userId,
        usuario_id: currentUser ? currentUser.id : 1,
        usuario_nome: currentUser ? currentUser.nome : 'Admin Master',
        empresa_id: 0,
        descricao: `Atualizou permissões e menus de "${target.nome}" (Perfil: ${(role || target.role || 'admin').toUpperCase()})`,
        detalhes: { permissions, role },
      }).catch((e) => console.warn('Audit log error:', e)),
    ]);
  };

  const handleRejectUser = async (userId: number, motivo?: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    const updatedUser: User = {
      ...target,
      status: 'rejeitado',
      motivo_recusa: motivo || 'Acesso não autorizado pelo Administrador Master.',
    };

    setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));
    Promise.allSettled([
      saveCloudUser(updatedUser).catch((err) => console.warn('Erro ao rejeitar usuário na nuvem:', err)),
      saveCloudAuditLog({
        acao: 'EDICAO',
        entidade: 'usuario',
        entidade_id: userId,
        usuario_id: currentUser ? currentUser.id : 1,
        usuario_nome: currentUser ? currentUser.nome : 'Admin Master',
        empresa_id: 0,
        descricao: `Rejeitou a solicitação de acesso de "${target.nome}" (${target.email})${motivo ? `: ${motivo}` : ''}`,
        detalhes: { motivo },
      }).catch((e) => console.warn('Audit log error:', e)),
    ]);
  };

  const handleUpdateUserStatus = async (userId: number, status: UserStatus) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    const updatedUser: User = { ...target, status };
    setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));
    Promise.allSettled([
      saveCloudUser(updatedUser).catch((err) => console.warn('Erro ao atualizar status na nuvem:', err)),
      saveCloudAuditLog({
        acao: 'EDICAO',
        entidade: 'usuario',
        entidade_id: userId,
        usuario_id: currentUser ? currentUser.id : 1,
        usuario_nome: currentUser ? currentUser.nome : 'Admin Master',
        empresa_id: 0,
        descricao: `Alterou status do usuário "${target.nome}" para "${status.toUpperCase()}"`,
        detalhes: { status },
      }).catch((e) => console.warn('Audit log error:', e)),
    ]);
  };

  const handleUpdateUserRole = async (userId: number, role: UserRole, isMaster: boolean) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    const updatedUser: User = { ...target, role, is_master: isMaster };
    setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));
    Promise.allSettled([
      saveCloudUser(updatedUser).catch((err) => console.warn('Erro ao atualizar cargo na nuvem:', err)),
      saveCloudAuditLog({
        acao: 'EDICAO',
        entidade: 'usuario',
        entidade_id: userId,
        usuario_id: currentUser ? currentUser.id : 1,
        usuario_nome: currentUser ? currentUser.nome : 'Admin Master',
        empresa_id: 0,
        descricao: `Alterou perfil de "${target.nome}" para "${role.toUpperCase()}" (Master: ${isMaster ? 'Sim' : 'Não'})`,
        detalhes: { role, isMaster },
      }).catch((e) => console.warn('Audit log error:', e)),
    ]);
  };

  const handleResetUserPassword = async (userId: number, novaSenhaPlain: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    const updatedUser: User = { ...target, senha_hash: hashPassword(novaSenhaPlain) };
    setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));
    Promise.allSettled([
      saveCloudUser(updatedUser).catch((err) => console.warn('Erro ao resetar senha na nuvem:', err)),
      saveCloudAuditLog({
        acao: 'EDICAO',
        entidade: 'usuario',
        entidade_id: userId,
        usuario_id: currentUser ? currentUser.id : 1,
        usuario_nome: currentUser ? currentUser.nome : 'Admin Master',
        empresa_id: 0,
        descricao: `Redefiniu a senha de acesso do usuário "${target.nome}" (${target.email})`,
      }).catch((e) => console.warn('Audit log error:', e)),
    ]);
  };

  const handleAddUserFromModal = (
    nome: string,
    email: string,
    senha: string,
    acessoTodas: boolean,
    companyIds: number[]
  ) => {
    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
    if (existing) {
      return { success: false, error: 'Já existe um usuário cadastrado com este e-mail.' };
    }

    const nextId = users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;
    const newUser: User = {
      id: nextId,
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      senha_hash: hashPassword(senha),
      acesso_todas_empresas: acessoTodas,
      status: 'ativo',
      role: 'admin',
      is_master: false,
      criado_em: new Date().toISOString().split('T')[0],
    };

    setUsers((prev) => [...prev, newUser]);
    saveCloudUser(newUser).catch((err) => console.warn('Erro ao salvar usuário na nuvem:', err));

    if (!acessoTodas && companyIds.length > 0) {
      const nextLinkId = userCompanies.length > 0 ? Math.max(...userCompanies.map((uc) => uc.id)) + 1 : 1;
      const newLinks: UserCompanyLink[] = companyIds.map((cId, idx) => ({
        id: nextLinkId + idx,
        usuario_id: nextId,
        empresa_id: cId,
      }));
      setUserCompanies((prev) => [...prev, ...newLinks]);
      saveCloudUserCompanyLinks(nextId, companyIds).catch((err) => console.warn('Erro ao salvar permissões na nuvem:', err));
    }

    return { success: true, error: undefined };
  };

  const handleEditUser = (
    userId: number,
    data: {
      nome: string;
      email: string;
      senha?: string;
      acessoTodas: boolean;
      companyIds: number[];
    }
  ) => {
    const existing = users.find((u) => u.id !== userId && u.email.toLowerCase() === data.email.toLowerCase().trim());
    if (existing) {
      return { success: false, error: 'Já existe outro usuário com este e-mail.' };
    }

    const currentTarget = users.find((u) => u.id === userId);
    if (!currentTarget) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    const updatedUser: User = {
      ...currentTarget,
      nome: data.nome.trim(),
      email: data.email.trim().toLowerCase(),
      senha_hash: data.senha ? hashPassword(data.senha) : currentTarget.senha_hash,
      acesso_todas_empresas: data.acessoTodas,
    };

    setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));
    if (currentUser && currentUser.id === userId) {
      setCurrentUser(updatedUser);
    }
    saveCloudUser(updatedUser).catch((err) => console.warn('Erro ao atualizar usuário na nuvem:', err));

    // Update company permissions
    handleUpdateUserPermissions(userId, data.acessoTodas, data.companyIds);
    return { success: true };
  };

  const handleUpdateUserProfile = async (
    userId: number,
    data: { nome: string; email: string; senha?: string }
  ) => {
    const existing = users.find(
      (u) => Number(u.id) !== Number(userId) && u.email.toLowerCase() === data.email.toLowerCase().trim()
    );
    if (existing) {
      return { success: false, error: 'Já existe outro usuário cadastrado com este e-mail.' };
    }

    const currentTarget = users.find((u) => Number(u.id) === Number(userId));
    if (!currentTarget) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    const updatedUser: User = {
      ...currentTarget,
      nome: data.nome.trim(),
      email: data.email.trim().toLowerCase(),
      senha_hash: data.senha ? hashPassword(data.senha) : currentTarget.senha_hash,
    };

    setUsers((prev) => prev.map((u) => (Number(u.id) === Number(userId) ? updatedUser : u)));
    if (currentUser && Number(currentUser.id) === Number(userId)) {
      setCurrentUser(updatedUser);
    }
    await saveCloudUser(updatedUser).catch((err) => console.warn('Erro ao atualizar usuário na nuvem:', err));

    await saveCloudAuditLog({
      acao: 'EDICAO',
      entidade: 'usuario',
      entidade_id: userId,
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin Master',
      empresa_id: 0,
      descricao: `Atualizou os dados de perfil (Nome: "${updatedUser.nome}", E-mail: "${updatedUser.email}")`,
    }).catch((e) => console.warn('Audit log error:', e));

    return { success: true };
  };

  const handleUpdateUserPermissions = (
    userId: number,
    acessoTodas: boolean,
    companyIds: number[]
  ) => {
    let updatedUserObj: User | null = null;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = { ...u, acesso_todas_empresas: acessoTodas };
          updatedUserObj = updated;
          if (currentUser && currentUser.id === userId) {
            setCurrentUser(updated);
          }
          return updated;
        }
        return u;
      })
    );

    if (updatedUserObj) {
      saveCloudUser(updatedUserObj).catch((err) => console.warn('Erro ao atualizar usuário na nuvem:', err));
    }

    // Update company links
    setUserCompanies((prev) => {
      const filtered = prev.filter((uc) => Number(uc.usuario_id) !== Number(userId));
      if (acessoTodas) {
        saveCloudUserCompanyLinks(userId, []).catch((err) => console.warn('Erro ao atualizar permissões na nuvem:', err));
        return filtered;
      }

      const baseTime = Date.now();
      const newLinks: UserCompanyLink[] = companyIds.map((cId, idx) => ({
        id: baseTime + idx,
        usuario_id: userId,
        empresa_id: Number(cId),
      }));
      saveCloudUserCompanyLinks(userId, companyIds).catch((err) => console.warn('Erro ao atualizar permissões na nuvem:', err));
      return [...filtered, ...newLinks];
    });
  };

  const handleDeleteUser = async (userId: number) => {
    if (users.length <= 1) return;
    if (userId === 1 || userId === 2) {
      alert('Não é permitido excluir o usuário Administrador Master.');
      return;
    }

    const userToRemove = users.find((u) => u.id === userId);
    const nextUsers = users.filter((u) => u.id !== userId);
    const nextUserCompanies = userCompanies.filter((uc) => uc.usuario_id !== userId);

    // 1. Atualiza estado React e localStorage imediatamente
    setUsers(nextUsers);
    localStorage.setItem('fin_users', JSON.stringify(nextUsers));
    setUserCompanies(nextUserCompanies);
    localStorage.setItem('fin_user_companies', JSON.stringify(nextUserCompanies));

    if (currentUser && currentUser.id === userId) {
      const remaining = nextUsers[0] || null;
      setCurrentUser(remaining);
      if (remaining) {
        localStorage.setItem('fin_current_user', JSON.stringify(remaining));
      } else {
        localStorage.removeItem('fin_current_user');
      }
    }

    // 2. Exclui no servidor, Firestore e salva snapshot de forma paralela e não-bloqueante
    try {
      await Promise.race([
        Promise.allSettled([
          deleteServerUser(userId),
          deleteCloudUser(userId, userToRemove?.email),
          saveServerSystemStore({
            hasCustomData: true,
            companies,
            accounts,
            users: nextUsers,
            userCompanies: nextUserCompanies,
            bankAccounts,
            costCenters,
            tenants,
            auditLogs,
            deletedUserId: userId,
            source: 'master_user_delete',
          }),
        ]),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
    } catch (e) {
      console.warn('Erro ao sincronizar exclusão do usuário:', e);
    }

    // 3. Registra log de auditoria
    const newAuditLog: AuditLog = {
      id: `log_usr_del_${Date.now()}`,
      data_hora: new Date().toISOString(),
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Super Admin Master',
      acao: 'EXCLUSAO_DEFINITIVA',
      entidade: 'usuario',
      descricao: `Usuário "${userToRemove?.nome || `#${userId}`}" (${userToRemove?.email || ''}) excluído permanentemente.`,
      detalhes: { deletedUserId: userId, userName: userToRemove?.nome, userEmail: userToRemove?.email },
    };
    setAuditLogs((prev) => [newAuditLog, ...prev]);
  };

  // Financial Accounts Handlers with Audit Logs & Soft Delete
  const handleAddAccount = (newAcc: Omit<FinancialAccount, 'id'>) => {
    const uniqueId = Date.now() + Math.floor(Math.random() * 1000);
    const targetComp = companies.find((c) => Number(c.id) === Number(newAcc.empresa_id));
    const targetTenantId = Number(newAcc.tenant_id || targetComp?.tenant_id || currentUser?.tenant_id || 1);

    const accountToAdd: FinancialAccount = {
      ...newAcc,
      id: uniqueId,
      tenant_id: targetTenantId,
      empresa_id: Number(newAcc.empresa_id),
      valor: Number(newAcc.valor),
      criado_por: currentUser?.nome || 'Admin',
      criado_em: new Date().toISOString(),
      excluido: false,
    };
    setAccounts((prev) => [accountToAdd, ...prev]);
    saveServerAccount(accountToAdd).catch((err) => console.warn('Erro ao salvar conta no servidor central:', err));
    saveCloudAccount(accountToAdd).catch((err) => console.warn('Erro ao salvar conta na nuvem:', err));

    // Audit Log
    saveCloudAuditLog({
      acao: 'CRIACAO',
      entidade: 'conta',
      entidade_id: uniqueId,
      tenant_id: targetTenantId,
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin',
      empresa_id: accountToAdd.empresa_id,
      descricao: `Criou o lançamento "${accountToAdd.descricao}" no valor de R$ ${accountToAdd.valor.toFixed(2)} (${accountToAdd.tipo === 'pagar' ? 'A Pagar' : 'A Receber'})`,
      detalhes: { account: accountToAdd },
    }).catch((e) => console.warn('Audit log error:', e));
  };

  const handleEditAccount = (updatedAcc: FinancialAccount) => {
    const sanitized: FinancialAccount = {
      ...updatedAcc,
      id: Number(updatedAcc.id),
      empresa_id: Number(updatedAcc.empresa_id),
      valor: Number(updatedAcc.valor),
      atualizado_por: currentUser?.nome || 'Admin',
      atualizado_em: new Date().toISOString(),
    };
    setAccounts((prev) => prev.map((a) => (Number(a.id) === Number(sanitized.id) ? sanitized : a)));
    saveServerAccount(sanitized).catch((err) => console.warn('Erro ao atualizar conta no servidor central:', err));
    saveCloudAccount(sanitized).catch((err) => console.warn('Erro ao editar conta na nuvem:', err));

    // Audit Log
    saveCloudAuditLog({
      acao: 'EDICAO',
      entidade: 'conta',
      entidade_id: sanitized.id,
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin',
      empresa_id: sanitized.empresa_id,
      descricao: `Editou o lançamento "${sanitized.descricao}" (Valor: R$ ${sanitized.valor.toFixed(2)}, Venc: ${sanitized.data_vencimento})`,
      detalhes: { account: sanitized },
    }).catch((e) => console.warn('Audit log error:', e));
  };

  const handleToggleStatus = (id: number) => {
    let updatedAcc: FinancialAccount | null = null;
    setAccounts((prev) =>
      prev.map((acc) => {
        if (Number(acc.id) === Number(id)) {
          const updated: FinancialAccount = acc.tipo === 'pagar'
            ? { ...acc, status: acc.status === 'Pago' ? 'Pendente' : 'Pago', atualizado_por: currentUser?.nome || 'Admin', atualizado_em: new Date().toISOString() }
            : { ...acc, status: acc.status === 'Recebido' ? 'Pendente' : 'Recebido', atualizado_por: currentUser?.nome || 'Admin', atualizado_em: new Date().toISOString() };
          updatedAcc = updated;
          saveCloudAccount(updated).catch((err) => console.warn('Erro ao alternar status na nuvem:', err));
          return updated;
        }
        return acc;
      })
    );

    if (updatedAcc) {
      const ua = updatedAcc as FinancialAccount;
      const isSettled = ua.status === 'Pago' || ua.status === 'Recebido';
      saveCloudAuditLog({
        acao: isSettled ? 'BAIXA_PAGAMENTO' : 'REVERSAO_PAGAMENTO',
        entidade: 'conta',
        entidade_id: ua.id,
        usuario_id: currentUser ? currentUser.id : 1,
        usuario_nome: currentUser ? currentUser.nome : 'Admin',
        empresa_id: ua.empresa_id,
        descricao: `Alterou status do lançamento "${ua.descricao}" para "${ua.status}"`,
        detalhes: { status: ua.status },
      }).catch((e) => console.warn('Audit log error:', e));
    }
  };

  const handleAccountReconciled = async (
    accountId: number,
    txId: string,
    provider: string,
    saldoRecalculado?: any,
    accountData?: Partial<FinancialAccount>
  ) => {
    let affectedCompanyId: number | undefined = accountData?.empresa_id;

    setAccounts((prev) => {
      const exists = prev.some((acc) => Number(acc.id) === Number(accountId));
      if (exists) {
        return prev.map((acc) => {
          if (Number(acc.id) === Number(accountId)) {
            affectedCompanyId = acc.empresa_id;
            const newStatus = (accountData?.status || (acc.tipo === 'receber' ? 'Recebido' : 'Pago')) as AccountStatus;
            const newValor =
              accountData?.valor !== undefined && Number(accountData.valor) > 0
                ? Number(accountData.valor)
                : acc.valor;
            const updated: FinancialAccount = {
              ...acc,
              ...(accountData || {}),
              id: Number(acc.id),
              status: newStatus,
              valor: newValor,
              conciliado: true,
              conciliado_em: accountData?.conciliado_em || new Date().toISOString(),
              conciliado_fitid: txId,
              conciliado_por: `Webhook ${provider}`,
              banco_origem: provider,
              atualizado_por: `Webhook ${provider}`,
              atualizado_em: new Date().toISOString(),
            };
            saveCloudAccount(updated).catch((err) => console.warn('Erro ao salvar conta conciliada:', err));
            return updated;
          }
          return acc;
        });
      } else {
        // Nova conta criada via webhook
        const effectiveCompId = Number(
          accountData?.empresa_id ||
            (selectedCompanyId === -1 ? permittedCompanies[0]?.id || 1 : selectedCompanyId)
        );
        affectedCompanyId = effectiveCompId;
        const newAcc: FinancialAccount = {
          id: Number(accountId),
          tenant_id: Number(accountData?.tenant_id || currentUser?.tenant_id || 1),
          empresa_id: effectiveCompId,
          tipo: (accountData?.tipo || 'receber') as 'pagar' | 'receber',
          descricao: accountData?.descricao || `Lançamento Webhook ${provider}`,
          valor: Number(accountData?.valor || 0),
          data_vencimento: accountData?.data_vencimento || new Date().toISOString().split('T')[0],
          status: (accountData?.status || (accountData?.tipo === 'pagar' ? 'Pago' : 'Recebido')) as AccountStatus,
          categoria: accountData?.categoria || 'Geral',
          documento_ref: accountData?.documento_ref,
          banco_origem: provider,
          conciliado: true,
          conciliado_em: accountData?.conciliado_em || new Date().toISOString(),
          conciliado_fitid: txId,
          conciliado_por: `Webhook ${provider}`,
          criado_por: `Webhook ${provider}`,
          criado_em: new Date().toISOString(),
          atualizado_por: `Webhook ${provider}`,
          atualizado_em: new Date().toISOString(),
          excluido: false,
        };
        saveCloudAccount(newAcc).catch((err) => console.warn('Erro ao salvar nova conta conciliada:', err));
        return [newAcc, ...prev];
      }
    });

    // Atualizar estado de saldos da empresa caso tenha vindo do backend ou via recálculo
    if (saldoRecalculado && (saldoRecalculado.empresa_id || saldoRecalculado.empresaId)) {
      const compId = Number(saldoRecalculado.empresa_id || saldoRecalculado.empresaId);
      setCompanies((prev) =>
        prev.map((comp) =>
          comp.id === compId
            ? {
                ...comp,
                saldo_atual: saldoRecalculado.saldo_atual,
                saldo_projetado: saldoRecalculado.saldo_projetado,
                total_receitas_pagas: saldoRecalculado.total_receitas_pagas,
                total_despesas_pagas: saldoRecalculado.total_despesas_pagas,
                atualizado_em: saldoRecalculado.atualizado_em || new Date().toISOString(),
              }
            : comp
        )
      );
    } else if (affectedCompanyId) {
      recalcularSaldoTotal(affectedCompanyId)
        .then((res) => {
          setCompanies((prev) =>
            prev.map((comp) =>
              comp.id === affectedCompanyId
                ? {
                    ...comp,
                    saldo_atual: res.saldo_atual,
                    saldo_projetado: res.saldo_projetado,
                    total_receitas_pagas: res.total_receitas_pagas,
                    total_despesas_pagas: res.total_despesas_pagas,
                  }
                : comp
            )
          );
        })
        .catch((e) => console.warn('Erro ao recalcular saldo:', e));
    }
  };

  // Liquidação de Contas a Pagar via API Bancária Direta (BB / Stone)
  const handlePaymentSuccessViaBank = (result: {
    accountId: number;
    updatedAccount: FinancialAccount;
    saldoRecalculado?: any;
    comprovanteId: string;
    providerName: string;
  }) => {
    setAccounts((prev) =>
      prev.map((acc) => (Number(acc.id) === Number(result.accountId) ? result.updatedAccount : acc))
    );

    if (result.saldoRecalculado && (result.saldoRecalculado.empresa_id || result.saldoRecalculado.empresaId)) {
      const compId = Number(result.saldoRecalculado.empresa_id || result.saldoRecalculado.empresaId);
      setCompanies((prev) =>
        prev.map((c) =>
          Number(c.id) === compId
            ? {
                ...c,
                saldo_atual: result.saldoRecalculado.saldo_atual,
                saldo_projetado: result.saldoRecalculado.saldo_projetado,
                total_despesas_pagas: result.saldoRecalculado.total_despesas_pagas,
                total_receitas_pagas: result.saldoRecalculado.total_receitas_pagas,
                atualizado_em: result.saldoRecalculado.atualizado_em || new Date().toISOString(),
              }
            : c
        )
      );
    }
  };

  // Soft Delete: Move to Trash instead of immediate physical destruction
  const handleDeleteAccount = (id: number) => {
    const targetId = Number(id);
    let targetAcc: FinancialAccount | null = null;
    let nextAccounts: FinancialAccount[] = [];

    setAccounts((prev) => {
      nextAccounts = prev.map((acc) => {
        if (Number(acc.id) === targetId) {
          const softDeleted: FinancialAccount = {
            ...acc,
            excluido: true,
            excluido_em: new Date().toISOString(),
            excluido_por: currentUser?.nome || 'Admin',
          };
          targetAcc = softDeleted;
          return softDeleted;
        }
        return acc;
      });
      return nextAccounts;
    });

    recentlyDeletedAccountsRef.current.set(targetId, Date.now());
    if (nextAccounts.length > 0) {
      localStorage.setItem('fin_accounts', JSON.stringify(nextAccounts));
    }

    // 1. Chamar rota dedicada de exclusão no servidor central imediatamente
    deleteServerAccount(targetId, false).catch((err) =>
      console.warn('Erro ao mover conta para lixeira no servidor:', err)
    );

    // 2. Persistir snapshot no servidor imediatamente
    saveServerSystemStore({
      hasCustomData: true,
      companies,
      accounts: nextAccounts,
      users,
      userCompanies,
      bankAccounts,
      costCenters,
      tenants,
      auditLogs,
      source: 'account_soft_delete_instant',
    }).catch((e) => console.warn('Erro ao salvar snapshot após soft-delete:', e));

    if (targetAcc) {
      const ta = targetAcc as FinancialAccount;
      saveCloudAccount(ta).catch((err) => console.warn('Erro ao mover conta para a lixeira na nuvem:', err));
      saveCloudAuditLog({
        acao: 'EXCLUSAO_LIXEIRA',
        entidade: 'conta',
        entidade_id: targetId,
        usuario_id: currentUser ? currentUser.id : 1,
        usuario_nome: currentUser ? currentUser.nome : 'Admin',
        empresa_id: ta.empresa_id,
        descricao: `Moveu o lançamento "${ta.descricao}" para a lixeira (Soft Delete - recuperável em 30 dias)`,
        detalhes: { account: ta },
      }).catch((e) => console.warn('Audit log error:', e));
    }
  };

  // Trash Bin Handlers (Recovery & Permanent Delete)
  const handleRestoreAccount = (id: number) => {
    const targetId = Number(id);
    let restoredAcc: FinancialAccount | null = null;
    let nextAccounts: FinancialAccount[] = [];

    setAccounts((prev) => {
      nextAccounts = prev.map((acc) => {
        if (Number(acc.id) === targetId) {
          const restored: FinancialAccount = {
            ...acc,
            excluido: false,
            excluido_em: undefined,
            excluido_por: undefined,
            atualizado_por: currentUser?.nome || 'Admin',
            atualizado_em: new Date().toISOString(),
          };
          restoredAcc = restored;
          return restored;
        }
        return acc;
      });
      return nextAccounts;
    });

    recentlyDeletedAccountsRef.current.delete(targetId);
    if (nextAccounts.length > 0) {
      localStorage.setItem('fin_accounts', JSON.stringify(nextAccounts));
    }

    saveServerSystemStore({
      hasCustomData: true,
      companies,
      accounts: nextAccounts,
      users,
      userCompanies,
      bankAccounts,
      costCenters,
      tenants,
      auditLogs,
      source: 'account_restore_instant',
    }).catch((e) => console.warn('Erro ao salvar snapshot após restauração:', e));

    if (restoredAcc) {
      const ra = restoredAcc as FinancialAccount;
      saveCloudAccount(ra).catch((err) => console.warn('Erro ao restaurar conta na nuvem:', err));
      saveCloudAuditLog({
        acao: 'RESTAURACAO',
        entidade: 'conta',
        entidade_id: targetId,
        usuario_id: currentUser ? currentUser.id : 1,
        usuario_nome: currentUser ? currentUser.nome : 'Admin',
        empresa_id: ra.empresa_id,
        descricao: `Restaurou o lançamento "${ra.descricao}" da lixeira`,
        detalhes: { account: ra },
      }).catch((e) => console.warn('Audit log error:', e));
    }
  };

  const handleRestoreAllAccounts = () => {
    const deletedList = accounts.filter((a) => a.excluido);
    if (deletedList.length === 0) return;

    const restoredList = deletedList.map((acc) => ({
      ...acc,
      excluido: false,
      excluido_em: undefined,
      excluido_por: undefined,
      atualizado_por: currentUser?.nome || 'Admin',
      atualizado_em: new Date().toISOString(),
    }));

    let nextAccounts: FinancialAccount[] = [];
    setAccounts((prev) => {
      nextAccounts = prev.map((acc) => {
        const match = restoredList.find((r) => r.id === acc.id);
        return match || acc;
      });
      return nextAccounts;
    });

    deletedList.forEach((a) => recentlyDeletedAccountsRef.current.delete(Number(a.id)));
    if (nextAccounts.length > 0) {
      localStorage.setItem('fin_accounts', JSON.stringify(nextAccounts));
    }

    saveServerSystemStore({
      hasCustomData: true,
      companies,
      accounts: nextAccounts,
      users,
      userCompanies,
      bankAccounts,
      costCenters,
      tenants,
      auditLogs,
      source: 'accounts_restore_all_instant',
    }).catch((e) => console.warn('Erro ao salvar snapshot após restauração geral:', e));

    saveCloudAccountsBatch(restoredList).catch((err) => console.warn('Erro ao restaurar lote na nuvem:', err));

    saveCloudAuditLog({
      acao: 'RESTAURACAO',
      entidade: 'conta',
      entidade_id: 0,
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin',
      empresa_id: 0,
      descricao: `Restaurou todos os ${deletedList.length} lançamentos que estavam na lixeira`,
      detalhes: { count: deletedList.length },
    }).catch((e) => console.warn('Audit log error:', e));
  };

  const handlePermanentDeleteAccount = (id: number) => {
    const targetId = Number(id);
    const targetAcc = accounts.find((a) => Number(a.id) === targetId);
    const nextAccounts = accounts.filter((acc) => Number(acc.id) !== targetId);

    setAccounts(nextAccounts);
    localStorage.setItem('fin_accounts', JSON.stringify(nextAccounts));
    recentlyDeletedAccountsRef.current.set(targetId, Date.now());

    // 1. Chamar rota dedicada de exclusão definitiva no servidor imediatamente
    deleteServerAccount(targetId, true).catch((err) =>
      console.warn('Erro ao excluir definitivamente no servidor:', err)
    );

    // 2. Salvar snapshot atualizado no servidor com deletedAccountId
    saveServerSystemStore({
      hasCustomData: true,
      companies,
      accounts: nextAccounts,
      users,
      userCompanies,
      bankAccounts,
      costCenters,
      tenants,
      auditLogs,
      deletedAccountId: targetId,
      source: 'account_permanent_delete_instant',
    }).catch((e) => console.warn('Erro ao salvar snapshot após delete definitivo:', e));

    deleteCloudAccount(targetId).catch((err) => console.warn('Erro ao excluir definitivamente na nuvem:', err));

    saveCloudAuditLog({
      acao: 'EXCLUSAO_DEFINITIVA',
      entidade: 'conta',
      entidade_id: targetId,
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin',
      empresa_id: targetAcc?.empresa_id || 0,
      descricao: `Excluiu definitivamente o lançamento "${targetAcc?.descricao || `#${targetId}`}" da lixeira`,
      detalhes: { account: targetAcc },
    }).catch((e) => console.warn('Audit log error:', e));
  };

  const handleEmptyTrash = () => {
    const deletedList = accounts.filter((a) => a.excluido);
    if (deletedList.length === 0) return;

    const nextAccounts = accounts.filter((a) => !a.excluido);
    const deletedIds = deletedList.map((a) => Number(a.id));

    setAccounts(nextAccounts);
    localStorage.setItem('fin_accounts', JSON.stringify(nextAccounts));
    deletedIds.forEach((id) => recentlyDeletedAccountsRef.current.set(id, Date.now()));

    // Excluir cada um no servidor central
    deletedIds.forEach((id) => {
      deleteServerAccount(id, true).catch(() => {});
    });

    saveServerSystemStore({
      hasCustomData: true,
      companies,
      accounts: nextAccounts,
      users,
      userCompanies,
      bankAccounts,
      costCenters,
      tenants,
      auditLogs,
      deletedAccountIds: deletedIds,
      source: 'accounts_empty_trash_instant',
    }).catch((e) => console.warn('Erro ao salvar após esvaziar lixeira:', e));

    deletedList.forEach((acc) => {
      deleteCloudAccount(acc.id).catch((err) => console.warn('Erro ao esvaziar lixeira na nuvem:', err));
    });

    saveCloudAuditLog({
      acao: 'LIXEIRA_ESVAZIADA',
      entidade: 'conta',
      entidade_id: 0,
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin',
      empresa_id: 0,
      descricao: `Esvaziou permanentemente a lixeira (${deletedList.length} itens removidos)`,
      detalhes: { count: deletedList.length },
    }).catch((e) => console.warn('Audit log error:', e));
  };

  // Backup & Restore Handlers
  const handleRestoreFullSnapshot = async (
    rawDados: SystemBackupSnapshot['dados'],
    mode: 'replace' | 'merge'
  ) => {
    lastRestoredTimestampRef.current = Date.now() + 60000;

    const userTenantId = Number(currentUser?.tenant_id || 1);

    // 1. Extrair e normalizar empresas
    const rawCompanies: any[] = Array.isArray(rawDados.companies) && rawDados.companies.length > 0 
      ? rawDados.companies 
      : ((rawDados as any).empresas || []);

    const normalizedCompanies: Company[] = rawCompanies.map((c, idx) => ({
      ...c,
      id: Number(c.id || idx + 1),
      nome: String(c.nome || c.name || `Empresa ${idx + 1}`),
      cnpj: c.cnpj ? String(c.cnpj) : '',
      tenant_id: (!isCurrentUserMaster && userTenantId) ? userTenantId : (c.tenant_id ? Number(c.tenant_id) : userTenantId),
    }));

    const defaultCompId = normalizedCompanies[0]?.id || 1;

    // 2. Extrair e normalizar movimentos / contas com suporte a todas as variações de chaves
    let rawAccs: any[] = [];
    if (Array.isArray(rawDados.accounts) && rawDados.accounts.length > 0) {
      rawAccs = rawDados.accounts;
    } else if (Array.isArray((rawDados as any).movimentos) && (rawDados as any).movimentos.length > 0) {
      rawAccs = (rawDados as any).movimentos;
    } else if (Array.isArray((rawDados as any).lancamentos) && (rawDados as any).lancamentos.length > 0) {
      rawAccs = (rawDados as any).lancamentos;
    } else if (Array.isArray((rawDados as any).contas) && (rawDados as any).contas.length > 0) {
      rawAccs = (rawDados as any).contas;
    } else if (Array.isArray((rawDados as any).transactions) && (rawDados as any).transactions.length > 0) {
      rawAccs = (rawDados as any).transactions;
    }

    const contasPagar = (rawDados as any).contas_a_pagar || [];
    const contasReceber = (rawDados as any).contas_a_receber || [];
    if (Array.isArray(contasPagar) && contasPagar.length > 0) {
      contasPagar.forEach((cp, i) => rawAccs.push({ ...cp, id: cp.id || `pag_${i}_${Date.now()}`, tipo: 'pagar' }));
    }
    if (Array.isArray(contasReceber) && contasReceber.length > 0) {
      contasReceber.forEach((cr, i) => rawAccs.push({ ...cr, id: cr.id || `rec_${i}_${Date.now()}`, tipo: 'receber' }));
    }

    const normalizedAccounts: FinancialAccount[] = rawAccs.map((a, idx) => {
      const tipoRaw = String(a.tipo || a.type || '').toLowerCase().trim();
      const isReceita = tipoRaw === 'receber' || tipoRaw === 'receita' || tipoRaw === 'recebimento' || tipoRaw === 'entrada';
      const statusRaw = String(a.status || '').toLowerCase().trim();
      let status: AccountStatus = 'Pendente';
      if (statusRaw === 'pago' || statusRaw === 'paga' || statusRaw === 'paid') {
        status = 'Pago';
      } else if (statusRaw === 'recebido' || statusRaw === 'recebida' || statusRaw === 'received') {
        status = 'Recebido';
      }

      const valorNum = typeof a.valor === 'number'
        ? Math.abs(a.valor)
        : (typeof a.value === 'number' ? Math.abs(a.value) : (parseFloat(String(a.valor || a.value || 0).replace(',', '.')) || 0));

      return {
        ...a,
        id: Number(a.id || Date.now() + idx),
        empresa_id: Number(a.empresa_id || a.company_id || defaultCompId),
        tenant_id: (!isCurrentUserMaster && userTenantId) ? userTenantId : (a.tenant_id ? Number(a.tenant_id) : userTenantId),
        tipo: isReceita ? 'receber' : 'pagar',
        status,
        descricao: String(a.descricao || a.description || a.titulo || a.nome || `Movimento #${idx + 1}`),
        valor: valorNum,
        data_vencimento: a.data_vencimento || a.vencimento || a.dueDate || a.data || new Date().toISOString().split('T')[0],
        categoria: String(a.categoria || a.category || 'Outros'),
        excluido: Boolean(a.excluido || a.deleted),
      };
    });

    // 3. Garantir vínculos de usuário para todas as empresas restauradas
    let targetUserCompanies = Array.isArray(rawDados.userCompanies) ? [...rawDados.userCompanies] : [...userCompanies];
    if (currentUser) {
      normalizedCompanies.forEach((comp) => {
        if (!targetUserCompanies.some(uc => Number(uc.usuario_id) === Number(currentUser.id) && Number(uc.empresa_id) === Number(comp.id))) {
          targetUserCompanies.push({
            id: Date.now() + Math.floor(Math.random() * 100000),
            usuario_id: currentUser.id,
            empresa_id: comp.id,
            tenant_id: userTenantId,
          });
        }
      });
    }

    // Preservar contas geradas por Webhooks e Integrações Bancárias (Stone, InfinitePay, BB) que possam não estar no backup antigo
    const currentWebhookAccounts = accounts.filter((a) =>
      String(a.criado_por || '').includes('Webhook') ||
      String(a.conciliado_por || '').includes('Webhook') ||
      Boolean(a.identificador_externo)
    );
    const finalNormalizedAccounts = [...normalizedAccounts];
    currentWebhookAccounts.forEach((wh) => {
      if (!finalNormalizedAccounts.some((a) => Number(a.id) === Number(wh.id))) {
        finalNormalizedAccounts.push(wh);
      }
    });

    const payloadForCloud: SystemBackupSnapshot['dados'] = {
      companies: normalizedCompanies,
      accounts: finalNormalizedAccounts,
      users: Array.isArray(rawDados.users) && rawDados.users.length > 0 ? rawDados.users : users,
      userCompanies: targetUserCompanies,
      bankAccounts: Array.isArray(rawDados.bankAccounts) ? rawDados.bankAccounts : bankAccounts,
      costCenters: Array.isArray(rawDados.costCenters) ? rawDados.costCenters : costCenters,
      tenants: Array.isArray(rawDados.tenants) ? rawDados.tenants : tenants,
      auditLogs: Array.isArray(rawDados.auditLogs) ? rawDados.auditLogs : auditLogs,
    };

    if (mode === 'replace') {
      if (normalizedCompanies.length > 0) {
        setCompanies(normalizedCompanies);
        localStorage.setItem('fin_companies', JSON.stringify(normalizedCompanies));
      }

      setAccounts(finalNormalizedAccounts);
      localStorage.setItem('fin_accounts', JSON.stringify(finalNormalizedAccounts));

      setUserCompanies(targetUserCompanies);
      localStorage.setItem('fin_user_companies', JSON.stringify(targetUserCompanies));

      if (Array.isArray(rawDados.bankAccounts)) {
        setBankAccounts(rawDados.bankAccounts);
        localStorage.setItem('fin_bank_accounts', JSON.stringify(rawDados.bankAccounts));
      }
      if (Array.isArray(rawDados.costCenters)) {
        setCostCenters(rawDados.costCenters);
        localStorage.setItem('fin_cost_centers', JSON.stringify(rawDados.costCenters));
      }
      if (Array.isArray(rawDados.users) && rawDados.users.length > 0) {
        setUsers(rawDados.users);
        localStorage.setItem('fin_users', JSON.stringify(rawDados.users));
      }
      if (Array.isArray(rawDados.tenants) && rawDados.tenants.length > 0) {
        setTenants(rawDados.tenants);
        localStorage.setItem('fin_tenants', JSON.stringify(rawDados.tenants));
      }
      if (Array.isArray(rawDados.auditLogs)) {
        setAuditLogs(rawDados.auditLogs);
        localStorage.setItem('fin_audit_logs', JSON.stringify(rawDados.auditLogs));
      }

      // Se houver mais de uma empresa, ativar Consolidado (-1) para que TODOS os movimentos apareçam imediatamente!
      if (normalizedCompanies.length > 1) {
        setSelectedCompanyId(-1);
        localStorage.setItem('fin_selected_company', '-1');
      } else if (normalizedCompanies.length === 1) {
        setSelectedCompanyId(normalizedCompanies[0].id);
        localStorage.setItem('fin_selected_company', String(normalizedCompanies[0].id));
      }
      setHasSelectedCompany(true);
      localStorage.setItem('fin_has_selected_company', 'true');
      setMasterScreenMode('app');
      localStorage.setItem('fin_master_screen_mode', 'app');

      // 1. Persistir no servidor central Node/Express para sincronização imediata com celular
      await saveServerSystemStore({
        ...payloadForCloud,
        hasCustomData: true,
        source: 'backup_restore_replace',
      });
      // 2. Sincronizar com Firestore caso ativo
      restoreFullCloudSnapshot(payloadForCloud).catch(() => {});
      setCloudSynced(true);
    } else {
      // Merge mode
      const mergedCompanies = [...companies];
      normalizedCompanies.forEach((comp) => {
        if (!mergedCompanies.some((c) => c.id === comp.id)) {
          mergedCompanies.push(comp);
        }
      });
      setCompanies(mergedCompanies);
      localStorage.setItem('fin_companies', JSON.stringify(mergedCompanies));

      const mergedAccounts = [...accounts];
      normalizedAccounts.forEach((acc) => {
        if (!mergedAccounts.some((a) => a.id === acc.id)) {
          mergedAccounts.push(acc);
        }
      });
      setAccounts(mergedAccounts);
      localStorage.setItem('fin_accounts', JSON.stringify(mergedAccounts));

      setUserCompanies(targetUserCompanies);
      localStorage.setItem('fin_user_companies', JSON.stringify(targetUserCompanies));

      const mergedBanks = [...bankAccounts];
      if (Array.isArray(rawDados.bankAccounts)) {
        rawDados.bankAccounts.forEach((b) => {
          if (!mergedBanks.some((existing) => existing.id === b.id)) {
            mergedBanks.push(b);
          }
        });
        setBankAccounts(mergedBanks);
        localStorage.setItem('fin_bank_accounts', JSON.stringify(mergedBanks));
      }

      const mergedCC = [...costCenters];
      if (Array.isArray(rawDados.costCenters)) {
        rawDados.costCenters.forEach((cc) => {
          if (!mergedCC.some((existing) => existing.id === cc.id)) {
            mergedCC.push(cc);
          }
        });
        setCostCenters(mergedCC);
        localStorage.setItem('fin_cost_centers', JSON.stringify(mergedCC));
      }

      const mergedUsers = [...users];
      if (Array.isArray(rawDados.users)) {
        rawDados.users.forEach((u) => {
          if (!mergedUsers.some((existing) => existing.id === u.id)) {
            mergedUsers.push(u);
          }
        });
        setUsers(mergedUsers);
        localStorage.setItem('fin_users', JSON.stringify(mergedUsers));
      }

      const mergedTenants = [...tenants];
      if (Array.isArray(rawDados.tenants)) {
        rawDados.tenants.forEach((t) => {
          if (!mergedTenants.some((existing) => existing.id === t.id)) {
            mergedTenants.push(t);
          }
        });
        setTenants(mergedTenants);
        localStorage.setItem('fin_tenants', JSON.stringify(mergedTenants));
      }

      setHasSelectedCompany(true);
      localStorage.setItem('fin_has_selected_company', 'true');
      setMasterScreenMode('app');
      localStorage.setItem('fin_master_screen_mode', 'app');

      // 1. Persistir no servidor central Node/Express para sincronização imediata com celular
      await saveServerSystemStore({
        companies: mergedCompanies,
        accounts: mergedAccounts,
        users: mergedUsers,
        userCompanies: targetUserCompanies,
        bankAccounts: mergedBanks,
        costCenters: mergedCC,
        tenants: mergedTenants,
        auditLogs: auditLogs,
        hasCustomData: true,
        source: 'backup_restore_merge',
      });
      // 2. Sincronizar dados mesclados com a nuvem Firestore caso ativo
      restoreFullCloudSnapshot({
        companies: mergedCompanies,
        accounts: mergedAccounts,
        users: mergedUsers,
        userCompanies: targetUserCompanies,
        bankAccounts: mergedBanks,
        costCenters: mergedCC,
        tenants: mergedTenants,
        auditLogs: auditLogs,
      }).catch(() => {});
      setCloudSynced(true);
    }

    saveCloudAuditLog({
      acao: 'BACKUP_RESTAURADO',
      entidade: 'sistema',
      entidade_id: 0,
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin',
      empresa_id: 0,
      descricao: `Restaurou snapshot de backup completo no modo "${mode === 'replace' ? 'Substituição Total' : 'Mesclagem'}"`,
      detalhes: { mode, counts: { companies: normalizedCompanies.length, accounts: normalizedAccounts.length } },
    }).catch((e) => console.warn('Audit log error:', e));
  };

  const handleLogBackupExport = () => {
    saveCloudAuditLog({
      acao: 'BACKUP_EXPORTADO',
      entidade: 'sistema',
      entidade_id: 0,
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin',
      empresa_id: 0,
      descricao: `Gerou e exportou snapshot de backup de segurança completo de todas as empresas e lançamentos`,
    }).catch((e) => console.warn('Audit log error:', e));
  };

  const handleClearAuditLogs = async () => {
    setAuditLogs([]);
    await clearAllCloudAuditLogs();
  };

  // Bulk Import Accounts from CSV/Excel
  const handleImportAccounts = (imported: Omit<FinancialAccount, 'id'>[]) => {
    const baseTime = Date.now();
    const newItems: FinancialAccount[] = imported.map((item, idx) => {
      const targetComp = companies.find((c) => Number(c.id) === Number(item.empresa_id));
      const targetTenantId = Number(item.tenant_id || targetComp?.tenant_id || currentUser?.tenant_id || 1);
      return {
        ...item,
        id: baseTime + idx,
        tenant_id: targetTenantId,
        empresa_id: Number(item.empresa_id),
        valor: Number(item.valor),
        criado_por: currentUser?.nome || 'Admin',
        criado_em: new Date().toISOString(),
        excluido: false,
      };
    });

    setAccounts((prev) => [...newItems, ...prev]);
    saveServerAccountsBatch(newItems).catch((err) => console.warn('Erro ao salvar lote de contas no servidor central:', err));
    saveCloudAccountsBatch(newItems).catch((err) => console.warn('Erro ao importar contas na nuvem:', err));

    saveCloudAuditLog({
      acao: 'IMPORTACAO_CSV',
      entidade: 'conta',
      entidade_id: 0,
      tenant_id: Number(newItems[0]?.tenant_id || currentUser?.tenant_id || 1),
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin',
      empresa_id: Number(imported[0]?.empresa_id || selectedCompanyId),
      descricao: `Importou em lote ${newItems.length} lançamentos via CSV/Extrato`,
      detalhes: { count: newItems.length },
    }).catch((e) => console.warn('Audit log error:', e));
  };

  // Companies Handlers
  const handleAddCompany = (nome: string, cnpj?: string) => {
    const nextId = Date.now() + Math.floor(Math.random() * 1000);
    const assignedTenantId = Number(currentUser?.tenant_id || 1);

    const newCompany: Company = {
      id: nextId,
      tenant_id: assignedTenantId,
      nome: nome.trim(),
      cnpj: cnpj?.trim() || undefined,
      criado_em: new Date().toISOString().split('T')[0],
    };
    setCompanies((prev) => [...prev, newCompany]);
    saveCloudCompany(newCompany).catch((err) => console.warn('Erro ao salvar empresa na nuvem:', err));

    // Se o usuário atual não tem acesso global a todas, vincular a nova empresa a ele para que ele possa vê-la
    if (currentUser && !currentUser.acesso_todas_empresas) {
      const nextLinkId = Date.now() + Math.floor(Math.random() * 1000);
      const existingUserCompanyIds = userCompanies
        .filter((uc) => Number(uc.usuario_id) === Number(currentUser.id))
        .map((uc) => Number(uc.empresa_id));
      const updatedCompanyIds = Array.from(new Set([...existingUserCompanyIds, nextId]));

      setUserCompanies((prev) => [
        ...prev,
        {
          id: nextLinkId,
          tenant_id: assignedTenantId,
          usuario_id: currentUser.id,
          empresa_id: nextId,
        },
      ]);
      saveCloudUserCompanyLinks(currentUser.id, updatedCompanyIds).catch((err) =>
        console.warn('Erro ao salvar permissões de nova empresa na nuvem:', err)
      );
    }

    setSelectedCompanyId(nextId);
  };

  const handleEditCompany = (id: number, nome: string, cnpj?: string) => {
    const companyId = Number(id);
    if (!nome.trim()) {
      return { success: false, error: 'O nome da empresa é obrigatório.' };
    }
    const duplicate = companies.some(
      (c) => Number(c.id) !== companyId && c.nome.toLowerCase() === nome.trim().toLowerCase()
    );
    if (duplicate) {
      return { success: false, error: 'Já existe outra empresa com este nome.' };
    }

    const existingComp = companies.find((c) => Number(c.id) === companyId);
    const updatedCompany: Company = {
      id: companyId,
      nome: nome.trim(),
      cnpj: cnpj?.trim() || undefined,
      criado_em: existingComp?.criado_em || new Date().toISOString().split('T')[0],
    };

    setCompanies((prev) => prev.map((c) => (Number(c.id) === companyId ? updatedCompany : c)));
    saveCloudCompany(updatedCompany).catch((err) => console.warn('Erro ao atualizar empresa na nuvem:', err));
    return { success: true };
  };

  const handleDeleteCompany = (id: number) => {
    const compId = Number(id);
    if (companies.length <= 1) return;
    setCompanies((prev) => prev.filter((c) => Number(c.id) !== compId));
    setAccounts((prev) => prev.filter((a) => Number(a.empresa_id) !== compId));
    setUserCompanies((prev) => prev.filter((uc) => Number(uc.empresa_id) !== compId));
    deleteCloudCompany(compId).catch((err) => console.warn('Erro ao excluir empresa na nuvem:', err));
    const remaining = companies.filter((c) => Number(c.id) !== compId);
    if (remaining.length > 0) {
      setSelectedCompanyId(remaining[0].id);
    }
  };

  const handleClearAllAccounts = async () => {
    setAccounts([]);
    await clearAllCloudAccounts();
  };

  const handleResetAllAndStartFresh = async (companyName: string, cnpj?: string) => {
    const res = await clearAllCloudDataAndStartFresh(companyName, cnpj);
    setCompanies([res.company]);
    setSelectedCompanyId(res.company.id);
    setAccounts([]);
    setBankAccounts([
      {
        id: 1,
        empresa_id: res.company.id,
        nome_banco: 'Conta Corrente Principal',
        tipo_conta: 'corrente',
        saldo_inicial: 0,
        padrao: true,
      }
    ]);
    setCostCenters([]);
    setUserCompanies([
      {
        id: 1,
        usuario_id: currentUser ? currentUser.id : 1,
        empresa_id: res.company.id
      }
    ]);
  };

  const handleResetToDemo = async () => {
    setCompanies(INITIAL_COMPANIES);
    setUsers(INITIAL_USERS);
    setUserCompanies(INITIAL_USER_COMPANIES);
    setAccounts(INITIAL_ACCOUNTS);
    setBankAccounts(INITIAL_BANK_ACCOUNTS);
    setCostCenters(INITIAL_COST_CENTERS);
    if (INITIAL_COMPANIES.length > 0) {
      setSelectedCompanyId(INITIAL_COMPANIES[0].id);
    }
    await resetCloudToInitialData();
  };

  // Batch Add Accounts (Used by Recurring Generator & OFX new entries)
  const handleBatchAddAccounts = async (newAccounts: Omit<FinancialAccount, 'id'>[]) => {
    const baseTime = Date.now();
    const createdAccounts: FinancialAccount[] = newAccounts.map((item, idx) => {
      const targetComp = companies.find((c) => Number(c.id) === Number(item.empresa_id));
      const targetTenantId = Number(item.tenant_id || targetComp?.tenant_id || currentUser?.tenant_id || 1);
      return {
        ...item,
        id: baseTime + idx,
        tenant_id: targetTenantId,
        empresa_id: Number(item.empresa_id),
        valor: Number(item.valor),
        criado_por: currentUser?.nome || 'Admin',
        criado_em: new Date().toISOString(),
        excluido: false,
      };
    });

    setAccounts((prev) => [...createdAccounts, ...prev]);
    await saveCloudAccountsBatch(createdAccounts).catch((err) => console.warn('Erro ao salvar lote na nuvem:', err));

    await saveCloudAuditLog({
      acao: 'CRIACAO',
      entidade: 'conta',
      entidade_id: 0,
      tenant_id: Number(createdAccounts[0]?.tenant_id || currentUser?.tenant_id || 1),
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin',
      empresa_id: Number(newAccounts[0]?.empresa_id || selectedCompanyId),
      descricao: `Gerou em lote ${createdAccounts.length} lançamentos financeiros (Recorrência/Parcelamento/OFX)`,
      detalhes: { count: createdAccounts.length },
    }).catch((e) => console.warn('Audit log error:', e));
  };

  // OFX Single Reconcile
  const handleReconcileAccountFromOfx = async (accountId: number, fitid: string, bankId?: number) => {
    const acc = accounts.find(a => Number(a.id) === Number(accountId));
    if (!acc) return;
    const updated: FinancialAccount = {
      ...acc,
      status: 'Pago',
      conciliado: true,
      conciliado_em: new Date().toISOString(),
      conciliado_fitid: fitid,
      conciliado_por: currentUser?.nome || 'Admin',
      banco_id: bankId !== undefined ? bankId : acc.banco_id,
    };
    setAccounts(prev => prev.map(a => Number(a.id) === Number(accountId) ? updated : a));
    await saveCloudAccount(updated);
    await saveCloudAuditLog({
      acao: 'CONCILIACAO_BANCARIA',
      entidade: 'conta',
      entidade_id: accountId,
      tenant_id: Number(acc.tenant_id || currentUser?.tenant_id || 1),
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin',
      empresa_id: acc.empresa_id,
      descricao: `Conciliou e baixou a conta #${accountId} "${acc.descricao}" via extrato bancário`,
      detalhes: { fitid, bankId },
    });
  };

  // OFX Create & Reconcile
  const handleCreateAndReconcileFromOfx = async (newAccount: Omit<FinancialAccount, 'id'>) => {
    const newId = Date.now();
    const targetComp = companies.find((c) => Number(c.id) === Number(newAccount.empresa_id));
    const targetTenantId = Number(newAccount.tenant_id || targetComp?.tenant_id || currentUser?.tenant_id || 1);
    const created: FinancialAccount = {
      ...newAccount,
      id: newId,
      tenant_id: targetTenantId,
      empresa_id: Number(newAccount.empresa_id),
      valor: Number(newAccount.valor),
      criado_por: currentUser?.nome || 'Admin',
      criado_em: new Date().toISOString(),
      excluido: false,
    };
    setAccounts(prev => [created, ...prev]);
    await saveCloudAccount(created);
    await saveCloudAuditLog({
      acao: 'CRIACAO',
      entidade: 'conta',
      entidade_id: newId,
      tenant_id: targetTenantId,
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin',
      empresa_id: created.empresa_id,
      descricao: `Criou e conciliou novo lançamento a partir do extrato: "${created.descricao}" (R$ ${created.valor.toFixed(2)})`,
      detalhes: { account: created },
    });
  };

  // OFX Batch Reconcile
  const handleBatchReconcileFromOfx = async (
    matches: { accountId: number; fitid: string; bankId?: number }[],
    newAccounts: Omit<FinancialAccount, 'id'>[]
  ) => {
    const updatedAccounts: FinancialAccount[] = [];
    const accountsMap = new Map(accounts.map(a => [Number(a.id), a]));

    for (const match of matches) {
      const existing = accountsMap.get(Number(match.accountId));
      if (existing) {
        const up: FinancialAccount = {
          ...existing,
          status: 'Pago',
          conciliado: true,
          conciliado_em: new Date().toISOString(),
          conciliado_fitid: match.fitid,
          conciliado_por: currentUser?.nome || 'Admin',
          banco_id: match.bankId !== undefined ? match.bankId : existing.banco_id,
        };
        updatedAccounts.push(up);
        accountsMap.set(Number(match.accountId), up);
      }
    }

    const baseTime = Date.now();
    const createdFromOfx: FinancialAccount[] = newAccounts.map((item, idx) => {
      const targetComp = companies.find((c) => Number(c.id) === Number(item.empresa_id));
      const targetTenantId = Number(item.tenant_id || targetComp?.tenant_id || currentUser?.tenant_id || 1);
      return {
        ...item,
        id: baseTime + idx,
        tenant_id: targetTenantId,
        empresa_id: Number(item.empresa_id),
        valor: Number(item.valor),
        criado_por: currentUser?.nome || 'Admin',
        criado_em: new Date().toISOString(),
        excluido: false,
      };
    });

    const finalAccountsList = [
      ...createdFromOfx,
      ...Array.from(accountsMap.values())
    ];

    setAccounts(finalAccountsList);
    if (updatedAccounts.length > 0) {
      await saveCloudAccountsBatch(updatedAccounts);
    }
    if (createdFromOfx.length > 0) {
      await saveCloudAccountsBatch(createdFromOfx);
    }

    await saveCloudAuditLog({
      acao: 'CONCILIACAO_BANCARIA',
      entidade: 'conta',
      entidade_id: 0,
      tenant_id: Number(createdFromOfx[0]?.tenant_id || currentUser?.tenant_id || 1),
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin',
      empresa_id: Number(selectedCompanyId === -1 ? (permittedCompanies[0]?.id || 1) : selectedCompanyId),
      descricao: `Processou conciliação em lote: ${matches.length} conciliações e ${newAccounts.length} novos lançamentos`,
      detalhes: { matchesCount: matches.length, newCount: newAccounts.length },
    });
  };

  // Bank Accounts Handlers
  const handleSaveBankAccount = async (bank: BankAccount) => {
    const targetComp = companies.find((c) => Number(c.id) === Number(bank.empresa_id));
    const targetTenantId = Number(bank.tenant_id || targetComp?.tenant_id || currentUser?.tenant_id || 1);
    const bankToSave = { ...bank, tenant_id: targetTenantId };

    setBankAccounts((prev) => {
      const exists = prev.some((b) => Number(b.id) === Number(bank.id));
      if (exists) {
        return prev.map((b) => (Number(b.id) === Number(bank.id) ? bankToSave : b));
      }
      return [...prev, bankToSave];
    });
    await saveCloudBankAccount(bankToSave).catch((err) => console.warn('Erro ao salvar conta bancária na nuvem:', err));

    await saveCloudAuditLog({
      acao: 'EDICAO',
      entidade: 'banco',
      entidade_id: bank.id,
      tenant_id: targetTenantId,
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin',
      empresa_id: bank.empresa_id,
      descricao: `Cadastrou/atualizou a conta bancária "${bank.nome_banco}" (Saldo Inicial: R$ ${bank.saldo_inicial.toFixed(2)})`,
      detalhes: { bank: bankToSave },
    }).catch((e) => console.warn('Audit log error:', e));
  };

  const handleDeleteBankAccount = async (bankId: number) => {
    const bank = bankAccounts.find((b) => Number(b.id) === Number(bankId));
    setBankAccounts((prev) => prev.filter((b) => Number(b.id) !== Number(bankId)));
    await deleteCloudBankAccount(bankId).catch((err) => console.warn('Erro ao excluir conta bancária na nuvem:', err));

    await saveCloudAuditLog({
      acao: 'EXCLUSAO_DEFINITIVA',
      entidade: 'banco',
      entidade_id: bankId,
      tenant_id: bank?.tenant_id || 1,
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin',
      empresa_id: bank?.empresa_id || 0,
      descricao: `Excluiu a conta bancária "${bank?.nome_banco || `#${bankId}`}"`,
      detalhes: { bankId },
    }).catch((e) => console.warn('Audit log error:', e));
  };

  // Cost Centers Handlers
  const handleSaveCostCenter = async (cc: CostCenter) => {
    const targetComp = companies.find((c) => Number(c.id) === Number(cc.empresa_id));
    const targetTenantId = Number(cc.tenant_id || targetComp?.tenant_id || currentUser?.tenant_id || 1);
    const ccToSave = { ...cc, tenant_id: targetTenantId };

    setCostCenters((prev) => {
      const exists = prev.some((c) => Number(c.id) === Number(cc.id));
      if (exists) {
        return prev.map((c) => (Number(c.id) === Number(cc.id) ? ccToSave : c));
      }
      return [...prev, ccToSave];
    });
    await saveCloudCostCenter(ccToSave).catch((err) => console.warn('Erro ao salvar centro de custo na nuvem:', err));

    await saveCloudAuditLog({
      acao: 'EDICAO',
      entidade: 'centro_custo',
      entidade_id: cc.id,
      tenant_id: targetTenantId,
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin',
      empresa_id: cc.empresa_id,
      descricao: `Cadastrou/atualizou o centro de custo "${cc.nome}" ${cc.codigo ? `(${cc.codigo})` : ''}`,
      detalhes: { costCenter: ccToSave },
    }).catch((e) => console.warn('Audit log error:', e));
  };

  const handleDeleteCostCenter = async (ccId: number) => {
    const cc = costCenters.find((c) => Number(c.id) === Number(ccId));
    setCostCenters((prev) => prev.filter((c) => Number(c.id) !== Number(ccId)));
    await deleteCloudCostCenter(ccId).catch((err) => console.warn('Erro ao excluir centro de custo na nuvem:', err));

    await saveCloudAuditLog({
      acao: 'EXCLUSAO_DEFINITIVA',
      entidade: 'centro_custo',
      entidade_id: ccId,
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin',
      empresa_id: cc?.empresa_id || 0,
      descricao: `Excluiu o centro de custo "${cc?.nome || `#${ccId}`}"`,
      detalhes: { ccId },
    }).catch((e) => console.warn('Audit log error:', e));
  };

  // Tenant CRUD Operations for Master Portal
  const handleSaveTenant = async (tenantData: Partial<Tenant> & { id?: number }) => {
    const validIds = tenants
      .map((t) => Number(t.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    const safeNextId = validIds.length > 0 ? Math.max(...validIds) + 1 : 1;

    const requestedId = tenantData.id !== undefined ? Number(tenantData.id) : undefined;
    const isEdit = requestedId !== undefined && Number.isFinite(requestedId) && requestedId > 0;
    const finalId = isEdit ? requestedId : safeNextId;

    const existing = isEdit ? tenants.find((t) => Number(t.id) === finalId) : undefined;

    const rawEmpresas = Number(tenantData.limite_empresas ?? tenantData.max_subempresas ?? existing?.limite_empresas ?? existing?.max_subempresas ?? 5);
    const safeEmpresas = Number.isFinite(rawEmpresas) && rawEmpresas > 0 ? rawEmpresas : 5;

    const rawUsuarios = Number(tenantData.limite_usuarios ?? tenantData.max_usuarios ?? existing?.limite_usuarios ?? existing?.max_usuarios ?? 10);
    const safeUsuarios = Number.isFinite(rawUsuarios) && rawUsuarios > 0 ? rawUsuarios : 10;

    const rawValor = Number(tenantData.valor_mensal !== undefined ? tenantData.valor_mensal : existing?.valor_mensal);
    const safeValor = Number.isFinite(rawValor) && rawValor >= 0 ? rawValor : 299.90;

    const updatedTenant: Tenant = {
      ...existing,
      ...tenantData,
      id: finalId,
      nome: (tenantData.nome || existing?.nome || 'Cliente SaaS').trim(),
      email: (tenantData.email || existing?.email || '').trim().toLowerCase(),
      status: tenantData.status || existing?.status || 'ativo',
      expiracao: tenantData.expiracao || existing?.expiracao || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      plano: tenantData.plano || existing?.plano || 'Profissional',
      max_subempresas: safeEmpresas,
      limite_empresas: safeEmpresas,
      max_usuarios: safeUsuarios,
      limite_usuarios: safeUsuarios,
      valor_mensal: safeValor,
      criado_em: existing?.criado_em || tenantData.criado_em || new Date().toISOString().split('T')[0],
      telefone: tenantData.telefone !== undefined ? tenantData.telefone : existing?.telefone,
      documento: tenantData.documento !== undefined ? tenantData.documento : existing?.documento,
      observacoes: tenantData.observacoes !== undefined ? tenantData.observacoes : existing?.observacoes,
    };

    // Atualização otimista imediata no estado local do React
    setTenants((prev) => {
      const existsInList = prev.some((t) => Number(t.id) === finalId);
      if (existsInList) {
        return prev.map((t) => (Number(t.id) === finalId ? updatedTenant : t));
      }
      return [...prev, updatedTenant];
    });

    // Salva na nuvem Firestore de forma segura sem travar o usuário
    try {
      await saveCloudTenant(updatedTenant);
    } catch (err) {
      console.warn('Aviso ao sincronizar tenant com Firestore:', err);
    }

    // Registra auditoria em segundo plano
    saveCloudAuditLog({
      acao: isEdit ? 'EDICAO' : 'CRIACAO',
      entidade: 'tenant',
      entidade_id: updatedTenant.id,
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin Master',
      empresa_id: 0,
      descricao: `Salvou cliente SaaS / Tenant "${updatedTenant.nome}" (${updatedTenant.email}) - Expiração: ${updatedTenant.expiracao}`,
      detalhes: { tenant: updatedTenant },
    }).catch((e) => console.warn('Audit log error:', e));
  };

  const handleDeleteTenant = async (tenantId: number) => {
    if (Number(tenantId) === 1) {
      alert('O Tenant Matriz ID 1 (Dono Original do ERP) é protegido e não pode ser excluído.');
      return;
    }

    const target = tenants.find((t) => Number(t.id) === Number(tenantId));
    const targetName = target?.nome || `Tenant #${tenantId}`;

    // 1. Remove o tenant do estado React e do localStorage imediatamente
    const nextTenants = tenants.filter((t) => Number(t.id) !== Number(tenantId));
    setTenants(nextTenants);
    localStorage.setItem('fin_tenants', JSON.stringify(nextTenants));

    // 2. Remove empresas filiais exclusivas deste tenant do estado e localStorage
    const nextCompanies = companies.filter((c) => Number(c.tenant_id) !== Number(tenantId));
    setCompanies(nextCompanies);
    localStorage.setItem('fin_companies', JSON.stringify(nextCompanies));

    // 3. Remove contas bancárias e centros de custo deste tenant
    const nextBanks = bankAccounts.filter((b) => Number(b.tenant_id) !== Number(tenantId));
    setBankAccounts(nextBanks);
    localStorage.setItem('fin_bank_accounts', JSON.stringify(nextBanks));

    const nextCC = costCenters.filter((cc) => Number(cc.tenant_id) !== Number(tenantId));
    setCostCenters(nextCC);
    localStorage.setItem('fin_cost_centers', JSON.stringify(nextCC));

    // 4. Remove vínculos de usuário deste tenant
    const nextUserCompanies = userCompanies.filter((uc) => Number(uc.tenant_id) !== Number(tenantId));
    setUserCompanies(nextUserCompanies);
    localStorage.setItem('fin_user_companies', JSON.stringify(nextUserCompanies));

    // 5. Exclui no servidor, Firestore e persiste snapshot em paralelo de forma não-bloqueante
    try {
      await Promise.race([
        Promise.allSettled([
          deleteServerTenant(tenantId),
          deleteCloudTenant(tenantId),
          saveServerSystemStore({
            hasCustomData: true,
            companies: nextCompanies,
            accounts,
            users,
            userCompanies: nextUserCompanies,
            bankAccounts: nextBanks,
            costCenters: nextCC,
            tenants: nextTenants,
            auditLogs,
            deletedTenantId: tenantId,
            source: 'master_tenant_delete',
          }),
        ]),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
    } catch (e) {
      console.warn('Erro ou timeout ao sincronizar exclusão do tenant:', e);
    }

    // 8. Registra log de auditoria
    saveCloudAuditLog({
      acao: 'EXCLUSAO_DEFINITIVA',
      entidade: 'tenant',
      entidade_id: tenantId,
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin Master',
      empresa_id: 0,
      descricao: `Excluiu definitivamente o cliente SaaS / Tenant "${targetName}" (#${tenantId})`,
    }).catch((e) => console.warn('Audit log error:', e));
  };

  const handleExtendTenantLicense = async (tenantId: number, daysToAdd: number) => {
    const target = tenants.find((t) => t.id === tenantId);
    if (!target) return;
    const newExpStr = calculateExtendedExpirationDate(target.expiracao, daysToAdd);
    const updated: Tenant = {
      ...target,
      expiracao: newExpStr,
      status: 'ativo',
    };
    setTenants((prev) => prev.map((t) => (t.id === tenantId ? updated : t)));
    await saveCloudTenant(updated);

    await saveCloudAuditLog({
      acao: 'EDICAO',
      entidade: 'tenant',
      entidade_id: tenantId,
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin Master',
      empresa_id: 0,
      descricao: `Estendeu licença do Tenant "${target.nome}" em +${daysToAdd} dias (Nova expiração: ${newExpStr})`,
      detalhes: { newExpStr, daysToAdd },
    }).catch((e) => console.warn('Audit log error:', e));
  };

  const handleUpdateTenantStatus = async (tenantId: number, status: 'ativo' | 'inativo' | 'expirado') => {
    const target = tenants.find((t) => t.id === tenantId);
    if (!target) return;
    const updated: Tenant = {
      ...target,
      status,
    };
    setTenants((prev) => prev.map((t) => (t.id === tenantId ? updated : t)));
    await saveCloudTenant(updated);

    await saveCloudAuditLog({
      acao: 'EDICAO',
      entidade: 'tenant',
      entidade_id: tenantId,
      usuario_id: currentUser ? currentUser.id : 1,
      usuario_nome: currentUser ? currentUser.nome : 'Admin Master',
      empresa_id: 0,
      descricao: `Alterou status do Tenant "${target.nome}" para "${status.toUpperCase()}"`,
      detalhes: { status },
    }).catch((e) => console.warn('Audit log error:', e));
  };

  const handleDownloadAppPy = () => {
    const blob = new Blob([PYTHON_APP_CODE], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'app.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenCsv = (tab: 'export' | 'import' = 'export') => {
    setCsvModalInitialTab(tab);
    setIsCsvModalOpen(true);
  };

  const getTitleByView = () => {
    if (currentView === 'pagar') return 'Contas a Pagar (Despesas)';
    if (currentView === 'receber') return 'Contas a Receber (Receitas)';
    return isConsolidated ? 'Dashboard Geral Consolidado' : 'Dashboard Financeiro';
  };

  // Se o usuário não estiver autenticado, exibe a tela de Login/Registro
  if (!currentUser) {
    return (
      <>
        <AuthScreen
          users={users}
          companies={companies}
          onLoginSuccess={handleLoginSuccess}
          onRegisterUser={handleRegisterUser}
          onOpenPythonModal={() => setIsPythonModalOpen(true)}
        />
        <PythonCodeModal
          isOpen={isPythonModalOpen}
          onClose={() => setIsPythonModalOpen(false)}
        />
      </>
    );
  }

  // SE O USUÁRIO FOR SUPER ADMIN MASTER: ACESSO AO PAINEL MASTER (OU APP SE ESCOLHIDO)
  if (isCurrentUserMaster && masterScreenMode === 'master_portal') {
    return (
      <>
        <MasterPortalScreen
          currentUser={currentUser}
          users={users}
          companies={companies}
          userCompanies={userCompanies}
          accounts={accounts}
          auditLogs={auditLogs}
          tenants={tenants}
          billingInvoices={billingInvoices}
          onRefreshInvoices={fetchAllCloudData}
          onEnterFinancialApp={(targetCompId) => {
            if (targetCompId !== undefined) {
              setSelectedCompanyId(targetCompId);
              localStorage.setItem('fin_selected_company', String(targetCompId));
            } else if (companies.length > 0 && selectedCompanyId === -1) {
              setSelectedCompanyId(companies[0].id);
              localStorage.setItem('fin_selected_company', String(companies[0].id));
            }
            setMasterScreenMode('app');
            localStorage.setItem('fin_master_screen_mode', 'app');
            setHasSelectedCompany(true);
          }}
          onSaveTenant={handleSaveTenant}
          onDeleteTenant={handleDeleteTenant}
          onExtendTenantLicense={handleExtendTenantLicense}
          onUpdateTenantStatus={handleUpdateTenantStatus}
          onLogout={handleLogout}
          onApproveUser={handleApproveUser}
          onRejectUser={handleRejectUser}
          onUpdateUserStatus={handleUpdateUserStatus}
          onUpdateUserRole={handleUpdateUserRole}
          onResetUserPassword={handleResetUserPassword}
          onDeleteUser={handleDeleteUser}
          onUpdateUserCompanies={handleUpdateUserPermissions}
          onUpdateUserGranularPermissions={handleUpdateUserGranularPermissions}
          onUpdateUserProfile={handleUpdateUserProfile}
          onSaveCompany={async (name, cnpj) => {
            handleAddCompany(name, cnpj);
          }}
          onWipeAllData={handleWipeAllDataAndLeaveMaster}
          onAccountReconciled={handleAccountReconciled}
          onOpenBackupModal={() => setIsBackupModalOpen(true)}
        />
        <PythonCodeModal
          isOpen={isPythonModalOpen}
          onClose={() => setIsPythonModalOpen(false)}
        />
        {/* Backup & Restauração Completa no Google Drive (Disponível no Portal Master) */}
        <BackupRestoreModal
          isOpen={isBackupModalOpen}
          onClose={() => setIsBackupModalOpen(false)}
          companies={companies}
          accounts={accounts}
          users={scopedUsers}
          userCompanies={scopedUserCompanies}
          auditLogs={scopedAuditLogs}
          bankAccounts={bankAccounts}
          costCenters={costCenters}
          tenants={tenants}
          currentUser={currentUser}
          onRestoreSnapshot={handleRestoreFullSnapshot}
          onLogBackupExport={handleLogBackupExport}
        />
      </>
    );
  }

  // BLOQUEIO SAAS MULTI-TENANT (FRONTEND & BACKEND):
  // Se o status do tenant for 'inativo' ou 'expirado' (ou se o backend retornar 403 Forbidden),
  // bloqueia completamente o acesso ao painel financeiro, SummaryCards e tabelas.
  // REGRA DE OURO: O Tenant ID 1 (Dono Original / Uso Pessoal) NUNCA é bloqueado!
  const isOwnerOrMaster = Boolean(
    isCurrentUserMaster ||
    Number(currentUser?.tenant_id || 1) === 1 ||
    Number(currentUser?.tenant_id) === 1788215216712 ||
    currentUser?.email?.toLowerCase() === 'jr0955@gmail.com' ||
    currentUser?.email?.toLowerCase() === 'admin@financeiro.com'
  );
  const isClientTenant = !isOwnerOrMaster && Number(currentUser?.tenant_id || 1) > 1;
  const isTenantSubscriptionBlocked = isClientTenant && (
    isServerSubscriptionBlocked ||
    (currentTenant ? !isTenantActive(currentTenant) : false)
  );

  if (isTenantSubscriptionBlocked) {
    const blockedTenantFallback: Tenant = currentTenant || {
      id: Number(currentUser?.tenant_id || 2),
      nome: currentUser?.nome ? `Tenant (${currentUser.nome})` : 'Empresa Cliente',
      email: currentUser?.email || '',
      status: 'inativo',
      expiracao: '2025-01-01',
      plano: 'Profissional',
      criado_em: '2025-01-01',
    };

    return (
      <TenantBlockedScreen
        tenant={blockedTenantFallback}
        currentUser={currentUser}
        onLogout={handleLogout}
        onContactAdmin={() => {
          alert(`Entre em contato com o administrador Master pelo e-mail: ${blockedTenantFallback.email || 'admin@financeiro.com'}`);
        }}
        onSimulatePaymentSuccess={() => {
          setIsServerSubscriptionBlocked(false);
          if (currentTenant) {
            currentTenant.status = 'ativo';
          }
        }}
      />
    );
  }

  // SELEÇÃO DE SUBEMPRESA OBRIGATÓRIA NO LOGIN: Se o usuário ainda não escolheu em qual subempresa quer operar
  if (!hasSelectedCompany && permittedCompanies.length > 0 && !isCurrentUserMaster) {
    return (
      <CompanySelectionScreen
        currentUser={currentUser}
        tenant={currentTenant || undefined}
        companies={permittedCompanies}
        accounts={accounts}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={(companyId) => {
          setSelectedCompanyId(companyId);
          setHasSelectedCompany(true);
        }}
        onSelectConsolidated={() => {
          setSelectedCompanyId(-1);
          setHasSelectedCompany(true);
        }}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="flex h-screen w-full bg-gray-50 dark:bg-slate-950 font-sans text-gray-900 dark:text-gray-100 overflow-hidden transition-colors">
      
      {/* 1. Clean Minimalism Left Sidebar */}
      <Sidebar
        currentView={currentView}
        onChangeView={setCurrentView}
        onOpenCompanyModal={() => setIsCompanyModalOpen(true)}
        onOpenChartModal={() => setIsChartModalOpen(true)}
        onOpenPythonModal={() => setIsPythonModalOpen(true)}
        onOpenSqliteModal={() => setIsSqliteModalOpen(true)}
        onOpenUsersModal={() => setIsUserManagementModalOpen(true)}
        onOpenMasterModal={() => {
          setMasterScreenMode('master_portal');
          localStorage.setItem('fin_master_screen_mode', 'master_portal');
        }}
        onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
        pendingApprovalsCount={pendingApprovalsCount}
        onOpenExtratoModal={() => setIsExtratoModalOpen(true)}
        onOpenCsvModal={handleOpenCsv}
        onOpenResetModal={() => setIsResetModalOpen(true)}
        onOpenAuditLogModal={() => setIsAuditLogModalOpen(true)}
        onOpenTrashModal={() => setIsTrashModalOpen(true)}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenRecurringModal={() => setIsRecurringModalOpen(true)}
        onOpenOfxModal={() => setIsOfxModalOpen(true)}
        onOpenBankAccountsModal={() => setIsBankAccountsModalOpen(true)}
        onOpenCostCentersModal={() => setIsCostCentersModalOpen(true)}
        onOpenCashflowModal={() => setIsCashflowModalOpen(true)}
        onOpenWebhookModal={() => setIsWebhookModalOpen(true)}
        onOpenBankingModal={() => setIsBankingModalOpen(true)}
        onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
        onDownloadAppPy={handleDownloadAppPy}
        currentUser={currentUser}
        onLogout={handleLogout}
        companiesCount={permittedCompanies.length}
        companiesList={permittedCompanies}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={setSelectedCompanyId}
        trashCount={accounts.filter((a) => a.excluido && (isCurrentUserMaster ? true : (Number(a.tenant_id || 1) === Number(currentUser?.tenant_id || 1) && permittedCompanyIds.includes(Number(a.empresa_id))))).length}
        auditLogsCount={scopedAuditLogs.length}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* 2. Main Content View Area */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        
        {/* Top Header */}
        <Navbar
          companies={permittedCompanies}
          selectedCompanyId={selectedCompanyId}
          onSelectCompany={setSelectedCompanyId}
          onOpenCompanyModal={() => setIsCompanyModalOpen(true)}
          onOpenChartModal={() => setIsChartModalOpen(true)}
          onOpenPythonModal={() => setIsPythonModalOpen(true)}
          onOpenSqliteModal={() => setIsSqliteModalOpen(true)}
          onOpenUsersModal={() => setIsUserManagementModalOpen(true)}
          onOpenMasterModal={() => {
            setMasterScreenMode('master_portal');
            localStorage.setItem('fin_master_screen_mode', 'master_portal');
          }}
          onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
          onOpenBackupModal={() => setIsBackupModalOpen(true)}
          onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
          timeoutMinutes={inactivityTimeoutMinutes}
          pendingApprovalsCount={pendingApprovalsCount}
          onOpenCsvModal={handleOpenCsv}
          onOpenExtratoModal={() => setIsExtratoModalOpen(true)}
          onDownloadAppPy={handleDownloadAppPy}
          currentUser={currentUser}
          tenant={currentTenant || undefined}
          onSwitchCompanyScreen={() => setHasSelectedCompany(false)}
          onLogout={handleLogout}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode(!darkMode)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          currentViewTitle={getTitleByView()}
          onForceSync={handleForceCloudSync}
          isSyncing={isSyncing}
        />

        {/* Scrollable Dashboard Body */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
          
          {/* Permitted companies check warning */}
          {permittedCompanies.length === 0 ? (
            <div className="p-8 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-center space-y-3">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/60 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
                Nenhuma empresa autorizada para este usuário
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 max-w-md mx-auto">
                Seu usuário possui acesso restrito e nenhuma empresa está associada a ele. Solicite ao administrador ou acesse o gerenciador de usuários.
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <button
                  onClick={() => setIsCompanyModalOpen(true)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white cursor-pointer flex items-center gap-1.5 shadow-md shadow-blue-600/20"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Cadastrar Primeira Empresa</span>
                </button>
                <button
                  onClick={() => setIsUserManagementModalOpen(true)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  Gerenciador de Usuários
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 1. Cards de Métricas & Médias Mensais */}
              <SummaryCards 
                accounts={activeScopedAccounts} 
                isConsolidated={isConsolidated}
                companiesCount={permittedCompanies.length}
              />

              {/* 2. Somatório das Empresas & Gráfico Comparativo (Renderizado no Dashboard Geral ou no modo Consolidado) */}
              {permittedCompanies.length > 1 && (
                <ConsolidatedCompanyChart
                  companies={permittedCompanies}
                  accounts={tenantScopedAccounts}
                  onSelectCompany={(id) => setSelectedCompanyId(id)}
                  darkMode={darkMode}
                />
              )}

              {/* 3. Tabela de Lançamentos & Visualizador de Fluxo (Com suporte a Bancos, Centros de Custo, Parcelamentos) */}
              <AccountsTable
                accounts={activeScopedAccounts}
                empresaId={isConsolidated ? -1 : selectedCompanyId}
                companies={permittedCompanies}
                bankAccounts={scopedBankAccounts}
                costCenters={scopedCostCenters}
                currentUser={currentUser || undefined}
                onAddAccount={handleAddAccount}
                onEditAccount={handleEditAccount}
                onToggleStatus={handleToggleStatus}
                onDeleteAccount={handleDeleteAccount}
                onAccountPaidViaBank={handlePaymentSuccessViaBank}
                onOpenCsvModal={handleOpenCsv}
                onSelectCompany={setSelectedCompanyId}
                onOpenAccountHistory={(acc) => {
                  setSelectedAccountForHistory(acc);
                  setIsAccountHistoryModalOpen(true);
                }}
                onOpenRecurringModal={() => setIsRecurringModalOpen(true)}
                onOpenOfxModal={() => setIsOfxModalOpen(true)}
                onOpenBankAccountsModal={() => setIsBankAccountsModalOpen(true)}
                onOpenCostCentersModal={() => setIsCostCentersModalOpen(true)}
                onOpenCashflowModal={() => setIsCashflowModalOpen(true)}
                onOpenWebhookSimulator={() => setIsWebhookModalOpen(true)}
                forcedTab={currentView}
                isConsolidated={isConsolidated}
              />
            </>
          )}

        </div>

      </main>

      {/* Modals */}
      <CompanyModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        companies={isCurrentUserMaster ? companies : permittedCompanies}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={(id) => {
          setSelectedCompanyId(id);
          setIsCompanyModalOpen(false);
        }}
        onAddCompany={handleAddCompany}
        onEditCompany={handleEditCompany}
        onDeleteCompany={handleDeleteCompany}
      />

      <ChartModal
        isOpen={isChartModalOpen}
        onClose={() => setIsChartModalOpen(false)}
        company={currentCompany}
        companies={permittedCompanies}
        accounts={activeScopedAccounts}
        darkMode={darkMode}
      />

      <CsvModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        companies={permittedCompanies}
        accounts={activeScopedAccounts}
        selectedCompanyId={selectedCompanyId}
        onImportAccounts={handleImportAccounts}
        initialTab={csvModalInitialTab}
      />

      <ExtratoImportModal
        isOpen={isExtratoModalOpen}
        onClose={() => setIsExtratoModalOpen(false)}
        companies={permittedCompanies}
        selectedCompanyId={selectedCompanyId}
        onImportAccounts={handleImportAccounts}
      />

      <PythonCodeModal
        isOpen={isPythonModalOpen}
        onClose={() => setIsPythonModalOpen(false)}
      />

      <SqliteSchemaModal
        isOpen={isSqliteModalOpen}
        onClose={() => setIsSqliteModalOpen(false)}
        companies={isCurrentUserMaster ? companies : permittedCompanies}
        accounts={tenantScopedAccounts}
        users={scopedUsers}
        userCompanies={scopedUserCompanies}
      />

      <UserManagementModal
        isOpen={isUserManagementModalOpen}
        onClose={() => setIsUserManagementModalOpen(false)}
        users={scopedUsers}
        companies={permittedCompanies}
        userCompanies={scopedUserCompanies}
        currentUser={currentUser || INITIAL_USERS[0]}
        onSelectActiveUser={(user) => {
          localStorage.removeItem('fin_logged_out');
          localStorage.setItem('fin_current_user', JSON.stringify(user));
          setCurrentUser(user);
          setIsUserManagementModalOpen(false);
        }}
        onOpenMasterModal={() => setIsMasterModalOpen(true)}
        onAddUser={handleAddUserFromModal}
        onEditUser={handleEditUser}
        onUpdateUserPermissions={handleUpdateUserPermissions}
        onDeleteUser={handleDeleteUser}
      />

      {/* Painel Master & Liberações de Novos Cadastros */}
      <MasterManagementModal
        isOpen={isMasterModalOpen}
        onClose={() => setIsMasterModalOpen(false)}
        users={users}
        companies={companies}
        userCompanies={userCompanies}
        accounts={accounts}
        currentUser={currentUser || INITIAL_USERS[0]}
        onApproveUser={handleApproveUser}
        onRejectUser={handleRejectUser}
        onUpdateUserStatus={handleUpdateUserStatus}
        onUpdateUserRole={handleUpdateUserRole}
        onResetUserPassword={handleResetUserPassword}
        onDeleteUser={handleDeleteUser}
        onUpdateUserCompanies={handleUpdateUserPermissions}
        onUpdateUserGranularPermissions={handleUpdateUserGranularPermissions}
      />

      <ResetDataModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onClearAccounts={handleClearAllAccounts}
        onResetAllAndStartFresh={handleResetAllAndStartFresh}
        onResetToDemo={handleResetToDemo}
        totalAccounts={tenantScopedAccounts.length}
        totalCompanies={permittedCompanies.length}
      />

      {/* Trilha de Auditoria (Logs de Atividade) */}
      <AuditLogModal
        isOpen={isAuditLogModalOpen}
        onClose={() => setIsAuditLogModalOpen(false)}
        logs={scopedAuditLogs}
        companies={permittedCompanies}
        users={scopedUsers}
        currentUser={currentUser}
        onClearLogs={handleClearAuditLogs}
      />

      {/* Lixeira com Recuperação (Soft Delete - até 30 dias) */}
      <TrashBinModal
        isOpen={isTrashModalOpen}
        onClose={() => setIsTrashModalOpen(false)}
        deletedAccounts={accounts.filter((a) => a.excluido && (isCurrentUserMaster ? true : Number(a.tenant_id || 1) === Number(currentUser?.tenant_id || 1)))}
        companies={permittedCompanies}
        currentUser={currentUser}
        onRestoreAccount={handleRestoreAccount}
        onRestoreAllAccounts={handleRestoreAllAccounts}
        onPermanentDeleteAccount={handlePermanentDeleteAccount}
        onEmptyTrash={handleEmptyTrash}
      />

      {/* Backup & Restauração Completa em 1 Clique */}
      <BackupRestoreModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        companies={isCurrentUserMaster ? companies : (scopedCompanies.length > 0 ? scopedCompanies : permittedCompanies)}
        accounts={isCurrentUserMaster ? accounts : accounts.filter((a) => permittedCompanyIds.includes(Number(a.empresa_id)) || Number(a.tenant_id || 1) === Number(currentUser?.tenant_id || 1))}
        users={scopedUsers}
        userCompanies={scopedUserCompanies}
        auditLogs={scopedAuditLogs}
        bankAccounts={bankAccounts}
        costCenters={costCenters}
        tenants={tenants}
        currentUser={currentUser}
        onRestoreSnapshot={handleRestoreFullSnapshot}
        onLogBackupExport={handleLogBackupExport}
      />

      {/* Histórico Individual de Alterações de Lançamento */}
      <AccountHistoryModal
        isOpen={isAccountHistoryModalOpen}
        onClose={() => {
          setIsAccountHistoryModalOpen(false);
          setSelectedAccountForHistory(null);
        }}
        account={selectedAccountForHistory}
        logs={scopedAuditLogs}
        companies={permittedCompanies}
      />

      {/* 4 Novos Módulos Financeiros Avançados */}
      
      {/* 1. Lançamentos Recorrentes & Parcelamento Automático */}
      <RecurringInstallmentModal
        isOpen={isRecurringModalOpen}
        onClose={() => setIsRecurringModalOpen(false)}
        companies={permittedCompanies}
        activeCompanyId={selectedCompanyId === -1 ? (permittedCompanies[0]?.id || 1) : selectedCompanyId}
        bankAccounts={scopedBankAccounts}
        costCenters={scopedCostCenters}
        currentUserName={currentUser?.nome || 'Admin'}
        onGenerateBatch={handleBatchAddAccounts}
      />

      {/* 2. Conciliação Bancária com Leitor OFX / Extratos */}
      <OfxImportModal
        isOpen={isOfxModalOpen}
        onClose={() => setIsOfxModalOpen(false)}
        companies={permittedCompanies}
        activeCompanyId={selectedCompanyId === -1 ? (permittedCompanies[0]?.id || 1) : selectedCompanyId}
        bankAccounts={scopedBankAccounts}
        accounts={tenantScopedAccounts}
        currentUserName={currentUser?.nome || 'Admin'}
        onReconcileAccount={handleReconcileAccountFromOfx}
        onCreateAndReconcile={handleCreateAndReconcileFromOfx}
        onBatchReconcile={handleBatchReconcileFromOfx}
      />

      {/* 3. Contas Bancárias Reais */}
      <BankAccountsModal
        isOpen={isBankAccountsModalOpen}
        onClose={() => setIsBankAccountsModalOpen(false)}
        companies={permittedCompanies}
        activeCompanyId={selectedCompanyId === -1 ? (permittedCompanies[0]?.id || 1) : selectedCompanyId}
        bankAccounts={scopedBankAccounts}
        accounts={tenantScopedAccounts}
        onSaveBank={handleSaveBankAccount}
        onDeleteBank={handleDeleteBankAccount}
      />

      {/* 4. Centros de Custos */}
      <CostCentersModal
        isOpen={isCostCentersModalOpen}
        onClose={() => setIsCostCentersModalOpen(false)}
        companies={permittedCompanies}
        activeCompanyId={selectedCompanyId === -1 ? (permittedCompanies[0]?.id || 1) : selectedCompanyId}
        costCenters={scopedCostCenters}
        accounts={tenantScopedAccounts}
        onSaveCostCenter={handleSaveCostCenter}
        onDeleteCostCenter={handleDeleteCostCenter}
      />

      {/* 5. Fluxo de Caixa Projetado (30, 60, 90 dias) */}
      <CashflowProjectionModal
        isOpen={isCashflowModalOpen}
        onClose={() => setIsCashflowModalOpen(false)}
        companies={permittedCompanies}
        activeCompanyId={selectedCompanyId === -1 ? (permittedCompanies[0]?.id || 1) : selectedCompanyId}
        bankAccounts={scopedBankAccounts}
        accounts={activeScopedAccounts}
      />

      {/* 6. Simulador de Webhooks Bancários (BB, Stone, InfinitePay) */}
      <WebhookSimulatorModal
        isOpen={isWebhookModalOpen}
        onClose={() => setIsWebhookModalOpen(false)}
        accounts={tenantScopedAccounts}
        companies={permittedCompanies}
        activeCompanyId={selectedCompanyId === -1 ? (permittedCompanies[0]?.id || 1) : selectedCompanyId}
        activeTenantId={Number(currentUser?.tenant_id || 1)}
        onAddAccount={handleAddAccount}
        onAccountReconciled={handleAccountReconciled}
        onOpenBankingCredentials={() => setIsBankingModalOpen(true)}
      />

      {/* 7. Credenciais Reais de Integrações Bancárias (Banco do Brasil, Stone, InfinitePay) */}
      <BankingIntegrationsModal
        isOpen={isBankingModalOpen}
        onClose={() => setIsBankingModalOpen(false)}
        companies={permittedCompanies}
        selectedCompanyId={selectedCompanyId === -1 ? (permittedCompanies[0]?.id || 1) : selectedCompanyId}
        currentUser={currentUser!}
        initialProvider={bankingInitialProvider}
        onOpenAuditLogs={() => {
          setIsBankingModalOpen(false);
          setIsAuditLogModalOpen(true);
        }}
        onAccountReconciled={handleAccountReconciled}
        onRefreshData={() => {
          fetchAllCloudData();
          fetchServerSystemStore().then((sStore) => {
            if (sStore.success && sStore.hasCustomData && sStore.data) {
              if (Array.isArray(sStore.data.accounts) && sStore.data.accounts.length > 0) {
                setAccounts(sStore.data.accounts);
              }
              if (Array.isArray(sStore.data.companies) && sStore.data.companies.length > 0) {
                setCompanies(sStore.data.companies);
              }
            }
          }).catch(() => {});
        }}
      />

      {/* 8. Modal de Assinatura & Planos SaaS - Mercado Pago */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        currentTenant={currentTenant}
        currentUser={currentUser!}
        invoices={billingInvoices}
        onRefresh={() => fetchAllCloudData()}
      />

      {/* 9. Notificação / Modal de Sincronização Concluída */}
      {syncFeedback.isOpen && (
        <div 
          id="modal-sync-feedback"
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
          onClick={() => setSyncFeedback((prev) => ({ ...prev, isOpen: false }))}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                syncFeedback.success 
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' 
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
              }`}>
                {syncFeedback.success ? <CheckCircle2 className="w-6 h-6" /> : <Cloud className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {syncFeedback.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {syncFeedback.success ? 'Sincronização entre Computador e Celular' : 'Status da Sincronização'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <p className="font-medium leading-relaxed">{syncFeedback.message}</p>
              {syncFeedback.success && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex flex-col gap-1">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Endereço no Celular:
                  </span>
                  <a 
                    href="https://ais-pre-6f32kfcdgggdezthazyniq-597741261079.us-west2.run.app" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 hover:underline break-all"
                  >
                    https://ais-pre-6f32kfcdgggdezthazyniq-597741261079.us-west2.run.app
                  </a>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                id="btn-close-sync-feedback"
                onClick={() => setSyncFeedback((prev) => ({ ...prev, isOpen: false }))}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Entendi / Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Modal de Alerta e Contagem Regressiva de Inatividade */}
      <InactivityWarningModal
        isOpen={showInactivityWarning && Boolean(currentUser)}
        countdown={inactivityCountdown}
        timeoutMinutes={inactivityTimeoutMinutes}
        onExtend={extendInactivitySession}
        onLogout={() => handleLogout('Sessão encerrada pelo usuário no aviso de inatividade.')}
      />

      {/* 11. Modal de Configurações de Segurança e Tempo de Inatividade */}
      <SecuritySettingsModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        timeoutMinutes={inactivityTimeoutMinutes}
        onUpdateTimeout={handleUpdateInactivityTimeout}
        requireLoginOnReopen={requireLoginOnReopen}
        onUpdateRequireLoginOnReopen={handleUpdateRequireLoginOnReopen}
        onLockNow={() => {
          setIsSecurityModalOpen(false);
          handleLogout('Sessão bloqueada manualmente a pedido do usuário.');
        }}
      />

    </div>
  );
}
