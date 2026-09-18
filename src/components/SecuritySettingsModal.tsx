import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Clock, 
  Smartphone, 
  Lock, 
  Check, 
  X, 
  AlertTriangle,
  KeyRound,
  Laptop
} from 'lucide-react';

interface SecuritySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  timeoutMinutes: number;
  onUpdateTimeout: (minutes: number) => void;
  requireLoginOnReopen: boolean;
  onUpdateRequireLoginOnReopen: (require: boolean) => void;
  onLockNow: () => void;
}

export const SecuritySettingsModal: React.FC<SecuritySettingsModalProps> = ({
  isOpen,
  onClose,
  timeoutMinutes,
  onUpdateTimeout,
  requireLoginOnReopen,
  onUpdateRequireLoginOnReopen,
  onLockNow,
}) => {
  const [tempTimeout, setTempTimeout] = useState(timeoutMinutes);
  const [tempRequireLogin, setTempRequireLogin] = useState(requireLoginOnReopen);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateTimeout(tempTimeout);
    onUpdateRequireLoginOnReopen(tempRequireLogin);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  const timeoutOptions = [
    { value: 5, label: '5 minutos', desc: 'Máxima segurança para celulares e computadores compartilhados' },
    { value: 15, label: '15 minutos', desc: 'Recomendado (Padrão de aplicativos bancários e financeiros)' },
    { value: 30, label: '30 minutos', desc: 'Equilíbrio entre segurança e conveniência para uso no escritório' },
    { value: 60, label: '1 hora', desc: 'Maior tempo para conferência contínua de relatórios longos' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="modal-security-settings"
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800/60">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Segurança & Bloqueio por Inatividade
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Proteja seus dados financeiros contra acessos indevidos
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Info Card */}
          <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/50 flex items-start gap-3 text-xs text-sky-800 dark:text-sky-300">
            <Smartphone className="w-4 h-4 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
            <div className="space-y-1">
              <p className="font-semibold">Proteção para Celular e Histórico de Navegação</p>
              <p className="text-[11px] leading-relaxed opacity-90">
                Ao reabrir o aplicativo pelo histórico do navegador no celular ou computador, o sistema exige sua senha novamente para garantir que ninguém veja seus saldos e contas.
              </p>
            </div>
          </div>

          {/* Setting 1: Require login on reopen */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Proteção de Sessão ao Reabrir</span>
            </label>
            <div 
              onClick={() => setTempRequireLogin(!tempRequireLogin)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                tempRequireLogin
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/60'
                  : 'bg-gray-50 dark:bg-slate-800/40 border-gray-200 dark:border-slate-700'
              }`}
            >
              <div className="space-y-1">
                <div className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <span>Exigir senha ao abrir do histórico ou reabrir navegador</span>
                  {tempRequireLogin && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                      ATIVADO
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  Fecha o acesso automaticamente caso o navegador seja fechado ou a página seja reaberta pelo histórico.
                </p>
              </div>

              <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                tempRequireLogin ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-slate-700'
              }`}>
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  tempRequireLogin ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
            </div>
          </div>

          {/* Setting 2: Inactivity Timeout Selection */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Tempo de Inatividade para Bloqueio Automático</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {timeoutOptions.map((opt) => {
                const isSelected = tempTimeout === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTempTimeout(opt.value)}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800/40 border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold ${
                        isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'
                      }`}>
                        {opt.label}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Lock Action */}
          <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-rose-800 dark:text-rose-300">
                Bloquear Sessão Imediatamente
              </div>
              <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                Encerra o acesso neste aparelho agora mesmo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onLockNow();
              }}
              className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Bloquear Agora</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            Alterações salvas neste dispositivo
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3.5 rounded-xl border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="btn-save-security-settings"
              type="button"
              onClick={handleSave}
              className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvo!</span>
                </>
              ) : (
                <span>Salvar Configuração</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
