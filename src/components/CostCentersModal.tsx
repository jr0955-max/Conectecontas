import React, { useState, useMemo } from 'react';
import { CostCenter, FinancialAccount, Company } from '../types';
import { 
  PieChart, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  Layers, 
  TrendingDown, 
  TrendingUp, 
  X, 
  CheckCircle2, 
  Tag 
} from 'lucide-react';

interface CostCentersModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  activeCompanyId: number;
  costCenters: CostCenter[];
  accounts: FinancialAccount[];
  onSaveCostCenter: (costCenter: CostCenter) => Promise<void>;
  onDeleteCostCenter: (costCenterId: number) => Promise<void>;
}

const PRESET_COST_CENTERS = [
  { nome: 'Administrativo & Geral', codigo: 'CC-ADM', cor: '#3b82f6', desc: 'Despesas corporativas gerais e estrutura' },
  { nome: 'Operacional & Produção', codigo: 'CC-OPE', cor: '#10b981', desc: 'Custos diretos da atividade fim e entregas' },
  { nome: 'Comercial & Vendas', codigo: 'CC-VEN', cor: '#8b5cf6', desc: 'Comissões, prospecção e eventos comerciais' },
  { nome: 'Marketing & Tráfego', codigo: 'CC-MKT', cor: '#f59e0b', desc: 'Publicidade, branding e redes sociais' },
  { nome: 'Tecnologia & TI', codigo: 'CC-TEC', cor: '#06b6d4', desc: 'Infraestrutura cloud, softwares e suporte' },
  { nome: 'Recursos Humanos & Pessoal', codigo: 'CC-RH', cor: '#ec4899', desc: 'Folha, benefícios e treinamento de equipe' },
  { nome: 'Logística & Transporte', codigo: 'CC-LOG', cor: '#f97316', desc: 'Frotas, combustível e fretes' },
  { nome: 'Financeiro & Jurídico', codigo: 'CC-FIN', cor: '#6366f1', desc: 'Honorários contábeis, jurídicos e tarifas' },
];

