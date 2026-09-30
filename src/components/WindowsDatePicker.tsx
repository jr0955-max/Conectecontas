import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  RotateCcw
} from 'lucide-react';
import { parseNoteDate, formatNoteDueDate } from '../utils/reminderService';

interface WindowsDatePickerProps {
  value: string;
  onChange: (dateStr: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  id?: string;
  title?: string;
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export const WindowsDatePicker: React.FC<WindowsDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'DD/MM/AAAA ou Dia...',
  className = '',
  inputClassName = '',
  id,
  title = 'Clique para abrir o calendário estilo Windows'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Inicializa o mês e ano visualizados com base no valor atual ou na data de hoje
  const initialDate = parseNoteDate(value) || new Date();
  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth());

  // Atualiza mês/ano de visualização quando o valor externo mudar
  useEffect(() => {
    const parsed = parseNoteDate(value);
    if (parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
  }, [value]);

  // Fechar ao clicar fora ou pressionar Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Montagem da grade de dias estilo Windows
  const now = new Date();
  const todayDay = now.getDate();
  const todayMonth = now.getMonth();
  const todayYear = now.getFullYear();

  const selectedParsed = parseNoteDate(value);
  const selectedDay = selectedParsed ? selectedParsed.getDate() : null;
  const selectedMonth = selectedParsed ? selectedParsed.getMonth() : null;
  const selectedYear = selectedParsed ? selectedParsed.getFullYear() : null;

  // Primeiro dia do mês (0 = Domingo, 1 = Segunda, ...)
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  // Quantidade de dias no mês atual
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // Quantidade de dias no mês anterior
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Dias a exibir: 42 células (6 linhas de 7 colunas)
  interface CalendarCell {
    day: number;
    month: number;
    year: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
  }

  const cells: CalendarCell[] = [];

  // Dias do mês anterior
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({
      day: d,
      month: m,
      year: y,
      isCurrentMonth: false,
      isToday: d === todayDay && m === todayMonth && y === todayYear,
      isSelected: d === selectedDay && m === selectedMonth && y === selectedYear,
    });
  }

