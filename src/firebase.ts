import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs, 
  Firestore, 
  writeBatch 
} from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';
import { 
  Company, 
  FinancialAccount, 
  AccountStatus,
  User, 
  UserCompanyLink, 
  AuditLog, 
  SystemBackupSnapshot, 
  BankAccount, 
  CostCenter,
  Tenant,
  TenantBankingCredential,
  BillingInvoice 
} from './types';
import { 
  INITIAL_USERS, 
  INITIAL_COMPANIES, 
  INITIAL_USER_COMPANIES, 
  INITIAL_ACCOUNTS, 
  INITIAL_BANK_ACCOUNTS, 
  INITIAL_COST_CENTERS,
  INITIAL_TENANTS 
} from './data/initialData';

export const firebaseConfig = {
  projectId: firebaseConfigJson.projectId,
  appId: firebaseConfigJson.appId,
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  firestoreDatabaseId: (firebaseConfigJson as any).firestoreDatabaseId || '(default)',
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
};

// Initialize Firebase App singleton
const app: FirebaseApp = getApps().length === 0 
  ? initializeApp(firebaseConfig) 
  : getApps()[0];

export const db: Firestore = getFirestore(
  app, 
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
    ? firebaseConfig.firestoreDatabaseId 
    : undefined
);

// Cloud status indicators
export let isCloudConnected = true;

// Seed initial data to cloud ONLY if database is completely virgin
export async function seedCloudDataIfEmpty() {
  try {
    const metaRef = doc(db, 'system_meta', 'init_status');
    const metaSnap = await getDoc(metaRef).catch(() => null);
    
    // Se o banco já foi inicializado ou possui marcação de backup restaurado, NUNCA sobrescrever
    if (metaSnap && metaSnap.exists() && metaSnap.data()?.initialized) {
      return;
    }

    const [compSnapshot, tenantSnapshot, userSnapshot, accSnapshot] = await Promise.all([
      getDocs(collection(db, 'companies')),
      getDocs(collection(db, 'tenants')),
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'accounts')),
    ]);

    // Se já existem empresas ou contas na nuvem (por exemplo, após um restore), NÃO sobrescrever!
    if (!compSnapshot.empty || !accSnapshot.empty) {
      await setDoc(metaRef, { initialized: true, updated: new Date().toISOString() }, { merge: true }).catch(() => {});
      return;
    }

    // Remove any legacy admin/matriz tenant if it was accidentally saved as a tenant
    for (const d of tenantSnapshot.docs) {
      const tData = d.data() as Tenant;
      const em = (tData.email || '').trim().toLowerCase();
      if (em === 'admin@financeiro.com' || em === 'admin@finaceiro.com' || tData.nome === 'Organização Corporativa Matriz') {
        await deleteDoc(d.ref).catch((e) => console.warn('Aviso ao remover tenant admin:', e));
      }
    }

    // Apenas se o banco estiver 100% virgem
    if (compSnapshot.empty && accSnapshot.empty) {
      console.log('🌱 Base de dados 100% vazia. Inicializando primeira carga demonstrativa na nuvem (Firestore)...');
      const batch = writeBatch(db);

      // Seed Tenants
      for (const tenant of INITIAL_TENANTS) {
        const tenantRef = doc(db, 'tenants', String(tenant.id));
        batch.set(tenantRef, sanitizeTenantForFirestore(tenant), { merge: true });
      }

      // Seed 5 Companies
      for (const comp of INITIAL_COMPANIES) {
        const compRef = doc(db, 'companies', String(comp.id));
        batch.set(compRef, sanitizeCompanyForFirestore(comp), { merge: true });
      }

      // Seed Users
      for (const user of INITIAL_USERS) {
        const userRef = doc(db, 'users', String(user.id));
        batch.set(userRef, sanitizeUserForFirestore(user), { merge: true });
      }

      // Seed User Companies links
      for (const link of INITIAL_USER_COMPANIES) {
        const linkRef = doc(db, 'user_companies', String(link.id));
        batch.set(linkRef, sanitizeUserCompanyLinkForFirestore(link), { merge: true });
      }

      // Seed Bank Accounts
      for (const b of INITIAL_BANK_ACCOUNTS) {
        const bRef = doc(db, 'bank_accounts', String(b.id));
        batch.set(bRef, sanitizeBankAccountForFirestore(b), { merge: true });
      }

      // Seed Cost Centers
      for (const cc of INITIAL_COST_CENTERS) {
        const ccRef = doc(db, 'cost_centers', String(cc.id));
        batch.set(ccRef, sanitizeCostCenterForFirestore(cc), { merge: true });
      }

      // Seed Accounts
      for (const acc of INITIAL_ACCOUNTS) {
        const accRef = doc(db, 'accounts', String(acc.id));
        batch.set(accRef, sanitizeAccountForFirestore(acc), { merge: true });
      }

      // Initial system audit log
      const initialLogId = `log_${Date.now()}`;
      const logRef = doc(db, 'audit_logs', initialLogId);
      batch.set(logRef, {
        id: initialLogId,
        data_hora: new Date().toISOString(),
        usuario_nome: 'Sistema Conectecontas Master',
        acao: 'CRIACAO',
        entidade: 'sistema',
        descricao: 'Inicialização primária de controle financeiro na nuvem.'
      }, { merge: true });

      batch.set(metaRef, { initialized: true, seededAt: new Date().toISOString() }, { merge: true });
      await batch.commit();
      console.log('✅ Base de dados demonstrativa inicializada na nuvem com sucesso!');
    } else {
      await setDoc(metaRef, { initialized: true, seededAt: new Date().toISOString() }, { merge: true });
    }
  } catch (error) {
    console.warn('Nota: Erro ao verificar ou semear banco na nuvem:', error);
  }
}

// ----------------------------------------------------------------------
// Firestore Real-Time Listeners
// ----------------------------------------------------------------------

