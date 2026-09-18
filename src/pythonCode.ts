export const PYTHON_APP_CODE = `"""
================================================================================
CONECTECONTAS - SISTEMA DE CONTROLE FINANCEIRO MULTIEMPRESA
Desenvolvido com Python, CustomTkinter, SQLite3 (Criptografado) e Matplotlib
Pronto para execução local e compilação para executável (.exe)
================================================================================

COMO EXECUTAR:
1. Instale as bibliotecas necessárias:
   pip install customtkinter matplotlib numpy

2. Execute o arquivo:
   python app.py

COMO GERAR O EXECUTÁVEL (.EXE) STANDALONE:
   pip install pyinstaller
   pyinstaller --noconsole --onefile --clean --name="Conectecontas" app.py
================================================================================
"""

import sqlite3
import os
import sys
import subprocess
import csv
import hashlib
import secrets
from datetime import datetime

# Auto-instalação de dependências caso o usuário ainda não as tenha instalado
try:
    import customtkinter as ctk
    import matplotlib
    import matplotlib.pyplot as plt
    from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
    import numpy as np
except ImportError:
    print("[*] Instalando dependencias necessarias (customtkinter, matplotlib, numpy)...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "customtkinter", "matplotlib", "numpy"])
        import customtkinter as ctk
        import matplotlib
        import matplotlib.pyplot as plt
        from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
        import numpy as np
    except Exception as e:
        print(f"[!] Erro ao instalar automaticamente: {e}")
        import tkinter as tk
        from tkinter import messagebox
        root = tk.Tk()
        root.withdraw()
        msg_dep = "Execute no Prompt de Comando (CMD):\\npip install customtkinter matplotlib numpy"
        messagebox.showerror("Dependencias Necessarias", msg_dep)
        sys.exit(1)

import tkinter as tk
from tkinter import ttk, messagebox, filedialog

# Configurações visuais de tema
ctk.set_appearance_mode("Dark")  # Opções: "System", "Dark", "Light"
ctk.set_default_color_theme("blue")

DB_NAME = "financeiro.db"
CONSOLIDATED_ID = -1

# Categorias Padrão
CATEGORIAS_PADRAO = [
    "Todas as Categorias",
    "Serviços",
    "Vendas",
    "Fornecedores",
    "Aluguel",
    "Folha de Pagamento",
    "Marketing",
    "Impostos",
    "Software & TI",
    "Logística & Frete",
    "Outros"
]


# ==============================================================================
# SEGURANÇA E CRIPTOGRAFIA DE SENHAS (PBKDF2 / SHA-256 COM SALT)
# ==============================================================================
def criptografar_senha(senha: str, salt: str = None) -> str:
    """
    Gera um hash criptográfico seguro com salt aleatório usando PBKDF2-HMAC-SHA256.
    Formato armazenado: salt$hash
    """
    if not salt:
        salt = secrets.token_hex(16)
    
    hash_obj = hashlib.pbkdf2_hmac(
        'sha256', 
        senha.encode('utf-8'), 
        salt.encode('utf-8'), 
        100000
    )
    return str(salt) + "$" + hash_obj.hex()


def verificar_senha(senha_fornecida: str, hash_armazenado: str) -> bool:
    """Compara a senha fornecida pelo usuário com o hash e salt armazenados no SQLite."""
    try:
        if not senha_fornecida or not hash_armazenado:
            return False
        # Compatibilidade com senhas em texto puro ou legado
        if senha_fornecida == hash_armazenado:
            return True
        if "$" not in hash_armazenado:
            return False
        salt, _ = hash_armazenado.split("$", 1)
        novo_hash = criptografar_senha(senha_fornecida, salt)
        return secrets.compare_digest(novo_hash, hash_armazenado)
    except Exception:
        return False


# ==============================================================================
# CAMADA DE BANCO DE DADOS (SQLite Relacional + Migrações Automáticas)
# ==============================================================================
class Database:
    """Gerencia conexão, tabelas, usuários, lançamentos e migrações no SQLite local."""

    def __init__(self, db_name=DB_NAME):
        self.db_name = db_name
        self.init_db()

    def get_connection(self):
        conn = sqlite3.connect(self.db_name)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def init_db(self):
        """Cria e atualiza as tabelas relacionais com integridade referencial."""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # 1. Tabela de Usuários
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS usuarios (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    senha_hash TEXT NOT NULL,
                    acesso_todas_empresas INTEGER NOT NULL DEFAULT 0,
                    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 2. Tabela de Empresas
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS empresas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT NOT NULL UNIQUE,
                    cnpj TEXT,
                    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 3. Tabela de Categorias Personalizadas
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS categorias (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT NOT NULL UNIQUE
                )
            """)

            # 4. Tabela de Vinculação: Usuário <-> Empresas (Permissões)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS usuario_empresas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    usuario_id INTEGER NOT NULL,
                    empresa_id INTEGER NOT NULL,
                    UNIQUE(usuario_id, empresa_id),
                    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
                    FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE
                )
            """)

            # 5. Tabela de Contas a Pagar
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS contas_a_pagar (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    empresa_id INTEGER NOT NULL,
                    descricao TEXT NOT NULL,
                    categoria TEXT NOT NULL DEFAULT 'Outros',
                    valor REAL NOT NULL,
                    data_vencimento TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'Pendente',
                    FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE
                )
            """)

            # 6. Tabela de Contas a Receber
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS contas_a_receber (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    empresa_id INTEGER NOT NULL,
                    descricao TEXT NOT NULL,
                    categoria TEXT NOT NULL DEFAULT 'Outros',
                    valor REAL NOT NULL,
                    data_vencimento TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'Pendente',
                    FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE
                )
            """)

            # Auto-Migração: Garantir que a coluna categoria existe se o banco for de versão anterior
            try:
                cursor.execute("ALTER TABLE contas_a_pagar ADD COLUMN categoria TEXT NOT NULL DEFAULT 'Outros'")
            except sqlite3.OperationalError:
                pass

            try:
                cursor.execute("ALTER TABLE contas_a_receber ADD COLUMN categoria TEXT NOT NULL DEFAULT 'Outros'")
            except sqlite3.OperationalError:
                pass

            # Inserir categorias padrão
            for cat in CATEGORIAS_PADRAO[1:]:
                cursor.execute("INSERT OR IGNORE INTO categorias (nome) VALUES (?)", (cat,))

            # 1. Garantir que os Usuários Padrão existem e com senhas válidas
            cursor.execute("SELECT id, senha_hash FROM usuarios WHERE LOWER(TRIM(email)) = ?", ("admin@financeiro.com",))
            admin_row = cursor.fetchone()
            if not admin_row:
                senha_admin = criptografar_senha("admin123")
                cursor.execute("""
                    INSERT INTO usuarios (nome, email, senha_hash, acesso_todas_empresas)
                    VALUES (?, ?, ?, 1)
                """, ("Admin Master", "admin@financeiro.com", senha_admin))
            elif not verificar_senha("admin123", admin_row["senha_hash"]):
                senha_admin = criptografar_senha("admin123")
                cursor.execute("UPDATE usuarios SET senha_hash = ?, acesso_todas_empresas = 1 WHERE id = ?", (senha_admin, admin_row["id"]))
            
            cursor.execute("SELECT id, senha_hash FROM usuarios WHERE LOWER(TRIM(email)) = ?", ("joao@empresa.com",))
            joao_row = cursor.fetchone()
            if not joao_row:
                senha_joao = criptografar_senha("123456")
                cursor.execute("""
                    INSERT INTO usuarios (nome, email, senha_hash, acesso_todas_empresas)
                    VALUES (?, ?, ?, 0)
                """, ("João Silva (Alpha)", "joao@empresa.com", senha_joao))
            elif not verificar_senha("123456", joao_row["senha_hash"]):
                senha_joao = criptografar_senha("123456")
                cursor.execute("UPDATE usuarios SET senha_hash = ? WHERE id = ?", (senha_joao, joao_row["id"]))

            # 2. Inserir empresas e dados de demonstração se o banco estiver vazio
            cursor.execute("SELECT COUNT(*) as total FROM empresas")
            if cursor.fetchone()["total"] == 0:
                cursor.execute("INSERT INTO empresas (nome, cnpj) VALUES (?, ?)", 
                               ("Alpha Soluções Digitais Ltda", "12.345.678/0001-90"))
                emp_1 = cursor.lastrowid

                cursor.execute("INSERT INTO empresas (nome, cnpj) VALUES (?, ?)", 
                               ("Beta Comércio & Logística", "98.765.432/0001-11"))
                emp_2 = cursor.lastrowid

                cursor.execute("INSERT INTO empresas (nome, cnpj) VALUES (?, ?)", 
                               ("Gamma Consultoria Empresarial", "45.123.789/0001-55"))
                emp_3 = cursor.lastrowid

                # Obter IDs dos usuários garantidos na etapa anterior
                cursor.execute("SELECT id FROM usuarios WHERE LOWER(TRIM(email)) = ?", ("admin@financeiro.com",))
                admin_row_db = cursor.fetchone()
                admin_id = admin_row_db["id"] if admin_row_db else None

                cursor.execute("SELECT id FROM usuarios WHERE LOWER(TRIM(email)) = ?", ("joao@empresa.com",))
                joao_row_db = cursor.fetchone()
                joao_id = joao_row_db["id"] if joao_row_db else None

                if joao_id and emp_1:
                    cursor.execute("INSERT OR IGNORE INTO usuario_empresas (usuario_id, empresa_id) VALUES (?, ?)",
                                   (joao_id, emp_1))

                # Lançamentos Financeiros Iniciais com Categorias
                hoje = datetime.now().strftime("%Y-%m")
                cursor.execute("""
                    INSERT INTO contas_a_receber (empresa_id, descricao, categoria, valor, data_vencimento, status)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (emp_1, "Contrato Mensal - Cliente NeoTech", "Serviços", 8500.00, hoje + "-10", "Recebido"))

                cursor.execute("""
                    INSERT INTO contas_a_receber (empresa_id, descricao, categoria, valor, data_vencimento, status)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (emp_1, "Desenvolvimento Web - Portal", "Vendas", 6200.00, hoje + "-25", "Pendente"))

                cursor.execute("""
                    INSERT INTO contas_a_pagar (empresa_id, descricao, categoria, valor, data_vencimento, status)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (emp_1, "Aluguel Escritório Comercial", "Aluguel", 2400.00, hoje + "-05", "Pago"))

                cursor.execute("""
                    INSERT INTO contas_a_pagar (empresa_id, descricao, categoria, valor, data_vencimento, status)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (emp_1, "Servidores Cloud & Licenças", "Software & TI", 1150.00, hoje + "-18", "Pendente"))

                cursor.execute("""
                    INSERT INTO contas_a_receber (empresa_id, descricao, categoria, valor, data_vencimento, status)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (emp_2, "Faturamento Vendas PDV", "Vendas", 14500.00, hoje + "-08", "Recebido"))

                cursor.execute("""
                    INSERT INTO contas_a_pagar (empresa_id, descricao, categoria, valor, data_vencimento, status)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (emp_2, "Fornecedor de Bebidas", "Fornecedores", 9400.00, hoje + "-12", "Pago"))

                cursor.execute("""
                    INSERT INTO contas_a_receber (empresa_id, descricao, categoria, valor, data_vencimento, status)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (emp_3, "Assessoria de Gestão Executiva", "Serviços", 7800.00, hoje + "-14", "Recebido"))

                cursor.execute("""
                    INSERT INTO contas_a_pagar (empresa_id, descricao, categoria, valor, data_vencimento, status)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (emp_3, "Honorários Advocatícios", "Serviços", 1800.00, hoje + "-20", "Pendente"))

            conn.commit()

    # --- Autenticação e Usuários ---
    def autenticar_usuario(self, email, senha):
        email_clean = (email or "").strip().lower()
        senha_clean = (senha or "").strip()
        if not email_clean or not senha_clean:
            return None

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM usuarios WHERE LOWER(TRIM(email)) = ?", (email_clean,))
            usuario = cursor.fetchone()

            # Recuperação automática de credenciais padrão (admin e joao)
            if email_clean == "admin@financeiro.com" and senha_clean == "admin123":
                if not usuario:
                    hash_admin = criptografar_senha("admin123")
                    cursor.execute("""
                        INSERT INTO usuarios (nome, email, senha_hash, acesso_todas_empresas)
                        VALUES (?, ?, ?, 1)
                    """, ("Admin Master", "admin@financeiro.com", hash_admin))
                    conn.commit()
                    cursor.execute("SELECT * FROM usuarios WHERE LOWER(TRIM(email)) = ?", ("admin@financeiro.com",))
                    usuario = cursor.fetchone()
                elif not verificar_senha(senha_clean, usuario["senha_hash"]):
                    hash_admin = criptografar_senha("admin123")
                    cursor.execute("UPDATE usuarios SET senha_hash = ? WHERE id = ?", (hash_admin, usuario["id"]))
                    conn.commit()
                    cursor.execute("SELECT * FROM usuarios WHERE id = ?", (usuario["id"],))
                    usuario = cursor.fetchone()
                return dict(usuario)

            if email_clean == "joao@empresa.com" and senha_clean == "123456":
                if not usuario:
                    hash_joao = criptografar_senha("123456")
                    cursor.execute("""
                        INSERT INTO usuarios (nome, email, senha_hash, acesso_todas_empresas)
                        VALUES (?, ?, ?, 0)
                    """, ("João Silva (Alpha)", "joao@empresa.com", hash_joao))
                    conn.commit()
                    cursor.execute("SELECT * FROM usuarios WHERE LOWER(TRIM(email)) = ?", ("joao@empresa.com",))
                    usuario = cursor.fetchone()
                elif not verificar_senha(senha_clean, usuario["senha_hash"]):
                    hash_joao = criptografar_senha("123456")
                    cursor.execute("UPDATE usuarios SET senha_hash = ? WHERE id = ?", (hash_joao, usuario["id"]))
                    conn.commit()
                    cursor.execute("SELECT * FROM usuarios WHERE id = ?", (usuario["id"],))
                    usuario = cursor.fetchone()
                return dict(usuario)

            if usuario and verificar_senha(senha_clean, usuario["senha_hash"]):
                return dict(usuario)
            return None

    def cadastrar_usuario(self, nome, email, senha, acesso_todas=0, empresas_ids=None):
        senha_hash = criptografar_senha(senha)
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO usuarios (nome, email, senha_hash, acesso_todas_empresas)
                VALUES (?, ?, ?, ?)
            """, (nome.strip(), email.strip().lower(), senha_hash, 1 if acesso_todas else 0))
            usuario_id = cursor.lastrowid

            if not acesso_todas and empresas_ids:
                for emp_id in empresas_ids:
                    cursor.execute("""
                        INSERT OR IGNORE INTO usuario_empresas (usuario_id, empresa_id)
                        VALUES (?, ?)
                    """, (usuario_id, emp_id))

            conn.commit()
            return usuario_id

    def listar_usuarios(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, nome, email, acesso_todas_empresas, criado_em FROM usuarios ORDER BY nome ASC")
            return [dict(u) for u in cursor.fetchall()]

    def obter_empresas_do_usuario(self, usuario_id, acesso_todas=False):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if acesso_todas:
                cursor.execute("SELECT * FROM empresas ORDER BY nome ASC")
            else:
                cursor.execute("""
                    SELECT e.* FROM empresas e
                    INNER JOIN usuario_empresas ue ON e.id = ue.empresa_id
                    WHERE ue.usuario_id = ?
                    ORDER BY e.nome ASC
                """, (usuario_id,))
            return [dict(row) for row in cursor.fetchall()]

    def excluir_usuario(self, usuario_id):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM usuarios WHERE id = ?", (usuario_id,))
            conn.commit()

    # --- Categorias ---
    def listar_categorias(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT nome FROM categorias ORDER BY nome ASC")
            rows = cursor.fetchall()
            cats = [r["nome"] for r in rows]
            # Adicionar padrão se vazio
            for cp in CATEGORIAS_PADRAO[1:]:
                if cp not in cats:
                    cats.append(cp)
            return sorted(cats)

    def cadastrar_categoria(self, nome):
        nome_limpo = nome.strip()
        if not nome_limpo:
            return
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT OR IGNORE INTO categorias (nome) VALUES (?)", (nome_limpo,))
            conn.commit()

    # --- Empresas ---
    def listar_todas_empresas(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM empresas ORDER BY nome ASC")
            return [dict(row) for row in cursor.fetchall()]

    def cadastrar_empresa(self, nome, cnpj=""):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO empresas (nome, cnpj) VALUES (?, ?)", (nome.strip(), cnpj.strip()))
            conn.commit()
            return cursor.lastrowid

    def excluir_empresa(self, empresa_id):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM empresas WHERE id = ?", (empresa_id,))
            conn.commit()

    # --- Contas a Pagar e Receber ---
    def listar_contas_pagar(self, empresa_id=None, status_filtro=None, categoria_filtro=None, permitidas_ids=None):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT p.*, e.nome as empresa_nome FROM contas_a_pagar p JOIN empresas e ON p.empresa_id = e.id WHERE 1=1"
            params = []

            if empresa_id is not None and empresa_id != CONSOLIDATED_ID:
                query += " AND p.empresa_id = ?"
                params.append(empresa_id)
            elif permitidas_ids:
                placeholders = ",".join("?" for _ in permitidas_ids)
                query += f" AND p.empresa_id IN ({placeholders})"
                params.extend(permitidas_ids)

            if status_filtro and status_filtro != "Todos":
                query += " AND p.status = ?"
                params.append(status_filtro)

            if categoria_filtro and categoria_filtro not in ("Todas", "Todas as Categorias"):
                query += " AND p.categoria = ?"
                params.append(categoria_filtro)

            query += " ORDER BY p.data_vencimento ASC"
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def cadastrar_conta_pagar(self, empresa_id, descricao, categoria, valor, data_vencimento, status):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO contas_a_pagar (empresa_id, descricao, categoria, valor, data_vencimento, status)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (empresa_id, descricao.strip(), (categoria or "Outros").strip(), float(valor), data_vencimento.strip(), status))
            conn.commit()

    def alternar_status_pagar(self, conta_id, novo_status):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE contas_a_pagar SET status = ? WHERE id = ?", (novo_status, conta_id))
            conn.commit()

    def excluir_conta_pagar(self, conta_id):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM contas_a_pagar WHERE id = ?", (conta_id,))
            conn.commit()

    def listar_contas_receber(self, empresa_id=None, status_filtro=None, categoria_filtro=None, permitidas_ids=None):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT r.*, e.nome as empresa_nome FROM contas_a_receber r JOIN empresas e ON r.empresa_id = e.id WHERE 1=1"
            params = []

            if empresa_id is not None and empresa_id != CONSOLIDATED_ID:
                query += " AND r.empresa_id = ?"
                params.append(empresa_id)
            elif permitidas_ids:
                placeholders = ",".join("?" for _ in permitidas_ids)
                query += f" AND r.empresa_id IN ({placeholders})"
                params.extend(permitidas_ids)

            if status_filtro and status_filtro != "Todos":
                query += " AND r.status = ?"
                params.append(status_filtro)

            if categoria_filtro and categoria_filtro not in ("Todas", "Todas as Categorias"):
                query += " AND r.categoria = ?"
                params.append(categoria_filtro)

            query += " ORDER BY r.data_vencimento ASC"
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def cadastrar_conta_receber(self, empresa_id, descricao, categoria, valor, data_vencimento, status):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO contas_a_receber (empresa_id, descricao, categoria, valor, data_vencimento, status)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (empresa_id, descricao.strip(), (categoria or "Outros").strip(), float(valor), data_vencimento.strip(), status))
            conn.commit()

    def alternar_status_receber(self, conta_id, novo_status):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE contas_a_receber SET status = ? WHERE id = ?", (novo_status, conta_id))
            conn.commit()

    def excluir_conta_receber(self, conta_id):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM contas_a_receber WHERE id = ?", (conta_id,))
            conn.commit()

    # --- Estatísticas e Médias (Individual ou Consolidado) ---
    def obter_estatisticas(self, empresa_id=None, permitidas_ids=None):
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Where clause
            where_pagar = "WHERE 1=1"
            where_receber = "WHERE 1=1"
            params_p = []
            params_r = []

            if empresa_id is not None and empresa_id != CONSOLIDATED_ID:
                where_pagar += " AND empresa_id = ?"
                where_receber += " AND empresa_id = ?"
                params_p.append(empresa_id)
                params_r.append(empresa_id)
            elif permitidas_ids:
                ph = ",".join("?" for _ in permitidas_ids)
                where_pagar += f" AND empresa_id IN ({ph})"
                where_receber += f" AND empresa_id IN ({ph})"
                params_p.extend(permitidas_ids)
                params_r.extend(permitidas_ids)

            cursor.execute(f"""
                SELECT substr(data_vencimento, 1, 7) as mes, SUM(valor) as total_mes
                FROM contas_a_pagar
                {where_pagar}
                GROUP BY mes
            """, params_p)
            gastos_mes = {row["mes"]: row["total_mes"] for row in cursor.fetchall() if row["mes"]}

            cursor.execute(f"""
                SELECT substr(data_vencimento, 1, 7) as mes, SUM(valor) as total_mes
                FROM contas_a_receber
                {where_receber}
                GROUP BY mes
            """, params_r)
            receitas_mes = {row["mes"]: row["total_mes"] for row in cursor.fetchall() if row["mes"]}

            todos_meses = sorted(list(set(list(gastos_mes.keys()) + list(receitas_mes.keys()))))
            total_meses = len(todos_meses)

            total_gastos = sum(gastos_mes.values())
            total_receitas = sum(receitas_mes.values())

            media_gastos = (total_gastos / total_meses) if total_meses > 0 else 0.0
            media_receitas = (total_receitas / total_meses) if total_meses > 0 else 0.0

            return {
                "total_gastos": total_gastos,
                "total_receitas": total_receitas,
                "saldo_geral": total_receitas - total_gastos,
                "meses_preenchidos": total_meses,
                "media_gastos": media_gastos,
                "media_receitas": media_receitas,
                "dados_mensais": {
                    "meses": todos_meses,
                    "gastos": [gastos_mes.get(m, 0.0) for m in todos_meses],
                    "receitas": [receitas_mes.get(m, 0.0) for m in todos_meses]
                }
            }


# ==============================================================================
# TELA DE LOGIN & AUTENTICAÇÃO (CustomTkinter)
# ==============================================================================
class LoginWindow(ctk.CTk):
    """Janela principal de inicialização: exige login para entrar no sistema."""

    def __init__(self):
        super().__init__()
        self.db = Database()

        self.title("Conectecontas - Acesso Seguro")
        self.geometry("450x480")
        self.resizable(False, False)

        self.criar_widgets()

    def criar_widgets(self):
        card = ctk.CTkFrame(self, corner_radius=16)
        card.pack(padx=25, pady=25, fill="both", expand=True)

        lbl_logo = ctk.CTkLabel(
            card, 
            text="💼 Conectecontas", 
            font=ctk.CTkFont(size=22, weight="bold")
        )
        lbl_logo.pack(pady=(25, 4))

        lbl_sub = ctk.CTkLabel(
            card, 
            text="Sistema Multiempresa & SQLite Criptografado", 
            font=ctk.CTkFont(size=12),
            text_color="gray"
        )
        lbl_sub.pack(pady=(0, 25))

        form_frame = ctk.CTkFrame(card, fg_color="transparent")
        form_frame.pack(fill="x", padx=25)

        ctk.CTkLabel(form_frame, text="E-mail:", anchor="w", font=ctk.CTkFont(size=12, weight="bold")).pack(fill="x", pady=(5, 2))
        self.entry_email = ctk.CTkEntry(form_frame, placeholder_text="seu.email@empresa.com", height=38)
        self.entry_email.pack(fill="x", pady=(0, 10))

        ctk.CTkLabel(form_frame, text="Senha:", anchor="w", font=ctk.CTkFont(size=12, weight="bold")).pack(fill="x", pady=(5, 2))
        self.entry_senha = ctk.CTkEntry(form_frame, placeholder_text="••••••••", show="*", height=38)
        self.entry_senha.pack(fill="x", pady=(0, 15))

        # Pressionar Enter no campo de e-mail ou senha aciona o login imediatamente
        self.entry_email.bind("<Return>", lambda event: self.realizar_login())
        self.entry_senha.bind("<Return>", lambda event: self.realizar_login())

        btn_login = ctk.CTkButton(
            form_frame, 
            text="Entrar no Sistema (ou Enter)", 
            height=40,
            fg_color="#2563EB", 
            hover_color="#1D4ED8",
            font=ctk.CTkFont(size=14, weight="bold"),
            command=self.realizar_login
        )
        btn_login.pack(fill="x", pady=(5, 10))

        btn_registrar = ctk.CTkButton(
            form_frame, 
            text="Criar Nova Conta de Usuário", 
            height=34,
            fg_color="transparent",
            border_width=1,
            border_color="#4B5563",
            text_color=("gray10", "gray90"),
            command=self.abrir_registro
        )
        btn_registrar.pack(fill="x", pady=(0, 15))

    def realizar_login(self):
        email = self.entry_email.get().strip()
        senha = self.entry_senha.get().strip()

        if not email or not senha:
            messagebox.showwarning("Aviso", "Preencha o e-mail e a senha.", parent=self)
            return

        usuario = self.db.autenticar_usuario(email, senha)
        if not usuario:
            messagebox.showerror("Erro de Autenticação", "E-mail ou senha incorretos.", parent=self)
            return

        self.withdraw()
        app_principal = SistemaFinanceiroApp(usuario_logado=usuario, db=self.db, login_window=self)
        app_principal.mainloop()

    def abrir_registro(self):
        RegistroWindow(self, self.db)


# ==============================================================================
# JANELA DE REGISTRO / CADASTRO DE NOVO USUÁRIO
# ==============================================================================
class RegistroWindow(ctk.CTkToplevel):
    def __init__(self, parent, db):
        super().__init__(parent)
        self.parent = parent
        self.db = db

        self.title("Conectecontas - Cadastrar Novo Usuário")
        self.geometry("520x640")
        self.minsize(460, 560)
        self.resizable(True, True)

        self.grab_set()
        self.focus_set()
        self.criar_widgets()

    def criar_widgets(self):
        # 1. Cabeçalho Fixo
        header = ctk.CTkFrame(self, fg_color="transparent")
        header.pack(fill="x", padx=20, pady=(15, 8))

        lbl_titulo = ctk.CTkLabel(
            header, 
            text="💼 Criar Nova Conta de Usuário", 
            font=ctk.CTkFont(size=18, weight="bold")
        )
        lbl_titulo.pack(anchor="w")

        lbl_sub = ctk.CTkLabel(
            header,
            text="Preencha os dados abaixo para cadastrar e acessar o sistema.",
            font=ctk.CTkFont(size=12),
            text_color="gray"
        )
        lbl_sub.pack(anchor="w", pady=(2, 0))

        # 2. Barra de Botões Fixa no Rodapé (SEMPRE VISÍVEL)
        bottom_bar = ctk.CTkFrame(self, fg_color=("gray90", "gray18"), height=75, corner_radius=12)
        bottom_bar.pack(side="bottom", fill="x", padx=15, pady=(5, 15))

        btn_cadastrar_acessar = ctk.CTkButton(
            bottom_bar, 
            text="✨ Cadastrar e Acessar", 
            height=40,
            fg_color="#059669", 
            hover_color="#047857",
            font=ctk.CTkFont(size=13, weight="bold"),
            command=self.salvar_e_acessar
        )
        btn_cadastrar_acessar.pack(side="left", fill="x", expand=True, padx=(15, 8), pady=12)

        btn_cancelar = ctk.CTkButton(
            bottom_bar,
            text="Voltar",
            height=40,
            width=90,
            fg_color="#4B5563",
            hover_color="#374151",
            font=ctk.CTkFont(size=12),
            command=self.destroy
        )
        btn_cancelar.pack(side="right", padx=(0, 15), pady=12)

        # 3. Formulário Central com ScrollableFrame (Garante que tudo caiba perfeitamente)
        form_scroll = ctk.CTkScrollableFrame(self, corner_radius=10)
        form_scroll.pack(fill="both", expand=True, padx=15, pady=(0, 10))

        ctk.CTkLabel(form_scroll, text="Nome Completo:", font=ctk.CTkFont(size=12, weight="bold")).pack(anchor="w", padx=10, pady=(10, 2))
        self.entry_nome = ctk.CTkEntry(form_scroll, placeholder_text="Ex: Maria Santos", height=36)
        self.entry_nome.pack(fill="x", padx=10, pady=(0, 8))

        ctk.CTkLabel(form_scroll, text="E-mail de Acesso:", font=ctk.CTkFont(size=12, weight="bold")).pack(anchor="w", padx=10, pady=(4, 2))
        self.entry_email = ctk.CTkEntry(form_scroll, placeholder_text="maria@empresa.com", height=36)
        self.entry_email.pack(fill="x", padx=10, pady=(0, 8))

        ctk.CTkLabel(form_scroll, text="Senha (mínimo 6 dígitos):", font=ctk.CTkFont(size=12, weight="bold")).pack(anchor="w", padx=10, pady=(4, 2))
        self.entry_senha = ctk.CTkEntry(form_scroll, placeholder_text="Digite sua senha", show="*", height=36)
        self.entry_senha.pack(fill="x", padx=10, pady=(0, 8))

        ctk.CTkLabel(form_scroll, text="Confirmar Senha:", font=ctk.CTkFont(size=12, weight="bold")).pack(anchor="w", padx=10, pady=(4, 2))
        self.entry_confirma_senha = ctk.CTkEntry(form_scroll, placeholder_text="Repita a senha", show="*", height=36)
        self.entry_confirma_senha.pack(fill="x", padx=10, pady=(0, 12))

        # Atalho de Enter nos campos
        self.entry_nome.bind("<Return>", lambda e: self.salvar_e_acessar())
        self.entry_email.bind("<Return>", lambda e: self.salvar_e_acessar())
        self.entry_senha.bind("<Return>", lambda e: self.salvar_e_acessar())
        self.entry_confirma_senha.bind("<Return>", lambda e: self.salvar_e_acessar())

        # Permissões de Empresas
        box_perm = ctk.CTkFrame(form_scroll, fg_color=("gray85", "gray20"), corner_radius=10)
        box_perm.pack(fill="x", padx=10, pady=(4, 15))

        self.var_acesso_todas = ctk.BooleanVar(value=False)
        self.check_todas = ctk.CTkCheckBox(
            box_perm, 
            text="Permitir acesso a TODAS as empresas (Perfil Administrador)",
            variable=self.var_acesso_todas,
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self.ao_alternar_check_todas
        )
        self.check_todas.pack(anchor="w", padx=15, pady=(12, 8))

        self.lbl_sel_emp = ctk.CTkLabel(
            box_perm, 
            text="Ou selecione as empresas autorizadas para este usuário:", 
            font=ctk.CTkFont(size=11),
            text_color="gray"
        )
        self.lbl_sel_emp.pack(anchor="w", padx=15, pady=(2, 4))

        self.frame_empresas = ctk.CTkFrame(box_perm, fg_color="transparent")
        self.frame_empresas.pack(fill="x", padx=15, pady=(0, 12))

        self.check_empresas_vars = {}
        empresas = self.db.listar_todas_empresas()
        for emp in empresas:
            var = ctk.BooleanVar(value=True if len(empresas) == 1 else False)
            cb = ctk.CTkCheckBox(self.frame_empresas, text=emp["nome"], variable=var)
            cb.pack(anchor="w", pady=4)
            self.check_empresas_vars[emp["id"]] = var

    def ao_alternar_check_todas(self):
        estado = "disabled" if self.var_acesso_todas.get() else "normal"
        for widget in self.frame_empresas.winfo_children():
            if isinstance(widget, ctk.CTkCheckBox):
                widget.configure(state=estado)

    def salvar_e_acessar(self):
        nome = self.entry_nome.get().strip()
        email = self.entry_email.get().strip().lower()
        senha = self.entry_senha.get().strip()
        confirma_senha = self.entry_confirma_senha.get().strip()
        acesso_todas = self.var_acesso_todas.get()

        if not nome:
            messagebox.showwarning("Aviso", "Por favor, preencha o Nome Completo.", parent=self)
            self.entry_nome.focus_set()
            return

        if not email or "@" not in email:
            messagebox.showwarning("Aviso", "Por favor, informe um e-mail válido.", parent=self)
            self.entry_email.focus_set()
            return

        if len(senha) < 6:
            messagebox.showwarning("Aviso", "A senha deve conter no mínimo 6 caracteres.", parent=self)
            self.entry_senha.focus_set()
            return

        if senha != confirma_senha:
            messagebox.showwarning("Aviso", "A confirmação de senha não confere com a senha digitada.", parent=self)
            self.entry_confirma_senha.focus_set()
            return

        empresas_selecionadas = [
            emp_id for emp_id, var in self.check_empresas_vars.items() if var.get()
        ]

        if not acesso_todas and not empresas_selecionadas:
            messagebox.showwarning("Aviso", "Selecione ao menos uma empresa permitida ou marque 'Permitir acesso a TODAS as empresas'.", parent=self)
            return

        try:
            self.db.cadastrar_usuario(
                nome=nome,
                email=email,
                senha=senha,
                acesso_todas=acesso_todas,
                empresas_ids=empresas_selecionadas
            )
            
            # Autenticar e acessar automaticamente
            usuario = self.db.autenticar_usuario(email, senha)
            if usuario:
                msg_bem_vindo = f"Conta criada com sucesso!\\nBem-vindo(a), {nome}!"
                messagebox.showinfo("Sucesso", msg_bem_vindo, parent=self)
                self.destroy()
                self.parent.withdraw()
                app_principal = SistemaFinanceiroApp(usuario_logado=usuario, db=self.db, login_window=self.parent)
                app_principal.mainloop()
            else:
                messagebox.showinfo("Sucesso", "Usuário cadastrado com sucesso! Você já pode fazer login.", parent=self)
                self.destroy()
        except sqlite3.IntegrityError:
            messagebox.showerror("Erro", "Já existe um usuário cadastrado com este e-mail.", parent=self)
        except Exception as e:
            messagebox.showerror("Erro", f"Ocorreu um erro ao cadastrar usuário: {e}", parent=self)


# ==============================================================================
# JANELA: NOVA CATEGORIA
# ==============================================================================
class NovaCategoriaModal(ctk.CTkToplevel):
    def __init__(self, parent, db, on_success_callback):
        super().__init__(parent)
        self.parent = parent
        self.db = db
        self.on_success_callback = on_success_callback

        self.title("Cadastrar Nova Categoria")
        self.geometry("380x220")
        self.resizable(False, False)

        self.grab_set()
        self.focus_set()

        ctk.CTkLabel(self, text="➕ Nova Categoria Personalizada", font=ctk.CTkFont(size=16, weight="bold")).pack(pady=(15, 10))

        frame = ctk.CTkFrame(self)
        frame.pack(padx=20, pady=5, fill="both", expand=True)

        ctk.CTkLabel(frame, text="Nome da Categoria:").pack(anchor="w", padx=15, pady=(10, 2))
        self.entry_cat = ctk.CTkEntry(frame, placeholder_text="Ex: Viagens & Hospedagem")
        self.entry_cat.pack(fill="x", padx=15, pady=(0, 10))

        btn = ctk.CTkButton(
            frame, 
            text="Salvar Categoria", 
            fg_color="#059669", 
            hover_color="#047857",
            font=ctk.CTkFont(weight="bold"),
            command=self.salvar
        )
        btn.pack(fill="x", padx=15, pady=(5, 10))

    def salvar(self):
        nome = self.entry_cat.get().strip()
        if not nome:
            messagebox.showwarning("Aviso", "Digite o nome da categoria.", parent=self)
            return
        self.db.cadastrar_categoria(nome)
        self.on_success_callback(nome)
        self.destroy()


# ==============================================================================
# JANELA: EXPORTAÇÃO E IMPORTAÇÃO CSV / EXCEL
# ==============================================================================
class CsvManager:
    """Exporta e importa lançamentos com formatação CSV compatível com Excel."""

    @staticmethod
    def exportar_csv(parent, db, empresa_id, permitidas_ids):
        contas_pagar = db.listar_contas_pagar(empresa_id=empresa_id, permitidas_ids=permitidas_ids)
        contas_rec = db.listar_contas_receber(empresa_id=empresa_id, permitidas_ids=permitidas_ids)

        caminho = filedialog.asksaveasfilename(
            parent=parent,
            title="Salvar Planilha Financeira (CSV / Excel)",
            defaultextension=".csv",
            filetypes=[("Arquivo CSV (Excel)", "*.csv"), ("Todos os arquivos", "*.*")]
        )
        if not caminho:
            return

        try:
            with open(caminho, mode="w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f, delimiter=";")
                # Cabeçalho
                writer.writerow(["ID", "Tipo", "Empresa", "Descrição", "Categoria", "Valor (R$)", "Vencimento", "Status"])

                for p in contas_pagar:
                    writer.writerow([
                        p["id"],
                        "Pagar",
                        p.get("empresa_nome", "Empresa"),
                        p["descricao"],
                        p.get("categoria", "Outros"),
                        f"{p['valor']:.2f}".replace(".", ","),
                        p["data_vencimento"],
                        p["status"]
                    ])

                for r in contas_rec:
                    writer.writerow([
                        r["id"],
                        "Receber",
                        r.get("empresa_nome", "Empresa"),
                        r["descricao"],
                        r.get("categoria", "Outros"),
                        f"{r['valor']:.2f}".replace(".", ","),
                        r["data_vencimento"],
                        r["status"]
                    ])

            msg = "Planilha exportada com sucesso em:\\n" + str(caminho)
            messagebox.showinfo("Sucesso", msg, parent=parent)
        except Exception as e:
            msg_erro = "Ocorreu um erro ao salvar o CSV:\\n" + str(e)
            messagebox.showerror("Erro ao Exportar", msg_erro, parent=parent)

    @staticmethod
    def importar_csv(parent, db, empresa_id, on_success_callback):
        if empresa_id == CONSOLIDATED_ID:
            messagebox.showwarning("Aviso", "Selecione uma empresa específica no topo antes de importar uma planilha.", parent=parent)
            return

        caminho = filedialog.askopenfilename(
            parent=parent,
            title="Selecionar Planilha CSV para Importar",
            filetypes=[("Arquivo CSV", "*.csv"), ("Arquivo de Texto", "*.txt"), ("Todos os arquivos", "*.*")]
        )
        if not caminho:
            return

        try:
            importados = 0
            with open(caminho, mode="r", encoding="utf-8-sig") as f:
                # Detectar delimitador (; ou ,)
                amostra = f.read(2048)
                f.seek(0)
                delimitador = ";" if ";" in amostra else ","

                reader = csv.reader(f, delimiter=delimitador)
                linhas = list(reader)

                if not linhas:
                    messagebox.showwarning("Aviso", "O arquivo selecionado está vazio.", parent=parent)
                    return

                # Pular cabeçalho se houver
                primeira_linha = [c.lower() for c in linhas[0]]
                tem_cabecalho = any("desc" in c or "valor" in c or "venc" in c or "tipo" in c for c in primeira_linha)
                dados = linhas[1:] if tem_cabecalho else linhas

                for row in dados:
                    if not row or len(row) < 3:
                        continue

                    # Extração flexível de colunas
                    tipo = "pagar"
                    descricao = "Sem descrição"
                    categoria = "Outros"
                    valor = 0.0
                    vencimento = datetime.now().strftime("%Y-%m-%d")
                    status = "Pendente"

                    # Se vier no padrão de 8 colunas do sistema
                    if len(row) >= 7:
                        tipo_str = row[1].strip().lower() if len(row) > 1 else ""
                        tipo = "receber" if "rec" in tipo_str else "pagar"
                        descricao = row[3].strip() if len(row) > 3 else row[0]
                        categoria = row[4].strip() if len(row) > 4 else "Outros"
                        val_raw = row[5].replace("R$", "").replace(" ", "").replace(".", "").replace(",", ".") if len(row) > 5 else "0"
                        valor = float(val_raw) if val_raw else 0.0
                        vencimento = row[6].strip() if len(row) > 6 else vencimento
                        status = row[7].strip() if len(row) > 7 else "Pendente"
                    else:
                        # Padrão simples: Descrição, Valor, Vencimento, Tipo/Categoria
                        descricao = row[0].strip()
                        val_raw = row[1].replace("R$", "").replace(" ", "").replace(",", ".")
                        valor = float(val_raw) if val_raw else 0.0
                        vencimento = row[2].strip() if len(row) > 2 else vencimento
                        if len(row) > 3:
                            if row[3].lower() in ["receber", "receita", "rec"]:
                                tipo = "receber"
                            else:
                                categoria = row[3].strip()

                    if tipo == "receber":
                        db.cadastrar_conta_receber(empresa_id, descricao, categoria, valor, vencimento, status)
                    else:
                        db.cadastrar_conta_pagar(empresa_id, descricao, categoria, valor, vencimento, status)

                    importados += 1

            msg_imp = f"Foram importados {importados} lançamentos com sucesso!"
            messagebox.showinfo("Importação Concluída", msg_imp, parent=parent)
            on_success_callback()
        except Exception as e:
            msg_imp_err = "Falha ao ler o arquivo CSV:\\n" + str(e)
            messagebox.showerror("Erro ao Importar", msg_imp_err, parent=parent)


# ==============================================================================
# JANELA: IMPORTAÇÃO INTELIGENTE DE EXTRATOS BANCÁRIOS & MAQUININHAS
# ==============================================================================
def classificar_categoria_inteligente(descricao, tipo):
    d = descricao.lower()
    if any(k in d for k in ['pix rec', 'venda', 'cielo', 'stone', 'pagseg', 'mercado p', 'rede', 'getnet', 'debito', 'credito', 'fatur', 'cliente', 'recebimento']):
        return 'Vendas PDV / Faturamento' if tipo == 'receber' else 'Impostos & Taxas'
    if any(k in d for k in ['tarifa', 'taxa', 'iof', 'mdr', 'manut', 'bancari', 'encarg', 'anuidade', 'juros', 'doc/ted', 'ted', 'doc']):
        return 'Impostos & Taxas'
    if any(k in d for k in ['aluguel', 'condomin', 'iptu', 'locac', 'imobiliaria']):
        return 'Aluguel'
    if any(k in d for k in ['salario', 'folha', 'fgts', 'inss', 'adiantamento', 'vale', 'pro-labore', 'beneficio', 'ferias', 'decimo']):
        return 'Pessoal & Salários'
    if any(k in d for k in ['energia', 'enel', 'cpfl', 'luz', 'agua', 'sabesp', 'internet', 'telecom', 'vivo', 'claro', 'tim', 'embratel']):
        return 'Utilidades (Água/Luz/Net)'
    if any(k in d for k in ['aws', 'google', 'microsoft', 'software', 'saas', 'adobe', 'chatgpt', 'github', 'hospedagem', 'cloud', 'oracle']):
        return 'Tecnologia & SaaS'
    if any(k in d for k in ['forneced', 'distribuid', 'compra', 'materia', 'mercadoria', 'embalag', 'insumo', 'atacad', 'varejo']):
        return 'Estoque & Fornecedores'
    if any(k in d for k in ['consult', 'honorario', 'contabil', 'advoc', 'juridic', 'auditoria']):
        return 'Consultoria'
    if any(k in d for k in ['marketing', 'facebk', 'meta', 'anuncio', 'google ads', 'propaganda', 'grafica', 'midia']):
        return 'Marketing & Vendas'
    return 'Serviços Prestados' if tipo == 'receber' else 'Geral'


class ExtratoImportWindow(ctk.CTkToplevel):
    def __init__(self, parent, db, empresa_atual_id, permitidas_empresas, on_success_callback):
        super().__init__(parent)
        self.parent = parent
        self.db = db
        self.empresa_atual_id = empresa_atual_id
        self.permitidas_empresas = permitidas_empresas
        self.on_success_callback = on_success_callback

        self.transacoes_lidas = []
        self.categorias_sistema = self.db.listar_categorias()

        self.title("Conectecontas - Importador de Extratos Bancários & Maquininhas")
        self.geometry("1020x690")
        self.minsize(860, 560)
        self.resizable(True, True)

        self.grab_set()
        self.focus_set()
        self.criar_widgets()

    def criar_widgets(self):
        # 1. Top Header
        header = ctk.CTkFrame(self, fg_color="transparent")
        header.pack(fill="x", padx=20, pady=(15, 8))

        lbl_titulo = ctk.CTkLabel(
            header,
            text="📑 Importar Extratos Bancários & Maquininhas de Cartão",
            font=ctk.CTkFont(size=18, weight="bold")
        )
        lbl_titulo.pack(anchor="w")

        lbl_sub = ctk.CTkLabel(
            header,
            text="Suporte a arquivos OFX (Itaú, Bradesco, Santander, BB, Nubank, Inter, Caixa, etc.), CSV, TXT e Maquininhas com categorização automática.",
            font=ctk.CTkFont(size=12),
            text_color="gray"
        )
        lbl_sub.pack(anchor="w", pady=(2, 0))

        # 2. Configurações de Destino
        config_box = ctk.CTkFrame(self, fg_color=("gray85", "gray20"), corner_radius=10)
        config_box.pack(fill="x", padx=20, pady=(4, 10))

        ctk.CTkLabel(config_box, text="Empresa de Destino:", font=ctk.CTkFont(weight="bold")).grid(row=0, column=0, padx=12, pady=10, sticky="w")
        
        emp_nomes = [e["nome"] for e in self.permitidas_empresas]
        self.combo_dest_emp = ctk.CTkComboBox(config_box, width=240, values=emp_nomes if emp_nomes else ["Empresa Padrão"])
        if emp_nomes:
            emp_sel = next((e["nome"] for e in self.permitidas_empresas if e["id"] == self.empresa_atual_id), emp_nomes[0])
            self.combo_dest_emp.set(emp_sel)
        self.combo_dest_emp.grid(row=0, column=1, padx=6, pady=10, sticky="w")

        ctk.CTkLabel(config_box, text="Status dos Lançamentos:", font=ctk.CTkFont(weight="bold")).grid(row=0, column=2, padx=12, pady=10, sticky="w")
        self.combo_status_def = ctk.CTkComboBox(config_box, width=170, values=["Pago / Recebido", "Pendente"])
        self.combo_status_def.set("Pago / Recebido")
        self.combo_status_def.grid(row=0, column=3, padx=6, pady=10, sticky="w")

        # 3. Abas de Origem de Arquivo
        self.tabview = ctk.CTkTabview(self, height=130)
        self.tabview.pack(fill="x", padx=20, pady=(0, 10))

        tab_ofx = self.tabview.add("🏦 Extrato Bancário (OFX / QFX / CSV)")
        tab_card = self.tabview.add("💳 Maquininhas de Cartão (Stone / Cielo / Rede / PagSeguro)")
        tab_paste = self.tabview.add("📋 Colar Texto do Extrato")

        # Aba 1: OFX / CSV Bancário
        f_ofx = ctk.CTkFrame(tab_ofx, fg_color="transparent")
        f_ofx.pack(fill="both", expand=True, padx=10, pady=5)
        
        btn_sel_ofx = ctk.CTkButton(
            f_ofx,
            text="📂 Selecionar Arquivo OFX / CSV / TXT...",
            height=36,
            fg_color="#0284C7",
            hover_color="#0369A1",
            font=ctk.CTkFont(weight="bold"),
            command=self.abrir_arquivo_ofx_csv
        )
        btn_sel_ofx.pack(side="left", padx=(0, 15))

        self.lbl_arq_ofx = ctk.CTkLabel(f_ofx, text="Nenhum arquivo carregado", text_color="gray", font=ctk.CTkFont(size=12))
        self.lbl_arq_ofx.pack(side="left")

        # Aba 2: Maquininhas
        f_card = ctk.CTkFrame(tab_card, fg_color="transparent")
        f_card.pack(fill="both", expand=True, padx=10, pady=5)

        self.var_separar_mdr = ctk.BooleanVar(value=True)
        cb_mdr = ctk.CTkCheckBox(
            f_card, 
            text="Separar Taxa MDR (Lançar Receita Bruta + Despesa da Taxa)", 
            variable=self.var_separar_mdr,
            font=ctk.CTkFont(size=12)
        )
        cb_mdr.pack(anchor="w", pady=(0, 6))

        btn_sel_card = ctk.CTkButton(
            f_card,
            text="📂 Selecionar Relatório de Vendas (CSV / TXT)...",
            height=34,
            fg_color="#0D9488",
            hover_color="#0F766E",
            font=ctk.CTkFont(weight="bold"),
            command=self.abrir_arquivo_maquininhas
        )
        btn_sel_card.pack(side="left", padx=(0, 15))

        self.lbl_arq_card = ctk.CTkLabel(f_card, text="Nenhum relatório carregado", text_color="gray", font=ctk.CTkFont(size=12))
        self.lbl_arq_card.pack(side="left")

        # Aba 3: Colar Texto
        f_paste = ctk.CTkFrame(tab_paste, fg_color="transparent")
        f_paste.pack(fill="both", expand=True, padx=10, pady=2)

        self.txt_colar = ctk.CTkTextbox(f_paste, height=60)
        self.txt_colar.pack(side="left", fill="both", expand=True, padx=(0, 10))

        btn_proc_paste = ctk.CTkButton(
            f_paste,
            text="⚡ Processar\\nTexto",
            width=100,
            height=60,
            fg_color="#4F46E5",
            hover_color="#4338CA",
            font=ctk.CTkFont(weight="bold"),
            command=self.processar_texto_colado
        )
        btn_proc_paste.pack(side="right")

        # 4. Painel Central com Lista de Prévia de Lançamentos
        box_preview = ctk.CTkFrame(self)
        box_preview.pack(fill="both", expand=True, padx=20, pady=(0, 10))

        # Cabeçalho da Lista
        top_list = ctk.CTkFrame(box_preview, fg_color=("gray80", "gray25"), height=38)
        top_list.pack(fill="x", padx=6, pady=6)

        self.var_todos = ctk.BooleanVar(value=True)
        cb_todos = ctk.CTkCheckBox(top_list, text="", width=24, variable=self.var_todos, command=self.alternar_todos)
        cb_todos.pack(side="left", padx=(8, 4))

        ctk.CTkLabel(top_list, text="Tipo", width=85, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=4)
        ctk.CTkLabel(top_list, text="Data", width=95, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=4)
        ctk.CTkLabel(top_list, text="Descrição do Extrato", font=ctk.CTkFont(weight="bold"), anchor="w").pack(side="left", fill="x", expand=True, padx=8)
        ctk.CTkLabel(top_list, text="Categoria Sugerida", width=170, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=4)
        ctk.CTkLabel(top_list, text="Valor (R$)", width=110, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=4)
        ctk.CTkLabel(top_list, text="Origem", width=120, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=6)

        self.scroll_transacoes = ctk.CTkScrollableFrame(box_preview)
        self.scroll_transacoes.pack(fill="both", expand=True, padx=6, pady=(0, 6))

        self.lbl_vazio = ctk.CTkLabel(
            self.scroll_transacoes,
            text="Carregue um arquivo OFX/CSV ou cole o extrato acima para visualizar a prévia aqui.",
            font=ctk.CTkFont(size=13),
            text_color="gray"
        )
        self.lbl_vazio.pack(pady=40)

        # 5. Barra Inferior Fixa
        bottom_bar = ctk.CTkFrame(self, fg_color=("gray90", "gray18"), height=65, corner_radius=10)
        bottom_bar.pack(side="bottom", fill="x", padx=20, pady=(0, 15))

        self.lbl_resumo_totais = ctk.CTkLabel(
            bottom_bar,
            text="0 lançamentos selecionados (Receitas: R$ 0,00 | Despesas: R$ 0,00)",
            font=ctk.CTkFont(size=12, weight="bold")
        )
        self.lbl_resumo_totais.pack(side="left", padx=20, pady=12)

        btn_cancelar = ctk.CTkButton(
            bottom_bar,
            text="Cancelar",
            width=90,
            height=36,
            fg_color="#4B5563",
            hover_color="#374151",
            command=self.destroy
        )
        btn_cancelar.pack(side="right", padx=(0, 15), pady=12)

        self.btn_confirmar_imp = ctk.CTkButton(
            bottom_bar,
            text="📥 Importar Lançamentos Selecionados",
            height=36,
            fg_color="#059669",
            hover_color="#047857",
            font=ctk.CTkFont(weight="bold"),
            command=self.salvar_importacao
        )
        self.btn_confirmar_imp.pack(side="right", padx=(0, 10), pady=12)

    def abrir_arquivo_ofx_csv(self):
        caminho = filedialog.askopenfilename(
            parent=self,
            title="Selecionar Extrato Bancário",
            filetypes=[
                ("Extratos Bancários (*.ofx, *.qfx, *.csv, *.txt)", "*.ofx;*.qfx;*.csv;*.txt"),
                ("Extrato OFX / QFX", "*.ofx;*.qfx"),
                ("Planilha CSV / TXT", "*.csv;*.txt"),
                ("Todos os arquivos", "*.*")
            ]
        )
        if not caminho:
            return

        try:
            nome_arq = os.path.basename(caminho)
            self.lbl_arq_ofx.configure(text=f"Carregado: {nome_arq}", text_color="#10B981")
            
            conteudo = ""
            for enc in ["utf-8-sig", "latin1", "cp1252", "utf-8"]:
                try:
                    with open(caminho, "r", encoding=enc) as f:
                        conteudo = f.read()
                    break
                except UnicodeDecodeError:
                    continue

            if not conteudo:
                messagebox.showerror("Erro", "Não foi possível ler a codificação do arquivo.", parent=self)
                return

            if "<OFX>" in conteudo.upper() or "<STMTTRN>" in conteudo.upper():
                self.processar_ofx(conteudo, nome_arq)
            else:
                self.processar_csv_ou_texto(conteudo, nome_arq)

        except Exception as e:
            messagebox.showerror("Erro na Leitura", f"Falha ao ler extrato: {e}", parent=self)

    def abrir_arquivo_maquininhas(self):
        caminho = filedialog.askopenfilename(
            parent=self,
            title="Selecionar Relatório de Vendas da Maquininha",
            filetypes=[
                ("Relatório Maquininha (*.csv, *.txt)", "*.csv;*.txt"),
                ("Todos os arquivos", "*.*")
            ]
        )
        if not caminho:
            return

        try:
            nome_arq = os.path.basename(caminho)
            self.lbl_arq_card.configure(text=f"Carregado: {nome_arq}", text_color="#10B981")
            
            conteudo = ""
            for enc in ["utf-8-sig", "latin1", "cp1252", "utf-8"]:
                try:
                    with open(caminho, "r", encoding=enc) as f:
                        conteudo = f.read()
                    break
                except UnicodeDecodeError:
                    continue

            self.processar_maquininhas(conteudo, nome_arq, self.var_separar_mdr.get())

        except Exception as e:
            messagebox.showerror("Erro na Leitura", f"Falha ao ler relatório de maquininhas: {e}", parent=self)

    def processar_texto_colado(self):
        texto = self.txt_colar.get("1.0", "end").strip()
        if not texto:
            messagebox.showwarning("Aviso", "Cole o texto do extrato bancário no campo antes de processar.", parent=self)
            return

        if "<OFX>" in texto.upper() or "<STMTTRN>" in texto.upper():
            self.processar_ofx(texto, "Extrato Colado (OFX)")
        else:
            self.processar_csv_ou_texto(texto, "Texto do Extrato Colado")

    def processar_ofx(self, conteudo, nome_origem):
        resultados = []
        blocos = re.findall(r'<STMTTRN>(.*?)</STMTTRN>', conteudo, re.DOTALL | re.IGNORECASE)

        for i, b in enumerate(blocos, 1):
            def get_val(tag):
                m = re.search(r'<' + tag + r'>([^<]+)', b, re.IGNORECASE)
                if m:
                    return " ".join(m.group(1).split())
                return ''

            trn_type = get_val('TRNTYPE').upper()
            raw_amt = get_val('TRNAMT').replace(',', '.')
            dt_posted = get_val('DTPOSTED')
            memo = get_val('MEMO') or get_val('NAME') or f"Transação OFX #{i}"

            try:
                val_num = float(raw_amt)
            except ValueError:
                continue

            is_rec = (val_num > 0) or trn_type in ('CREDIT', 'DEP')
            tipo = 'receber' if is_rec else 'pagar'

            data_str = datetime.now().strftime('%Y-%m-%d')
            if len(dt_posted) >= 8:
                data_str = f"{dt_posted[:4]}-{dt_posted[4:6]}-{dt_posted[6:8]}"

            cat = classificar_categoria_inteligente(memo, tipo)

            resultados.append({
                "tipo": tipo,
                "descricao": memo,
                "categoria": cat,
                "valor": abs(val_num),
                "data": data_str,
                "origem": nome_origem
            })

        self.exibir_resultados_na_tabela(resultados)

    def processar_csv_ou_texto(self, conteudo, nome_origem):
        resultados = []
        linhas = [l.strip() for l in conteudo.splitlines() if l.strip()]
        if not linhas:
            messagebox.showwarning("Aviso", "Nenhuma linha válida encontrada no texto.", parent=self)
            return

        delim = ';' if ';' in linhas[0] else (',' if ',' in linhas[0] else '\\t')
        reader = csv.reader(linhas, delimiter=delim)
        linhas_csv = list(reader)

        for i, row in enumerate(linhas_csv, 1):
            if not row or len(row) < 2:
                continue

            j_str = " ".join(row).lower()
            if any(c in j_str for c in ['data', 'lançamento', 'historico', 'descricao', 'valor', 'saldo', 'documento']) and i == 1:
                continue

            data_str = datetime.now().strftime('%Y-%m-%d')
            desc = "Lançamento de Extrato"
            valor_num = 0.0
            tipo = "pagar"

            for item in row:
                item_s = item.strip()
                m_br = re.search(r'(\\d{2})[/.-](\\d{2})[/.-](\\d{4})', item_s)
                if m_br:
                    data_str = f"{m_br.group(3)}-{m_br.group(2)}-{m_br.group(1)}"
                    break
                m_iso = re.search(r'(\\d{4})[/.-](\\d{2})[/.-](\\d{2})', item_s)
                if m_iso:
                    data_str = f"{m_iso.group(1)}-{m_iso.group(2)}-{m_iso.group(3)}"
                    break

            for item in reversed(row):
                item_clean = item.replace('R$', '').replace(' ', '').strip()
                if not item_clean:
                    continue
                s_num = item_clean.replace('.', '').replace(',', '.') if ',' in item_clean else item_clean
                try:
                    v = float(s_num)
                    valor_num = abs(v)
                    if v > 0 or 'c' in item.lower() or 'credito' in j_str or 'dep' in j_str:
                        tipo = 'receber'
                    else:
                        tipo = 'pagar'
                    break
                except ValueError:
                    continue

            possiveis_desc = [c.strip() for c in row if not re.search(r'\\d{2}/\\d{2}', c) and not re.search(r'^-?[\\d.,]+$', c.replace('R$', '').strip())]
            if possiveis_desc:
                desc = max(possiveis_desc, key=len)
            else:
                desc = f"Lançamento #{i}"

            if valor_num > 0:
                cat = classificar_categoria_inteligente(desc, tipo)
                resultados.append({
                    "tipo": tipo,
                    "descricao": desc,
                    "categoria": cat,
                    "valor": valor_num,
                    "data": data_str,
                    "origem": nome_origem
                })

        self.exibir_resultados_na_tabela(resultados)

    def processar_maquininhas(self, conteudo, nome_origem, separar_taxas):
        resultados = []
        linhas = [l.strip() for l in conteudo.splitlines() if l.strip()]
        if not linhas:
            return

        delim = ';' if ';' in linhas[0] else (',' if ',' in linhas[0] else '\\t')
        reader = csv.reader(linhas, delimiter=delim)
        linhas_csv = list(reader)

        for i, row in enumerate(linhas_csv, 1):
            if not row or len(row) < 2:
                continue

            j_str = " ".join(row).lower()
            if i == 1 and any(c in j_str for c in ['bandeira', 'bruto', 'liquido', 'taxa', 'mdr', 'parcela', 'data']):
                continue

            nums = []
            for c in row:
                s_num = c.replace('R$', '').replace(' ', '').replace('.', '').replace(',', '.').strip()
                try:
                    n = float(s_num)
                    nums.append(n)
                except ValueError:
                    pass

            data_str = datetime.now().strftime('%Y-%m-%d')
            for item in row:
                m_br = re.search(r'(\\d{2})[/.-](\\d{2})[/.-](\\d{4})', item)
                if m_br:
                    data_str = f"{m_br.group(3)}-{m_br.group(2)}-{m_br.group(1)}"
                    break

            desc_bandeira = "Venda Maquininha"
            for c in row:
                cl = c.strip().lower()
                if any(b in cl for b in ['master', 'visa', 'elo', 'hiper', 'pix', 'debito', 'credito', 'voucher']):
                    desc_bandeira = f"Venda {c.strip()} (Maquininha)"
                    break

            if nums:
                val_liquido = nums[-1]
                val_bruto = nums[0] if len(nums) > 1 else val_liquido
                taxa = (val_bruto - val_liquido) if (len(nums) > 1 and val_bruto > val_liquido) else 0.0

                if separar_taxas and taxa > 0:
                    resultados.append({
                        "tipo": "receber",
                        "descricao": desc_bandeira,
                        "categoria": "Vendas PDV / Faturamento",
                        "valor": val_bruto,
                        "data": data_str,
                        "origem": "Maquininha (Bruto)"
                    })
                    resultados.append({
                        "tipo": "pagar",
                        "descricao": f"Taxa MDR / Maquininha ({desc_bandeira})",
                        "categoria": "Impostos & Taxas",
                        "valor": taxa,
                        "data": data_str,
                        "origem": "Taxa Maquininha"
                    })
                else:
                    resultados.append({
                        "tipo": "receber",
                        "descricao": desc_bandeira,
                        "categoria": "Vendas PDV / Faturamento",
                        "valor": val_liquido,
                        "data": data_str,
                        "origem": "Maquininha (Líquido)"
                    })

        self.exibir_resultados_na_tabela(resultados)

    def exibir_resultados_na_tabela(self, resultados):
        for w in self.scroll_transacoes.winfo_children():
            w.destroy()

        self.transacoes_lidas = []

        if not resultados:
            ctk.CTkLabel(self.scroll_transacoes, text="Nenhum lançamento identificado no arquivo/texto informado.", font=ctk.CTkFont(size=13)).pack(pady=40)
            self.atualizar_resumo_totais()
            return

        for t in resultados:
            var_chk = ctk.BooleanVar(value=True)
            row_frame = ctk.CTkFrame(self.scroll_transacoes, fg_color=("gray90", "gray18"))
            row_frame.pack(fill="x", pady=2)

            cb = ctk.CTkCheckBox(row_frame, text="", width=24, variable=var_chk, command=self.atualizar_resumo_totais)
            cb.pack(side="left", padx=(8, 4))

            cor_tipo = "#10B981" if t["tipo"] == "receber" else "#EF4444"
            txt_tipo = "Receber" if t["tipo"] == "receber" else "Pagar"
            ctk.CTkLabel(row_frame, text=txt_tipo, width=85, text_color=cor_tipo, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=4)

            ctk.CTkLabel(row_frame, text=t["data"], width=95).pack(side="left", padx=4)

            ctk.CTkLabel(row_frame, text=t["descricao"][:45], anchor="w").pack(side="left", fill="x", expand=True, padx=8)

            combo_cat = ctk.CTkComboBox(row_frame, width=170, values=self.categorias_sistema)
            combo_cat.set(t["categoria"] if t["categoria"] in self.categorias_sistema else "Outros")
            combo_cat.pack(side="left", padx=4)

            ctk.CTkLabel(row_frame, text=f"R$ {t['valor']:,.2f}", width=110, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=4)

            ctk.CTkLabel(row_frame, text=t.get("origem", "")[:16], width=120, font=ctk.CTkFont(size=11), text_color="gray").pack(side="left", padx=6)

            self.transacoes_lidas.append({
                "var_chk": var_chk,
                "tipo": t["tipo"],
                "data": t["data"],
                "descricao": t["descricao"],
                "combo_cat": combo_cat,
                "valor": t["valor"],
                "origem": t.get("origem", "")
            })

        self.atualizar_resumo_totais()

    def alternar_todos(self):
        val = self.var_todos.get()
        for item in self.transacoes_lidas:
            item["var_chk"].set(val)
        self.atualizar_resumo_totais()

    def atualizar_resumo_totais(self):
        selecionados = [t for t in self.transacoes_lidas if t["var_chk"].get()]
        total_count = len(selecionados)
        total_rec = sum(t["valor"] for t in selecionados if t["tipo"] == "receber")
        total_pag = sum(t["valor"] for t in selecionados if t["tipo"] == "pagar")

        msg = f"{total_count} de {len(self.transacoes_lidas)} lançamentos selecionados (Receitas: R$ {total_rec:,.2f} | Despesas: R$ {total_pag:,.2f})"
        self.lbl_resumo_totais.configure(text=msg)
        self.btn_confirmar_imp.configure(text=f"📥 Importar {total_count} Lançamentos Selecionados")

    def salvar_importacao(self):
        selecionados = [t for t in self.transacoes_lidas if t["var_chk"].get()]
        if not selecionados:
            messagebox.showwarning("Aviso", "Nenhum lançamento foi selecionado para importação.", parent=self)
            return

        nome_emp_sel = self.combo_dest_emp.get()
        emp_obj = next((e for e in self.permitidas_empresas if e["nome"] == nome_emp_sel), None)
        if not emp_obj:
            if self.permitidas_empresas:
                emp_obj = self.permitidas_empresas[0]
            else:
                messagebox.showerror("Erro", "Nenhuma empresa cadastrada no sistema.", parent=self)
                return

        status_escolhido = "Pago" if self.combo_status_def.get() == "Pago / Recebido" else "Pendente"
        emp_id = emp_obj["id"]

        try:
            importados = 0
            for t in selecionados:
                cat = t["combo_cat"].get().strip() or "Outros"
                st = ( "Recebido" if status_escolhido == "Pago" else "Pendente" ) if t["tipo"] == "receber" else status_escolhido

                if t["tipo"] == "receber":
                    self.db.cadastrar_conta_receber(emp_id, t["descricao"], cat, t["valor"], t["data"], st)
                else:
                    self.db.cadastrar_conta_pagar(emp_id, t["descricao"], cat, t["valor"], t["data"], st)
                importados += 1

            msg_sucesso = f"Foram importados {importados} lançamentos na empresa '{emp_obj['nome']}' com sucesso!"
            messagebox.showinfo("Sucesso", msg_sucesso, parent=self)
            self.on_success_callback()
            self.destroy()

        except Exception as e:
            messagebox.showerror("Erro", f"Falha ao salvar lançamentos no banco: {e}", parent=self)


# ==============================================================================
# JANELA: GERENCIAMENTO DE USUÁRIOS E PERMISSÕES
# ==============================================================================
class UsuariosWindow(ctk.CTkToplevel):
    def __init__(self, parent, db, usuario_logado, on_update_callback):
        super().__init__(parent)
        self.parent = parent
        self.db = db
        self.usuario_logado = usuario_logado
        self.on_update_callback = on_update_callback

        self.title("Gerenciador de Usuários & Permissões")
        self.geometry("600x480")
        self.resizable(False, False)

        self.grab_set()
        self.focus_set()
        self.criar_widgets()
        self.carregar_usuarios()

    def criar_widgets(self):
        lbl_titulo = ctk.CTkLabel(self, text="Usuários Cadastrados no Sistema", font=ctk.CTkFont(size=18, weight="bold"))
        lbl_titulo.pack(pady=(15, 10))

        self.scroll_usuarios = ctk.CTkScrollableFrame(self)
        self.scroll_usuarios.pack(fill="both", expand=True, padx=20, pady=(0, 15))

    def carregar_usuarios(self):
        for w in self.scroll_usuarios.winfo_children():
            w.destroy()

        usuarios = self.db.listar_usuarios()
        for u in usuarios:
            card = ctk.CTkFrame(self.scroll_usuarios, fg_color=("gray85", "gray20"))
            card.pack(fill="x", pady=4, padx=5)

            info_frame = ctk.CTkFrame(card, fg_color="transparent")
            info_frame.pack(side="left", padx=10, pady=8, fill="x", expand=True)

            txt_nome = "👤 " + str(u['nome']) + (" (Você)" if u['id'] == self.usuario_logado['id'] else "")
            ctk.CTkLabel(info_frame, text=txt_nome, font=ctk.CTkFont(size=13, weight="bold"), anchor="w").pack(fill="x")
            
            tipo_acesso = "Acesso Global (Todas as Empresas)" if u["acesso_todas_empresas"] else "Acesso Restrito a Empresas Vinculadas"
            ctk.CTkLabel(info_frame, text="E-mail: " + str(u['email']) + " | " + tipo_acesso, font=ctk.CTkFont(size=11), text_color="gray", anchor="w").pack(fill="x")

            if u["id"] != self.usuario_logado["id"] and len(usuarios) > 1:
                btn_del = ctk.CTkButton(
                    card, 
                    text="Excluir", 
                    width=65, 
                    height=26, 
                    fg_color="#DC2626", 
                    hover_color="#991B1B",
                    command=lambda u_id=u["id"]: self.excluir_user(u_id)
                )
                btn_del.pack(side="right", padx=10, pady=8)

    def excluir_user(self, user_id):
        if messagebox.askyesno("Confirmar", "Deseja realmente excluir este usuário?", parent=self):
            self.db.excluir_usuario(user_id)
            self.carregar_usuarios()
            self.on_update_callback()


# ==============================================================================
# JANELA: GERENCIAMENTO DE EMPRESAS
# ==============================================================================
class EmpresaWindow(ctk.CTkToplevel):
    def __init__(self, parent, db, on_update_callback):
        super().__init__(parent)
        self.parent = parent
        self.db = db
        self.on_update_callback = on_update_callback

        self.title("Gerenciador de Empresas")
        self.geometry("550x450")
        self.resizable(False, False)

        self.grab_set()
        self.focus_set()
        self.criar_widgets()
        self.carregar_empresas()

    def criar_widgets(self):
        titulo = ctk.CTkLabel(self, text="Cadastro de Empresas", font=ctk.CTkFont(size=18, weight="bold"))
        titulo.pack(pady=(15, 10))

        frame_form = ctk.CTkFrame(self)
        frame_form.pack(padx=20, pady=10, fill="x")

        ctk.CTkLabel(frame_form, text="Nome da Empresa:").grid(row=0, column=0, padx=10, pady=8, sticky="w")
        self.entry_nome = ctk.CTkEntry(frame_form, width=220, placeholder_text="Ex: Minha Filial 02")
        self.entry_nome.grid(row=0, column=1, padx=10, pady=8)

        ctk.CTkLabel(frame_form, text="CNPJ (opcional):").grid(row=1, column=0, padx=10, pady=8, sticky="w")
        self.entry_cnpj = ctk.CTkEntry(frame_form, width=220, placeholder_text="00.000.000/0000-00")
        self.entry_cnpj.grid(row=1, column=1, padx=10, pady=8)

        btn_salvar = ctk.CTkButton(
            frame_form, 
            text="Salvar Empresa", 
            fg_color="#2563EB", 
            hover_color="#1D4ED8",
            command=self.salvar_empresa
        )
        btn_salvar.grid(row=2, column=0, columnspan=2, pady=(5, 12))

        ctk.CTkLabel(self, text="Empresas Cadastradas:", font=ctk.CTkFont(size=14, weight="bold")).pack(anchor="w", padx=25, pady=(10, 5))

        self.scroll_empresas = ctk.CTkScrollableFrame(self, height=160)
        self.scroll_empresas.pack(padx=20, pady=5, fill="both", expand=True)

    def carregar_empresas(self):
        for widget in self.scroll_empresas.winfo_children():
            widget.destroy()

        empresas = self.db.listar_todas_empresas()
        if not empresas:
            ctk.CTkLabel(self.scroll_empresas, text="Nenhuma empresa cadastrada.").pack(pady=20)
            return

        for emp in empresas:
            item_frame = ctk.CTkFrame(self.scroll_empresas, fg_color=("gray85", "gray20"))
            item_frame.pack(fill="x", pady=4, padx=5)

            texto = "🏢 " + str(emp['nome'])
            if emp['cnpj']:
                texto += "  (CNPJ: " + str(emp['cnpj']) + ")"

            lbl = ctk.CTkLabel(item_frame, text=texto, anchor="w")
            lbl.pack(side="left", padx=10, pady=6)

            btn_del = ctk.CTkButton(
                item_frame, 
                text="Excluir", 
                width=65, 
                height=26, 
                fg_color="#DC2626", 
                hover_color="#991B1B",
                command=lambda e_id=emp["id"], e_nome=emp["nome"]: self.excluir_empresa(e_id, e_nome)
            )
            btn_del.pack(side="right", padx=10, pady=6)

    def salvar_empresa(self):
        nome = self.entry_nome.get().strip()
        cnpj = self.entry_cnpj.get().strip()

        if not nome:
            messagebox.showwarning("Aviso", "Por favor, informe o nome da empresa.", parent=self)
            return

        try:
            self.db.cadastrar_empresa(nome, cnpj)
            self.entry_nome.delete(0, "end")
            self.entry_cnpj.delete(0, "end")
            self.carregar_empresas()
            self.on_update_callback()
            messagebox.showinfo("Sucesso", "Empresa cadastrada com sucesso!", parent=self)
        except sqlite3.IntegrityError:
            messagebox.showerror("Erro", "Já existe uma empresa cadastrada com esse nome.", parent=self)

    def excluir_empresa(self, empresa_id, empresa_nome):
        empresas = self.db.listar_todas_empresas()
        if len(empresas) <= 1:
            messagebox.showwarning("Aviso", "Você deve manter ao menos uma empresa cadastrada no sistema.", parent=self)
            return

        confirma = messagebox.askyesno(
            "Confirmar Exclusão",
            f"Deseja realmente excluir a empresa '{empresa_nome}' e todos os seus lançamentos?",
            parent=self
        )
        if confirma:
            self.db.excluir_empresa(empresa_id)
            self.carregar_empresas()
            self.on_update_callback()


# ==============================================================================
# JANELA: GRÁFICOS COMPARATIVOS (MATPLOTLIB) - INDIVIDUAL E CONSOLIDADO
# ==============================================================================
class GraficosWindow(ctk.CTkToplevel):
    def __init__(self, parent, db, empresa_id, empresa_nome, permitidas_empresas):
        super().__init__(parent)
        self.parent = parent
        self.db = db
        self.empresa_id = empresa_id
        self.empresa_nome = empresa_nome
        self.permitidas_empresas = permitidas_empresas
        self.permitidas_ids = [e["id"] for e in permitidas_empresas]

        self.title("Relatórios Gráficos - " + str(self.empresa_nome))
        self.geometry("860x650")
        self.minsize(750, 520)

        self.grab_set()
        self.focus_set()
        self.criar_grafico()

    def criar_grafico(self):
        is_consolidated = (self.empresa_id == CONSOLIDATED_ID)

        header_frame = ctk.CTkFrame(self, fg_color="transparent")
        header_frame.pack(fill="x", padx=20, pady=(15, 5))

        lbl_titulo = ctk.CTkLabel(
            header_frame, 
            text="Comparativo Financeiro Consolidado Multiempresa" if is_consolidated else f"Comparativo Mensal: {self.empresa_nome}", 
            font=ctk.CTkFont(size=18, weight="bold")
        )
        lbl_titulo.pack(anchor="w")

        stats = self.db.obter_estatisticas(empresa_id=self.empresa_id, permitidas_ids=self.permitidas_ids)
        lbl_sub = ctk.CTkLabel(
            header_frame,
            text=f"Total Receitas: R$ {stats['total_receitas']:,.2f} | Total Gastos: R$ {stats['total_gastos']:,.2f} | Saldo Geral: R$ {stats['saldo_geral']:,.2f}",
            font=ctk.CTkFont(size=12),
            text_color="#38BDF8"
        )
        lbl_sub.pack(anchor="w", pady=(2, 0))

        modo = ctk.get_appearance_mode()
        is_dark = (modo == "Dark")

        bg_color = "#1E293B" if is_dark else "#F8FAFC"
        card_color = "#0F172A" if is_dark else "#FFFFFF"
        text_color = "#F8FAFC" if is_dark else "#0F172A"
        grid_color = "#334155" if is_dark else "#E2E8F0"

        fig, ax = plt.subplots(figsize=(8.5, 4.8), dpi=100)
        fig.patch.set_facecolor(bg_color)
        ax.set_facecolor(card_color)

        if is_consolidated and len(self.permitidas_empresas) > 1:
            # Gráfico Comparativo entre as Empresas
            nomes_emp = []
            rec_emp = []
            pag_emp = []

            for emp in self.permitidas_empresas:
                st = self.db.obter_estatisticas(empresa_id=emp["id"])
                nomes_emp.append(emp["nome"][:14] + ("..." if len(emp["nome"]) > 14 else ""))
                rec_emp.append(st["total_receitas"])
                pag_emp.append(st["total_gastos"])

            x = np.arange(len(nomes_emp))
            largura = 0.35

            b_rec = ax.bar(x - largura/2, rec_emp, largura, label="Receitas", color="#10B981", zorder=3)
            b_pag = ax.bar(x + largura/2, pag_emp, largura, label="Despesas", color="#EF4444", zorder=3)

            for b in b_rec:
                h = b.get_height()
                if h > 0:
                    ax.annotate(f"R$ {h:,.0f}", xy=(b.get_x() + b.get_width()/2, h), xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=8, color=text_color, fontweight='bold')

            for b in b_pag:
                h = b.get_height()
                if h > 0:
                    ax.annotate(f"R$ {h:,.0f}", xy=(b.get_x() + b.get_width()/2, h), xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=8, color=text_color, fontweight='bold')

            ax.set_xticks(x)
            ax.set_xticklabels(nomes_emp, color=text_color, fontsize=9)
            ax.set_xlabel("Empresas Cadastradas", color=text_color, fontsize=10, labelpad=8)
        else:
            # Gráfico Mensal da Empresa
            dados = stats["dados_mensais"]
            meses = dados["meses"]
            gastos = dados["gastos"]
            receitas = dados["receitas"]

            if not meses:
                aviso = ctk.CTkLabel(self, text="Ainda não existem lançamentos suficientes para gerar o gráfico.", font=ctk.CTkFont(size=14))
                aviso.pack(expand=True)
                return

            x = np.arange(len(meses))
            largura = 0.35

            b_rec = ax.bar(x - largura/2, receitas, largura, label="Receitas", color="#10B981", zorder=3)
            b_pag = ax.bar(x + largura/2, gastos, largura, label="Despesas", color="#EF4444", zorder=3)

            for b in b_rec:
                h = b.get_height()
                if h > 0:
                    ax.annotate(f"R$ {h:,.0f}", xy=(b.get_x() + b.get_width()/2, h), xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=8, color=text_color, fontweight='bold')

            for b in b_pag:
                h = b.get_height()
                if h > 0:
                    ax.annotate(f"R$ {h:,.0f}", xy=(b.get_x() + b.get_width()/2, h), xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=8, color=text_color, fontweight='bold')

            ax.set_xticks(x)
            ax.set_xticklabels(meses, color=text_color, fontsize=9)
            ax.set_xlabel("Mês / Período", color=text_color, fontsize=10, labelpad=8)

        ax.set_ylabel("Valor em Reais (R$)", color=text_color, fontsize=10, labelpad=8)
        ax.tick_params(colors=text_color)
        ax.spines['bottom'].set_color(grid_color)
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color(grid_color)
        ax.grid(axis='y', linestyle='--', alpha=0.5, color=grid_color, zorder=0)

        legenda = ax.legend(facecolor=card_color, edgecolor=grid_color, fontsize=9)
        for text in legenda.get_texts():
            text.set_color(text_color)

        fig.tight_layout()

        canvas_frame = ctk.CTkFrame(self)
        canvas_frame.pack(fill="both", expand=True, padx=20, pady=15)

        canvas = FigureCanvasTkAgg(fig, master=canvas_frame)
        canvas.draw()
        canvas.get_tk_widget().pack(fill="both", expand=True)


# ==============================================================================
# JANELA PRINCIPAL DO SISTEMA APÓS AUTENTICAÇÃO (CustomTkinter)
# ==============================================================================
class SistemaFinanceiroApp(ctk.CTkToplevel):
    def __init__(self, usuario_logado, db, login_window):
        super().__init__()
        self.usuario_logado = usuario_logado
        self.db = db
        self.login_window = login_window

        self.empresa_atual_id = CONSOLIDATED_ID
        self.empresa_atual_nome = "🌐 Todas as Empresas (Consolidado)"
        self.permitidas_empresas = []

        self.title("Conectecontas - " + str(self.usuario_logado['nome']))
        self.geometry("1300x800")
        self.minsize(1080, 680)

        self.protocol("WM_DELETE_WINDOW", self.ao_fechar)

        self.criar_layout_com_sidebar()
        self.atualizar_dropdown_empresas()

    def ao_fechar(self):
        self.destroy()
        self.login_window.destroy()
        sys.exit(0)

    def logout(self):
        self.destroy()
        self.login_window.deiconify()

    def criar_layout_com_sidebar(self):
        # -------------------------------------------------------------
        # 1. SIDEBAR LATERAL ESQUERDA (Estilo Moderno Slate Dark)
        # -------------------------------------------------------------
        self.sidebar = ctk.CTkFrame(self, width=250, corner_radius=0, fg_color=("#1E293B", "#0F172A"))
        self.sidebar.pack(side="left", fill="y")
        self.sidebar.pack_propagate(False)

        # Header do Brand / Logo
        brand_frame = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        brand_frame.pack(fill="x", padx=16, pady=(18, 14))

        logo_badge = ctk.CTkLabel(
            brand_frame, 
            text="C", 
            width=32, 
            height=32, 
            corner_radius=8, 
            fg_color="#2563EB", 
            text_color="white", 
            font=ctk.CTkFont(size=18, weight="bold")
        )
        logo_badge.pack(side="left", padx=(0, 10))

        titles_box = ctk.CTkFrame(brand_frame, fg_color="transparent")
        titles_box.pack(side="left", fill="x", expand=True)

        lbl_logo_txt = ctk.CTkLabel(
            titles_box, 
            text="Conectecontas", 
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="white"
        )
        lbl_logo_txt.pack(anchor="w")

        lbl_sub_txt = ctk.CTkLabel(
            titles_box, 
            text="MULTIEMPRESA LOCAL", 
            font=ctk.CTkFont(size=9, weight="bold"),
            text_color="#94A3B8"
        )
        lbl_sub_txt.pack(anchor="w")

        # Divisor sutil
        sep1 = ctk.CTkFrame(self.sidebar, height=1, fg_color="#334155")
        sep1.pack(fill="x", padx=16, pady=(0, 12))

        # Seção 1: MENU PRINCIPAL
        lbl_sec_main = ctk.CTkLabel(
            self.sidebar, 
            text="MENU PRINCIPAL", 
            font=ctk.CTkFont(size=10, weight="bold"),
            text_color="#94A3B8"
        )
        lbl_sec_main.pack(anchor="w", padx=18, pady=(4, 6))

        self.btn_nav_dashboard = ctk.CTkButton(
            self.sidebar,
            text="  📊 Dashboard Geral",
            anchor="w",
            height=36,
            fg_color="#2563EB",
            hover_color="#1D4ED8",
            font=ctk.CTkFont(size=13, weight="bold"),
            command=self.nav_ir_dashboard
        )
        self.btn_nav_dashboard.pack(fill="x", padx=12, pady=2)

        self.btn_nav_pagar = ctk.CTkButton(
            self.sidebar,
            text="  💸 Contas a Pagar",
            anchor="w",
            height=36,
            fg_color="transparent",
            hover_color="#1E293B",
            text_color="#E2E8F0",
            font=ctk.CTkFont(size=13),
            command=self.nav_ir_pagar
        )
        self.btn_nav_pagar.pack(fill="x", padx=12, pady=2)

        self.btn_nav_receber = ctk.CTkButton(
            self.sidebar,
            text="  💵 Contas a Receber",
            anchor="w",
            height=36,
            fg_color="transparent",
            hover_color="#1E293B",
            text_color="#E2E8F0",
            font=ctk.CTkFont(size=13),
            command=self.nav_ir_receber
        )
        self.btn_nav_receber.pack(fill="x", padx=12, pady=2)

        self.btn_nav_graficos = ctk.CTkButton(
            self.sidebar,
            text="  📈 Relatórios & Gráficos",
            anchor="w",
            height=36,
            fg_color="transparent",
            hover_color="#1E293B",
            text_color="#E2E8F0",
            font=ctk.CTkFont(size=13),
            command=self.abrir_janela_graficos
        )
        self.btn_nav_graficos.pack(fill="x", padx=12, pady=2)

        self.btn_nav_extratos = ctk.CTkButton(
            self.sidebar,
            text="  📑 Importar Extratos",
            anchor="w",
            height=36,
            fg_color="transparent",
            hover_color="#1E293B",
            text_color="#E2E8F0",
            font=ctk.CTkFont(size=13),
            command=self.abrir_janela_extratos
        )
        self.btn_nav_extratos.pack(fill="x", padx=12, pady=2)

        self.btn_nav_csvexp = ctk.CTkButton(
            self.sidebar,
            text="  📤 Exportar CSV",
            anchor="w",
            height=36,
            fg_color="transparent",
            hover_color="#1E293B",
            text_color="#E2E8F0",
            font=ctk.CTkFont(size=13),
            command=self.exportar_csv
        )
        self.btn_nav_csvexp.pack(fill="x", padx=12, pady=2)

        self.btn_nav_csvimp = ctk.CTkButton(
            self.sidebar,
            text="  📥 Importar CSV",
            anchor="w",
            height=36,
            fg_color="transparent",
            hover_color="#1E293B",
            text_color="#E2E8F0",
            font=ctk.CTkFont(size=13),
            command=self.importar_csv
        )
        self.btn_nav_csvimp.pack(fill="x", padx=12, pady=2)

        # Seção 2: ADMINISTRAÇÃO & DADOS
        sep2 = ctk.CTkFrame(self.sidebar, height=1, fg_color="#334155")
        sep2.pack(fill="x", padx=16, pady=(12, 10))

        lbl_sec_adm = ctk.CTkLabel(
            self.sidebar, 
            text="ADMINISTRAÇÃO & DADOS", 
            font=ctk.CTkFont(size=10, weight="bold"),
            text_color="#94A3B8"
        )
        lbl_sec_adm.pack(anchor="w", padx=18, pady=(2, 6))

        self.btn_nav_users = ctk.CTkButton(
            self.sidebar,
            text="  👥 Usuários & Acessos",
            anchor="w",
            height=34,
            fg_color="transparent",
            hover_color="#1E293B",
            text_color="#CBD5E1",
            font=ctk.CTkFont(size=12),
            command=self.abrir_janela_usuarios
        )
        self.btn_nav_users.pack(fill="x", padx=12, pady=2)

        self.btn_nav_empresas = ctk.CTkButton(
            self.sidebar,
            text="  🏢 Cadastro / Edição de CNPJs (Filiais)",
            anchor="w",
            height=34,
            fg_color="transparent",
            hover_color="#1E293B",
            text_color="#CBD5E1",
            font=ctk.CTkFont(size=12),
            command=self.abrir_janela_empresas
        )
        self.btn_nav_empresas.pack(fill="x", padx=12, pady=2)

        # Card do Usuário Logado & Logout no Rodapé da Sidebar
        user_card = ctk.CTkFrame(self.sidebar, fg_color="#1E293B", corner_radius=10)
        user_card.pack(side="bottom", fill="x", padx=12, pady=16)

        user_top = ctk.CTkFrame(user_card, fg_color="transparent")
        user_top.pack(fill="x", padx=8, pady=(8, 4))

        primeira_letra = (self.usuario_logado.get("nome", "U") or "U")[0].upper()
        avatar_lbl = ctk.CTkLabel(
            user_top, 
            text=primeira_letra, 
            width=28, 
            height=28, 
            corner_radius=6, 
            fg_color="#2563EB", 
            text_color="white", 
            font=ctk.CTkFont(size=13, weight="bold")
        )
        avatar_lbl.pack(side="left", padx=(0, 8))

        u_info_box = ctk.CTkFrame(user_top, fg_color="transparent")
        u_info_box.pack(side="left", fill="x", expand=True)

        lbl_u_name = ctk.CTkLabel(
            u_info_box, 
            text=self.usuario_logado.get("nome", "Usuário")[:14], 
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="white"
        )
        lbl_u_name.pack(anchor="w")

        tipo_lbl = "Acesso Global" if self.usuario_logado.get("acesso_todas_empresas") else "Acesso Restrito"
        lbl_u_role = ctk.CTkLabel(
            u_info_box, 
            text=tipo_lbl, 
            font=ctk.CTkFont(size=10),
            text_color="#60A5FA"
        )
        lbl_u_role.pack(anchor="w")

        btn_logout = ctk.CTkButton(
            user_card,
            text="🚪 Encerrar Sessão",
            height=28,
            fg_color="#DC2626",
            hover_color="#B91C1C",
            font=ctk.CTkFont(size=11, weight="bold"),
            command=self.logout
        )
        btn_logout.pack(fill="x", padx=8, pady=(4, 8))

        # -------------------------------------------------------------
        # 2. ÁREA DE CONTEÚDO PRINCIPAL (À DIREITA DA SIDEBAR)
        # -------------------------------------------------------------
        self.main_container = ctk.CTkFrame(self, fg_color="transparent")
        self.main_container.pack(side="right", fill="both", expand=True)

        # Top Bar no Main Container
        self.top_bar = ctk.CTkFrame(self.main_container, height=60, corner_radius=0)
        self.top_bar.pack(fill="x", side="top", padx=0, pady=0)

        lbl_sel = ctk.CTkLabel(self.top_bar, text="🏢 Empresa Selecionada:", font=ctk.CTkFont(size=13, weight="bold"))
        lbl_sel.pack(side="left", padx=(20, 8), pady=12)

        self.combo_empresas = ctk.CTkComboBox(
            self.top_bar, 
            width=300,
            values=["Carregando..."],
            command=self.ao_selecionar_empresa
        )
        self.combo_empresas.pack(side="left", padx=4, pady=12)

        self.lbl_indicador_empresa = ctk.CTkLabel(
            self.top_bar,
            text="Visão Consolidada",
            font=ctk.CTkFont(size=12),
            text_color="#3B82F6"
        )
        self.lbl_indicador_empresa.pack(side="left", padx=12, pady=12)

        # Cards de Resumo
        self.cards_frame = ctk.CTkFrame(self.main_container, fg_color="transparent")
        self.cards_frame.pack(fill="x", padx=20, pady=12)

        self.card_receber = ctk.CTkFrame(self.cards_frame, fg_color=("#ECFDF5", "#064E3B"), corner_radius=10)
        self.card_receber.pack(side="left", expand=True, fill="both", padx=(0, 6))
        ctk.CTkLabel(self.card_receber, text="Total a Receber", font=ctk.CTkFont(size=12, weight="bold")).pack(pady=(8, 2), padx=10, anchor="w")
        self.lbl_val_receber = ctk.CTkLabel(self.card_receber, text="R$ 0,00", font=ctk.CTkFont(size=17, weight="bold"), text_color="#10B981")
        self.lbl_val_receber.pack(pady=(0, 8), padx=10, anchor="w")

        self.card_pagar = ctk.CTkFrame(self.cards_frame, fg_color=("#FEF2F2", "#7F1D1D"), corner_radius=10)
        self.card_pagar.pack(side="left", expand=True, fill="both", padx=6)
        ctk.CTkLabel(self.card_pagar, text="Total a Pagar", font=ctk.CTkFont(size=12, weight="bold")).pack(pady=(8, 2), padx=10, anchor="w")
        self.lbl_val_pagar = ctk.CTkLabel(self.card_pagar, text="R$ 0,00", font=ctk.CTkFont(size=17, weight="bold"), text_color="#EF4444")
        self.lbl_val_pagar.pack(pady=(0, 8), padx=10, anchor="w")

        self.card_saldo = ctk.CTkFrame(self.cards_frame, fg_color=("#EFF6FF", "#1E3A8A"), corner_radius=10)
        self.card_saldo.pack(side="left", expand=True, fill="both", padx=6)
        ctk.CTkLabel(self.card_saldo, text="Saldo Previsto", font=ctk.CTkFont(size=12, weight="bold")).pack(pady=(8, 2), padx=10, anchor="w")
        self.lbl_val_saldo = ctk.CTkLabel(self.card_saldo, text="R$ 0,00", font=ctk.CTkFont(size=17, weight="bold"), text_color="#3B82F6")
        self.lbl_val_saldo.pack(pady=(0, 8), padx=10, anchor="w")

        self.card_med_rec = ctk.CTkFrame(self.cards_frame, fg_color=("gray90", "gray17"), corner_radius=10)
        self.card_med_rec.pack(side="left", expand=True, fill="both", padx=6)
        ctk.CTkLabel(self.card_med_rec, text="Média Mensal Receitas", font=ctk.CTkFont(size=11)).pack(pady=(8, 2), padx=10, anchor="w")
        self.lbl_val_med_rec = ctk.CTkLabel(self.card_med_rec, text="R$ 0,00 /mês", font=ctk.CTkFont(size=14, weight="bold"))
        self.lbl_val_med_rec.pack(pady=(0, 8), padx=10, anchor="w")

        self.card_med_gastos = ctk.CTkFrame(self.cards_frame, fg_color=("gray90", "gray17"), corner_radius=10)
        self.card_med_gastos.pack(side="left", expand=True, fill="both", padx=(6, 0))
        ctk.CTkLabel(self.card_med_gastos, text="Média Mensal Gastos", font=ctk.CTkFont(size=11)).pack(pady=(8, 2), padx=10, anchor="w")
        self.lbl_val_med_gastos = ctk.CTkLabel(self.card_med_gastos, text="R$ 0,00 /mês", font=ctk.CTkFont(size=14, weight="bold"))
        self.lbl_val_med_gastos.pack(pady=(0, 8), padx=10, anchor="w")

        # Abas de Lançamentos
        self.tabview = ctk.CTkTabview(self.main_container)
        self.tabview.pack(fill="both", expand=True, padx=20, pady=(0, 15))

        self.tab_pagar = self.tabview.add("💸 Contas a Pagar")
        self.tab_receber = self.tabview.add("💵 Contas a Receber")

        self.montar_aba_pagar()
        self.montar_aba_receber()

    def nav_ir_dashboard(self):
        self.ajustar_destaque_nav("dashboard")
        self.tabview.set("💸 Contas a Pagar")

    def nav_ir_pagar(self):
        self.ajustar_destaque_nav("pagar")
        self.tabview.set("💸 Contas a Pagar")

    def nav_ir_receber(self):
        self.ajustar_destaque_nav("receber")
        self.tabview.set("💵 Contas a Receber")

    def ajustar_destaque_nav(self, item_ativo):
        self.btn_nav_dashboard.configure(fg_color="#2563EB" if item_ativo == "dashboard" else "transparent", text_color="white" if item_ativo == "dashboard" else "#E2E8F0")
        self.btn_nav_pagar.configure(fg_color="#2563EB" if item_ativo == "pagar" else "transparent", text_color="white" if item_ativo == "pagar" else "#E2E8F0")
        self.btn_nav_receber.configure(fg_color="#2563EB" if item_ativo == "receber" else "transparent", text_color="white" if item_ativo == "receber" else "#E2E8F0")

    def montar_aba_pagar(self):
        form_frame = ctk.CTkFrame(self.tab_pagar)
        form_frame.pack(fill="x", padx=10, pady=10)

        ctk.CTkLabel(form_frame, text="Descrição:").grid(row=0, column=0, padx=6, pady=6, sticky="w")
        self.entry_pagar_desc = ctk.CTkEntry(form_frame, width=170, placeholder_text="Ex: Fornecedor ABC")
        self.entry_pagar_desc.grid(row=0, column=1, padx=6, pady=6)

        ctk.CTkLabel(form_frame, text="Categoria:").grid(row=0, column=2, padx=6, pady=6, sticky="w")
        self.combo_pagar_cat = ctk.CTkComboBox(form_frame, width=130, values=self.db.listar_categorias())
        self.combo_pagar_cat.set("Outros")
        self.combo_pagar_cat.grid(row=0, column=3, padx=6, pady=6)

        btn_nova_cat_p = ctk.CTkButton(
            form_frame, 
            text="+ Nova", 
            width=50, 
            fg_color="#4B5563", 
            hover_color="#374151",
            command=lambda: NovaCategoriaModal(self, self.db, self.atualizar_categorias_combos)
        )
        btn_nova_cat_p.grid(row=0, column=4, padx=(0, 6), pady=6)

        ctk.CTkLabel(form_frame, text="Valor (R$):").grid(row=0, column=5, padx=6, pady=6, sticky="w")
        self.entry_pagar_valor = ctk.CTkEntry(form_frame, width=95, placeholder_text="0.00")
        self.entry_pagar_valor.grid(row=0, column=6, padx=6, pady=6)

        ctk.CTkLabel(form_frame, text="Vencimento:").grid(row=0, column=7, padx=6, pady=6, sticky="w")
        self.entry_pagar_venc = ctk.CTkEntry(form_frame, width=105, placeholder_text="YYYY-MM-DD")
        self.entry_pagar_venc.insert(0, datetime.now().strftime("%Y-%m-%d"))
        self.entry_pagar_venc.grid(row=0, column=8, padx=6, pady=6)

        ctk.CTkLabel(form_frame, text="Status:").grid(row=0, column=9, padx=6, pady=6, sticky="w")
        self.combo_pagar_status = ctk.CTkComboBox(form_frame, width=100, values=["Pendente", "Pago"])
        self.combo_pagar_status.set("Pendente")
        self.combo_pagar_status.grid(row=0, column=10, padx=6, pady=6)

        btn_add_pagar = ctk.CTkButton(
            form_frame, 
            text="+ Lançar", 
            width=90,
            fg_color="#DC2626", 
            hover_color="#B91C1C",
            command=self.adicionar_conta_pagar
        )
        btn_add_pagar.grid(row=0, column=11, padx=8, pady=6)

        # Filtros
        filter_frame = ctk.CTkFrame(self.tab_pagar, fg_color="transparent")
        filter_frame.pack(fill="x", padx=10, pady=(2, 6))

        ctk.CTkLabel(filter_frame, text="Filtrar por Status:").pack(side="left", padx=(0, 5))
        self.filtro_pagar_var = ctk.CTkSegmentedButton(
            filter_frame, 
            values=["Todos", "Pendente", "Pago"],
            command=lambda v: self.carregar_tabela_pagar()
        )
        self.filtro_pagar_var.set("Todos")
        self.filtro_pagar_var.pack(side="left", padx=(0, 15))

        ctk.CTkLabel(filter_frame, text="Filtrar por Categoria:").pack(side="left", padx=(0, 5))
        self.filtro_pagar_cat_combo = ctk.CTkComboBox(
            filter_frame,
            width=160,
            values=["Todas"] + self.db.listar_categorias(),
            command=lambda v: self.carregar_tabela_pagar()
        )
        self.filtro_pagar_cat_combo.set("Todas")
        self.filtro_pagar_cat_combo.pack(side="left")

        self.scroll_pagar = ctk.CTkScrollableFrame(self.tab_pagar)
        self.scroll_pagar.pack(fill="both", expand=True, padx=10, pady=(4, 10))

    def montar_aba_receber(self):
        form_frame = ctk.CTkFrame(self.tab_receber)
        form_frame.pack(fill="x", padx=10, pady=10)

        ctk.CTkLabel(form_frame, text="Descrição:").grid(row=0, column=0, padx=6, pady=6, sticky="w")
        self.entry_receber_desc = ctk.CTkEntry(form_frame, width=170, placeholder_text="Ex: Venda de Produto")
        self.entry_receber_desc.grid(row=0, column=1, padx=6, pady=6)

        ctk.CTkLabel(form_frame, text="Categoria:").grid(row=0, column=2, padx=6, pady=6, sticky="w")
        self.combo_receber_cat = ctk.CTkComboBox(form_frame, width=130, values=self.db.listar_categorias())
        self.combo_receber_cat.set("Outros")
        self.combo_receber_cat.grid(row=0, column=3, padx=6, pady=6)

        btn_nova_cat_r = ctk.CTkButton(
            form_frame, 
            text="+ Nova", 
            width=50, 
            fg_color="#4B5563", 
            hover_color="#374151",
            command=lambda: NovaCategoriaModal(self, self.db, self.atualizar_categorias_combos)
        )
        btn_nova_cat_r.grid(row=0, column=4, padx=(0, 6), pady=6)

        ctk.CTkLabel(form_frame, text="Valor (R$):").grid(row=0, column=5, padx=6, pady=6, sticky="w")
        self.entry_receber_valor = ctk.CTkEntry(form_frame, width=95, placeholder_text="0.00")
        self.entry_receber_valor.grid(row=0, column=6, padx=6, pady=6)

        ctk.CTkLabel(form_frame, text="Vencimento:").grid(row=0, column=7, padx=6, pady=6, sticky="w")
        self.entry_receber_venc = ctk.CTkEntry(form_frame, width=105, placeholder_text="YYYY-MM-DD")
        self.entry_receber_venc.insert(0, datetime.now().strftime("%Y-%m-%d"))
        self.entry_receber_venc.grid(row=0, column=8, padx=6, pady=6)

        ctk.CTkLabel(form_frame, text="Status:").grid(row=0, column=9, padx=6, pady=6, sticky="w")
        self.combo_receber_status = ctk.CTkComboBox(form_frame, width=100, values=["Pendente", "Recebido"])
        self.combo_receber_status.set("Pendente")
        self.combo_receber_status.grid(row=0, column=10, padx=6, pady=6)

        btn_add_receber = ctk.CTkButton(
            form_frame, 
            text="+ Lançar", 
            width=90,
            fg_color="#059669", 
            hover_color="#047857",
            command=self.adicionar_conta_receber
        )
        btn_add_receber.grid(row=0, column=11, padx=8, pady=6)

        # Filtros
        filter_frame = ctk.CTkFrame(self.tab_receber, fg_color="transparent")
        filter_frame.pack(fill="x", padx=10, pady=(2, 6))

        ctk.CTkLabel(filter_frame, text="Filtrar por Status:").pack(side="left", padx=(0, 5))
        self.filtro_receber_var = ctk.CTkSegmentedButton(
            filter_frame, 
            values=["Todos", "Pendente", "Recebido"],
            command=lambda v: self.carregar_tabela_receber()
        )
        self.filtro_receber_var.set("Todos")
        self.filtro_receber_var.pack(side="left", padx=(0, 15))

        ctk.CTkLabel(filter_frame, text="Filtrar por Categoria:").pack(side="left", padx=(0, 5))
        self.filtro_receber_cat_combo = ctk.CTkComboBox(
            filter_frame,
            width=160,
            values=["Todas"] + self.db.listar_categorias(),
            command=lambda v: self.carregar_tabela_receber()
        )
        self.filtro_receber_cat_combo.set("Todas")
        self.filtro_receber_cat_combo.pack(side="left")

        self.scroll_receber = ctk.CTkScrollableFrame(self.tab_receber)
        self.scroll_receber.pack(fill="both", expand=True, padx=10, pady=(4, 10))

    def atualizar_categorias_combos(self, nova_cat=None):
        cats = self.db.listar_categorias()
        self.combo_pagar_cat.configure(values=cats)
        self.combo_receber_cat.configure(values=cats)
        self.filtro_pagar_cat_combo.configure(values=["Todas"] + cats)
        self.filtro_receber_cat_combo.configure(values=["Todas"] + cats)

        if nova_cat:
            self.combo_pagar_cat.set(nova_cat)
            self.combo_receber_cat.set(nova_cat)

    def atualizar_dropdown_empresas(self):
        self.permitidas_empresas = self.db.obter_empresas_do_usuario(
            self.usuario_logado["id"], 
            bool(self.usuario_logado["acesso_todas_empresas"])
        )
        if not self.permitidas_empresas:
            self.combo_empresas.configure(values=["Nenhuma empresa disponível"])
            self.combo_empresas.set("Nenhuma empresa disponível")
            self.empresa_atual_id = None
            self.empresa_atual_nome = ""
            return

        nomes = []
        if len(self.permitidas_empresas) > 1:
            nomes.append("🌐 Todas as Empresas (Consolidado)")

        nomes.extend([emp["nome"] for emp in self.permitidas_empresas])
        self.combo_empresas.configure(values=nomes)

        if self.empresa_atual_nome in nomes:
            self.combo_empresas.set(self.empresa_atual_nome)
        else:
            self.empresa_atual_nome = nomes[0]
            self.empresa_atual_id = CONSOLIDATED_ID if "Consolidado" in nomes[0] else self.permitidas_empresas[0]["id"]
            self.combo_empresas.set(self.empresa_atual_nome)

        self.atualizar_tela_geral()

    def ao_selecionar_empresa(self, escolha_nome):
        self.empresa_atual_nome = escolha_nome
        if "Consolidado" in escolha_nome or "Todas as Empresas" in escolha_nome:
            self.empresa_atual_id = CONSOLIDATED_ID
            self.lbl_indicador_empresa.configure(text="Visão Consolidada", text_color="#3B82F6")
        else:
            for emp in self.permitidas_empresas:
                if emp["nome"] == escolha_nome:
                    self.empresa_atual_id = emp["id"]
                    self.lbl_indicador_empresa.configure(text=f"Empresa: {emp['nome'][:20]}", text_color="#10B981")
                    break
        self.atualizar_tela_geral()

    def atualizar_tela_geral(self):
        permitidas_ids = [e["id"] for e in self.permitidas_empresas]
        stats = self.db.obter_estatisticas(empresa_id=self.empresa_atual_id, permitidas_ids=permitidas_ids)

        self.lbl_val_receber.configure(text=f"R$ {stats['total_receitas']:,.2f}")
        self.lbl_val_pagar.configure(text=f"R$ {stats['total_gastos']:,.2f}")
        self.lbl_val_saldo.configure(text=f"R$ {stats['saldo_geral']:,.2f}")

        meses_txt = f"({stats['meses_preenchidos']} meses)" if stats['meses_preenchidos'] > 0 else "(0 meses)"
        self.lbl_val_med_rec.configure(text=f"R$ {stats['media_receitas']:,.2f} {meses_txt}")
        self.lbl_val_med_gastos.configure(text=f"R$ {stats['media_gastos']:,.2f} {meses_txt}")

        self.carregar_tabela_pagar()
        self.carregar_tabela_receber()

    def carregar_tabela_pagar(self):
        for w in self.scroll_pagar.winfo_children():
            w.destroy()

        permitidas_ids = [e["id"] for e in self.permitidas_empresas]
        filtro_st = self.filtro_pagar_var.get()
        filtro_cat = self.filtro_pagar_cat_combo.get()

        contas = self.db.listar_contas_pagar(
            empresa_id=self.empresa_atual_id, 
            status_filtro=filtro_st,
            categoria_filtro=filtro_cat,
            permitidas_ids=permitidas_ids
        )

        if not contas:
            ctk.CTkLabel(self.scroll_pagar, text="Nenhum lançamento a pagar encontrado.", font=ctk.CTkFont(size=13)).pack(pady=25)
            return

        is_cons = (self.empresa_atual_id == CONSOLIDATED_ID)

        header = ctk.CTkFrame(self.scroll_pagar, fg_color=("gray80", "gray25"))
        header.pack(fill="x", pady=(0, 5))
        ctk.CTkLabel(header, text="Vencimento", width=95, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=5)
        if is_cons:
            ctk.CTkLabel(header, text="Empresa", width=120, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=5)
        ctk.CTkLabel(header, text="Descrição", font=ctk.CTkFont(weight="bold"), anchor="w").pack(side="left", fill="x", expand=True, padx=10)
        ctk.CTkLabel(header, text="Categoria", width=110, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=5)
        ctk.CTkLabel(header, text="Valor (R$)", width=110, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=5)
        ctk.CTkLabel(header, text="Status", width=90, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=5)
        ctk.CTkLabel(header, text="Ações", width=150, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=5)

        for conta in contas:
            row = ctk.CTkFrame(self.scroll_pagar, fg_color=("gray90", "gray18"))
            row.pack(fill="x", pady=2)

            ctk.CTkLabel(row, text=conta["data_vencimento"], width=95).pack(side="left", padx=5)
            if is_cons:
                ctk.CTkLabel(row, text=conta.get("empresa_nome", "")[:15], width=120, font=ctk.CTkFont(size=11), text_color="#60A5FA").pack(side="left", padx=5)
            ctk.CTkLabel(row, text=conta["descricao"], anchor="w").pack(side="left", fill="x", expand=True, padx=10)
            ctk.CTkLabel(row, text=conta.get("categoria", "Outros"), width=110, font=ctk.CTkFont(size=11)).pack(side="left", padx=5)
            ctk.CTkLabel(row, text=f"R$ {conta['valor']:,.2f}", width=110, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=5)

            cor_badge = "#10B981" if conta["status"] == "Pago" else "#EF4444"
            status_lbl = ctk.CTkLabel(row, text=conta["status"], width=90, text_color=cor_badge, font=ctk.CTkFont(weight="bold"))
            status_lbl.pack(side="left", padx=5)

            novo_st = "Pendente" if conta["status"] == "Pago" else "Pago"
            btn_toggle = ctk.CTkButton(
                row, 
                text="Marcar Pago" if conta["status"] == "Pendente" else "Desmarcar", 
                width=85, 
                height=26,
                fg_color="#0284C7" if conta["status"] == "Pendente" else "#6B7280",
                command=lambda c_id=conta["id"], st=novo_st: self.alternar_status_pagar(c_id, st)
            )
            btn_toggle.pack(side="left", padx=3)

            btn_del = ctk.CTkButton(
                row, 
                text="🗑️", 
                width=30, 
                height=26, 
                fg_color="#DC2626", 
                hover_color="#991B1B",
                command=lambda c_id=conta["id"]: self.excluir_conta_pagar(c_id)
            )
            btn_del.pack(side="left", padx=3)

    def carregar_tabela_receber(self):
        for w in self.scroll_receber.winfo_children():
            w.destroy()

        permitidas_ids = [e["id"] for e in self.permitidas_empresas]
        filtro_st = self.filtro_receber_var.get()
        filtro_cat = self.filtro_receber_cat_combo.get()

        contas = self.db.listar_contas_receber(
            empresa_id=self.empresa_atual_id, 
            status_filtro=filtro_st,
            categoria_filtro=filtro_cat,
            permitidas_ids=permitidas_ids
        )

        if not contas:
            ctk.CTkLabel(self.scroll_receber, text="Nenhum lançamento a receber encontrado.", font=ctk.CTkFont(size=13)).pack(pady=25)
            return

        is_cons = (self.empresa_atual_id == CONSOLIDATED_ID)

        header = ctk.CTkFrame(self.scroll_receber, fg_color=("gray80", "gray25"))
        header.pack(fill="x", pady=(0, 5))
        ctk.CTkLabel(header, text="Vencimento", width=95, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=5)
        if is_cons:
            ctk.CTkLabel(header, text="Empresa", width=120, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=5)
        ctk.CTkLabel(header, text="Descrição", font=ctk.CTkFont(weight="bold"), anchor="w").pack(side="left", fill="x", expand=True, padx=10)
        ctk.CTkLabel(header, text="Categoria", width=110, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=5)
        ctk.CTkLabel(header, text="Valor (R$)", width=110, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=5)
        ctk.CTkLabel(header, text="Status", width=90, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=5)
        ctk.CTkLabel(header, text="Ações", width=150, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=5)

        for conta in contas:
            row = ctk.CTkFrame(self.scroll_receber, fg_color=("gray90", "gray18"))
            row.pack(fill="x", pady=2)

            ctk.CTkLabel(row, text=conta["data_vencimento"], width=95).pack(side="left", padx=5)
            if is_cons:
                ctk.CTkLabel(row, text=conta.get("empresa_nome", "")[:15], width=120, font=ctk.CTkFont(size=11), text_color="#60A5FA").pack(side="left", padx=5)
            ctk.CTkLabel(row, text=conta["descricao"], anchor="w").pack(side="left", fill="x", expand=True, padx=10)
            ctk.CTkLabel(row, text=conta.get("categoria", "Outros"), width=110, font=ctk.CTkFont(size=11)).pack(side="left", padx=5)
            ctk.CTkLabel(row, text=f"R$ {conta['valor']:,.2f}", width=110, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=5)

            cor_badge = "#10B981" if conta["status"] == "Recebido" else "#F59E0B"
            status_lbl = ctk.CTkLabel(row, text=conta["status"], width=90, text_color=cor_badge, font=ctk.CTkFont(weight="bold"))
            status_lbl.pack(side="left", padx=5)

            novo_st = "Pendente" if conta["status"] == "Recebido" else "Recebido"
            btn_toggle = ctk.CTkButton(
                row, 
                text="Marcar Recebido" if conta["status"] == "Pendente" else "Desmarcar", 
                width=105, 
                height=26,
                fg_color="#059669" if conta["status"] == "Pendente" else "#6B7280",
                command=lambda c_id=conta["id"], st=novo_st: self.alternar_status_receber(c_id, st)
            )
            btn_toggle.pack(side="left", padx=3)

            btn_del = ctk.CTkButton(
                row, 
                text="🗑️", 
                width=30, 
                height=26, 
                fg_color="#DC2626", 
                hover_color="#991B1B",
                command=lambda c_id=conta["id"]: self.excluir_conta_receber(c_id)
            )
            btn_del.pack(side="left", padx=3)

    def adicionar_conta_pagar(self):
        desc = self.entry_pagar_desc.get().strip()
        cat = self.combo_pagar_cat.get().strip() or "Outros"
        val_str = self.entry_pagar_valor.get().strip().replace(",", ".")
        venc = self.entry_pagar_venc.get().strip()
        status = self.combo_pagar_status.get()

        emp_id = self.empresa_atual_id
        if emp_id == CONSOLIDATED_ID:
            if self.permitidas_empresas:
                emp_id = self.permitidas_empresas[0]["id"]
            else:
                messagebox.showwarning("Atenção", "Cadastre uma empresa primeiro.")
                return

        if not desc or not val_str or not venc:
            messagebox.showwarning("Atenção", "Preencha a descrição, valor e vencimento.")
            return

        try:
            valor = float(val_str)
            if valor <= 0:
                raise ValueError
        except ValueError:
            messagebox.showwarning("Atenção", "Informe um valor numérico válido.")
            return

        self.db.cadastrar_conta_pagar(emp_id, desc, cat, valor, venc, status)
        self.entry_pagar_desc.delete(0, "end")
        self.entry_pagar_valor.delete(0, "end")
        self.atualizar_tela_geral()

    def alternar_status_pagar(self, conta_id, status):
        self.db.alternar_status_pagar(conta_id, status)
        self.atualizar_tela_geral()

    def excluir_conta_pagar(self, conta_id):
        if messagebox.askyesno("Confirmar", "Deseja excluir este lançamento?"):
            self.db.excluir_conta_pagar(conta_id)
            self.atualizar_tela_geral()

    def adicionar_conta_receber(self):
        desc = self.entry_receber_desc.get().strip()
        cat = self.combo_receber_cat.get().strip() or "Outros"
        val_str = self.entry_receber_valor.get().strip().replace(",", ".")
        venc = self.entry_receber_venc.get().strip()
        status = self.combo_receber_status.get()

        emp_id = self.empresa_atual_id
        if emp_id == CONSOLIDATED_ID:
            if self.permitidas_empresas:
                emp_id = self.permitidas_empresas[0]["id"]
            else:
                messagebox.showwarning("Atenção", "Cadastre uma empresa primeiro.")
                return

        if not desc or not val_str or not venc:
            messagebox.showwarning("Atenção", "Preencha a descrição, valor e vencimento.")
            return

        try:
            valor = float(val_str)
            if valor <= 0:
                raise ValueError
        except ValueError:
            messagebox.showwarning("Atenção", "Informe um valor numérico válido.")
            return

        self.db.cadastrar_conta_receber(emp_id, desc, cat, valor, venc, status)
        self.entry_receber_desc.delete(0, "end")
        self.entry_receber_valor.delete(0, "end")
        self.atualizar_tela_geral()

    def alternar_status_receber(self, conta_id, status):
        self.db.alternar_status_receber(conta_id, status)
        self.atualizar_tela_geral()

    def excluir_conta_receber(self, conta_id):
        if messagebox.askyesno("Confirmar", "Deseja excluir este lançamento?"):
            self.db.excluir_conta_receber(conta_id)
            self.atualizar_tela_geral()

    def exportar_csv(self):
        permitidas_ids = [e["id"] for e in self.permitidas_empresas]
        CsvManager.exportar_csv(self, self.db, self.empresa_atual_id, permitidas_ids)

    def importar_csv(self):
        emp_id = self.empresa_atual_id
        if emp_id == CONSOLIDATED_ID and self.permitidas_empresas:
            emp_id = self.permitidas_empresas[0]["id"]
        CsvManager.importar_csv(self, self.db, emp_id, self.atualizar_tela_geral)

    def abrir_janela_extratos(self):
        emp_id = self.empresa_atual_id
        if emp_id == CONSOLIDATED_ID and self.permitidas_empresas:
            emp_id = self.permitidas_empresas[0]["id"]
        ExtratoImportWindow(self, self.db, emp_id, self.permitidas_empresas, self.atualizar_tela_geral)

    def abrir_janela_empresas(self):
        EmpresaWindow(self, self.db, self.atualizar_dropdown_empresas)

    def abrir_janela_graficos(self):
        GraficosWindow(self, self.db, self.empresa_atual_id, self.empresa_atual_nome, self.permitidas_empresas)

    def abrir_janela_usuarios(self):
        UsuariosWindow(self, self.db, self.usuario_logado, self.atualizar_dropdown_empresas)


# ==============================================================================
# PONTO DE ENTRADA PRINCIPAL DA APLICAÇÃO PYTHON
# ==============================================================================
if __name__ == "__main__":
    app_login = LoginWindow()
    app_login.mainloop()
`;

