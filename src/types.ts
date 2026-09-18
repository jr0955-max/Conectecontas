export type AccountStatus = 'Pendente' | 'Pago' | 'Recebido';

export type AccountType = 'pagar' | 'receber';

export const DEFAULT_CATEGORIES: string[] = [
  'Aluguel',
  'Consultoria',
  'Equipamentos',
  'Estoque & Fornecedores',
  'Impostos & Taxas',
  'Infraestrutura',
  'Marketing & Vendas',
  'Pessoal & Salários',
  'Projetos',
  'Serviços Prestados',
  'Serviços Terceiros',
  'Suporte & Manutenção',
  'Tecnologia & SaaS',
  'Utilidades (Água/Luz/Net)',
  'Vendas PDV / Faturamento',
  'Outros',
];

export type UserStatus = 'ativo' | 'pendente' | 'bloqueado' | 'rejeitado';
export type UserRole = 'master' | 'admin' | 'operador' | 'leitor';

export interface UserPermissions {
  pode_adicionar_contas: boolean;        // Novo lançamento (+ A Pagar / + A Receber)
  pode_editar_contas: boolean;           // Editar lançamento existente
  pode_excluir_contas: boolean;          // Excluir lançamento
  pode_quitar_contas: boolean;           // Marcar como pago / recebido
  pode_ver_graficos: boolean;            // Ver gráficos de evolução e pizza
  pode_ver_dre: boolean;                 // Ver DRE estruturado
  pode_ver_projecao: boolean;            // Ver projeção de fluxo de caixa 30/60/90d
  pode_exportar_relatorios: boolean;     // Exportar CSV e relatórios
  pode_importar_extrato: boolean;        // Importar extrato bancário / OFX
  pode_gerenciar_bancos: boolean;        // Cadastrar e gerenciar contas bancárias
  pode_gerenciar_centros_custo: boolean; // Cadastrar centros de custo
  pode_gerenciar_empresas: boolean;      // Cadastrar e editar dados de CNPJs / Empresas
  pode_ver_lixeira: boolean;             // Ver e restaurar lixeira
  pode_ver_auditoria: boolean;           // Ver trilha de auditoria
  pode_gerenciar_usuarios: boolean;      // Ver e gerenciar usuários
  pode_ver_desenvolvedor: boolean;       // Acessar menus de desenvolvedor (Python / SQLite)
  pode_resetar_banco: boolean;           // Resetar ou restaurar backup do banco
}

export interface PermissionDefinition {
  key: keyof UserPermissions;
  label: string;
  description: string;
  category: 'lancamentos' | 'relatorios' | 'bancos' | 'seguranca' | 'sistema';
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // Lançamentos
  { key: 'pode_adicionar_contas', label: 'Cadastrar Lançamentos', description: 'Permite criar novas contas a pagar e receber', category: 'lancamentos' },
  { key: 'pode_editar_contas', label: 'Editar Lançamentos', description: 'Permite alterar valores, datas, categorias e observações', category: 'lancamentos' },
  { key: 'pode_quitar_contas', label: 'Dar Baixa / Quitar', description: 'Permite marcar contas como pagas ou recebidas', category: 'lancamentos' },
  { key: 'pode_excluir_contas', label: 'Excluir Lançamentos', description: 'Permite mover lançamentos para a lixeira', category: 'lancamentos' },

  // Relatórios & Gráficos
  { key: 'pode_ver_graficos', label: 'Visualizar Gráficos', description: 'Acesso a gráficos de despesas, receitas e fluxo mensal', category: 'relatorios' },
  { key: 'pode_ver_dre', label: 'DRE & Demonstrativos', description: 'Acesso ao demonstrativo estruturado de resultados', category: 'relatorios' },
  { key: 'pode_ver_projecao', label: 'Projeção 30/60/90 Dias', description: 'Acesso ao módulo de projeção futura de saldo', category: 'relatorios' },
  { key: 'pode_exportar_relatorios', label: 'Exportar Relatórios / CSV', description: 'Download de planilhas e relatórios em formato CSV/Excel', category: 'relatorios' },