export function subscribeToTenants(onData: (tenants: Tenant[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    collection(db, 'tenants'),
    (snapshot) => {
      const data: Tenant[] = [];
      for (const d of snapshot.docs) {
        const t = d.data() as Tenant;
        const email = String(t.email || '').trim().toLowerCase();
        const nome = String(t.nome || '');

        // Se for o admin mestre ou a matriz inicial, remove do Firestore pois o master não é cliente com licença
        if (email === 'admin@financeiro.com' || email === 'admin@finaceiro.com' || nome === 'Organização Corporativa Matriz') {
          deleteDoc(d.ref).catch(() => {});
          continue;
        }

        data.push({
          id: Number(t.id || d.id),
          nome,
          email,
          telefone: t.telefone ? String(t.telefone) : undefined,
          documento: t.documento ? String(t.documento) : undefined,
          status: (t.status === 'inativo' || t.status === 'expirado') ? t.status : 'ativo',
          expiracao: t.expiracao && !t.expiracao.startsWith('2099') && !t.expiracao.startsWith('2100')
            ? t.expiracao 
            : (t.expiracao || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
          plano: t.plano || 'Corporativo Multi-Empresas',
          limite_empresas: t.limite_empresas !== undefined ? Number(t.limite_empresas) : 10,
          limite_usuarios: t.limite_usuarios !== undefined ? Number(t.limite_usuarios) : 20,
          valor_mensal: t.valor_mensal !== undefined ? Number(t.valor_mensal) : 499.00,
          observacoes: t.observacoes || undefined,
          criado_em: t.criado_em || undefined,
        });
      }
      data.sort((a, b) => a.id - b.id);
      onData(data);
    },
    (err) => {
      console.error('Erro no listener de tenants na nuvem:', err);
      if (onError) onError(err);
    }
  );
}

export function subscribeToCompanies(onData: (companies: Company[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    collection(db, 'companies'),
    (snapshot) => {
      const data: Company[] = snapshot.docs.map((d) => {
        const c = d.data() as Company;
        return {
          ...c,
          id: Number(c.id || d.id),
          tenant_id: Number(c.tenant_id || 1),
          nome: String(c.nome || ''),
          cnpj: c.cnpj ? String(c.cnpj) : undefined,
          cidade: c.cidade ? String(c.cidade) : undefined,
          estado: c.estado ? String(c.estado) : undefined,
        };
      });
      data.sort((a, b) => a.id - b.id);
      onData(data);
    },
    (err) => {
      console.error('Erro no listener de empresas na nuvem:', err);
      if (onError) onError(err);
    }
  );
}

export function subscribeToUsers(onData: (users: User[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    collection(db, 'users'),
    (snapshot) => {
      const data: User[] = snapshot.docs.map((d) => {
        const u = d.data() as User;
        const normalizedEmail = (u.email || '').trim().toLowerCase();
        const isMaster = Boolean(
          (u.is_master || normalizedEmail === 'admin@financeiro.com' || normalizedEmail === 'admin@finaceiro.com' || u.role === 'master') &&
          normalizedEmail !== 'jr0955@gmail.com'
        );
        return {
          ...u,
          id: Number(u.id || d.id),
          tenant_id: u.tenant_id !== undefined ? Number(u.tenant_id) : (isMaster ? undefined : 1),
          nome: String(u.nome || ''),
          email: String(u.email || ''),
          senha_hash: String(u.senha_hash || ''),
          acesso_todas_empresas: Boolean(u.acesso_todas_empresas || isMaster || normalizedEmail === 'jr0955@gmail.com'),
          is_master: isMaster,
          role: normalizedEmail === 'jr0955@gmail.com' ? 'admin' : (u.role || (isMaster ? 'master' : 'admin')),
          status: u.status || 'ativo',
          telefone: u.telefone ? String(u.telefone) : undefined,
          empresa_solicitada: u.empresa_solicitada ? String(u.empresa_solicitada) : undefined,
          cnpj_solicitado: u.cnpj_solicitado ? String(u.cnpj_solicitado) : undefined,
          motivo_recusa: u.motivo_recusa ? String(u.motivo_recusa) : undefined,
          aprovado_por: u.aprovado_por ? String(u.aprovado_por) : undefined,
          aprovado_em: u.aprovado_em ? String(u.aprovado_em) : undefined,
        };
      });
      data.sort((a, b) => a.id - b.id);
      onData(data);
    },
    (err) => {
      console.error('Erro no listener de usuários na nuvem:', err);
      if (onError) onError(err);
    }
  );
}

export async function fetchCloudUsers(): Promise<User[]> {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    const data: User[] = snapshot.docs.map((d) => {
      const u = d.data() as User;
      const normalizedEmail = (u.email || '').trim().toLowerCase();
      const isMaster = Boolean(
        (u.is_master || normalizedEmail === 'admin@financeiro.com' || normalizedEmail === 'admin@finaceiro.com' || u.role === 'master') &&
        normalizedEmail !== 'jr0955@gmail.com'
      );
      return {
        ...u,
        id: Number(u.id || d.id),
        tenant_id: u.tenant_id !== undefined ? Number(u.tenant_id) : (isMaster ? undefined : 1),
        nome: String(u.nome || ''),
        email: String(u.email || ''),
        senha_hash: String(u.senha_hash || ''),
        acesso_todas_empresas: Boolean(u.acesso_todas_empresas || isMaster || normalizedEmail === 'jr0955@gmail.com'),
        is_master: isMaster,
        role: normalizedEmail === 'jr0955@gmail.com' ? 'admin' : (u.role || (isMaster ? 'master' : 'admin')),
        status: u.status || 'ativo',
        telefone: u.telefone ? String(u.telefone) : undefined,
        empresa_solicitada: u.empresa_solicitada ? String(u.empresa_solicitada) : undefined,
        cnpj_solicitado: u.cnpj_solicitado ? String(u.cnpj_solicitado) : undefined,
        motivo_recusa: u.motivo_recusa ? String(u.motivo_recusa) : undefined,
        aprovado_por: u.aprovado_por ? String(u.aprovado_por) : undefined,
        aprovado_em: u.aprovado_em ? String(u.aprovado_em) : undefined,
      };
    });
    data.sort((a, b) => a.id - b.id);
    return data;
  } catch (err) {
    console.warn('Erro ao buscar usuários diretamente na nuvem:', err);
    return [];
  }
}

export function subscribeToUserCompanies(onData: (links: UserCompanyLink[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    collection(db, 'user_companies'),
    (snapshot) => {
      const data: UserCompanyLink[] = snapshot.docs.map((d) => {
        const l = d.data() as UserCompanyLink;
        return {
          id: Number(l.id || d.id),
          usuario_id: Number(l.usuario_id),
          empresa_id: Number(l.empresa_id),
          tenant_id: l.tenant_id !== undefined ? Number(l.tenant_id) : undefined,
        };
      });
      onData(data);
    },
    (err) => {
      console.error('Erro no listener de links de empresas/usuários na nuvem:', err);
      if (onError) onError(err);
    }
  );
}

export function subscribeToAccounts(onData: (accounts: FinancialAccount[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    collection(db, 'accounts'),
    (snapshot) => {
      const data: FinancialAccount[] = snapshot.docs.map((d) => {
        const a = d.data() as FinancialAccount;
        return {
          ...a,
          id: Number(a.id || d.id),
          tenant_id: a.tenant_id !== undefined ? Number(a.tenant_id) : 1,
          empresa_id: Number(a.empresa_id),
          valor: Number(a.valor || 0),
          tipo: (a.tipo === 'receber' ? 'receber' : 'pagar') as 'pagar' | 'receber',
          status: (() => {
            const raw = String(a.status || '').trim().toLowerCase();
            if (raw === 'pago' || raw === 'paga' || raw === 'paid') {
              return (a.tipo === 'receber' ? 'Recebido' : 'Pago') as AccountStatus;
            }
            if (raw === 'recebido' || raw === 'recebida' || raw === 'received') {
              return 'Recebido' as AccountStatus;
            }
            if (raw === 'vencido' || raw === 'vencida') {
              return 'Vencido' as AccountStatus;
            }
            if (raw === 'pendente' || raw === 'pending' || raw === 'aberto' || raw === 'em aberto' || !raw) {
              return 'Pendente' as AccountStatus;
            }
            if (a.status === 'Pago' || a.status === 'Recebido' || a.status === 'Pendente' || a.status === 'Vencido') {
              return a.status as AccountStatus;
            }
            return 'Pendente' as AccountStatus;
          })(),
          descricao: String(a.descricao || ''),
          data_vencimento: a.data_vencimento || new Date().toISOString().split('T')[0],
          categoria: a.categoria || 'Geral',
          observacoes: a.observacoes || undefined,
          banco_origem: a.banco_origem || undefined,
          documento_ref: a.documento_ref || undefined,
          banco_id: a.banco_id !== undefined ? Number(a.banco_id) : undefined,
          centro_custo_id: a.centro_custo_id !== undefined ? Number(a.centro_custo_id) : undefined,
          parcela_atual: a.parcela_atual !== undefined ? Number(a.parcela_atual) : undefined,
          total_parcelas: a.total_parcelas !== undefined ? Number(a.total_parcelas) : undefined,
          recorrencia_id: a.recorrencia_id || undefined,
          recorrencia_tipo: a.recorrencia_tipo || undefined,
          chave_pix: a.chave_pix || undefined,
          chave_pix_tipo: a.chave_pix_tipo || undefined,
          codigo_barras: a.codigo_barras || undefined,
          comprovante_bancario_id: a.comprovante_bancario_id || undefined,
          banco_pagamento: a.banco_pagamento || undefined,
          pago_via_api: Boolean(a.pago_via_api),
          pago_em: a.pago_em || undefined,
          conciliado: Boolean(a.conciliado),
          conciliado_em: a.conciliado_em || undefined,
          conciliado_fitid: a.conciliado_fitid || undefined,
          conciliado_por: a.conciliado_por || undefined,
          criado_por: a.criado_por || undefined,
          criado_em: a.criado_em || undefined,
          atualizado_por: a.atualizado_por || undefined,
          atualizado_em: a.atualizado_em || undefined,
          excluido: Boolean(a.excluido),
          excluido_em: a.excluido_em || undefined,
          excluido_por: a.excluido_por || undefined,
        };
      });
      data.sort((a, b) => b.id - a.id);
      onData(data);
    },
    (err) => {
      console.error('Erro no listener de contas financeiras na nuvem:', err);
      if (onError) onError(err);
    }
  );
}

export function subscribeToBankAccounts(onData: (bankAccounts: BankAccount[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    collection(db, 'bank_accounts'),
    (snapshot) => {
      const data: BankAccount[] = snapshot.docs.map((d) => {
        const b = d.data() as BankAccount;
        return {
          ...b,
          id: Number(b.id || d.id),
          tenant_id: b.tenant_id !== undefined ? Number(b.tenant_id) : 1,
          empresa_id: Number(b.empresa_id),
          nome_banco: String(b.nome_banco || ''),
          tipo_conta: b.tipo_conta || 'corrente',
          saldo_inicial: Number(b.saldo_inicial || 0),
          padrao: Boolean(b.padrao),
          agencia: b.agencia || undefined,
          numero_conta: b.numero_conta || undefined,
          cor: b.cor || undefined,
          descricao: b.descricao || undefined,
        };
      });
      data.sort((a, b) => a.id - b.id);
      onData(data);
    },
    (err) => {
      console.error('Erro no listener de contas bancárias na nuvem:', err);
      if (onError) onError(err);
    }
  );
}

export function subscribeToCostCenters(onData: (costCenters: CostCenter[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    collection(db, 'cost_centers'),
    (snapshot) => {
      const data: CostCenter[] = snapshot.docs.map((d) => {
        const cc = d.data() as CostCenter;
        return {
          ...cc,
          id: Number(cc.id || d.id),
          tenant_id: cc.tenant_id !== undefined ? Number(cc.tenant_id) : 1,
          empresa_id: Number(cc.empresa_id || 0),
          nome: String(cc.nome || ''),
          codigo: cc.codigo || undefined,
          cor: cc.cor || undefined,
          descricao: cc.descricao || undefined,
        };
      });
      data.sort((a, b) => a.id - b.id);
      onData(data);
    },
    (err) => {
      console.error('Erro no listener de centros de custo na nuvem:', err);
      if (onError) onError(err);
    }
  );
}

export function subscribeToAuditLogs(onData: (logs: AuditLog[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    collection(db, 'audit_logs'),
    (snapshot) => {
      const data: AuditLog[] = snapshot.docs.map((d) => {
        const l = d.data() as AuditLog;
        return {
          id: String(l.id || d.id),
          data_hora: l.data_hora || new Date().toISOString(),
          usuario_id: l.usuario_id !== undefined ? Number(l.usuario_id) : undefined,
          usuario_nome: String(l.usuario_nome || 'Usuário'),
          usuario_email: l.usuario_email || undefined,
          acao: l.acao || 'EDICAO',
          entidade: l.entidade || 'conta',
          entidade_id: l.entidade_id !== undefined ? l.entidade_id : undefined,
          tenant_id: l.tenant_id !== undefined ? Number(l.tenant_id) : undefined,
          empresa_id: l.empresa_id !== undefined ? Number(l.empresa_id) : undefined,
          empresa_nome: l.empresa_nome || undefined,
          descricao: String(l.descricao || ''),
          detalhes: l.detalhes || undefined,
        };
      });
      data.sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime());
      onData(data);
    },
    (err) => {
      console.error('Erro no listener de logs de auditoria:', err);
      if (onError) onError(err);
    }
  );
}

export function subscribeToBankingCredentials(
  onData: (creds: TenantBankingCredential[]) => void,
  onError?: (err: Error) => void
) {
  return onSnapshot(
    collection(db, 'tenant_banking_credentials'),
    (snapshot) => {
      const data: TenantBankingCredential[] = snapshot.docs.map((d) => {
        const c = d.data() as any;
        return {
          id: String(c.id || d.id),
          tenant_id: Number(c.tenant_id || 1),
          company_id: Number(c.company_id || c.empresa_id || 1),
          provider: (c.provider || 'bb') as 'bb' | 'stone' | 'infinitepay',
          client_id: String(c.client_id || ''),
          client_secret: c.client_secret || undefined,
          webhook_secret: c.webhook_secret || undefined,
          chave_pix: c.chave_pix || undefined,
          certificado_path: c.certificado_path || undefined,
          ambiente: (c.ambiente || 'sandbox') as 'sandbox' | 'producao',
          status: (c.status || 'ativo') as 'ativo' | 'inativo',
          criado_em: c.criado_em || new Date().toISOString().split('T')[0],
          atualizado_em: c.atualizado_em || undefined,
          criado_por: c.criado_por || undefined,
          atualizado_por: c.atualizado_por || undefined,
          has_client_secret: Boolean(c.client_secret || c.has_client_secret),
          has_webhook_secret: Boolean(c.webhook_secret || c.has_webhook_secret),
          masked_client_id: c.masked_client_id || (c.client_id ? (c.client_id.length > 8 ? `${c.client_id.substring(0, 4)}••••${c.client_id.substring(c.client_id.length - 4)}` : '••••••••') : ''),
          masked_client_secret: '••••••••••••',
          masked_webhook_secret: '••••••••••••',
        };
      });
      data.sort((a, b) => (b.atualizado_em || b.criado_em || '').localeCompare(a.atualizado_em || a.criado_em || ''));
      onData(data);
    },
    (err) => {
      console.error('Erro no listener de credenciais bancárias:', err);
      if (onError) onError(err);
    }
  );
}

export function subscribeToBillingInvoices(
  onData: (invoices: BillingInvoice[]) => void,
  onError?: (err: Error) => void
) {
  return onSnapshot(
    collection(db, 'billing_invoices'),
    (snapshot) => {
      const data: BillingInvoice[] = snapshot.docs.map((d) => {
        const inv = d.data() as any;
        return {
          id: String(inv.id || d.id),
          tenant_id: Number(inv.tenant_id || 1),
          valor: Number(inv.valor || 0),
          status: inv.status || 'pending',
          data_pagamento: inv.data_pagamento || new Date().toISOString(),
          forma_pagamento: inv.forma_pagamento || 'Mercado Pago (Cartão / Pix)',
          mercadopago_id: inv.mercadopago_id || undefined,
          preapproval_id: inv.preapproval_id || undefined,
          external_reference: inv.external_reference || undefined,
          plano: inv.plano || 'Profissional',
          descricao: inv.descricao || 'Mensalidade SaaS Conectecontas',
          payer_email: inv.payer_email || undefined,
          comprovante_url: inv.comprovante_url || undefined,
        };
      });
      data.sort((a, b) => new Date(b.data_pagamento).getTime() - new Date(a.data_pagamento).getTime());
      onData(data);
    },
    (err) => {
      console.error('Erro no listener de faturas de cobrança:', err);
      if (onError) onError(err);
    }
  );
}

// ----------------------------------------------------------------------
// Sanitizers for Firestore (Avoid undefined values)
// ----------------------------------------------------------------------

export function removeUndefinedFields<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const clean: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        clean[key] = removeUndefinedFields(value);
      } else {
        clean[key] = value;
      }
    }
  }
  return clean;
}

export function sanitizeBillingInvoiceForFirestore(inv: BillingInvoice): Record<string, any> {
  const clean: Record<string, any> = {
    id: String(inv.id),
    tenant_id: Number(inv.tenant_id || 1),
    valor: Number(inv.valor || 0),
    status: inv.status || 'pending',
    data_pagamento: inv.data_pagamento || new Date().toISOString(),
    forma_pagamento: inv.forma_pagamento || 'Mercado Pago',
    plano: inv.plano || 'Profissional',
    descricao: (inv.descricao || 'Mensalidade Conectecontas').trim(),
  };
  if (inv.mercadopago_id) clean.mercadopago_id = String(inv.mercadopago_id);
  if (inv.preapproval_id) clean.preapproval_id = String(inv.preapproval_id);
  if (inv.external_reference) clean.external_reference = String(inv.external_reference);
  if (inv.payer_email) clean.payer_email = String(inv.payer_email).toLowerCase().trim();
  if (inv.comprovante_url) clean.comprovante_url = String(inv.comprovante_url);
  return removeUndefinedFields(clean);
}

export function sanitizeTenantForFirestore(tenant: Tenant): Record<string, any> {
  const rawId = Number(tenant.id);
  const cleanId = Number.isFinite(rawId) && rawId > 0 ? rawId : Date.now();

  const rawEmpresas = Number(tenant.limite_empresas ?? tenant.max_subempresas);
  const limiteEmpresas = Number.isFinite(rawEmpresas) && rawEmpresas > 0 ? rawEmpresas : 5;

  const rawUsuarios = Number(tenant.limite_usuarios ?? tenant.max_usuarios);
  const limiteUsuarios = Number.isFinite(rawUsuarios) && rawUsuarios > 0 ? rawUsuarios : 10;

  const rawValor = Number(tenant.valor_mensal);
  const valorMensal = Number.isFinite(rawValor) && rawValor >= 0 ? rawValor : 299.90;

  const clean: Record<string, any> = {
    id: cleanId,
    nome: (tenant.nome || 'Cliente SaaS').trim(),
    email: (tenant.email || '').trim().toLowerCase(),
    status: tenant.status || 'ativo',
    expiracao: tenant.expiracao || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    plano: tenant.plano || 'Profissional',
    limite_empresas: limiteEmpresas,
    limite_usuarios: limiteUsuarios,
    max_subempresas: limiteEmpresas,
    max_usuarios: limiteUsuarios,
    valor_mensal: valorMensal,
    criado_em: tenant.criado_em || new Date().toISOString().split('T')[0],
  };
  if (tenant.telefone && tenant.telefone.trim()) clean.telefone = tenant.telefone.trim();
  if (tenant.documento && tenant.documento.trim()) clean.documento = tenant.documento.trim();
  if (tenant.observacoes && tenant.observacoes.trim()) clean.observacoes = tenant.observacoes.trim();
  return removeUndefinedFields(clean);
}

export function sanitizeCompanyForFirestore(company: Company): Record<string, any> {
  const clean: Record<string, any> = {
    id: Number(company.id),
    tenant_id: Number(company.tenant_id || 1),
    nome: company.nome ? company.nome.trim() : 'Empresa',
    criado_em: company.criado_em || new Date().toISOString().split('T')[0],
  };
  if (company.cnpj && company.cnpj.trim()) clean.cnpj = company.cnpj.trim();
  if (company.cidade && company.cidade.trim()) clean.cidade = company.cidade.trim();
  if (company.estado && company.estado.trim()) clean.estado = company.estado.trim();
  if (company.saldo_atual !== undefined && company.saldo_atual !== null) clean.saldo_atual = Number(company.saldo_atual);
  if (company.saldo_projetado !== undefined && company.saldo_projetado !== null) clean.saldo_projetado = Number(company.saldo_projetado);
  if (company.total_receitas_pagas !== undefined && company.total_receitas_pagas !== null) clean.total_receitas_pagas = Number(company.total_receitas_pagas);
  if (company.total_despesas_pagas !== undefined && company.total_despesas_pagas !== null) clean.total_despesas_pagas = Number(company.total_despesas_pagas);
  if (company.atualizado_em) clean.atualizado_em = company.atualizado_em;
  return removeUndefinedFields(clean);
}

export function sanitizeUserForFirestore(user: User): Record<string, any> {
  const clean: Record<string, any> = {
    id: Number(user.id),
    nome: (user.nome || '').trim(),
    email: (user.email || '').trim().toLowerCase(),
    senha_hash: user.senha_hash || '123456',
    acesso_todas_empresas: Boolean(user.acesso_todas_empresas),
    is_master: Boolean(user.is_master || user.email?.toLowerCase() === 'admin@financeiro.com' || Number(user.id) === 1 || user.role === 'master'),
    role: user.role || (user.is_master || Number(user.id) === 1 ? 'master' : 'admin'),
    status: user.status || 'ativo',
    criado_em: user.criado_em || new Date().toISOString().split('T')[0],
  };
  if (user.tenant_id !== undefined && user.tenant_id !== null && !isNaN(Number(user.tenant_id))) {
    clean.tenant_id = Number(user.tenant_id);
  }
  if (user.telefone && user.telefone.trim()) clean.telefone = user.telefone.trim();
  if (user.empresa_solicitada && user.empresa_solicitada.trim()) clean.empresa_solicitada = user.empresa_solicitada.trim();
  if (user.cnpj_solicitado && user.cnpj_solicitado.trim()) clean.cnpj_solicitado = user.cnpj_solicitado.trim();
  if (user.motivo_recusa && user.motivo_recusa.trim()) clean.motivo_recusa = user.motivo_recusa.trim();
  if (user.aprovado_por && user.aprovado_por.trim()) clean.aprovado_por = user.aprovado_por.trim();
  if (user.aprovado_em && user.aprovado_em.trim()) clean.aprovado_em = user.aprovado_em.trim();
  if (user.permissions) clean.permissions = user.permissions;
  return removeUndefinedFields(clean);
}

export function sanitizeAccountForFirestore(account: FinancialAccount | Omit<FinancialAccount, 'id'> & { id?: number }): Record<string, any> {
  const compIdNum = Number(account.empresa_id);
  const tenantIdNum = Number(account.tenant_id);
  const clean: Record<string, any> = {
    tenant_id: !isNaN(tenantIdNum) && tenantIdNum > 0 ? tenantIdNum : 1,
    empresa_id: !isNaN(compIdNum) && compIdNum > 0 ? compIdNum : 1,
    tipo: account.tipo === 'receber' ? 'receber' : 'pagar',
    descricao: (account.descricao || '').trim(),
    valor: !isNaN(Number(account.valor)) ? Math.abs(Number(account.valor)) : 0,
    data_vencimento: account.data_vencimento || new Date().toISOString().split('T')[0],
    status: account.status || 'Pendente',
    categoria: (account.categoria || 'Geral').trim(),
  };

  if (account.id !== undefined && account.id !== null && !isNaN(Number(account.id))) {
    clean.id = Number(account.id);
  }
  if (account.observacoes && account.observacoes.trim()) {
    clean.observacoes = account.observacoes.trim();
  }
  if (account.banco_origem && account.banco_origem.trim()) {
    clean.banco_origem = account.banco_origem.trim();
  }
  if (account.documento_ref && account.documento_ref.trim()) {
    clean.documento_ref = account.documento_ref.trim();
  }
  if (account.banco_id !== undefined && account.banco_id !== null && !isNaN(Number(account.banco_id))) {
    clean.banco_id = Number(account.banco_id);
  }
  if (account.centro_custo_id !== undefined && account.centro_custo_id !== null && !isNaN(Number(account.centro_custo_id))) {
    clean.centro_custo_id = Number(account.centro_custo_id);
  }
  if (account.parcela_atual !== undefined && account.parcela_atual !== null && !isNaN(Number(account.parcela_atual))) {
    clean.parcela_atual = Number(account.parcela_atual);
  }
  if (account.total_parcelas !== undefined && account.total_parcelas !== null && !isNaN(Number(account.total_parcelas))) {
    clean.total_parcelas = Number(account.total_parcelas);
  }
  if (account.recorrencia_id && account.recorrencia_id.trim()) {
    clean.recorrencia_id = account.recorrencia_id.trim();
  }
  if (account.recorrencia_tipo) {
    clean.recorrencia_tipo = account.recorrencia_tipo;
  }
  if (account.chave_pix && account.chave_pix.trim()) {
    clean.chave_pix = account.chave_pix.trim();
  }
  if (account.chave_pix_tipo) {
    clean.chave_pix_tipo = account.chave_pix_tipo;
  }
  if (account.codigo_barras && account.codigo_barras.trim()) {
    clean.codigo_barras = account.codigo_barras.trim();
  }
  if (account.comprovante_bancario_id && account.comprovante_bancario_id.trim()) {
    clean.comprovante_bancario_id = account.comprovante_bancario_id.trim();
  }
  if (account.banco_pagamento && account.banco_pagamento.trim()) {
    clean.banco_pagamento = account.banco_pagamento.trim();
  }
  if (account.pago_via_api !== undefined) {
    clean.pago_via_api = Boolean(account.pago_via_api);
  }
  if (account.pago_em && account.pago_em.trim()) {
    clean.pago_em = account.pago_em.trim();
  }
  if (account.conciliado !== undefined) {
    clean.conciliado = Boolean(account.conciliado);
  }
  if (account.conciliado_em) {
    clean.conciliado_em = account.conciliado_em;
  }
  if (account.conciliado_fitid && account.conciliado_fitid.trim()) {
    clean.conciliado_fitid = account.conciliado_fitid.trim();
  }
  if (account.conciliado_por && account.conciliado_por.trim()) {
    clean.conciliado_por = account.conciliado_por.trim();
  }
  if (account.criado_por && account.criado_por.trim()) {
    clean.criado_por = account.criado_por.trim();
  }
  if (account.criado_em) {
    clean.criado_em = account.criado_em;
  }
  if (account.atualizado_por && account.atualizado_por.trim()) {
    clean.atualizado_por = account.atualizado_por.trim();
  }
  if (account.atualizado_em) {
    clean.atualizado_em = account.atualizado_em;
  }
  if (account.excluido !== undefined) {
    clean.excluido = Boolean(account.excluido);
  }
  if (account.excluido_em) {
    clean.excluido_em = account.excluido_em;
  }
  if (account.excluido_por && account.excluido_por.trim()) {
    clean.excluido_por = account.excluido_por.trim();
  }
  return removeUndefinedFields(clean);
}

export function sanitizeBankAccountForFirestore(bank: BankAccount): Record<string, any> {
  const compIdNum = Number(bank.empresa_id);
  const tenantIdNum = Number(bank.tenant_id);
  const clean: Record<string, any> = {
    id: !isNaN(Number(bank.id)) ? Number(bank.id) : Date.now(),
    tenant_id: !isNaN(tenantIdNum) && tenantIdNum > 0 ? tenantIdNum : 1,
    empresa_id: !isNaN(compIdNum) && compIdNum > 0 ? compIdNum : 1,
    nome_banco: (bank.nome_banco || 'Conta').trim(),
    tipo_conta: bank.tipo_conta || 'corrente',
    saldo_inicial: !isNaN(Number(bank.saldo_inicial)) ? Number(bank.saldo_inicial) : 0,
    padrao: Boolean(bank.padrao),
    criado_em: bank.criado_em || new Date().toISOString().split('T')[0],
  };
  if (bank.agencia && bank.agencia.trim()) clean.agencia = bank.agencia.trim();
  if (bank.numero_conta && bank.numero_conta.trim()) clean.numero_conta = bank.numero_conta.trim();
  if (bank.cor && bank.cor.trim()) clean.cor = bank.cor.trim();
  if (bank.descricao && bank.descricao.trim()) clean.descricao = bank.descricao.trim();
  return removeUndefinedFields(clean);
}

export function sanitizeCostCenterForFirestore(cc: CostCenter): Record<string, any> {
  const compIdNum = Number(cc.empresa_id);
  const tenantIdNum = Number(cc.tenant_id);
  const clean: Record<string, any> = {
    id: !isNaN(Number(cc.id)) ? Number(cc.id) : Date.now(),
    tenant_id: !isNaN(tenantIdNum) && tenantIdNum > 0 ? tenantIdNum : 1,
    empresa_id: !isNaN(compIdNum) && compIdNum >= 0 ? compIdNum : 0,
    nome: (cc.nome || 'Centro de Custo').trim(),
    criado_em: cc.criado_em || new Date().toISOString().split('T')[0],
  };
  if (cc.codigo && cc.codigo.trim()) clean.codigo = cc.codigo.trim();
  if (cc.cor && cc.cor.trim()) clean.cor = cc.cor.trim();
  if (cc.descricao && cc.descricao.trim()) clean.descricao = cc.descricao.trim();
  return removeUndefinedFields(clean);
}

export function sanitizeAuditLogForFirestore(log: AuditLog): Record<string, any> {
  const clean: Record<string, any> = {
    id: String(log.id),
    data_hora: log.data_hora || new Date().toISOString(),
    usuario_nome: (log.usuario_nome || 'Usuário').trim(),
    acao: log.acao || 'EDICAO',
    entidade: log.entidade || 'conta',
    descricao: (log.descricao || '').trim(),
  };
  if (log.usuario_id !== undefined && log.usuario_id !== null && !isNaN(Number(log.usuario_id))) {
    clean.usuario_id = Number(log.usuario_id);
  }
  if (log.usuario_email && log.usuario_email.trim()) {
    clean.usuario_email = log.usuario_email.trim().toLowerCase();
  }
  if (log.entidade_id !== undefined && log.entidade_id !== null) {
    clean.entidade_id = String(log.entidade_id);
  }
  if (log.tenant_id !== undefined && log.tenant_id !== null && !isNaN(Number(log.tenant_id))) {
    clean.tenant_id = Number(log.tenant_id);
  }
  if (log.empresa_id !== undefined && log.empresa_id !== null && !isNaN(Number(log.empresa_id))) {
    clean.empresa_id = Number(log.empresa_id);
  }
  if (log.empresa_nome && log.empresa_nome.trim()) {
    clean.empresa_nome = log.empresa_nome.trim();
  }
  if (log.detalhes && typeof log.detalhes === 'object') {
    clean.detalhes = log.detalhes;
  }
  return removeUndefinedFields(clean);
}

export function sanitizeUserCompanyLinkForFirestore(link: UserCompanyLink | any): Record<string, any> {
  const clean: Record<string, any> = {
    id: !isNaN(Number(link.id)) ? Number(link.id) : Date.now(),
    usuario_id: !isNaN(Number(link.usuario_id)) ? Number(link.usuario_id) : 1,
    empresa_id: !isNaN(Number(link.empresa_id)) ? Number(link.empresa_id) : 1,
  };
  if (link.tenant_id !== undefined && link.tenant_id !== null && !isNaN(Number(link.tenant_id))) {
    clean.tenant_id = Number(link.tenant_id);
  }
  return removeUndefinedFields(clean);
}

export function sanitizeBankingCredentialForFirestore(cred: TenantBankingCredential): Record<string, any> {
  const clean: Record<string, any> = {
    id: String(cred.id),
    tenant_id: Number(cred.tenant_id || 1),
    company_id: Number(cred.company_id || 1),
    provider: cred.provider,
    client_id: (cred.client_id || '').trim(),
    ambiente: cred.ambiente || 'sandbox',
    status: cred.status || 'ativo',
    criado_em: cred.criado_em || new Date().toISOString().split('T')[0],
  };
  if (cred.client_secret && cred.client_secret.trim()) clean.client_secret = cred.client_secret.trim();
  if (cred.webhook_secret && cred.webhook_secret.trim()) clean.webhook_secret = cred.webhook_secret.trim();
  if (cred.chave_pix && cred.chave_pix.trim()) clean.chave_pix = cred.chave_pix.trim();
  if (cred.certificado_path && cred.certificado_path.trim()) clean.certificado_path = cred.certificado_path.trim();
  if (cred.atualizado_em) clean.atualizado_em = cred.atualizado_em;
  if (cred.criado_por && cred.criado_por.trim()) clean.criado_por = cred.criado_por.trim();
  if (cred.atualizado_por && cred.atualizado_por.trim()) clean.atualizado_por = cred.atualizado_por.trim();
  return removeUndefinedFields(clean);
}

// ----------------------------------------------------------------------
// Database Mutation Helpers
// ----------------------------------------------------------------------

// Tenant Mutations
export async function saveCloudTenant(tenant: Tenant): Promise<void> {
  const rawId = Number(tenant.id);
  const tenantId = Number.isFinite(rawId) && rawId > 0 ? rawId : Date.now();
  const tenantRef = doc(db, 'tenants', String(tenantId));
  const payload = sanitizeTenantForFirestore({ ...tenant, id: tenantId });
  
  try {
    // Timeout de 3.5 segundos para garantir que a interface nunca fique travada esperando o Firestore
    await Promise.race([
      setDoc(tenantRef, payload, { merge: true }),
      new Promise((resolve) => setTimeout(resolve, 3500)),
    ]);
  } catch (err) {
    console.warn('Aviso ao sincronizar tenant com nuvem Firestore:', err);
  }
}

export async function saveCloudBillingInvoice(inv: BillingInvoice): Promise<void> {
  const invoiceId = String(inv.id);
  const invRef = doc(db, 'billing_invoices', invoiceId);
  const payload = sanitizeBillingInvoiceForFirestore(inv);
  await setDoc(invRef, payload);
}

export async function deleteCloudBillingInvoice(invoiceId: string): Promise<void> {
  const invRef = doc(db, 'billing_invoices', String(invoiceId));
  await deleteDoc(invRef);
}

export async function deleteCloudTenant(tenantId: number): Promise<void> {
  const rawId = Number(tenantId);
  if (!Number.isFinite(rawId) || rawId <= 0) return;
  const tenantRef = doc(db, 'tenants', String(rawId));
  try {
    await Promise.race([
      deleteDoc(tenantRef),
      new Promise((resolve) => setTimeout(resolve, 3500)),
    ]);
  } catch (err) {
    console.warn('Aviso ao excluir tenant na nuvem:', err);
  }
}

export async function saveCloudTenantsBatch(tenants: Tenant[]): Promise<void> {
  const batch = writeBatch(db);
  for (const t of tenants) {
    const ref = doc(db, 'tenants', String(Number(t.id)));
    batch.set(ref, sanitizeTenantForFirestore(t));
  }
  await batch.commit();
}

// Company Mutations
export async function saveCloudCompany(company: Company): Promise<void> {
  const compId = Number(company.id);
  const compRef = doc(db, 'companies', String(compId));
  const cleanComp = sanitizeCompanyForFirestore(company);
  await setDoc(compRef, cleanComp);
}

export async function deleteCloudCompany(companyId: number): Promise<void> {
  const compId = Number(companyId);
  const compRef = doc(db, 'companies', String(compId));
  await deleteDoc(compRef);
}

/**
 * Função centralizadora de recálculo de saldo da empresa.
 * Faz o SUM de receitas Pagas/Recebidas e subtrai o SUM de despesas Pagas no banco de dados.
 * Atualiza e persiste o campo 'saldo_atual' diretamente no documento da empresa no Firestore.
 */
export async function recalcularSaldoTotal(empresaId: number): Promise<{
  empresaId: number;
  saldo_atual: number;
  saldo_projetado: number;
  total_receitas_pagas: number;
  total_despesas_pagas: number;
}> {
  const targetId = Number(empresaId || 1);
  const nowIso = new Date().toISOString();
  try {
    const snap = await getDocs(collection(db, 'accounts'));
    let totalReceitasPagas = 0;
    let totalDespesasPagas = 0;
    let totalReceitasGeral = 0;
    let totalDespesasGeral = 0;

    snap.docs.forEach((d) => {
      const a = d.data() as any;
      if (a.excluido) return;
      const accEmpresaId = Number(a.empresa_id !== undefined ? a.empresa_id : a.empresaId || 1);
      if (accEmpresaId !== targetId) return;

      const val = Number(a.valor || 0);
      const tipo = String(a.tipo || '').toLowerCase();
      const status = String(a.status || '').toLowerCase();
      const isPaid = status === 'pago' || status === 'recebido' || status === 'paid';

      if (tipo === 'receber') {
        totalReceitasGeral += val;
        if (isPaid) totalReceitasPagas += val;
      } else {
        totalDespesasGeral += val;
        if (isPaid) totalDespesasPagas += val;
      }
    });

    const saldoAtual = Number((totalReceitasPagas - totalDespesasPagas).toFixed(2));
    const saldoProjetado = Number((totalReceitasGeral - totalDespesasGeral).toFixed(2));

    const compRef = doc(db, 'companies', String(targetId));
    await setDoc(
      compRef,
      {
        saldo_atual: saldoAtual,
        saldo_projetado: saldoProjetado,
        total_receitas_pagas: Number(totalReceitasPagas.toFixed(2)),
        total_despesas_pagas: Number(totalDespesasPagas.toFixed(2)),
        atualizado_em: nowIso,
        atualizado_por: 'Centralizador recalcularSaldoTotal',
      },
      { merge: true }
    );

    return {
      empresaId: targetId,
      saldo_atual: saldoAtual,
      saldo_projetado: saldoProjetado,
      total_receitas_pagas: totalReceitasPagas,
      total_despesas_pagas: totalDespesasPagas,
    };
  } catch (err) {
    console.error('Erro ao recalcular saldo no cliente:', err);
    return {
      empresaId: targetId,
      saldo_atual: 0,
      saldo_projetado: 0,
      total_receitas_pagas: 0,
      total_despesas_pagas: 0,
    };
  }
}

// User Mutations
export async function saveCloudUser(user: User): Promise<void> {
  const userId = Number(user.id);
  const userRef = doc(db, 'users', String(userId));
  const cleanUser = sanitizeUserForFirestore(user);
  await setDoc(userRef, cleanUser);
}

export async function deleteCloudUser(userId: number, userEmail?: string): Promise<void> {
  const userIdNum = Number(userId);
  try {
    // 1. Exclui o documento direto pelo ID numérico
    await deleteDoc(doc(db, 'users', String(userIdNum))).catch(() => {});

    // 2. Se houver e-mail ou documento com chave alternativa, busca e exclui
    const normalizedEmail = (userEmail || '').trim().toLowerCase();
    if (normalizedEmail) {
      await deleteDoc(doc(db, 'users', normalizedEmail)).catch(() => {});
    }

    // 3. Remove em lote quaisquer referências remanescentes em users e user_companies
    const [userSnap, linkSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'user_companies')),
    ]);

    const batch = writeBatch(db);
    let hasDeletions = false;

    userSnap.docs.forEach((docSnapshot) => {
      const data = docSnapshot.data() as any;
      const dEmail = (data.email || '').trim().toLowerCase();
      if (
        Number(data.id) === userIdNum ||
        docSnapshot.id === String(userIdNum) ||
        (normalizedEmail && (dEmail === normalizedEmail || docSnapshot.id === normalizedEmail))
      ) {
        batch.delete(docSnapshot.ref);
        hasDeletions = true;
      }
    });

    linkSnap.docs.forEach((docSnapshot) => {
      const link = docSnapshot.data() as UserCompanyLink;
      if (Number(link.usuario_id) === userIdNum) {
        batch.delete(docSnapshot.ref);
        hasDeletions = true;
      }
    });

    if (hasDeletions) {
      await batch.commit();
    }
  } catch (err) {
    console.warn('Erro ao excluir usuário no Firestore:', err);
  }
}