export const DESKTOP_APP_CODE = PYTHON_APP_CODE;

export const DESKTOP_BAT_RUN = `@echo off
title Conectecontas Multiempresa - Desktop Nativo Windows
echo ==============================================================================
echo  INICIANDO CONECTECONTAS (INTERFACE 100%% NATIVA PYTHON / CUSTOMTKINTER)
echo  Janelas e Botoes Nativos do Windows com SQLite e Graficos
echo ==============================================================================
echo.
echo [1/2] Verificando dependencias nativas do Python...
pip install customtkinter matplotlib numpy
echo.
echo [2/2] Abrindo aplicativo na janela desktop nativa...
python desktop_app.py
if %errorlevel% neq 0 (
    echo.
    echo [AVISO] Tentando abrir com app.py...
    python app.py
    if %errorlevel% neq 0 (
        echo [ERRO] Ocorreu um problema ao abrir. Certifique-se que o Python esta instalado e no PATH.
        pause
    )
)
`;

export const DESKTOP_BAT_BUILD = `@echo off
title Compilar Conectecontas para .EXE Standalone
echo ==============================================================================
echo  COMPILANDO CONECTECONTAS PARA EXECUTAVEL (.EXE) STANDALONE
echo  Interface 100%% Nativa Python (CustomTkinter / Tkinter + Matplotlib + SQLite)
echo ==============================================================================
echo.
echo [1/3] Instalando dependencias necessarias...
pip install customtkinter matplotlib numpy pyinstaller
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar dependencias do Python.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Gerando o executavel .EXE standalone sem terminal...
pyinstaller --noconsole --onefile --clean --name="Conectecontas" desktop_app.py
if %errorlevel% neq 0 (
    echo [AVISO] Tentando compilar app.py...
    pyinstaller --noconsole --onefile --clean --name="Conectecontas" app.py
    if %errorlevel% neq 0 (
        echo [ERRO] Falha durante a geracao do executavel.
        pause
        exit /b %errorlevel%
    )
)

echo.
echo ==============================================================================
echo [SUCESSO] Executavel gerado com sucesso!
echo Arquivo gerado em: dist\\Conectecontas.exe
echo ==============================================================================
echo.
pause
`;