  // Bancos & Extratos
  { key: 'pode_importar_extrato', label: 'Importar Extrato / OFX', description: 'Importação de extratos bancários e conciliação', category: 'bancos' },
  { key: 'pode_gerenciar_bancos', label: 'Contas Bancárias Reais', description: 'Cadastro e visualização de saldos bancários reais', category: 'bancos' },
  { key: 'pode_gerenciar_centros_custo', label: 'Centros de Custos', description: 'Criar e categorizar por centros de custos / projetos', category: 'bancos' },

  // Segurança & Auditoria
  { key: 'pode_ver_auditoria', label: 'Trilha de Auditoria', description: 'Histórico de quem criou, editou ou alterou registros', category: 'seguranca' },
  { key: 'pode_ver_lixeira', label: 'Lixeira & Restauração', description: 'Acesso a itens apagados para recuperação de dados', category: 'seguranca' },

  // Administração do Sistema
  { key: 'pode_gerenciar_empresas', label: 'Gerenciar CNPJs / Empresas', description: 'Criar, editar e excluir empresas da plataforma', category: 'sistema' },
  { key: 'pode_gerenciar_usuarios', label: 'Gerenciar Usuários', description: 'Criar e autorizar novos logins e permissões', category: 'sistema' },
  { key: 'pode_ver_desenvolvedor', label: 'Painel Desenvolvedor / SQLite', description: 'Visualizar scripts Python e tabelas SQLite brutas', category: 'sistema' },
  { key: 'pode_resetar_banco', label: 'Backup & Reset de Dados', description: 'Gerar backups completos ou restaurar snapshots', category: 'sistema' },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  master: {
    pode_adicionar_contas: true,
    pode_editar_contas: true,
    pode_excluir_contas: true,
    pode_quitar_contas: true,
    pode_ver_graficos: true,
    pode_ver_dre: true,
    pode_ver_projecao: true,
    pode_exportar_relatorios: true,
    pode_importar_extrato: true,
    pode_gerenciar_bancos: true,
    pode_gerenciar_centros_custo: true,
    pode_gerenciar_empresas: true,
    pode_ver_lixeira: true,
    pode_ver_auditoria: true,
    pode_gerenciar_usuarios: true,
    pode_ver_desenvolvedor: true,
    pode_resetar_banco: true,
  },
  admin: {
    pode_adicionar_contas: true,
    pode_editar_contas: true,
    pode_excluir_contas: true,
    pode_quitar_contas: true,
    pode_ver_graficos: true,
    pode_ver_dre: true,
    pode_ver_projecao: true,
    pode_exportar_relatorios: true,
    pode_importar_extrato: true,
    pode_gerenciar_bancos: true,
    pode_gerenciar_centros_custo: true,
    pode_gerenciar_empresas: true,
    pode_ver_lixeira: true,
    pode_ver_auditoria: true,
    pode_gerenciar_usuarios: false,
    pode_ver_desenvolvedor: false,
    pode_resetar_banco: false,
  },
  operador: {
    pode_adicionar_contas: true,
    pode_editar_contas: true,
    pode_excluir_contas: false,
    pode_quitar_contas: true,
    pode_ver_graficos: true,
    pode_ver_dre: false,
    pode_ver_projecao: true,
    pode_exportar_relatorios: true,
    pode_importar_extrato: true,
    pode_gerenciar_bancos: false,
    pode_gerenciar_centros_custo: false,
    pode_gerenciar_empresas: false,
    pode_ver_lixeira: false,
    pode_ver_auditoria: false,
    pode_gerenciar_usuarios: false,
    pode_ver_desenvolvedor: false,
    pode_resetar_banco: false,
  },
  leitor: {
    pode_adicionar_contas: false,
    pode_editar_contas: false,
    pode_excluir_contas: false,
    pode_quitar_contas: false,
    pode_ver_graficos: true,
    pode_ver_dre: true,
    pode_ver_projecao: true,
    pode_exportar_relatorios: true,
    pode_importar_extrato: false,
    pode_gerenciar_bancos: false,
    pode_gerenciar_centros_custo: false,
    pode_gerenciar_empresas: false,
    pode_ver_lixeira: false,
    pode_ver_auditoria: false,
    pode_gerenciar_usuarios: false,
    pode_ver_desenvolvedor: false,
    pode_resetar_banco: false,
  },
};

