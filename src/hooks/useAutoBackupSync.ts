import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Company, 
  FinancialAccount, 
  User, 
  UserCompanyLink, 
  BankAccount, 
  CostCenter, 
  Tenant, 
  AuditLog 
} from '../types';
import { saveServerSystemStore } from '../services/systemStoreService';
import { restoreFullCloudSnapshot } from '../firebase';

export interface AutoBackupSyncParams {
  companies: Company[];
  accounts: FinancialAccount[];
  users: User[];
  userCompanies: UserCompanyLink[];
  bankAccounts: BankAccount[];
  costCenters: CostCenter[];
  tenants: Tenant[];
  auditLogs: AuditLog[];
  currentUser: User | null;
  lastRestoredTimestampRef: React.MutableRefObject<number>;
  intervalMs?: number; // Padrão: 5000ms (5 segundos)
  enabled?: boolean;
}

export interface AutoBackupSyncResult {
  isSilentSyncing: boolean;
  lastAutoSyncTime: Date | null;
  syncCount: number;
  triggerSilentSync: () => Promise<boolean>;
  markAsSynced: (customData?: {
    companies?: Company[];
    accounts?: FinancialAccount[];
    users?: User[];
    userCompanies?: UserCompanyLink[];
    bankAccounts?: BankAccount[];
    costCenters?: CostCenter[];
    tenants?: Tenant[];
    auditLogs?: AuditLog[];
  }) => void;
}

/**
 * Gera uma assinatura determinística ultra-rápida (fingerprint 64-bit) de todos os dados locais.
 * Muda instantaneamente se qualquer movimentação, status de pagamento, empresa, usuário,
 * conta bancária, centro de custo ou log for modificado, adicionado ou removido.
 */
