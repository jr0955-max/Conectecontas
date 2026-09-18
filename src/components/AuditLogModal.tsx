import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  FileText, 
  Trash2, 
  User, 
  Building2, 
  Layers, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  X,
  RefreshCw,
  PlusCircle,
  Edit3,
  RotateCcw,
  UploadCloud,
  FileSpreadsheet,
  ArrowRight
} from 'lucide-react';
import { AuditLog, AuditAction, Company, User as UserType } from '../types';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLog[];
  companies: Company[];
  users: UserType[];
  currentUser: UserType;
  onClearLogs?: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({
  isOpen,
  onClose,
  logs,
  companies,
  users,
  currentUser,
  onClearLogs,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('TODAS');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('TODAS');
  const [selectedUser, setSelectedUser] = useState<string>('TODOS');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<AuditLog | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Filter logs based on search, action, company, user, and date period
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return logs.filter((log) => {
      // Search text
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchDesc = log.descricao.toLowerCase().includes(term);
        const matchUser = (log.usuario_nome || '').toLowerCase().includes(term);
        const matchComp = (log.empresa_nome || '').toLowerCase().includes(term);
        const matchAction = log.acao.toLowerCase().includes(term);
        if (!matchDesc && !matchUser && !matchComp && !matchAction) return false;
      }

      // Action Filter
      if (selectedAction !== 'TODAS' && log.acao !== selectedAction) {
        return false;
      }

      // Company Filter
      if (selectedCompanyId !== 'TODAS') {
        if (Number(log.empresa_id) !== Number(selectedCompanyId)) return false;
      }

      // User Filter
      if (selectedUser !== 'TODOS') {
        if (log.usuario_nome !== selectedUser) return false;
      }

      // Period Filter
      if (periodFilter !== 'all' && log.data_hora) {
        const logTime = new Date(log.data_hora).getTime();
        if (periodFilter === 'today' && logTime < startOfToday) return false;
        if (periodFilter === '7days' && logTime < sevenDaysAgo) return false;
        if (periodFilter === '30days' && logTime < thirtyDaysAgo) return false;
      }

      return true;
    });
  }, [logs, searchTerm, selectedAction, selectedCompanyId, selectedUser, periodFilter]);

  if (!isOpen) return null;

  const getActionBadge = (action: AuditAction) => {
    switch (action) {
      case 'CRIACAO':
      case 'EMPRESA_CRIADA':
      case 'USUARIO_CRIADO':
        return {
          icon: <PlusCircle className="w-3.5 h-3.5" />,
          label: 'Criação',
          color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
        };
      case 'EDICAO':
      case 'EMPRESA_EDITADA':
      case 'USUARIO_EDITADO':
        return {
          icon: <Edit3 className="w-3.5 h-3.5" />,
          label: 'Edição',
          color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
        };
      case 'EXCLUSAO_LIXEIRA':
        return {
          icon: <Trash2 className="w-3.5 h-3.5" />,
          label: 'Lixeira (Soft Delete)',
          color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
        };
      case 'RESTAURACAO':
        return {
          icon: <RotateCcw className="w-3.5 h-3.5" />,
          label: 'Restauração',
          color: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800/60',
        };
      case 'EXCLUSAO_DEFINITIVA':
      case 'EMPRESA_EXCLUIDA':
      case 'USUARIO_EXCLUIDO':
      case 'LIXEIRA_ESVAZIADA':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5" />,
          label: 'Exclusão Permanente',
          color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
        };
      case 'BAIXA_PAGAMENTO':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          label: 'Baixa (Pago/Recebido)',
          color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
        };
      case 'REVERSAO_PAGAMENTO':
        return {
          icon: <RefreshCw className="w-3.5 h-3.5" />,
          label: 'Estorno / Pendente',
          color: 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800/60',
        };
      case 'IMPORTACAO_CSV':
      case 'IMPORTACAO_EXTRATO':
        return {
          icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
          label: 'Importação',
          color: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
        };
      case 'BACKUP_EXPORTADO':
      case 'BACKUP_RESTAURADO':
        return {
          icon: <ShieldCheck className="w-3.5 h-3.5" />,
          label: 'Backup & Segurança',
          color: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/60',
        };
      default:
        return {
          icon: <Clock className="w-3.5 h-3.5" />,
          label: action,
          color: 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300 border-gray-200 dark:border-slate-700',
        };
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const handleExportCsv = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['ID', 'Data/Hora', 'Usuário', 'Ação', 'Entidade', 'Empresa', 'Descrição', 'Detalhes'];
    const rows = filteredLogs.map((log) => [
      log.id,
      formatDate(log.data_hora),
      log.usuario_nome,
      log.acao,
      log.entidade,
      log.empresa_nome || '-',
      `"${(log.descricao || '').replace(/"/g, '""')}"`,
      `"${JSON.stringify(log.detalhes || {}).replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trilha_auditoria_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-900/50 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                  Trilha de Auditoria & Logs de Atividade
                </h2>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {filteredLogs.length} {filteredLogs.length === 1 ? 'registro' : 'registros'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Rastreabilidade completa de todas as alterações, criações, edições, baixas e exclusões no sistema
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              disabled={filteredLogs.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
              title="Exportar registros filtrados para CSV"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/40 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
            
            {/* Search Input */}
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por descrição, usuário, empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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

            {/* Action Type Filter */}
            <div>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="w-full px-2.5 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="TODAS">Todas as Ações</option>
                <option value="CRIACAO">Criação de Conta</option>
                <option value="EDICAO">Edição de Conta</option>
                <option value="BAIXA_PAGAMENTO">Baixa (Pago/Recebido)</option>
                <option value="REVERSAO_PAGAMENTO">Estorno para Pendente</option>
                <option value="EXCLUSAO_LIXEIRA">Movido p/ Lixeira</option>
                <option value="RESTAURACAO">Restaurado da Lixeira</option>
                <option value="EXCLUSAO_DEFINITIVA">Exclusão Permanente</option>
                <option value="IMPORTACAO_CSV">Importação CSV</option>
                <option value="IMPORTACAO_EXTRATO">Importação Extrato</option>
                <option value="BACKUP_EXPORTADO">Backup Gerado</option>
                <option value="BACKUP_RESTAURADO">Backup Restaurado</option>
              </select>
            </div>

            {/* Company Filter */}
            <div>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full px-2.5 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 truncate"
              >
                <option value="TODAS">Todas as Empresas</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Period Quick Select */}
            <div>
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value as any)}
                className="w-full px-2.5 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todo o Histórico</option>
                <option value="today">Hoje</option>
                <option value="7days">Últimos 7 dias</option>
                <option value="30days">Últimos 30 dias</option>
              </select>
            </div>

          </div>
        </div>

        {/* Logs Table / List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Nenhum registro de auditoria encontrado
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                {searchTerm || selectedAction !== 'TODAS' || selectedCompanyId !== 'TODAS' || periodFilter !== 'all'
                  ? 'Tente remover ou afrouxar os filtros de pesquisa aplicados acima.'
                  : 'As ações de criação, edição, baixa e exclusão realizadas pelos usuários aparecerão automaticamente aqui.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-100/90 dark:bg-slate-800/90 backdrop-blur-xs text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider z-10 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Usuário</th>
                  <th className="py-3 px-4">Ação</th>
                  <th className="py-3 px-4">Empresa</th>
                  <th className="py-3 px-4">Descrição do Evento</th>
                  <th className="py-3 px-4 text-right">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs">
                {filteredLogs.map((log) => {
                  const badge = getActionBadge(log.acao);
                  return (
                    <tr 
                      key={log.id} 
                      className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                      onClick={() => setSelectedLogForDetails(log)}
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap text-gray-600 dark:text-gray-300 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>{formatDate(log.data_hora)}</span>
                        </div>
                      </td>

                      {/* User */}
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-[10px]">
                            {log.usuario_nome.charAt(0).toUpperCase()}
                          </div>
                          <span>{log.usuario_nome}</span>
                        </div>
                      </td>

                      {/* Action Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.color}`}>
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Company */}
                      <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                        {log.empresa_nome ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-gray-400" />
                            <span className="truncate max-w-[140px] font-medium">{log.empresa_nome}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">-</span>
                        )}
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 text-gray-800 dark:text-gray-200">
                        <p className="line-clamp-2 leading-relaxed">{log.descricao}</p>
                      </td>

                      {/* Details Button */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLogForDetails(log);
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800/50 transition-colors"
                        >
                          Ver Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 text-xs">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Base protegida com trilha de auditoria em conformidade de segurança e controle interno.</span>
          </div>

          <div className="flex items-center gap-3">
            {onClearLogs && currentUser.acesso_todas_empresas && (
              <button
                onClick={() => setConfirmClearOpen(true)}
                className="text-rose-600 hover:text-rose-700 dark:text-rose-400 text-xs font-semibold hover:underline cursor-pointer"
              >
                Limpar Logs
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>

      {/* Details Side-Drawer / Modal */}
      {selectedLogForDetails && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Detalhes do Evento</h3>
                  <p className="text-[11px] font-mono text-gray-500">{selectedLogForDetails.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLogForDetails(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl">
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Data & Hora</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 font-mono">
                    {formatDate(selectedLogForDetails.data_hora)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Usuário Responsável</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {selectedLogForDetails.usuario_nome}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Ação</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {selectedLogForDetails.acao}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Empresa</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {selectedLogForDetails.empresa_nome || 'Todas / Geral'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider block mb-1">
                  Descrição
                </span>
                <p className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                  {selectedLogForDetails.descricao}
                </p>
              </div>

              {selectedLogForDetails.detalhes && Object.keys(selectedLogForDetails.detalhes).length > 0 && (
                <div>
                  <span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider block mb-1">
                    Dados Adicionais do Lançamento
                  </span>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLogForDetails.detalhes, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLogForDetails(null)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation modal for clearing logs */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-2xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-rose-200 dark:border-rose-900/50 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Limpar Trilha de Auditoria?
              </h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              Você tem certeza de que deseja apagar o histórico de auditoria? Esta ação não pode ser desfeita e removerá os registros de atividade de todos os usuários.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmClearOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (onClearLogs) onClearLogs();
                  setConfirmClearOpen(false);
                }}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
              >
                Confirmar Limpeza
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
