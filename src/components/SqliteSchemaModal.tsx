import React, { useState } from 'react';
import { X, Database, Table, Key, Copy, Check, Download, ShieldCheck, UserCheck } from 'lucide-react';
import { Company, FinancialAccount, User, UserCompanyLink } from '../types';

interface SqliteSchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  accounts: FinancialAccount[];
  users?: User[];
  userCompanies?: UserCompanyLink[];
}

export const SqliteSchemaModal: React.FC<SqliteSchemaModalProps> = ({
  isOpen,
  onClose,
  companies,
  accounts,
  users = [],
  userCompanies = [],
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const sqlDDL = `-- ==============================================================================
-- ESTRUTURA DO BANCO DE DADOS LOCAL MULTIEMPRESA & AUTENTICAÇÃO (financeiro.db)
-- SQLite 3 (Criptografia com PBKDF2/SHA-256 + Salt)
-- ==============================================================================
PRAGMA foreign_keys = ON;

-- 1. Tabela de Usuários (Autenticação e Permissões)
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL, -- Formato criptográfico salt$pbkdf2_sha256_hash
    acesso_todas_empresas INTEGER NOT NULL DEFAULT 0, -- 1: Global / 0: Apenas vinculadas
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela de Empresas
CREATE TABLE IF NOT EXISTS empresas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    cnpj TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Vinculação: Usuário <-> Empresas (Controle de Acesso Granular)
CREATE TABLE IF NOT EXISTS usuario_empresas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    empresa_id INTEGER NOT NULL,
    UNIQUE(usuario_id, empresa_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
    FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE
);

-- 4. Tabela de Contas a Pagar (Despesas)
CREATE TABLE IF NOT EXISTS contas_a_pagar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL,
    descricao TEXT NOT NULL,
    categoria TEXT NOT NULL DEFAULT 'Outros',
    valor REAL NOT NULL,
    data_vencimento TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendente',
    FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE
);

-- 5. Tabela de Contas a Receber (Receitas)
CREATE TABLE IF NOT EXISTS contas_a_receber (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL,
    descricao TEXT NOT NULL,
    categoria TEXT NOT NULL DEFAULT 'Outros',
    valor REAL NOT NULL,
    data_vencimento TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendente',
    FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE
);

-- Índices recomendados para performance no Desktop
CREATE INDEX IF NOT EXISTS idx_user_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_user_emp ON usuario_empresas(usuario_id, empresa_id);
CREATE INDEX IF NOT EXISTS idx_pagar_empresa ON contas_a_pagar(empresa_id);
CREATE INDEX IF NOT EXISTS idx_receber_empresa ON contas_a_receber(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pagar_vencimento ON contas_a_pagar(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_receber_vencimento ON contas_a_receber(data_vencimento);
`;

  const generateSqlDump = () => {
    let dump = sqlDDL + '\n\n-- ================= DADOS ATUAIS DO SISTEMA =================\n';
    
    // Inserir Usuários
    if (users.length > 0) {
      dump += '\n-- Usuários\n';
      users.forEach((u) => {
        dump += `INSERT OR IGNORE INTO usuarios (id, nome, email, senha_hash, acesso_todas_empresas) VALUES (${u.id}, '${u.nome.replace(/'/g, "''")}', '${u.email.replace(/'/g, "''")}', '${u.senha_hash}', ${u.acesso_todas_empresas ? 1 : 0});\n`;
      });
    }

    // Inserir empresas
    dump += '\n-- Empresas\n';
    companies.forEach((c) => {
      dump += `INSERT OR IGNORE INTO empresas (id, nome, cnpj) VALUES (${c.id}, '${c.nome.replace(/'/g, "''")}', '${c.cnpj || ''}');\n`;
    });

    // Inserir Vinculação Usuário-Empresa
    if (userCompanies.length > 0) {
      dump += '\n-- Permissões de Usuários x Empresas\n';
      userCompanies.forEach((uc) => {
        dump += `INSERT OR IGNORE INTO usuario_empresas (usuario_id, empresa_id) VALUES (${uc.usuario_id}, ${uc.empresa_id});\n`;
      });
    }

    // Inserir contas a pagar
    dump += '\n-- Contas a Pagar\n';
    accounts.filter(a => a.tipo === 'pagar').forEach((a) => {
      dump += `INSERT INTO contas_a_pagar (id, empresa_id, descricao, categoria, valor, data_vencimento, status) VALUES (${a.id}, ${a.empresa_id}, '${a.descricao.replace(/'/g, "''")}', '${(a.categoria || 'Outros').replace(/'/g, "''")}', ${a.valor}, '${a.data_vencimento}', '${a.status}');\n`;
    });

    // Inserir contas a receber
    dump += '\n-- Contas a Receber\n';
    accounts.filter(a => a.tipo === 'receber').forEach((a) => {
      dump += `INSERT INTO contas_a_receber (id, empresa_id, descricao, categoria, valor, data_vencimento, status) VALUES (${a.id}, ${a.empresa_id}, '${a.descricao.replace(/'/g, "''")}', '${(a.categoria || 'Outros').replace(/'/g, "''")}', ${a.valor}, '${a.data_vencimento}', '${a.status}');\n`;
    });

    return dump;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateSqlDump());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const content = generateSqlDump();
    const blob = new Blob([content], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema_e_dados.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Esquema do Banco de Dados SQLite (financeiro.db)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Modelagem relacional completa com autenticação, RBAC multiempresa e integridade referencial
              </p>
            </div>
          </div>

          <button
            id="close-sqlite-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Visual Cards das Tabelas */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            
            {/* Tabela Usuários */}
            <div className="p-3.5 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white text-xs mb-2">
                <Table className="w-3.5 h-3.5 text-indigo-500" />
                <span>usuarios</span>
              </div>
              <ul className="space-y-1 font-mono text-[11px] text-gray-700 dark:text-gray-300">
                <li className="text-indigo-600 dark:text-indigo-400 font-bold">id (PK)</li>
                <li>nome (TEXT)</li>
                <li>email (UNIQUE)</li>
                <li className="text-amber-500">senha_hash</li>
                <li>acesso_todas (INT)</li>
              </ul>
              <div className="mt-2.5 pt-1.5 border-t border-gray-200 dark:border-slate-700 text-[10px] text-gray-500">
                {users.length} usuários
              </div>
            </div>

            {/* Tabela Empresas */}
            <div className="p-3.5 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white text-xs mb-2">
                <Table className="w-3.5 h-3.5 text-blue-500" />
                <span>empresas</span>
              </div>
              <ul className="space-y-1 font-mono text-[11px] text-gray-700 dark:text-gray-300">
                <li className="text-blue-600 dark:text-blue-400 font-bold">id (PK)</li>
                <li>nome (UNIQUE)</li>
                <li>cnpj (TEXT)</li>
                <li>criado_em</li>
              </ul>
              <div className="mt-2.5 pt-1.5 border-t border-gray-200 dark:border-slate-700 text-[10px] text-gray-500">
                {companies.length} empresas
              </div>
            </div>

            {/* Tabela usuario_empresas */}
            <div className="p-3.5 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white text-xs mb-2">
                <Table className="w-3.5 h-3.5 text-purple-500" />
                <span>usuario_empresas</span>
              </div>
              <ul className="space-y-1 font-mono text-[11px] text-gray-700 dark:text-gray-300">
                <li className="text-purple-600 dark:text-purple-400 font-bold">id (PK)</li>
                <li className="text-indigo-500">usuario_id (FK)</li>
                <li className="text-blue-500">empresa_id (FK)</li>
                <li>UNIQUE(user, emp)</li>
              </ul>
              <div className="mt-2.5 pt-1.5 border-t border-gray-200 dark:border-slate-700 text-[10px] text-gray-500">
                {userCompanies.length} vínculos
              </div>
            </div>

            {/* Tabela Contas a Pagar */}
            <div className="p-3.5 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white text-xs mb-2">
                <Table className="w-3.5 h-3.5 text-rose-500" />
                <span>contas_a_pagar</span>
              </div>
              <ul className="space-y-1 font-mono text-[11px] text-gray-700 dark:text-gray-300">
                <li className="text-rose-600 dark:text-rose-400 font-bold">id (PK)</li>
                <li className="text-blue-500">empresa_id (FK)</li>
                <li>descricao (TEXT)</li>
                <li>valor (REAL)</li>
                <li>status ('Pago'/...)</li>
              </ul>
              <div className="mt-2.5 pt-1.5 border-t border-gray-200 dark:border-slate-700 text-[10px] text-gray-500">
                {accounts.filter(a => a.tipo === 'pagar').length} despesas
              </div>
            </div>

            {/* Tabela Contas a Receber */}
            <div className="p-3.5 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white text-xs mb-2">
                <Table className="w-3.5 h-3.5 text-emerald-500" />
                <span>contas_a_receber</span>
              </div>
              <ul className="space-y-1 font-mono text-[11px] text-gray-700 dark:text-gray-300">
                <li className="text-emerald-600 dark:text-emerald-400 font-bold">id (PK)</li>
                <li className="text-blue-500">empresa_id (FK)</li>
                <li>descricao (TEXT)</li>
                <li>valor (REAL)</li>
                <li>status ('Recebido'/...)</li>
              </ul>
              <div className="mt-2.5 pt-1.5 border-t border-gray-200 dark:border-slate-700 text-[10px] text-gray-500">
                {accounts.filter(a => a.tipo === 'receber').length} receitas
              </div>
            </div>

          </div>

          {/* DDL Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Script SQL DDL / Dump com Usuários e Permissões</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 flex items-center gap-1 cursor-pointer font-medium"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado' : 'Copiar SQL'}</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 cursor-pointer font-bold shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar .sql</span>
                </button>
              </div>
            </div>
            <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl overflow-x-auto border border-slate-800 leading-relaxed font-mono text-[11px] max-h-72">
              <code>{sqlDDL}</code>
            </pre>
          </div>

        </div>

        {/* Footer */}
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
