import React, { useState, useEffect } from 'react';
import { 
  X, 
  Bell, 
  Clock, 
  Volume2, 
  Sliders, 
  Check, 
  AlertTriangle, 
  Calendar,
  Sparkles,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { ReminderSettings, DEFAULT_REMINDER_SETTINGS } from '../types';
import { 
  playReminderChime, 
  requestBrowserNotificationPermission, 
  sendBrowserNotification 
} from '../utils/reminderService';

interface ReminderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReminderSettings;
  onSaveSettings: (settings: ReminderSettings) => void;
  totalAccountsOnRadar?: number;
  totalValueOnRadar?: number;
}

export const ReminderSettingsModal: React.FC<ReminderSettingsModalProps> = ({
  isOpen,
  onClose,
  settings: initialSettings,
  onSaveSettings,
  totalAccountsOnRadar = 0,
  totalValueOnRadar = 0,
}) => {
  const [formData, setFormData] = useState<ReminderSettings>(initialSettings);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'denied';
  });
  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(initialSettings);
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setBrowserPermission(Notification.permission);
      }
      setTestFeedback(null);
    }
  }, [isOpen, initialSettings]);

  if (!isOpen) return null;

  const quickDaysOptions = [1, 2, 3, 5, 7, 10, 15, 30];

  const handleRequestNotification = async () => {
    const perm = await requestBrowserNotificationPermission();
    setBrowserPermission(perm);
    if (perm === 'granted') {
      setFormData((prev) => ({ ...prev, notificacao_navegador: true }));
      sendBrowserNotification(
        'Lembretes Conectecontas Ativados! 🔔',
        'Você receberá notificações na área de trabalho quando houver contas a pagar próximas do vencimento.'
      );
    } else {
      setFormData((prev) => ({ ...prev, notificacao_navegador: false }));
    }
  };

  const handleTestAlert = () => {
    if (formData.som_alerta) {
      playReminderChime();
    }
    if (formData.notificacao_navegador && browserPermission === 'granted') {
      sendBrowserNotification(
        'Teste de Lembrete Financeiro',
        `Alerta simulado com sucesso! Avisando com ${formData.dias_antecedencia} dias de antecedência.`
      );
    }
    setTestFeedback('Som e notificação de teste disparados com sucesso!');
    setTimeout(() => setTestFeedback(null), 4000);
  };

  const handleSave = () => {
    onSaveSettings(formData);
    onClose();
  };

  const handleResetDefaults = () => {
    setFormData(DEFAULT_REMINDER_SETTINGS);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800/80 flex items-center justify-between bg-gray-50/70 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>Configurar Lembretes de Vencimento</span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Defina o prazo de antecedência para ser avisado sobre contas a pagar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">

          {/* Ativar/Desativar Sistema Geral */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60">
            <div className="space-y-0.5 pr-4">
              <span className="text-sm font-bold text-gray-900 dark:text-amber-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Ativar Alertas de Contas a Pagar</span>
              </span>
              <p className="text-xs text-gray-600 dark:text-amber-400/80">
                Exibe avisos no sino superior, banner do painel e notifica vencimentos.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-600"></div>
            </label>
          </div>

          {/* 1. SEÇÃO PRINCIPAL: PRAZO DE ANTECEDÊNCIA */}
          <div className={`space-y-3 transition-opacity ${formData.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-900 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span>Prazo de Antecedência (Dias)</span>
              </label>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 px-2.5 py-0.5 rounded-full">
                {formData.dias_antecedencia === 1 ? '1 dia antes' : `${formData.dias_antecedencia} dias antes`}
              </span>
            </div>
            
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Com quantos dias de antecedência você deseja que o sistema comece a sinalizar as contas que irão vencer:
            </p>

            {/* Quick buttons */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {quickDaysOptions.map((days) => {
                const isSelected = formData.dias_antecedencia === days;
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, dias_antecedencia: days }))}
                    className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all text-center cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/30 ring-2 ring-blue-500/20'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-750'
                    }`}
                  >
                    {days} {days === 1 ? 'dia' : 'dias'}
                  </button>
                );
              })}
            </div>

            {/* Range slider + Custom input */}
            <div className="pt-2 flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="30"
                value={formData.dias_antecedencia}
                onChange={(e) => setFormData((prev) => ({ ...prev, dias_antecedencia: Number(e.target.value) }))}
                className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={formData.dias_antecedencia}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(60, Number(e.target.value) || 1));
                    setFormData((prev) => ({ ...prev, dias_antecedencia: val }));
                  }}
                  className="w-16 px-2.5 py-1 text-center font-bold text-sm bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">dias</span>
              </div>
            </div>
          </div>

          {/* 2. SEÇÃO: CRITÉRIOS DE ALERTA */}
          <div className={`space-y-3 pt-4 border-t border-gray-100 dark:border-slate-800/80 ${formData.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <label className="text-xs font-bold text-gray-900 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-500" />
              <span>Critérios de Notificação</span>
            </label>

            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-750 cursor-pointer hover:bg-gray-100/70 dark:hover:bg-slate-800 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.avisar_com_antecedencia}
                  onChange={(e) => setFormData((prev) => ({ ...prev, avisar_com_antecedencia: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-xs font-bold text-gray-900 dark:text-slate-200 block">
                    Avisar com antecedência ({formData.dias_antecedencia} dias antes)
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-slate-400 block">
                    Alerta você quando o vencimento estiver dentro da janela de dias configurada.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-750 cursor-pointer hover:bg-gray-100/70 dark:hover:bg-slate-800 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.avisar_vencendo_hoje}
                  onChange={(e) => setFormData((prev) => ({ ...prev, avisar_vencendo_hoje: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded-sm border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="text-xs font-bold text-gray-900 dark:text-slate-200 block">
                    Avisar contas que vencem hoje
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-slate-400 block">
                    Destaque prioritário no dia do vencimento para evitar multas e juros.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-750 cursor-pointer hover:bg-gray-100/70 dark:hover:bg-slate-800 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.avisar_em_atraso}
                  onChange={(e) => setFormData((prev) => ({ ...prev, avisar_em_atraso: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded-sm border-gray-300 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="text-xs font-bold text-gray-900 dark:text-slate-200 block">
                    Avisar contas em atraso / vencidas
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-slate-400 block">
                    Mantém na lista as contas com data ultrapassada que continuam pendentes.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* 3. SEÇÃO: CANAIS E SONS */}
          <div className={`space-y-3 pt-4 border-t border-gray-100 dark:border-slate-800/80 ${formData.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <label className="text-xs font-bold text-gray-900 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Canais e Efeitos</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Alerta Sonoro */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-750 cursor-pointer">
                <div className="pr-2">
                  <span className="text-xs font-bold text-gray-900 dark:text-slate-200 block">
                    Alerta Sonoro Suave
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-slate-400 block">
                    Chime ao carregar pendências
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.som_alerta}
                  onChange={(e) => setFormData((prev) => ({ ...prev, som_alerta: e.target.checked }))}
                  className="h-4 w-4 rounded-sm border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
              </label>

              {/* Banner no Topo */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-750 cursor-pointer">
                <div className="pr-2">
                  <span className="text-xs font-bold text-gray-900 dark:text-slate-200 block">
                    Banner Rápido no Painel
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-slate-400 block">
                    Faixa de aviso dispensável
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.banner_visivel}
                  onChange={(e) => setFormData((prev) => ({ ...prev, banner_visivel: e.target.checked }))}
                  className="h-4 w-4 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
            </div>

            {/* Desktop / Browser Notification Permission */}
            <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-900 dark:text-slate-200">
                    Notificações do Navegador / Desktop
                  </span>
                  {browserPermission === 'granted' ? (
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 rounded-full font-bold">
                      Ativo ✅
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 rounded-full font-semibold">
                      Não ativado
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                  Receba avisos mesmo com a aba em segundo plano ou minimizada.
                </p>
              </div>

              {browserPermission !== 'granted' ? (
                <button
                  type="button"
                  onClick={handleRequestNotification}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shrink-0 transition-colors shadow-xs"
                >
                  Permitir
                </button>
              ) : (
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={formData.notificacao_navegador}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notificacao_navegador: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                </label>
              )}
            </div>

            {/* Test button */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleTestAlert}
                className="text-xs font-bold text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5 text-blue-500" />
                <span>Testar Som & Notificação</span>
              </button>

              {testFeedback && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                  {testFeedback}
                </span>
              )}
            </div>
          </div>

          {/* CAIXA DE IMPACTO EM TEMPO REAL */}
          <div className="p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="text-xs text-blue-900 dark:text-blue-200 min-w-0">
              <p className="font-semibold leading-relaxed">
                Com o prazo de <strong>{formData.dias_antecedencia} {formData.dias_antecedencia === 1 ? 'dia' : 'dias'}</strong>, você possui atualmente{' '}
                <strong className="text-blue-700 dark:text-blue-300">{totalAccountsOnRadar} conta(s) a pagar</strong> no radar de lembretes, somando{' '}
                <strong className="text-blue-700 dark:text-blue-300">
                  {totalValueOnRadar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>.
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800/80 bg-gray-50/70 dark:bg-slate-850 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1.5 cursor-pointer"
            title="Restaurar valores padrões (3 dias de antecedência)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Padrão</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Configurações</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
