import React, { useState } from 'react';
import { 
  X, 
  Code2, 
  Download, 
  Copy, 
  Check, 
  Terminal, 
  PackageCheck, 
  FileCode, 
  Cpu, 
  Sparkles,
  Monitor,
  Layers,
  Play
} from 'lucide-react';
import { 
  PYTHON_APP_CODE, 
  PYTHON_REQUIREMENTS, 
  PYTHON_BUILD_BAT,
  DESKTOP_APP_CODE,
  DESKTOP_BAT_RUN,
  DESKTOP_BAT_BUILD,
  DESKTOP_REQUIREMENTS
} from '../pythonCode';

interface PythonCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PythonCodeModal: React.FC<PythonCodeModalProps> = ({ isOpen, onClose }) => {
  // Mode: 'preview_desktop' (PyWebView / 100% Identical) or 'customtkinter' (Tkinter app.py)
  const [engineMode, setEngineMode] = useState<'preview_desktop' | 'customtkinter'>('preview_desktop');
  const [activeTab, setActiveTab] = useState<'guide' | 'code' | 'bat_run' | 'bat_build' | 'requirements'>('guide');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const downloadFile = (filename: string, content: string, mimeType: string = 'text/plain') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Aplicativo Desktop para Windows (.EXE)
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                  Pronto para Rodar
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Execute localmente em janela nativa ou gere o arquivo <code className="font-mono bg-gray-200 dark:bg-slate-800 px-1 py-0.5 rounded font-bold">.exe</code> standalone
              </p>
            </div>
          </div>

          <button
            id="close-python-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Engine Selector */}
        <div className="px-6 py-3 bg-blue-50/70 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-950 dark:text-blue-200">Versão Desktop:</span>
            
            <div className="flex p-0.5 rounded-lg bg-blue-100/80 dark:bg-blue-900/60 text-xs font-bold">
              <button
                id="btn-engine-preview"
                onClick={() => {
                  setEngineMode('preview_desktop');
                  setActiveTab('guide');
                }}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  engineMode === 'preview_desktop'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-blue-900 dark:text-blue-300 hover:text-blue-950'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>⭐ Python Nativo Windows (desktop_app.py / CustomTkinter)</span>
              </button>

              <button
                id="btn-engine-tkinter"
                onClick={() => {
                  setEngineMode('customtkinter');
                  setActiveTab('code');
                }}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  engineMode === 'customtkinter'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-blue-900 dark:text-blue-300 hover:text-blue-950'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Código Fonte Completo (app.py)</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-download-desktop-py"
              onClick={() => downloadFile('desktop_app.py', DESKTOP_APP_CODE, 'text/x-python')}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar desktop_app.py</span>
            </button>
            <button
              id="btn-download-run-bat"
              onClick={() => downloadFile('iniciar_desktop.bat', DESKTOP_BAT_RUN, 'application/x-bat')}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Executa o app com 2 cliques"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Baixar iniciar_desktop.bat</span>
            </button>
          </div>
        </div>

        {/* Action Bar & Sub-Tabs */}
        <div className="px-6 py-2 bg-gray-50/80 dark:bg-slate-800/60 border-b border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'guide'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Passo a Passo & Como Rodar</span>
            </button>

