import React, { useState, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Check,
  Calendar,
  Highlighter,
  Send,
  Building2,
  Tag,
  StickyNote,
  List,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Copy,
  RotateCcw,
  Pencil,
  Bell
} from 'lucide-react';
import { FinancialNoteItem, FinancialNotepadState, Company } from '../types';

interface FinancialNotepadModalProps {
  isOpen: boolean;
  onClose: () => void;
  notepadState: FinancialNotepadState;
  onSaveNotepad: (newState: FinancialNotepadState) => void;
  companies: Company[];
  selectedCompanyId?: number;
  onLaunchToAccounts: (item: FinancialNoteItem, empresaId: number, categoria?: string) => Promise<boolean> | boolean;
  initialEditItemId?: string | null;
  onClearInitialEditItemId?: () => void;
}

export const FinancialNotepadModal: React.FC<FinancialNotepadModalProps> = ({
  isOpen,
  onClose,
  notepadState,
  onSaveNotepad,
  companies,
  selectedCompanyId,
  onLaunchToAccounts,
  initialEditItemId,
  onClearInitialEditItemId,
}) => {
  const [activeTab, setActiveTab] = useState<'lista' | 'texto'>('lista');
  const [filter, setFilter] = useState<'todos' | 'lembretes' | 'destacadas' | 'pendentes' | 'concluidas'>('todos');

  // Filtro de empresa individual ou consolidado (Permite isolar completamente o bloco por empresa)
  const [empresaFiltroId, setEmpresaFiltroId] = useState<number | 'todas'>(() => {
    if (selectedCompanyId && selectedCompanyId > 0) return selectedCompanyId;
    return 'todas';
  });

  // Empresa selecionada ao adicionar novo item
  const [novaEmpresaId, setNovaEmpresaId] = useState<number>(() => {
    if (selectedCompanyId && selectedCompanyId > 0) return selectedCompanyId;
    return companies[0]?.id ? Number(companies[0].id) : 1;
  });
  
  // Sincroniza a empresa ativa quando o modal é aberto ou empresa muda
  React.useEffect(() => {
    if (isOpen) {
      if (selectedCompanyId && selectedCompanyId > 0) {
        setEmpresaFiltroId(selectedCompanyId);
        setNovaEmpresaId(selectedCompanyId);
        setEmpresaLancamentoId(selectedCompanyId);
      } else {
        setEmpresaFiltroId('todas');
      }
    }
  }, [isOpen, selectedCompanyId]);

  // Sincroniza item para edição inicial quando disparado via atalho externo
  React.useEffect(() => {
    if (isOpen && initialEditItemId) {
      const target = notepadState?.itens?.find((it) => it.id === initialEditItemId);
      if (target) {
        handleStartEdit(target);
      }
      if (onClearInitialEditItemId) {
        onClearInitialEditItemId();
      }
    }
  }, [isOpen, initialEditItemId, notepadState?.itens]);

  // Novo item em digitação
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoValor, setNovoValor] = useState('');
  const [novoVencimento, setNovoVencimento] = useState('');
  const [novoDestaqueVerde, setNovoDestaqueVerde] = useState(true);
  const [novaObservacao, setNovaObservacao] = useState('');
  const [mostrarMaisOpcoes, setMostrarMaisOpcoes] = useState(false);

  // Estado para Edição de Lançamento
  const [itemEmEdicao, setItemEmEdicao] = useState<FinancialNoteItem | null>(null);
  const [editDescricao, setEditDescricao] = useState('');
  const [editValor, setEditValor] = useState('');
  const [editVencimento, setEditVencimento] = useState('');
  const [editDestaqueVerde, setEditDestaqueVerde] = useState(true);
  const [editEmpresaId, setEditEmpresaId] = useState<number>(1);
  const [editObservacao, setEditObservacao] = useState('');
  const [editCategoria, setEditCategoria] = useState('');
  const [editConcluido, setEditConcluido] = useState(false);

  // Estado para lançar conta no sistema
  const [itemParaLancamento, setItemParaLancamento] = useState<FinancialNoteItem | null>(null);
  const [empresaLancamentoId, setEmpresaLancamentoId] = useState<number>(() => {
    if (selectedCompanyId && selectedCompanyId > 0) return selectedCompanyId;
    return companies[0]?.id ? Number(companies[0].id) : 1;
  });
  const [categoriaLancamento, setCategoriaLancamento] = useState('Despesas Gerais');
  const [isLaunching, setIsLaunching] = useState(false);
  const [feedbackMensagem, setFeedbackMensagem] = useState<string | null>(null);

  const getCompanyName = (empresaId?: number) => {
    if (!empresaId) return companies[0]?.nome || 'Empresa Padrão';
    const comp = companies.find((c) => Number(c.id) === Number(empresaId));
    return comp ? comp.nome : `Empresa #${empresaId}`;
  };

  // Avalia se o vencimento anotado está próximo para exibir alerta de lembrete financeiro
  const getNoteReminderStatus = (dataAprox?: string) => {
    if (!dataAprox) return null;
    const clean = dataAprox.trim();
    const now = new Date();
    const currentDay = now.getDate();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let targetDate: Date | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [y, m, d] = clean.split('-').map(Number);
      targetDate = new Date(y, m - 1, d, 0, 0, 0, 0);
    } else {
      const diaMatch = clean.match(/\d{1,2}/);
      if (diaMatch) {
        const dia = parseInt(diaMatch[0], 10);
        if (dia >= 1 && dia <= 31) {
          targetDate = new Date(currentYear, currentMonth, dia, 0, 0, 0, 0);
        }
      }
    }

    if (!targetDate) return null;

    const today = new Date(currentYear, currentMonth, currentDay, 0, 0, 0, 0);
    const diffDays = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return {
        label: 'Vence Hoje!',
        badgeClass: 'bg-amber-100 text-amber-900 dark:bg-amber-950/90 dark:text-amber-200 border-amber-400 dark:border-amber-700 animate-pulse font-extrabold',
        isAlert: true,
      };
    } else if (diffDays > 0 && diffDays <= 3) {
      return {
        label: `Vence em ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`,
        badgeClass: 'bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-200 border-blue-300 dark:border-blue-700 font-bold',
        isAlert: true,
      };
    } else if (diffDays < 0 && diffDays >= -5) {
      return {
        label: `Venceu há ${Math.abs(diffDays)} dias`,
        badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-semibold',
        isAlert: false,
      };
    }
    return null;
  };

  const handleStartEdit = (item: FinancialNoteItem) => {
    setItemEmEdicao(item);
    setEditDescricao(item.descricao);
    setEditValor(item.valor != null ? String(item.valor) : '');
    setEditVencimento(item.dataVencimentoAproximada || '');
    setEditDestaqueVerde(item.destaqueVerde);
    setEditEmpresaId(item.empresa_id ? Number(item.empresa_id) : (selectedCompanyId && selectedCompanyId > 0 ? selectedCompanyId : Number(companies[0]?.id || 1)));
    setEditObservacao(item.observacao || '');
    setEditCategoria(item.categoriaSugerida || '');
    setEditConcluido(!!item.concluido);
  };

  const handleSaveEdit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!itemEmEdicao || !editDescricao.trim()) return;

    let valorNum: number | null = null;
    if (editValor) {
      const sanitized = editValor.replace(/[^\d.,]/g, '').replace(',', '.');
      const parsed = parseFloat(sanitized);
      if (!isNaN(parsed) && parsed > 0) valorNum = parsed;
    }

    const updatedItens = notepadState.itens.map((it) => {
      if (it.id === itemEmEdicao.id) {
        return {
          ...it,
          descricao: editDescricao.trim(),
          valor: valorNum,
          dataVencimentoAproximada: editVencimento.trim() || undefined,
          destaqueVerde: editDestaqueVerde,
          empresa_id: editEmpresaId,
          concluido: editConcluido,
          observacao: editObservacao.trim() || undefined,
          categoriaSugerida: editCategoria.trim() || undefined,
          atualizadoEm: new Date().toISOString(),
        };
      }
      return it;
    });

    onSaveNotepad({
      ...notepadState,
      itens: updatedItens,
      ultimaAtualizacao: new Date().toISOString(),
    });

    setFeedbackMensagem(`Lançamento "${editDescricao.trim()}" atualizado com sucesso!`);
    setItemEmEdicao(null);
    setTimeout(() => setFeedbackMensagem(null), 3000);
  };

  const quickSuggestions = [
    'MINHA CASA MINHA VIDA',
    'PREVIDENCIA',
    'CARTAO DE CREDITO',
    'ALUGUEL',
    'ENERGIA ELETRICA',
    'INTERNET / FIBRA',
    'AGUA E ESGOTO',
    'CONDOMINIO',
  ];

  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const descTrim = novaDescricao.trim();
    if (!descTrim) return;

    let valorNum: number | null = null;
    if (novoValor) {
      const sanitized = novoValor.replace(/[^\d.,]/g, '').replace(',', '.');
      const parsed = parseFloat(sanitized);
      if (!isNaN(parsed) && parsed > 0) valorNum = parsed;
    }

    const newItem: FinancialNoteItem = {
      id: `note-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      descricao: descTrim,
      valor: valorNum,
      dataVencimentoAproximada: novoVencimento.trim() || undefined,
      destaqueVerde: novoDestaqueVerde,
      concluido: false,
      empresa_id: novaEmpresaId,
      observacao: novaObservacao.trim() || undefined,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };

    const updatedState: FinancialNotepadState = {
      ...notepadState,
      itens: [newItem, ...notepadState.itens],
    };

    onSaveNotepad(updatedState);
    setNovaDescricao('');
    setNovoValor('');
    setNovoVencimento('');
    setNovaObservacao('');
    setFeedbackMensagem(`Conta "${descTrim}" anotada no bloco com sucesso!`);
    setTimeout(() => setFeedbackMensagem(null), 3000);
  };

  const handleToggleConcluido = (id: string) => {
    const updatedItens = notepadState.itens.map((it) => {
      if (it.id === id) {
        return { ...it, concluido: !it.concluido, atualizadoEm: new Date().toISOString() };
      }
      return it;
    });
    onSaveNotepad({ ...notepadState, itens: updatedItens });
  };

  const handleToggleDestaqueVerde = (id: string) => {
    const updatedItens = notepadState.itens.map((it) => {
      if (it.id === id) {
        return { ...it, destaqueVerde: !it.destaqueVerde, atualizadoEm: new Date().toISOString() };
      }
      return it;
    });
    onSaveNotepad({ ...notepadState, itens: updatedItens });
  };

  const handleDeleteItem = (id: string) => {
    const updatedItens = notepadState.itens.filter((it) => it.id !== id);
    onSaveNotepad({ ...notepadState, itens: updatedItens });
  };

  const currentTextoLivre = useMemo(() => {
    if (empresaFiltroId !== 'todas') {
      const byComp = notepadState.textosPorEmpresa?.[empresaFiltroId];
      if (byComp !== undefined) return byComp;
    }
    return notepadState.textoLivre || '';
  }, [empresaFiltroId, notepadState.textosPorEmpresa, notepadState.textoLivre]);

  const handleUpdateTextoLivre = (texto: string) => {
    if (empresaFiltroId !== 'todas') {
      const updatedMap = {
        ...(notepadState.textosPorEmpresa || {}),
        [empresaFiltroId]: texto,
      };
      onSaveNotepad({
        ...notepadState,
        textoLivre: texto,
        textosPorEmpresa: updatedMap,
        ultimaAtualizacao: new Date().toISOString(),
      });
    } else {
      onSaveNotepad({
        ...notepadState,
        textoLivre: texto,
        ultimaAtualizacao: new Date().toISOString(),
      });
    }
  };

  const handleConfirmarLancamento = async () => {
    if (!itemParaLancamento) return;
    setIsLaunching(true);
    try {
      const ok = await onLaunchToAccounts(itemParaLancamento, empresaLancamentoId, categoriaLancamento);
      if (ok) {
        // Marca o item como lançado no sistema
        const updatedItens = notepadState.itens.map((it) => {
          if (it.id === itemParaLancamento.id) {
            return {
              ...it,
              lancadoNoSistema: true,
              concluido: true,
              atualizadoEm: new Date().toISOString(),
            };
          }
          return it;
        });
        onSaveNotepad({ ...notepadState, itens: updatedItens });
        setFeedbackMensagem(`Conta "${itemParaLancamento.descricao}" lançada com sucesso no Contas a Pagar!`);
        setItemParaLancamento(null);
        setTimeout(() => setFeedbackMensagem(null), 4000);
      }
    } catch (err) {
      console.error(err);
      setFeedbackMensagem('Erro ao lançar conta no sistema. Verifique os dados.');
      setTimeout(() => setFeedbackMensagem(null), 4000);
    } finally {
      setIsLaunching(false);
    }
  };

  // Processa itens filtrados com isolamento por empresa
  const companyScopedItens = useMemo(() => {
    const itens = notepadState?.itens || [];
    if (empresaFiltroId !== 'todas') {
      return itens.filter((it) => Number(it.empresa_id || 1) === Number(empresaFiltroId));
    }
    return itens;
  }, [notepadState?.itens, empresaFiltroId]);

  const totalLembretesAtivos = useMemo(() => {
    return companyScopedItens.filter((it) => !it.concluido && getNoteReminderStatus(it.dataVencimentoAproximada) != null).length;
  }, [companyScopedItens]);

  const filteredItens = useMemo(() => {
    return companyScopedItens.filter((it) => {
      if (filter === 'lembretes') return !it.concluido && getNoteReminderStatus(it.dataVencimentoAproximada) != null;
      if (filter === 'destacadas') return it.destaqueVerde;
      if (filter === 'pendentes') return !it.concluido;
      if (filter === 'concluidas') return it.concluido;
      return true;
    });
  }, [companyScopedItens, filter]);

  const totalValorAnotado = companyScopedItens.reduce((acc, it) => acc + (it.valor || 0), 0);
  const totalDestacadas = companyScopedItens.filter((it) => it.destaqueVerde).length;
  const totalLancadas = companyScopedItens.filter((it) => it.lancadoNoSistema).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header estilo Bloco de Notas / Caderno */}
        <div className="p-4 sm:p-5 border-b border-amber-200/60 dark:border-slate-800 bg-amber-500/10 dark:bg-amber-950/30 flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <StickyNote className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  Bloco de Notas Financeiro
                </h2>
                <span className="text-[11px] font-extrabold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 rounded-full border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                  <Highlighter className="w-3 h-3" />
                  Contas a Lembrar
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Anotações e lembretes de contas isoladas por empresa com marcação estilo caderno físico.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
            title="Fechar bloco de notas"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback visual temporário */}
        {feedbackMensagem && (
          <div className="mx-4 sm:mx-6 mt-3 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedbackMensagem}</span>
            </div>
            <button onClick={() => setFeedbackMensagem(null)} className="opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 1. SELETOR DE EMPRESAS PARA SEPARAÇÃO DO BLOCO DE NOTAS */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-100/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
            <Building2 className="w-4 h-4 text-blue-500" />
            <span>Bloco da Empresa:</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-full">
            <button
              type="button"
              onClick={() => setEmpresaFiltroId('todas')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                empresaFiltroId === 'todas'
                  ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <span>Todas as Empresas</span>
              <span className="text-[10px] opacity-80 font-mono">({notepadState.itens.length})</span>
            </button>

            {companies.map((comp) => {
              const countComp = notepadState.itens.filter((it) => Number(it.empresa_id || 1) === Number(comp.id)).length;
              return (
                <button
                  key={comp.id}
                  type="button"
                  onClick={() => {
                    setEmpresaFiltroId(Number(comp.id));
                    setNovaEmpresaId(Number(comp.id));
                    setEmpresaLancamentoId(Number(comp.id));
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    empresaFiltroId === Number(comp.id)
                      ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/20'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <Building2 className="w-3 h-3 opacity-70" />
                  <span className="truncate max-w-[130px]">{comp.nome}</span>
                  <span className="text-[10px] opacity-80 font-mono">({countComp})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Banner de Integração Direta com Lembretes Financeiros */}
        <div className="mx-4 sm:mx-6 mt-3 px-3.5 py-2 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-800/60 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 min-w-0">
            <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-[11px] font-semibold truncate sm:whitespace-normal">
              <span className="font-extrabold">Integrado aos Lembretes Financeiros:</span> Contas anotadas com dia ou data de vencimento aparecem no radar de alertas e podem ser lançadas com 1 clique no Contas a Pagar oficial.
            </p>
          </div>
          {totalLembretesAtivos > 0 && (
            <button
              onClick={() => setFilter('lembretes')}
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] shrink-0 cursor-pointer shadow-2xs transition-colors"
            >
              {totalLembretesAtivos} {totalLembretesAtivos === 1 ? 'no radar' : 'no radar'}
            </button>
          )}
        </div>

        {/* Métricas e Totalizador rápido do Bloco da Empresa Ativa */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Contas no Bloco</span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">
              {companyScopedItens.length} {companyScopedItens.length === 1 ? 'conta' : 'contas'}
            </span>
          </div>

          <div className="p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Total Estimado</span>
            <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
              {totalValorAnotado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>

          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60">
            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block font-medium flex items-center gap-1">
              <Highlighter className="w-3 h-3" />
              Destaque Verde
            </span>
            <span className="text-sm font-extrabold text-emerald-800 dark:text-emerald-200">
              {totalDestacadas} no radar
            </span>
          </div>

          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60">
            <span className="text-[10px] text-blue-700 dark:text-blue-300 block font-medium">Lançadas no Sistema</span>
            <span className="text-sm font-extrabold text-blue-800 dark:text-blue-200">
              {totalLancadas} convertidas
            </span>
          </div>
        </div>

        {/* Abas Superiores: Lista de Contas vs Modo Caderno Livre */}
        <div className="px-4 sm:px-6 pt-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('lista')}
              className={`pb-2.5 px-3 text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
                activeTab === 'lista'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <List className="w-4 h-4" />
              <span>Contas a Lembrar ({companyScopedItens.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('texto')}
              className={`pb-2.5 px-3 text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
                activeTab === 'texto'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <StickyNote className="w-4 h-4" />
              <span>Modo Caderno / Anotações Livres</span>
            </button>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'lista' ? (
            <>
              {/* 2. CARD DE EDIÇÃO DE LANÇAMENTO (QUANDO ATIVO) */}
              {itemEmEdicao && (
                <div id="notepad-edit-card" className="p-4 sm:p-5 bg-blue-50/90 dark:bg-slate-850 border-2 border-blue-400 dark:border-blue-600 rounded-2xl shadow-xl space-y-3 animate-in fade-in zoom-in-95 scroll-mt-4">
                  <div className="flex items-center justify-between pb-2 border-b border-blue-200/80 dark:border-blue-800">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-600 text-white">
                        <Pencil className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs sm:text-sm font-extrabold text-blue-950 dark:text-blue-100 flex items-center gap-2">
                          <span>Editar Lançamento: "{itemEmEdicao.descricao}"</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700">
                            {getCompanyName(itemEmEdicao.empresa_id)}
                          </span>
                        </h3>
                        <p className="text-[11px] text-blue-800 dark:text-blue-300">
                          Altere descrição, valor, vencimento, empresa e observações desta anotação financeira
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setItemEmEdicao(null)}
                      className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveEdit} className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Descrição da Conta *
                        </label>
                        <input
                          type="text"
                          value={editDescricao}
                          onChange={(e) => setEditDescricao(e.target.value)}
                          placeholder="Ex: MINHA CASA MINHA VIDA..."
                          className="w-full px-3 py-2 text-xs font-bold uppercase tracking-wide bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Empresa Dono do Lançamento
                        </label>
                        <select
                          value={editEmpresaId}
                          onChange={(e) => setEditEmpresaId(Number(e.target.value))}
                          className="w-full px-2.5 py-2 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                        >
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Valor Estimado (R$)
                        </label>
                        <input
                          type="text"
                          value={editValor}
                          onChange={(e) => setEditValor(e.target.value)}
                          placeholder="Ex: 485,50"
                          className="w-full px-3 py-2 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Dia ou Data de Vencimento
                        </label>
                        <input
                          type="text"
                          value={editVencimento}
                          onChange={(e) => setEditVencimento(e.target.value)}
                          placeholder="Ex: Dia 15 ou 2026-10-15"
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Destaque Marca-Texto
                        </label>
                        <button
                          type="button"
                          onClick={() => setEditDestaqueVerde((prev) => !prev)}
                          className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                            editDestaqueVerde
                              ? 'bg-emerald-500 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <Highlighter className="w-3.5 h-3.5" />
                          <span>{editDestaqueVerde ? 'Marca-Texto Verde' : 'Sem Destaque'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Categoria Sugerida
                        </label>
                        <input
                          type="text"
                          value={editCategoria}
                          onChange={(e) => setEditCategoria(e.target.value)}
                          placeholder="Ex: Habitação, Investimentos, Cartão..."
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Observação / Origem
                        </label>
                        <input
                          type="text"
                          value={editObservacao}
                          onChange={(e) => setEditObservacao(e.target.value)}
                          placeholder="Anotações para lembrar..."
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Status do Lançamento
                        </label>
                        <button
                          type="button"
                          onClick={() => setEditConcluido((prev) => !prev)}
                          className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                            editConcluido
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                              : 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{editConcluido ? 'Marcado como Concluído' : 'Pendente / No Radar'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-200/60 dark:border-blue-800">
                      <button
                        type="button"
                        onClick={() => setItemEmEdicao(null)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        <span>Salvar Alterações</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Formulário Rápido de Inserção estilo Bloco */}
              <form onSubmit={handleAddItem} className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Ex: MINHA CASA MINHA VIDA, PREVIDENCIA, CARTAO DE CREDITO..."
                      value={novaDescricao}
                      onChange={(e) => setNovaDescricao(e.target.value)}
                      className="w-full pl-3 pr-3 py-2 text-xs font-bold uppercase tracking-wide bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                  </div>

                  {companies.length > 1 && (
                    <div className="w-full sm:w-36 relative">
                      <select
                        value={novaEmpresaId}
                        onChange={(e) => setNovaEmpresaId(Number(e.target.value))}
                        className="w-full px-2.5 py-2 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white truncate"
                        title="Selecione a empresa dona desta anotação"
                      >
                        {companies.map((comp) => (
                          <option key={comp.id} value={comp.id}>
                            {comp.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="w-full sm:w-28 relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">R$</span>
                    <input
                      type="text"
                      placeholder="Valor"
                      value={novoValor}
                      onChange={(e) => setNovoValor(e.target.value)}
                      className="w-full pl-7 pr-2.5 py-2 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                  </div>

                  <div className="w-full sm:w-24 relative">
                    <input
                      type="text"
                      placeholder="Dia/Venc."
                      value={novoVencimento}
                      onChange={(e) => setNovoVencimento(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                      title="Ex: Dia 15 ou 2026-10-15"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setNovoDestaqueVerde((prev) => !prev)}
                      className={`p-2 rounded-xl transition-all cursor-pointer border ${
                        novoDestaqueVerde
                          ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700'
                      }`}
                      title={novoDestaqueVerde ? 'Marca-Texto Verde Ativado' : 'Ativar Marca-Texto Verde'}
                    >
                      <Highlighter className="w-4 h-4" />
                    </button>

                    <button
                      type="submit"
                      disabled={!novaDescricao.trim()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Anotar</span>
                    </button>
                  </div>
                </div>

                {/* Atalhos Rápidos para contas comuns */}
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] pt-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Sugestões rápidas:</span>
                  {quickSuggestions.slice(0, 4).map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setNovaDescricao(sug)}
                      className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800/80 border border-amber-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 transition-colors cursor-pointer font-semibold"
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </form>

              {/* Barra de Filtros da Lista */}
              <div className="flex items-center justify-between gap-2 flex-wrap text-xs pt-1">
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                  <button
                    onClick={() => setFilter('todos')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer shrink-0 ${
                      filter === 'todos'
                        ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    Todas ({companyScopedItens.length})
                  </button>

                  <button
                    onClick={() => setFilter('lembretes')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                      filter === 'lembretes'
                        ? 'bg-amber-600 text-white'
                        : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                    }`}
                    title="Contas com vencimento hoje ou no radar de lembrete"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    Lembretes Ativos ({totalLembretesAtivos})
                  </button>

                  <button
                    onClick={() => setFilter('destacadas')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                      filter === 'destacadas'
                        ? 'bg-emerald-600 text-white'
                        : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                    }`}
                  >
                    <Highlighter className="w-3.5 h-3.5" />
                    Destacadas ({totalDestacadas})
                  </button>

                  <button
                    onClick={() => setFilter('pendentes')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer shrink-0 ${
                      filter === 'pendentes'
                        ? 'bg-amber-600 text-white'
                        : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                    }`}
                  >
                    Pendentes ({companyScopedItens.filter((i) => !i.concluido).length})
                  </button>

                  <button
                    onClick={() => setFilter('concluidas')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer shrink-0 ${
                      filter === 'concluidas'
                        ? 'bg-blue-600 text-white'
                        : 'text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                    }`}
                  >
                    Concluídas ({companyScopedItens.filter((i) => i.concluido).length})
                  </button>
                </div>
              </div>

              {/* Lista de Contas Anotadas */}
              <div className="space-y-2 pt-1">
                {filteredItens.length === 0 ? (
                  <div className="py-12 text-center space-y-2 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <StickyNote className="w-8 h-8 text-amber-500 mx-auto opacity-70" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Nenhuma anotação encontrada neste filtro
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Use a barra acima para anotar contas que você lembrou (ex: MINHA CASA MINHA VIDA, PREVIDENCIA...).
                    </p>
                  </div>
                ) : (
                  filteredItens.map((item) => {
                    const reminderInfo = getNoteReminderStatus(item.dataVencimentoAproximada);
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                          item.concluido
                            ? 'opacity-60 bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                            : item.destaqueVerde
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700/80 shadow-xs'
                            : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/70 shadow-xs'
                        }`}
                      >
                        {/* Checkbox e Descrição */}
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => handleToggleConcluido(item.id)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors cursor-pointer mt-0.5 shrink-0 ${
                              item.concluido
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 dark:border-slate-600 hover:border-emerald-500'
                            }`}
                            title={item.concluido ? 'Desmarcar' : 'Marcar como lembrado/concluído'}
                          >
                            {item.concluido && <Check className="w-4 h-4 stroke-[3]" />}
                          </button>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-xs font-black tracking-wide ${
                                  item.concluido
                                    ? 'line-through text-slate-400'
                                    : item.destaqueVerde
                                    ? 'bg-emerald-200/90 dark:bg-emerald-900/80 text-emerald-950 dark:text-emerald-100 px-2 py-0.5 rounded-md font-black shadow-xs'
                                    : 'text-slate-900 dark:text-white'
                                }`}
                              >
                                {item.descricao}
                              </span>

                              {/* Badge de Empresa Dono */}
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                <Building2 className="w-2.5 h-2.5 text-blue-500" />
                                {getCompanyName(item.empresa_id)}
                              </span>

                              {/* Badge de Alerta Integrado com Lembretes Financeiros */}
                              {reminderInfo && !item.concluido && (
                                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border ${reminderInfo.badgeClass}`}>
                                  <Bell className="w-2.5 h-2.5" />
                                  {reminderInfo.label}
                                </span>
                              )}

                              {item.destaqueVerde && (
                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-300 dark:border-emerald-800 flex items-center gap-0.5">
                                  <Highlighter className="w-2.5 h-2.5" />
                                  Marca-Texto Verde
                                </span>
                              )}

                              {item.lancadoNoSistema && (
                                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/80 px-1.5 py-0.2 rounded border border-blue-300 dark:border-blue-800 flex items-center gap-0.5">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  Lançado no Contas a Pagar
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                              {item.dataVencimentoAproximada && (
                                <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  {item.dataVencimentoAproximada.startsWith('20')
                                    ? new Date(item.dataVencimentoAproximada + 'T00:00:00').toLocaleDateString('pt-BR')
                                    : item.dataVencimentoAproximada.toLowerCase().includes('dia')
                                    ? item.dataVencimentoAproximada
                                    : `Dia ${item.dataVencimentoAproximada}`}
                                </span>
                              )}

                              {item.observacao && (
                                <span className="italic truncate max-w-xs opacity-90">
                                  • {item.observacao}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Valor e Ações */}
                        <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                          {item.valor != null && item.valor > 0 && (
                            <div className="text-right">
                              <span className="text-xs font-extrabold text-slate-900 dark:text-white block">
                                {item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">Previsto</span>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {/* Botão de Editar Lançamento */}
                            <button
                              type="button"
                              onClick={() => {
                                handleStartEdit(item);
                                const el = document.getElementById('notepad-edit-card');
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }}
                              className="px-2.5 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/90 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0"
                              title="Editar este lançamento do bloco de notas"
                            >
                              <Pencil className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              <span>Editar Lançamento</span>
                            </button>

                            {/* Botão de Destaque Verde */}
                            <button
                              type="button"
                              onClick={() => handleToggleDestaqueVerde(item.id)}
                              className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                                item.destaqueVerde
                                  ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                                  : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700 hover:text-emerald-600'
                              }`}
                              title={item.destaqueVerde ? 'Remover destaque verde' : 'Destacar com marca-texto verde'}
                            >
                              <Highlighter className="w-3.5 h-3.5" />
                            </button>

                            {/* Botão de Lançar Conta no Sistema */}
                            {!item.lancadoNoSistema && (
                              <button
                                type="button"
                                onClick={() => {
                                  setItemParaLancamento(item);
                                }}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                                title="Lançar esta conta agora no Contas a Pagar oficial do sistema"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Lançar</span>
                              </button>
                            )}

                            {/* Botão de Excluir */}
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Remover anotação"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            /* Modo Caderno / Anotações Livres */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold flex items-center gap-1.5">
                  <StickyNote className="w-4 h-4 text-amber-500" />
                  <span>Caderno Livre • {empresaFiltroId === 'todas' ? 'Todas as Empresas (Consolidado)' : getCompanyName(Number(empresaFiltroId))}</span>
                </span>
                <span className="text-[11px] font-mono">
                  {currentTextoLivre.length} caracteres
                </span>
              </div>

              <div className="relative rounded-2xl border border-amber-200/80 dark:border-slate-800 bg-amber-50/20 dark:bg-slate-900/60 p-4 shadow-inner">
                <textarea
                  value={currentTextoLivre}
                  onChange={(e) => handleUpdateTextoLivre(e.target.value)}
                  placeholder={`Escreva aqui anotações livres de contas, ideias ou compras futuras para lembrar (${empresaFiltroId === 'todas' ? 'Todas as Empresas' : getCompanyName(Number(empresaFiltroId))})...`}
                  rows={14}
                  className="w-full bg-transparent resize-none outline-none font-mono text-xs leading-relaxed text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(transparent, transparent 23px, rgba(0,0,0,0.04) 24px)',
                    lineHeight: '24px',
                  }}
                />
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Dica: Você pode digitar e manter anotações soltas aqui sem alterar os números nem relatórios da sua contabilidade.
              </p>
            </div>
          )}
        </div>

        {/* Modal de Confirmação para Lançar no Contas a Pagar */}
        {itemParaLancamento && (
          <div className="p-4 sm:p-5 border-t border-blue-200 dark:border-blue-900/80 bg-blue-50/90 dark:bg-slate-850 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs sm:text-sm font-extrabold text-blue-950 dark:text-blue-100">
                  Lançar Conta no Sistema: "{itemParaLancamento.descricao}"
                </h4>
              </div>
              <button
                onClick={() => setItemParaLancamento(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Empresa de Destino
                </label>
                <select
                  value={empresaLancamentoId}
                  onChange={(e) => setEmpresaLancamentoId(Number(e.target.value))}
                  className="w-full p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-white text-xs"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Categoria
                </label>
                <input
                  type="text"
                  value={categoriaLancamento}
                  onChange={(e) => setCategoriaLancamento(e.target.value)}
                  className="w-full p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-semibold text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Valor a Lançar
                </label>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-extrabold text-emerald-600 dark:text-emerald-400 text-xs">
                  {itemParaLancamento.valor
                    ? itemParaLancamento.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    : 'R$ 0,00 (será definido na conta)'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setItemParaLancamento(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={isLaunching}
                onClick={handleConfirmarLancamento}
                className="px-4 py-1.5 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <Check className="w-4 h-4" />
                <span>{isLaunching ? 'Lançando...' : 'Confirmar e Adicionar ao Contas a Pagar'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer do Bloco de Notas */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="text-[11px]">
            As anotações ficam salvas no seu dispositivo e sincronizam com seu backup na nuvem.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white dark:bg-slate-700 dark:hover:bg-slate-600 font-bold transition-colors cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