export const CostCentersModal: React.FC<CostCentersModalProps> = ({
  isOpen,
  onClose,
  companies,
  activeCompanyId,
  costCenters,
  accounts,
  onSaveCostCenter,
  onDeleteCostCenter,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [cor, setCor] = useState('#3b82f6');
  const [descricao, setDescricao] = useState('');
  const [empresaId, setEmpresaId] = useState<number>(0); // 0 = Todas as empresas
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter cost centers (empresa_id === 0 applies to all, or match activeCompanyId)
  const filteredCostCenters = useMemo(() => {
    if (activeCompanyId > 0) {
      return costCenters.filter((cc) => cc.empresa_id === 0 || cc.empresa_id === activeCompanyId);
    }
    return costCenters;
  }, [costCenters, activeCompanyId]);

  // Calculate expenses and revenues per cost center
  const costCenterStats = useMemo(() => {
    const stats: Record<number, { totalDespesas: number; totalReceitas: number; count: number }> = {};

    costCenters.forEach((cc) => {
      stats[cc.id] = { totalDespesas: 0, totalReceitas: 0, count: 0 };
    });

    accounts.filter((a) => !a.excluido).forEach((acc) => {
      if (!acc.centro_custo_id || !stats[acc.centro_custo_id]) return;

      const val = Number(acc.valor) || 0;
      stats[acc.centro_custo_id].count++;
      if (acc.tipo === 'pagar') {
        stats[acc.centro_custo_id].totalDespesas += val;
      } else {
        stats[acc.centro_custo_id].totalReceitas += val;
      }
    });

    return stats;
  }, [costCenters, accounts]);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingId(null);
    setNome('');
    setCodigo('');
    setCor('#3b82f6');
    setDescricao('');
    setEmpresaId(0);
    setIsEditing(true);
    setFeedbackMsg(null);
  };

  const handleStartEdit = (cc: CostCenter) => {
    setEditingId(cc.id);
    setNome(cc.nome);
    setCodigo(cc.codigo || '');
    setCor(cc.cor || '#3b82f6');
    setDescricao(cc.descricao || '');
    setEmpresaId(cc.empresa_id || 0);
    setIsEditing(true);
    setFeedbackMsg(null);
  };

  const handleSelectPreset = (p: typeof PRESET_COST_CENTERS[0]) => {
    setNome(p.nome);
    setCodigo(p.codigo);
    setCor(p.cor);
    setDescricao(p.desc);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Informe o nome do centro de custo.' });
      return;
    }

    setIsSaving(true);
    try {
      const costCenterData: CostCenter = {
        id: editingId || Date.now(),
        empresa_id: empresaId,
        nome: nome.trim(),
        codigo: codigo.trim() || undefined,
        cor,
        descricao: descricao.trim() || undefined,
        criado_em: new Date().toISOString().split('T')[0],
      };

      await onSaveCostCenter(costCenterData);
      setFeedbackMsg({ type: 'success', text: 'Centro de custo salvo com sucesso!' });
      setIsEditing(false);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao salvar centro de custo.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (ccId: number) => {
    const linkedCount = accounts.filter((a) => a.centro_custo_id === ccId && !a.excluido).length;
    if (linkedCount > 0) {
      const confirm = window.confirm(
        `Existem ${linkedCount} lançamento(s) vinculados a este centro de custo. Deseja realmente remover?`
      );
      if (!confirm) return;
    } else {
      const confirm = window.confirm('Deseja realmente remover este centro de custo?');
      if (!confirm) return;
    }

    try {
      await onDeleteCostCenter(ccId);
      setFeedbackMsg({ type: 'success', text: 'Centro de custo removido.' });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Erro ao remover centro de custo.' });
    }
  };

  return (
    <div id="cost-centers-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div id="cost-centers-modal-card" className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-purple-950/60 to-slate-900 px-6 py-5 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Centros de Custos & Departamentos
                <span className="text-xs bg-purple-500/20 text-purple-300 font-medium px-2 py-0.5 rounded-full border border-purple-500/30">
                  {filteredCostCenters.length} centro(s)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Segmentação gerencial de receitas e despesas por setor (Administrativo, Operacional, Comercial, TI, etc.).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Message */}
        {feedbackMsg && (
          <div className={`mx-6 mt-4 p-3 rounded-lg text-sm border flex items-center gap-2 ${
            feedbackMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {!isEditing ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                  Centros de Custos Disponíveis
                </h3>
                <button
                  id="btn-add-new-cost-center"
                  onClick={handleStartCreate}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-3.5 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-purple-600/20"
                >
                  <Plus className="w-4 h-4" />
                  Novo Centro de Custo
                </button>
              </div>

              {filteredCostCenters.length === 0 ? (
                <div className="text-center py-12 bg-slate-800/40 rounded-2xl border border-dashed border-slate-700/80 p-8">
                  <Layers className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-50" />
                  <p className="text-slate-300 font-medium">Nenhum centro de custo cadastrado</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Crie categorias gerenciais como Administrativo, Vendas ou TI para organizar despesas.
                  </p>
                  <button
                    onClick={handleStartCreate}
                    className="mt-4 inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Cadastrar Primeiro Centro de Custo
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredCostCenters.map((cc) => {
                    const stats = costCenterStats[cc.id] || { totalDespesas: 0, totalReceitas: 0, count: 0 };

                    return (
                      <div
                        key={cc.id}
                        className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4.5 hover:border-slate-600 transition-all flex flex-col justify-between relative overflow-hidden"
                      >
                        {/* Top accent bar */}
                        <div 
                          className="absolute top-0 left-0 right-0 h-1.5"
                          style={{ backgroundColor: cc.cor || '#8b5cf6' }}
                        />

                        <div>
                          <div className="flex items-start justify-between gap-2 mt-1">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-4 h-4 rounded-md shrink-0 shadow-sm"
                                style={{ backgroundColor: cc.cor || '#8b5cf6' }}
                              />
                              <div>
                                <h4 className="font-bold text-white text-base leading-tight flex items-center gap-2">
                                  {cc.nome}
                                  {cc.codigo && (
                                    <span className="text-[10px] bg-slate-900 text-purple-300 font-mono px-2 py-0.5 rounded-md border border-purple-500/30">
                                      {cc.codigo}
                                    </span>
                                  )}
                                </h4>
                                {cc.descricao && (
                                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                                    {cc.descricao}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleStartEdit(cc)}
                                className="p-1.5 text-slate-400 hover:text-purple-300 hover:bg-slate-700 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(cc.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded-lg transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Distribution metrics */}
                        <div className="mt-4 pt-3 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/40">
                            <div className="text-slate-400 flex items-center gap-1">
                              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                              Total Despesas
                            </div>
                            <div className="text-sm font-bold text-rose-400 mt-0.5">
                              {stats.totalDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                          </div>

                          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/40">
                            <div className="text-slate-400 flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                              Total Receitas
                            </div>
                            <div className="text-sm font-bold text-emerald-400 mt-0.5">
                              {stats.totalReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Editing / Creation Form */
            <form onSubmit={handleSubmit} className="space-y-5 bg-slate-800/80 p-5 rounded-2xl border border-slate-700">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {editingId ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-slate-400 hover:text-white px-2.5 py-1 bg-slate-700 rounded-lg"
                >
                  Voltar à Lista
                </button>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">
                  Modelos Prontos de Centros de Custo:
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COST_CENTERS.map((preset) => (
                    <button
                      key={preset.codigo}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-purple-500 text-slate-300 flex items-center gap-1.5 transition-all"
                    >
                      <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: preset.cor }} />
                      {preset.nome} ({preset.codigo})
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome do Centro de Custo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Comercial & Vendas"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Código / Sigla (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: CC-VEN ou 1.02"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-purple-500 uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Empresa Aplicável
                  </label>
                  <select
                    value={empresaId}
                    onChange={(e) => setEmpresaId(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-purple-500"
                  >
                    <option value={0}>🌐 Todas as Empresas (Global)</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cor Visual
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={cor}
                      onChange={(e) => setCor(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <span className="text-xs font-mono text-slate-400">{cor}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descrição (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Despesas com publicidade, comissões e marketing digital"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2.5 text-sm text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 text-sm text-white bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold shadow-lg shadow-purple-600/30 flex items-center gap-2 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {isSaving ? 'Salvando...' : 'Salvar Centro de Custo'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-900 px-6 py-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