export async function saveCloudUserCompanyLinks(userId: number, allowedCompanyIds: number[]): Promise<void> {
  const snapshot = await getDocs(collection(db, 'user_companies'));
  const batch = writeBatch(db);
  
  // Delete current links for this user
  snapshot.docs.forEach((docSnapshot) => {
    const link = docSnapshot.data() as UserCompanyLink;
    if (Number(link.usuario_id) === Number(userId)) {
      batch.delete(docSnapshot.ref);
    }
  });

  // Add new links
  let baseTime = Date.now();
  allowedCompanyIds.forEach((empresa_id, idx) => {
    const linkId = baseTime + idx;
    const newLinkRef = doc(db, 'user_companies', String(linkId));
    batch.set(newLinkRef, {
      id: linkId,
      usuario_id: Number(userId),
      empresa_id: Number(empresa_id)
    });
  });

  await batch.commit();
}

// Account Mutations
export async function saveCloudAccount(account: FinancialAccount): Promise<void> {
  const accountId = Number(account.id);
  const accountRef = doc(db, 'accounts', String(accountId));
  const payload = sanitizeAccountForFirestore(account);
  await setDoc(accountRef, payload);
}

export async function deleteCloudAccount(accountId: number): Promise<void> {
  const accountIdNum = Number(accountId);
  const accountRef = doc(db, 'accounts', String(accountIdNum));
  await deleteDoc(accountRef);
}