export const DESKTOP_REQUIREMENTS = `customtkinter>=5.2.0
matplotlib>=3.7.0
numpy>=1.24.0
pyinstaller>=6.0.0
`;

export const PYTHON_REQUIREMENTS = `customtkinter>=5.2.0
matplotlib>=3.7.0
numpy>=1.24.0
pyinstaller>=6.0.0
`;

export const PYTHON_BUILD_BAT = `@echo off
echo ==============================================================================
echo  COMPILADOR STANDALONE PARA EXECUTAVEL (.EXE) - CONECTECONTAS MULTIEMPRESA
echo ==============================================================================
echo.

echo [1/3] Verificando e instalando dependencias Python necessarias...
pip install customtkinter matplotlib numpy pyinstaller
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar dependencias. Verifique o Python e pip no PATH.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Compilando executavel com PyInstaller (Modo Janela Standalone / Sem Terminal)...
pyinstaller --noconsole --onefile --clean --name="Conectecontas" app.py
if %errorlevel% neq 0 (
    echo [ERRO] Falha durante a geracao do executavel.
    pause
    exit /b %errorlevel%
)

echo.
echo ==============================================================================
echo [SUCESSO] Executavel gerado com sucesso!
echo Arquivo gerado em: dist\\Conectecontas.exe
echo ==============================================================================
echo.
pause
`;
