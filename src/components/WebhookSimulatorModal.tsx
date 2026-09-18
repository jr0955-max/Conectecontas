import React, { useState, useMemo } from 'react';
import {
  Webhook,
  Building2,
  CheckCircle2,
  AlertCircle,
  Play,
  Copy,
  Check,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
  Code2,
  DollarSign,
  FileText,
  Sparkles,
  ChevronRight,
  Send,
  Sliders,
  PlusCircle,
  TrendingUp,
  TrendingDown,
  Info,
  KeyRound
} from 'lucide-react';
import { FinancialAccount, Company } from '../types';

export type WebhookProviderType = 'bb' | 'stone' | 'infinitepay';

interface WebhookSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: FinancialAccount[];
  companies: Company[];
  activeCompanyId?: number;
  activeTenantId?: number;
  onAddAccount?: (newAcc: Omit<FinancialAccount, 'id'>) => void;
  onOpenBankingCredentials?: () => void;
  onAccountReconciled?: (
    accountId: number,
    txId: string,
    provider: string,
    saldoRecalculado?: any,
    accountData?: any
  ) => void;
}

export const WebhookSimulatorModal: React.FC<WebhookSimulatorModalProps> = ({
  isOpen,
  onClose,
  accounts,
  companies,
  activeCompanyId = 1,
  activeTenantId = 1,
  onAddAccount,
  onOpenBankingCredentials,
  onAccountReconciled,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<WebhookProviderType>('bb');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('sample');
  const [filterMode, setFilterMode] = useState<'pending' | 'all'>('pending');
  const [customPayload, setCustomPayload] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [isCreatingQuickAccount, setIsCreatingQuickAccount] = useState(false);

  const [simulationHistory, setSimulationHistory] = useState<Array<{
    id: string;
    provider: string;
    timestamp: string;
    status: number;
    accountId?: number;
    valor: number;
    txId: string;
    success: boolean;
    saldoAtual?: number;
    accountDesc?: string;
  }>>([]);

  // Active (non-deleted) accounts
  const activeAccounts = useMemo(() => {
    return accounts.filter((a) => !a.excluido);
  }, [accounts]);

  // Filter pending accounts that can be selected
  const pendingAccounts = useMemo(() => {
    return activeAccounts.filter((a) => {
      const st = String(a.status || '').toLowerCase();
      return st !== 'pago' && st !== 'recebido' && st !== 'paid';
    });
  }, [activeAccounts]);

  const displayedAccounts = filterMode === 'pending' ? pendingAccounts : activeAccounts;

  // Selected account target object
  const targetAccount = useMemo(() => {
    if (selectedAccountId === 'sample') return undefined;
    return activeAccounts.find((a) => String(a.id) === String(selectedAccountId));
  }, [selectedAccountId, activeAccounts]);

  // Set default selected account when modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (pendingAccounts.length > 0) {
        const inActiveCompany = pendingAccounts.find((a) => a.empresa_id === activeCompanyId);
        const target = inActiveCompany || pendingAccounts[0];
        setSelectedAccountId(String(target.id));
      } else if (activeAccounts.length > 0) {
        setSelectedAccountId(String(activeAccounts[0].id));
      } else {
        setSelectedAccountId('sample');
      }
    }
  }, [isOpen, activeCompanyId]);

  // Generate standard payload templates based on provider and selected account
  const generatePayloadForProvider = (provider: WebhookProviderType, target?: FinancialAccount): string => {
    const nowIso = new Date().toISOString();
    const effectiveCompanyId = target ? target.empresa_id : (activeCompanyId || 1);
    const effectiveTenantId = target ? (target.tenant_id || 1) : (activeTenantId || 1);
    const rawVal = target ? Number(target.valor || 0) : 150.00;

    if (provider === 'bb') {
      const txid = target ? `id_fatura_erp_${target.id}` : `id_fatura_empresa_${effectiveCompanyId}_123`;
      const valor = rawVal.toFixed(2);
      const payload = {
        pix: [
          {
            endToEndId: `E000000002026${Math.floor(Math.random() * 90000 + 10000)}`,
            txid: txid,
            valor: valor,
            horario: nowIso,
            conta_id: target ? target.id : undefined,
            empresa_id: effectiveCompanyId,
            tenant_id: effectiveTenantId,
          },
        ],
      };
      return JSON.stringify(payload, null, 2);
    }

    if (provider === 'stone') {
      const invoiceId = target ? `conta_pagar_${target.id}` : `conta_pagar_empresa_${effectiveCompanyId}_456`;
      const amountInCents = Math.round(rawVal * 100);
      const payload = {
        event: 'charge.paid',
        data: {
          id: `chk_stone_${Math.random().toString(36).substring(2, 9)}`,
          amount: amountInCents,
          paid_at: nowIso,
          metadata: {
            tenant_id: effectiveTenantId,
            company_id: effectiveCompanyId,
            empresa_id: effectiveCompanyId,
            invoice_id: invoiceId,
            conta_id: target ? target.id : undefined,
          },
        },
      };
      return JSON.stringify(payload, null, 2);
    }

    if (provider === 'infinitepay') {
      const extRef = target ? `conta_receber_${target.id}` : `conta_receber_empresa_${effectiveCompanyId}_789`;
      const amount = Number(rawVal.toFixed(2));
      const payload = {
        transaction_id: `inf_pay_${Math.random().toString(36).substring(2, 9)}`,
        status: 'approved',
        amount: amount,
        payment_method: 'pix',
        external_reference: extRef,
        conta_id: target ? target.id : undefined,
        empresa_id: effectiveCompanyId,
        tenant_id: effectiveTenantId,
      };
      return JSON.stringify(payload, null, 2);
    }

    return '{}';
  };

  // Sync payload when provider or selected account changes
  React.useEffect(() => {
    setCustomPayload(generatePayloadForProvider(selectedProvider, targetAccount));
    setErrorMessage('');
  }, [selectedProvider, targetAccount, activeCompanyId, activeTenantId]);

  if (!isOpen) return null;

  const handleProviderSelect = (provider: WebhookProviderType) => {
    setSelectedProvider(provider);
    setCustomPayload(generatePayloadForProvider(provider, targetAccount));
  };

  const handleSelectAccount = (accId: string) => {
    setSelectedAccountId(accId);
    const target = accId !== 'sample' ? activeAccounts.find((a) => String(a.id) === accId) : undefined;
    setCustomPayload(generatePayloadForProvider(selectedProvider, target));
  };

  // 1-Click Quick Test Account Creator
  const handleCreateQuickTestAccount = () => {
    if (!onAddAccount) return;
    setIsCreatingQuickAccount(true);
    const isReceita = selectedProvider === 'bb' || selectedProvider === 'infinitepay';
    const testValor = 150.00;
    const today = new Date().toISOString().split('T')[0];
    const newAcc: Omit<FinancialAccount, 'id'> = {
      empresa_id: activeCompanyId || 1,
      tenant_id: activeTenantId || 1,
      tipo: isReceita ? 'receber' : 'pagar',
      descricao: `Fatura Teste Webhook ${selectedProvider.toUpperCase()}`,
      valor: testValor,
      data_vencimento: today,
      status: 'Pendente',
      categoria: 'Vendas & Serviços',
      banco_origem: selectedProvider === 'bb' ? 'Banco do Brasil' : selectedProvider === 'stone' ? 'Stone' : 'InfinitePay',
      conciliado: false,
      excluido: false,
    };

    onAddAccount(newAcc);
    setTimeout(() => {
      setIsCreatingQuickAccount(false);
      setFilterMode('pending');
    }, 300);
  };

  const handleSendWebhook = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setLastResponse(null);

    try {
      let parsedBody: any;
      try {
        parsedBody = JSON.parse(customPayload);
      } catch (err: any) {
        setErrorMessage(`JSON inválido no payload: ${err.message}`);
        setIsLoading(false);
        return;
      }

      const effectiveCompanyId = targetAccount ? targetAccount.empresa_id : (activeCompanyId || 1);
      const effectiveTenantId = targetAccount ? (targetAccount.tenant_id || 1) : (activeTenantId || 1);

      const queryParams = new URLSearchParams({
        provider: selectedProvider,
        empresa_id: String(effectiveCompanyId),
        company_id: String(effectiveCompanyId),
        tenant_id: String(effectiveTenantId),
      });
      if (targetAccount) {
        queryParams.set('account_id', String(targetAccount.id));
      }

      const response = await fetch(`/api/test-webhook?${queryParams.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsedBody),
      });

      const data = await response.json();
      setLastResponse({
        status: response.status,
        statusText: response.statusText,
        data,
      });

      if (response.ok && data.success) {
        const firstResult = data.results?.[0];
        if (firstResult) {
          const saldoRecalc = firstResult.saldo_recalculado;
          setSimulationHistory((prev) => [
            {
              id: `sim_${Date.now()}`,
              provider: firstResult.provider,
              timestamp: new Date().toLocaleTimeString('pt-BR'),
              status: response.status,
              accountId: firstResult.accountId,
              accountDesc: firstResult.accountDescricao,
              valor: Number(firstResult.valor) || 0,
              txId: firstResult.transacaoId,
              success: true,
              saldoAtual: saldoRecalc?.saldo_atual,
            },
            ...prev.slice(0, 9),
          ]);

          if (onAccountReconciled && firstResult.accountId) {
            onAccountReconciled(
              firstResult.accountId,
              firstResult.transacaoId,
              firstResult.provider,
              firstResult.saldo_recalculado,
              firstResult.accountData
            );
          }
        }
      } else {
        setErrorMessage(data.error || 'Falha ao processar webhook bancário.');
      }
    } catch (err: any) {
      setErrorMessage(`Erro na requisição: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const curlCommand = `curl -X POST "http://localhost:3000/api/test-webhook?provider=${selectedProvider}" \\
  -H "Content-Type: application/json" \\
  -d '${customPayload.replace(/'/g, "'\\''")}'`;

  const copyCurlToClipboard = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* ================= HEADER ================= */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-600 to-emerald-500 text-white flex items-center justify-center font-black shadow-lg shadow-blue-500/20">
              <Webhook className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Simulador de Webhooks & Conciliação Bancária
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Baixa Automática
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Simule notificações de pagamento via API para baixa automática instantânea e recálculo do saldo
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenBankingCredentials && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBankingCredentials();
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                <span>Credenciais Reais</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors text-lg leading-none cursor-pointer"
            >
              &times;
            </button>
          </div>
        </div>

        {/* ================= BODY ================= */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          
          {/* 1. Quick Simulation Provider Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>1. Escolha o Provedor Bancário</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Payloads reais padronizados conforme especificação do banco
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Banco do Brasil Button */}
              <button
                id="btn-sim-bb"
                type="button"
                onClick={() => handleProviderSelect('bb')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between group ${
                  selectedProvider === 'bb'
                    ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30 shadow-lg shadow-amber-950/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-amber-500/40 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">
                      BB
                    </span>
                    <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                      Banco do Brasil
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    Pix API
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Simula payload com <code className="text-amber-300 font-mono">pix.txid</code> e <code className="text-amber-300 font-mono">endToEndId</code>
                </p>
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-mono">?provider=bb</span>
                  <span className="text-amber-400 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    Selecionado &rarr;
                  </span>
                </div>
              </button>

              {/* Stone Button */}
              <button
                id="btn-sim-stone"
                type="button"
                onClick={() => handleProviderSelect('stone')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between group ${
                  selectedProvider === 'stone'
                    ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-950/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[#00A868] text-slate-950 font-black text-xs flex items-center justify-center">
                      ST
                    </span>
                    <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                      Banco Stone
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    Contas / Charges
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Simula evento <code className="text-emerald-300 font-mono">charge.paid</code> com valor em centavos
                </p>
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-mono">?provider=stone</span>
                  <span className="text-emerald-400 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    Selecionado &rarr;
                  </span>
                </div>
              </button>

              {/* InfinitePay Button */}
              <button
                id="btn-sim-infinitepay"
                type="button"
                onClick={() => handleProviderSelect('infinitepay')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between group ${
                  selectedProvider === 'infinitepay'
                    ? 'bg-green-950/40 border-[#00E575] ring-2 ring-[#00E575]/30 shadow-lg shadow-green-950/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-[#00E575]/40 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[#00E575] text-slate-950 font-black text-xs flex items-center justify-center">
                      IP
                    </span>
                    <span className="text-xs font-bold text-white group-hover:text-[#00E575] transition-colors">
                      InfinitePay
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 font-bold">
                    Checkout Pix
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Simula <code className="text-[#00E575] font-mono">external_reference</code> e status <code className="text-[#00E575] font-mono">approved</code>
                </p>
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-mono">?provider=infinitepay</span>
                  <span className="text-[#00E575] font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    Selecionado &rarr;
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Account Target Selector & Quick Chips */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                <span>2. Escolha o Lançamento para Vincular no Webhook</span>
              </label>
              
              {/* Filter mode toggles */}
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterMode('pending')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                    filterMode === 'pending'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Pendentes ({pendingAccounts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                    filterMode === 'all'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Todas ({activeAccounts.length})
                </button>
              </div>
            </div>

            {/* Baixa Automática Explanatory Box */}
            <div className="p-3 bg-blue-950/30 border border-blue-800/50 rounded-xl text-xs text-blue-300 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-blue-200">Baixa 100% Automática:</strong> Não requer aprovação manual em outra tela. Ao disparar o webhook, o sistema altera o status do lançamento para <strong>"Pago"</strong> ou <strong>"Recebido"</strong> e atualiza o <strong>Saldo Atual em Caixa</strong> imediatamente.
                </div>
              </div>

              {onAddAccount && (
                <button
                  type="button"
                  onClick={handleCreateQuickTestAccount}
                  disabled={isCreatingQuickAccount}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[11px] shrink-0 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  title="Cria uma fatura pendente de R$ 150,00 para testar a baixa"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Conta Teste (R$ 150)</span>
                </button>
              )}
            </div>

            {/* Quick Clickable Chips of Accounts */}
            {displayedAccounts.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Lançamentos Disponíveis ({displayedAccounts.length}) - Clique para selecionar:
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {displayedAccounts.slice(0, 6).map((acc) => {
                    const isSelected = selectedAccountId === String(acc.id);
                    const comp = companies.find((c) => c.id === acc.empresa_id);
                    const isPaid = String(acc.status).toLowerCase() === 'pago' || String(acc.status).toLowerCase() === 'recebido';

                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleSelectAccount(String(acc.id))}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                          isSelected
                            ? 'bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/40 text-white shadow-md'
                            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-bold truncate text-[11px] text-white">
                            #{acc.id} {acc.descricao}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                              acc.tipo === 'receber'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {acc.tipo}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-emerald-400">
                            {formatCurrency(acc.valor)}
                          </span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            isPaid 
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}>
                            {acc.status}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-400 truncate">
                          {comp?.nome || `Empresa #${acc.empresa_id}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center justify-between">
                <span>Nenhuma conta pendente encontrada para esta empresa.</span>
                {onAddAccount && (
                  <button
                    type="button"
                    onClick={handleCreateQuickTestAccount}
                    className="text-blue-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Criar conta pendente de teste agora
                  </button>
                )}
              </div>
            )}

            {/* Dropdown Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <select
                  id="select-sim-account"
                  value={selectedAccountId}
                  onChange={(e) => handleSelectAccount(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white outline-hidden focus:border-blue-500"
                >
                  <option value="sample">-- Simular Novo Lançamento Avulso (ID Mock) --</option>
                  {activeAccounts.map((acc) => {
                    const comp = companies.find((c) => c.id === acc.empresa_id);
                    return (
                      <option key={acc.id} value={String(acc.id)}>
                        Conta #{acc.id} - {acc.descricao} ({formatCurrency(acc.valor)}) &bull; {acc.status} &bull; {comp?.nome || 'Empresa'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Target info badge */}
              <div className="text-xs text-slate-300 flex items-center gap-2 bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-800">
                <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {targetAccount ? (
                    <>
                      <strong>#{targetAccount.id} ({targetAccount.descricao})</strong>: Valor <span className="text-emerald-400 font-bold">{formatCurrency(targetAccount.valor)}</span>. Status mudará de <span className="text-amber-400">{targetAccount.status}</span> para <span className="text-emerald-400 font-bold">{targetAccount.tipo === 'receber' ? 'Recebido' : 'Pago'}</span>.
                    </>
                  ) : (
                    'Modo avulso: criará e baixará um novo lançamento de R$ 150,00.'
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Payload JSON Editor & Endpoint info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-200">
                  Payload JSON Enviado (POST /api/test-webhook?provider={selectedProvider})
                </span>
              </div>
              <button
                type="button"
                onClick={copyCurlToClipboard}
                className="text-[11px] font-bold text-slate-300 hover:text-white px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Copiar comando cURL para rodar no terminal"
              >
                {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCurl ? 'cURL Copiado!' : 'Copiar cURL'}</span>
              </button>
            </div>

            <div className="relative">
              <textarea
                id="textarea-webhook-payload"
                rows={7}
                value={customPayload}
                onChange={(e) => setCustomPayload(e.target.value)}
                className="w-full bg-slate-950 font-mono text-xs text-emerald-400 p-3.5 rounded-2xl border border-slate-700/80 focus:border-indigo-500 focus:outline-hidden transition-colors"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Error Message if any */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Response Inspector Box */}
          {lastResponse && (
            <div className="p-4 bg-slate-950 border border-emerald-500/40 rounded-2xl space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-300">
                    Resposta da Conciliação Bancária (Status {lastResponse.status} OK)
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {lastResponse.data?.processedAt || new Date().toISOString()}
                </span>
              </div>

              {lastResponse.data?.results?.[0] && (
                <div className="space-y-2 pt-2 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Conta Conciliada</span>
                      <span className="font-bold text-white">#{lastResponse.data.results[0].accountId}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Valor Baixado</span>
                      <span className="font-bold text-emerald-400">
                        {formatCurrency(lastResponse.data.results[0].valor)}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">ID Transação (FitID)</span>
                      <span className="font-mono text-amber-300 truncate block">
                        {lastResponse.data.results[0].transacaoId}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Novo Status</span>
                      <span className="font-bold text-emerald-300 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        {lastResponse.data.results[0].newStatus || 'Pago'}
                      </span>
                    </div>
                  </div>

                  {lastResponse.data.results[0].saldo_recalculado && (
                    <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-300 font-semibold">
                          Saldo Atual em Caixa Recalculado:
                        </span>
                      </div>
                      <span className="text-sm font-bold text-emerald-300 font-mono">
                        {formatCurrency(lastResponse.data.results[0].saldo_recalculado.saldo_atual)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-slate-300 pt-1">
                {lastResponse.data?.message || 'Lançamento atualizado e salvo na nuvem com sucesso.'}
              </p>
            </div>
          )}

          {/* Simulation History list */}
          {simulationHistory.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Histórico de Disparos Nesta Sessão ({simulationHistory.length})
                </span>
                <span className="text-[11px]">Sincronização em tempo real</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {simulationHistory.map((item) => (
                  <div
                    key={item.id}
                    className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span className="font-bold text-white">{item.provider}</span>
                      <span className="text-slate-400 font-mono text-[11px]">Tx: {item.txId}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-400">{formatCurrency(item.valor)}</span>
                      <span className="text-slate-400 text-[10px]">{item.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ================= FOOTER ACTIONS ================= */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Auditoria e histórico salvos automaticamente</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              Fechar
            </button>

            <button
              id="btn-execute-webhook-simulation"
              type="button"
              onClick={handleSendWebhook}
              disabled={isLoading}
              className={`px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50 ${
                selectedProvider === 'bb'
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                  : selectedProvider === 'stone'
                  ? 'bg-[#00A868] hover:bg-[#009058] text-white shadow-emerald-500/20'
                  : 'bg-[#00E575] hover:bg-[#00c965] text-slate-950 shadow-green-500/20'
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processando Webhook...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>
                    {selectedProvider === 'bb'
                      ? 'Simular Pagamento BB'
                      : selectedProvider === 'stone'
                      ? 'Simular Venda Stone'
                      : 'Simular Pix InfinitePay'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
