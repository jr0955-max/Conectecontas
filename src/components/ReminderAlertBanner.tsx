import React, { useState } from 'react';
import { AlertCircle, Clock, ChevronRight, X, Sliders, CheckCircle2, StickyNote } from 'lucide-react';
import { ReminderItem, ReminderSettings } from '../types';

interface ReminderAlertBannerProps {
  reminders: ReminderItem[];
  settings: ReminderSettings;
  onOpenSettings: () => void;
  onViewReminders: () => void;
  onOpenNotepad?: () => void;
  notepadCount?: number;
}

export const ReminderAlertBanner: React.FC<ReminderAlertBannerProps> = ({
  reminders,
  settings,
  onOpenSettings,
  onViewReminders,
  onOpenNotepad,
  notepadCount,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || !settings.enabled || !settings.banner_visivel || reminders.length === 0) {
    return null;
  }

  const overdueCount = reminders.filter((r) => r.urgencia === 'atrasado').length;
  const todayCount = reminders.filter((r) => r.urgencia === 'hoje').length;
  const upcomingCount = reminders.filter((r) => r.urgencia === 'proximo').length;
  const totalAmount = reminders.reduce((sum, r) => sum + Number(r.account.valor || 0), 0);

  const formattedAmount = totalAmount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const hasHighUrgency = overdueCount > 0 || todayCount > 0;

  return (
    <div
      className={`rounded-2xl p-4 transition-all border shadow-xs animate-in fade-in slide-in-from-top-2 duration-300 ${
        hasHighUrgency
          ? 'bg-amber-500/10 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/70 text-amber-950 dark:text-amber-100'
          : 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60 text-blue-950 dark:text-blue-100'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
              hasHighUrgency
                ? 'bg-amber-500 text-white'
                : 'bg-blue-600 text-white'
            }`}
          >
            {hasHighUrgency ? (
              <AlertCircle className="w-5 h-5 animate-bounce" />
            ) : (
              <Clock className="w-5 h-5" />
            )}
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wide">
                Lembrete Financeiro:
              </span>
              <span className="text-xs font-semibold">
                {reminders.length} {reminders.length === 1 ? 'conta a pagar' : 'contas a pagar'} no radar ({formattedAmount})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs opacity-90">
              {overdueCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold border border-rose-300 dark:border-rose-800">
                  {overdueCount} em atraso
                </span>
              )}
              {todayCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-200 font-bold border border-amber-300 dark:border-amber-700">
                  {todayCount} vence{todayCount > 1 ? 'm' : ''} hoje
                </span>
              )}
              {upcomingCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 font-medium">
                  {upcomingCount} nos próximos {settings.dias_antecedencia} dias
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {onOpenNotepad && (
            <button
              onClick={onOpenNotepad}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs bg-emerald-600 hover:bg-emerald-500 text-white"
              title="Abrir Bloco de Notas Financeiro para anotar contas que lembrou"
            >
              <StickyNote className="w-3.5 h-3.5" />
              <span>Bloco de Notas</span>
              {notepadCount && notepadCount > 0 ? (
                <span className="text-[10px] bg-emerald-700 px-1.5 py-0.2 rounded-full font-mono">
                  {notepadCount}
                </span>
              ) : null}
            </button>
          )}

          <button
            onClick={onViewReminders}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs ${
              hasHighUrgency
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
            title="Abrir Central de Lembretes"
          >
            <span>Ver Contas</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 transition-colors cursor-pointer"
            title="Configurar prazo de antecedência"
          >
            <Sliders className="w-4 h-4 opacity-75 hover:opacity-100" />
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 transition-colors cursor-pointer"
            title="Dispensar aviso por agora"
          >
            <X className="w-4 h-4 opacity-60 hover:opacity-100" />
          </button>
        </div>
      </div>
    </div>
  );
};
