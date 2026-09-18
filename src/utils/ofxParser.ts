import { OFXStatement, OFXTransaction } from '../types';

/**
 * Parses standard OFX (Open Financial Exchange 1.x and 2.x) files into structured statements and transactions.
 * Handles Brazilian bank nuances (Itaú, Bradesco, Santander, Nubank, Caixa, Banco do Brasil, Inter, Sicoob, etc.).
 */
export function parseOFX(ofxContent: string): OFXStatement {
  const transactions: OFXTransaction[] = [];
  let banco_nome = 'Banco Importado';
  let agencia = '';
  let numero_conta = '';
  let tipo_conta = 'CHECKING';
  let data_inicio = '';
  let data_fim = '';
  let saldo_final: number | undefined = undefined;

  // 1. Detect Bank ID / Org
  const fiOrgMatch = ofxContent.match(/<ORG>(.*?)(?:<\/?ORG>|\r?\n)/i);
  const fiIdMatch = ofxContent.match(/<FID>(.*?)(?:<\/?FID>|\r?\n)/i);
  const bankIdMatch = ofxContent.match(/<BANKID>(.*?)(?:<\/?BANKID>|\r?\n)/i);

  if (fiOrgMatch && fiOrgMatch[1]) {
    banco_nome = fiOrgMatch[1].trim();
  } else if (bankIdMatch && bankIdMatch[1]) {
    const bankCode = bankIdMatch[1].trim();
    if (bankCode === '341' || bankCode === '0341') banco_nome = 'Banco Itaú';
    else if (bankCode === '237' || bankCode === '0237') banco_nome = 'Banco Bradesco';
    else if (bankCode === '033' || bankCode === '0033') banco_nome = 'Banco Santander';
    else if (bankCode === '001' || bankCode === '0001') banco_nome = 'Banco do Brasil';
    else if (bankCode === '104' || bankCode === '0104') banco_nome = 'Caixa Econômica';
    else if (bankCode === '260' || bankCode === '0260') banco_nome = 'Nubank';
    else if (bankCode === '077' || bankCode === '0077') banco_nome = 'Banco Inter';
    else if (bankCode === '197' || bankCode === '0197') banco_nome = 'Banco Stone';
    else if (bankCode === '384' || bankCode === '0384' || bankCode === '451') banco_nome = 'InfinitePay';
    else banco_nome = `Banco (Cód ${bankCode})`;
  }

  // 2. Detect Account info
  const branchMatch = ofxContent.match(/<BRANCHID>(.*?)(?:<\/?BRANCHID>|\r?\n)/i);
  if (branchMatch && branchMatch[1]) agencia = branchMatch[1].trim();

  const acctMatch = ofxContent.match(/<ACCTID>(.*?)(?:<\/?ACCTID>|\r?\n)/i);
  if (acctMatch && acctMatch[1]) numero_conta = acctMatch[1].trim();

  const acctTypeMatch = ofxContent.match(/<ACCTTYPE>(.*?)(?:<\/?ACCTTYPE>|\r?\n)/i);
  if (acctTypeMatch && acctTypeMatch[1]) tipo_conta = acctTypeMatch[1].trim();

  // 3. Detect Date range and Ledger Balance
  const dtStartMatch = ofxContent.match(/<DTSTART>(.*?)(?:<\/?DTSTART>|\r?\n)/i);
  if (dtStartMatch && dtStartMatch[1]) data_inicio = parseOFXDate(dtStartMatch[1].trim());

  const dtEndMatch = ofxContent.match(/<DTEND>(.*?)(?:<\/?DTEND>|\r?\n)/i);
  if (dtEndMatch && dtEndMatch[1]) data_fim = parseOFXDate(dtEndMatch[1].trim());

  const balAmtMatch = ofxContent.match(/<BALAMT>(.*?)(?:<\/?BALAMT>|\r?\n)/i);
  if (balAmtMatch && balAmtMatch[1]) {
    const rawBal = balAmtMatch[1].trim().replace(',', '.');
    saldo_final = parseFloat(rawBal);
  }

  // 4. Parse STMTTRN blocks
  // Regex to extract all <STMTTRN>...</STMTTRN> or unclosed <STMTTRN> blocks
  const trnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|$)/gi;
  let match;
  let counter = 1;

  while ((match = trnRegex.exec(ofxContent)) !== null) {
    const block = match[1];
    if (!block || block.trim().length === 0) continue;

    // TRNTYPE
    const typeMatch = block.match(/<TRNTYPE>(.*?)(?:<\/?TRNTYPE>|\r?\n)/i);
    const rawType = (typeMatch && typeMatch[1] ? typeMatch[1].trim().toUpperCase() : 'OTHER');
    
    // TRNAMT
    const amtMatch = block.match(/<TRNAMT>(.*?)(?:<\/?TRNAMT>|\r?\n)/i);
    let valor = 0;
    if (amtMatch && amtMatch[1]) {
      const cleanAmt = amtMatch[1].trim().replace(',', '.');
      valor = parseFloat(cleanAmt) || 0;
    }

    // Determine Credit or Debit
    let tipo: 'DEBIT' | 'CREDIT' | 'OTHER' = 'OTHER';
    if (valor < 0 || rawType === 'DEBIT') {
      tipo = 'DEBIT';
    } else if (valor > 0 || rawType === 'CREDIT') {
      tipo = 'CREDIT';
    }

    // DTPOSTED
    const dtMatch = block.match(/<DTPOSTED>(.*?)(?:<\/?DTPOSTED>|\r?\n)/i);
    const dateStr = dtMatch && dtMatch[1] ? parseOFXDate(dtMatch[1].trim()) : new Date().toISOString().split('T')[0];

    // FITID (Unique Transaction ID)
    const fitidMatch = block.match(/<FITID>(.*?)(?:<\/?FITID>|\r?\n)/i);
    const fitid = fitidMatch && fitidMatch[1] ? fitidMatch[1].trim() : `ofx_${dateStr}_${counter}_${Math.abs(valor)}`;

    // MEMO or NAME
    const memoMatch = block.match(/<MEMO>(.*?)(?:<\/?MEMO>|\r?\n)/i);
    const nameMatch = block.match(/<NAME>(.*?)(?:<\/?NAME>|\r?\n)/i);
    
    let memo = '';
    if (memoMatch && memoMatch[1]) memo = cleanOFXText(memoMatch[1].trim());
    else if (nameMatch && nameMatch[1]) memo = cleanOFXText(nameMatch[1].trim());
    else memo = tipo === 'CREDIT' ? 'Entrada / Depósito' : 'Pagamento / Despesa';

    // CHECKNUM / REFNUM
    const checkMatch = block.match(/<CHECKNUM>(.*?)(?:<\/?CHECKNUM>|\r?\n)/i);
    const refMatch = block.match(/<REFNUM>(.*?)(?:<\/?REFNUM>|\r?\n)/i);

    transactions.push({
      id: `trn_${fitid || counter}`,
      fitid,
      tipo,
      valor: Math.abs(valor), // Store positive magnitude, signed check via `tipo`
      data: dateStr,
      memo,
      checknum: checkMatch ? checkMatch[1].trim() : undefined,
      refnum: refMatch ? refMatch[1].trim() : undefined,
      banco_nome,
      conta_numero: numero_conta,
    });

    counter++;
  }

  return {
    banco_nome,
    agencia,
    numero_conta,
    tipo_conta,
    data_inicio,
    data_fim,
    saldo_final,
    transacoes: transactions,
  };
}

