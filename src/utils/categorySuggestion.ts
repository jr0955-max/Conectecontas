import { FinancialAccount, AccountType } from '../types';

export interface CategorySuggestionResult {
  category: string;
  frequency: number;
  totalMatches: number;
  matchType: 'exact' | 'partial' | 'keyword';
  matchedDescription: string;
  allSuggestions: { category: string; count: number }[];
}

/**
 * Normaliza uma string removendo acentos, pontuações extras e padronizando para minúsculas.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Conjunto de palavras comuns (stop words) ignoradas no matching por palavras-chave
 */
const STOP_WORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
  'por', 'para', 'com', 'sem', 'sob', 'sobre', 'a', 'o', 'as', 'os',
  'um', 'uma', 'uns', 'umas', 'e', 'ou', 'que', 'se', 'ao', 'aos',
  'pagamento', 'pgto', 'pag', 'fatura', 'conta', 'mensalidade', 'recibo', 'nota'
]);

/**
 * Encontra a sugestão de categoria mais frequente baseada no histórico de descrições dos lançamentos financeiros.
 * 
 * @param accounts Lista de lançamentos existentes
 * @param inputDescription Descrição digitada pelo usuário no novo lançamento
 * @param preferredType Tipo de lançamento opcional ('pagar' | 'receber') para priorizar
 */
export function suggestCategoryFromHistory(
  accounts: FinancialAccount[],
  inputDescription: string,
  preferredType?: AccountType
): CategorySuggestionResult | null {
  if (!inputDescription || !accounts || accounts.length === 0) {
    return null;
  }

  const cleanInput = normalizeText(inputDescription);
  if (cleanInput.length < 2) {
    return null;
  }

  // Filtrar contas ativas com descrição e categoria válidas
  const validAccounts = accounts.filter(
    (a) => !a.excluido && a.descricao && a.descricao.trim().length > 0 && a.categoria
  );

  if (validAccounts.length === 0) {
    return null;
  }

  // Separar em contas do mesmo tipo (prioritárias) e outras
  const sameTypeAccounts = preferredType 
    ? validAccounts.filter((a) => a.tipo === preferredType) 
    : validAccounts;
  
  const searchPool = sameTypeAccounts.length > 0 ? sameTypeAccounts : validAccounts;

  // 1. Tentar correspondência EXATA (normalizada)
  const exactMatches = searchPool.filter((a) => normalizeText(a.descricao) === cleanInput);
  
  if (exactMatches.length > 0) {
    return buildResultFromMatches(exactMatches, 'exact', exactMatches[0].descricao);
  }

  // Se não achou no pool do mesmo tipo com exatidão, tenta exata no pool geral
  if (preferredType && sameTypeAccounts.length < validAccounts.length) {
    const generalExact = validAccounts.filter((a) => normalizeText(a.descricao) === cleanInput);
    if (generalExact.length > 0) {
      return buildResultFromMatches(generalExact, 'exact', generalExact[0].descricao);
    }
  }

  // 2. Tentar correspondência por PREFIXO ou SUBSTRING DIRETA (se tiver >= 3 caracteres)
  if (cleanInput.length >= 3) {
    const substringMatches = searchPool.filter((a) => {
      const norm = normalizeText(a.descricao);
      return (
        norm.startsWith(cleanInput) || 
        cleanInput.startsWith(norm) ||
        norm.includes(cleanInput) || 
        cleanInput.includes(norm)
      );
    });

    if (substringMatches.length > 0) {
      // Ordenar pelas que mais se aproximam em tamanho ou que começam igual
      substringMatches.sort((a, b) => {
        const normA = normalizeText(a.descricao);
        const normB = normalizeText(b.descricao);
        const aStarts = normA.startsWith(cleanInput) ? -1 : 1;
        const bStarts = normB.startsWith(cleanInput) ? -1 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return Math.abs(normA.length - cleanInput.length) - Math.abs(normB.length - cleanInput.length);
      });

      return buildResultFromMatches(substringMatches, 'partial', substringMatches[0].descricao);
    }
  }

  // 3. Tentar correspondência por PALAVRAS-CHAVE RELEVANTES (tokens)
  const inputTokens = cleanInput
    .split(' ')
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  if (inputTokens.length > 0) {
    const scoredMatches: { account: FinancialAccount; score: number }[] = [];

    for (const acc of searchPool) {
      const normDesc = normalizeText(acc.descricao);
      const descTokens = normDesc.split(' ').filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

      let score = 0;
      for (const token of inputTokens) {
        if (descTokens.includes(token)) {
          score += 2; // Token idêntico
        } else if (descTokens.some((dt) => dt.startsWith(token) || token.startsWith(dt))) {
          score += 1; // Prefixo do token coincide
        }
      }

      if (score > 0) {
        scoredMatches.push({ account: acc, score });
      }
    }

    if (scoredMatches.length > 0) {
      scoredMatches.sort((a, b) => b.score - a.score);
      const topScore = scoredMatches[0].score;
      const relevantMatches = scoredMatches
        .filter((sm) => sm.score >= Math.max(1, topScore - 1))
        .map((sm) => sm.account);

      return buildResultFromMatches(relevantMatches, 'keyword', scoredMatches[0].account.descricao);
    }
  }

  return null;
}

/**
 * Constrói o resultado da sugestão calculando as frequências das categorias encontradas.
 * Prioriza categorias específicas em relação a 'Geral' ou vazias quando houver alternativas.
 */
function buildResultFromMatches(
  matches: FinancialAccount[],
  matchType: 'exact' | 'partial' | 'keyword',
  bestMatchedDescription: string
): CategorySuggestionResult | null {
  if (matches.length === 0) return null;

  const frequencyMap = new Map<string, number>();

  for (const acc of matches) {
    const cat = acc.categoria?.trim();
    if (!cat) continue;
    frequencyMap.set(cat, (frequencyMap.get(cat) || 0) + 1);
  }

  if (frequencyMap.size === 0) return null;

  // Converter para lista ordenada por frequência
  const sortedCategories = Array.from(frequencyMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => {
      // Se uma delas for 'Geral' e tiver outra categoria com frequência relevante, prioriza a específica
      if (a.category.toLowerCase() === 'geral' && b.category.toLowerCase() !== 'geral') {
        if (b.count >= a.count / 2) return 1;
      }
      if (b.category.toLowerCase() === 'geral' && a.category.toLowerCase() !== 'geral') {
        if (a.count >= b.count / 2) return -1;
      }
      return b.count - a.count;
    });

  const best = sortedCategories[0];
  if (!best) return null;

  return {
    category: best.category,
    frequency: best.count,
    totalMatches: matches.length,
    matchType,
    matchedDescription: bestMatchedDescription,
    allSuggestions: sortedCategories,
  };
}
