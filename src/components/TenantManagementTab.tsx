import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Building2, 
  Users, 
  Calendar, 
  Plus, 
  Search, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Edit3, 
  Trash2, 
  ArrowRight, 
  Layers, 
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  FileText,
  CreditCard,
  Copy,
  Check
} from 'lucide-react';
import { Tenant, Company, User, isTenantActive, isPlatformOwnerTenant } from '../types';

interface TenantManagementTabProps {
  tenants: Tenant[];
  companies: Company[];
  users: User[];
  onSaveTenant: (tenant: Partial<Tenant> & { id?: number }) => Promise<void>;
  onDeleteTenant: (tenantId: number) => Promise<void>;
  onExtendTenantLicense: (tenantId: number, daysToAdd: number) => Promise<void>;
  onUpdateTenantStatus: (tenantId: number, status: 'ativo' | 'inativo' | 'expirado') => Promise<void>;
  onSelectLaunchCompany?: (companyId: number) => void;
}

export const TenantManagementTab: React.FC<TenantManagementTabProps> = ({
  tenants,
  companies,
  users,
  onSaveTenant,
  onDeleteTenant,
  onExtendTenantLicense,
  onUpdateTenantStatus,
  onSelectLaunchCompany,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo' | 'expirado'>('todos');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  
  // Form fields
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [documento, setDocumento] = useState('');
  const [status, setStatus] = useState<'ativo' | 'inativo' | 'expirado'>('ativo');
  const [expiracao, setExpiracao] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [plano, setPlano] = useState('Profissional');
  const [limiteEmpresas, setLimiteEmpresas] = useState(5);
  const [limiteUsuarios, setLimiteUsuarios] = useState(10);
  const [valorMensal, setValorMensal] = useState(299.90);
  const [observacoes, setObservacoes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tenant Deletion Confirmation Modal State
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [isDeletingTenant, setIsDeletingTenant] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Mercado Pago Quick Checkout Link State
  const [generatingTenantId, setGeneratingTenantId] = useState<number | null>(null);
  const [generatedLinkMap, setGeneratedLinkMap] = useState<{ [tenantId: number]: string }>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleGenerateCheckoutLink = async (tenant: Tenant) => {
    try {
      setGeneratingTenantId(tenant.id);
      const res = await fetch('/api/billing/create-subscription-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          email: tenant.email,
          plano: tenant.plano || 'Assinatura Conectecontas Pro',
          valor: tenant.valor_mensal || 99.00,
        }),
      });

      const data = await res.json();
      const url = data.init_point || data.sandbox_init_point || 'https://www.mercadopago.com.br';
      
      setGeneratedLinkMap((prev) => ({
        ...prev,
        [tenant.id]: url,
      }));
    } catch (err) {
      console.error('Erro ao gerar checkout:', err);
      alert('Erro ao gerar link de pagamento Mercado Pago.');
    } finally {
      setGeneratingTenantId(null);
    }
  };

  const handleCopyLink = (tenantId: number, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(tenantId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Clientes SaaS válidos (exclui donos da plataforma e contas corporativas matriz de uso pessoal)
  const validLicensableTenants = tenants.filter((t) => !isPlatformOwnerTenant(t));

  // Filtered tenants
  const filteredTenants = validLicensableTenants.filter((t) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = 
      t.nome.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      (t.documento && t.documento.includes(q)) ||
      (t.telefone && t.telefone.includes(q));

    const matchesStatus = statusFilter === 'todos' ? true : t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate MRR & Sales Metrics
  const totalMRR = validLicensableTenants.reduce((acc, t) => {
    if (t.status === 'ativo') return acc + (t.valor_mensal || 0);
    return acc;
  }, 0);

  const activeTenantsCount = validLicensableTenants.filter((t) => isTenantActive(t)).length;
  const expiredTenantsCount = validLicensableTenants.filter((t) => t.status === 'expirado' || (t.expiracao && t.expiracao < new Date().toISOString().split('T')[0])).length;
  const inactiveTenantsCount = validLicensableTenants.filter((t) => t.status === 'inativo').length;

  const handleOpenCreateModal = () => {
    setEditingTenant(null);
    setFormError(null);
    setFormSuccess(null);
    setNome('');
    setEmail('');
    setTelefone('');
    setDocumento('');
    setStatus('ativo');
    // Default 30 days ahead
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    setExpiracao(nextMonth.toISOString().split('T')[0]);
    setPlano('Profissional');
    setLimiteEmpresas(5);
    setLimiteUsuarios(10);
    setValorMensal(299.90);
    setObservacoes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: Tenant) => {
    setEditingTenant(t);
    setFormError(null);
    setFormSuccess(null);
    setNome(t.nome || '');
    setEmail(t.email || '');
    setTelefone(t.telefone || '');
    setDocumento(t.documento || '');
    setStatus(t.status || 'ativo');
    setExpiracao(t.expiracao || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setPlano(t.plano || 'Profissional');
    setLimiteEmpresas(t.limite_empresas || t.max_subempresas || 5);
    setLimiteUsuarios(t.limite_usuarios || t.max_usuarios || 10);
    setValorMensal(t.valor_mensal !== undefined ? t.valor_mensal : 299.90);
    setObservacoes(t.observacoes || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const cleanNome = nome.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanNome || !cleanEmail) {
      setFormError('Por favor, preencha o Nome do Cliente e o E-mail.');
      return;
    }

    // Regra estrita: Super Admin Master não é cliente com licença
    if (cleanEmail === 'admin@financeiro.com' || cleanEmail === 'admin@finaceiro.com') {
      setFormError('O e-mail admin@financeiro.com é o Super Admin / Dono da plataforma e possui acesso total irrestrito sem necessidade de licença. Cadastre apenas os clientes compradores do SaaS.');
      return;
    }

    const parsedLimiteEmpresas = Math.max(1, parseInt(String(limiteEmpresas), 10) || 5);
    const parsedLimiteUsuarios = Math.max(1, parseInt(String(limiteUsuarios), 10) || 10);
    const parsedValorMensal = Math.max(0, parseFloat(String(valorMensal)) || 299.90);

    setIsSubmitting(true);

    try {
      const payload: Partial<Tenant> & { id?: number } = {
        id: editingTenant ? Number(editingTenant.id) : undefined,
        nome: cleanNome,
        email: cleanEmail,
        telefone: telefone.trim() || undefined,
        documento: documento.trim() || undefined,
        status,
        expiracao,
        plano,
        limite_empresas: parsedLimiteEmpresas,
        limite_usuarios: parsedLimiteUsuarios,
        max_subempresas: parsedLimiteEmpresas,
        max_usuarios: parsedLimiteUsuarios,
        valor_mensal: parsedValorMensal,
        observacoes: observacoes.trim() || undefined,
      };

      // Chamada protegida com timeout para nunca deixar o formulário preso em "Salvando..."
      await Promise.race([
        onSaveTenant(payload),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);

      setFormSuccess(editingTenant ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!');
      
      // Fecha o modal suavemente após confirmação imediata
      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess(null);
      }, 400);
    } catch (err: any) {
      console.error('Erro ao salvar cliente/tenant:', err);
      setFormError(err?.message || 'Ocorreu um erro ao salvar o cliente. Verifique a conexão e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (t: Tenant) => {
    if (Number(t.id) === 1 || (t.email || '').toLowerCase() === 'admin@financeiro.com') {
      alert('O Tenant Matriz ID 1 (Dono Original do ERP) é protegido e não pode ser excluído.');
      return;
    }
    setDeleteError(null);
    setTenantToDelete(t);
  };

  const handleConfirmDelete = async () => {
    if (!tenantToDelete) return;
    setIsDeletingTenant(true);
    setDeleteError(null);
    try {
      await Promise.race([
        onDeleteTenant(tenantToDelete.id),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
      setTenantToDelete(null);
    } catch (err: any) {
      console.error('Erro ao excluir tenant:', err);
      setTenantToDelete(null);
    } finally {
      setIsDeletingTenant(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Super Admin Master Clarification Notice */}
      <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <span>Super Admin Master (Dono da Plataforma)</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                Acesso Vitalício Total
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Os administradores mestres (<span className="text-slate-300 font-mono">admin@financeiro.com</span> e <span className="text-slate-300 font-mono">jr0955@gmail.com</span>) são os proprietários gerais do sistema e operam com acesso total vitalício sem necessidade de licença. O controle de licenças e assinaturas abaixo aplica-se exclusivamente às empresas clientes SaaS contratantes.
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* MRR Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30">
          <div className="flex items-center justify-between text-xs text-emerald-300 font-bold mb-1">
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              MRR (Receita Recorrente)
            </span>
            <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full text-emerald-300">
              Vendas Ativas
            </span>
          </div>
          <div className="text-2xl font-black text-white">
            R$ {totalMRR.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-xs text-slate-400 font-normal"> /mês</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Faturamento mensal gerado pelas assinaturas ativas.
          </p>
        </div>

        {/* Active Tenants */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-300 font-bold mb-1">
            <span className="flex items-center gap-1.5 text-cyan-300">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Clientes Ativos
            </span>
            <span className="text-xs font-mono text-emerald-400 font-bold">
              {activeTenantsCount} de {validLicensableTenants.length}
            </span>
          </div>
          <div className="text-2xl font-black text-white">{activeTenantsCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">
            Contas com licença em dia e acesso liberado.
          </p>
        </div>

        {/* Expired Tenants */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-300 font-bold mb-1">
            <span className="flex items-center gap-1.5 text-amber-300">
              <Clock className="w-4 h-4 text-amber-400" />
              Licenças Vencidas
            </span>
            {expiredTenantsCount > 0 && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                Renovação
              </span>
            )}
          </div>
          <div className="text-2xl font-black text-amber-400">{expiredTenantsCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">
            Clientes aguardando pagamento ou renovação.
          </p>
        </div>

        {/* Total Subcompanies Managed */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-300 font-bold mb-1">
            <span className="flex items-center gap-1.5 text-indigo-300">
              <Building2 className="w-4 h-4 text-indigo-400" />
              Subempresas (Filiais)
            </span>
            <span className="text-xs font-mono text-indigo-400 font-bold">Nível 2</span>
          </div>
          <div className="text-2xl font-black text-white">{companies.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">
            Total de unidades cadastradas por todos os clientes.
          </p>
        </div>

      </div>

      {/* Action Header & Search */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome do cliente, e-mail, telefone ou documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 text-xs font-medium text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="todos">Todos os Status</option>
            <option value="ativo">🟢 Apenas Ativos</option>
            <option value="inativo">⚪ Inativos / Pausados</option>
            <option value="expirado">🟠 Expirados</option>
          </select>

          <button
            id="btn-create-new-tenant"
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-950 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Cliente (Tenant)</span>
          </button>
        </div>

      </div>

      {/* Tenants Table / Cards List */}
      <div className="space-y-3">
        {filteredTenants.map((t) => {
          const tenantCompanies = companies.filter((c) => Number(c.tenant_id) === Number(t.id));
          const tenantUsers = users.filter((u) => Number(u.tenant_id) === Number(t.id));
          const active = isTenantActive(t);
          const isExpired = t.status === 'expirado' || (t.expiracao && t.expiracao < new Date().toISOString().split('T')[0]);

          return (
            <div
              key={t.id}
              id={`tenant-row-${t.id}`}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-all space-y-4"
            >
              {/* Header Info */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base border shrink-0 ${
                    active 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                      : isExpired
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                    {t.nome.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-base text-white">{t.nome}</h3>
                      
                      {/* Status Badge */}
                      {Number(t.id) === 1 ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          👑 Tenant Matriz (Dono Original - Isolado)
                        </span>
                      ) : active ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Ativo
                        </span>
                      ) : isExpired ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Expirado
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          Inativo / Pausado
                        </span>
                      )}

                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        Plano {t.plano || 'Profissional'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                      <span>E-mail: <strong className="text-slate-200">{t.email}</strong></span>
                      {t.telefone && <span>• Tel: <strong className="text-slate-200">{t.telefone}</strong></span>}
                      {t.documento && <span>• Doc: <strong className="font-mono text-slate-300">{t.documento}</strong></span>}
                    </div>
                  </div>
                </div>

                {/* Expiration & Extension Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                    <span className="text-slate-500 text-[11px] block">Vencimento da Licença</span>
                    <span className={`font-mono font-bold ${
                      isExpired ? 'text-amber-400' : 'text-slate-200'
                    }`}>
                      {t.expiracao || '2099-12-31'}
                    </span>
                  </div>

                  {/* Quick Extension buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onExtendTenantLicense(t.id, 30)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer border border-slate-700 transition-colors"
                      title="Estender licença em +30 dias a partir de hoje"
                    >
                      +30 dias
                    </button>
                    <button
                      onClick={() => onExtendTenantLicense(t.id, 90)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer border border-slate-700 transition-colors"
                      title="Estender licença em +90 dias"
                    >
                      +90 dias
                    </button>
                    <button
                      onClick={() => onExtendTenantLicense(t.id, 365)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer border border-slate-700 transition-colors"
                      title="Estender licença em +1 ano"
                    >
                      +1 ano
                    </button>
                  </div>

                  {/* Mercado Pago Checkout Link Generator */}
                  {generatedLinkMap[t.id] ? (
                    <button
                      onClick={() => handleCopyLink(t.id, generatedLinkMap[t.id])}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                      title="Copiar Link de Cobrança do Mercado Pago"
                    >
                      {copiedId === t.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === t.id ? 'Copiado!' : 'Copiar Link MP'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleGenerateCheckoutLink(t)}
                      disabled={generatingTenantId === t.id}
                      className="px-2.5 py-1.5 rounded-xl bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 hover:text-white font-bold text-xs border border-sky-500/40 flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Gerar link de assinatura do Mercado Pago (R$ 99/mês) para enviar ao cliente"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-sky-400" />
                      <span>{generatingTenantId === t.id ? 'Gerando...' : 'Link Mercado Pago'}</span>
                    </button>
                  )}

                  {/* Status Toggle Button */}
                  <button
                    onClick={() => onUpdateTenantStatus(t.id, active ? 'inativo' : 'ativo')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      active
                        ? 'bg-amber-950/30 text-amber-300 border-amber-500/30 hover:bg-amber-900/40'
                        : 'bg-emerald-950/30 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/40'
                    }`}
                  >
                    {active ? 'Pausar Licença' : 'Ativar Licença'}
                  </button>

                  {/* Edit & Delete */}
                  <button
                    onClick={() => handleOpenEditModal(t)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                    title="Editar dados cadastrais e limites"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {Number(t.id) !== 1 && (
                    <button
                      onClick={() => handleDelete(t)}
                      className="p-2 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 border border-rose-900/40 transition-colors cursor-pointer"
                      title="Excluir cliente (Tenant)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Subcompanies and Users linked to this tenant */}
              <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-3">
                
                {/* Subcompanies */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                      Subempresas cadastradas ({tenantCompanies.length} de {t.limite_empresas || 5})
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {tenantCompanies.map((c) => (
                      <span
                        key={c.id}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-200 flex items-center gap-1"
                      >
                        <Building2 className="w-3 h-3 text-cyan-400" />
                        <span>{c.nome}</span>
                        {c.cnpj && <span className="text-slate-500 font-mono text-[9px]">({c.cnpj})</span>}
                      </span>
                    ))}

                    {tenantCompanies.length === 0 && (
                      <span className="text-xs text-slate-500 italic">
                        Nenhuma subempresa cadastrada ainda.
                      </span>
                    )}
                  </div>
                </div>

                {/* Users */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      Usuários Vinculados ({tenantUsers.length} de {t.limite_usuarios || 10})
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Mensalidade: R$ {(t.valor_mensal || 299.90).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {tenantUsers.map((u) => (
                      <span
                        key={u.id}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{u.nome}</span>
                        <span className="text-slate-500 text-[10px]">({u.role || 'admin'})</span>
                      </span>
                    ))}

                    {tenantUsers.length === 0 && (
                      <span className="text-xs text-slate-500 italic">
                        Nenhum usuário alocado para este tenant.
                      </span>
                    )}
                  </div>
                </div>

              </div>

            </div>
          );
        })}

        {filteredTenants.length === 0 && (
          <div className="p-12 text-center rounded-2xl bg-slate-900/50 border border-slate-800 text-slate-500 space-y-3">
            <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="font-bold text-slate-300 text-sm">Nenhum cliente/tenant encontrado</p>
            <p className="text-xs max-w-sm mx-auto">
              {searchTerm ? 'Tente ajustar os filtros de busca.' : 'Clique em "Novo Cliente (Tenant)" para adicionar sua primeira conta SaaS.'}
            </p>
          </div>
        )}
      </div>

      {/* Modal Criar/Editar Tenant */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {editingTenant ? 'Editar Cliente (Tenant)' : 'Novo Cliente SaaS (Tenant)'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configuração de conta compradora do aplicativo, licenças e limites
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-emerald-300 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome do Cliente / Empresa Principal *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Grupo Alpha Comércio"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    E-mail do Responsável *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="cliente@dominio.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="(11) 98765-4321"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    CNPJ / CPF do Titular
                  </label>
                  <input
                    type="text"
                    placeholder="00.000.000/0000-00"
                    value={documento}
                    onChange={(e) => setDocumento(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Status da Assinatura
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ativo">🟢 Ativo (Acesso Liberado)</option>
                    <option value="inativo">⚪ Inativo (Acesso Pausado)</option>
                    <option value="expirado">🟠 Expirado (Bloqueio de Licença)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      Data de Expiração da Licença *
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">
                      (Formato: AAAA-MM-DD)
                    </span>
                  </div>
                  <input
                    type="date"
                    required
                    value={expiracao}
                    onChange={(e) => setExpiracao(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  {/* Preset Shortcuts */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-slate-400 font-medium mr-1">Atalhos rápidos:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 30);
                        setExpiracao(d.toISOString().split('T')[0]);
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[10px] font-bold border border-slate-700 cursor-pointer"
                    >
                      +30 dias (1 mês)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 90);
                        setExpiracao(d.toISOString().split('T')[0]);
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-[10px] font-bold border border-slate-700 cursor-pointer"
                    >
                      +90 dias (3 meses)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 180);
                        setExpiracao(d.toISOString().split('T')[0]);
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 text-[10px] font-bold border border-slate-700 cursor-pointer"
                    >
                      +6 meses
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 365);
                        setExpiracao(d.toISOString().split('T')[0]);
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-[10px] font-bold border border-slate-700 cursor-pointer"
                    >
                      +1 ano
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExpiracao(new Date().toISOString().split('T')[0]);
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-700 cursor-pointer"
                    >
                      Hoje
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Plano Contratado
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Essencial, Profissional, Enterprise"
                    value={plano}
                    onChange={(e) => setPlano(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      Valor Mensal (R$) *
                    </label>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">
                      Cobrança Mercado Pago
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={valorMensal}
                    onChange={(e) => setValorMensal(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-slate-400 font-medium mr-1">Preços sugeridos:</span>
                    <button
                      type="button"
                      onClick={() => setValorMensal(99.00)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        valorMensal === 99
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700'
                      }`}
                    >
                      R$ 99,00
                    </button>
                    <button
                      type="button"
                      onClick={() => setValorMensal(149.90)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        valorMensal === 149.90
                          ? 'bg-sky-500 text-slate-950 border-sky-400'
                          : 'bg-slate-800 hover:bg-slate-700 text-sky-400 border-slate-700'
                      }`}
                    >
                      R$ 149,90
                    </button>
                    <button
                      type="button"
                      onClick={() => setValorMensal(199.00)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        valorMensal === 199
                          ? 'bg-indigo-500 text-slate-950 border-indigo-400'
                          : 'bg-slate-800 hover:bg-slate-700 text-indigo-400 border-slate-700'
                      }`}
                    >
                      R$ 199,00
                    </button>
                    <button
                      type="button"
                      onClick={() => setValorMensal(299.90)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        valorMensal === 299.90
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700'
                      }`}
                    >
                      R$ 299,90
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Limite de Subempresas (Filiais)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={limiteEmpresas}
                    onChange={(e) => setLimiteEmpresas(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Limite de Usuários
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={limiteUsuarios}
                    onChange={(e) => setLimiteUsuarios(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Observações Internas de Vendas (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Informações do contrato, forma de pagamento, contato do financeiro do cliente..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !nome.trim() || !email.trim()}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 text-xs font-bold cursor-pointer transition-all shadow-lg flex items-center gap-1.5"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmitting ? 'Salvando...' : editingTenant ? 'Atualizar Cliente' : 'Cadastrar Cliente'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Tenant */}
      {tenantToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-950/50 border border-rose-800/60 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Excluir Cliente SaaS</h3>
                <p className="text-xs text-rose-400/80">Esta ação é permanente e não voltará</p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300">
                {deleteError}
              </div>
            )}

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1 text-xs text-slate-300">
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-cyan-400" />
                <span>{tenantToDelete.nome}</span>
              </div>
              <p className="text-slate-400 text-[11px]">E-mail: {tenantToDelete.email}</p>
              <p className="text-slate-400 text-[11px]">Plano: {tenantToDelete.plano || 'Profissional'} • ID #{tenantToDelete.id}</p>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Tem certeza que deseja remover este cliente? Todas as filiais, empresas isoladas e vínculos deste tenant serão excluídos e ele será removido definitivamente do servidor e da nuvem.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingTenant}
                onClick={() => setTenantToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingTenant}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer transition-all shadow-lg shadow-rose-950/50 flex items-center gap-1.5"
              >
                {isDeletingTenant && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeletingTenant ? 'Excluindo definitivamente...' : 'Sim, Excluir Definitivamente'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
