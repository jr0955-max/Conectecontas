import React, { useState, useRef, useEffect } from 'react';
import { 
  DownloadCloud, 
  UploadCloud, 
  ShieldCheck, 
  Database, 
  Building2, 
  Users, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Copy, 
  Check, 
  RefreshCw,
  HardDrive,
  FileJson,
  Layers,
  Sparkles,
  Lock,
  Cloud,
  ExternalLink,
  Trash2,
  Calendar,
  Clock,
  FolderSync
} from 'lucide-react';
import { Company, FinancialAccount, User, UserCompanyLink, AuditLog, SystemBackupSnapshot, BankAccount, CostCenter } from '../types';
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  initGoogleDriveAuth,
  uploadBackupToGoogleDrive,
  listDriveBackups,
  downloadAndParseDriveBackup,
  deleteDriveBackupFile,
  getDriveAccessToken,
  getDriveGoogleUser,
  normalizeBackupSnapshot,
  DriveBackupItem
} from '../services/googleDriveBackupService';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  accounts: FinancialAccount[];
  users: User[];
  userCompanies: UserCompanyLink[];
  auditLogs: AuditLog[];
  bankAccounts?: BankAccount[];
  costCenters?: CostCenter[];
  tenants?: any[];
  currentUser: User;
  onRestoreSnapshot: (snapshot: SystemBackupSnapshot['dados'], mode: 'replace' | 'merge') => Promise<void>;
  onLogBackupExport: () => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  companies,
  accounts,
  users,
  userCompanies,
  auditLogs,
  bankAccounts = [],
  costCenters = [],
  tenants = [],
  currentUser,
  onRestoreSnapshot,
  onLogBackupExport,
}) => {
  const [activeTab, setActiveTab] = useState<'drive' | 'export' | 'import'>('drive');
  const [copied, setCopied] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedSnapshot, setParsedSnapshot] = useState<SystemBackupSnapshot | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [restoreCompletedInfo, setRestoreCompletedInfo] = useState<{
    companiesCount: number;
    accountsCount: number;
    usersCount: number;
    source: 'drive' | 'file';
  } | null>(null);
  const [autoCloseCountdown, setAutoCloseCountdown] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-close timer when restore finishes
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (restoreCompletedInfo) {
      setAutoCloseCountdown(3);
      interval = setInterval(() => {
        setAutoCloseCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            onClose();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [restoreCompletedInfo, onClose]);

  // Google Drive State
  const [googleUser, setGoogleUser] = useState<{ email: string; displayName: string; photoURL?: string } | null>(null);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveUploadSuccess, setDriveUploadSuccess] = useState<{ name: string; webViewLink?: string } | null>(null);
  const [driveBackups, setDriveBackups] = useState<DriveBackupItem[]>([]);
  const [isLoadingDriveList, setIsLoadingDriveList] = useState(false);
  const [driveActionError, setDriveActionError] = useState<string | null>(null);
  const [restoringDriveId, setRestoringDriveId] = useState<string | null>(null);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState<boolean>(() => {
    return localStorage.getItem('conectecontas_auto_drive_backup') === 'true';
  });
  const [fileToDelete, setFileToDelete] = useState<DriveBackupItem | null>(null);
  const [isDeletingFromDrive, setIsDeletingFromDrive] = useState(false);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);
  const [localSafetySnapshot, setLocalSafetySnapshot] = useState<{
    timestamp: number;
    count: number;
    accounts: FinancialAccount[];
  } | null>(null);

  // Check auth state on mount
  useEffect(() => {
    if (!isOpen) {
      setRestoreCompletedInfo(null);
      setAutoCloseCountdown(null);
      setIsRestoring(false);
      setRestoreSuccess(false);
      setParsedSnapshot(null);
      setSelectedFile(null);
      setFileError(null);
      setDriveActionError(null);
      return;
    }

    try {
      const raw = localStorage.getItem('fin_accounts_safety_backup');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.accounts) && parsed.accounts.length > 0) {
          setLocalSafetySnapshot(parsed);
        }
      }
    } catch (e) {}

    const unsubscribe = initGoogleDriveAuth(
      (token, user) => {
        setGoogleUser(user);
        fetchDriveList(token);
      },
      () => {
        setGoogleUser(null);
        setDriveBackups([]);
      }
    );

    const token = getDriveAccessToken();
    const existingUser = getDriveGoogleUser();
    if (token && existingUser) {
      setGoogleUser(existingUser);
      fetchDriveList(token);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Compute stats for export
  const activeAccounts = accounts.filter((a) => !a.excluido);
  const trashAccounts = accounts.filter((a) => a.excluido);
  const totalReceber = activeAccounts
    .filter((a) => a.tipo === 'receber')
    .reduce((acc, curr) => acc + curr.valor, 0);
  const totalPagar = activeAccounts
    .filter((a) => a.tipo === 'pagar')
    .reduce((acc, curr) => acc + curr.valor, 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const generateBackupData = (): SystemBackupSnapshot => {
    return {
      versao: '2.0.0',
      tipo_backup: 'completo_conectecontas',
      gerado_em: new Date().toISOString(),
      gerado_por: {
        id: currentUser.id,
        nome: currentUser.nome,
        email: currentUser.email,
      },
      estatisticas: {
        totalEmpresas: companies.length,
        totalContasAtivas: activeAccounts.length,
        totalContasLixeira: trashAccounts.length,
        totalUsuarios: users.length,
        totalLogs: auditLogs.length,
        valorTotalReceber: totalReceber,
        valorTotalPagar: totalPagar,
      },
      dados: {
        companies,
        users,
        userCompanies,
        accounts,
        auditLogs,
        bankAccounts,
        costCenters,
        tenants,
      },
    };
  };

  // Google Drive Handlers
  const handleConnectDrive = async () => {
    setIsConnectingDrive(true);
    setDriveActionError(null);
    try {
      const { token, user } = await connectGoogleDrive();
      setGoogleUser(user);
      await fetchDriveList(token);
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      setDriveActionError(err.message || 'Falha ao conectar conta Google.');
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleDisconnectDrive = async () => {
    await disconnectGoogleDrive();
    setGoogleUser(null);
    setDriveBackups([]);
    setDriveUploadSuccess(null);
  };

  const fetchDriveList = async (token: string) => {
    setIsLoadingDriveList(true);
    setDriveActionError(null);
    try {
      const list = await listDriveBackups(token);
      setDriveBackups(list);
    } catch (err: any) {
      console.warn('Erro ao listar arquivos do drive:', err);
      setDriveActionError(err.message || 'Não foi possível carregar os backups do Google Drive.');
    } finally {
      setIsLoadingDriveList(false);
    }
  };

  const handleUploadToDrive = async () => {
    const token = getDriveAccessToken();
    if (!token) {
      setDriveActionError('Conecte sua conta Google primeiro.');
      return;
    }

    setIsUploadingToDrive(true);
    setDriveActionError(null);
    setDriveUploadSuccess(null);

    try {
      const snapshot = generateBackupData();
      const res = await uploadBackupToGoogleDrive(token, snapshot);
      setDriveUploadSuccess({ name: res.name, webViewLink: res.webViewLink });
      onLogBackupExport();
      await fetchDriveList(token);
      // Re-consulta após 1.5s para garantir que a indexação do Google Drive reflita o novo arquivo
      setTimeout(() => {
        fetchDriveList(token);
      }, 1500);
    } catch (err: any) {
      setDriveActionError(err.message || 'Falha ao fazer upload para o Google Drive.');
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleRestoreFromDrive = async (fileId: string) => {
    const token = getDriveAccessToken();
    if (!token) return;

    setRestoringDriveId(fileId);
    setDriveActionError(null);
    try {
      const snapshot = await downloadAndParseDriveBackup(token, fileId);
      if (!snapshot || !snapshot.dados) {
        throw new Error('Arquivo de backup inválido.');
      }
      setParsedSnapshot(snapshot);
      setIsRestoring(true);
      await onRestoreSnapshot(snapshot.dados, 'replace');
      setRestoreSuccess(true);
      setRestoreCompletedInfo({
        companiesCount: snapshot.dados.companies?.length || 0,
        accountsCount: snapshot.dados.accounts?.length || 0,
        usersCount: snapshot.dados.users?.length || 0,
        source: 'drive',
      });
    } catch (err: any) {
      setDriveActionError(err.message || 'Erro ao carregar ou restaurar arquivo do Google Drive.');
    } finally {
      setRestoringDriveId(null);
      setIsRestoring(false);
    }
  };

  const handleDeleteClick = (item: DriveBackupItem) => {
    setDriveActionError(null);
    setDeleteSuccessMessage(null);
    setFileToDelete(item);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    const token = getDriveAccessToken();
    if (!token) {
      setDriveActionError('Sessão expirada. Conecte sua conta Google novamente para excluir.');
      setFileToDelete(null);
      return;
    }

    setIsDeletingFromDrive(true);
    setDriveActionError(null);
    setDeleteSuccessMessage(null);

    try {
      await deleteDriveBackupFile(token, fileToDelete.id);
      const deletedName = fileToDelete.name;
      setDriveBackups((prev) => prev.filter((b) => b.id !== fileToDelete.id));
      setDeleteSuccessMessage(`Backup "${deletedName}" foi excluído com sucesso do Google Drive.`);
      setTimeout(() => {
        setDeleteSuccessMessage(null);
      }, 4000);
      setFileToDelete(null);
    } catch (err: any) {
      console.error('Erro ao excluir do Drive:', err);
      // Even if 404, remove from local list
      if (err.message && err.message.includes('404')) {
        setDriveBackups((prev) => prev.filter((b) => b.id !== fileToDelete.id));
        setFileToDelete(null);
      } else {
        setDriveActionError(err.message || 'Erro ao excluir arquivo do Google Drive.');
      }
    } finally {
      setIsDeletingFromDrive(false);
    }
  };

  const handleToggleAutoBackup = (enabled: boolean) => {
    setAutoBackupEnabled(enabled);
    localStorage.setItem('conectecontas_auto_drive_backup', enabled ? 'true' : 'false');
  };

  // Local Download & Restore Handlers
  const handleDownloadBackup = () => {
    const backupObj = generateBackupData();
    const jsonString = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `backup_conectecontas_${dateStr}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onLogBackupExport();
  };

  const handleCopyClipboard = () => {
    const backupObj = generateBackupData();
    navigator.clipboard.writeText(JSON.stringify(backupObj, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onLogBackupExport();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setSelectedFile(file);
    setFileError(null);
    setRestoreSuccess(false);

    if (!file.name.endsWith('.json')) {
      setFileError('O arquivo selecionado deve ser no formato .JSON.');
      setParsedSnapshot(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        // Validate and normalize structure
        const normalized = normalizeBackupSnapshot(parsed);
        setParsedSnapshot(normalized);
      } catch (err: any) {
        setFileError(`Erro ao ler o arquivo JSON: ${err.message || 'Arquivo inválido ou corrompido'}`);
        setParsedSnapshot(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!parsedSnapshot || !parsedSnapshot.dados) return;
    setIsRestoring(true);
    setFileError(null);

    try {
      await onRestoreSnapshot(parsedSnapshot.dados, restoreMode);
      setRestoreSuccess(true);
      setRestoreCompletedInfo({
        companiesCount: parsedSnapshot.dados.companies?.length || 0,
        accountsCount: parsedSnapshot.dados.accounts?.length || 0,
        usersCount: parsedSnapshot.dados.users?.length || 0,
        source: 'file',
      });
    } catch (err: any) {
      setFileError(`Falha ao restaurar backup: ${err.message || 'Erro inesperado'}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRestoreSafetySnapshot = async () => {
    if (!localSafetySnapshot || !localSafetySnapshot.accounts) return;
    setIsRestoring(true);
    setFileError(null);
    try {
      let localComps: Company[] = [];
      try {
        const rawComps = localStorage.getItem('fin_companies');
        if (rawComps) localComps = JSON.parse(rawComps);
      } catch (e) {}

      await onRestoreSnapshot({
        companies: localComps.length > 0 ? localComps : companies,
        accounts: localSafetySnapshot.accounts,
        users,
        userCompanies,
        auditLogs,
        bankAccounts,
        costCenters,
        tenants,
      }, 'merge');

      setRestoreSuccess(true);
      setRestoreCompletedInfo({
        companiesCount: companies.length,
        accountsCount: localSafetySnapshot.accounts.length,
        usersCount: users.length,
        source: 'file',
      });
    } catch (err: any) {
      setFileError(`Falha ao restaurar cópia de segurança local: ${err.message || 'Erro inesperado'}`);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-900/50 shadow-xs">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>Backup & Restauração Completa</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                  Google Drive Integrado
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Salve snapshots automáticos no Google Drive ou gere arquivos .JSON locais
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/60 px-6 pt-2 gap-1 overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('drive');
              setRestoreSuccess(false);
            }}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'drive'
                ? 'border-sky-600 text-sky-600 dark:text-sky-400 bg-white dark:bg-slate-900 rounded-t-xl shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Cloud className="w-4 h-4 text-sky-500" />
            <span>1. Google Drive (Nuvem Automática)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('export');
              setRestoreSuccess(false);
            }}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'export'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 rounded-t-xl shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <DownloadCloud className="w-4 h-4" />
            <span>2. Baixar Arquivo Local (.JSON)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('import');
              setRestoreSuccess(false);
            }}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'import'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 rounded-t-xl shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>3. Restaurar Snapshot</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* DEDICATED COMPLETION SCREEN */}
          {restoreCompletedInfo ? (
            <div className="py-8 px-4 flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in-95 duration-200">
              <div className="w-20 h-20 rounded-3xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Restauração Concluída com Sucesso!
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                  Os dados do snapshot ({restoreCompletedInfo.source === 'drive' ? 'Google Drive' : 'Arquivo .JSON'}) foram carregados e validados com sucesso no sistema.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 w-full max-w-md">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700">
                  <span className="text-[10px] text-gray-400 block font-semibold uppercase tracking-wider">Empresas</span>
                  <span className="text-xl font-extrabold text-gray-900 dark:text-white">{restoreCompletedInfo.companiesCount}</span>
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700">
                  <span className="text-[10px] text-gray-400 block font-semibold uppercase tracking-wider">Lançamentos</span>
                  <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{restoreCompletedInfo.accountsCount}</span>
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700">
                  <span className="text-[10px] text-gray-400 block font-semibold uppercase tracking-wider">Usuários</span>
                  <span className="text-xl font-extrabold text-gray-900 dark:text-white">{restoreCompletedInfo.usersCount}</span>
                </div>
              </div>

              <div className="pt-2 w-full max-w-xs space-y-2.5">
                <button
                  id="btn-confirm-restore-finish"
                  onClick={onClose}
                  className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer hover:scale-[1.02]"
                >
                  <Check className="w-4 h-4" />
                  <span>Concluir e Ir para o Sistema</span>
                </button>

                {autoCloseCountdown !== null && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 font-mono">
                    Fechando automaticamente em {autoCloseCountdown}s...
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* TAB 1: GOOGLE DRIVE */}
              {activeTab === 'drive' && (
                <div className="space-y-6">
              
              {/* Google Drive Status Banner */}
              {!googleUser ? (
                <div className="p-6 rounded-2xl bg-gradient-to-br from-sky-50 to-indigo-50/50 dark:from-slate-800/80 dark:to-sky-950/30 border border-sky-200 dark:border-sky-900/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-md text-sky-500 border border-sky-100 dark:border-slate-700 shrink-0">
                      <Cloud className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        Conectar seu Google Drive
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-300 max-w-md mt-0.5">
                        Armazene seus backups com segurança no seu próprio Google Drive na pasta <strong>Conectecontas_Backups</strong>.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleConnectDrive}
                    disabled={isConnectingDrive}
                    className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-300 dark:border-slate-700 shadow-sm text-gray-700 dark:text-gray-200 font-bold text-xs cursor-pointer transition-all hover:scale-[1.02] disabled:opacity-50 shrink-0"
                  >
                    {isConnectingDrive ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-sky-500" />
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                      </svg>
                    )}
                    <span>{isConnectingDrive ? 'Conectando ao Google...' : 'Conectar Conta Google'}</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    {googleUser.photoURL ? (
                      <img src={googleUser.photoURL} alt="Avatar" className="w-10 h-10 rounded-full border border-emerald-400" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                        {googleUser.displayName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">{googleUser.displayName}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200">
                          Conectado
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{googleUser.email}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDisconnectDrive}
                      className="px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer font-medium"
                    >
                      Desconectar
                    </button>
                  </div>
                </div>
              )}

              {/* Action Error Box */}
              {driveActionError && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{driveActionError}</span>
                </div>
              )}

              {/* Delete Success Alert */}
              {deleteSuccessMessage && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{deleteSuccessMessage}</span>
                </div>
              )}

              {/* Upload Success Alert */}
              {driveUploadSuccess && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between gap-3 text-xs text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <h5 className="font-bold text-sm">Backup Salvo no Google Drive!</h5>
                      <p>Arquivo: <strong>{driveUploadSuccess.name}</strong> salvo com sucesso na pasta <em>Conectecontas_Backups</em>.</p>
                    </div>
                  </div>

                  {driveUploadSuccess.webViewLink && (
                    <a
                      href={driveUploadSuccess.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition-colors shrink-0"
                    >
                      <span>Abrir no Drive</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}

              {/* Google Drive Actions & Auto-Backup Routine */}
              {googleUser && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Card 1: 1-Click Save */}
                  <div className="md:col-span-2 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-bold text-xs uppercase tracking-wider mb-1">
                        <FolderSync className="w-4 h-4" />
                        <span>Sincronização Imediata</span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        Salvar Snapshot Atual no Google Drive
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                        {companies.length === 0 && activeAccounts.length === 0 ? (
                          <span>
                            Sua conta está pronta. Assim que você cadastrar suas empresas e lançamentos, este snapshot empacotará e sincronizará todos os dados em tempo real no seu Google Drive.
                          </span>
                        ) : (
                          <span>
                            Empacota {companies.length} {companies.length === 1 ? 'empresa' : 'empresas'}, {activeAccounts.length} {activeAccounts.length === 1 ? 'lançamento ativo' : 'lançamentos ativos'}{trashAccounts.length > 0 ? ` (${trashAccounts.length} na lixeira)` : ''} e {auditLogs.length} logs para envio seguro com carimbo de data e hora.
                          </span>
                        )}
                      </p>
                    </div>

                    <button
                      onClick={handleUploadToDrive}
                      disabled={isUploadingToDrive}
                      className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isUploadingToDrive ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Enviando para o Google Drive...</span>
                        </>
                      ) : (
                        <>
                          <Cloud className="w-4 h-4" />
                          <span>⚡ Salvar Agora no Google Drive (1-Clique)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Card 2: Auto-Backup Setting */}
                  <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">
                        <Clock className="w-4 h-4" />
                        <span>Rotina Automática</span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        Backup Diário
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Salva automaticamente uma cópia de segurança na sua conta Google a cada 24 horas.
                      </p>
                    </div>

                    <label className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900 cursor-pointer">
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                        {autoBackupEnabled ? 'Ativado' : 'Desativado'}
                      </span>
                      <input
                        type="checkbox"
                        checked={autoBackupEnabled}
                        onChange={(e) => handleToggleAutoBackup(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                    </label>
                  </div>

                </div>
              )}

              {/* Existing Backups List on Google Drive */}
              {googleUser && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-sky-500" />
                      <span>Backups Salvos no seu Google Drive ({driveBackups.length})</span>
                    </h3>

                    <button
                      onClick={() => {
                        const token = getDriveAccessToken();
                        if (token) fetchDriveList(token);
                      }}
                      disabled={isLoadingDriveList}
                      className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDriveList ? 'animate-spin' : ''}`} />
                      <span>Atualizar lista</span>
                    </button>
                  </div>

                  {isLoadingDriveList ? (
                    <div className="p-8 text-center bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-gray-200 dark:border-slate-800">
                      <RefreshCw className="w-6 h-6 animate-spin text-sky-500 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">Consultando arquivos no Google Drive...</p>
                    </div>
                  ) : driveBackups.length === 0 ? (
                    <div className="p-8 text-center bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-gray-200 dark:border-slate-800">
                      <Cloud className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-500 font-medium">Nenhum backup encontrado na pasta Conectecontas_Backups.</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">Clique no botão acima para salvar seu primeiro snapshot.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-slate-800 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                      {driveBackups.map((item, idx) => (
                        <div key={item.id} className={`p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors ${idx === 0 ? 'bg-sky-50/30 dark:bg-sky-950/20' : ''}`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                              <FileJson className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h5 className="text-xs font-bold text-gray-900 dark:text-white truncate font-mono">
                                  {item.name}
                                </h5>
                                {idx === 0 && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shrink-0">
                                    Mais Recente
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                                <span className="flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-300">
                                  <Calendar className="w-3 h-3 text-sky-500" />
                                  {new Date(item.createdTime).toLocaleString('pt-BR')}
                                </span>
                                {item.size && (
                                  <span className="font-mono text-gray-600 dark:text-gray-400">• {(parseInt(item.size, 10) / 1024).toFixed(1)} KB</span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleRestoreFromDrive(item.id)}
                              disabled={restoringDriveId === item.id}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                              title="Restaurar este snapshot de segurança"
                            >
                              {restoringDriveId === item.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ShieldCheck className="w-3.5 h-3.5" />
                              )}
                              <span>Restaurar</span>
                            </button>

                            {item.webViewLink && (
                              <a
                                href={item.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                                title="Abrir no Google Drive"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}

                            <button
                              onClick={() => handleDeleteClick(item)}
                              disabled={isDeletingFromDrive}
                              className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer disabled:opacity-50"
                              title="Excluir arquivo do Google Drive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Confirmation Dialog for File Deletion */}
                  {fileToDelete && (
                    <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <h5 className="text-xs font-bold text-rose-900 dark:text-rose-200">
                            Confirmar exclusão no Google Drive?
                          </h5>
                          <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5 font-mono break-all">
                            {fileToDelete.name}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => setFileToDelete(null)}
                          disabled={isDeletingFromDrive}
                          className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleConfirmDelete}
                          disabled={isDeletingFromDrive}
                          className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isDeletingFromDrive ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Apagando...</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Sim, Excluir Agora</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* TAB 2: EXPORT LOCAL */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              
              {/* Snapshot Summary Cards */}
              <div>
                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                  Conteúdo incluído neste Snapshot de Segurança
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  
                  <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Empresas</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {companies.length}
                    </p>
                  </div>

                  <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Lançamentos</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {activeAccounts.length} <span className="text-xs font-normal text-gray-500">({trashAccounts.length} lixeira)</span>
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs font-bold">
                      <Users className="w-3.5 h-3.5" />
                      <span>Usuários</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {users.length}
                    </p>
                  </div>

                  <div className="p-3 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 text-xs font-bold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Trilha Auditoria</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {auditLogs.length}
                    </p>
                  </div>

                </div>
              </div>

              {/* Financial Totals */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700/60 flex items-center justify-between flex-wrap gap-4 text-xs">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-[11px]">Total a Receber (Ativo)</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(totalReceber)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-[11px]">Total a Pagar (Ativo)</span>
                  <span className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono">
                    {formatCurrency(totalPagar)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-[11px]">Gerado por</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {currentUser.nome} ({currentUser.email})
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={handleDownloadBackup}
                  className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <DownloadCloud className="w-5 h-5" />
                  <span>📥 Baixar Snapshot de Dados (.JSON)</span>
                </button>

                <a
                  href="/api/download-project-zip"
                  download="conectecontas-servidor-completo.zip"
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-black text-white dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer border border-slate-700 no-underline"
                >
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  <span>📦 Baixar Código-Fonte Completo para o Servidor (.ZIP)</span>
                </a>

                <button
                  onClick={handleCopyClipboard}
                  className="w-full py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-gray-300 dark:border-slate-700"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copiado para a Área de Transferência!' : 'Copiar Estrutura JSON'}</span>
                </button>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/50 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  <strong>Dica de Segurança:</strong> Guarde o arquivo em um local seguro (Google Drive, pendrive ou pasta corporativa). Ele contém todas as informações financeiras de todas as empresas cadastradas.
                </p>
              </div>

            </div>
          )}

          {/* TAB 3: IMPORT / RESTORE */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              
              {/* Emergency Local Safety Snapshot Recovery Card */}
              {localSafetySnapshot && localSafetySnapshot.accounts && localSafetySnapshot.accounts.length > 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                          Cópia Local de Segurança Detectada
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                          {localSafetySnapshot.count} lançamentos
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                        Salvo em {new Date(localSafetySnapshot.timestamp).toLocaleDateString('pt-BR')} às {new Date(localSafetySnapshot.timestamp).toLocaleTimeString('pt-BR')} na memória deste navegador.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRestoreSafetySnapshot}
                    disabled={isRestoring}
                    className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-98 rounded-xl shadow-xs transition-all whitespace-nowrap shrink-0 disabled:opacity-50 flex items-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                    <span>{isRestoring ? 'Restaurando...' : 'Restaurar Cópia Local'}</span>
                  </button>
                </div>
              )}

              {/* File Upload Box */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-8 text-center bg-gray-50/50 dark:bg-slate-800/30 transition-all cursor-pointer group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform shadow-xs">
                  <FileJson className="w-7 h-7" />
                </div>

                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                  {selectedFile ? selectedFile.name : 'Clique para selecionar ou arraste o arquivo .JSON de backup'}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  Formatos aceitos: arquivos estruturados gerados pelo Conectecontas ou Google Drive
                </p>
              </div>

              {/* Error Box */}
              {fileError && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{fileError}</span>
                </div>
              )}

              {/* Success Box */}
              {restoreSuccess && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <h5 className="font-bold text-sm">Backup Restaurado com Sucesso!</h5>
                    <p>Todos os dados foram revalidados e sincronizados com a nuvem.</p>
                  </div>
                </div>
              )}

              {/* Parsed Snapshot Preview & Strategy */}
              {parsedSnapshot && (
                <div className="space-y-4 p-4 bg-indigo-50/50 dark:bg-slate-800/60 rounded-xl border border-indigo-100 dark:border-slate-700">
                  
                  <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 pb-3">
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                        Prévia do Arquivo de Backup
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        Gerado em: {new Date(parsedSnapshot.gerado_em).toLocaleString('pt-BR')} por {parsedSnapshot.gerado_por?.nome || 'Usuário'}
                      </p>
                    </div>

                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Válido & Íntegro
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg">
                      <span className="text-gray-400 block text-[10px]">Empresas</span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {parsedSnapshot.dados.companies?.length || 0}
                      </span>
                    </div>

                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg">
                      <span className="text-gray-400 block text-[10px]">Lançamentos</span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {parsedSnapshot.dados.accounts?.length || 0}
                      </span>
                    </div>

                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg">
                      <span className="text-gray-400 block text-[10px]">Usuários</span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {parsedSnapshot.dados.users?.length || 0}
                      </span>
                    </div>

                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg">
                      <span className="text-gray-400 block text-[10px]">Logs Auditoria</span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {parsedSnapshot.dados.auditLogs?.length || 0}
                      </span>
                    </div>
                  </div>

                  {/* Mode Selection */}
                  <div className="pt-2">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-2">
                      Modo de Restauração:
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                        restoreMode === 'replace' 
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:border-indigo-500' 
                          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                      }`}>
                        <input
                          type="radio"
                          name="restoreMode"
                          value="replace"
                          checked={restoreMode === 'replace'}
                          onChange={() => setRestoreMode('replace')}
                          className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-gray-900 dark:text-white block">
                            Substituição Total (Recomendado)
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            Restaura exatamente o estado do backup, substituindo os dados atuais.
                          </span>
                        </div>
                      </label>

                      <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                        restoreMode === 'merge' 
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:border-indigo-500' 
                          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                      }`}>
                        <input
                          type="radio"
                          name="restoreMode"
                          value="merge"
                          checked={restoreMode === 'merge'}
                          onChange={() => setRestoreMode('merge')}
                          className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-gray-900 dark:text-white block">
                            Mesclar Dados
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            Adiciona lançamentos e empresas do backup sem excluir o que já existe.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Restore CTA Button */}
                  <div className="pt-2">
                    <button
                      onClick={handleExecuteRestore}
                      disabled={isRestoring}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isRestoring ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Restaurando Banco de Dados...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-5 h-5" />
                          <span>⚡ Executar Restauração Imediata</span>
                        </>
                      )}
                    </button>
                  </div>

                </div>
              )}

            </div>
          )}

          </>
        )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 text-xs">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            <span>Sistema com isolamento e validação de integridade por Tenant.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
