import React from 'react';
import { Clock, ShieldAlert, CheckCircle, LogOut } from 'lucide-react';

interface InactivityWarningModalProps {
  isOpen: boolean;
  countdown: number;
  timeoutMinutes: number;
  onExtend: () => void;
  onLogout: () => void;
}

export const InactivityWarningModal: React.FC<InactivityWarningModalProps> = ({
  isOpen,
  countdown,
  timeoutMinutes,
  onExtend,
  onLogout,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="modal-inactivity-warning"
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/60 rounded-3xl shadow-2xl p-6 space-y-5 text-center"
      >
        <div className="w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border-2 border-amber-300 dark:border-amber-700/50 shadow-inner">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Proteção por Inatividade</span>
          </div>
          <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
            Sua sessão vai expirar em
          </h3>
          <div className="text-4xl font-black text-amber-600 dark:text-amber-400 font-mono py-1">
            {countdown}s
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
            Por segurança bancária, o sistema encerra a sessão após {timeoutMinutes} minutos sem atividade para proteger seus dados financeiros.
          </p>
        </div>

        <div className="w-full bg-gray-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
          <div 
            className="bg-amber-500 h-full transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${Math.max(0, Math.min(100, (countdown / 60) * 100))}%` }}
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          <button
            id="btn-extend-inactivity-session"
            type="button"
            onClick={onExtend}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Continuar Conectado</span>
          </button>

          <button
            id="btn-lock-now-inactivity"
            type="button"
            onClick={onLogout}
            className="w-full sm:w-auto py-3 px-4 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4 text-rose-500" />
            <span>Bloquear Agora</span>
          </button>
        </div>
      </div>
    </div>
  );
};
