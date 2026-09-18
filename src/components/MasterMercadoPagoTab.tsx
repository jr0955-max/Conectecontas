import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  ExternalLink, 
  Copy, 
  Check, 
  Zap, 
  Sparkles, 
  RefreshCw, 
  Building2, 
  Calendar, 
  Search, 
  DollarSign, 
  Send, 
  Layers, 
  Receipt,
  Link,
  Shield,
  FileCheck,
  TrendingUp,
  KeyRound,
  Lock,
  Settings
} from 'lucide-react';
import { Tenant, User, BillingInvoice, isTenantActive, isPlatformOwnerTenant } from '../types';
import { MercadoPagoCredentialsModal } from './MercadoPagoCredentialsModal';

interface MasterMercadoPagoTabProps {
  tenants: Tenant[];
  currentUser: User;
  invoices: BillingInvoice[];
  onExtendTenantLicense: (tenantId: number, daysToAdd: number) => Promise<void>;
  onUpdateTenantStatus: (tenantId: number, status: 'ativo' | 'inativo' | 'expirado') => Promise<void>;
  onRefreshData?: () => void;
}

export const MasterMercadoPagoTab: React.FC<MasterMercadoPagoTabProps> = ({
  tenants,
  currentUser,
  invoices,
  onExtendTenantLicense,
  onUpdateTenantStatus,
  onRefreshData,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo' | 'expirado'>('todos');
  
  // Selected Tenant for generating checkout
  const [generatingTenantId, setGeneratingTenantId] = useState<number | null>(null);
  const [generatedLinkMap, setGeneratedLinkMap] = useState<{ [tenantId: number]: string }>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);

  // Credentials Modal State & Status
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [mpConfigStatus, setMpConfigStatus] = useState<{
    has_access_token: boolean;
    has_public_key: boolean;
    ambiente?: string;
  } | null>(null);

  const checkMpConfig = async () => {
    try {
      const res = await fetch('/api/billing/mercadopago-config');
      const data = await res.json();
      if (data.success && data.config) {
        setMpConfigStatus({
          has_access_token: Boolean(data.config.has_access_token),
          has_public_key: Boolean(data.config.public_key),
          ambiente: data.config.ambiente,
        });
      }
    } catch (e) {
      console.warn('Erro ao consultar status das chaves do MP:', e);
    }
  };

  useEffect(() => {
    checkMpConfig();
  }, []);

  // Simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedSimTenantId, setSelectedSimTenantId] = useState<number>(tenants[0]?.id || 1);
  const [simEventType, setSimEventType] = useState<'approved' | 'payment_required' | 'cancelled'>('approved');
  const [simAmount, setSimAmount] = useState<number>(99.00);
  const [simulationLog, setSimulationLog] = useState<{
    success: boolean;
    message: string;
    action?: string;
    expiracao?: string;
  } | null>(null);

  // Apenas clientes SaaS contratantes (exclui donos e matriz)
  const saasTenants = tenants.filter((t) => !isPlatformOwnerTenant(t));

  // Filtered tenants
  const filteredTenants = saasTenants.filter((t) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = 
      t.nome.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      (t.documento && t.documento.includes(q)) ||
      (t.plano && t.plano.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'todos' ? true : t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate Metrics
  const activeTenants = saasTenants.filter((t) => isTenantActive(t));
  const expiredOrInactiveTenants = saasTenants.filter((t) => !isTenantActive(t));
  const totalMRR = saasTenants.reduce((acc, t) => {
    if (isTenantActive(t)) return acc + (t.valor_mensal || 99.00);
    return acc;
  }, 0);

  const totalInvoicesPaid = invoices.filter(
    (inv) => inv.status === 'approved' || inv.status === 'authorized'
  );
  const totalRevenueCollected = totalInvoicesPaid.reduce((sum, inv) => sum + Number(inv.valor || 0), 0);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Não definida';
    const [year, month, day] = dateStr.split('T')[0].split('-');
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  };

  const getDaysRemaining = (expDateStr?: string) => {
    if (!expDateStr) return 0;
    const [year, month, day] = expDateStr.split('-');
    const exp = new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59);
    const now = new Date();
    const diff = exp.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Generate Mercado Pago checkout link for specific tenant
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
      alert('Erro de comunicação ao gerar link Mercado Pago.');
    } finally {
      setGeneratingTenantId(null);
    }
  };

  const handleCopyLink = (tenantId: number, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(tenantId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopyWebhookUrl = () => {
    const fullUrl = `${window.location.origin}/api/billing/webhook/mercadopago`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedWebhookUrl(true);
    setTimeout(() => setCopiedWebhookUrl(false), 2500);
  };

  // Trigger simulated webhook
  const handleRunSimulation = async (
    targetTenantId: number, 
    eventType: 'approved' | 'payment_required' | 'cancelled',
    amount?: number
  ) => {
    try {
      setIsSimulating(true);
      setSimulationLog(null);
      const tenant = tenants.find((t) => t.id === targetTenantId);
      const res = await fetch('/api/billing/simulate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          tenant_id: targetTenantId,
          amount: amount !== undefined ? amount : (tenant?.valor_mensal || 99.00),
        }),
      });

      const data = await res.json();
      setSimulationLog({
        success: Boolean(data.success),
        message: data.message || (data.success ? 'Webhook processado com sucesso' : 'Falha na simulação'),
        action: data.action,
        expiracao: data.data_expiracao,
      });

      if (onRefreshData) {
        setTimeout(onRefreshData, 600);
      }
    } catch (err: any) {
      setSimulationLog({
        success: false,
        message: err?.message || 'Erro de comunicação ao simular webhook.',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Info */}
      <div className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-indigo-950/40 p-6 rounded-3xl border border-sky-500/30 relative overflow-hidden shadow-xl">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                <CreditCard className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-full border border-sky-500/20">
                Mercado Pago Subscription Hub
              </span>
            </div>
            
            <h2 className="text-2xl font-black text-white">
              Gestão de Assinaturas & Cobranças dos Clientes Conectecontas
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Controle centralizado de cobranças recorrentes via Mercado Pago. Gere links de pagamento para novos clientes, acompanhe o status da assinatura em tempo real, automatize a renovação de licenças (+30 dias) e bloqueie inadimplentes automaticamente pelo Gatekeeper.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              id="btn-edit-mp-credentials"
              onClick={() => setIsConfigModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-sky-950/40"
            >
              <KeyRound className="w-4 h-4" />
              <span>Editar Chave & Token</span>
              {mpConfigStatus?.has_access_token ? (
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" title="Token Ativo" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-400" title="Token não configurado" />
              )}
            </button>

            <button
              id="btn-copy-webhook-url"
              onClick={handleCopyWebhookUrl}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold border border-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:border-sky-500/50"
            >
              {copiedWebhookUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-sky-400" />}
              <span>{copiedWebhookUrl ? 'URL do Webhook Copiada!' : 'Copiar URL do Webhook'}</span>
            </button>

            {onRefreshData && (
              <button
                onClick={() => {
                  onRefreshData();
                  checkMpConfig();
                }}
                className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer flex items-center justify-center"
                title="Sincronizar dados de assinaturas e faturas"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* MRR Card */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30 space-y-2">
          <div className="flex items-center justify-between text-xs text-emerald-300 font-bold">
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              MRR Assinaturas SaaS
            </span>
            <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full text-emerald-300 font-bold">
              Mensalidade
            </span>
          </div>
          <div className="text-3xl font-black text-white">
            R$ {totalMRR.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400">
            Receita mensal recorrente gerada pelos clientes com assinatura ativa.
          </p>
        </div>

        {/* Active Subscribers */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
            <span className="flex items-center gap-1.5 text-sky-300">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              Clientes em Dia
            </span>
            <span className="text-xs font-mono text-emerald-400 font-bold">
              {activeTenants.length} / {saasTenants.length}
            </span>
          </div>
          <div className="text-3xl font-black text-emerald-400">{activeTenants.length}</div>
          <p className="text-[11px] text-slate-400">
            Clientes com licença regularizada e acesso liberado às filiais.
          </p>
        </div>

        {/* Inadimplentes / Bloqueados */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
            <span className="flex items-center gap-1.5 text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Inadimplentes / Bloqueados
            </span>
            {expiredOrInactiveTenants.length > 0 && (
              <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-bold">
                Gatekeeper
              </span>
            )}
          </div>
          <div className={`text-3xl font-black ${expiredOrInactiveTenants.length > 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {expiredOrInactiveTenants.length}
          </div>
          <p className="text-[11px] text-slate-400">
            Assinaturas atrasadas ou canceladas com acesso bloqueado.
          </p>
        </div>

        {/* Total Invoices Paid */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
            <span className="flex items-center gap-1.5 text-indigo-300">
              <Receipt className="w-4 h-4 text-indigo-400" />
              Total de Faturas Pagas
            </span>
            <span className="text-xs font-mono text-indigo-300 font-bold">
              {totalInvoicesPaid.length}
            </span>
          </div>
          <div className="text-3xl font-black text-white">
            R$ {totalRevenueCollected.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400">
            Volume bruto processado via Mercado Pago no Conectecontas.
          </p>
        </div>

      </div>

      {/* Webhook Simulator & Integration Panel */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <span>Simulador Central de Webhooks do Mercado Pago</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Sandbox & Testes
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Dispare eventos de teste para verificar a ativação de +30 dias ou bloqueio imediato de qualquer cliente SaaS.
            </p>
          </div>

          <div className="text-xs text-slate-400 font-mono bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            Endpoint: <span className="text-sky-300">/api/billing/webhook/mercadopago</span>
          </div>
        </div>

        {/* Simulation Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
          
          {/* Select Tenant */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Cliente (Tenant):</label>
            <select
              value={selectedSimTenantId}
              onChange={(e) => setSelectedSimTenantId(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500"
            >
              {saasTenants.length === 0 ? (
                <option value={0}>Nenhum cliente SaaS cadastrado</option>
              ) : (
                saasTenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} (R$ {(t.valor_mensal || 99).toFixed(2)})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Event Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Tipo de Notificação:</label>
            <select
              value={simEventType}
              onChange={(e) => setSimEventType(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500"
            >
              <option value="approved">🟢 Pagamento Aprovado (+30 dias)</option>
              <option value="payment_required">🟡 Falha / Atraso (Bloquear)</option>
              <option value="cancelled">🔴 Assinatura Cancelada</option>
            </select>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Valor da Fatura (R$):</label>
            <input
              type="number"
              value={simAmount}
              onChange={(e) => setSimAmount(Number(e.target.value))}
              step="0.01"
              className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Trigger Button */}
          <div>
            <button
              id="btn-executar-simulacao-master"
              onClick={() => handleRunSimulation(selectedSimTenantId, simEventType, simAmount)}
              disabled={isSimulating}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-sky-600/20 transition-all"
            >
              <Zap className="w-4 h-4" />
              <span>{isSimulating ? 'Disparando...' : 'Executar Webhook'}</span>
            </button>
          </div>

        </div>

        {/* Simulation Feedback Alert */}
        {simulationLog && (
          <div className={`p-4 rounded-2xl border text-xs animate-in fade-in duration-200 ${
            simulationLog.success 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' 
              : 'bg-red-500/10 border-red-500/30 text-red-200'
          }`}>
            <div className="font-bold flex items-center gap-2">
              {simulationLog.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
              <span>{simulationLog.message}</span>
            </div>
            {simulationLog.expiracao && (
              <div className="text-[11px] mt-1.5 opacity-90">
                Nova data de expiração calculada na base: <strong>{formatDate(simulationLog.expiracao)}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main SaaS Tenants Table & Subscription Links */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-5">
        
        {/* Search & Filter Header */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-sky-400" />
              <span>Clientes SaaS Conectecontas & Links Mercado Pago</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Gere o link de assinatura de R$ 99/mês para enviar ao cliente ou controle o status da licença.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar cliente, e-mail, plano..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500"
            >
              <option value="todos">Todos os Status</option>
              <option value="ativo">🟢 Ativos / Em dia</option>
              <option value="inativo">⚪ Inativos / Pausados</option>
              <option value="expirado">🔴 Expirados / Inadimplentes</option>
            </select>
          </div>
        </div>

        {/* Tenants List */}
        <div className="space-y-3">
          {filteredTenants.map((t) => {
            const active = isTenantActive(t);
            const daysRemaining = getDaysRemaining(t.expiracao);
            const isExpired = daysRemaining <= 0 || t.status === 'expirado';
            const generatedLink = generatedLinkMap[t.id];
            const isGenerating = generatingTenantId === t.id;
            const isCopied = copiedId === t.id;

            return (
              <div
                key={t.id}
                id={`mercadopago-tenant-card-${t.id}`}
                className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Left: Tenant Info */}
                  <div className="flex items-start gap-3.5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base border shrink-0 ${
                      active 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}>
                      {t.nome.charAt(0).toUpperCase()}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-bold text-white">{t.nome}</h4>
                        
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          active 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {active ? '🟢 Assinatura Ativa' : '🔴 Inadimplente / Bloqueado'}
                        </span>

                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                          {t.plano || 'Conectecontas Pro'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span>E-mail: <strong className="text-slate-200">{t.email}</strong></span>
                        {t.documento && <span>• Doc: <strong className="font-mono text-slate-300">{t.documento}</strong></span>}
                        <span>• Valor: <strong className="text-emerald-400">R$ {(t.valor_mensal || 99.00).toFixed(2).replace('.', ',')}/mês</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Expiration and Quick Actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Vencimento da Licença</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold ${daysRemaining > 0 ? 'text-white' : 'text-red-400'}`}>
                          {formatDate(t.expiracao)}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                          daysRemaining > 5 ? 'bg-emerald-500/20 text-emerald-300' : daysRemaining > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'
                        }`}>
                          {daysRemaining > 0 ? `${daysRemaining} dias` : 'Vencido'}
                        </span>
                      </div>
                    </div>

                    {/* Generate / Copy Mercado Pago Checkout Link */}
                    {generatedLink ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopyLink(t.id, generatedLink)}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                          title="Copiar link de checkout do Mercado Pago para enviar ao cliente"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{isCopied ? 'Link Copiado!' : 'Copiar Link MP'}</span>
                        </button>

                        <a
                          href={generatedLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                          title="Abrir checkout do Mercado Pago em nova aba"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleGenerateCheckoutLink(t)}
                        disabled={isGenerating}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>{isGenerating ? 'Gerando Link...' : 'Gerar Link Mercado Pago'}</span>
                      </button>
                    )}

                    {/* Quick Webhook Test for This Specific Tenant */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRunSimulation(t.id, 'approved', t.valor_mensal || 99.00)}
                        className="p-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-400 transition-colors cursor-pointer"
                        title="Simular pagamento aprovado do Mercado Pago (+30 dias)"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleRunSimulation(t.id, 'payment_required', t.valor_mensal || 99.00)}
                        className="p-2 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-400 transition-colors cursor-pointer"
                        title="Simular inadimplência / bloqueio imediato"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onExtendTenantLicense(t.id, 30)}
                        className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold border border-slate-700 cursor-pointer"
                        title="Adicionar +30 dias manualmente"
                      >
                        +30d
                      </button>
                    </div>

                  </div>
                </div>

                {/* If Checkout Link Generated, show URL text box */}
                {generatedLink && (
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-400 font-mono truncate">
                      Link Mercado Pago: <strong className="text-sky-300">{generatedLink}</strong>
                    </span>
                    <span className="text-[10px] text-slate-500 shrink-0 font-medium">
                      Envie este link para o cliente via WhatsApp ou E-mail
                    </span>
                  </div>
                )}

              </div>
            );
          })}

          {filteredTenants.length === 0 && (
            <div className="p-10 rounded-2xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-500">
              Nenhum cliente SaaS encontrado para os filtros selecionados.
            </div>
          )}
        </div>

      </div>

      {/* Central Invoices History Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-slate-400" />
              <span>Histórico Geral de Faturas & Webhooks Recebidos</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Notificações de cobrança processadas pelo webhook do Mercado Pago no Conectecontas.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {invoices.length} registro(s)
          </span>
        </div>

        {invoices.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-500">
            Nenhuma fatura registrada ainda. Ao processar pagamentos reais ou executar testes no simulador, os comprovantes serão listados aqui.
          </div>
        ) : (
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="p-3.5">Data / Hora</th>
                    <th className="p-3.5">ID Fatura / Transação</th>
                    <th className="p-3.5">Cliente (Tenant)</th>
                    <th className="p-3.5">Descrição do Plano</th>
                    <th className="p-3.5">Meio de Pagamento</th>
                    <th className="p-3.5">Valor</th>
                    <th className="p-3.5 text-center">Status Mercado Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {invoices.map((inv) => {
                    const tenant = tenants.find((t) => Number(t.id) === Number(inv.tenant_id));
                    return (
                      <tr key={inv.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3.5 font-mono text-slate-300">
                          {formatDate(inv.data_pagamento)}
                        </td>
                        <td className="p-3.5 font-mono text-slate-400 text-[11px]">
                          {inv.id}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-white">{tenant?.nome || `Tenant #${inv.tenant_id}`}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{tenant?.email || ''}</div>
                        </td>
                        <td className="p-3.5 text-slate-300">
                          {inv.descricao}
                        </td>
                        <td className="p-3.5 text-slate-300">
                          {inv.forma_pagamento}
                        </td>
                        <td className="p-3.5 font-black text-emerald-400">
                          R$ {Number(inv.valor || 0).toFixed(2).replace('.', ',')}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            inv.status === 'approved' || inv.status === 'authorized'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : inv.status === 'payment_required'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {inv.status === 'approved' || inv.status === 'authorized' 
                              ? 'Aprovado' 
                              : inv.status === 'payment_required' 
                              ? 'Pendente' 
                              : 'Cancelado'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Mercado Pago Credentials & Token Editor Modal */}
      <MercadoPagoCredentialsModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        currentUser={currentUser}
        onSaved={() => {
          checkMpConfig();
          if (onRefreshData) onRefreshData();
        }}
      />

    </div>
  );
};
