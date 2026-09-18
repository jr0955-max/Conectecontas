import React, { useState, useEffect } from 'react';
import { 
  X, 
  Landmark, 
  ShieldCheck, 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  RefreshCw, 
  Trash2, 
  Power, 
  Zap, 
  Server, 
  ExternalLink,
  ShieldAlert,
  Sliders,
  FileKey,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Sparkles,
  Play
} from 'lucide-react';
import { TenantBankingCredential, Company, User, FinancialAccount } from '../types';
import { saveCloudBankingCredential, deleteCloudBankingCredential } from '../firebase';

interface BankingIntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  selectedCompanyId: number;
  currentUser: User;
  initialProvider?: ProviderType;
  onOpenAuditLogs?: () => void;
  onAccountReconciled?: (
    accountId: number,
    txId: string,
    provider: string,
    saldoRecalculado?: any,
    accountData?: Partial<FinancialAccount>
  ) => void;
  onRefreshData?: () => void;
}

type ProviderType = 'bb' | 'stone' | 'infinitepay' | 'mercadopago';

interface ProviderMeta {
  id: ProviderType;
  name: string;
  shortName: string;
  badgeColor: string;
  accentBg: string;
  borderColor: string;
  description: string;
  clientIdLabel: string;
  clientIdPlaceholder: string;
  clientSecretLabel: string;
  webhookSecretLabel: string;
  webhookSecretHelp: string;
  docsUrl: string;
  hasCertificate: boolean;
}

const PROVIDERS: Record<ProviderType, ProviderMeta> = {
  mercadopago: {
    id: 'mercadopago',
    name: 'Mercado Pago (Pix, Cartão & Assinaturas)',
    shortName: 'Mercado Pago',
    badgeColor: 'bg-sky-500 text-slate-950 font-bold',
    accentBg: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    borderColor: 'border-sky-500/40',
    description: 'Cobranças recorrentes, links de checkout e recebimento instantâneo via Pix e Cartão com Webhooks em tempo real.',
    clientIdLabel: 'Public Key (Chave Pública)',
    clientIdPlaceholder: 'ex: APP_USR-67890abcdef...',
    clientSecretLabel: 'Access Token (Token de Acesso Bearer)',
    webhookSecretLabel: 'Webhook Secret / Chave de Assinatura Webhook',
    webhookSecretHelp: 'Chave secreta configurada no painel de Webhooks do Mercado Pago para verificação de autenticidade HMAC.',
    docsUrl: 'https://www.mercadopago.com.br/developers/panel/app',
    hasCertificate: false,
  },
  bb: {
    id: 'bb',
    name: 'Banco do Brasil (Pix & Cobrança)',
    shortName: 'Banco do Brasil',
    badgeColor: 'bg-amber-500 text-slate-950 font-bold',
    accentBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    borderColor: 'border-amber-500/40',
    description: 'Integração oficial via API Pix BB e Cobrança com validação mTLS / Webhook seguro.',
    clientIdLabel: 'Developer Application Key (Client ID)',
    clientIdPlaceholder: 'ex: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    clientSecretLabel: 'Client Secret (OAuth 2.0)',
    webhookSecretLabel: 'Webhook Secret / Token de Validação',
    webhookSecretHelp: 'Chave secreta enviada no header de autenticação das notificações Pix.',
    docsUrl: 'https://developers.bb.com.br/',
    hasCertificate: true,
  },
  stone: {
    id: 'stone',
    name: 'Stone Pagamentos (Contas & Cartões)',
    shortName: 'Stone Pagamentos',
    badgeColor: 'bg-emerald-500 text-slate-950 font-bold',
    accentBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    borderColor: 'border-emerald-500/40',
    description: 'Conciliação automática de vendas em maquininhas, boletos e contas Stone via Webhooks assinados.',
    clientIdLabel: 'Chave Pública (pk_...) ou Stonecode / Merchant ID',
    clientIdPlaceholder: 'ex: pk_81ff... ou pk_live_... ou seu Stonecode (código de 9 dígitos)',
    clientSecretLabel: 'Secret Key (Chave Privada Stone)',
    webhookSecretLabel: 'Stone Webhook Secret (HMAC-SHA256)',
    webhookSecretHelp: 'Chave de assinatura configurada no Portal Stone para validar a integridade dos webhooks via HMAC-SHA256.',
    docsUrl: 'https://docs.stone.com.br/',
    hasCertificate: false,
  },
  infinitepay: {
    id: 'infinitepay',
    name: 'InfinitePay (Checkout Oficial & Links)',
    shortName: 'InfinitePay',
    badgeColor: 'bg-indigo-500 text-white font-bold',
    accentBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    borderColor: 'border-indigo-500/40',
    description: 'Geração automática de Links de Pagamento (Pix/Cartão) e conciliação instantânea via Webhook oficial.',
    clientIdLabel: 'Sua InfiniteTag / Handle (sem o símbolo $)',
    clientIdPlaceholder: 'ex: lavepegue-arcoverde (sem o $)',
    clientSecretLabel: 'API Secret Token (Não obrigatório para o Checkout)',
    webhookSecretLabel: 'Webhook Secret (Opcional se configurado)',
    webhookSecretHelp: 'A API de Checkout da InfinitePay utiliza sua InfiniteTag. Segredos são opcionais.',
    docsUrl: 'https://infinitepay.io/developers',
    hasCertificate: false,
  },
};

