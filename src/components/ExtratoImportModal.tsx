import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  CreditCard, 
  Building2, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  HelpCircle,
  Percent,
  Layers,
  Sparkles,
  Download,
  Trash2,
  Check,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';
import { Company, FinancialAccount, AccountType, AccountStatus, DEFAULT_CATEGORIES } from '../types';

interface ExtratoImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  selectedCompanyId: number;
  onImportAccounts: (accounts: Omit<FinancialAccount, 'id'>[]) => void;
}

interface ParsedTransaction {
  id: string;
  selected: boolean;
  tipo: AccountType;
  descricao: string;
  categoria: string;
  valor: number;
  data: string; // YYYY-MM-DD
  status: AccountStatus;
  origem: string;
  documentoRef?: string;
  taxaMdr?: number; // Valor da taxa da maquininha se houver
}

export const ExtratoImportModal: React.FC<ExtratoImportModalProps> = ({
  isOpen,
  onClose,
  companies,
  selectedCompanyId,
  onImportAccounts,
}) => {
  const [importMode, setImportMode] = useState<'bank' | 'card' | 'paste'>('bank');
  const [targetCompanyId, setTargetCompanyId] = useState<number>(
    selectedCompanyId > 0 ? selectedCompanyId : (companies[0]?.id || 1)
  );

  // Card specific options
  const [cardImportOption, setCardImportOption] = useState<'liquido' | 'bruto_taxa'>('liquido');
  const [defaultStatus, setDefaultStatus] = useState<AccountStatus>('Pago');
  
  // Parsed Transactions state
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Heuristic Category Classifier
  const autoCategorize = (desc: string, tipo: AccountType): string => {
    const d = desc.toLowerCase();
    
    if (d.includes('pix rec') || d.includes('venda') || d.includes('cielo') || d.includes('stone') || d.includes('pagseg') || d.includes('mercado p') || d.includes('rede') || d.includes('getnet') || d.includes('debito') || d.includes('credito') || d.includes('fatur')) {
      return tipo === 'receber' ? 'Vendas PDV / Faturamento' : 'Impostos & Taxas';
    }
    if (d.includes('tarifa') || d.includes('taxa') || d.includes('iof') || d.includes('mdr') || d.includes('manut') || d.includes('bancari') || d.includes('encarg')) {
      return 'Impostos & Taxas';
    }
    if (d.includes('aluguel') || d.includes('condomin') || d.includes('iptu') || d.includes('locac')) {
      return 'Aluguel';
    }
    if (d.includes('salario') || d.includes('folha') || d.includes('fgts') || d.includes('inss') || d.includes('adiantamento') || d.includes('vale') || d.includes('pro-labore')) {
      return 'Pessoal & Salários';
    }
    if (d.includes('energia') || d.includes('enel') || d.includes('cpfl') || d.includes('luz') || d.includes('agua') || d.includes('sabesp') || d.includes('internet') || d.includes('telecom') || d.includes('vivo') || d.includes('claro') || d.includes('tim')) {
      return 'Utilidades (Água/Luz/Net)';
    }
    if (d.includes('aws') || d.includes('google') || d.includes('microsoft') || d.includes('software') || d.includes('saas') || d.includes('adobe') || d.includes('chatgpt') || d.includes('github') || d.includes('hospedagem')) {
      return 'Tecnologia & SaaS';
    }
    if (d.includes('forneced') || d.includes('distribuid') || d.includes('compra') || d.includes('materia') || d.includes('mercadoria') || d.includes('embalag')) {
      return 'Estoque & Fornecedores';
    }
    if (d.includes('consult') || d.includes('honorario') || d.includes('contabil') || d.includes('advoc')) {
      return 'Consultoria';
    }
    if (d.includes('marketing') || d.includes('facebk') || d.includes('meta') || d.includes('anuncio') || d.includes('google ads') || d.includes('propaganda')) {
      return 'Marketing & Vendas';
    }

    return tipo === 'receber' ? 'Serviços Prestados' : 'Geral';
  };

  // -------------------------------------------------------------
  // OFX Parser: Extracts STMTTRN, TRNTYPE, DTPOSTED, TRNAMT, MEMO
  // -------------------------------------------------------------
  const parseOfxContent = (ofxString: string, originLabel: string): ParsedTransaction[] => {
    const results: ParsedTransaction[] = [];
    const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;

    const getTagValue = (block: string, tag: string): string => {
      const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
      const m = block.match(regex);
      return m ? m[1].trim() : '';
    };

    let counter = 1;
    while ((match = trnRegex.exec(ofxString)) !== null) {
      const block = match[1];
      const trnType = getTagValue(block, 'TRNTYPE').toUpperCase();
      const rawAmt = getTagValue(block, 'TRNAMT').replace(',', '.');
      const dtPosted = getTagValue(block, 'DTPOSTED');
      const memo = getTagValue(block, 'MEMO') || getTagValue(block, 'NAME') || `Transação OFX #${counter}`;
      const fitId = getTagValue(block, 'FITID') || getTagValue(block, 'CHECKNUM') || `OFX-${Date.now()}-${counter}`;

      const amountVal = parseFloat(rawAmt);
      if (isNaN(amountVal)) continue;

      const isPositive = amountVal > 0 || trnType === 'CREDIT' || trnType === 'DEP';
      const absVal = Math.abs(amountVal);
      const tipo: AccountType = isPositive ? 'receber' : 'pagar';

      // Date parsing from OFX format YYYYMMDD[HHMMSS]
      let dateFormatted = new Date().toISOString().split('T')[0];
      if (dtPosted && dtPosted.length >= 8) {
        const y = dtPosted.substring(0, 4);
        const m = dtPosted.substring(4, 6);
        const d = dtPosted.substring(6, 8);
        dateFormatted = `${y}-${m}-${d}`;
      }

      results.push({
        id: `ofx-${counter}-${Date.now()}`,
        selected: true,
        tipo,
        descricao: memo,
        categoria: autoCategorize(memo, tipo),
        valor: absVal,
        data: dateFormatted,
        status: defaultStatus === 'Pago' ? (tipo === 'pagar' ? 'Pago' : 'Recebido') : 'Pendente',
        origem: originLabel || 'Extrato Bancário OFX',
        documentoRef: fitId,
      });

      counter++;
    }

    // Fallback: If no STMTTRN tags were found, try line-by-line regex
    if (results.length === 0) {
      const lines = ofxString.split(/\r?\n/);
      let curType = '';
      let curAmt = 0;
      let curDate = '';
      let curMemo = '';
      let curFitId = '';

      for (const line of lines) {
        if (line.includes('<TRNTYPE>')) curType = line.replace(/.*<TRNTYPE>/i, '').replace(/<.*/, '').trim();
        if (line.includes('<TRNAMT>')) curAmt = parseFloat(line.replace(/.*<TRNAMT>/i, '').replace(/<.*/, '').replace(',', '.').trim());
        if (line.includes('<DTPOSTED>')) curDate = line.replace(/.*<DTPOSTED>/i, '').replace(/<.*/, '').trim();
        if (line.includes('<MEMO>') || line.includes('<NAME>')) curMemo = line.replace(/.*<(MEMO|NAME)>/i, '').replace(/<.*/, '').trim();
        if (line.includes('<FITID>')) curFitId = line.replace(/.*<FITID>/i, '').replace(/<.*/, '').trim();

        if (line.includes('</STMTTRN>') || (curAmt !== 0 && curMemo)) {
          if (!isNaN(curAmt) && curAmt !== 0) {
            const isPos = curAmt > 0 || curType === 'CREDIT';
            let formattedDate = new Date().toISOString().split('T')[0];
            if (curDate.length >= 8) {
              formattedDate = `${curDate.substring(0, 4)}-${curDate.substring(4, 6)}-${curDate.substring(6, 8)}`;
            }

            const tipo: AccountType = isPos ? 'receber' : 'pagar';
            results.push({
              id: `ofx-line-${results.length + 1}-${Date.now()}`,
              selected: true,
              tipo,
              descricao: curMemo || `Transação #${results.length + 1}`,
              categoria: autoCategorize(curMemo, tipo),
              valor: Math.abs(curAmt),
              data: formattedDate,
              status: defaultStatus === 'Pago' ? (tipo === 'pagar' ? 'Pago' : 'Recebido') : 'Pendente',
              origem: originLabel || 'Extrato Bancário OFX',
              documentoRef: curFitId,
            });
          }
          curType = '';
          curAmt = 0;
          curDate = '';
          curMemo = '';
          curFitId = '';
        }
      }
    }

    return results;
  };

  // -------------------------------------------------------------
  // CSV / TXT Bank Statement & Card Parser
  // -------------------------------------------------------------
  const parseCsvBankOrCard = (content: string, mode: 'bank' | 'card', originLabel: string): ParsedTransaction[] => {
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) return [];

    const delimiter = lines[0].includes(';') ? ';' : (lines[0].includes('\t') ? '\t' : ',');

    const parseLine = (lineStr: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < lineStr.length; i++) {
        const char = lineStr[i];
        if (char === '"' || char === "'") {
          if (inQuotes && lineStr[i + 1] === char) {
            current += char;
            i++;
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

    const header = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    // Find column positions
    let dateIdx = header.findIndex((h) => h.includes('data') || h.includes('dt') || h.includes('venc'));
    let descIdx = header.findIndex((h) => h.includes('desc') || h.includes('histor') || h.includes('memor') || h.includes('memo') || h.includes('detalh') || h.includes('cliente') || h.includes('estabelecimento'));
    let valBrutoIdx = header.findIndex((h) => h.includes('bruto') || h.includes('valorbruto') || h.includes('venda'));
    let valLiqIdx = header.findIndex((h) => h.includes('liq') || h.includes('liquido') || h.includes('repasse'));
    let valGenericIdx = header.findIndex((h) => h.includes('val') || h.includes('quant') || h.includes('montante'));
    let taxaIdx = header.findIndex((h) => h.includes('taxa') || h.includes('mdr') || h.includes('desconto') || h.includes('tarifa'));
    let tipoIdx = header.findIndex((h) => h.includes('tipo') || h.includes('modalidade') || h.includes('operacao') || h.includes('debcred'));
    let docIdx = header.findIndex((h) => h.includes('doc') || h.includes('nsu') || h.includes('autoriz') || h.includes('tid') || h.includes('id'));
    let bandeiraIdx = header.findIndex((h) => h.includes('bandeira') || h.includes('cartao') || h.includes('card'));

    // Fallbacks
    if (dateIdx === -1) dateIdx = 0;
    if (descIdx === -1) descIdx = 1;
    if (valGenericIdx === -1 && valBrutoIdx === -1 && valLiqIdx === -1) valGenericIdx = 2;

    const results: ParsedTransaction[] = [];

    const cleanNum = (str: string): number => {
      if (!str) return 0;
      const cleaned = str.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(,|$))/g, '').replace(',', '.');
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    };

    const formatDate = (dateStr: string): string => {
      if (!dateStr) return new Date().toISOString().split('T')[0];
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const [d, m, y] = parts;
          const cleanYear = y.length === 2 ? `20${y}` : y;
          return `${cleanYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
      }
      if (dateStr.includes('-') && dateStr.length === 10) return dateStr;
      return new Date().toISOString().split('T')[0];
    };

    for (let i = 1; i < lines.length; i++) {
      const row = parseLine(lines[i]);
      if (row.length < 2 || row.every((c) => !c)) continue;

      const rawDate = row[dateIdx] || '';
      const date = formatDate(rawDate);
      const rawDesc = row[descIdx] || `Lançamento ${i}`;
      const rawTipo = tipoIdx !== -1 ? row[tipoIdx].toLowerCase() : '';
      const rawDoc = docIdx !== -1 ? row[docIdx] : undefined;
      const rawBandeira = bandeiraIdx !== -1 ? row[bandeiraIdx] : '';

      if (mode === 'card') {
        // Card Machine Processing
        const valBruto = valBrutoIdx !== -1 ? cleanNum(row[valBrutoIdx]) : 0;
        const valLiq = valLiqIdx !== -1 ? cleanNum(row[valLiqIdx]) : 0;
        const valGen = valGenericIdx !== -1 ? cleanNum(row[valGenericIdx]) : 0;
        const taxa = taxaIdx !== -1 ? cleanNum(row[taxaIdx]) : 0;

        const effectiveValor = valLiq > 0 ? valLiq : (valBruto > 0 ? (valBruto - taxa) : valGen);
        if (effectiveValor <= 0 && valBruto <= 0) continue;

        let fullDesc = rawDesc;
        if (rawBandeira) fullDesc = `Venda ${rawBandeira} - ${rawDesc}`;
        else if (!fullDesc.toLowerCase().includes('cart') && !fullDesc.toLowerCase().includes('venda')) {
          fullDesc = `Venda Cartão / Maquininha - ${fullDesc}`;
        }

        if (cardImportOption === 'bruto_taxa' && valBruto > 0 && taxa > 0) {
          // Lançamento da Receita Bruta
          results.push({
            id: `card-rec-${i}-${Date.now()}`,
            selected: true,
            tipo: 'receber',
            descricao: fullDesc,
            categoria: 'Vendas PDV / Faturamento',
            valor: valBruto,
            data: date,
            status: defaultStatus === 'Pago' ? 'Recebido' : 'Pendente',
            origem: originLabel || 'Máquina de Cartão',
            documentoRef: rawDoc,
          });

          // Lançamento da Taxa de Cartão como despesa
          results.push({
            id: `card-taxa-${i}-${Date.now()}`,
            selected: true,
            tipo: 'pagar',
            descricao: `Taxa MDR / Intermediação - ${fullDesc}`,
            categoria: 'Impostos & Taxas',
            valor: taxa,
            data: date,
            status: defaultStatus === 'Pago' ? 'Pago' : 'Pendente',
            origem: originLabel || 'Máquina de Cartão',
            documentoRef: rawDoc,
          });
        } else {
          // Lançamento Único pelo Valor Líquido
          results.push({
            id: `card-${i}-${Date.now()}`,
            selected: true,
            tipo: 'receber',
            descricao: fullDesc,
            categoria: 'Vendas PDV / Faturamento',
            valor: effectiveValor,
            data: date,
            status: defaultStatus === 'Pago' ? 'Recebido' : 'Pendente',
            origem: originLabel || 'Máquina de Cartão',
            documentoRef: rawDoc,
            taxaMdr: taxa > 0 ? taxa : undefined,
          });
        }

      } else {
        // Standard Bank Statement CSV
        const val = cleanNum(row[valGenericIdx] || row[valLiqIdx] || row[valBrutoIdx] || '0');
        if (val === 0) continue;

        let isPositive = val > 0;
        if (rawTipo.includes('deb') || rawTipo.includes('pag') || rawTipo.includes('sai') || rawTipo.includes('desp')) {
          isPositive = false;
        } else if (rawTipo.includes('cred') || rawTipo.includes('rec') || rawTipo.includes('ent') || rawTipo.includes('dep')) {
          isPositive = true;
        }

        const absVal = Math.abs(val);
        const tipo: AccountType = isPositive ? 'receber' : 'pagar';

        results.push({
          id: `bank-csv-${i}-${Date.now()}`,
          selected: true,
          tipo,
          descricao: rawDesc,
          categoria: autoCategorize(rawDesc, tipo),
          valor: absVal,
          data: date,
          status: defaultStatus === 'Pago' ? (tipo === 'pagar' ? 'Pago' : 'Recebido') : 'Pendente',
          origem: originLabel || 'Extrato Bancário CSV',
          documentoRef: rawDoc,
        });
      }
    }

    return results;
  };

  // -------------------------------------------------------------
  // File Upload Handler
  // -------------------------------------------------------------
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMessage(null);
    setSuccessMessage(null);

    const isOfx = file.name.toLowerCase().endsWith('.ofx') || file.name.toLowerCase().endsWith('.qfx');
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          setErrorMessage('O arquivo está vazio.');
          return;
        }

        let parsed: ParsedTransaction[] = [];
        if (isOfx) {
          parsed = parseOfxContent(text, `Extrato OFX (${file.name})`);
        } else {
          parsed = parseCsvBankOrCard(text, importMode === 'card' ? 'card' : 'bank', file.name);
        }

        if (parsed.length === 0) {
          setErrorMessage('Não foi possível encontrar transações válidas no arquivo. Verifique se o formato é OFX, CSV ou TXT.');
          setTransactions([]);
        } else {
          setTransactions(parsed);
          setSuccessMessage(`${parsed.length} transações identificadas com sucesso no arquivo!`);
        }
      } catch (err: any) {
        setErrorMessage(`Falha ao ler o arquivo: ${err?.message || 'Formato não reconhecido'}`);
      }
    };

    reader.readAsText(file, 'iso-8859-1'); // Handles latin accents commonly exported by BR banks
  };

  // -------------------------------------------------------------
  // Process Pasted Text (Internet Banking copy-paste)
  // -------------------------------------------------------------
  const handleProcessPastedText = () => {
    if (!pastedText.trim()) {
      setErrorMessage('Cole o texto do extrato antes de processar.');
      return;
    }

    setErrorMessage(null);
    const parsed = parseCsvBankOrCard(pastedText, importMode === 'card' ? 'card' : 'bank', 'Extrato Copiado/Colado');
    
    // If simple table parsing failed, try line by line with regex for Brazilian banks
    if (parsed.length === 0) {
      const lines = pastedText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const regexLine = /(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.+?)\s+([+-]?\s*R?\$?\s*[\d.,]+)/i;
      const extracted: ParsedTransaction[] = [];

      lines.forEach((line, idx) => {
        const m = line.match(regexLine);
        if (m) {
          const rawDate = m[1];
          const rawDesc = m[2].trim();
          const rawVal = m[3].replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(,|$))/g, '').replace(',', '.');
          const valNum = parseFloat(rawVal);
          if (!isNaN(valNum) && valNum !== 0) {
            const isPos = valNum > 0 || line.toLowerCase().includes('crédito') || line.toLowerCase().includes('entrada');
            const tipo: AccountType = isPos ? 'receber' : 'pagar';
            
            let dateFormatted = new Date().toISOString().split('T')[0];
            const p = rawDate.split('/');
            if (p.length >= 2) {
              const d = p[0].padStart(2, '0');
              const mon = p[1].padStart(2, '0');
              const y = p.length === 3 ? (p[2].length === 2 ? `20${p[2]}` : p[2]) : new Date().getFullYear().toString();
              dateFormatted = `${y}-${mon}-${d}`;
            }

            extracted.push({
              id: `paste-${idx}-${Date.now()}`,
              selected: true,
              tipo,
              descricao: rawDesc,
              categoria: autoCategorize(rawDesc, tipo),
              valor: Math.abs(valNum),
              data: dateFormatted,
              status: defaultStatus === 'Pago' ? (tipo === 'pagar' ? 'Pago' : 'Recebido') : 'Pendente',
              origem: 'Internet Banking Copiado',
            });
          }
        }
      });

      if (extracted.length > 0) {
        setTransactions(extracted);
        setSuccessMessage(`${extracted.length} transações identificadas no texto copiado!`);
        return;
      }
    }

    if (parsed.length === 0) {
      setErrorMessage('Não foi possível identificar linhas com Data, Descrição e Valor no texto colado.');
    } else {
      setTransactions(parsed);
      setSuccessMessage(`${parsed.length} transações identificadas com sucesso!`);
    }
  };

  // -------------------------------------------------------------
  // Test Sample Templates Generator
  // -------------------------------------------------------------
  const handleLoadSample = (sampleType: 'ofx' | 'card_stone' | 'bank_csv') => {
    setErrorMessage(null);
    if (sampleType === 'ofx') {
      const sampleOfx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>BRL
<BANKTRANLIST>
<DTSTART>20250301000000[-03:EST]
<DTEND>20250331000000[-03:EST]
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20250310120000
<TRNAMT>5400.00
<FITID>20250310001
<MEMO>PIX RECEBIDO - CLIENTE ALFA COMERCIO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250312143000
<TRNAMT>-1250.00
<FITID>20250312002
<MEMO>PAGTO ELETRONICO - ALUGUEL SALA 402
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250315090000
<TRNAMT>-320.50
<FITID>20250315003
<MEMO>ENEL ENERGIA ELETRICA MARCO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20250318160000
<TRNAMT>3800.00
<FITID>20250318004
<MEMO>REPASSE VENDAS MAQUININHA CIELO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250320110000
<TRNAMT>-89.90
<FITID>20250320005
<MEMO>TAR MANUTENCAO CONTA CORRENTE
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;
      const parsed = parseOfxContent(sampleOfx, 'Extrato Amostra OFX');
      setTransactions(parsed);
      setFileName('extrato_bancario_março.ofx');
      setSuccessMessage('Amostra de Extrato Bancário OFX carregada com 5 lançamentos!');
    } else if (sampleType === 'card_stone') {
      const sampleCard = `Data Venda;Bandeira;Modalidade;NSU / Autorização;Valor Bruto;Taxa MDR;Valor Líquido;Data Repasse
10/03/2025;Visa;Crédito à Vista;DOC984512;1500,00;37,50;1462,50;12/03/2025
11/03/2025;Mastercard;Débito;DOC984513;450,00;6,75;443,25;12/03/2025
12/03/2025;Elo;Crédito Parcelado 3x;DOC984514;2800,00;98,00;2702,00;14/03/2025
14/03/2025;Pix Maquininha;Pix PDV;PIX448921;890,00;8,90;881,10;14/03/2025
15/03/2025;Visa;Débito;DOC984515;620,00;9,30;610,70;16/03/2025`;
      const parsed = parseCsvBankOrCard(sampleCard, 'card', 'Relatório Stone / Maquininha');
      setTransactions(parsed);
      setFileName('relatorio_vendas_maquininha.csv');
      setSuccessMessage('Amostra de Extrato de Máquina de Cartão carregada!');
    } else {
      const sampleCsv = `Data;Descrição;Documento;Valor (R$);Tipo
05/03/2025;TED Recebida - Consultoria TI;TED001;7500,00;Crédito
08/03/2025;Folha de Pagamento Salários;DOC889;-6800,00;Débito
12/03/2025;Fornecedor Distribuidora Delta;BOL451;-1850,00;Débito
15/03/2025;Vendas Loja Física;VND102;3200,00;Crédito
22/03/2025;Hospedagem AWS Nuvem;NF992;-450,00;Débito`;
      const parsed = parseCsvBankOrCard(sampleCsv, 'bank', 'Extrato Bancário CSV');
      setTransactions(parsed);
      setFileName('extrato_banco_inter.csv');
      setSuccessMessage('Amostra de Extrato CSV Bancário carregada!');
    }
  };

  // Toggle selection
  const toggleSelect = (id: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const toggleSelectAll = () => {
    const allSelected = transactions.every((t) => t.selected);
    setTransactions((prev) => prev.map((t) => ({ ...t, selected: !allSelected })));
  };

  const updateTransactionCategory = (id: string, newCat: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, categoria: newCat } : t))
    );
  };

  const updateTransactionStatus = (id: string, newStatus: AccountStatus) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
    );
  };

  const removeTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  // -------------------------------------------------------------
  // Final Confirmation & Import
  // -------------------------------------------------------------
  const handleFinalImport = () => {
    const selectedList = transactions.filter((t) => t.selected);
    if (selectedList.length === 0) {
      setErrorMessage('Selecione pelo menos um lançamento para importar.');
      return;
    }

    const payload: Omit<FinancialAccount, 'id'>[] = selectedList.map((t) => ({
      empresa_id: targetCompanyId,
      tipo: t.tipo,
      descricao: t.descricao,
      categoria: t.categoria || 'Geral',
      valor: t.valor,
      data_vencimento: t.data,
      status: t.status,
      banco_origem: t.origem,
      documento_ref: t.documentoRef,
    }));

    onImportAccounts(payload);
    setSuccessMessage(`Sucesso! ${payload.length} lançamentos foram importados para o sistema.`);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  // Selected totals
  const selectedCount = transactions.filter((t) => t.selected).length;
  const totalReceitas = transactions
    .filter((t) => t.selected && t.tipo === 'receber')
    .reduce((sum, t) => sum + t.valor, 0);
  const totalDespesas = transactions
    .filter((t) => t.selected && t.tipo === 'pagar')
    .reduce((sum, t) => sum + t.valor, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Importação Inteligente de Extratos
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200">
                  OFX • CSV • Bancos & Cartões
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Importe extratos mensais de qualquer banco (Itaú, Bradesco, Nubank, Inter...) e relatórios de maquininhas (InfinitePay, Stone, Cielo, PagBank...)
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation & Controls */}
        <div className="p-4 bg-gray-50/70 dark:bg-slate-800/40 border-b border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          
          {/* Tabs */}
          <div className="inline-flex rounded-xl p-1 bg-gray-200/70 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
            <button
              onClick={() => { setImportMode('bank'); setTransactions([]); setFileName(null); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                importMode === 'bank'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Extrato Bancário (OFX / CSV)</span>
            </button>

            <button
              onClick={() => { setImportMode('card'); setTransactions([]); setFileName(null); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                importMode === 'card'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Máquina de Cartão (Stone/Cielo/PagBank)</span>
            </button>

            <button
              onClick={() => { setImportMode('paste'); setTransactions([]); setFileName(null); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                importMode === 'paste'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Copiar & Colar Texto</span>
            </button>
          </div>

          {/* Target Company Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-blue-500" />
              <span>Destino:</span>
            </span>
            <select
              value={targetCompanyId}
              onChange={(e) => setTargetCompanyId(Number(e.target.value))}
              className="text-xs py-1.5 px-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-medium cursor-pointer"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} {c.cnpj ? `(${c.cnpj})` : ''}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Alerts */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Import Setup Stage */}
          {transactions.length === 0 ? (
            <div className="space-y-6 max-w-2xl mx-auto py-4">
              
              {/* Option: Upload File Area */}
              {importMode !== 'paste' ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-gray-50/50 dark:bg-slate-800/30 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ofx,.qfx,.csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    Clique aqui ou arraste o arquivo do extrato
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {importMode === 'bank' 
                      ? 'Formatos suportados: OFX (Extrato Oficial de Bancos), CSV ou TXT'
                      : 'Relatórios de vendas e repasse da Cielo, Stone, PagBank, Rede, Getnet, Mercado Pago (CSV)'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-800 dark:text-gray-200 block">
                    Cole as linhas do seu extrato bancário ou relatório aqui:
                  </label>
                  <textarea
                    rows={6}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder={`Exemplo:\n10/03/2025  PIX RECEBIDO CLIENTE  R$ 1.500,00\n12/03/2025  PAGAMENTO ALUGUEL   -R$ 1.200,00\n15/03/2025  ENERGIA ELETRICA    -R$ 350,00`}
                    className="w-full p-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleProcessPastedText}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Processar Texto Copiado</span>
                  </button>
                </div>
              )}

              {/* Card Machine Specific Options */}
              {importMode === 'card' && (
                <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 space-y-3">
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-blue-600" />
                    Opções de Tratamento de Taxas da Maquininha:
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className="flex items-start gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="cardOption"
                        checked={cardImportOption === 'liquido'}
                        onChange={() => setCardImportOption('liquido')}
                        className="mt-0.5 text-blue-600"
                      />
                      <div>
                        <span className="font-bold text-gray-800 dark:text-gray-200 block">Valor Líquido (Recomendado)</span>
                        <span className="text-[11px] text-gray-500">Importa o valor real recebido na conta bancária após o desconto da taxa MDR.</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="cardOption"
                        checked={cardImportOption === 'bruto_taxa'}
                        onChange={() => setCardImportOption('bruto_taxa')}
                        className="mt-0.5 text-blue-600"
                      />
                      <div>
                        <span className="font-bold text-gray-800 dark:text-gray-200 block">Bruto + Taxa Separada</span>
                        <span className="text-[11px] text-gray-500">Gera a receita bruta e uma conta a pagar correspondente à taxa de intermediação.</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Fast Sample Templates Testing Area */}
              <div className="pt-2 border-t border-gray-200 dark:border-slate-800">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-2">
                  Testar com modelos de exemplo:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleLoadSample('ofx')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Building2 className="w-3.5 h-3.5 text-blue-500" />
                    <span>Amostra OFX Bancário</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadSample('card_stone')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Amostra Maquininha Stone/Cielo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadSample('bank_csv')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Amostra CSV Bancário</span>
                  </button>
                </div>
              </div>

            </div>
          ) : (
            /* Transactions Preview & Editing Stage */
            <div className="space-y-4">
              
              {/* Summary Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs font-bold px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 cursor-pointer"
                  >
                    {transactions.every((t) => t.selected) ? 'Desmarcar Todos' : 'Marcar Todos'}
                  </button>

                  <span className="text-xs text-gray-500 font-medium">
                    {selectedCount} de {transactions.length} selecionados
                  </span>
                </div>

                <div className="flex items-center gap-4 flex-wrap text-xs font-mono">
                  <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold">
                    <ArrowUpCircle className="w-4 h-4" />
                    <span>Entradas: {formatCurrency(totalReceitas)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold">
                    <ArrowDownCircle className="w-4 h-4" />
                    <span>Saídas: {formatCurrency(totalDespesas)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setTransactions([]); setFileName(null); }}
                    className="text-xs text-gray-400 hover:text-rose-500 ml-2 cursor-pointer"
                    title="Limpar e carregar outro arquivo"
                  >
                    Trocar arquivo
                  </button>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-slate-800/80 sticky top-0 z-10 border-b border-gray-100 dark:border-slate-800">
                    <tr>
                      <th className="w-8 px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={transactions.length > 0 && transactions.every((t) => t.selected)}
                          onChange={toggleSelectAll}
                          className="rounded text-blue-600"
                        />
                      </th>
                      <th className="text-left px-3 py-2.5 text-gray-400 uppercase font-semibold">Data</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 uppercase font-semibold">Tipo</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 uppercase font-semibold">Descrição / Origem</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 uppercase font-semibold">Categoria</th>
                      <th className="text-right px-3 py-2.5 text-gray-400 uppercase font-semibold">Valor</th>
                      <th className="text-center px-3 py-2.5 text-gray-400 uppercase font-semibold">Status</th>
                      <th className="w-8 px-2 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {transactions.map((t) => (
                      <tr 
                        key={t.id} 
                        className={`transition-colors ${
                          t.selected ? 'bg-white dark:bg-slate-900 hover:bg-gray-50/80 dark:hover:bg-slate-800/40' : 'bg-gray-50/50 dark:bg-slate-950/30 opacity-50'
                        }`}
                      >
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={t.selected}
                            onChange={() => toggleSelect(t.id)}
                            className="rounded text-blue-600"
                          />
                        </td>

                        <td className="px-3 py-2 font-mono whitespace-nowrap text-gray-600 dark:text-gray-400">
                          {t.data}
                        </td>

                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.tipo === 'receber'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}>
                            {t.tipo === 'receber' ? 'RECEBER' : 'PAGAR'}
                          </span>
                        </td>

                        <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                          <div className="font-semibold">{t.descricao}</div>
                          {t.origem && (
                            <div className="text-[10px] text-gray-400 font-mono">
                              {t.origem} {t.documentoRef ? `• Doc: ${t.documentoRef}` : ''}
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-2">
                          <select
                            value={t.categoria}
                            onChange={(e) => updateTransactionCategory(t.id, e.target.value)}
                            className="py-1 px-1.5 text-xs rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 max-w-[140px] truncate"
                          >
                            {DEFAULT_CATEGORIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>

                        <td className={`px-3 py-2 text-right font-mono font-bold whitespace-nowrap ${
                          t.tipo === 'receber' ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {formatCurrency(t.valor)}
                        </td>

                        <td className="px-3 py-2 text-center">
                          <select
                            value={t.status}
                            onChange={(e) => updateTransactionStatus(t.id, e.target.value as AccountStatus)}
                            className="py-1 px-1.5 text-[11px] rounded font-semibold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200"
                          >
                            <option value="Pago">Pago / Liquidado</option>
                            <option value="Recebido">Recebido / Liquidado</option>
                            <option value="Pendente">Pendente</option>
                          </select>
                        </td>

                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeTransaction(t.id)}
                            className="p-1 text-gray-400 hover:text-rose-500 rounded cursor-pointer"
                            title="Remover este item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          {transactions.length > 0 && (
            <button
              onClick={handleFinalImport}
              disabled={selectedCount === 0}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Importar {selectedCount} Lançamentos Selecionados</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
