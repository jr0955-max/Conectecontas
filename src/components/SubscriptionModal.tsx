import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  ExternalLink, 
  Zap, 
  Sparkles, 
  ShieldCheck, 
  Receipt, 
  RefreshCw, 
  X,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Send
} from 'lucide-react';
import { Tenant, User, BillingInvoice } from '../types';
import { isTenantActive } from '../types';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTenant?: Tenant | null;
  currentUser: User;
  invoices: BillingInvoice[];
  onRefresh?: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  currentTenant,
  currentUser,
  invoices,
  onRefresh,
}) => {
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationLog, setSimulationLog] = useState<{
    success: boolean;
    message: string;
    action?: string;
    expiracao?: string;
  } | null>(null);

  const isActive = isTenantActive(currentTenant);
  const tenantInvoices = invoices.filter(
    (inv) => Number(inv.tenant_id) === Number(currentTenant?.id || 1)
  );

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

  const daysRemaining = getDaysRemaining(currentTenant?.expiracao);

  const handleCreateCheckout = async () => {
    try {
      setIsLoadingCheckout(true);
      const res = await fetch('/api/billing/create-subscription-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: currentTenant?.id || 1,
          email: currentUser.email,
          plano: currentTenant?.plano || 'Assinatura Conectecontas Pro',
          valor: currentTenant?.valor_mensal || 99.00,
        }),
      });

      const data = await res.json();
      if (data && (data.init_point || data.sandbox_init_point)) {
        const url = data.init_point || data.sandbox_init_point;
        setCheckoutUrl(url);
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        alert('Não foi possível gerar a preferência no Mercado Pago.');
      }
    } catch (err) {
      console.error('Erro ao gerar checkout Mercado Pago:', err);
      window.open('https://www.mercadopago.com.br', '_blank');
    } finally {
      setIsLoadingCheckout(false);
    }
  };

  const handleSimulateWebhook = async (eventType: 'approved' | 'cancelled' | 'payment_required') => {
    try {
      setIsSimulating(true);
      setSimulationLog(null);
      const res = await fetch('/api/billing/simulate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          tenant_id: currentTenant?.id || 1,
          amount: currentTenant?.valor_mensal || 99.00,
        }),
      });

      const data = await res.json();
      setSimulationLog({
        success: Boolean(data.success),
        message: data.message || (data.success ? 'Webhook processado com sucesso' : 'Falha na simulação'),
        action: data.action,
        expiracao: data.data_expiracao,
      });

      if (onRefresh) {
        setTimeout(onRefresh, 500);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 text-slate-100 font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>Minha Assinatura & Planos</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase tracking-wider">
                  Mercado Pago
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Gerencie cobrança recorrente, validade da licença e histórico de faturas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[calc(85vh-120px)] overflow-y-auto">
          
          {/* Main Plan Card & Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Plan Info Card */}
            <div className="lg:col-span-2 bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden space-y-5">
              <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                      Plano Contratado
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      isActive 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {isActive ? 'Ativo / Regular' : 'Atrasado / Inativo'}
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-white mt-1">
                    {currentTenant?.plano || 'Conectecontas Pro Multiempresa'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    Cliente: <strong className="text-slate-200">{currentTenant?.nome || 'Conta Principal'}</strong>
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-3xl font-black text-emerald-400">
                    R$ {(currentTenant?.valor_mensal || 99.00).toFixed(2).replace('.', ',')}
                  </div>
                  <div className="text-xs text-slate-400 font-medium">por mês (recorrente)</div>
                </div>
              </div>

              {/* Expiration and Timeline */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Data de Vencimento / Expiração:
                  </span>
                  <span className={`text-base font-bold font-mono ${daysRemaining > 0 ? 'text-white' : 'text-red-400'}`}>
                    {formatDate(currentTenant?.expiracao)}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Status da Licença:
                  </span>
                  <span className={`text-base font-bold ${
                    daysRemaining > 5 ? 'text-emerald-400' : daysRemaining > 0 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {daysRemaining > 0 
                      ? `${daysRemaining} dias restantes` 
                      : 'Expirado (Pagamento Necessário)'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  id="btn-modal-assinar-mercadopago"
                  onClick={handleCreateCheckout}
                  disabled={isLoadingCheckout}
                  className="flex-1 min-w-[240px] py-3.5 px-6 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-3 shadow-lg shadow-sky-600/30 hover:shadow-sky-600/50 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {isLoadingCheckout ? 'Gerando Link Mercado Pago...' : 'Assinar Sistema (R$ 99/mês)'}
                  </span>
                  <ExternalLink className="w-4 h-4 opacity-80" />
                </button>

                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                    title="Atualizar dados de cobrança"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Plan Features Overview */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Recursos do Plano
                </h4>

                <ul className="space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Multiempresa (Até {currentTenant?.limite_empresas || 5} filiais)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Gestão de Contas a Pagar e Receber</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Conciliação Bancária Pix & Boleto</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Extratos OFX & Fluxo de Caixa</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Auditoria e Sincronização em Nuvem</span>
                  </li>
                </ul>
              </div>

              <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-300 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0" />
                <span>Processamento criptografado e seguro via Mercado Pago Checkout Pro.</span>
              </div>
            </div>

          </div>

          {/* Webhook Testing & Simulator Sandbox Card */}
          <div className="p-5 rounded-3xl bg-slate-950/80 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Simulador de Webhooks do Mercado Pago</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Ambiente de Testes / Sandbox
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Teste o recebimento das notificações do webhook oficial <code className="text-sky-300 font-mono">/api/billing/webhook/mercadopago</code>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                id="btn-simular-aprovado"
                onClick={() => handleSimulateWebhook('approved')}
                disabled={isSimulating}
                className="p-3 rounded-2xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Simular Pagamento Aprovado (+30 dias)</span>
              </button>

              <button
                id="btn-simular-falha"
                onClick={() => handleSimulateWebhook('payment_required')}
                disabled={isSimulating}
                className="p-3 rounded-2xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Simular Falha / Atraso (Bloquear)</span>
              </button>

              <button
                id="btn-simular-cancelamento"
                onClick={() => handleSimulateWebhook('cancelled')}
                disabled={isSimulating}
                className="p-3 rounded-2xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <XCircle className="w-4 h-4 text-red-400" />
                <span>Simular Cancelamento de Assinatura</span>
              </button>
            </div>

            {simulationLog && (
              <div className={`p-3.5 rounded-2xl border text-xs ${
                simulationLog.success 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' 
                  : 'bg-red-500/10 border-red-500/30 text-red-200'
              }`}>
                <div className="font-bold flex items-center gap-2">
                  <span>{simulationLog.message}</span>
                </div>
                {simulationLog.expiracao && (
                  <div className="text-[11px] mt-1 opacity-90">
                    Nova data de expiração calculada: <strong>{formatDate(simulationLog.expiracao)}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Invoices & History Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-400" />
                <span>Histórico de Faturas & Pagamentos</span>
              </h4>
              <span className="text-xs text-slate-400 font-medium">
                {tenantInvoices.length} fatura(s) registrada(s)
              </span>
            </div>

            {tenantInvoices.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                Nenhuma fatura registrada no momento. Ao assinar ou simular pagamentos, os comprovantes serão exibidos aqui.
              </div>
            ) : (
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                      <tr>
                        <th className="p-3">Data</th>
                        <th className="p-3">Descrição / Plano</th>
                        <th className="p-3">Forma de Pagamento</th>
                        <th className="p-3">Valor</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {tenantInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-3 font-mono text-slate-300">
                            {formatDate(inv.data_pagamento)}
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-white">{inv.descricao}</div>
                            <div className="text-[11px] text-slate-500 font-mono">ID: {inv.id}</div>
                          </td>
                          <td className="p-3 text-slate-300">
                            {inv.forma_pagamento}
                          </td>
                          <td className="p-3 font-bold text-white">
                            R$ {Number(inv.valor || 0).toFixed(2).replace('.', ',')}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>Webhook Endpoint: <code className="text-slate-300 font-mono">POST /api/billing/webhook/mercadopago</code></span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium cursor-pointer transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