export async function saveCloudAccountsBatch(accounts: (FinancialAccount | Omit<FinancialAccount, 'id'> & { id: number })[]): Promise<void> {
  for (let i = 0; i < accounts.length; i += 400) {
    const batch = writeBatch(db);
    const chunk = accounts.slice(i, i + 400);
    for (const acc of chunk) {
      const accountId = Number(acc.id);
      const accRef = doc(db, 'accounts', String(accountId));
      const payload = sanitizeAccountForFirestore(acc as FinancialAccount);
      batch.set(accRef, payload);
    }
    await batch.commit();
  }
}

export async function clearAllCloudAccounts(): Promise<void> {
  const snapshot = await getDocs(collection(db, 'accounts'));
  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => {
    batch.delete(d.ref);
  });
  await batch.commit();
}

// Bank Account Mutations
export async function saveCloudBankAccount(bank: BankAccount): Promise<void> {
  const bankId = Number(bank.id);
  const bankRef = doc(db, 'bank_accounts', String(bankId));
  const payload = sanitizeBankAccountForFirestore(bank);
  await setDoc(bankRef, payload);
}

export async function deleteCloudBankAccount(bankId: number): Promise<void> {
  const bankRef = doc(db, 'bank_accounts', String(Number(bankId)));
  await deleteDoc(bankRef);
}

