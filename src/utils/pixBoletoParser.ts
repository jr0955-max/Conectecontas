/**
 * Utilitários para decodificação e validação de QR Code Pix e Código de Barras / Linha Digitável de Boletos
 */

export interface PixParsedData {
  tipo: 'emvco' | 'chave_direta';
  chavePix: string;
  chaveTipo: 'cnpj' | 'cpf' | 'email' | 'telefone' | 'aleatoria';
  nomeRecebedor?: string;
  cidade?: string;
  valor?: number;
  txid?: string;
  rawPayload: string;
}

export interface BoletoParsedData {
  tipo: 'bancario_47' | 'arrecadacao_48' | 'codigo_barras_44' | 'outro';
  codigoBarrasLimpo: string;
  linhaDigitavelFormatada: string;
  valor?: number;
  dataVencimento?: string;
  bancoCodigo?: string;
  bancoNome?: string;
  rawPayload: string;
}

/**
 * Detecta o tipo de chave Pix com base no padrão textual
 */
export function detectPixKeyType(key: string): 'cnpj' | 'cpf' | 'email' | 'telefone' | 'aleatoria' {
  const clean = key.trim();
  const digitsOnly = clean.replace(/\D/g, '');

  // E-mail
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return 'email';
  }

  // CPF (11 dígitos)
  if (digitsOnly.length === 11 && !clean.startsWith('+')) {
    return 'cpf';
  }

  // CNPJ (14 dígitos)
  if (digitsOnly.length === 14) {
    return 'cnpj';
  }

  // Telefone celular brasileiro (+55... ou 10/11 dígitos com prefixo)
  if (/^(\+55|55)?\d{10,11}$/.test(digitsOnly) || clean.startsWith('+')) {
    return 'telefone';
  }

  // Chave aleatória / EVP (UUID v4 format)
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(clean)) {
    return 'aleatoria';
  }

  return 'aleatoria';
}

/**
 * Extrai campos TLV (Tag-Length-Value) do padrão EMVCo do Pix
 */
function parseEMVCoTLV(payload: string): Record<string, string> {
  const result: Record<string, string> = {};
  let i = 0;
  while (i < payload.length) {
    if (i + 4 > payload.length) break;
    const tag = payload.substring(i, i + 2);
    const lengthStr = payload.substring(i + 2, i + 4);
    const length = parseInt(lengthStr, 10);
    if (isNaN(length) || i + 4 + length > payload.length) break;
    const value = payload.substring(i + 4, i + 4 + length);
    result[tag] = value;
    i += 4 + length;
  }
  return result;
}

/**
 * Decodifica uma string de QR Code Pix (EMVCo ou chave direta)
 */
export function parsePixQRCode(raw: string): PixParsedData | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // Caso 1: Payload EMVCo oficial do Pix (inicia com 000201)
  if (trimmed.startsWith('000201')) {
    try {
      const tags = parseEMVCoTLV(trimmed);
      let chavePix = '';
      let txid = '';

      // Tag 26: Merchant Account Information (Pix)
      if (tags['26']) {
        const subTags = parseEMVCoTLV(tags['26']);
        chavePix = subTags['01'] || subTags['25'] || '';
      }

      // Tag 62: Additional Data Field (txid)
      if (tags['62']) {
        const subTags = parseEMVCoTLV(tags['62']);
        txid = subTags['05'] || '';
      }

      const nomeRecebedor = tags['59'] || undefined;
      const cidade = tags['60'] || undefined;
      const valor = tags['54'] ? parseFloat(tags['54']) : undefined;

      if (chavePix) {
        return {
          tipo: 'emvco',
          chavePix,
          chaveTipo: detectPixKeyType(chavePix),
          nomeRecebedor,
          cidade,
          valor: isNaN(Number(valor)) ? undefined : valor,
          txid,
          rawPayload: trimmed,
        };
      }
    } catch (e) {
      console.warn('Erro ao decodificar payload EMVCo Pix:', e);
    }
  }

  // Caso 2: Chave Pix direta ou URL Pix
  let candidateKey = trimmed;
  if (trimmed.startsWith('pix:')) {
    candidateKey = trimmed.replace(/^pix:/i, '');
  }

  // Se parece com CPF, CNPJ, Email, Telefone ou UUID
  const keyType = detectPixKeyType(candidateKey);
  return {
    tipo: 'chave_direta',
    chavePix: candidateKey,
    chaveTipo: keyType,
    rawPayload: trimmed,
  };
}

/**
 * Mapeamento dos principais códigos de bancos brasileiros
 */
const BANCOS_BRASIL: Record<string, string> = {
  '001': 'Banco do Brasil',
  '033': 'Santander',
  '104': 'Caixa Econômica Federal',
  '237': 'Bradesco',
  '341': 'Itaú Unibanco',
  '077': 'Banco Inter',
  '260': 'Nubank',
  '197': 'Stone Pagamentos',
  '336': 'C6 Bank',
  '212': 'Banco Original',
  '422': 'Banco Safra',
  '748': 'Sicredi',
  '756': 'Sicoob',
};

