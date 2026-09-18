import React, { useState } from 'react';
import { 
  Building2, 
  ArrowRight, 
  Plus, 
  ShieldCheck, 
  LogOut, 
  Crown, 
  Layers, 
  CheckCircle2, 
  Search, 
  Calendar,
  Sparkles,
  Briefcase
} from 'lucide-react';
import { Company, Tenant, User, FinancialAccount } from '../types';

interface CompanySelectionScreenProps {
  tenant?: Tenant | null;
  companies: Company[];
  currentUser: User;
  onSelectCompany: (companyId: number) => void;
  onCreateCompany?: (name: string, cnpj?: string) => Promise<void>;
  onLogout: () => void;
  onOpenMasterPortal?: () => void;
  accounts?: FinancialAccount[];
  selectedCompanyId?: number;
  onSelectConsolidated?: () => void;
}

export const CompanySelectionScreen: React.FC<CompanySelectionScreenProps> = ({
  tenant,
  companies,
  currentUser,
  onSelectCompany,
  onCreateCompany,
  onLogout,
  onOpenMasterPortal,
  accounts,
  selectedCompanyId,
  onSelectConsolidated,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCnpj, setNewCompanyCnpj] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isMaster = Boolean(currentUser.is_master || Number(currentUser.id) === 1);
  const companyLimit = tenant?.limite_empresas || 10;
  const canCreateCompany = isMaster || companies.length < companyLimit;

  const filteredCompanies = companies.filter((c) => {
    const q = searchTerm.toLowerCase();
    return c.nome.toLowerCase().includes(q) || (c.cnpj && c.cnpj.includes(q));
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim() || !onCreateCompany) return;
    setIsSubmitting(true);
    try {
      await onCreateCompany(newCompanyName.trim(), newCompanyCnpj.trim() || undefined);
      setNewCompanyName('');
      setNewCompanyCnpj('');
      setIsCreating(false);
    } catch (err) {
      console.error('Erro ao cadastrar subempresa:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col justify-between font-sans text-slate-100 p-4 sm:p-6 md:p-8">
      {/* Background ambient decorative shapes */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
      </div>

      {/* Top Bar */}
      <header className="relative w-full max-w-5xl mx-auto flex items-center justify-between py-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-slate-950 font-black text-lg shadow-lg shadow-emerald-500/20">
            CC
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-white tracking-tight">Conectecontas</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                Multi-Tenant
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {tenant?.nome ? `Cliente: ${tenant.nome}` : 'Ambiente Corporativo'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isMaster && onOpenMasterPortal && (
            <button
              id="btn-nav-master-portal"
              onClick={onOpenMasterPortal}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Acessar Gerenciador Master de Clientes e Vendas"
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Painel Master</span>
            </button>
          )}

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-200 text-[11px]">
              {currentUser.nome.charAt(0).toUpperCase()}
            </div>
            <span className="hidden sm:inline font-medium max-w-[120px] truncate">{currentUser.nome}</span>
          </div>

          <button
            onClick={onLogout}
            className="p-2 rounded-xl bg-slate-900 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-900/50 transition-colors cursor-pointer"
            title="Sair da Conta"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative w-full max-w-4xl mx-auto my-auto py-8 sm:py-12 space-y-8">
        
        {/* Title Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
            <span>Nível 2 • Escolha da Unidade de Negócio</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Selecione qual empresa deseja gerenciar
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            Todas as movimentações financeiras, contas a pagar e receber, fluxo de caixa e relatórios serão filtrados exclusivamente para a subempresa escolhida.
          </p>

          {/* Tenant Status Pill */}
          {tenant && (
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 shadow-inner">
              <span className="flex items-center gap-1 text-slate-400">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Plano: <strong className="text-white ml-0.5">{tenant.plano || 'Profissional'}</strong>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">
                Filiais: <strong className="text-emerald-400">{companies.length}</strong>/{tenant.limite_empresas || 10}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                Expira: <strong className="text-slate-200">{tenant.expiracao}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Action Controls & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar subempresa por nome ou CNPJ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>

          {canCreateCompany && onCreateCompany && (
            <button
              id="btn-open-create-company-modal"
              onClick={() => setIsCreating(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-emerald-950"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Subempresa</span>
            </button>
          )}
        </div>

        {/* Companies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCompanies.map((comp) => (
            <div
              key={comp.id}
              id={`company-card-${comp.id}`}
              onClick={() => onSelectCompany(comp.id)}
              className="group relative bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-emerald-950/40 hover:-translate-y-0.5 flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 group-hover:bg-emerald-500/10 border border-slate-700 group-hover:border-emerald-500/30 flex items-center justify-center text-slate-300 group-hover:text-emerald-400 transition-colors">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white group-hover:text-emerald-300 transition-colors line-clamp-1">
                      {comp.nome}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                      {comp.cnpj ? (
                        <span className="font-mono bg-slate-800/80 px-2 py-0.5 rounded text-[11px] text-slate-300">
                          {comp.cnpj}
                        </span>
                      ) : (
                        <span className="text-slate-400">CNPJ não informado</span>
                      )}
                      {comp.cidade && (
                        <span>• {comp.cidade}{comp.estado ? `/${comp.estado}` : ''}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-800 group-hover:bg-emerald-500 text-slate-400 group-hover:text-slate-950 flex items-center justify-center transition-all">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1 text-emerald-400/90 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Pronta para gerenciar
                </span>
                <span className="text-[11px] text-slate-400">
                  ID: #{comp.id}
                </span>
              </div>
            </div>
          ))}

          {filteredCompanies.length === 0 && (
            <div className="col-span-full py-12 px-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-center space-y-3">
              <Building2 className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="font-bold text-slate-300">Nenhuma empresa encontrada</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchTerm 
                  ? 'Não encontramos filiais correspondentes ao termo digitado.'
                  : 'Nenhuma subempresa vinculada a este perfil. Clique em Nova Subempresa para começar.'}
              </p>
            </div>
          )}
        </div>

      </main>

      {/* Footer info */}
      <footer className="relative w-full max-w-5xl mx-auto pt-6 text-center text-xs text-slate-500 border-t border-slate-900">
        <p>Conectecontas Enterprise SaaS • Arquitetura Segura com Isolamento de Dados por Tenant e Empresa</p>
      </footer>

      {/* Modal Nova Subempresa */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Adicionar Subempresa</h3>
                  <p className="text-xs text-slate-400">Cadastre uma nova filial ou unidade</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreating(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Razão Social ou Nome Fantasia *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Matriz São Paulo, Filial Sul..."
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  CNPJ (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="00.000.000/0000-00"
                  value={newCompanyCnpj}
                  onChange={(e) => setNewCompanyCnpj(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newCompanyName.trim()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 text-xs font-bold cursor-pointer transition-all shadow-lg"
                >
                  {isSubmitting ? 'Salvando...' : 'Cadastrar Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