export async function saveCloudBankAccountsBatch(bankAccounts: BankAccount[]): Promise<void> {
  const batch = writeBatch(db);
  for (const b of bankAccounts) {
    const bankRef = doc(db, 'bank_accounts', String(Number(b.id)));
    batch.set(bankRef, sanitizeBankAccountForFirestore(b));
  }
  await batch.commit();
}

// Cost Center Mutations
export async function saveCloudCostCenter(cc: CostCenter): Promise<void> {
  const ccId = Number(cc.id);
  const ccRef = doc(db, 'cost_centers', String(ccId));
  const payload = sanitizeCostCenterForFirestore(cc);
  await setDoc(ccRef, payload);
}

export async function deleteCloudCostCenter(ccId: number): Promise<void> {
  const ccRef = doc(db, 'cost_centers', String(Number(ccId)));
  await deleteDoc(ccRef);
}

export async function saveCloudCostCentersBatch(costCenters: CostCenter[]): Promise<void> {
  const batch = writeBatch(db);
  for (const cc of costCenters) {
    const ccRef = doc(db, 'cost_centers', String(Number(cc.id)));
    batch.set(ccRef, sanitizeCostCenterForFirestore(cc));
  }
  await batch.commit();
}

// Banking Credential Mutations
export async function saveCloudBankingCredential(cred: TenantBankingCredential): Promise<void> {
  const credId = String(cred.id);
  const credRef = doc(db, 'tenant_banking_credentials', credId);
  const payload = sanitizeBankingCredentialForFirestore(cred);
  await setDoc(credRef, payload);
}

