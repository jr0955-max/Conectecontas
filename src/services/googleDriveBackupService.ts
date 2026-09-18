import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  SystemBackupSnapshot, 
  Company, 
  FinancialAccount, 
  AccountStatus, 
  User, 
  UserCompanyLink, 
  BankAccount, 
  CostCenter, 
  AuditLog, 
  Tenant 
} from '../types';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const BACKUP_FOLDER_NAME = 'Conectecontas_Backups';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope(DRIVE_SCOPE);
provider.setCustomParameters({
  prompt: 'select_account'
});

let cachedAccessToken: string | null = null;
let cachedGoogleUser: { email: string; displayName: string; photoURL?: string } | null = null;

export interface DriveBackupItem {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
  webViewLink?: string;
}

/**
 * Initializes auth listener for Google Drive Token session
 */
export const initGoogleDriveAuth = (
  onSuccess?: (token: string, user: typeof cachedGoogleUser) => void,
  onSignedOut?: () => void
) => {
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user && cachedAccessToken) {
      cachedGoogleUser = {
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'Usuário Google',
        photoURL: user.photoURL || undefined
      };
      if (onSuccess) onSuccess(cachedAccessToken, cachedGoogleUser);
    } else {
      if (!cachedAccessToken) {
        cachedGoogleUser = null;
        if (onSignedOut) onSignedOut();
      }
    }
  });
};

/**
 * Authenticates user via Google Popup and acquires Drive Access Token
 */
export const connectGoogleDrive = async (): Promise<{ token: string; user: { email: string; displayName: string; photoURL?: string } }> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter o token de acesso do Google Drive.');
    }

    cachedAccessToken = credential.accessToken;
    cachedGoogleUser = {
      email: result.user.email || '',
      displayName: result.user.displayName || result.user.email?.split('@')[0] || 'Usuário Google',
      photoURL: result.user.photoURL || undefined
    };

    return { token: cachedAccessToken, user: cachedGoogleUser };
  } catch (err: any) {
    console.error('Erro na conexão com Google Drive:', err);
    throw err;
  }
};

/**
 * Disconnects from Google Drive
 */
export const disconnectGoogleDrive = async () => {
  cachedAccessToken = null;
  cachedGoogleUser = null;
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Google sign out warning:', e);
  }
};

/**
 * Gets cached token or null
 */
export const getDriveAccessToken = (): string | null => cachedAccessToken;
export const getDriveGoogleUser = () => cachedGoogleUser;

/**
 * Finds or creates the dedicated Conectecontas_Backups folder in Google Drive
 */
export const getOrCreateBackupFolder = async (token: string): Promise<string> => {
  // 1. Search for existing folder
  const query = `name = '${BACKUP_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name)&spaces=drive`;

  const searchRes = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!searchRes.ok) {
    const errBody = await searchRes.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `Erro ao consultar pasta no Google Drive (${searchRes.status})`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // 2. Create folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Pasta automatizada de snapshots e backups de segurança do Conectecontas Multiempresa'
    })
  });

  if (!createRes.ok) {
    const errBody = await createRes.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `Erro ao criar pasta no Google Drive (${createRes.status})`);
  }

  const newFolder = await createRes.json();
  return newFolder.id;
};

/**
 * Uploads a JSON backup snapshot directly to Google Drive folder
 */
export const uploadBackupToGoogleDrive = async (
  token: string, 
  snapshot: SystemBackupSnapshot
): Promise<{ id: string; name: string; webViewLink?: string }> => {
  const folderId = await getOrCreateBackupFolder(token);
  
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `backup_conectecontas_${dateStr}.json`;
  const fileContent = JSON.stringify(snapshot, null, 2);

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: [folderId],
    description: `Snapshot Conectecontas gerado em ${now.toLocaleString('pt-BR')} com ${snapshot.estatisticas.totalEmpresas} empresas e ${snapshot.estatisticas.totalContasAtivas} lançamentos.`
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter;

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,createdTime,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    }
  );

  if (!uploadRes.ok) {
    const errBody = await uploadRes.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `Falha no envio para o Google Drive (${uploadRes.status})`);
  }

  const result = await uploadRes.json();
  return result;
};

/**
 * Lists all backup files stored inside the Conectecontas_Backups folder
 */
export const listDriveBackups = async (token: string): Promise<DriveBackupItem[]> => {
  const folderId = await getOrCreateBackupFolder(token);
  const query = `'${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=createdTime desc&fields=files(id, name, createdTime, size, webViewLink)&pageSize=30`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `Erro ao listar backups do Google Drive (${res.status})`);
  }

  const data = await res.json();
  return data.files || [];
};