export const getUserEffectivePermissions = (user?: User | null): UserPermissions => {
  if (!user) return DEFAULT_ROLE_PERMISSIONS.leitor;
  const isMasterUser = Boolean(
    user.is_master || 
    Number(user.id) === 1 || 
    user.email?.toLowerCase() === 'admin@financeiro.com' ||
    user.role === 'master'
  );

  if (isMasterUser) {
    return {
      ...DEFAULT_ROLE_PERMISSIONS.master,
      ...(user.permissions || {}),
    };
  }

  const role = user.role || 'admin';
  const base = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.admin;
  return {
    ...base,
    ...(user.permissions || {}),
  };
};

export type TenantStatus = 'ativo' | 'inativo' | 'expirado';

export interface Tenant {
  id: number;
  nome: string; // Nome do Cliente / Tenant (Dono da conta SaaS)
  email: string; // E-mail do proprietário da conta
  status: TenantStatus; // 'ativo' | 'inativo' | 'expirado'
  expiracao: string; // Data limite da licença (YYYY-MM-DD)
  plano?: string; // e.g. 'Básico', 'Profissional', 'Enterprise'
  max_subempresas?: number;
  max_usuarios?: number;
  limite_empresas?: number;
  limite_usuarios?: number;
  valor_mensal?: number;
  telefone?: string;
  documento?: string; // CPF ou CNPJ do Tenant
  criado_em?: string;
  observacoes?: string;
  link_pagamento?: string; // Link direto gerado pelo Mercado Pago para regularização
}

export const isPlatformOwnerTenant = (tenant?: Partial<Tenant> | null): boolean => {
  if (!tenant) return false;
  const rawId = Number(tenant.id);
  const email = (tenant.email || '').trim().toLowerCase();
  const nome = (tenant.nome || '').trim().toLowerCase();
  return (
    rawId === 1 ||
    email === 'admin@financeiro.com' ||
    email === 'admin@finaceiro.com' ||
    nome.includes('organização matriz') ||
    nome.includes('uso pessoal matriz')
  );
};

export const isTenantActive = (tenant?: Tenant | null): boolean => {
  if (!tenant) return true;
  // EXCEÇÃO TENANT ID 1 OU USO PESSOAL DO DONO ORIGINAL: Acesso pessoal estritamente vitalício e protegido
  if (isPlatformOwnerTenant(tenant)) {
    return true;
  }
  const rawId = Number(tenant.id);
  const email = (tenant.email || '').trim().toLowerCase();
  if (rawId === 1788215216712 || email === 'jr0955@gmail.com') {
    return true;
  }
  if (tenant.status !== 'ativo') return false;
  if (!tenant.expiracao) return true;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = tenant.expiracao.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return true;
  const expDate = new Date(year, month - 1, day, 23, 59, 59, 999);
  return expDate.getTime() >= today.getTime();
};

export const calculateExtendedExpirationDate = (currentExpStr: string | undefined, daysToAdd: number): string => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  let baseDate = new Date(now.getTime());

  if (currentExpStr && currentExpStr.includes('-')) {
    const [y, m, d] = currentExpStr.split('-').map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const expDate = new Date(y, m - 1, d, 0, 0, 0, 0);
      // Se for uma data futura válida e razoável (< ano 2090), adiciona a partir dela.
      // Se for uma data antiga/expirada ou placeholder legado (ex: 2099/2100), calcula a partir de HOJE.
      if (expDate.getTime() > now.getTime() && y < 2090) {
        baseDate = expDate;
      }
    }
  }

  baseDate.setDate(baseDate.getDate() + daysToAdd);
  return baseDate.toISOString().split('T')[0];
};