export async function deleteCloudBankingCredential(credId: string | number): Promise<void> {
  const credRef = doc(db, 'tenant_banking_credentials', String(credId));
  await deleteDoc(credRef);
}

export async function saveCloudBankingCredentialsBatch(credentials: TenantBankingCredential[]): Promise<void> {
  const batch = writeBatch(db);
  for (const cred of credentials) {
    const credRef = doc(db, 'tenant_banking_credentials', String(cred.id));
    batch.set(credRef, sanitizeBankingCredentialForFirestore(cred));
  }
  await batch.commit();
}

// Audit Log Mutations
export async function saveCloudAuditLog(
  log: Omit<AuditLog, 'id' | 'data_hora'> & { id?: string; data_hora?: string }
): Promise<AuditLog> {
  const logId = log.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const dataHora = log.data_hora || new Date().toISOString();
  const fullLog: AuditLog = {
    ...log,
    id: logId,
    data_hora: dataHora,
  };
  const logRef = doc(db, 'audit_logs', logId);
  const payload = sanitizeAuditLogForFirestore(fullLog);
  await setDoc(logRef, payload);
  return fullLog;
}

export async function saveCloudAuditLogsBatch(logs: AuditLog[]): Promise<void> {
  for (let i = 0; i < logs.length; i += 400) {
    const batch = writeBatch(db);
    const chunk = logs.slice(i, i + 400);
    for (const log of chunk) {
      const logRef = doc(db, 'audit_logs', String(log.id));
      const payload = sanitizeAuditLogForFirestore(log);
      batch.set(logRef, payload);
    }
    await batch.commit();
  }
}

export async function clearAllCloudAuditLogs(): Promise<void> {
  const snapshot = await getDocs(collection(db, 'audit_logs'));
  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => {
    batch.delete(d.ref);
  });
  await batch.commit();
}

export async function clearAllCloudDataAndStartFresh(companyName: string = 'Minha Empresa', cnpj?: string): Promise<{ company: Company }> {
  const batch = writeBatch(db);

  // 1. Wipe all collections
  const [tenantsSnap, compSnap, userSnap, linkSnap, accSnap, bankSnap, ccSnap, credSnap] = await Promise.all([
    getDocs(collection(db, 'tenants')),
    getDocs(collection(db, 'companies')),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'user_companies')),
    getDocs(collection(db, 'accounts')),
    getDocs(collection(db, 'bank_accounts')),
    getDocs(collection(db, 'cost_centers')),
    getDocs(collection(db, 'tenant_banking_credentials')),
  ]);

  tenantsSnap.docs.forEach((d) => batch.delete(d.ref));
  compSnap.docs.forEach((d) => batch.delete(d.ref));
  userSnap.docs.forEach((d) => batch.delete(d.ref));
  linkSnap.docs.forEach((d) => batch.delete(d.ref));
  accSnap.docs.forEach((d) => batch.delete(d.ref));
  bankSnap.docs.forEach((d) => batch.delete(d.ref));
  ccSnap.docs.forEach((d) => batch.delete(d.ref));
  credSnap.docs.forEach((d) => batch.delete(d.ref));

  // 2. Create fresh default Tenant
  const newTenant: Tenant = {
    id: 1,
    nome: 'Empresa Principal',
    email: 'admin@financeiro.com',
    status: 'ativo',
    expiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    plano: 'Ilimitado',
    limite_empresas: 10,
    limite_usuarios: 20,
    valor_mensal: 0,
    criado_em: new Date().toISOString().split('T')[0],
  };
  batch.set(doc(db, 'tenants', '1'), sanitizeTenantForFirestore(newTenant));

  // 3. Create fresh single company
  const newCompany: Company = {
    id: 1,
    tenant_id: 1,
    nome: companyName.trim() || 'Minha Empresa',
    cnpj: cnpj?.trim() || undefined,
    criado_em: new Date().toISOString().split('T')[0],
  };
  batch.set(doc(db, 'companies', '1'), sanitizeCompanyForFirestore(newCompany));

  // Create default bank account
  const defaultBank: BankAccount = {
    id: 1,
    tenant_id: 1,
    empresa_id: 1,
    nome_banco: 'Conta Corrente Principal',
    tipo_conta: 'corrente',
    saldo_inicial: 0,
    padrao: true,
    criado_em: new Date().toISOString().split('T')[0],
  };
  batch.set(doc(db, 'bank_accounts', '1'), sanitizeBankAccountForFirestore(defaultBank));

  // 4. Create default user link
  const linkRef = doc(db, 'user_companies', '1');
  batch.set(linkRef, {
    id: 1,
    usuario_id: 1,
    empresa_id: 1,
    tenant_id: 1
  });

  // 5. Mark system as initialized
  const metaRef = doc(db, 'system_meta', 'init_status');
  batch.set(metaRef, { initialized: true, updated: new Date().toISOString() });

  await batch.commit();
  return { company: newCompany };
}

