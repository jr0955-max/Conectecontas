import React, { useState } from 'react';
import { Company } from '../types';
import { 
  Building2, 
  X, 
  Plus, 
  Trash2, 
  Check, 
  ShieldCheck,
  Edit2,
  Save
} from 'lucide-react';

interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  selectedCompanyId: number;
  onSelectCompany: (id: number) => void;
  onAddCompany: (nome: string, cnpj?: string) => void;
  onEditCompany: (id: number, nome: string, cnpj?: string) => { success: boolean; error?: string };
  onDeleteCompany: (id: number) => void;
}

export const CompanyModal: React.FC<CompanyModalProps> = ({
  isOpen,
  onClose,
  companies,
  selectedCompanyId,
  onSelectCompany,
  onAddCompany,
  onEditCompany,
  onDeleteCompany,
}) => {
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [error, setError] = useState('');

  // Editing company state
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editCnpj, setEditCnpj] = useState('');
  const [editError, setEditError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setError('Informe o nome da empresa.');
      return;
    }

    if (companies.some((c) => c.nome.toLowerCase() === nome.trim().toLowerCase())) {
      setError('Já existe uma empresa cadastrada com este nome.');
      return;
    }

    onAddCompany(nome.trim(), cnpj.trim() || undefined);
    setNome('');
    setCnpj('');
    setError('');
  };

  const handleStartEdit = (comp: Company) => {
    setEditingCompanyId(comp.id);
    setEditNome(comp.nome);
    setEditCnpj(comp.cnpj || '');
    setEditError('');
  };

  const handleSaveEdit = (comp: Company) => {
    if (!editNome.trim()) {
      setEditError('O nome da empresa é obrigatório.');
      return;
    }

    const res = onEditCompany(comp.id, editNome.trim(), editCnpj.trim() || undefined);
    if (res.success) {
      setEditingCompanyId(null);
      setEditError('');
    } else {
      setEditError(res.error || 'Erro ao editar empresa.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Gerenciar & Editar Empresas
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Cadastro e edição multiempresa isolada no SQLite
              </p>
            </div>
          </div>

          <button
            id="close-company-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Form de Nova Empresa */}
          <form onSubmit={handleSubmit} className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Cadastrar Nova Empresa</span>
            </h3>

            {error && (
              <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/50 p-2 rounded-lg border border-rose-200 dark:border-rose-900">
                {error}
              </p>
            )}

            <div className="space-y-2">
              <input
                id="input-company-name"
                type="text"
                required
                placeholder="Razão Social ou Nome Fantasia *"
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  if (error) setError('');
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />

              <input
                id="input-company-cnpj"
                type="text"
                placeholder="CNPJ (opcional) - Ex: 00.000.000/0001-00"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <button
              id="btn-add-company-submit"
              type="submit"
              className="w-full py-2 px-3 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Salvar Nova Empresa</span>
            </button>
          </form>

          {/* Lista de Empresas Existentes com Edição */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Empresas Cadastradas ({companies.length})
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Edição em Tempo Real
              </span>
            </div>

            <div className="space-y-2">
              {companies.map((comp) => {
                const isSelected = comp.id === selectedCompanyId;
                const isEditing = editingCompanyId === comp.id;

                if (isEditing) {
                  return (
                    <div
                      key={comp.id}
                      className="p-3.5 rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/30 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                          <Edit2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Editando Empresa #{comp.id}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingCompanyId(null)}
                          className="text-[11px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          Cancelar
                        </button>
                      </div>

                      {editError && (
                        <p className="text-[11px] text-rose-600 bg-rose-50 dark:bg-rose-950/60 p-1.5 rounded border border-rose-200 dark:border-rose-900">
                          {editError}
                        </p>
                      )}

                      <div className="space-y-1.5">
                        <div>
                          <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 block mb-0.5">
                            Nome da Empresa *
                          </label>
                          <input
                            type="text"
                            value={editNome}
                            onChange={(e) => setEditNome(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                            placeholder="Nome / Razão Social"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 block mb-0.5">
                            CNPJ
                          </label>
                          <input
                            type="text"
                            value={editCnpj}
                            onChange={(e) => setEditCnpj(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                            placeholder="00.000.000/0001-00"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingCompanyId(null)}
                          className="px-2.5 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(comp)}
                          className="px-3 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 shadow-xs"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Salvar Alterações</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={comp.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-blue-50/50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800'
                        : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700'
                    }`}
                  >
                    <div 
                      onClick={() => onSelectCompany(comp.id)}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {comp.nome}
                        </span>
                        {isSelected && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-600 text-white">
                            Ativa
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                        {comp.cnpj ? `CNPJ: ${comp.cnpj}` : 'Sem CNPJ informado'} &bull; ID: #{comp.id}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEdit(comp)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors cursor-pointer"
                        title="Editar empresa"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {!isSelected && (
                        <button
                          onClick={() => onSelectCompany(comp.id)}
                          className="px-2 py-1 text-[11px] font-semibold rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
                        >
                          Selecionar
                        </button>
                      )}

                      {companies.length > 1 && (
                        <button
                          onClick={() => onDeleteCompany(comp.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Excluir empresa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50/50 dark:bg-slate-800/40 border-t border-gray-100 dark:border-slate-800 flex justify-end">
          <button
            id="btn-close-company-modal-footer"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
          >
            Concluir
          </button>
        </div>

      </div>
    </div>
  );
};