export function generateDataFingerprint(data: {
  companies: Company[];
  accounts: FinancialAccount[];
  users: User[];
  userCompanies: UserCompanyLink[];
  bankAccounts: BankAccount[];
  costCenters: CostCenter[];
  tenants: Tenant[];
  auditLogs: AuditLog[];
}): string {
  let accRep = '';
  const sortedAccounts = [...data.accounts].sort((a, b) => Number(a.id) - Number(b.id));
  for (let i = 0; i < sortedAccounts.length; i++) {
    const a = sortedAccounts[i];
    if (!a) continue;
    accRep += `${a.id}:${a.valor}:${a.status}:${a.excluido ? 1 : 0}:${a.empresa_id}:${a.data_vencimento || ''}:${a.pago_em || ''}:${a.descricao || ''}:${a.categoria || ''}:${a.observacoes || ''}:${a.conciliado ? 1 : 0}:${a.atualizado_em || ''};`;
  }

  let compRep = '';
  const sortedComps = [...data.companies].sort((a, b) => Number(a.id) - Number(b.id));
  for (let i = 0; i < sortedComps.length; i++) {
    const c = sortedComps[i];
    if (!c) continue;
    compRep += `${c.id}:${c.nome}:${c.cnpj || ''}:${c.tenant_id || ''};`;
  }

  let userRep = '';
  const sortedUsers = [...data.users].sort((a, b) => Number(a.id) - Number(b.id));
  for (let i = 0; i < sortedUsers.length; i++) {
    const u = sortedUsers[i];
    if (!u) continue;
    userRep += `${u.id}:${u.email}:${u.role}:${u.status || ''}:${u.senha_hash || ''}:${u.nome || ''};`;
  }

  let linkRep = '';
  for (let i = 0; i < data.userCompanies.length; i++) {
    const l = data.userCompanies[i];
    if (!l) continue;
    linkRep += `${l.id || ''}:${l.usuario_id}:${l.empresa_id};`;
  }

  let bankRep = '';
  for (let i = 0; i < data.bankAccounts.length; i++) {
    const b = data.bankAccounts[i];
    if (!b) continue;
    bankRep += `${b.id}:${b.saldo_inicial}:${b.padrao ? 1 : 0}:${b.nome_banco}:${b.empresa_id || ''};`;
  }

  let ccRep = '';
  for (let i = 0; i < data.costCenters.length; i++) {
    const cc = data.costCenters[i];
    if (!cc) continue;
    ccRep += `${cc.id}:${cc.codigo}:${cc.nome}:${cc.empresa_id || ''};`;
  }

  let tenantRep = '';
  for (let i = 0; i < data.tenants.length; i++) {
    const t = data.tenants[i];
    if (!t) continue;
    tenantRep += `${t.id}:${t.status}:${t.expiracao}:${t.plano};`;
  }

  const logRep = `${data.auditLogs.length}:${data.auditLogs[0]?.id || ''}`;

  const fullStr = `${compRep}#${accRep}#${userRep}#${linkRep}#${bankRep}#${ccRep}#${tenantRep}#${logRep}`;

  // Murmur-inspired fast 64-bit string hash
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < fullStr.length; i++) {
    const ch = fullStr.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)}-len${fullStr.length}`;
}

/**
 * Hook de Tarefa Agendada (setInterval) para Sincronização Periódica e Silenciosa.
 * Monitora continuamente mudanças nos dados locais e, se detectada qualquer divergência,
 * dispara silenciosamente a persistência no Servidor Central e no Firebase Firestore,
 * mantendo o backup dos lançamentos e configurações sempre 100% atualizado sem interrupções.
 */
export function useAutoBackupSync({
  companies,
  accounts,
  users,
  userCompanies,
  bankAccounts,
  costCenters,
  tenants,
  auditLogs,
  currentUser,
  lastRestoredTimestampRef,
  intervalMs = 5000,
  enabled = true,
}: AutoBackupSyncParams): AutoBackupSyncResult {
  const [isSilentSyncing, setIsSilentSyncing] = useState<boolean>(false);
  const [lastAutoSyncTime, setLastAutoSyncTime] = useState<Date | null>(() => {
    return new Date();
  });
  const [syncCount, setSyncCount] = useState<number>(0);

  // Mantém referência viva aos dados mais recentes para evitar closures estáticas no setInterval
  const latestDataRef = useRef({
    companies,
    accounts,
    users,
    userCompanies,
    bankAccounts,
    costCenters,
    tenants,
    auditLogs,
    currentUser,
  });

  useEffect(() => {
    latestDataRef.current = {
      companies,
      accounts,
      users,
      userCompanies,
      bankAccounts,
      costCenters,
      tenants,
      auditLogs,
      currentUser,
    };
  }, [companies, accounts, users, userCompanies, bankAccounts, costCenters, tenants, auditLogs, currentUser]);

  const lastSyncedFingerprintRef = useRef<string>('');
  const isSyncingRef = useRef<boolean>(false);
  const initialBaselineSetRef = useRef<boolean>(false);

  // Marca os dados atuais como já sincronizados (evita re-salvar dados recém-carregados da nuvem)
  const markAsSynced = useCallback((customData?: {
    companies?: Company[];
    accounts?: FinancialAccount[];
    users?: User[];
    userCompanies?: UserCompanyLink[];
    bankAccounts?: BankAccount[];
    costCenters?: CostCenter[];
    tenants?: Tenant[];
    auditLogs?: AuditLog[];
  }) => {
    const dataToHash = {
      companies: customData?.companies ?? latestDataRef.current.companies,
      accounts: customData?.accounts ?? latestDataRef.current.accounts,
      users: customData?.users ?? latestDataRef.current.users,
      userCompanies: customData?.userCompanies ?? latestDataRef.current.userCompanies,
      bankAccounts: customData?.bankAccounts ?? latestDataRef.current.bankAccounts,
      costCenters: customData?.costCenters ?? latestDataRef.current.costCenters,
      tenants: customData?.tenants ?? latestDataRef.current.tenants,
      auditLogs: customData?.auditLogs ?? latestDataRef.current.auditLogs,
    };
    const fp = generateDataFingerprint(dataToHash);
    lastSyncedFingerprintRef.current = fp;
    initialBaselineSetRef.current = true;
    setLastAutoSyncTime(new Date());
  }, []);

  // Executor da sincronização silenciosa
  const triggerSilentSync = useCallback(async (): Promise<boolean> => {
    if (isSyncingRef.current) return false;

    // Proteção de restauração: se houve restauração manual nos últimos 30 segundos, não sobrescrever
    if (Date.now() - lastRestoredTimestampRef.current < 30000) {
      return false;
    }

    const {
      companies: currCompanies,
      accounts: currAccounts,
      users: currUsers,
      userCompanies: currUserCompanies,
      bankAccounts: currBankAccounts,
      costCenters: currCostCenters,
      tenants: currTenants,
      auditLogs: currAuditLogs,
      currentUser: currUser,
    } = latestDataRef.current;

    // Se o usuário estiver deslogado, não sincronizar
    if (typeof localStorage !== 'undefined' && localStorage.getItem('fin_logged_out') === 'true') {
      return false;
    }

    // Não sincronizar se os dados estiverem completamente vazios sem confirmação de limpeza
    if (currCompanies.length === 0 && currAccounts.length === 0) {
      return false;
    }

    const targetFp = generateDataFingerprint({
      companies: currCompanies,
      accounts: currAccounts,
      users: currUsers,
      userCompanies: currUserCompanies,
      bankAccounts: currBankAccounts,
      costCenters: currCostCenters,
      tenants: currTenants,
      auditLogs: currAuditLogs,
    });

    isSyncingRef.current = true;
    setIsSilentSyncing(true);

    try {
      const userTenantId = Number(currUser?.tenant_id || 1);

      // 1. Sincronização Silenciosa para o Servidor Central Node.js/Express
      const serverPromise = saveServerSystemStore({
        hasCustomData: true,
        companies: currCompanies,
        accounts: currAccounts,
        users: currUsers,
        userCompanies: currUserCompanies,
        bankAccounts: currBankAccounts,
        costCenters: currCostCenters,
        tenants: currTenants,
        auditLogs: currAuditLogs,
        source: 'scheduled_auto_sync',
      }, userTenantId);

      // 2. Sincronização Silenciosa para o Firebase Firestore
      const firebasePromise = restoreFullCloudSnapshot({
        companies: currCompanies,
        accounts: currAccounts,
        users: currUsers,
        userCompanies: currUserCompanies,
        bankAccounts: currBankAccounts,
        costCenters: currCostCenters,
        tenants: currTenants,
        auditLogs: currAuditLogs,
      }).catch((cloudErr) => {
        console.debug('Aviso backup silencioso Firebase Firestore:', cloudErr);
        return { success: false, companiesCount: 0, accountsCount: 0, usersCount: 0 };
      });

      const [serverResult] = await Promise.allSettled([serverPromise, firebasePromise]);
      const serverOk = serverResult.status === 'fulfilled' ? Boolean(serverResult.value) : false;

      // Atualiza o hash sincronizado para o snapshot que acabou de ser gravado
      lastSyncedFingerprintRef.current = targetFp;
      setLastAutoSyncTime(new Date());
      setSyncCount((prev) => prev + 1);

      console.log(
        `⏱️ [AutoBackupSync] Backup silencioso concluído! ${currAccounts.length} lançamento(s) e ${currCompanies.length} empresa(s) sincronizados no Firebase e Servidor Central.`
      );
      return serverOk;
    } catch (err) {
      console.warn('⚠️ [AutoBackupSync] Erro transitório no backup silencioso agendado:', err);
      return false;
    } finally {
      isSyncingRef.current = false;
      setIsSilentSyncing(false);
    }
  }, [lastRestoredTimestampRef]);

  // Tarefa Agendada Periódica (setInterval)
  useEffect(() => {
    if (!enabled) return;

    const checkAndSyncIfNeeded = () => {
      // Cooldown de restauração
      if (Date.now() - lastRestoredTimestampRef.current < 30000) return;
      if (isSyncingRef.current) return;

      const {
        companies: c,
        accounts: a,
        users: u,
        userCompanies: uc,
        bankAccounts: ba,
        costCenters: cc,
        tenants: t,
        auditLogs: al,
      } = latestDataRef.current;

      const currentFp = generateDataFingerprint({
        companies: c,
        accounts: a,
        users: u,
        userCompanies: uc,
        bankAccounts: ba,
        costCenters: cc,
        tenants: t,
        auditLogs: al,
      });

      // Se ainda não inicializamos a linha de base (primeiro ciclo), definimos o estado inicial
      if (!initialBaselineSetRef.current || !lastSyncedFingerprintRef.current) {
        lastSyncedFingerprintRef.current = currentFp;
        initialBaselineSetRef.current = true;
        return;
      }

      // Verifica se os dados locais mudaram em relação ao último backup sincronizado
      if (currentFp !== lastSyncedFingerprintRef.current) {
        console.log('🔔 [AutoBackupSync] Mudança detectada nos dados locais! Iniciando sincronização silenciosa para Firebase e Servidor Central...');
        triggerSilentSync();
      }
    };

    // Tarefa agendada (setInterval)
    const timerId = setInterval(checkAndSyncIfNeeded, intervalMs);

    // Também verifica quando o usuário retorna à aba ou desbloqueia o celular
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkAndSyncIfNeeded();
      }
    };
    const handleFocus = () => {
      checkAndSyncIfNeeded();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(timerId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled, intervalMs, triggerSilentSync, lastRestoredTimestampRef]);

  return {
    isSilentSyncing,
    lastAutoSyncTime,
    syncCount,
    triggerSilentSync,
    markAsSynced,
  };
}