export async function resetCloudToInitialData(): Promise<void> {
  await wipeAllDataExceptMaster();
}

export async function wipeAllDataExceptMaster(): Promise<void> {
  const [tenantSnap, compSnap, userSnap, linkSnap, accSnap, logSnap, bankSnap, ccSnap] = await Promise.all([
    getDocs(collection(db, 'tenants')),
    getDocs(collection(db, 'companies')),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'user_companies')),
    getDocs(collection(db, 'accounts')),
    getDocs(collection(db, 'audit_logs')),
    getDocs(collection(db, 'bank_accounts')),
    getDocs(collection(db, 'cost_centers')),
  ]);

  const batch = writeBatch(db);
  tenantSnap.docs.forEach((d) => batch.delete(d.ref));
  compSnap.docs.forEach((d) => batch.delete(d.ref));
  userSnap.docs.forEach((d) => batch.delete(d.ref));
  linkSnap.docs.forEach((d) => batch.delete(d.ref));
  accSnap.docs.forEach((d) => batch.delete(d.ref));
  logSnap.docs.forEach((d) => batch.delete(d.ref));
  bankSnap.docs.forEach((d) => batch.delete(d.ref));
  ccSnap.docs.forEach((d) => batch.delete(d.ref));

  // Write only the Master Admin User
  const masterUser = INITIAL_USERS[0];
  const userRef = doc(db, 'users', String(masterUser.id));
  batch.set(userRef, sanitizeUserForFirestore(masterUser));

  // Audit log of system reset
  const logId = `log_${Date.now()}`;
  const logRef = doc(db, 'audit_logs', logId);
  batch.set(logRef, {
    id: logId,
    data_hora: new Date().toISOString(),
    usuario_id: 1,
    usuario_nome: 'Super Admin Master',
    acao: 'RESET_SISTEMA',
    entidade: 'sistema',
    descricao: 'Limpeza geral de todas as empresas e movimentações executada pelo Super Admin.',
  });

  const metaRef = doc(db, 'system_meta', 'init_status');
  batch.set(metaRef, { initialized: true, wipedClean: true, updated: new Date().toISOString() });

  await batch.commit();
}

// Helper to commit operations in safe batches of 350 (Firestore limit is 500 operations per batch)
async function commitBatchOperations(operations: { ref: any; data?: any; type: 'set' | 'delete' }[]) {
  const CHUNK_SIZE = 350;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.type === 'delete') {
        batch.delete(op.ref);
      } else {
        batch.set(op.ref, op.data);
      }
    }
    await Promise.race([
      batch.commit(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Batch commit timeout')), 2500)),
    ]);
  }
}

// Restore Full Snapshot 100% to Firestore Cloud with Atomic Chunking & Obsolete Cleanup
export async function restoreFullCloudSnapshot(snapshot: SystemBackupSnapshot['dados']): Promise<{
  success: boolean;
  companiesCount: number;
  accountsCount: number;
  usersCount: number;
}> {
  console.log('☁️ [Nuvem Firestore] Gravando backup 100% no banco de dados na nuvem...');
  const writeOps: { ref: any; data: any; type: 'set' }[] = [];

  // Tenants
  for (const tenant of snapshot.tenants || []) {
    if (!tenant) continue;
    const ref = doc(db, 'tenants', String(tenant.id));
    writeOps.push({ ref, data: sanitizeTenantForFirestore(tenant), type: 'set' });
  }

  // Companies
  for (const comp of snapshot.companies || []) {
    if (!comp) continue;
    const ref = doc(db, 'companies', String(comp.id));
    writeOps.push({ ref, data: sanitizeCompanyForFirestore(comp), type: 'set' });
  }

  // Users
  for (const user of snapshot.users || []) {
    if (!user) continue;
    const ref = doc(db, 'users', String(user.id));
    writeOps.push({ ref, data: sanitizeUserForFirestore(user), type: 'set' });
  }

  // User Company Links
  for (const link of snapshot.userCompanies || []) {
    if (!link) continue;
    const ref = doc(db, 'user_companies', String(link.id));
    writeOps.push({ ref, data: sanitizeUserCompanyLinkForFirestore(link), type: 'set' });
  }

  // Bank Accounts
  for (const b of snapshot.bankAccounts || []) {
    if (!b) continue;
    const ref = doc(db, 'bank_accounts', String(b.id));
    writeOps.push({ ref, data: sanitizeBankAccountForFirestore(b), type: 'set' });
  }

  // Cost Centers
  for (const cc of snapshot.costCenters || []) {
    if (!cc) continue;
    const ref = doc(db, 'cost_centers', String(cc.id));
    writeOps.push({ ref, data: sanitizeCostCenterForFirestore(cc), type: 'set' });
  }

  // Financial Accounts (Movimentações a pagar e a receber)
  for (const acc of snapshot.accounts || []) {
    if (!acc) continue;
    const ref = doc(db, 'accounts', String(acc.id));
    writeOps.push({ ref, data: sanitizeAccountForFirestore(acc), type: 'set' });
  }

  // Audit Logs
  for (const log of snapshot.auditLogs || []) {
    if (!log) continue;
    const logId = String(log.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    const ref = doc(db, 'audit_logs', logId);
    writeOps.push({ ref, data: sanitizeAuditLogForFirestore(log), type: 'set' });
  }

  // Write all data to Firestore in chunked batches
  await commitBatchOperations(writeOps);

  // Clean up obsolete documents that are not part of the restored snapshot
  try {
    const [oldTenantSnap, oldCompSnap, oldUserSnap, oldLinkSnap, oldAccSnap, oldBankSnap, oldCcSnap] = await Promise.all([
      getDocs(collection(db, 'tenants')),
      getDocs(collection(db, 'companies')),
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'user_companies')),
      getDocs(collection(db, 'accounts')),
      getDocs(collection(db, 'bank_accounts')),
      getDocs(collection(db, 'cost_centers')),
    ]);

    const validTenantIds = new Set((snapshot.tenants || []).map((t) => String(t.id)));
    const validCompIds = new Set((snapshot.companies || []).map((c) => String(c.id)));
    const validUserIds = new Set((snapshot.users || []).map((u) => String(u.id)));
    const validLinkIds = new Set((snapshot.userCompanies || []).map((l) => String(l.id)));
    const validAccIds = new Set((snapshot.accounts || []).map((a) => String(a.id)));
    const validBankIds = new Set((snapshot.bankAccounts || []).map((b) => String(b.id)));
    const validCcIds = new Set((snapshot.costCenters || []).map((c) => String(c.id)));

    const deleteOps: { ref: any; type: 'delete' }[] = [];
    oldTenantSnap.docs.forEach((d) => { if (!validTenantIds.has(d.id)) deleteOps.push({ ref: d.ref, type: 'delete' }); });
    oldCompSnap.docs.forEach((d) => { if (!validCompIds.has(d.id)) deleteOps.push({ ref: d.ref, type: 'delete' }); });
    oldUserSnap.docs.forEach((d) => { if (!validUserIds.has(d.id)) deleteOps.push({ ref: d.ref, type: 'delete' }); });
    oldLinkSnap.docs.forEach((d) => { if (!validLinkIds.has(d.id)) deleteOps.push({ ref: d.ref, type: 'delete' }); });
    oldAccSnap.docs.forEach((d) => { if (!validAccIds.has(d.id)) deleteOps.push({ ref: d.ref, type: 'delete' }); });
    oldBankSnap.docs.forEach((d) => { if (!validBankIds.has(d.id)) deleteOps.push({ ref: d.ref, type: 'delete' }); });
    oldCcSnap.docs.forEach((d) => { if (!validCcIds.has(d.id)) deleteOps.push({ ref: d.ref, type: 'delete' }); });

    if (deleteOps.length > 0) {
      await commitBatchOperations(deleteOps);
    }
  } catch (cleanErr) {
    console.warn('Aviso durante limpeza de documentos obsoletos na nuvem:', cleanErr);
  }

  // Mark metadata as initialized & custom backup restored so seed never overwrites user data
  const metaRef = doc(db, 'system_meta', 'init_status');
  await setDoc(metaRef, {
    initialized: true,
    isCustomBackup: true,
    restoredAt: new Date().toISOString(),
    companiesCount: (snapshot.companies || []).length,
    accountsCount: (snapshot.accounts || []).length,
    usersCount: (snapshot.users || []).length,
  }, { merge: true });

  console.log('✅ [Nuvem Firestore] Gravação concluída 100% com sucesso na nuvem!');
  return {
    success: true,
    companiesCount: (snapshot.companies || []).length,
    accountsCount: (snapshot.accounts || []).length,
    usersCount: (snapshot.users || []).length,
  };
}