/**
 * Formata linha digitável padrão de Boleto Bancário (47 dígitos)
 * Ex: 34191.79001 01043.510047 91020.150008 8 98760000015000
 */
export function formatLinhaDigitavelBancaria(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length === 47) {
    return `${d.substring(0, 5)}.${d.substring(5, 10)} ${d.substring(10, 15)}.${d.substring(15, 21)} ${d.substring(21, 26)}.${d.substring(26, 32)} ${d.substring(32, 33)} ${d.substring(33, 47)}`;
  }
  if (d.length === 48) {
    return `${d.substring(0, 12)} ${d.substring(12, 24)} ${d.substring(24, 36)} ${d.substring(36, 48)}`;
  }
  return digits;
}

/**
 * Converte Código de Barras (44 dígitos) para Linha Digitável (47 dígitos) de Boleto Bancário
 */
export function convertBarcode44ToLinhaDigitavel(barcode: string): string {
  const b = barcode.replace(/\D/g, '');
  if (b.length !== 44) return barcode;

  const banco = b.substring(0, 3);
  const moeda = b.substring(3, 4);
  const fatorVenc = b.substring(5, 9);
  const valor = b.substring(9, 19);
  const campoLivre = b.substring(19, 44);

  // Campo 1: Banco (3) + Moeda (1) + 5 primeiros dígitos do campo livre + DV
  const c1SemDv = banco + moeda + campoLivre.substring(0, 5);
  const dv1 = calculaMod10(c1SemDv);
  const campo1 = c1SemDv + dv1;

  // Campo 2: dígitos 6 a 15 do campo livre + DV
  const c2SemDv = campoLivre.substring(5, 15);
  const dv2 = calculaMod10(c2SemDv);
  const campo2 = c2SemDv + dv2;

  // Campo 3: dígitos 16 a 25 do campo livre + DV
  const c3SemDv = campoLivre.substring(15, 25);
  const dv3 = calculaMod10(c3SemDv);
  const campo3 = c3SemDv + dv3;

  // Campo 4: DV geral do código de barras
  const campo4 = b.substring(4, 5);

  // Campo 5: Fator Vencimento (4) + Valor (10)
  const campo5 = fatorVenc + valor;

  return `${campo1}${campo2}${campo3}${campo4}${campo5}`;
}

function calculaMod10(num: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    let mult = parseInt(num[i], 10) * peso;
    if (mult > 9) mult = Math.floor(mult / 10) + (mult % 10);
    soma += mult;
    peso = peso === 2 ? 1 : 2;
  }
  const resto = soma % 10;
  return resto === 0 ? 0 : 10 - resto;
}

/**
 * Decodifica dados do boleto (Código de barras ou Linha digitável)
 */
export function parseBoletoCode(raw: string): BoletoParsedData | null {
  if (!raw || typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');

  if (digits.length < 20) return null;

  let cleanCode = digits;
  let formatted = raw;
  let valor: number | undefined = undefined;
  let bancoCodigo = '';

  if (digits.length === 44) {
    // Código de barras físico (44 posições)
    bancoCodigo = digits.substring(0, 3);
    const valorStr = digits.substring(9, 19);
    const valorNum = parseInt(valorStr, 10) / 100;
    if (!isNaN(valorNum) && valorNum > 0) valor = valorNum;

    const linha47 = convertBarcode44ToLinhaDigitavel(digits);
    formatted = formatLinhaDigitavelBancaria(linha47);

    return {
      tipo: 'codigo_barras_44',
      codigoBarrasLimpo: digits,
      linhaDigitavelFormatada: formatted,
      valor,
      bancoCodigo,
      bancoNome: BANCOS_BRASIL[bancoCodigo] || `Banco ${bancoCodigo}`,
      rawPayload: raw,
    };
  }

  if (digits.length === 47) {
    // Linha digitável bancária padrão
    bancoCodigo = digits.substring(0, 3);
    const valorStr = digits.substring(37, 47);
    const valorNum = parseInt(valorStr, 10) / 100;
    if (!isNaN(valorNum) && valorNum > 0) valor = valorNum;
    formatted = formatLinhaDigitavelBancaria(digits);

    return {
      tipo: 'bancario_47',
      codigoBarrasLimpo: digits,
      linhaDigitavelFormatada: formatted,
      valor,
      bancoCodigo,
      bancoNome: BANCOS_BRASIL[bancoCodigo] || `Banco ${bancoCodigo}`,
      rawPayload: raw,
    };
  }

  if (digits.length === 48) {
    // Boleto de concessionária / tributo
    formatted = formatLinhaDigitavelBancaria(digits);
    const valorStr = digits.substring(4, 15);
    const valorNum = parseInt(valorStr, 10) / 100;
    if (!isNaN(valorNum) && valorNum > 0) valor = valorNum;

    return {
      tipo: 'arrecadacao_48',
      codigoBarrasLimpo: digits,
      linhaDigitavelFormatada: formatted,
      valor,
      rawPayload: raw,
    };
  }

  return {
    tipo: 'outro',
    codigoBarrasLimpo: digits,
    linhaDigitavelFormatada: raw,
    rawPayload: raw,
  };
}