  // Dias do mês atual
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    cells.push({
      day: d,
      month: viewMonth,
      year: viewYear,
      isCurrentMonth: true,
      isToday: d === todayDay && viewMonth === todayMonth && viewYear === todayYear,
      isSelected: d === selectedDay && viewMonth === selectedMonth && viewYear === selectedYear,
    });
  }

  // Dias do próximo mês para completar 35 ou 42 células
  const targetTotal = cells.length > 35 ? 42 : 35;
  const remaining = targetTotal - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({
      day: d,
      month: m,
      year: y,
      isCurrentMonth: false,
      isToday: d === todayDay && m === todayMonth && y === todayYear,
      isSelected: d === selectedDay && m === selectedMonth && y === selectedYear,
    });
  }

  const selectDate = (year: number, month: number, day: number) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    // Salva no formato DD/MM/AAAA (padrão brasileiro e solicitado pelo usuário)
    const formatted = `${pad(day)}/${pad(month + 1)}/${year}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const selectPreset = (type: 'hoje' | 'amanha' | 'dia10' | 'dia15' | 'dia20' | 'dia25') => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const curr = new Date();
    if (type === 'hoje') {
      selectDate(curr.getFullYear(), curr.getMonth(), curr.getDate());
    } else if (type === 'amanha') {
      const amanha = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate() + 1);
      selectDate(amanha.getFullYear(), amanha.getMonth(), amanha.getDate());
    } else if (type === 'dia10') {
      const targetMonth = curr.getDate() > 10 ? curr.getMonth() + 1 : curr.getMonth();
      const targetYear = targetMonth > 11 ? curr.getFullYear() + 1 : curr.getFullYear();
      const effMonth = targetMonth > 11 ? 0 : targetMonth;
      selectDate(targetYear, effMonth, 10);
    } else if (type === 'dia15') {
      const targetMonth = curr.getDate() > 15 ? curr.getMonth() + 1 : curr.getMonth();
      const targetYear = targetMonth > 11 ? curr.getFullYear() + 1 : curr.getFullYear();
      const effMonth = targetMonth > 11 ? 0 : targetMonth;
      selectDate(targetYear, effMonth, 15);
    } else if (type === 'dia20') {
      const targetMonth = curr.getDate() > 20 ? curr.getMonth() + 1 : curr.getMonth();
      const targetYear = targetMonth > 11 ? curr.getFullYear() + 1 : curr.getFullYear();
      const effMonth = targetMonth > 11 ? 0 : targetMonth;
      selectDate(targetYear, effMonth, 20);
    } else if (type === 'dia25') {
      const targetMonth = curr.getDate() > 25 ? curr.getMonth() + 1 : curr.getMonth();
      const targetYear = targetMonth > 11 ? curr.getFullYear() + 1 : curr.getFullYear();
      const effMonth = targetMonth > 11 ? 0 : targetMonth;
      selectDate(targetYear, effMonth, 25);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  const displayFormatted = formatNoteDueDate(value);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Campo de Input com Botão de Calendário */}
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={() => setIsOpen(true)}
          placeholder={placeholder}
          title={title}
          className={`w-full pl-3 pr-8 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400 font-medium ${inputClassName}`}
        />

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="absolute right-2 p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          title="Abrir calendário do Windows"
        >
          <CalendarIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Janela Popover do Calendário Estilo Windows */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 z-50 w-72 sm:w-80 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl shadow-slate-900/20 dark:shadow-black/60 animate-in fade-in zoom-in-95 backdrop-blur-md select-none"
        >
          {/* Cabeçalho do Windows Calendar: Mês, Ano e Navegação */}
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                {MESES[viewMonth]} {viewYear}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Mês anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Próximo mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Dias da Semana (D, S, T, Q, Q, S, S) */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
            {DIAS_SEMANA.map((dia, idx) => (
              <span
                key={idx}
                className={`text-[11px] font-bold ${
                  idx === 0 || idx === 6
                    ? 'text-rose-500 dark:text-rose-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {dia}
              </span>
            ))}
          </div>

          {/* Grade de 35 a 42 Dias */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {cells.map((cell, idx) => {
              const isSelected = cell.isSelected;
              const isToday = cell.isToday;
              const isCurrentMonth = cell.isCurrentMonth;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectDate(cell.year, cell.month, cell.day)}
                  className={`h-8 w-8 sm:h-9 sm:w-9 mx-auto rounded-xl text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 dark:bg-blue-500 text-white font-extrabold shadow-sm'
                      : isToday
                      ? 'border-2 border-blue-500 text-blue-600 dark:text-blue-400 font-extrabold hover:bg-blue-50 dark:hover:bg-blue-950/40'
                      : isCurrentMonth
                      ? 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      : 'text-slate-300 dark:text-slate-600 hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                  }`}
                  title={`${cell.day}/${cell.month + 1}/${cell.year}`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Atalhos Rápidos */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1.5 uppercase tracking-wider">
              Atalhos rápidos
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => selectPreset('hoje')}
                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 cursor-pointer"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => selectPreset('amanha')}
                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Amanhã
              </button>
              <button
                type="button"
                onClick={() => selectPreset('dia10')}
                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Dia 10
              </button>
              <button
                type="button"
                onClick={() => selectPreset('dia15')}
                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Dia 15
              </button>
              <button
                type="button"
                onClick={() => selectPreset('dia20')}
                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Dia 20
              </button>
              <button
                type="button"
                onClick={() => selectPreset('dia25')}
                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Dia 25
              </button>
            </div>
          </div>

          {/* Rodapé Estilo Windows: Data de Hoje e Ações */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => selectPreset('hoje')}
              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              title="Ir para a data de hoje"
            >
              <Clock className="w-3 h-3" />
              <span>Hoje: {todayDay} de {MESES[todayMonth].toLowerCase()}</span>
            </button>

            <div className="flex items-center gap-1.5">
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Limpar
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2 py-1 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