/**
 * Normalizes any backup JSON structure (standard Conectecontas, legacy snapshots,
 * alternative keys like 'movimentos'/'contas'/'lancamentos', SQLite DDL/Python exports)
 * ensuring companies and financial movements are always completely recovered.
 */
export function normalizeBackupSnapshot(raw: any): SystemBackupSnapshot {
  if (!raw || typeof raw !== 'object') {
    throw new Error('O arquivo de backup é inválido ou está corrompido.');
  }

  const dadosObj = raw.dados && typeof raw.dados === 'object' ? raw.dados : raw;

  // 1. Extrair Empresas (suporta companies, empresas, etc.)
  const rawCompanies: any[] = 
    dadosObj.companies || 
    dadosObj.empresas || 
    raw.companies || 
    raw.empresas || 
    [];

  if (!Array.isArray(rawCompanies) || rawCompanies.length === 0) {
    throw new Error('O arquivo de backup não contém empresas cadastradas válidas.');
  }

  const companies: Company[] = rawCompanies.map((c, idx) => ({
    id: Number(c.id || idx + 1),
    nome: String(c.nome || c.name || `Empresa ${idx + 1}`),
    cnpj: c.cnpj ? String(c.cnpj) : '',
    cidade: c.cidade ? String(c.cidade) : '',
    estado: c.estado ? String(c.estado) : '',
    saldo_atual: Number(c.saldo_atual || 0),
    saldo_projetado: Number(c.saldo_projetado || 0),
    total_receitas_pagas: Number(c.total_receitas_pagas || 0),
    total_despesas_pagas: Number(c.total_despesas_pagas || 0),
    tenant_id: c.tenant_id ? Number(c.tenant_id) : undefined,
    criado_em: c.criado_em || new Date().toISOString(),
  }));

  const defaultCompId = companies[0]?.id || 1;

  // 2. Extrair Movimentos / Lançamentos (suporta accounts, movimentos, lancamentos, contas, transactions, financialAccounts, contas_a_pagar + contas_a_receber)
  let rawAccounts: any[] = [];
  if (Array.isArray(dadosObj.accounts) && dadosObj.accounts.length > 0) {
    rawAccounts = dadosObj.accounts;
  } else if (Array.isArray(dadosObj.movimentos) && dadosObj.movimentos.length > 0) {
    rawAccounts = dadosObj.movimentos;
  } else if (Array.isArray(dadosObj.lancamentos) && dadosObj.lancamentos.length > 0) {
    rawAccounts = dadosObj.lancamentos;
  } else if (Array.isArray(dadosObj.contas) && dadosObj.contas.length > 0) {
    rawAccounts = dadosObj.contas;
  } else if (Array.isArray(dadosObj.transactions) && dadosObj.transactions.length > 0) {
    rawAccounts = dadosObj.transactions;
  } else if (Array.isArray(dadosObj.financialAccounts) && dadosObj.financialAccounts.length > 0) {
    rawAccounts = dadosObj.financialAccounts;
  } else if (Array.isArray(raw.accounts) && raw.accounts.length > 0) {
    rawAccounts = raw.accounts;
  } else if (Array.isArray(raw.movimentos) && raw.movimentos.length > 0) {
    rawAccounts = raw.movimentos;
  } else if (Array.isArray(raw.lancamentos) && raw.lancamentos.length > 0) {
    rawAccounts = raw.lancamentos;
  } else if (Array.isArray(raw.contas) && raw.contas.length > 0) {
    rawAccounts = raw.contas;
  }

  // Verificar também se vieram separadas em contas_a_pagar e contas_a_receber (formato do script Python / export SQLite)
  const contasPagar: any[] = dadosObj.contas_a_pagar || raw.contas_a_pagar || [];
  const contasReceber: any[] = dadosObj.contas_a_receber || raw.contas_a_receber || [];
  if (Array.isArray(contasPagar) && contasPagar.length > 0) {
    contasPagar.forEach((cp, i) => {
      rawAccounts.push({ ...cp, id: cp.id || `pagar_${i}_${Date.now()}`, tipo: 'pagar' });
    });
  }
  if (Array.isArray(contasReceber) && contasReceber.length > 0) {
    contasReceber.forEach((cr, i) => {
      rawAccounts.push({ ...cr, id: cr.id || `receber_${i}_${Date.now()}`, tipo: 'receber' });
    });
  }

  const accounts: FinancialAccount[] = rawAccounts.map((a, idx) => {
    const tipoRaw = String(a.tipo || a.type || '').toLowerCase().trim();
    const isReceita = tipoRaw === 'receber' || tipoRaw === 'receita' || tipoRaw === 'recebimento' || tipoRaw === 'entrada';
    const tipo: 'pagar' | 'receber' = isReceita ? 'receber' : 'pagar';

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
      id: Number(a.id || Date.now() + idx),
      empresa_id: Number(a.empresa_id || a.company_id || defaultCompId),
      tipo,
      descricao: String(a.descricao || a.description || a.titulo || a.nome || `Movimento #${idx + 1}`),
      valor: valorNum,
      data_vencimento: a.data_vencimento || a.vencimento || a.dueDate || a.data || new Date().toISOString().split('T')[0],
      status,
      categoria: String(a.categoria || a.category || 'Outros'),
      observacoes: a.observacoes || a.obs || a.observacao || '',
      data_pagamento: a.data_pagamento || a.pagamento || undefined,
      excluido: Boolean(a.excluido || a.deleted),
      excluido_em: a.excluido_em || undefined,
      tenant_id: a.tenant_id ? Number(a.tenant_id) : undefined,
      banco_id: a.banco_id ? Number(a.banco_id) : undefined,
      centro_custo_id: a.centro_custo_id ? Number(a.centro_custo_id) : undefined,
      conciliado: Boolean(a.conciliado),
    };
  });

  const users: User[] = Array.isArray(dadosObj.users || raw.users) ? (dadosObj.users || raw.users) : [];
  const userCompanies: UserCompanyLink[] = Array.isArray(dadosObj.userCompanies || raw.userCompanies) ? (dadosObj.userCompanies || raw.userCompanies) : [];
  const bankAccounts: BankAccount[] = Array.isArray(dadosObj.bankAccounts || raw.bankAccounts) ? (dadosObj.bankAccounts || raw.bankAccounts) : [];
  const costCenters: CostCenter[] = Array.isArray(dadosObj.costCenters || raw.costCenters) ? (dadosObj.costCenters || raw.costCenters) : [];
  const auditLogs: AuditLog[] = Array.isArray(dadosObj.auditLogs || raw.auditLogs) ? (dadosObj.auditLogs || raw.auditLogs) : [];
  const tenants: Tenant[] = Array.isArray(dadosObj.tenants || raw.tenants) ? (dadosObj.tenants || raw.tenants) : [];

  const activeAccounts = accounts.filter(a => !a.excluido);
  const trashAccounts = accounts.filter(a => a.excluido);
  const totalReceber = activeAccounts.filter(a => a.tipo === 'receber').reduce((sum, a) => sum + a.valor, 0);
  const totalPagar = activeAccounts.filter(a => a.tipo === 'pagar').reduce((sum, a) => sum + a.valor, 0);

  return {
    versao: raw.versao || '2.0.0',
    tipo_backup: 'completo_conectecontas',
    gerado_em: raw.gerado_em || new Date().toISOString(),
    gerado_por: raw.gerado_por || { nome: 'Sistema' },
    estatisticas: {
      totalEmpresas: companies.length,
      totalContasAtivas: activeAccounts.length,
      totalContasLixeira: trashAccounts.length,
      totalUsuarios: users.length,
      totalLogs: auditLogs.length,
      valorTotalReceber: totalReceber,
      valorTotalPagar: totalPagar,
    },
    dados: {
      companies,
      accounts,
      users,
      userCompanies,
      bankAccounts,
      costCenters,
      auditLogs,
      tenants,
    },
  };
}