            <button
              onClick={() => setActiveTab('code')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'code'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>{engineMode === 'preview_desktop' ? 'desktop_app.py' : 'app.py'}</span>
            </button>

            {engineMode === 'preview_desktop' && (
              <>
                <button
                  onClick={() => setActiveTab('bat_run')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === 'bat_run'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>iniciar_desktop.bat</span>
                </button>
                <button
                  onClick={() => setActiveTab('bat_build')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === 'bat_build'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>compilar_desktop_exe.bat</span>
                </button>
              </>
            )}

            {engineMode === 'customtkinter' && (
              <button
                onClick={() => setActiveTab('bat_build')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'bat_build'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>compilar_exe.bat</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('requirements')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'requirements'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>requirements.txt</span>
            </button>
          </div>

          <button
            id="btn-copy-tab-code"
            onClick={() => {
              if (activeTab === 'code') {
                handleCopy(engineMode === 'preview_desktop' ? DESKTOP_APP_CODE : PYTHON_APP_CODE);
              } else if (activeTab === 'bat_run') {
                handleCopy(DESKTOP_BAT_RUN);
              } else if (activeTab === 'bat_build') {
                handleCopy(engineMode === 'preview_desktop' ? DESKTOP_BAT_BUILD : PYTHON_BUILD_BAT);
              } else if (activeTab === 'requirements') {
                handleCopy(engineMode === 'preview_desktop' ? DESKTOP_REQUIREMENTS : PYTHON_REQUIREMENTS);
              }
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs">
          
          {activeTab === 'guide' && engineMode === 'preview_desktop' && (
            <div className="font-sans text-sm space-y-4 text-gray-800 dark:text-gray-200">
              
              <div className="p-4 bg-blue-50/80 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800/80 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-950 dark:text-blue-200">
                  <p className="font-bold text-sm mb-1">Versão 100% Nativa Python (CustomTkinter / Tkinter):</p>
                  <p className="leading-relaxed">
                    Aplicativo construído com <strong>CustomTkinter + Matplotlib + SQLite</strong>, utilizando <strong>janelas, botões e controles nativos do Windows</strong>. Não depende de navegadores ou conexões externas — todos os botões, filtros, cadastros e gráficos respondem instantaneamente na sua máquina!
                  </p>
                </div>
              </div>

              {/* Opção Rápida: 2 Cliques com BAT */}
              <div className="p-5 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5 font-bold text-emerald-950 dark:text-emerald-200 text-base">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-mono">⚡</div>
                    <span>Método Mais Rápido: Iniciar com 2 Cliques (.bat)</span>
                  </div>
                  <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">Recomendado</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-xs mb-3">
                  Baixe os arquivos e salve-os na sua pasta (ex: <code className="font-mono font-bold">C:\conectecontas\</code>):
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={() => downloadFile('desktop_app.py', DESKTOP_APP_CODE, 'text/x-python')}
                    className="px-3.5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>1. Baixar desktop_app.py</span>
                  </button>
                  <button
                    onClick={() => downloadFile('iniciar_desktop.bat', DESKTOP_BAT_RUN, 'application/x-bat')}
                    className="px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>2. Baixar iniciar_desktop.bat</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  👉 Dê <strong>dois cliques no arquivo <code className="font-bold text-emerald-600 font-mono">iniciar_desktop.bat</code></strong>. Ele instala as dependências automaticamente e abre a janela nativa do Windows!
                </p>
              </div>

              {/* Card de Credenciais de Acesso Inicial */}
              <div className="p-4 bg-amber-50/80 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/80">
                <p className="font-bold text-xs text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-1.5">
                  <span>🔑 Credenciais de Acesso Inicial (SQLite):</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-amber-200/80 dark:border-amber-900/50">
                    <span className="font-bold text-gray-900 dark:text-white block mb-1">👑 Administrador Master:</span>
                    <div className="text-gray-600 dark:text-gray-300 font-mono text-[11px] space-y-0.5">
                      <div>E-mail: <strong className="text-blue-600 dark:text-blue-400">admin@financeiro.com</strong></div>
                      <div>Senha: <strong className="text-emerald-600 dark:text-emerald-400">admin123</strong></div>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-amber-200/80 dark:border-amber-900/50">
                    <span className="font-bold text-gray-900 dark:text-white block mb-1">👤 Operador (Alpha Soluções):</span>
                    <div className="text-gray-600 dark:text-gray-300 font-mono text-[11px] space-y-0.5">
                      <div>E-mail: <strong className="text-blue-600 dark:text-blue-400">joao@empresa.com</strong></div>
                      <div>Senha: <strong className="text-emerald-600 dark:text-emerald-400">123456</strong></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Passo a Passo Manual no Terminal */}
              <div className="p-5 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700">
                <div className="flex items-center gap-2.5 mb-2 font-bold text-gray-900 dark:text-white text-base">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-mono">1</div>
                  <span>Executar Manualmente pelo Prompt de Comando (CMD)</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">
                  No CMD dentro da pasta do projeto:
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 text-emerald-400 rounded-lg font-mono text-xs">
                    <div>
                      <span className="text-slate-500"># Instalar dependências nativas</span><br/>
                      <code>pip install customtkinter matplotlib numpy</code>
                    </div>
                    <button
                      onClick={() => handleCopy('pip install customtkinter matplotlib numpy')}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-950 text-emerald-400 rounded-lg font-mono text-xs">
                    <div>
                      <span className="text-slate-500"># Abrir a janela nativa</span><br/>
                      <code>python desktop_app.py</code>
                    </div>
                    <button
                      onClick={() => handleCopy('python desktop_app.py')}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Gerar Executável .EXE */}
              <div className="p-5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-800/60">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5 font-bold text-indigo-950 dark:text-indigo-200 text-base">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-mono">2</div>
                    <span>Gerar Arquivo Executável .EXE Standalone</span>
                  </div>
                  <button
                    onClick={() => downloadFile('compilar_desktop_exe.bat', DESKTOP_BAT_BUILD, 'application/x-bat')}
                    className="px-2.5 py-1 text-xs font-bold rounded bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Baixar compilar_desktop_exe.bat</span>
                  </button>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-xs mb-3">
                  Para gerar o arquivo executável <code className="font-mono font-bold">ControleFinanceiroDesktop.exe</code>:
                </p>
                <div className="flex items-center justify-between p-2.5 bg-slate-950 text-emerald-400 rounded-lg font-mono text-xs">
                  <div>
                    <span className="text-slate-500"># Comando de compilação sem janela de terminal preta</span><br/>
                    <code>pyinstaller --noconsole --onefile --clean --name="ControleFinanceiroDesktop" desktop_app.py</code>
                  </div>
                  <button
                    onClick={() => handleCopy('pyinstaller --noconsole --onefile --clean --name="ControleFinanceiroDesktop" desktop_app.py')}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-indigo-900 dark:text-indigo-300 mt-2">
                  O executável estará gerado em <code className="font-mono font-bold bg-indigo-100 dark:bg-indigo-900/60 px-1 py-0.5 rounded">dist\ControleFinanceiroDesktop.exe</code>!
                </p>
              </div>

            </div>
          )}

          {activeTab === 'guide' && engineMode === 'customtkinter' && (
            <div className="font-sans text-sm space-y-4 text-gray-800 dark:text-gray-200">
              <div className="p-5 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700">
                <div className="flex items-center gap-2.5 mb-2 font-bold text-gray-900 dark:text-white text-base">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-mono">1</div>
                  <span>Executar app.py no Windows</span>
                </div>
                <div className="p-3 bg-slate-950 text-emerald-400 rounded-lg font-mono text-xs flex items-center justify-between mb-2">
                  <code>pip install customtkinter matplotlib numpy</code>
                  <button
                    onClick={() => handleCopy('pip install customtkinter matplotlib numpy')}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-3 bg-slate-950 text-emerald-400 rounded-lg font-mono text-xs flex items-center justify-between">
                  <code>python app.py</code>
                  <button
                    onClick={() => handleCopy('python app.py')}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="relative">
              <div className="flex items-center justify-between mb-2 font-sans text-xs text-gray-500 dark:text-gray-400">
                <span>Código fonte: <code className="font-mono font-bold text-blue-600">{engineMode === 'preview_desktop' ? 'desktop_app.py' : 'app.py'}</code></span>
                <button
                  onClick={() => {
                    if (engineMode === 'preview_desktop') downloadFile('desktop_app.py', DESKTOP_APP_CODE, 'text/x-python');
                    else downloadFile('app.py', PYTHON_APP_CODE, 'text/x-python');
                  }}
                  className="px-2.5 py-1 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Baixar Arquivo</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-950 text-slate-100 rounded-xl overflow-x-auto leading-relaxed border border-slate-800">
                <code>{engineMode === 'preview_desktop' ? DESKTOP_APP_CODE : PYTHON_APP_CODE}</code>
              </pre>
            </div>
          )}

          {activeTab === 'bat_run' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-sans text-xs text-gray-500 dark:text-gray-400">
                  Script automatizado para Windows. Dê dois cliques para abrir o aplicativo na hora.
                </span>
                <button
                  onClick={() => downloadFile('iniciar_desktop.bat', DESKTOP_BAT_RUN, 'application/x-bat')}
                  className="font-sans px-3 py-1 text-xs font-semibold rounded bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar iniciar_desktop.bat</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-950 text-emerald-400 rounded-xl overflow-x-auto border border-slate-800 leading-relaxed">
                <code>{DESKTOP_BAT_RUN}</code>
              </pre>
            </div>
          )}

          {activeTab === 'bat_build' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-sans text-xs text-gray-500 dark:text-gray-400">
                  Script automatizado para Windows. Dê dois cliques para compilar o executável .EXE automaticamente.
                </span>
                <button
                  onClick={() => {
                    if (engineMode === 'preview_desktop') downloadFile('compilar_desktop_exe.bat', DESKTOP_BAT_BUILD, 'application/x-bat');
                    else downloadFile('compilar_exe.bat', PYTHON_BUILD_BAT, 'application/x-bat');
                  }}
                  className="font-sans px-3 py-1 text-xs font-semibold rounded bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Arquivo .BAT</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-950 text-blue-300 rounded-xl overflow-x-auto border border-slate-800 leading-relaxed">
                <code>{engineMode === 'preview_desktop' ? DESKTOP_BAT_BUILD : PYTHON_BUILD_BAT}</code>
              </pre>
            </div>
          )}

          {activeTab === 'requirements' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-sans text-xs text-gray-500 dark:text-gray-400">
                  Arquivo de dependências para instalação rápida com <code className="font-mono font-bold">pip install -r requirements.txt</code>.
                </span>
                <button
                  onClick={() => {
                    if (engineMode === 'preview_desktop') downloadFile('requirements.txt', DESKTOP_REQUIREMENTS);
                    else downloadFile('requirements.txt', PYTHON_REQUIREMENTS);
                  }}
                  className="font-sans px-3 py-1 text-xs font-semibold rounded bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar requirements.txt</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-950 text-emerald-400 rounded-xl overflow-x-auto border border-slate-800 leading-relaxed">
                <code>{engineMode === 'preview_desktop' ? DESKTOP_REQUIREMENTS : PYTHON_REQUIREMENTS}</code>
              </pre>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50/50 dark:bg-slate-800/40 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span>Design 100% idêntico à Preview com gráficos interativos e controles responsivos.</span>
          </div>

          <div className="flex items-center gap-2">
            {engineMode === 'preview_desktop' ? (
              <button
                onClick={() => downloadFile('desktop_app.py', DESKTOP_APP_CODE, 'text/x-python')}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar desktop_app.py</span>
              </button>
            ) : (
              <button
                onClick={() => downloadFile('app.py', PYTHON_APP_CODE, 'text/x-python')}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar app.py</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
