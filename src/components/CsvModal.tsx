import React, { useState, useRef } from 'react';
import { 
  X, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Building2,
  Table as TableIcon,
  HelpCircle
} from 'lucide-react';
import { Company, FinancialAccount, AccountType, AccountStatus, DEFAULT_CATEGORIES } from '../types';

interface CsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  selectedCompanyId: number;
  accounts: FinancialAccount[];
  onImportAccounts: (newAccounts: Omit<FinancialAccount, 'id'>[]) => void;
  initialTab?: 'export' | 'import';
}

export const CsvModal: React.FC<CsvModalProps> = ({
  isOpen,
  onClose,
  companies,
  selectedCompanyId,
  accounts,
  onImportAccounts,
  initialTab = 'export',
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialTab);

  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
  
  // Export states
  const [exportCompanyId, setExportCompanyId] = useState<number>(selectedCompanyId);
  const [exportType, setExportType] = useState<string>('all');
  const [exportStatus, setExportStatus] = useState<string>('all');
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // Import states
  const [importTargetCompanyId, setImportTargetCompanyId] = useState<number>(
    selectedCompanyId > 0 ? selectedCompanyId : (companies[0]?.id || 1)
  );
  const [parsedRows, setParsedRows] = useState<Omit<FinancialAccount, 'id'>[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // ----------------------------------------------------
  // EXPORT FUNCTIONALITY (UTF-8 BOM for Excel)
  // ----------------------------------------------------
  const handleExportCsv = () => {
    let listToExport = accounts;

    if (exportCompanyId > 0) {
      listToExport = listToExport.filter((a) => Number(a.empresa_id) === Number(exportCompanyId));
    }

    if (exportType !== 'all') {
      listToExport = listToExport.filter((a) => a.tipo === exportType);
    }

    if (exportStatus !== 'all') {
      listToExport = listToExport.filter((a) => a.status === exportStatus);
    }

    if (listToExport.length === 0) {
      alert('Nenhum lançamento encontrado com os filtros selecionados para exportar.');
      return;
    }

    // CSV Header with semicolon (standard for Portuguese Excel)
    const headers = [
      'ID',
      'Tipo',
      'Empresa',
      'Descrição',
      'Categoria',
      'Valor (R$)',
      'Data Vencimento',
      'Status'
    ];

    const rows = listToExport.map((acc) => {
      const comp = companies.find((c) => Number(c.id) === Number(acc.empresa_id));
      const companyName = comp ? comp.nome : `Empresa #${acc.empresa_id}`;
      const tipoFormatado = acc.tipo === 'pagar' ? 'Pagar' : 'Receber';
      const valorFormatado = acc.valor.toFixed(2).replace('.', ',');
      const categoriaFormatada = acc.categoria || 'Geral';
      
      // Escape strings containing semicolon or quotes
      const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;

      return [
        acc.id,
        escapeCsv(tipoFormatado),
        escapeCsv(companyName),
        escapeCsv(acc.descricao),
        escapeCsv(categoriaFormatada),
        valorFormatado,
        acc.data_vencimento,
        escapeCsv(acc.status)
      ].join(';');
    });

    // UTF-8 BOM (\uFEFF) ensures Excel opens accents correctly
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const targetComp = companies.find((c) => c.id === exportCompanyId);
    const namePrefix = targetComp ? targetComp.nome.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'todas_empresas';
    const dateStr = new Date().toISOString().split('T')[0];
    
    link.href = url;
    link.setAttribute('download', `lancamentos_${namePrefix}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportSuccessMessage(`Exportado com sucesso! ${listToExport.length} lançamentos gravados em CSV.`);
    setTimeout(() => setExportSuccessMessage(null), 4000);
  };

  // Download Sample Template CSV
  const handleDownloadTemplate = () => {
    const headers = [
      'Tipo (Pagar ou Receber)',
      'Descrição',
      'Categoria',
      'Valor (R$)',
      'Data Vencimento (AAAA-MM-DD)',
      'Status (Pendente, Pago ou Recebido)'
    ];

    const sampleRows = [
      ['Pagar', 'Aluguel do Escritório Central', 'Aluguel', '2500,00', '2025-03-10', 'Pendente'],
      ['Pagar', 'Serviços de Nuvem AWS', 'Tecnologia & SaaS', '450,80', '2025-03-15', 'Pago'],
      ['Receber', 'Consultoria Empresarial TI', 'Serviços Prestados', '6800,00', '2025-03-20', 'Pendente'],
      ['Receber', 'Venda de Licenças de Software', 'Vendas PDV / Faturamento', '3200,00', '2025-03-25', 'Recebido'],
      ['Pagar', 'Folha de Pagamento Equipe', 'Pessoal & Salários', '8900,00', '2025-03-05', 'Pago']
    ];

    const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
    const rows = sampleRows.map((r) => r.map(escapeCsv).join(';'));
    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(';'), ...rows].join('\r\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_importacao_financeiro.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ----------------------------------------------------
  // IMPORT FUNCTIONALITY
  // ----------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    parseCsvFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setFileName(file.name);
    parseCsvFile(file);
  };

  const parseCsvFile = (file: File) => {
    setImportErrors([]);
    setParsedRows([]);
    setImportSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          setImportErrors(['Arquivo vazio ou não pôde ser lido.']);
          return;
        }

        const lines = text.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
        if (lines.length <= 1) {
          setImportErrors(['O arquivo deve conter cabeçalho e pelo menos uma linha de dados.']);
          return;
        }

        // Detect delimiter (semicolon or comma)
        const firstLine = lines[0];
        const delimiter = firstLine.includes(';') ? ';' : ',';

        // Parse line taking into account quotes
        const parseLine = (lineStr: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < lineStr.length; i++) {
            const char = lineStr[i];
            if (char === '"' || char === "'") {
              if (inQuotes && lineStr[i + 1] === char) {
                current += char;
                i++; // skip escaped quote
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === delimiter && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
        
        // Find column indices
        let tipoIdx = headers.findIndex((h) => h.includes('tipo'));
        let descIdx = headers.findIndex((h) => h.includes('desc'));
        let catIdx = headers.findIndex((h) => h.includes('cat'));
        let valIdx = headers.findIndex((h) => h.includes('val') || h.includes('quant'));
        let dataIdx = headers.findIndex((h) => h.includes('venc') || h.includes('data'));
        let statusIdx = headers.findIndex((h) => h.includes('stat'));
        let empresaIdx = headers.findIndex((h) => h.includes('emp'));

        // Fallbacks if header naming is standard order
        if (tipoIdx === -1) tipoIdx = 0;
        if (descIdx === -1) descIdx = 1;
        if (catIdx === -1 && headers.length > 5) catIdx = 2;
        if (valIdx === -1) valIdx = catIdx !== -1 ? 3 : 2;
        if (dataIdx === -1) dataIdx = catIdx !== -1 ? 4 : 3;
        if (statusIdx === -1) statusIdx = catIdx !== -1 ? 5 : 4;

        const newRows: Omit<FinancialAccount, 'id'>[] = [];
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const rawRow = parseLine(lines[i]);
          if (rawRow.length < 3 || rawRow.every((c) => !c)) continue; // ignore empty rows

          const rowNum = i + 1;
          const rawTipo = (rawRow[tipoIdx] || '').toLowerCase();
          let tipo: AccountType = 'pagar';
          if (rawTipo.includes('rec') || rawTipo.includes('entr') || rawTipo.includes('cred')) {
            tipo = 'receber';
          } else if (rawTipo.includes('pag') || rawTipo.includes('desp') || rawTipo.includes('deb')) {
            tipo = 'pagar';
          }

          const rawDesc = rawRow[descIdx] || `Lançamento linha ${rowNum}`;
          const rawCat = catIdx !== -1 && rawRow[catIdx] ? rawRow[catIdx] : 'Geral';
          
          // Parse valor: handle "R$ 1.250,50" -> 1250.50 or "1250.50"
          const rawValStr = (rawRow[valIdx] || '0')
            .replace(/[^\d,.-]/g, '')
            .replace(/\.(?=\d{3}(,|$))/g, '') // remove thousands dot
            .replace(',', '.'); // replace decimal comma
          const valor = parseFloat(rawValStr);

          if (isNaN(valor) || valor <= 0) {
            errors.push(`Linha ${rowNum}: Valor inválido "${rawRow[valIdx]}".`);
            continue;
          }

          // Parse data
          let dataVencimento = rawRow[dataIdx] || new Date().toISOString().split('T')[0];
          // If format is DD/MM/YYYY convert to YYYY-MM-DD
          if (dataVencimento.includes('/')) {
            const parts = dataVencimento.split('/');
            if (parts.length === 3) {
              const [d, m, y] = parts;
              dataVencimento = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
          }

          // Parse status
          const rawStatus = (rawRow[statusIdx] || '').toLowerCase();
          let status: AccountStatus = 'Pendente';
          if (rawStatus.includes('pag') || rawStatus.includes('rec') || rawStatus.includes('conc') || rawStatus.includes('baix')) {
            status = tipo === 'pagar' ? 'Pago' : 'Recebido';
          }

          // Resolve empresa_id
          let targetEmpresaId = importTargetCompanyId;
          if (empresaIdx !== -1 && rawRow[empresaIdx]) {
            const empName = rawRow[empresaIdx].toLowerCase();
            const matchedComp = companies.find((c) => c.nome.toLowerCase() === empName || c.nome.toLowerCase().includes(empName));
            if (matchedComp) targetEmpresaId = matchedComp.id;
          }

          newRows.push({
            empresa_id: targetEmpresaId,
            tipo,
            descricao: rawDesc,
            categoria: rawCat,
            valor,
            data_vencimento: dataVencimento,
            status,
          });
        }

        if (errors.length > 0) {
          setImportErrors(errors);
        }

        setParsedRows(newRows);
      } catch (err: any) {
        setImportErrors([`Erro ao processar arquivo: ${err?.message || 'Formato incompatível'}`]);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;
    onImportAccounts(parsedRows);
    setImportSuccessMessage(`Sucesso! ${parsedRows.length} lançamentos foram importados.`);
    setParsedRows([]);
    setFileName(null);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Importar e Exportar Lançamentos (Excel / CSV)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Integração compatível com Microsoft Excel, LibreOffice e sistemas de gestão
              </p>
            </div>
          </div>

          <button
            id="btn-close-csv-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 pt-4 border-b border-gray-100 dark:border-slate-800 flex gap-4 shrink-0">
          <button
            id="tab-btn-export-csv"
            onClick={() => setActiveTab('export')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'export'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Exportar para Excel / CSV</span>
          </button>

          <button
            id="tab-btn-import-csv"
            onClick={() => setActiveTab('import')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'import'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Importar Planilha CSV</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* ======================= TAB 1: EXPORT ======================= */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              
              {exportSuccessMessage && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{exportSuccessMessage}</span>
                </div>
              )}

              <div className="bg-gray-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-4">
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                  Filtros de Exportação
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-1">
                      Empresa
                    </label>
                    <select
                      id="export-company-select"
                      value={exportCompanyId}
                      onChange={(e) => setExportCompanyId(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                    >
                      <option value="-1">🌐 Todas as Empresas (Consolidado)</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-1">
                      Tipo de Lançamento
                    </label>
                    <select
                      id="export-type-select"
                      value={exportType}
                      onChange={(e) => setExportType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                    >
                      <option value="all">Todos (Pagar e Receber)</option>
                      <option value="pagar">Somente Contas a Pagar</option>
                      <option value="receber">Somente Contas a Receber</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-1">
                      Status
                    </label>
                    <select
                      id="export-status-select"
                      value={exportStatus}
                      onChange={(e) => setExportStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                    >
                      <option value="all">Todos os Status</option>
                      <option value="Pendente">Apenas Pendentes</option>
                      <option value="Pago">Apenas Pagos</option>
                      <option value="Recebido">Apenas Recebidos</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Exporta com codificação <strong>UTF-8 com BOM</strong> (acentos perfeitos no Excel)</span>
                  </div>

                  <button
                    id="btn-trigger-export-csv"
                    onClick={handleExportCsv}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar Arquivo CSV (.csv)</span>
                  </button>
                </div>
              </div>

              {/* Informações das Colunas Exportadas */}
              <div className="border border-gray-100 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900">
                <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                  <TableIcon className="w-4 h-4 text-blue-500" />
                  <span>Estrutura do Arquivo Gerado</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-gray-600 dark:text-gray-400">
                  <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded">1. ID</div>
                  <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded">2. Tipo (Pagar/Receber)</div>
                  <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded">3. Empresa</div>
                  <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded">4. Descrição</div>
                  <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded text-indigo-600 dark:text-indigo-400 font-bold">5. Categoria</div>
                  <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded">6. Valor (R$)</div>
                  <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded">7. Vencimento</div>
                  <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded">8. Status</div>
                </div>
              </div>

            </div>
          )}

          {/* ======================= TAB 2: IMPORT ======================= */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              
              {importSuccessMessage && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{importSuccessMessage}</span>
                </div>
              )}

              {/* Template Download Banner */}
              <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/40 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-xs">
                      Precisa de um modelo pronto para preencher?
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Baixe o modelo CSV com cabeçalhos e exemplos de receitas e despesas
                    </p>
                  </div>
                </div>

                <button
                  id="btn-download-csv-template"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 font-bold rounded-lg border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Modelo CSV</span>
                </button>
              </div>

              {/* Target Company Select */}
              <div className="flex items-center gap-3">
                <label className="font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  Vincular lançamentos à Empresa:
                </label>
                <select
                  id="import-target-company-select"
                  value={importTargetCompanyId}
                  onChange={(e) => setImportTargetCompanyId(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              {/* Drag and drop upload zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-gray-50/50 dark:bg-slate-800/30 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">
                  {fileName ? fileName : 'Clique ou arraste seu arquivo .CSV aqui'}
                </p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Suporta arquivos .csv exportados do Excel ou outros ERPs (delimitador ponto-e-vírgula ou vírgula)
                </p>
              </div>

              {/* Errors Display */}
              {importErrors.length > 0 && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Avisos na Leitura do Arquivo:</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] space-y-0.5 max-h-32 overflow-y-auto">
                    {importErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview Table if rows parsed */}
              {parsedRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-xs">
                      <span>Pré-visualização dos Lançamentos</span>
                      <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                        {parsedRows.length} registros prontos para importar
                      </span>
                    </h4>
                  </div>

                  <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-gray-100 dark:bg-slate-800 font-bold text-gray-600 dark:text-gray-300 sticky top-0 border-b border-gray-200 dark:border-slate-700">
                        <tr>
                          <th className="py-2 px-3">Tipo</th>
                          <th className="py-2 px-3">Descrição</th>
                          <th className="py-2 px-3">Categoria</th>
                          <th className="py-2 px-3 text-right">Valor</th>
                          <th className="py-2 px-3 text-center">Vencimento</th>
                          <th className="py-2 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-mono">
                        {parsedRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                            <td className="py-1.5 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                row.tipo === 'pagar' 
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                              }`}>
                                {row.tipo === 'pagar' ? 'Pagar' : 'Receber'}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 font-sans font-medium text-gray-900 dark:text-white">
                              {row.descricao}
                            </td>
                            <td className="py-1.5 px-3 font-sans text-gray-500 dark:text-gray-400">
                              {row.categoria || 'Geral'}
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold">
                              {formatCurrency(row.valor)}
                            </td>
                            <td className="py-1.5 px-3 text-center text-gray-500">
                              {row.data_vencimento}
                            </td>
                            <td className="py-1.5 px-3 text-center">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300">
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-2 flex justify-end gap-3">
                    <button
                      id="btn-cancel-import-preview"
                      onClick={() => {
                        setParsedRows([]);
                        setFileName(null);
                      }}
                      className="px-3.5 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 font-bold transition-colors cursor-pointer"
                    >
                      Limpar
                    </button>
                    <button
                      id="btn-confirm-import-csv"
                      onClick={handleConfirmImport}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar Importação de {parsedRows.length} Itens</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-gray-50/50 dark:bg-slate-800/40 border-t border-gray-100 dark:border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