export interface User {
  id: number;
  tenant_id?: number; // Vínculo com o Cliente SaaS (Dono da Conta)
  nome: string;
  email: string;
  senha_hash: string; // Hash com salt criptográfico (PBKDF2/SHA-256)
  acesso_todas_empresas: boolean; // Se true, visualiza todas as empresas cadastradas
  is_master?: boolean; // Se true, tem controle total da plataforma e gestão de clientes
  is_admin?: boolean; // Se true, usuário com privilégios de administração Master
  role?: UserRole; // 'master' | 'admin' | 'operador' | 'leitor'
  status?: UserStatus; // 'ativo' | 'pendente' | 'bloqueado' | 'rejeitado'
  permissions?: Partial<UserPermissions>; // Permissões granulares customizadas
  telefone?: string; // WhatsApp / Telefone do solicitante
  empresa_solicitada?: string; // Nome da empresa digitado no cadastro público
  cnpj_solicitado?: string; // CNPJ informado no cadastro
  motivo_recusa?: string;
  aprovado_por?: string;
  aprovado_em?: string;
  criado_em?: string;
}

export const isUserAdminMaster = (user?: User | null): boolean => {
  if (!user) return false;
  return Boolean(
    user.is_admin === true ||
    user.is_master === true ||
    Number(user.id) === 1 ||
    user.email?.toLowerCase() === 'admin@financeiro.com' ||
    user.role === 'master'
  );
};

export interface UserCompanyLink {
  id: number;
  tenant_id?: number;
  usuario_id: number;
  empresa_id: number;
}

export interface Company {
  id: number;
  tenant_id?: number; // Vínculo com o Cliente SaaS (Dono da conta)
  nome: string;
  cnpj?: string;
  cidade?: string;
  estado?: string;
  saldo_atual?: number;
  saldo_projetado?: number;
  total_receitas_pagas?: number;
  total_despesas_pagas?: number;
  atualizado_em?: string;
  criado_em?: string;
}

export type BankAccountType = 'corrente' | 'poupanca' | 'investimento' | 'caixa_fisico' | 'cartao_credito' | 'outro';

export interface BankAccount {
  id: number;
  tenant_id?: number;
  empresa_id: number;
  nome_banco: string; // e.g. 'Itaú Unibanco', 'Bradesco PJ', 'Nubank', 'Caixa Físico'
  tipo_conta: BankAccountType;
  agencia?: string;
  numero_conta?: string;
  saldo_inicial: number;
  cor?: string; // hex color for tags
  descricao?: string;
  padrao?: boolean;
  criado_em?: string;
}

export interface CostCenter {
  id: number;
  tenant_id?: number;
  empresa_id: number; // 0 para geral de todas as empresas ou específico
  nome: string; // e.g. 'Administrativo', 'Operacional', 'Marketing & Vendas', 'TI / Infra'
  codigo?: string; // e.g. 'CC-01'
  cor?: string;
  descricao?: string;
  criado_em?: string;
}

export interface FinancialAccount {
  id: number;
  tenant_id?: number; // Vínculo obrigatório com o Cliente SaaS
  empresa_id: number;
  tipo: AccountType; // 'pagar' or 'receber'
  descricao: string;
  valor: number;
  data_vencimento: string; // YYYY-MM-DD
  status: AccountStatus;
  categoria?: string;
  observacoes?: string;
  banco_origem?: string; // e.g. 'Itaú OFX', 'Stone Maquininha', 'Bradesco', etc.
  documento_ref?: string; // Código de autorização, FITID bancário ou ID da transação
  
  // Contas Bancárias & Centros de Custo
  banco_id?: number; // ID da Conta Bancária Real
  centro_custo_id?: number; // ID do Centro de Custo vinculado

  // Recorrência & Parcelamento Automático
  parcela_atual?: number; // ex: 1
  total_parcelas?: number; // ex: 12 (exibido como 1/12)
  parcela_total?: number; // alias para total_parcelas
  recorrencia_id?: string; // ID único que agrupa todas as parcelas ou recorrências geradas
  recorrencia_tipo?: 'mensal' | 'semanal' | 'quinzenal' | 'anual' | 'parcelado';
  recorrente?: boolean;

