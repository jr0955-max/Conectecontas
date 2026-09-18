import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Save,
  Trash2,
  Zap,
  Info,
  Server
} from 'lucide-react';
import { User } from '../types';

interface MercadoPagoCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onSaved?: () => void;
}

export const MercadoPagoCredentialsModal: React.FC<MercadoPagoCredentialsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSaved,
}) => {
  const [accessToken, setAccessToken] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [environment, setEnvironment] = useState<'producao' | 'sandbox'>('producao');
  
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/billing/webhook/mercadopago` 
    : 'https://financeiro.conectecontas.com/api/billing/webhook/mercadopago';

  const loadSavedCredentials = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/billing/mercadopago-config');
      const data = await res.json();
      if (data.success && data.config) {
        setPublicKey(data.config.public_key || '');
        setAccessToken(data.config.has_access_token ? (data.config.access_token || '••••••••••••') : '');
        setWebhookSecret(data.config.has_webhook_secret ? (data.config.webhook_secret || '••••••••••••') : '');
        setEnvironment(data.config.ambiente || 'producao');
      }
    } catch (err) {
      console.error('Erro ao carregar configurações do Mercado Pago:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSavedCredentials();
      setNotification(null);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setNotification(null);

    try {
      const payload = {
        access_token: accessToken.trim(),
        public_key: publicKey.trim(),
        webhook_secret: webhookSecret.trim(),
        ambiente: environment,
        usuario_id: currentUser?.id,
        usuario_nome: currentUser?.nome || 'Super Admin Master',
      };

      const res = await fetch('/api/billing/mercadopago-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setNotification({
          type: 'success',
          message: 'Chaves e Token do Mercado Pago salvos e criptografados no cofre AES-256 com sucesso!',
        });
        if (onSaved) onSaved();
      } else {
        setNotification({
          type: 'error',
          message: data.error || 'Erro ao salvar credenciais do Mercado Pago.',
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'Falha ao se comunicar com o servidor.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestToken = async () => {
    setIsTesting(true);
    setTestResult(null);
    setNotification(null);

    try {
      const res = await fetch('/api/billing/mercadopago-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken.trim(),
        }),
      });

      const data = await res.json();
      setTestResult(data);

      if (data.success) {
        setNotification({
          type: 'success',
          message: `Conexão bem-sucedida com o Mercado Pago! Conta identificada: ${data.collector_name || data.collector_email || 'Conta Comercial Ativa'}.`,
        });
      } else {
        setNotification({
          type: 'error',
          message: data.message || 'O Access Token fornecido é inválido ou não possui permissões.',
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'Erro ao verificar Access Token.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  Editar Chaves & Access Token (Mercado Pago SaaS)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                  AES-256 Vault
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Credenciais oficiais da sua conta de recebimento para cobranças recorrentes (R$ 99/mês).
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Notification feedback */}
          {notification && (
            <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
              notification.type === 'success' ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' :
              notification.type === 'error' ? 'bg-rose-950/40 border-rose-500/40 text-rose-300' :
              'bg-sky-950/40 border-sky-500/40 text-sky-300'
            }`}>
              <div className="flex items-center gap-2">
                {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
                <span>{notification.message}</span>
              </div>
            </div>
          )}

          {/* Test Diagnostic Result Details */}
          {testResult && testResult.success && (
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 text-xs text-slate-300 space-y-1.5 font-mono">
              <div className="flex items-center justify-between text-emerald-400 font-bold">
                <span>✓ STATUS DA CONEXÃO: ONLINE</span>
                <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full">Mercado Pago REST API v1</span>
              </div>
              {testResult.user_id && <div>ID Usuário MP: <strong className="text-white">{testResult.user_id}</strong></div>}
              {testResult.nickname && <div>Nome / Titular: <strong className="text-white">{testResult.nickname}</strong></div>}
              {testResult.site_id && <div>País / Site: <strong className="text-white">{testResult.site_id} (Brasil)</strong></div>}
            </div>
          )}

          {/* Security & Info Box */}
          <div className="p-4 rounded-2xl bg-sky-950/30 border border-sky-500/20 flex items-start gap-3 text-xs text-sky-200">
            <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Onde encontrar suas credenciais do Mercado Pago?</span>
              <p className="text-sky-300/80 leading-relaxed">
                Acesse o portal do Mercado Pago Developers em{' '}
                <a 
                  href="https://www.mercadopago.com.br/developers/panel/app" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sky-300 underline font-bold inline-flex items-center gap-1 hover:text-white"
                >
                  developers.mercadopago.com.br <ExternalLink className="w-3 h-3" />
                </a>{' '}
                &rarr; <strong>Suas Aplicações</strong> &rarr; <strong>Credenciais de Produção</strong>. Copie o <strong>Access Token</strong> e a <strong>Public Key</strong>.
              </p>
            </div>
          </div>

          <form id="form-mp-credentials" onSubmit={handleSave} className="space-y-4">
            
            {/* Environment Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div>
                <label className="text-xs font-bold text-white block">Ambiente das Credenciais</label>
                <span className="text-[11px] text-slate-400">Selecione se está utilizando chaves de produção ou teste (sandbox)</span>
              </div>

              <div className="inline-flex rounded-xl p-1 bg-slate-900 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setEnvironment('producao')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                    environment === 'producao'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Produção Real
                </button>
                <button
                  type="button"
                  onClick={() => setEnvironment('sandbox')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                    environment === 'sandbox'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sandbox / Testes
                </button>
              </div>
            </div>

            {/* Access Token */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-sky-400" />
                  Access Token (Bearer Token) <span className="text-rose-400">*</span>
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  ex: APP_USR-8234... ou PROD_...
                </span>
              </div>

              <div className="relative">
                <input
                  id="input-mp-access-token"
                  type={showAccessToken ? 'text' : 'password'}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="APP_USR-0000000000000000-000000-00000000000000000000000000000000-000000000"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowAccessToken(!showAccessToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                  title={showAccessToken ? 'Ocultar' : 'Visualizar'}
                >
                  {showAccessToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Public Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200">
                  Public Key (Chave Pública)
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  ex: APP_USR-8df...
                </span>
              </div>

              <input
                id="input-mp-public-key"
                type="text"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            {/* Webhook Secret / Signature Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Webhook Secret (Chave Secreta de Notificação)
                </label>
                <span className="text-[10px] text-slate-500">Opcional para assinatura HMAC</span>
              </div>

              <div className="relative">
                <input
                  id="input-mp-webhook-secret"
                  type={showWebhookSecret ? 'text' : 'password'}
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="Chave secreta configurada no painel de Webhooks do MP"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                  title={showWebhookSecret ? 'Ocultar' : 'Visualizar'}
                >
                  {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Webhook URL Endpoint for MP panel */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300">URL de Notificação Webhook (Cole no Painel do Mercado Pago):</span>
                <button
                  type="button"
                  onClick={() => handleCopy(webhookUrl, 'webhook')}
                  className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer font-bold"
                >
                  {copiedField === 'webhook' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'webhook' ? 'Copiado!' : 'Copiar URL'}</span>
                </button>
              </div>
              <div className="font-mono text-xs text-sky-300 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 truncate">
                {webhookUrl}
              </div>
              <p className="text-[10px] text-slate-500">
                Eventos sugeridos para marcar no Mercado Pago: <strong>Pagamentos (payments)</strong> e <strong>Assinaturas / Pré-aprovações (subscription_preapproval)</strong>.
              </p>
            </div>

          </form>

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestToken}
            disabled={isTesting || !accessToken}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isTesting ? <RefreshCw className="w-4 h-4 animate-spin text-sky-400" /> : <Zap className="w-4 h-4 text-amber-400" />}
            <span>{isTesting ? 'Testando Conexão...' : 'Testar Token & Conexão'}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              form="form-mp-credentials"
              disabled={isSaving}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-sky-900/30 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'Salvando no Cofre...' : 'Salvar Chave & Token'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
