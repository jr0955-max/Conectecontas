import React, { useState } from 'react';
import { 
  ShieldAlert, 
  CalendarX, 
  Phone, 
  Mail, 
  ExternalLink, 
  LogOut, 
  Crown, 
  RefreshCw,
  Building2,
  Clock,
  AlertTriangle,
  CreditCard,
  CheckCircle2,
  Sparkles,
  Zap
} from 'lucide-react';
import { Tenant, User } from '../types';

interface TenantBlockedScreenProps {
  tenant?: Tenant | null;
  currentUser: User;
  onLogout: () => void;
  onOpenMasterPortal?: () => void;
  onContactAdmin?: () => void;
  reason?: 'inativo' | 'expirado';
  onSimulatePaymentSuccess?: () => void;
}

export const TenantBlockedScreen: React.FC<TenantBlockedScreenProps> = ({
  tenant,
  currentUser,
  onLogout,
  onOpenMasterPortal,
  reason = 'expirado',
  onSimulatePaymentSuccess,
}) => {
  const isMaster = Boolean(currentUser.is_master || Number(currentUser.id) === 1);
  const isExpired = reason === 'expirado' || (tenant?.expiracao && tenant.expiracao < new Date().toISOString().split('T')[0]);
  
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationFeedback, setSimulationFeedback] = useState<string | null>(null);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Não definida';
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  };

  const handlePayWithMercadoPago = async () => {
    // 1. Se o tenant já possuir um link direto gerado pelo sistema, utilize-o imediatamente
    if (tenant?.link_pagamento && tenant.link_pagamento.startsWith('http')) {
      window.open(tenant.link_pagamento, '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      setIsLoadingCheckout(true);
      const res = await fetch('/api/billing/create-subscription-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant?.id || currentUser.tenant_id || 1,
          email: currentUser.email,
          plano: tenant?.plano || 'Assinatura Conectecontas Pro',
          valor: tenant?.valor_mensal || 99.00,
        }),
      });

      const data = await res.json();
      if (data && (data.init_point || data.sandbox_init_point)) {
        const checkoutUrl = data.init_point || data.sandbox_init_point;
        window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      } else {
        alert('Não foi possível gerar o link do Mercado Pago no momento. Tente novamente em instantes.');
      }
    } catch (err) {
      console.error('Erro ao chamar checkout do Mercado Pago:', err);
      // Fallback direct link
      window.open('https://www.mercadopago.com.br', '_blank', 'noopener,noreferrer');
    } finally {
      setIsLoadingCheckout(false);
    }
  };

  const handleQuickSimulation = async () => {
    try {
      setIsSimulating(true);
      const targetId = tenant?.id || currentUser.tenant_id || 1;
      const res = await fetch('/api/billing/simulate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'approved',
          tenant_id: targetId,
          amount: tenant?.valor_mensal || 99.00,
        }),
      });

      const result = await res.json();
      if (result.success) {
        setSimulationFeedback(`✅ Pagamento Mercado Pago Aprovado! Licença estendida até ${result.data_expiracao || 'próximo mês'}.`);
        if (onSimulatePaymentSuccess) {
          onSimulatePaymentSuccess();
        }
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setSimulationFeedback('Erro ao processar simulação.');
      }
    } catch (e: any) {
      setSimulationFeedback('Falha na comunicação com o servidor.');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 sm:p-6 text-slate-100 font-sans">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-amber-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
        
        {/* Header Icon */}
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-red-500/20 to-amber-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shadow-inner">
          {isExpired ? (
            <CalendarX className="w-10 h-10 animate-pulse text-red-400" />
          ) : (
            <ShieldAlert className="w-10 h-10 animate-pulse text-amber-400" />
          )}
        </div>

        {/* Title & Status */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{isExpired ? 'Assinatura Vencida' : 'Acesso Suspenso'}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Assinatura Suspensa
          </h1>

          {/* Primary Professional Warning Message (Exact Specification) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-100 text-sm font-medium leading-relaxed text-center shadow-lg">
            <p className="font-semibold text-white text-sm sm:text-base leading-snug">
              Assinatura Suspensa. Identificamos que a mensalidade do seu ERP está pendente ou sua licença expirou. Para restabelecer o acesso às suas empresas e conciliações bancárias, por favor, regularize o pagamento.
            </p>
          </div>
        </div>

        {/* Details Card */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 text-left space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              Cliente (Tenant):
            </span>
            <span className="font-bold text-white text-right truncate max-w-[200px]">
              {tenant?.nome || currentUser.empresa_solicitada || 'Conta Principal'}
            </span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Data de Vencimento:
            </span>
            <span className="font-mono font-bold text-red-400">
              {formatDate(tenant?.expiracao)}
            </span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-slate-400" />
              Valor da Mensalidade:
            </span>
            <span className="font-bold text-emerald-400">
              R$ {(tenant?.valor_mensal || 99.00).toFixed(2).replace('.', ',')} / mês
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Usuário conectado:</span>
            <span className="font-medium text-slate-300 truncate max-w-[200px]">
              {currentUser.nome} ({currentUser.email})
            </span>
          </div>
        </div>

        {/* Action: Mercado Pago Checkout */}
        <div className="space-y-3">
          <button
            id="btn-regularizar-assinatura"
            onClick={handlePayWithMercadoPago}
            disabled={isLoadingCheckout}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-blue-600 to-indigo-600 hover:from-emerald-400 hover:via-blue-500 hover:to-indigo-500 text-white font-extrabold text-base flex items-center justify-center gap-3 shadow-xl shadow-blue-600/30 hover:shadow-blue-600/50 cursor-pointer transition-all active:scale-[0.98] border border-blue-400/30"
          >
            <CreditCard className="w-5 h-5 text-emerald-200" />
            <span>
              {isLoadingCheckout ? 'Gerando Link Mercado Pago...' : 'Regularizar Assinatura'}
            </span>
            <ExternalLink className="w-4 h-4 opacity-90" />
          </button>

          {/* Quick Simulation Button for Testing/Demo */}
          <button
            id="btn-simular-aprovacao-mp"
            onClick={handleQuickSimulation}
            disabled={isSimulating}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isSimulating ? 'Processando Webhook...' : 'Simular Aprovação Mercado Pago (+30 dias)'}</span>
          </button>

          {simulationFeedback && (
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-medium">
              {simulationFeedback}
            </div>
          )}
        </div>

        {/* Contact & Support info */}
        <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300 text-left space-y-1.5">
          <p className="font-semibold text-slate-200 flex items-center gap-1.5">
            <span>Dúvidas ou suporte ao assinante:</span>
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-sky-400 font-medium">
            <span className="flex items-center gap-1">
              <Mail className="w-3 h-3" /> financeiro@conectecontas.com.br
            </span>
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3" /> (11) 98765-4321
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          {isMaster && onOpenMasterPortal && (
            <button
              id="btn-open-master-from-blocked"
              onClick={onOpenMasterPortal}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all"
            >
              <Crown className="w-4 h-4 text-slate-950" />
              <span>Acessar Painel Master para Renovar Licença</span>
            </button>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors border border-slate-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Verificar Novamente</span>
            </button>

            <button
              onClick={onLogout}
              className="flex-1 py-2.5 px-4 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors border border-red-900/50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair / Trocar Usuário</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