  // Integração Bancária de Saída (Envio de Pagamentos / Pix / Boletos)
  chave_pix?: string; // Chave Pix de destino (CPF, CNPJ, E-mail, Celular ou EVP)
  chave_pix_tipo?: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | 'outro';
  codigo_barras?: string; // Linha digitável ou código de barras de boleto
  comprovante_bancario_id?: string; // ID / EndToEndId do comprovante retornado pela API do banco (BB / Stone)
  banco_pagamento?: string; // e.g. 'Banco do Brasil API' ou 'Stone Banking API'
  pago_via_api?: boolean;
  pago_em?: string; // Timestamp da liquidação via API

  // Conciliação Bancária
  conciliado?: boolean;
  conciliado_em?: string;
  conciliado_fitid?: string;
  conciliado_por?: string;

  // Auditoria e Rastreabilidade
  criado_por?: string;
  criado_em?: string;
  atualizado_por?: string;
  atualizado_em?: string;

  // Lixeira & Recuperação (Soft Delete)
  excluido?: boolean;
  excluido_em?: string; // ISO string de quando foi movido para a lixeira
  excluido_por?: string; // Nome do usuário que excluiu
  identificador_externo?: string; // ID externo de integração bancária ou webhook
}

export interface OFXTransaction {
  id: string;
  fitid: string;
  tipo: 'DEBIT' | 'CREDIT' | 'OTHER';
  valor: number; // valor positivo para crédito, negativo para débito
  data: string; // YYYY-MM-DD
  memo: string;
  checknum?: string;
  refnum?: string;
  banco_nome?: string;
  conta_numero?: string;
}

export interface OFXStatement {
  banco_id?: string;
  banco_nome?: string;
  agencia?: string;
  numero_conta?: string;
  tipo_conta?: string;
  data_inicio?: string;
  data_fim?: string;
  saldo_final?: number;
  transacoes: OFXTransaction[];
}

export interface ConciliationMatch {
  ofxTx: OFXTransaction;
  matchedAccount?: FinancialAccount;
  confidenceScore: number; // 0 a 100
  matchReason?: string; // 'Valor e data exatos', 'Valor idêntico com data próxima', etc.
  status: 'conciliado' | 'pendente' | 'novo_lancamento' | 'ignorado';
}

export interface CashflowDayProjection {
  data: string; // YYYY-MM-DD
  dataFormatada?: string; // DD/MM/AAAA
  diaSemana: string; // Seg, Ter, Qua, etc.
  entradas: number;
  saidas: number;
  saldoDia: number;
  saldoAcumulado: number;
  entradasPrevistas?: number;
  saidasPrevistas?: number;
  entradasRealizadas?: number;
  saidasRealizadas?: number;
  saldoDiaPrevisto?: number;
  saldoAcumuladoProjetado?: number;
  isNegativo?: boolean;
  contas?: FinancialAccount[];
  contasNoDia?: FinancialAccount[];
}

export type AuditAction = 
  | 'CRIACAO' 
  | 'EDICAO' 
  | 'EXCLUSAO_LIXEIRA' 
  | 'RESTAURACAO' 
  | 'EXCLUSAO_DEFINITIVA' 
  | 'BAIXA_PAGAMENTO' 
  | 'REVERSAO_PAGAMENTO'
  | 'IMPORTACAO_CSV'
  | 'IMPORTACAO_EXTRATO'
  | 'TRANSFERENCIA_EMPRESA'
  | 'BACKUP_EXPORTADO'
  | 'BACKUP_RESTAURADO'
  | 'EMPRESA_CRIADA'
  | 'EMPRESA_EDITADA'
  | 'EMPRESA_EXCLUIDA'
  | 'USUARIO_CRIADO'
  | 'USUARIO_EDITADO'
  | 'USUARIO_EXCLUIDO'
  | 'LIXEIRA_ESVAZIADA'
  | 'LANCAMENTO_PARCELADO'
  | 'LANCAMENTO_RECORRENTE'
  | 'CONCILIACAO_BANCARIA'
  | 'CONCILIACAO_OFX'
  | 'CONTA_BANCARIA_CRIADA'
  | 'CONTA_BANCARIA_EDITADA'
  | 'CONTA_BANCARIA_EXCLUIDA'
  | 'CENTRO_CUSTO_CRIADO'
  | 'CENTRO_CUSTO_EDITADO'
  | 'CENTRO_CUSTO_EXCLUIDO'
  | 'INTEGRACAO_BANCARIA_CRIADA'
  | 'INTEGRACAO_BANCARIA_EDITADA'
  | 'INTEGRACAO_BANCARIA_EXCLUIDA'
  | 'WEBHOOK_ASSINATURA_VALIDADA'
  | 'WEBHOOK_ASSINATURA_INVALIDA'
  | 'ASSINATURA_MERCADOPAGO_APROVADA'
  | 'ASSINATURA_MERCADOPAGO_CANCELADA'
  | 'ASSINATURA_MERCADOPAGO_CRIADA'
  | 'ASSINATURA_MERCADOPAGO_PENDENTE';

