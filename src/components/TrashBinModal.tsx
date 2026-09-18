import React, { useState, useMemo } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  AlertTriangle, 
  Search, 
  Building2, 
  X, 
  Clock, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  ShieldAlert,
  CheckCircle2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { FinancialAccount, Company, User } from '../types';

interface TrashBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  deletedAccounts: FinancialAccount[];
  companies: Company[];
  currentUser: User;
  onRestoreAccount: (id: number) => void;
  onRestoreAllAccounts: () => void;
  onPermanentDeleteAccount: (id: number) => void;
  onEmptyTrash: () => void;
}

export const TrashBinModal: React.FC<TrashBinModalProps> = ({
  isOpen,
  onClose,
  deletedAccounts,
  companies,
  currentUser,
  onRestoreAccount,
  onRestoreAllAccounts,
  onPermanentDeleteAccount,
  onEmptyTrash,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('TODAS');
  const [confirmEmptyOpen, setConfirmEmptyOpen] = useState(false);
  const [accountToDeletePerm, setAccountToDeletePerm] = useState<FinancialAccount | null>(null);

  const filteredAccounts = useMemo(() => {
    return deletedAccounts.filter((acc) => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchDesc = acc.descricao.toLowerCase().includes(term);
        const matchCat = (acc.categoria || '').toLowerCase().includes(term);
        const matchObs = (acc.observacoes || '').toLowerCase().includes(term);
        const matchUser = (acc.excluido_por || '').toLowerCase().includes(term);
        if (!matchDesc && !matchCat && !matchObs && !matchUser) return false;
      }

      if (selectedCompanyId !== 'TODAS') {
        if (Number(acc.empresa_id) !== Number(selectedCompanyId)) return false;
      }

      return true;
    });
  }, [deletedAccounts, searchTerm, selectedCompanyId]);

  if (!isOpen) return null;

  const getCompanyName = (empresaId: number) => {
    return companies.find((c) => Number(c.id) === Number(empresaId))?.nome || `Empresa #${empresaId}`;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const getDaysRemaining = (excluidoEm?: string) => {
    if (!excluidoEm) return 30;
    try {
      const deleteDate = new Date(excluidoEm).getTime();
      const now = new Date().getTime();
      const elapsedDays = Math.floor((now - deleteDate) / (1000 * 60 * 60 * 24));
      const remaining = 30 - elapsedDays;
      return Math.max(0, remaining);
    } catch {
      return 30;
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('pt-BR', {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-900/50 shadow-xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                  Lixeira com Recuperação (Soft Delete)
                </h2>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  {deletedAccounts.length} {deletedAccounts.length === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Lançamentos excluídos são preservados por até 30 dias para restauração imediata antes da exclusão permanente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {deletedAccounts.length > 0 && (
              <>
                <button
                  onClick={onRestoreAllAccounts}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 transition-colors cursor-pointer"
                  title="Restaurar todos os lançamentos para suas respectivas empresas"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Restaurar Todos</span>
                </button>

                <button
                  onClick={() => setConfirmEmptyOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                  title="Esvaziar permanentemente toda a lixeira"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Esvaziar Lixeira</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/40">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            
            {/* Search Input */}
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por lançamento, categoria ou quem excluiu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Company Filter */}
            <div>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500 truncate"
              >
                <option value="TODAS">Todas as Empresas</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800">
          {filteredAccounts.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                A lixeira está vazia
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                {searchTerm || selectedCompanyId !== 'TODAS'
                  ? 'Nenhum lançamento excluído corresponde aos filtros atuais.'
                  : 'Nenhum lançamento foi excluído recentemente. Ao excluir itens na tabela, eles virão para cá e poderão ser restaurados a qualquer momento em 30 dias.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {filteredAccounts.map((acc) => {
                const daysRemaining = getDaysRemaining(acc.excluido_em);
                const isExpense = acc.tipo === 'pagar';

                return (
                  <div
                    key={acc.id}
                    className="p-4 hover:bg-gray-50/70 dark:hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    {/* Left: Info */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                        isExpense 
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' 
                          : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                      }`}>
                        {isExpense ? <ArrowDownCircle className="w-5 h-5" /> : <ArrowUpCircle className="w-5 h-5" />}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            {acc.descricao}
                          </h4>
                          <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300">
                            {formatCurrency(acc.valor)}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {acc.categoria || 'Geral'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-gray-400" />
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              {getCompanyName(acc.empresa_id)}
                            </span>
                          </div>

                          <span>&bull;</span>

                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span>Vencimento: {acc.data_vencimento}</span>
                          </div>

                          <span>&bull;</span>

                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-rose-500" />
                            <span>Excluído em: {formatDate(acc.excluido_em)} {acc.excluido_por ? `por ${acc.excluido_por}` : ''}</span>
                          </div>
                        </div>

                        {acc.observacoes && (
                          <p className="text-[11px] text-gray-500 italic truncate">
                            Obs: {acc.observacoes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Retention badge & Actions */}
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="text-right hidden sm:block">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          daysRemaining <= 5 
                            ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                        }`}>
                          Restam {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}
                        </span>
                      </div>

                      {/* Restore Button */}
                      <button
                        onClick={() => onRestoreAccount(acc.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors cursor-pointer shadow-xs"
                        title="Restaurar este lançamento para a tabela ativa"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restaurar</span>
                      </button>

                      {/* Permanent Delete Button */}
                      <button
                        onClick={() => setAccountToDeletePerm(acc)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Excluir Definitivamente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 text-xs">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span>Itens na lixeira não afetam seus relatórios nem seu saldo financeiro até serem restaurados.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>

      {/* Confirmation modal for emptying whole trash */}
      {confirmEmptyOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-2xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-rose-200 dark:border-rose-900/50 space-y-4 animate-in zoom-in-95 duration-100">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Esvaziar toda a lixeira?
              </h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              Todos os <strong>{deletedAccounts.length} lançamentos</strong> na lixeira serão <strong>permanentemente excluídos</strong>. Esta ação não poderá ser desfeita.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmEmptyOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onEmptyTrash();
                  setConfirmEmptyOpen(false);
                }}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
              >
                Sim, Esvaziar Tudo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation modal for single item permanent delete */}
      {accountToDeletePerm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-2xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-rose-200 dark:border-rose-900/50 space-y-4 animate-in zoom-in-95 duration-100">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Excluir Definitivamente?
              </h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              Deseja apagar permanentemente o lançamento <strong>"{accountToDeletePerm.descricao}"</strong> ({formatCurrency(accountToDeletePerm.valor)})? Ele não poderá mais ser recuperado.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAccountToDeletePerm(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onPermanentDeleteAccount(accountToDeletePerm.id);
                  setAccountToDeletePerm(null);
                }}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
              >
                Excluir Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
