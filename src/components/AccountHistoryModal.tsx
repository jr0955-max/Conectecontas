import React from 'react';
import { 
  History, 
  X, 
  Clock, 
  User, 
  Building2, 
  FileText, 
  CheckCircle2, 
  ArrowDownCircle, 
  ArrowUpCircle,
  Tag,
  Calendar,
  ShieldCheck,
  Edit3
} from 'lucide-react';
import { FinancialAccount, AuditLog, Company } from '../types';

interface AccountHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: FinancialAccount | null;
  logs: AuditLog[];
  companies: Company[];
}

export const AccountHistoryModal: React.FC<AccountHistoryModalProps> = ({
  isOpen,
  onClose,
  account,
  logs,
  companies,
}) => {
  if (!isOpen || !account) return null;

  const company = companies.find((c) => Number(c.id) === Number(account.empresa_id));

  // Find logs related to this account
  const accountLogs = logs.filter(
    (l) => l.entidade === 'conta' && (String(l.entidade_id) === String(account.id) || l.descricao.includes(account.descricao))
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-900/50">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Histórico do Lançamento
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                ID: {account.id} &bull; {account.descricao}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Account Summary Card */}
        <div className="p-6 border-b border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/40 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                account.tipo === 'pagar' 
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300' 
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
              }`}>
                {account.tipo === 'pagar' ? 'Conta a Pagar' : 'Conta a Receber'}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                account.status === 'Pago' || account.status === 'Recebido'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200'
              }`}>
                {account.status}
              </span>
            </div>

            <span className="text-lg font-bold font-mono text-gray-900 dark:text-white">
              {formatCurrency(account.valor)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Empresa</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block">
                {company?.nome || `Empresa #${account.empresa_id}`}
              </span>
            </div>

            <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Vencimento</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200 font-mono">
                {account.data_vencimento}
              </span>
            </div>

            <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Criado Por</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block">
                {account.criado_por || 'Sistema'}
              </span>
            </div>

            <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Última Atualização</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block">
                {account.atualizado_por || account.criado_por || 'Sistema'}
              </span>
            </div>
          </div>
        </div>

        {/* Timeline List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Linha do Tempo de Alterações
          </h4>

          {accountLogs.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <Clock className="w-8 h-8 text-gray-400 mx-auto" />
              <p className="text-xs text-gray-500">
                Criado inicialmente por <strong>{account.criado_por || 'Admin'}</strong>.
              </p>
              <p className="text-[11px] text-gray-400">
                Novas alterações de valor, vencimento ou status registradas a partir de agora serão listadas em tempo real aqui.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-slate-800">
              {accountLogs.map((log) => (
                <div key={log.id} className="relative space-y-1">
                  <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900 shadow-xs" />
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-900 dark:text-white">
                      {log.acao} &bull; {log.usuario_nome}
                    </span>
                    <span className="text-[11px] text-gray-500 font-mono">
                      {formatDate(log.data_hora)}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-gray-100 dark:border-slate-700/60">
                    {log.descricao}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
