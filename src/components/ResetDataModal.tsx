import React, { useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, X, Check, Building2, Loader2 } from 'lucide-react';

interface ResetDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearAccounts: () => Promise<void>;
  onResetAllAndStartFresh: (companyName: string, cnpj?: string) => Promise<void>;
  onResetToDemo: () => Promise<void>;
  totalAccounts: number;
  totalCompanies: number;
}

export const ResetDataModal: React.FC<ResetDataModalProps> = ({
  isOpen,
  onClose,
  onClearAccounts,
  onResetAllAndStartFresh,
  onResetToDemo,
  totalAccounts,
  totalCompanies,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Custom company name for starting completely fresh
  const [newCompanyName, setNewCompanyName] = useState('Minha Empresa');
  const [newCompanyCnpj, setNewCompanyCnpj] = useState('');

  if (!isOpen) return null;

  const handleClearAccounts = async () => {
    setErrorMessage(null);
    setLoadingAction('clear_acc');
    try {
      await onClearAccounts();
      setSuccessMessage('Todos os lançamentos financeiros de teste foram excluídos com sucesso!');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1600);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Erro ao excluir lançamentos na nuvem.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleWipeAllAndStartFresh = async () => {
    setErrorMessage(null);
    const targetName = newCompanyName.trim() || 'Minha Empresa';
    setLoadingAction('wipe_all');
    try {
      await onResetAllAndStartFresh(targetName, newCompanyCnpj.trim() || undefined);
      setSuccessMessage(`Empresas de teste excluídas! O sistema foi iniciado limpo com a empresa "${targetName}".`);
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Erro ao limpar empresas na nuvem.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleResetDemo = async () => {
    setErrorMessage(null);
    setLoadingAction('demo');
    try {
      await onResetToDemo();
      setSuccessMessage('Empresas e dados padrão de demonstração restaurados com sucesso!');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1600);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Erro ao restaurar dados padrão.');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                Gerenciar & Limpar Dados de Teste
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Limpeza completa de empresas e lançamentos na nuvem e no celular
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage ? (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-3 text-sm font-medium">
              <Check className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          ) : (
            <>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs flex items-center justify-between">
                <span>Total atual cadastrado:</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">
                  {totalCompanies} empresas &bull; {totalAccounts} lançamentos
                </span>
              </div>

              {/* Opção 1: Zerar Tudo e Começar 100% Limpo (Removendo Empresas e Lançamentos) */}
              <div className="p-4 rounded-xl border-2 border-rose-300 dark:border-rose-900/80 bg-rose-50/40 dark:bg-rose-950/30 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-rose-950 dark:text-rose-200 flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    Remover Empresas de Teste e Iniciar Limpo
                  </h4>
                  <p className="text-xs text-rose-800/80 dark:text-rose-300/80 mt-1">
                    Exclui todas as empresas demonstrativas e lançamentos da nuvem, criando a sua empresa real limpa.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                      Nome da Sua Empresa Real:
                    </label>
                    <input
                      id="input-fresh-company-name"
                      type="text"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="Ex: Minha Empresa"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium focus:ring-1 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                      CNPJ (opcional):
                    </label>
                    <input
                      id="input-fresh-company-cnpj"
                      type="text"
                      value={newCompanyCnpj}
                      onChange={(e) => setNewCompanyCnpj(e.target.value)}
                      placeholder="00.000.000/0001-00"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <button
                  id="btn-confirm-wipe-all"
                  disabled={loadingAction !== null}
                  onClick={handleWipeAllAndStartFresh}
                  className="w-full py-2.5 px-3 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs mt-1"
                >
                  {loadingAction === 'wipe_all' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Excluindo empresas e limpando a nuvem...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Remover Todas as Empresas e Iniciar Limpo</span>
                    </>
                  )}
                </button>
              </div>

              {/* Opção 2: Limpar apenas lançamentos financeiros */}
              <div className="p-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-gray-500" />
                      Limpar Apenas os Lançamentos Financeiros
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Apaga os registros financeiros (pagar/receber), mantendo os cadastros de empresas existentes.
                    </p>
                  </div>
                </div>
                <button
                  id="btn-confirm-clear-accounts"
                  disabled={loadingAction !== null}
                  onClick={handleClearAccounts}
                  className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-gray-800 dark:text-gray-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {loadingAction === 'clear_acc' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Apagando lançamentos...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>Zerar Apenas os Lançamentos Financeiros</span>
                    </>
                  )}
                </button>
              </div>

              {/* Opção 3: Restaurar dados de demonstração */}
              <div className="p-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all space-y-2">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
                    Restaurar Dados de Exemplo
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Recarrega as empresas exemplo (Alfa, Beta, Gama) e lançamentos demonstrativos.
                  </p>
                </div>
                <button
                  id="btn-confirm-reset-demo"
                  disabled={loadingAction !== null}
                  onClick={handleResetDemo}
                  className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {loadingAction === 'demo' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Restaurando demonstração...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
                      <span>Restaurar Dados Padrão de Demonstração</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