export interface BillingInvoice {
  id: string; // e.g. "inv_mp_12345678"
  tenant_id: number;
  valor: number;
  status: 'approved' | 'authorized' | 'cancelled' | 'pending' | 'rejected' | 'payment_required';
  data_pagamento: string;
  forma_pagamento: string;
  mercadopago_id?: string;
  preapproval_id?: string;
  external_reference?: string;
  plano: string;
  descricao: string;
  payer_email?: string;
  comprovante_url?: string;
}

export interface AuditLog {
  id: string; // e.g. "log_1724000000000_abc"
  data_hora: string; // ISO string
  usuario_id?: number;
  usuario_nome: string;
  usuario_email?: string;
  acao: AuditAction;
  entidade: 'conta' | 'empresa' | 'usuario' | 'banco' | 'centro_custo' | 'conciliacao' | 'backup' | 'sistema' | 'tenant' | 'integracao_bancaria' | 'assinatura' | 'fatura';
  entidade_id?: number | string;
  tenant_id?: number;
  empresa_id?: number;
  empresa_nome?: string;
  descricao: string;
  detalhes?: Record<string, any>;
}

export type BankingProviderType = 'bb' | 'stone' | 'infinitepay' | 'mercadopago';
export type BankingEnvironmentType = 'sandbox' | 'producao';
export type BankingCredentialStatus = 'ativo' | 'inativo';

export interface TenantBankingCredential {
  id: string;
  tenant_id: number;
  company_id: number;
  provider: BankingProviderType;
  client_id: string;
  client_secret?: string;
  webhook_secret?: string;
  chave_pix?: string;
  certificado_path?: string;
  ambiente: BankingEnvironmentType;
  status: BankingCredentialStatus;
  criado_em: string;
  atualizado_em?: string;
  criado_por?: string;
  atualizado_por?: string;
  has_client_secret?: boolean;
  has_webhook_secret?: boolean;
  masked_client_id?: string;
  masked_client_secret?: string;
  masked_webhook_secret?: string;
}

export interface SystemBackupSnapshot {
  versao: string;
  tipo_backup: 'completo_conectecontas';
  gerado_em: string;
  gerado_por: {
    id?: number;
    nome: string;
    email?: string;
  };
  estatisticas: {
    totalEmpresas: number;
    totalContasAtivas: number;
    totalContasLixeira: number;
    totalUsuarios: number;
    totalLogs: number;
    totalTenants?: number;
    totalContasBancarias?: number;
    totalCentrosCusto?: number;
    valorTotalReceber: number;
    valorTotalPagar: number;
  };
  dados: {
    tenants?: Tenant[];
    companies: Company[];
    users: User[];
    userCompanies: UserCompanyLink[];
    accounts: FinancialAccount[];
    bankAccounts?: BankAccount[];
    costCenters?: CostCenter[];
    auditLogs: AuditLog[];
  };
}

export interface MonthlyMetric {
  mesAno: string; // e.g. "2025-01" or "Jan/25"
  mesNome: string;
  totalPagar: number;
  totalReceber: number;
  saldo: number;
}

export interface CompanySummaryMetric {
  empresa_id: number;
  empresa_nome: string;
  cnpj?: string;
  totalReceber: number;
  totalPagar: number;
  saldo: number;
  recebido: number;
  pago: number;
  qtdContas: number;
}