export async function fetchAllCloudData(): Promise<{
  tenants: Tenant[];
  companies: Company[];
  users: User[];
  userCompanies: UserCompanyLink[];
  accounts: FinancialAccount[];
  auditLogs: AuditLog[];
  bankAccounts: BankAccount[];
  costCenters: CostCenter[];
  bankingCredentials?: TenantBankingCredential[];
}> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Firestore fetch timeout')), 2500)
  );

  const [tenantSnap, compSnap, userSnap, linkSnap, accSnap, logSnap, bankSnap, ccSnap, credSnap] = await Promise.race([
    Promise.all([
      getDocs(collection(db, 'tenants')),
      getDocs(collection(db, 'companies')),
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'user_companies')),
      getDocs(collection(db, 'accounts')),
      getDocs(collection(db, 'audit_logs')),
      getDocs(collection(db, 'bank_accounts')),
      getDocs(collection(db, 'cost_centers')),
      getDocs(collection(db, 'tenant_banking_credentials')),
    ]),
    timeoutPromise,
  ]);

  const tenants: Tenant[] = [];
  for (const d of tenantSnap.docs) {
    const t = d.data() as Tenant;
    const email = String(t.email || '').trim().toLowerCase();
    const nome = String(t.nome || '');
    if (email === 'admin@financeiro.com' || email === 'admin@finaceiro.com' || nome === 'Organização Corporativa Matriz') {
      deleteDoc(d.ref).catch(() => {});
      continue;
    }
    tenants.push({
      id: Number(t.id || d.id),
      nome,
      email,
      telefone: t.telefone ? String(t.telefone) : undefined,
      documento: t.documento ? String(t.documento) : undefined,
      status: (t.status === 'inativo' || t.status === 'expirado') ? t.status : 'ativo',
      expiracao: t.expiracao && !t.expiracao.startsWith('2099') && !t.expiracao.startsWith('2100')
        ? t.expiracao 
        : (t.expiracao || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
      plano: t.plano || 'Corporativo Multi-Empresas',
      limite_empresas: t.limite_empresas !== undefined ? Number(t.limite_empresas) : 10,
      limite_usuarios: t.limite_usuarios !== undefined ? Number(t.limite_usuarios) : 20,
      valor_mensal: t.valor_mensal !== undefined ? Number(t.valor_mensal) : 499.00,
      observacoes: t.observacoes || undefined,
      criado_em: t.criado_em || undefined,
    });
  }
  tenants.sort((a, b) => a.id - b.id);

  const companies: Company[] = compSnap.docs.map((d) => {
    const c = d.data() as Company;
    return {
      ...c,
      id: Number(c.id || d.id),
      tenant_id: Number(c.tenant_id || 1),
      nome: String(c.nome || ''),
      cnpj: c.cnpj ? String(c.cnpj) : undefined,
      cidade: c.cidade ? String(c.cidade) : undefined,
      estado: c.estado ? String(c.estado) : undefined,
    };
  });
  companies.sort((a, b) => a.id - b.id);

  const users: User[] = userSnap.docs.map((d) => {
    const u = d.data() as User;
    return {
      ...u,
      id: Number(u.id || d.id),
      tenant_id: u.tenant_id !== undefined ? Number(u.tenant_id) : (u.is_master || Number(u.id) === 1 ? undefined : 1),
      nome: String(u.nome || ''),
      email: String(u.email || ''),
      senha_hash: String(u.senha_hash || ''),
      acesso_todas_empresas: Boolean(u.acesso_todas_empresas),
    };
  });
  users.sort((a, b) => a.id - b.id);

  const userCompanies: UserCompanyLink[] = linkSnap.docs.map((d) => {
    const l = d.data() as UserCompanyLink;
    return {
      id: Number(l.id || d.id),
      usuario_id: Number(l.usuario_id),
      empresa_id: Number(l.empresa_id),
      tenant_id: l.tenant_id !== undefined ? Number(l.tenant_id) : undefined,
    };
  });

  const accounts: FinancialAccount[] = accSnap.docs.map((d) => {
    const a = d.data() as FinancialAccount;
    return {
      ...a,
      id: Number(a.id || d.id),
      tenant_id: a.tenant_id !== undefined ? Number(a.tenant_id) : 1,
      empresa_id: Number(a.empresa_id),
      valor: Number(a.valor || 0),
      tipo: (a.tipo === 'receber' ? 'receber' : 'pagar') as 'pagar' | 'receber',
      status: a.status || 'Pendente',
      descricao: String(a.descricao || ''),
      data_vencimento: a.data_vencimento || new Date().toISOString().split('T')[0],
      categoria: a.categoria || 'Geral',
      banco_id: a.banco_id !== undefined ? Number(a.banco_id) : undefined,
      centro_custo_id: a.centro_custo_id !== undefined ? Number(a.centro_custo_id) : undefined,
      parcela_atual: a.parcela_atual !== undefined ? Number(a.parcela_atual) : undefined,
      total_parcelas: a.total_parcelas !== undefined ? Number(a.total_parcelas) : undefined,
      conciliado: Boolean(a.conciliado),
      excluido: Boolean(a.excluido),
    };
  });
  accounts.sort((a, b) => b.id - a.id);

  const auditLogs: AuditLog[] = logSnap.docs.map((d) => {
    const l = d.data() as AuditLog;
    return {
      id: String(l.id || d.id),
      data_hora: l.data_hora || new Date().toISOString(),
      usuario_id: l.usuario_id !== undefined ? Number(l.usuario_id) : undefined,
      usuario_nome: String(l.usuario_nome || 'Usuário'),
      acao: l.acao || 'EDICAO',
      entidade: l.entidade || 'conta',
      descricao: String(l.descricao || ''),
      detalhes: l.detalhes || undefined,
    };
  });
  auditLogs.sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime());

  const bankAccounts: BankAccount[] = bankSnap.docs.map((d) => {
    const b = d.data() as BankAccount;
    return {
      ...b,
      id: Number(b.id || d.id),
      tenant_id: b.tenant_id !== undefined ? Number(b.tenant_id) : 1,
      empresa_id: Number(b.empresa_id),
      nome_banco: String(b.nome_banco || ''),
      tipo_conta: b.tipo_conta || 'corrente',
      saldo_inicial: Number(b.saldo_inicial || 0),
      padrao: Boolean(b.padrao),
    };
  });
  bankAccounts.sort((a, b) => a.id - b.id);

  const costCenters: CostCenter[] = ccSnap.docs.map((d) => {
    const cc = d.data() as CostCenter;
    return {
      ...cc,
      id: Number(cc.id || d.id),
      tenant_id: cc.tenant_id !== undefined ? Number(cc.tenant_id) : 1,
      empresa_id: Number(cc.empresa_id || 0),
      nome: String(cc.nome || ''),
    };
  });
  costCenters.sort((a, b) => a.id - b.id);

  const bankingCredentials: TenantBankingCredential[] = credSnap.docs.map((d) => {
    const c = d.data() as any;
    return {
      id: String(c.id || d.id),
      tenant_id: Number(c.tenant_id || 1),
      company_id: Number(c.company_id || c.empresa_id || 1),
      provider: (c.provider || 'bb') as 'bb' | 'stone' | 'infinitepay',
      client_id: String(c.client_id || ''),
      client_secret: c.client_secret || undefined,
      webhook_secret: c.webhook_secret || undefined,
      chave_pix: c.chave_pix || undefined,
      certificado_path: c.certificado_path || undefined,
      ambiente: (c.ambiente || 'sandbox') as 'sandbox' | 'producao',
      status: (c.status || 'ativo') as 'ativo' | 'inativo',
      criado_em: c.criado_em || new Date().toISOString().split('T')[0],
      atualizado_em: c.atualizado_em || undefined,
      criado_por: c.criado_por || undefined,
      atualizado_por: c.atualizado_por || undefined,
      has_client_secret: Boolean(c.client_secret || c.has_client_secret),
      has_webhook_secret: Boolean(c.webhook_secret || c.has_webhook_secret),
      masked_client_id: c.masked_client_id || (c.client_id ? (c.client_id.length > 8 ? `${c.client_id.substring(0, 4)}••••${c.client_id.substring(c.client_id.length - 4)}` : '••••••••') : ''),
      masked_client_secret: '••••••••••••',
      masked_webhook_secret: '••••••••••••',
    };
  });

  return {
    tenants,
    companies,
    users,
    userCompanies,
    accounts,
    auditLogs,
    bankAccounts,
    costCenters,
    bankingCredentials,
  };
}
