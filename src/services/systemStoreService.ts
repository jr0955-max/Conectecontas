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

export interface SystemStorePayload {
  companies: Company[];
  accounts: FinancialAccount[];
  users: User[];
  userCompanies: UserCompanyLink[];
  bankAccounts?: BankAccount[];
  costCenters?: CostCenter[];
  tenants?: Tenant[];
  auditLogs?: AuditLog[];
  hasCustomData?: boolean;
  source?: string;
  deletedTenantId?: number;
  deletedTenantIds?: number[];
  deletedUserId?: number;
  deletedUserIds?: number[];
  deletedAccountId?: number;
  deletedAccountIds?: number[];
}

export interface SystemStoreResponse {
  success: boolean;
  hasCustomData: boolean;
  data?: SystemStorePayload | null;
  updatedAt?: string;
  message?: string;
  isBlocked?: boolean;
  error?: string;
}

/**
 * Helper to get current user's tenant ID from localStorage if available
 */
function getCachedTenantId(): number {
  if (typeof localStorage !== 'undefined') {
    try {
      const userStr = localStorage.getItem('fin_current_user');
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u && u.tenant_id) return Number(u.tenant_id);
      }
    } catch (e) {}
  }
  return 1;
}

/**
 * Helper to get current user's email and master status
 */
function getCachedUserInfo(): { email: string; isMaster: boolean } {
  if (typeof localStorage !== 'undefined') {
    try {
      const userStr = localStorage.getItem('fin_current_user');
      if (userStr) {
        const u = JSON.parse(userStr);
        const em = String(u.email || '').trim().toLowerCase();
        const isM = Boolean(u.is_master || em === 'admin@financeiro.com' || em === 'admin@finaceiro.com');
        return { email: em, isMaster: isM };
      }
    } catch (e) {}
  }
  return { email: '', isMaster: false };
}

/**
 * Consulta a base de dados centralizada no servidor Node.js/Express.
 * Garante que tanto o Preview quanto o Celular (ais-pre) leiam exatamente a mesma base.
 */
export async function fetchServerSystemStore(tenantId?: number): Promise<SystemStoreResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  const effectiveTenantId = tenantId !== undefined ? tenantId : getCachedTenantId();
  const userInfo = getCachedUserInfo();
  try {
    const res = await fetch('/api/system-store', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-tenant-id': String(effectiveTenantId || 1),
        'x-user-email': userInfo.email,
        'x-is-master': userInfo.isMaster ? 'true' : 'false',
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);
    if (res.status === 403) {
      const errJson = await res.json().catch(() => ({}));
      console.warn('⛔ [systemStoreService] HTTP 403 Forbidden (Assinatura Inativa):', errJson);
      
      // EXCEÇÃO ABSOLUTA: Tenant 1, Tenant 1788215216712 e Dono/Master NUNCA são bloqueados
      const isExempt = 
        effectiveTenantId === 1 || 
        effectiveTenantId === 1788215216712 || 
        userInfo.email === 'admin@financeiro.com' || 
        userInfo.email === 'jr0955@gmail.com' || 
        userInfo.isMaster;

      if (!isExempt && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tenant-subscription-blocked', { detail: { tenantId: effectiveTenantId } }));
      }
      return {
        success: false,
        hasCustomData: false,
        data: null,
        isBlocked: !isExempt,
        error: errJson.message || 'HTTP 403 Forbidden (Assinatura Inativa)',
      };
    }
    if (!res.ok) {
      throw new Error(`Status ${res.status} ao consultar servidor.`);
    }
    const json: SystemStoreResponse = await res.json();
    return json;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[systemStoreService] Erro ou timeout ao consultar servidor central:', err);
    return {
      success: false,
      hasCustomData: false,
      data: null,
    };
  }
}

/**
 * Salva e persiste os dados no disco do servidor.
 * Qualquer dispositivo que acessar a URL (celular, tablet ou outro navegador)
 * receberá esses mesmos dados imediatamente.
 */
export async function saveServerSystemStore(payload: SystemStorePayload, tenantId?: number): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  const effectiveTenantId = tenantId !== undefined ? tenantId : getCachedTenantId();
  const userInfo = getCachedUserInfo();
  try {
    const res = await fetch('/api/system-store', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': String(effectiveTenantId || 1),
        'x-user-email': userInfo.email,
        'x-is-master': userInfo.isMaster ? 'true' : 'false',
      },
      signal: controller.signal,
      body: JSON.stringify({
        hasCustomData: payload.hasCustomData ?? true,
        tenant_id: effectiveTenantId,
        companies: payload.companies || [],
        accounts: payload.accounts || [],
        users: payload.users || [],
        userCompanies: payload.userCompanies || [],
        bankAccounts: payload.bankAccounts || [],
        costCenters: payload.costCenters || [],
        tenants: payload.tenants || [],
        auditLogs: payload.auditLogs || [],
        source: payload.source || 'client_sync',
      }),
    });
    clearTimeout(timeoutId);
    if (res.status === 403) {
      console.warn('⛔ [systemStoreService] HTTP 403 Forbidden (Assinatura Inativa) ao tentar salvar dados no servidor.');
      const isExempt = 
        effectiveTenantId === 1 || 
        effectiveTenantId === 1788215216712 || 
        userInfo.email === 'admin@financeiro.com' || 
        userInfo.email === 'jr0955@gmail.com' || 
        userInfo.isMaster;

      if (!isExempt && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tenant-subscription-blocked', { detail: { tenantId: effectiveTenantId } }));
      }
      return false;
    }
    if (!res.ok) {
      throw new Error(`Status ${res.status} ao salvar no servidor.`);
    }
    return true;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[systemStoreService] Falha ao enviar snapshot para o servidor central:', err);
    return false;
  }
}