/**
 * Cleans OFX text removing SGML tags and HTML entities
 */
function cleanOFXText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

/**
 * Converts OFX Date formats (e.g. "20250510120000[-3:BRT]" or "20250510") to "YYYY-MM-DD"
 */
export function parseOFXDate(rawDate: string): string {
  if (!rawDate) return new Date().toISOString().split('T')[0];
  const digits = rawDate.replace(/\D/g, '');
  if (digits.length >= 8) {
    const year = digits.substring(0, 4);
    const month = digits.substring(4, 6);
    const day = digits.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * Parses Bank CSV statements (such as Nubank, Itaú, Inter, etc.) into structured OFXTransactions
 */
export function parseBankCSV(csvContent: string): OFXStatement {
  const lines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) {
    return { transacoes: [] };
  }

  const headerLine = lines[0].toLowerCase();
  const delimiter = headerLine.includes(';') ? ';' : ',';
  const headers = headerLine.split(delimiter).map((h) => h.replace(/["']/g, '').trim());

  let dateIdx = headers.findIndex((h) => h.includes('data') || h.includes('date') || h.includes('dt'));
  let descIdx = headers.findIndex((h) => h.includes('desc') || h.includes('historico') || h.includes('histórico') || h.includes('memo') || h.includes('detalhe'));
  let valIdx = headers.findIndex((h) => h.includes('valor') || h.includes('value') || h.includes('amount') || h.includes('quantia'));
  let idIdx = headers.findIndex((h) => h.includes('id') || h.includes('fitid') || h.includes('doc') || h.includes('documento'));

  if (dateIdx === -1) dateIdx = 0;
  if (descIdx === -1) descIdx = 1;
  if (valIdx === -1) valIdx = 2;

  const transactions: OFXTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.replace(/^["']|["']$/g, '').trim());
    if (cols.length <= Math.max(dateIdx, descIdx, valIdx)) continue;

    const rawDate = cols[dateIdx];
    const memo = cols[descIdx] || 'Lançamento Extrato CSV';
    const rawVal = cols[valIdx];

    if (!rawVal || rawVal === '') continue;

    // Format Date
    let formattedDate = new Date().toISOString().split('T')[0];
    if (rawDate.includes('/')) {
      const parts = rawDate.split('/');
      if (parts.length === 3) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        formattedDate = `${y}-${m}-${d}`;
      }
    } else if (rawDate.includes('-')) {
      formattedDate = rawDate;
    }

    // Clean numeric value
    let cleanValStr = rawVal.replace(/[R$\s]/g, '');
    let isNegative = cleanValStr.includes('-') || cleanValStr.includes('(');
    cleanValStr = cleanValStr.replace(/[-()]/g, '');

    if (cleanValStr.includes(',') && cleanValStr.includes('.')) {
      cleanValStr = cleanValStr.replace(/\./g, '').replace(',', '.');
    } else if (cleanValStr.includes(',')) {
      cleanValStr = cleanValStr.replace(',', '.');
    }

    const numVal = parseFloat(cleanValStr) || 0;
    if (numVal === 0) continue;

    const tipo: 'DEBIT' | 'CREDIT' = isNegative ? 'DEBIT' : 'CREDIT';
    const fitid = idIdx !== -1 && cols[idIdx] ? cols[idIdx] : `csv_${formattedDate}_${i}_${numVal}`;

    transactions.push({
      id: `trn_csv_${i}`,
      fitid,
      tipo,
      valor: Math.abs(numVal),
      data: formattedDate,
      memo,
    });
  }

  return {
    banco_nome: 'Extrato Bancário CSV',
    transacoes: transactions,
  };
}