/**
 * Downloads a backup file JSON from Google Drive and parses/normalizes it
 */
export const downloadAndParseDriveBackup = async (token: string, fileId: string): Promise<SystemBackupSnapshot> => {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `Erro ao baixar arquivo do Google Drive (${res.status})`);
  }

  const content = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (parseErr: any) {
    throw new Error(`Arquivo corrompido no Google Drive: ${parseErr.message}`);
  }

  // Normalizar para garantir empresas e lançamentos independentemente da estrutura original
  return normalizeBackupSnapshot(parsed);
};

/**
 * Deletes a backup file from Google Drive (with trash fallback if hard delete is restricted)
 */
export const deleteDriveBackupFile = async (token: string, fileId: string): Promise<void> => {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`;
  
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (res.ok || res.status === 204 || res.status === 200 || res.status === 404) {
      return;
    }

    // If hard delete returned 403 (insufficient permissions for permanent delete), try moving to trash
    if (res.status === 403) {
      const trashUrl = `https://www.googleapis.com/drive/v3/files/${fileId}`;
      const trashRes = await fetch(trashUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ trashed: true })
      });

      if (trashRes.ok || trashRes.status === 200 || trashRes.status === 404) {
        return;
      }
    }

    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `Erro ao excluir arquivo do Google Drive (Status ${res.status})`);
  } catch (err: any) {
    console.warn('Tentativa de exclusão no Google Drive:', err);
    throw err;
  }
};