export const BankingIntegrationsModal: React.FC<BankingIntegrationsModalProps> = ({
  isOpen,
  onClose,
  companies,
  selectedCompanyId,
  currentUser,
  initialProvider,
  onOpenAuditLogs,
  onAccountReconciled,
  onRefreshData,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>(initialProvider || 'stone');
  
  // Resolve initial company ID safely to a real company from the list
  const getInitialCompanyId = () => {
    if (selectedCompanyId && selectedCompanyId !== -1 && companies.some((c) => c.id === selectedCompanyId)) {
      return selectedCompanyId;
    }
    return companies[0]?.id || 1;
  };

  const [targetCompanyId, setTargetCompanyId] = useState<number>(getInitialCompanyId);

  useEffect(() => {
    if (selectedCompanyId && selectedCompanyId !== -1 && companies.some((c) => c.id === selectedCompanyId)) {
      setTargetCompanyId(selectedCompanyId);
    } else if (companies.length > 0 && !companies.some((c) => c.id === targetCompanyId)) {
      setTargetCompanyId(companies[0].id);
    }
  }, [selectedCompanyId, companies]);

  const [ambiente, setAmbiente] = useState<'sandbox' | 'producao'>('sandbox');
  const [status, setStatus] = useState<'ativo' | 'inativo'>('ativo');
  
  // Stone Step-by-Step and Simulation states
  const [showStoneGuide, setShowStoneGuide] = useState(true);
  const [isSimulatingStone, setIsSimulatingStone] = useState(false);
  const [stoneSimulationResult, setStoneSimulationResult] = useState<any>(null);
  const [isRegisteringStoneHook, setIsRegisteringStoneHook] = useState(false);
  const [stoneHookRegisterResult, setStoneHookRegisterResult] = useState<{ success: boolean; message: string; hookId?: string } | null>(null);

  // InfinitePay Step-by-Step and Simulation states
  const [showInfinitePayGuide, setShowInfinitePayGuide] = useState(true);
  const [isSimulatingInfinitePay, setIsSimulatingInfinitePay] = useState(false);
  const [infinitePaySimulationResult, setInfinitePaySimulationResult] = useState<any>(null);
  const [isGeneratingInfiniteLink, setIsGeneratingInfiniteLink] = useState(false);
  const [generatedInfiniteLink, setGeneratedInfiniteLink] = useState<string | null>(null);

  // Credentials input state
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [certificadoPath, setCertificadoPath] = useState('');
  
  // Security Visibility Toggles
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  // List of existing saved credentials
  const [credentialsList, setCredentialsList] = useState<TenantBankingCredential[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  // Feedback
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [diagnosticsResult, setDiagnosticsResult] = useState<any>(null);

  const tenantId = currentUser?.tenant_id || 1;
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://financeiro.conectecontas.com';
  const webhookUrl = `${currentOrigin}/api/webhooks/${selectedProvider}?company_id=${targetCompanyId}&tenant_id=${tenantId}`;

  // When initialProvider changes or modal opens
  useEffect(() => {
    if (isOpen && initialProvider) {
      setSelectedProvider(initialProvider);
    }
  }, [isOpen, initialProvider]);

  // Quick simulation for Stone payment webhook (supports Credit and Debit events)
  const handleQuickSimulateStone = async (simType: 'credit' | 'debit' = 'credit') => {
    setIsSimulatingStone(true);
    setStoneSimulationResult(null);
    try {
      const isDebit = simType === 'debit';
      const eventName = isDebit ? 'BILL_PAID' : 'charge.paid';
      const amountCents = isDebit ? 8550 : 14990;
      const valorFormatado = isDebit ? 85.50 : 149.90;
      const desc = isDebit ? 'Pagamento Boleto Fornecedor via Stone' : 'Venda Maquininha / Pix Stone';

      const res = await fetch(`/api/test-webhook?provider=stone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: eventName,
          data: {
            id: `chk_stone_${Math.random().toString(36).substring(2, 9)}`,
            amount: amountCents,
            description: desc,
            status: 'paid',
            paid_at: new Date().toISOString(),
            payment_method: isDebit ? 'Conta Digital Stone (Boleto)' : 'Cartão / Pix Stone (POS)',
            metadata: {
              company_id: targetCompanyId,
              tenant_id: tenantId,
              invoice_id: `${isDebit ? 'BOLETO_STONE' : 'VENDA_STONE'}_${Date.now().toString().slice(-6)}`
            }
          }
        })
      });
      const data = await res.json();
      setStoneSimulationResult({ success: res.ok, data });
      if (res.ok) {
        setNotification({
          type: 'success',
          message: isDebit 
            ? 'Saída Stone simulada com sucesso! Lançamento gerado e baixado em Contas a Pagar (R$ 85,50).'
            : 'Entrada Stone simulada com sucesso! Lançamento gerado e conciliado em Contas a Receber (R$ 149,90).',
        });
        loadCredentials();
        const resItem = data.results?.[0];
        if (resItem && onAccountReconciled) {
          onAccountReconciled(
            resItem.accountId,
            resItem.transacaoId,
            'Stone',
            resItem.saldo_recalculado,
            resItem.accountData || {
              id: resItem.accountId,
              empresa_id: targetCompanyId,
              tenant_id: tenantId,
              tipo: isDebit ? 'pagar' : 'receber',
              descricao: resItem.accountDescricao || (isDebit ? 'Saída via Stone (Boleto)' : 'Entrada via Stone (Cartão)'),
              valor: resItem.valor || valorFormatado,
              status: isDebit ? 'Pago' : 'Recebido',
              conciliado: true,
              banco_origem: 'Banco Stone (Conta Digital PJ)',
            }
          );
        }
        if (onRefreshData) {
          onRefreshData();
        }
      } else {
        setNotification({
          type: 'error',
          message: data.error || 'Falha ao simular movimentação Stone.',
        });
      }
    } catch (err: any) {
      setStoneSimulationResult({ success: false, error: err.message });
      setNotification({
        type: 'error',
        message: err.message || 'Erro de conexão na simulação Stone.',
      });
    } finally {
      setIsSimulatingStone(false);
    }
  };

  // Auto-register webhook in Stone/Pagar.me API v5 using the secret key (sk_...)
  const handleAutoRegisterStoneWebhook = async () => {
    if (!clientSecret || !clientSecret.startsWith('sk_')) {
      setNotification({
        type: 'error',
        message: 'Cole sua Chave Secreta da Stone (iniciada com "sk_") no campo "Secret Key" antes de cadastrar automaticamente.',
      });
      return;
    }
    setIsRegisteringStoneHook(true);
    setStoneHookRegisterResult(null);
    try {
      const res = await fetch('/api/stone/register-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret_key: clientSecret,
          webhook_url: webhookUrl,
        }),
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        data = { success: false, error: 'Resposta inesperada do servidor ao processar cadastro na Stone.' };
      }
      if (res.ok && data.success) {
        setStoneHookRegisterResult({
          success: true,
          message: data.message || 'Webhook cadastrado e ativado na Stone/Pagar.me com sucesso!',
          hookId: data.hook_id,
        });
        setNotification({
          type: 'success',
          message: `Webhook cadastrado com sucesso na Stone! ID: ${data.hook_id || 'Ativo'}`,
        });
      } else {
        setStoneHookRegisterResult({
          success: false,
          message: data.error || 'A Stone retornou erro ao cadastrar o webhook. Verifique o guia manual abaixo.',
        });
        setNotification({
          type: 'error',
          message: data.error || 'Falha ao cadastrar webhook na Stone via API.',
        });
      }
    } catch (err: any) {
      setStoneHookRegisterResult({
        success: false,
        message: err?.message || 'Falha de conexão com a API da Stone.',
      });
      setNotification({
        type: 'error',
        message: err?.message || 'Falha de conexão com a API da Stone.',
      });
    } finally {
      setIsRegisteringStoneHook(false);
    }
  };

  // Quick simulation for InfinitePay payment webhook (using official interactive docs payload format)
  const handleQuickSimulateInfinitePay = async () => {
    setIsSimulatingInfinitePay(true);
    setInfinitePaySimulationResult(null);
    try {
      const activeCompId = targetCompanyId || companies[0]?.id || 1;
      const res = await fetch(`/api/webhooks/infinitepay?empresa_id=${activeCompId}&tenant_id=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_slug: `inv_${Math.random().toString(36).substring(2, 8)}`,
          amount: 15000, // 15000 centavos = R$ 150,00
          paid_amount: 15000,
          installments: 1,
          capture_method: 'pix',
          transaction_nsu: `uuid_tx_${Math.random().toString(36).substring(2, 9)}`,
          order_nsu: `empresa_${activeCompId}_${Date.now()}`,
          receipt_url: 'https://comprovante.infinitepay.io/exemplo-sucesso',
          items: [
            {
              quantity: 1,
              price: 15000,
              description: 'Serviço de Lavanderia / Venda de Produtos',
            },
          ],
        }),
      });
      const data = await res.json();
      setInfinitePaySimulationResult({ success: res.ok, data });
      if (res.ok) {
        setNotification({
          type: 'success',
          message: 'Webhook oficial InfinitePay processado com sucesso! R$ 150,00 conciliado no Contas a Receber.',
        });
        loadCredentials();
        const resItem = data.results?.[0];
        if (resItem && onAccountReconciled) {
          onAccountReconciled(
            resItem.accountId,
            resItem.transacaoId,
            'InfinitePay',
            resItem.saldo_recalculado,
            resItem.accountData || {
              id: resItem.accountId,
              empresa_id: activeCompId,
              tenant_id: tenantId,
              tipo: 'receber',
              descricao: resItem.accountDescricao || 'Recebimento Pix InfinitePay (Checkout)',
              valor: resItem.valor || 150.00,
              status: 'Recebido',
              conciliado: true,
              banco_origem: 'InfinitePay (Maquininha/Checkout)',
            }
          );
        }
        if (onRefreshData) {
          onRefreshData();
        }
      } else {
        setNotification({
          type: 'error',
          message: data.error || 'Falha ao simular recebimento InfinitePay.',
        });
      }
    } catch (err: any) {
      setInfinitePaySimulationResult({ success: false, error: err.message });
      setNotification({
        type: 'error',
        message: err.message || 'Erro de conexão na simulação InfinitePay.',
      });
    } finally {
      setIsSimulatingInfinitePay(false);
    }
  };

  // Test official InfinitePay Checkout Link generation via POST https://api.checkout.infinitepay.io/links
  const handleTestCreateInfinitePayLink = async () => {
    setIsGeneratingInfiniteLink(true);
    setGeneratedInfiniteLink(null);
    try {
      const tagToUse = clientId.trim().replace(/^\$/, '') || 'lavepegue-arcoverde';
      const res = await fetch('/api/infinitepay/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: targetCompanyId,
          tenant_id: tenantId,
          valor: 10.00,
          descricao: 'Teste de Checkout InfinitePay - ConecteContas',
          cliente_nome: currentUser?.nome || 'Cliente Teste',
          cliente_email: currentUser?.email || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.checkout_url) {
        setGeneratedInfiniteLink(data.checkout_url);
        setNotification({
          type: 'success',
          message: `Link gerado com sucesso para a tag ${data.handle}! URL: ${data.checkout_url}`,
        });
      } else {
        setNotification({
          type: 'error',
          message: data.error || 'Erro ao gerar link de pagamento na InfinitePay.',
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Erro ao conectar à API do Checkout InfinitePay.',
      });
    } finally {
      setIsGeneratingInfiniteLink(false);
    }
  };

  // Load saved credentials from backend
  const loadCredentials = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/banking-credentials?tenant_id=${tenantId}&company_id=${targetCompanyId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.credentials)) {
        setCredentialsList(data.credentials);
        
        // Find existing credential for currently selected provider
        const existing = data.credentials.find((c: any) => c.provider === selectedProvider && c.company_id === targetCompanyId);
        if (existing) {
          setClientId(existing.client_id || '');
          setClientSecret(existing.has_client_secret ? '••••••••••••' : '');
          setWebhookSecret(existing.has_webhook_secret ? '••••••••••••' : '');
          setChavePix(existing.chave_pix || '');
          setCertificadoPath(existing.certificado_path || '');
          setAmbiente(existing.ambiente || 'sandbox');
          setStatus(existing.status || 'ativo');
        } else {
          // Reset fields for new integration
          setClientId('');
          setClientSecret('');
          setWebhookSecret('');
          setChavePix('');
          setCertificadoPath('');
          setAmbiente('sandbox');
          setStatus('ativo');
        }
      }
    } catch (err) {
      console.error('Erro ao carregar credenciais:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCredentials();
      setNotification(null);
      setDiagnosticsResult(null);
    }
  }, [isOpen, targetCompanyId, selectedProvider]);

  if (!isOpen) return null;

  const handleProviderSelect = (p: ProviderType) => {
    setSelectedProvider(p);
    setDiagnosticsResult(null);
    setNotification(null);
    // Find if already exists
    const existing = credentialsList.find(c => c.provider === p && c.company_id === targetCompanyId);
    if (existing) {
      setClientId(existing.client_id || '');
      setClientSecret(existing.has_client_secret ? '••••••••••••' : '');
      setWebhookSecret(existing.has_webhook_secret ? '••••••••••••' : '');
      setChavePix(existing.chave_pix || '');
      setCertificadoPath(existing.certificado_path || '');
      setAmbiente(existing.ambiente || 'sandbox');
      setStatus(existing.status || 'ativo');
    } else {
      setClientId('');
      setClientSecret('');
      setWebhookSecret('');
      setChavePix('');
      setCertificadoPath('');
      setAmbiente('sandbox');
      setStatus('ativo');
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(webhookUrl);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setNotification(null);
    setDiagnosticsResult(null);
    try {
      const res = await fetch('/api/banking-credentials/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          client_id: clientId,
          client_secret: clientSecret,
          webhook_secret: webhookSecret,
          ambiente,
        }),
      });
      const data = await res.json();
      setDiagnosticsResult(data);
      if (data.success) {
        setNotification({
          type: 'success',
          message: data.message || 'Conexão e chaves de segurança validadas com sucesso!',
        });
      } else {
        setNotification({
          type: 'error',
          message: data.message || 'Aviso na verificação de chaves. Verifique os campos preenchidos.',
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'Falha ao conectar com o serviço de diagnóstico.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim()) {
      setNotification({
        type: 'error',
        message: 'O campo Client ID / Chave Pública é obrigatório.',
      });
      return;
    }

    setIsSaving(true);
    setNotification(null);
    try {
      const cleanClientId = selectedProvider === 'infinitepay' ? clientId.trim().replace(/^\$/, '') : clientId.trim();
      const payload = {
        tenant_id: tenantId,
        company_id: targetCompanyId,
        provider: selectedProvider,
        client_id: cleanClientId,
        client_secret: clientSecret.trim(),
        webhook_secret: webhookSecret.trim(),
        chave_pix: chavePix.trim() || undefined,
        certificado_path: certificadoPath.trim() || undefined,
        ambiente,
        status,
        usuario_nome: currentUser?.nome || 'Administrador',
        usuario_id: currentUser?.id,
      };

      const res = await fetch('/api/banking-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setNotification({
          type: 'success',
          message: `Credenciais do ${PROVIDERS[selectedProvider].shortName} salvas e criptografadas com sucesso!`,
        });
        await loadCredentials();
      } else {
        setNotification({
          type: 'error',
          message: data.error || 'Erro ao salvar credenciais bancárias.',
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'Erro de comunicação ao salvar credenciais.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, providerName: string) => {
    if (!window.confirm(`Tem certeza que deseja remover as credenciais de ${providerName}? O webhook deixará de processar transações para este banco.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/banking-credentials/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setNotification({
          type: 'info',
          message: `Credencial de ${providerName} removida com sucesso.`,
        });
        await loadCredentials();
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'Falha ao remover credencial.',
      });
    }
  };

  const currentMeta = PROVIDERS[selectedProvider];
  const targetCompany = companies.find(c => c.id === targetCompanyId) || companies[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Integrações Bancárias & Credenciais de Produção
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  AES-256 Criptografado
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Configure as chaves de API oficiais e segredos de Webhook dos bancos para conciliação em tempo real.
              </p>
            </div>
          </div>

          <button
            id="btn-close-banking-modal"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-200">
          
          {/* Notification Alert */}
          {notification && (
            <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs animate-in fade-in duration-150 ${
              notification.type === 'success' ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300' :
              notification.type === 'error' ? 'bg-rose-950/50 border-rose-500/40 text-rose-300' :
              'bg-blue-950/50 border-blue-500/40 text-blue-300'
            }`}>
              <div className="flex items-center gap-2">
                {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                {notification.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
                {notification.type === 'info' && <Server className="w-4 h-4 text-blue-400 shrink-0" />}
                <span>{notification.message}</span>
              </div>
              <button 
                onClick={() => setNotification(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Company Selector & Global Context */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/50 border border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-blue-400" />
                Empresa / CNPJ Titular:
              </label>
              <select
                id="select-banking-company"
                value={targetCompanyId}
                onChange={(e) => setTargetCompanyId(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-blue-500"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} {c.cnpj ? `(${c.cnpj})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Nível de Proteção dos Segredos:
              </label>
              <div className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <Lock className="w-3.5 h-3.5" />
                  Cofre AES-256-GCM Ativo
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  HMAC-SHA256 Auth
                </span>
              </div>
            </div>
          </div>

          {/* Provider Selection Tabs */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              1. Selecione o Provedor Bancário:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(Object.keys(PROVIDERS) as ProviderType[]).map((pKey) => {
                const p = PROVIDERS[pKey];
                const isSelected = selectedProvider === pKey;
                const existing = credentialsList.find(c => c.provider === pKey && c.company_id === targetCompanyId);

                return (
                  <button
                    key={pKey}
                    id={`btn-provider-${pKey}`}
                    type="button"
                    onClick={() => handleProviderSelect(pKey)}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? `${p.accentBg} ${p.borderColor} shadow-md ring-1 ring-blue-500/50`
                        : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-white">
                        {p.shortName}
                      </span>
                      {existing ? (
                        <span className={`px-1.5 py-0.5 text-[9px] rounded-md font-bold uppercase ${
                          existing.status === 'ativo' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-300'
                        }`}>
                          {existing.status}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">
                          Não configurado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">
                      {p.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stone Specific Step-by-Step Guide */}
          {selectedProvider === 'stone' && (
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 mb-3">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                      <span>Passo a Passo: Integração Oficial Stone</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full uppercase font-mono">
                        Conciliação Automática
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Siga os 5 passos abaixo para conectar suas maquininhas e cobranças Stone diretamente a este financeiro.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStoneGuide(!showStoneGuide)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {showStoneGuide ? (
                    <>
                      <span>Recolher</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Ver Passos (1 a 5)</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {showStoneGuide && (
                <div className="space-y-3 pt-2 border-t border-emerald-500/20 text-xs">
                  {/* Step 1 */}
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0 text-xs shadow-xs">
                      1
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-white font-bold">Acessar o Painel de Desenvolvedor da Stone / Pagar.me</strong>
                        <a 
                          href="https://dashboard.stone.com.br" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[11px] text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1 font-semibold"
                        >
                          Abrir Portal Stone <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="text-slate-400 leading-relaxed">
                        Faça login na sua conta Stone ou Pagar.me v5. No menu lateral esquerdo, clique em <strong>Configurações</strong> e selecione a aba <strong>Chaves de API</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0 text-xs shadow-xs">
                      2
                    </div>
                    <div className="space-y-1 flex-1">
                      <strong className="text-white font-bold">Copiar a Chave de API Pública e a Chave Secreta</strong>
                      <p className="text-slate-400 leading-relaxed">
                        • Cole a <strong>Chave Pública (API Key / Merchant ID)</strong> no campo abaixo (começa geralmente com <code className="text-emerald-400 font-mono">ak_live_</code> ou seu identificador de loja).<br />
                        • Cole a <strong>Chave Secreta (Secret Key)</strong> no campo de senha (começa com <code className="text-emerald-400 font-mono">sk_live_</code>). Ela é salva no cofre criptografado com AES-256.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0 text-xs shadow-xs">
                      3
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <strong className="text-white font-bold">Onde cadastrar a URL do Webhook na Stone:</strong>
                      <p className="text-slate-300 leading-relaxed text-[11px]">
                        <strong>Atenção:</strong> Na tela onde você gerou a chave <code className="text-emerald-400 font-mono">sk_...</code> (Chaves de API), não existe o campo de URL. O campo fica em uma aba separada chamada <strong>Webhooks</strong>:
                      </p>
                      <ul className="text-slate-400 text-[11px] list-disc list-inside space-y-1 pl-1">
                        <li>No menu lateral esquerdo do Dashboard Stone/Pagar.me, clique em <strong className="text-white">Configurações</strong> (ícone de engrenagem).</li>
                        <li>No topo da página, clique na aba <strong className="text-emerald-400">Webhooks</strong> (fica ao lado de <em>Chaves de API</em>).</li>
                        <li>Clique no botão <strong className="text-white">"Criar Webhook"</strong> no canto superior direito.</li>
                        <li>No campo <strong className="text-white">URL</strong>, cole a URL copiada abaixo. Em eventos, marque <code className="text-emerald-400 font-mono">charge.paid</code>, <code className="text-emerald-400 font-mono">order.paid</code> e saídas.</li>
                        <li><em>Ou use o botão automático abaixo:</em> cole sua chave <code className="text-emerald-400 font-mono">sk_...</code> no campo de Chave Secreta e clique em <strong>"Cadastrar Webhook na Stone Automaticamente"</strong>!</li>
                      </ul>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0 text-xs shadow-xs">
                      4
                    </div>
                    <div className="space-y-1 flex-1">
                      <strong className="text-white font-bold">Copiar a Chave de Assinatura Webhook (HMAC Secret)</strong>
                      <p className="text-slate-400 leading-relaxed">
                        Após cadastrar o Webhook, a Stone exibirá o <strong>Webhook Secret</strong> (ex: <code className="text-emerald-400 font-mono">whsec_...</code>). Cole-o no campo <strong>Stone Webhook Secret</strong> para ativar a proteção antifraude criptográfica HMAC-SHA256.
                      </p>
                    </div>
                  </div>

                  {/* Step 5 */}
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0 text-xs shadow-xs">
                      5
                    </div>
                    <div className="space-y-1 flex-1">
                      <strong className="text-white font-bold">Validar Conexão e Simular Movimentações Reais (Entradas e Saídas)</strong>
                      <p className="text-slate-400 leading-relaxed">
                        Clique em <strong>Testar Conexão</strong> para validar as chaves. Depois, clique em <strong>Salvar e Ativar Integração</strong>. Você também pode testar os dois tipos de movimentação suportados pela Stone:
                      </p>
                      <div className="pt-2 flex flex-wrap items-center gap-2">
                        {/* Simular Entrada */}
                        <button
                          type="button"
                          id="btn-simulate-stone-credit"
                          onClick={() => handleQuickSimulateStone('credit')}
                          disabled={isSimulatingStone}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        >
                          {isSimulatingStone ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Processando...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              <span>Simular Entrada (Venda/Pix R$ 149,90)</span>
                            </>
                          )}
                        </button>

                        {/* Simular Saída */}
                        <button
                          type="button"
                          id="btn-simulate-stone-debit"
                          onClick={() => handleQuickSimulateStone('debit')}
                          disabled={isSimulatingStone}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        >
                          {isSimulatingStone ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Processando...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              <span>Simular Saída (Boleto Pago R$ 85,50)</span>
                            </>
                          )}
                        </button>

                        {stoneSimulationResult?.success && (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1 text-[11px] ml-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Conciliado com sucesso!
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* InfinitePay Specific Step-by-Step Guide */}
          {selectedProvider === 'infinitepay' && (
            <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 mb-3">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-1.5">
                      <span>Passo a Passo: Integração Oficial InfinitePay</span>
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full uppercase font-mono">
                        Maquininha & Pix Automático
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Siga os 4 passos rápidos para integrar sua maquininha InfinitePay ou InfiniteTap ao financeiro.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInfinitePayGuide(!showInfinitePayGuide)}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {showInfinitePayGuide ? (
                    <>
                      <span>Recolher</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Ver Passos (1 a 4)</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {showInfinitePayGuide && (
                <div className="space-y-3 pt-2 border-t border-indigo-500/20 text-xs">
                  {/* Step 1 */}
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="w-6 h-6 rounded-full bg-indigo-500 text-white font-black flex items-center justify-center shrink-0 text-xs shadow-xs">
                      1
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-white font-bold">Cadastrar a URL do Webhook na InfinitePay</strong>
                        <a 
                          href="https://infinitepay.io/developers" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1 font-semibold"
                        >
                          Portal InfinitePay <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="text-slate-400 leading-relaxed">
                        No app ou painel web da InfinitePay (ou CloudWalk Developers), vá em <strong>Configurações &gt; Webhooks / Notificações</strong>. Copie a <strong>URL do Webhook</strong> gerada no Bloco 3 logo abaixo e cole no campo de URL de notificação da InfinitePay.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="w-6 h-6 rounded-full bg-indigo-500 text-white font-black flex items-center justify-center shrink-0 text-xs shadow-xs">
                      2
                    </div>
                    <div className="space-y-1 flex-1">
                      <strong className="text-white font-bold">Informar sua InfiniteTag / Handle</strong>
                      <p className="text-slate-400 leading-relaxed">
                        Conforme a documentação oficial da InfinitePay, o <strong>Handle</strong> é obrigatório e identifica sua conta no App. Use-o <strong>sem o símbolo $ do início</strong>:
                        <br />• Exemplo: <code className="text-indigo-300 bg-indigo-950/70 px-1.5 py-0.5 rounded border border-indigo-500/40 font-mono font-bold">lavepegue-arcoverde</code> (sem o $).
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="w-6 h-6 rounded-full bg-indigo-500 text-white font-black flex items-center justify-center shrink-0 text-xs shadow-xs">
                      3
                    </div>
                    <div className="space-y-1 flex-1">
                      <strong className="text-white font-bold">Chaves Secretas (Opcionais)</strong>
                      <p className="text-slate-400 leading-relaxed">
                        A API de Checkout da InfinitePay requer <strong>apenas a sua InfiniteTag</strong>! Os campos <strong>API Secret</strong> e <strong>Webhook Secret</strong> podem ficar <strong>em branco</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="w-6 h-6 rounded-full bg-indigo-500 text-white font-black flex items-center justify-center shrink-0 text-xs shadow-xs">
                      4
                    </div>
                    <div className="space-y-2 flex-1">
                      <strong className="text-white font-bold">Testar Geração de Link e Simular Pagamento</strong>
                      <p className="text-slate-400 leading-relaxed">
                        Você pode testar a criação real de um link de pagamento na InfinitePay e simular o recebimento automático:
                      </p>
                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        {/* Botão de Gerar Link Real */}
                        <button
                          type="button"
                          id="btn-test-create-link"
                          onClick={handleTestCreateInfinitePayLink}
                          disabled={isGeneratingInfiniteLink}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        >
                          {isGeneratingInfiniteLink ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Chamando API InfinitePay...</span>
                            </>
                          ) : (
                            <>
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Testar Gerador de Link InfinitePay</span>
                            </>
                          )}
                        </button>

                        {/* Botão de Simular Webhook */}
                        <button
                          type="button"
                          id="btn-simulate-infinitepay-step"
                          onClick={handleQuickSimulateInfinitePay}
                          disabled={isSimulatingInfinitePay}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        >
                          {isSimulatingInfinitePay ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Processando Webhook...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              <span>Simular Notificação de Pagamento (R$ 150,00)</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Exibição do Link Real Gerado */}
                      {generatedInfiniteLink && (
                        <div className="p-2.5 mt-2 rounded-xl bg-indigo-950/60 border border-indigo-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="overflow-hidden">
                            <span className="text-[11px] text-indigo-300 font-semibold block">Link de Pagamento Oficial Gerado:</span>
                            <span className="font-mono text-xs text-white truncate block">{generatedInfiniteLink}</span>
                          </div>
                          <a
                            href={generatedInfiniteLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 px-3 py-1 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs rounded-lg flex items-center gap-1"
                          >
                            Abrir Checkout <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}

                      {infinitePaySimulationResult?.success && (
                        <div className="text-emerald-400 font-semibold flex items-center gap-1 text-[11px] mt-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Webhook oficial processado! Conta marcada como Recebida e Conciliada.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Configuration Form */}
          <form onSubmit={handleSave} className="space-y-4 pt-2 border-t border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm">
                  2. Credenciais de Acesso ({currentMeta.name})
                </h3>
                <a
                  href={currentMeta.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 underline underline-offset-2"
                >
                  Documentação Oficial <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Ambiente Switch */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Ambiente:</span>
                <div className="inline-flex rounded-lg p-0.5 bg-slate-950 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setAmbiente('sandbox')}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                      ambiente === 'sandbox'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sandbox / Testes
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmbiente('producao')}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                      ambiente === 'producao'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Produção Real
                  </button>
                </div>
              </div>
            </div>

            {/* Client ID / Public Key */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {currentMeta.clientIdLabel} <span className="text-rose-400">*</span>
              </label>
              <input
                id="input-banking-client-id"
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder={currentMeta.clientIdPlaceholder}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-hidden focus:border-blue-500 font-mono"
              />
            </div>

            {/* Client Secret / Private Key (Masked with Eye Toggle) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  {currentMeta.clientSecretLabel}
                </label>
                <span className="text-[11px] text-slate-500">
                  Armazenado no cofre com chave AES-256
                </span>
              </div>
              <div className="relative">
                <input
                  id="input-banking-client-secret"
                  type={showClientSecret ? 'text' : 'password'}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="••••••••••••••••••••••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-hidden focus:border-blue-500 font-mono tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => setShowClientSecret(!showClientSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                  title={showClientSecret ? 'Ocultar segredo' : 'Exibir segredo'}
                >
                  {showClientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Webhook Secret (HMAC-SHA256) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  {currentMeta.webhookSecretLabel}
                </label>
                <span className="text-[11px] text-emerald-400/80 font-mono">
                  Validação Antifraude HMAC
                </span>
              </div>
              <div className="relative">
                <input
                  id="input-banking-webhook-secret"
                  type={showWebhookSecret ? 'text' : 'password'}
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="ex: whsec_9876543210abcdef..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-hidden focus:border-blue-500 font-mono tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                  title={showWebhookSecret ? 'Ocultar segredo' : 'Exibir segredo'}
                >
                  {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {currentMeta.webhookSecretHelp}
              </p>
            </div>

            {/* Banco do Brasil specific: Chave Pix and Certificado */}
            {selectedProvider === 'bb' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Chave Pix Vinculada (BB):
                  </label>
                  <input
                    id="input-banking-chave-pix"
                    type="text"
                    value={chavePix}
                    onChange={(e) => setChavePix(e.target.value)}
                    placeholder="ex: financeiro@empresa.com.br ou CNPJ"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Caminho do Certificado Digital (.pfx / .pem):
                  </label>
                  <input
                    id="input-banking-cert-path"
                    type="text"
                    value={certificadoPath}
                    onChange={(e) => setCertificadoPath(e.target.value)}
                    placeholder="ex: /certs/bb_pix_prod.pfx"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-hidden focus:border-blue-500 font-mono"
                  />
                </div>
              </div>
            )}

            {/* Webhook Endpoint Display & 1-Click Copy */}
            <div className="p-4 rounded-xl bg-indigo-950/25 border border-indigo-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-indigo-300 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-400" />
                  URL do Webhook para cadastrar no portal do banco:
                </label>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                  POST HTTP/HTTPS
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="w-full bg-slate-950 border border-indigo-500/30 rounded-lg px-3 py-2 text-xs text-indigo-200 font-mono selection:bg-indigo-500 selection:text-white"
                />
                <button
                  type="button"
                  id="btn-copy-webhook-url"
                  onClick={handleCopyUrl}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Cadastre este endpoint no portal do <strong className="text-white">{currentMeta.shortName}</strong> para receber notificações automáticas de pagamento em tempo real.
              </p>

              {/* Stone 1-Click Webhook Registration */}
              {selectedProvider === 'stone' && (
                <div className="pt-2 border-t border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-[11px] text-indigo-300">
                    💡 Tem a chave <code className="text-emerald-400 font-mono">sk_...</code> preenchida no campo <strong>Secret Key</strong>?
                  </div>
                  <button
                    type="button"
                    id="btn-auto-register-stone-webhook"
                    onClick={handleAutoRegisterStoneWebhook}
                    disabled={isRegisteringStoneHook || !clientSecret}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0"
                  >
                    {isRegisteringStoneHook ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Cadastrando na Stone...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        <span>Cadastrar Webhook na Stone Automaticamente</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {stoneHookRegisterResult && (
                <div className={`p-2.5 rounded-lg text-[11px] flex items-center gap-2 ${
                  stoneHookRegisterResult.success
                    ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border border-rose-500/40 text-rose-300'
                }`}>
                  {stoneHookRegisterResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{stoneHookRegisterResult.message}</span>
                </div>
              )}
            </div>

            {/* Diagnostics & Connectivity Result */}
            {diagnosticsResult && (
              <div className={`p-4 rounded-xl border text-xs space-y-2 ${
                diagnosticsResult.success ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200' : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    {diagnosticsResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                    Diagnóstico de Conectividade ({currentMeta.shortName})
                  </span>
                  <span className="font-mono text-[10px] bg-slate-900/80 px-2 py-0.5 rounded-full border border-slate-700">
                    Latência: {diagnosticsResult.latencyMs}ms
                  </span>
                </div>
                <p>{diagnosticsResult.message}</p>
                {diagnosticsResult.diagnostics && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-[11px] font-mono">
                    <div>Client ID: <span className={diagnosticsResult.diagnostics.clientIdValid ? 'text-emerald-400' : 'text-rose-400'}>{diagnosticsResult.diagnostics.clientIdValid ? 'OK' : 'Pendente'}</span></div>
                    <div>Secret: <span className={diagnosticsResult.diagnostics.hasSecret ? 'text-emerald-400' : 'text-slate-500'}>{diagnosticsResult.diagnostics.hasSecret ? 'Configurado' : 'Vazio'}</span></div>
                    <div>Assinatura HMAC: <span className={diagnosticsResult.diagnostics.signatureVerificationActive ? 'text-emerald-400 font-bold' : 'text-amber-400'}>{diagnosticsResult.diagnostics.signatureVerificationActive ? 'Protegido' : 'Sem Secret'}</span></div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-test-banking-connection"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border border-slate-700 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
                  <span>{isTesting ? 'Testando Conexão...' : 'Testar Conexão / Chaves'}</span>
                </button>

                {onOpenAuditLogs && (
                  <button
                    type="button"
                    onClick={onOpenAuditLogs}
                    className="px-3 py-2.5 text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                    <span>Ver Logs de Segurança</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-save-banking-credential"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Criptografando & Salvando...' : 'Salvar Credenciais Criptografadas'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* Active Integrations Summary Table */}
          <div className="pt-4 border-t border-slate-800">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Integrações Salvas para {targetCompany.nome}</span>
              <span className="text-[10px] text-slate-400 font-normal">
                {credentialsList.length} registro(s)
              </span>
            </h4>

            {credentialsList.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 text-slate-400 text-xs">
                Nenhuma credencial bancária cadastrada para esta empresa. Preencha o formulário acima para ativar.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-3.5 py-2.5">Provedor</th>
                      <th className="px-3.5 py-2.5">Client ID / Chave</th>
                      <th className="px-3.5 py-2.5">Ambiente</th>
                      <th className="px-3.5 py-2.5">Segurança Secret</th>
                      <th className="px-3.5 py-2.5">Status</th>
                      <th className="px-3.5 py-2.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {credentialsList.map((cred) => {
                      const p = PROVIDERS[cred.provider] || { shortName: cred.provider.toUpperCase() };
                      return (
                        <tr key={cred.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-3.5 py-2.5 font-sans font-bold text-white">
                            {p.shortName}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-300">
                            {cred.masked_client_id || (cred.client_id ? `${cred.client_id.substring(0, 6)}...` : '—')}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-bold ${
                              cred.ambiente === 'producao' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}>
                              {cred.ambiente === 'producao' ? 'Produção' : 'Sandbox'}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-sans text-[11px]">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              AES-256
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-bold ${
                              cred.status === 'ativo' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                            }`}>
                              {cred.status}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-sans">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleProviderSelect(cred.provider)}
                                className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 cursor-pointer"
                                title="Editar credencial"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(cred.id, p.shortName)}
                                className="p-1.5 text-rose-400 hover:text-rose-300 rounded-md hover:bg-rose-950/50 cursor-pointer"
                                title="Remover credencial"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
