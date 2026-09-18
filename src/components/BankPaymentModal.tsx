import React, { useState, useEffect } from 'react';
import {
  X,
  Landmark,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Send,
  Loader2,
  ShieldCheck,
  FileText,
  DollarSign,
  Building2,
  QrCode,
  Barcode,
  ArrowDownRight,
  ExternalLink,
  Camera,
  Sparkles,
} from 'lucide-react';
import { FinancialAccount, Company, User } from '../types';
import { CameraScannerModal } from './CameraScannerModal';

interface BankPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: FinancialAccount | null;
  company?: Company;
  currentUser?: User;
  onPaymentSuccess: (result: {
    accountId: number;
    updatedAccount: FinancialAccount;
    saldoRecalculado?: any;
    comprovanteId: string;
    providerName: string;
  }) => void;
}

export const BankPaymentModal: React.FC<BankPaymentModalProps> = ({
  isOpen,
  onClose,
  account,
  company,
  currentUser,
  onPaymentSuccess,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<'bb' | 'stone'>('bb');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'boleto'>('pix');
  const [chavePix, setChavePix] = useState('');
  const [chavePixTipo, setChavePixTipo] = useState<'cnpj' | 'cpf' | 'email' | 'telefone' | 'aleatoria'>('cnpj');
  const [codigoBarras, setCodigoBarras] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successReceipt, setSuccessReceipt] = useState<any | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Camera Scanner Modal State
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [cameraScannerMode, setCameraScannerMode] = useState<'pix' | 'boleto'>('pix');
  const [cameraFeedbackMsg, setCameraFeedbackMsg] = useState<string | null>(null);

  // Initialize form when account changes
  useEffect(() => {
    if (account) {
      setError('');
      setSuccessReceipt(null);
      
      const hasBarcode = Boolean(account.codigo_barras?.trim());
      const hasPix = Boolean(account.chave_pix?.trim());

      if (hasBarcode && !hasPix) {
        setPaymentMethod('boleto');
        setCodigoBarras(account.codigo_barras || '');
        setChavePix('');
      } else {
        setPaymentMethod('pix');
        setChavePix(account.chave_pix || '');
        setCodigoBarras(account.codigo_barras || '');
      }

      // Default to BB or Stone based on account preferences or default
      if (account.banco_origem?.toLowerCase().includes('stone')) {
        setSelectedProvider('stone');
      } else {
        setSelectedProvider('bb');
      }
    }
  }, [account, isOpen]);

  if (!isOpen || !account) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleExecutePayment = async () => {
    setError('');

    // Validations
    if (paymentMethod === 'pix' && !chavePix.trim()) {
      setError('Por favor, informe a Chave Pix de destino para envio da transferência.');
      return;
    }

    if (paymentMethod === 'boleto' && !codigoBarras.trim()) {
      setError('Por favor, informe o Código de Barras / Linha Digitável do boleto.');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/banking/execute-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: account.id,
          empresa_id: account.empresa_id,
          tenant_id: account.tenant_id || currentUser?.tenant_id || 1,
          provider: selectedProvider,
          chave_pix: paymentMethod === 'pix' ? chavePix.trim() : undefined,
          codigo_barras: paymentMethod === 'boleto' ? codigoBarras.trim() : undefined,
          valor: account.valor,
          descricao: account.descricao,
          categoria: account.categoria,
          usuario_id: currentUser?.id || 1,
          usuario_nome: currentUser?.nome || 'Operador Financeiro',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Falha ao processar comando de pagamento na API bancária.');
      }

      // Success
      setSuccessReceipt(data);

      onPaymentSuccess({
        accountId: account.id,
        updatedAccount: data.conta_atualizada,
        saldoRecalculado: data.saldo_recalculado,
        comprovanteId: data.comprovante_id,
        providerName: data.provider,
      });
    } catch (err: any) {
      console.error('Erro na execução do pagamento via banco:', err);
      setError(err?.message || 'Erro de comunicação com a API do banco.');
    } finally {
      setLoading(false);
    }
  };

  const handleCameraScanSuccess = (data: {
    type: 'pix' | 'boleto';
    chavePix?: string;
    chavePixTipo?: 'cnpj' | 'cpf' | 'email' | 'telefone' | 'aleatoria';
    codigoBarras?: string;
    valorDetectado?: number;
    beneficiarioDetectado?: string;
    rawText: string;
  }) => {
    if (data.type === 'pix' && data.chavePix) {
      setPaymentMethod('pix');
      setChavePix(data.chavePix);
      if (data.chavePixTipo) {
        setChavePixTipo(data.chavePixTipo);
      }
      setCameraFeedbackMsg(
        `QR Code Pix lido com sucesso! ${data.beneficiarioDetectado ? `Beneficiário: ${data.beneficiarioDetectado}` : ''}`
      );
    } else if (data.type === 'boleto' && data.codigoBarras) {
      setPaymentMethod('boleto');
      setCodigoBarras(data.codigoBarras);
      setCameraFeedbackMsg(
        `Código de Barras do boleto lido com sucesso! ${data.beneficiarioDetectado ? `(${data.beneficiarioDetectado})` : ''}`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-md">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                Pagar via Banco (API Direta)
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Saída Pix
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Liquidação direta de conta a pagar via API Banco do Brasil ou Stone
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {successReceipt ? (
            /* --- SUCESSO E COMPROVANTE BANCÁRIO --- */
            <div className="space-y-4 animate-in zoom-in-95 duration-200">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-emerald-900 dark:text-emerald-200 text-base">
                  Pagamento Liquidado com Sucesso!
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  O valor de <strong>{formatCurrency(successReceipt.valor_pago)}</strong> foi transferido via{' '}
                  <strong>{successReceipt.provider}</strong> e deduzido do saldo da empresa.
                </p>
              </div>

              {/* Recibo Oficial Digital */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    Comprovante de Transferência Bancária
                  </span>
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    STATUS: LIQUIDADO
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Beneficiário / Conta:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{successReceipt.beneficiario}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Valor Transferido:</span>
                    <strong className="text-rose-600 dark:text-rose-400 font-mono text-sm">
                      {formatCurrency(successReceipt.valor_pago)}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Banco Processador:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-medium">{successReceipt.provider}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Data / Hora Liquidação:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                      {new Date(successReceipt.data_pagamento).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[11px]">Destino (Pix / Linha Digitável):</span>
                    <span className="text-slate-800 dark:text-slate-200 font-mono text-[11px] break-all">
                      {successReceipt.chave_destino}
                    </span>
                  </div>

                  <div className="col-span-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 block text-[11px]">ID de Autenticação / Comprovante:</span>
                    <div className="flex items-center justify-between gap-2 mt-0.5 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 break-all">
                        {successReceipt.comprovante_id}
                      </span>
                      <button
                        onClick={() => handleCopy(successReceipt.comprovante_id, 'comprovante')}
                        className="p-1 text-slate-400 hover:text-indigo-500 shrink-0"
                        title="Copiar código do comprovante"
                      >
                        {copiedKey === 'comprovante' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {successReceipt.end_to_end_id && (
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[11px]">EndToEndId (Banco Central / Bacen):</span>
                      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 break-all">
                        {successReceipt.end_to_end_id}
                      </span>
                    </div>
                  )}

                  {successReceipt.saldo_recalculado && (
                    <div className="col-span-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-lg">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Novo Saldo da Empresa:
                      </span>
                      <strong className="text-sm font-mono text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(successReceipt.saldo_recalculado.saldo_atual)}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* --- FORMULÁRIO DE ENVIO DE PAGAMENTO --- */
            <>
              {/* Card Resumo do Lançamento a Pagar */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                    Lançamento a Liquidar
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                    Conta #{account.id}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                      {account.descricao}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Vencimento: {account.data_vencimento} • Categoria: {account.categoria || 'Geral'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Valor a Pagar</span>
                    <strong className="text-lg font-mono font-bold text-rose-600 dark:text-rose-400">
                      {formatCurrency(account.valor)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Feedback de Leitura via Câmera */}
              {cameraFeedbackMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{cameraFeedbackMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCameraFeedbackMsg(null)}
                    className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold cursor-pointer"
                  >
                    OK
                  </button>
                </div>
              )}

              {/* Escolha do Banco de Origem (BB ou Stone) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  1. Selecione o Banco Integrado para Pagamento:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedProvider('bb')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                      selectedProvider === 'bb'
                        ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                        Banco do Brasil
                      </span>
                      {selectedProvider === 'bb' && <CheckCircle2 className="w-4 h-4 text-amber-500" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      API Pix Corporativo (OAuth 2.0 / mTLS)
                    </p>
                    <span className="inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      BB Pix Outbound
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedProvider('stone')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                      selectedProvider === 'stone'
                        ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        Stone Pagamentos
                      </span>
                      {selectedProvider === 'stone' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Stone Banking API (Transferência Pix)
                    </p>
                    <span className="inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Stone Banking API
                    </span>
                  </button>
                </div>
              </div>

              {/* Escolha do Método de Pagamento (Pix ou Boleto) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    2. Método de Transferência / Liquidação:
                  </label>
                  <button
                    type="button"
                    id="btn-scan-camera-top"
                    onClick={() => {
                      setCameraScannerMode(paymentMethod);
                      setIsCameraScannerOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800/80 cursor-pointer shadow-2xs transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Escanear com Câmera</span>
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('pix')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      paymentMethod === 'pix'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-500'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    Chave Pix (Instantâneo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('boleto')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      paymentMethod === 'boleto'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-500'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Barcode className="w-4 h-4" />
                    Boleto Bancário (CIP)
                  </button>
                </div>
              </div>

              {/* Campos do Método */}
              {paymentMethod === 'pix' ? (
                <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Chave Pix de Destino *
                    </label>
                    <div className="flex gap-1 text-[10px]">
                      {(['cnpj', 'cpf', 'email', 'telefone', 'aleatoria'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setChavePixTipo(t)}
                          className={`px-1.5 py-0.5 rounded uppercase font-semibold cursor-pointer ${
                            chavePixTipo === t
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      placeholder={
                        chavePixTipo === 'cnpj'
                          ? '00.000.000/0001-91'
                          : chavePixTipo === 'cpf'
                          ? '123.456.789-00'
                          : chavePixTipo === 'email'
                          ? 'financeiro@fornecedor.com.br'
                          : chavePixTipo === 'telefone'
                          ? '+55 11 99999-9999'
                          : 'Chave EVP aleatória...'
                      }
                      value={chavePix}
                      onChange={(e) => setChavePix(e.target.value)}
                      className="w-full pl-3 pr-24 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      id="btn-scan-pix-camera"
                      onClick={() => {
                        setCameraScannerMode('pix');
                        setIsCameraScannerOpen(true);
                      }}
                      className="absolute right-1.5 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                      title="Escanear QR Code Pix via Câmera"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Câmera</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>O Pix será creditado imediatamente na conta do fornecedor.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCameraScannerMode('pix');
                        setIsCameraScannerOpen(true);
                      }}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <QrCode className="w-3 h-3" />
                      Ler QR Code
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Código de Barras ou Linha Digitável *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setCameraScannerMode('boleto');
                        setIsCameraScannerOpen(true);
                      }}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Camera className="w-3 h-3" />
                      Ler Código na Câmera
                    </button>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      placeholder="34191.79001 01043.510047 91020.150008 8 98760000015000"
                      value={codigoBarras}
                      onChange={(e) => setCodigoBarras(e.target.value)}
                      className="w-full pl-3 pr-24 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      id="btn-scan-boleto-camera"
                      onClick={() => {
                        setCameraScannerMode('boleto');
                        setIsCameraScannerOpen(true);
                      }}
                      className="absolute right-1.5 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                      title="Escanear Código de Barras do Boleto via Câmera"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Câmera</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    A liquidação do título será enviada diretamente para a câmara de compensação bancária.
                  </p>
                </div>
              )}

              {/* Informações da Empresa e Saldo Atual */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300">
                    Empresa Debitada: <strong>{company?.nome || `ID #${account.empresa_id}`}</strong>
                  </span>
                </div>
                {company?.saldo_atual !== undefined && (
                  <span className="font-mono text-slate-600 dark:text-slate-300 text-[11px]">
                    Saldo Disp: <strong>{formatCurrency(company.saldo_atual)}</strong>
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {successReceipt ? 'Fechar' : 'Cancelar'}
          </button>

          {successReceipt ? (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Concluído
            </button>
          ) : (
            <button
              type="button"
              id="btn-confirm-execute-payment"
              disabled={loading}
              onClick={handleExecutePayment}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enviando para API Bancária...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Pagar via {selectedProvider === 'stone' ? 'Stone' : 'Banco do Brasil'}</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>

      {/* Camera Scanner Sub-Modal */}
      <CameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        mode={cameraScannerMode}
        onScanSuccess={handleCameraScanSuccess}
      />
    </div>
  );
};