/**
 * Registra uma nova solicitação pública de cadastro de cliente (SaaS).
 * Persiste imediatamente no servidor (system_store.json) e Firestore para aprovação no Painel Master.
 */
export async function registerPublicUserRequest(data: {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
  empresaSolicitada?: string;
  cnpjSolicitado?: string;
}): Promise<{ success: boolean; user?: User; error?: string; message?: string }> {
  try {
    const res = await fetch('/api/auth/register-public-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return json;
  } catch (err: any) {
    console.error('Erro ao registrar solicitação pública:', err);
    return {
      success: false,
      error: err?.message || 'Erro de comunicação com o servidor central.',
    };
  }
}

/**
 * Exclui definitivamente um cliente SaaS (Tenant) no servidor central (system_store.json)
 * e remove suas filiais/dados exclusivos, impedindo que o tenant reapareça.
 */
export async function deleteServerTenant(tenantId: number): Promise<{ success: boolean; message?: string; error?: string }> {
  const userInfo = getCachedUserInfo();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(`/api/tenants/${tenantId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'x-user-email': userInfo.email,
        'x-is-master': userInfo.isMaster ? 'true' : 'false',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const json = await res.json();
    return json;
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error(`Erro ao excluir tenant #${tenantId} no servidor:`, err);
    return {
      success: false,
      error: err?.message || 'Erro de comunicação com o servidor central.',
    };
  }
}

/**
  * Exclui definitivamente um usuário no servidor central (system_store.json)
  * e remove seus vínculos, impedindo que o usuário reapareça.
  */
export async function deleteServerUser(userId: number): Promise<{ success: boolean; message?: string; error?: string }> {
  const userInfo = getCachedUserInfo();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'x-user-email': userInfo.email,
        'x-is-master': userInfo.isMaster ? 'true' : 'false',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const json = await res.json();
    return json;
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error(`Erro ao excluir usuário #${userId} no servidor:`, err);
    return {
      success: false,
      error: err?.message || 'Erro de comunicação com o servidor central.',
    };
  }
}

/**
 * Exclui ou move uma conta financeira para a lixeira no servidor central (system_store.json)
 * de forma síncrona e imediata, impedindo que a conta continue reaparecendo.
 */
export async function deleteServerAccount(accountId: number, permanent = false): Promise<{ success: boolean; message?: string; error?: string }> {
  const userInfo = getCachedUserInfo();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`/api/accounts/${accountId}?permanent=${permanent ? 'true' : 'false'}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'x-user-email': userInfo.email,
        'x-is-master': userInfo.isMaster ? 'true' : 'false',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const json = await res.json();
    return json;
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error(`Erro ao excluir conta #${accountId} no servidor:`, err);
    return {
      success: false,
      error: err?.message || 'Erro de comunicação com o servidor central.',
    };
  }
}

/**
 * Salva uma conta diretamente no servidor central
 */
export async function saveServerAccount(account: any): Promise<{ success: boolean; totalAccounts?: number; error?: string }> {
  const userInfo = getCachedUserInfo();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-user-email': userInfo.email,
        'x-is-master': userInfo.isMaster ? 'true' : 'false',
      },
      body: JSON.stringify(account),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error('Erro ao salvar conta no servidor:', err);
    return {
      success: false,
      error: err?.message || 'Erro ao comunicar com o servidor central.',
    };
  }
}

/**
 * Salva um lote de contas (CSV / Extrato) diretamente no servidor central
 */
export async function saveServerAccountsBatch(accounts: any[]): Promise<{ success: boolean; importedCount?: number; totalAccounts?: number; error?: string }> {
  const userInfo = getCachedUserInfo();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch('/api/accounts/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-user-email': userInfo.email,
        'x-is-master': userInfo.isMaster ? 'true' : 'false',
      },
      body: JSON.stringify({ accounts }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error('Erro ao salvar lote de contas no servidor:', err);
    return {
      success: false,
      error: err?.message || 'Erro ao comunicar com o servidor central.',
    };
  }
}



