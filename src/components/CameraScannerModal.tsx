import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  QrCode,
  Barcode,
  FlipHorizontal,
  Zap,
  CheckCircle2,
  AlertCircle,
  Upload,
  RefreshCw,
  Sparkles,
  Info,
  Check,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  parsePixQRCode,
  parseBoletoCode,
  PixParsedData,
  BoletoParsedData,
  detectPixKeyType,
} from '../utils/pixBoletoParser';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'pix' | 'boleto' | 'auto';
  onScanSuccess: (data: {
    type: 'pix' | 'boleto';
    chavePix?: string;
    chavePixTipo?: 'cnpj' | 'cpf' | 'email' | 'telefone' | 'aleatoria';
    codigoBarras?: string;
    valorDetectado?: number;
    beneficiarioDetectado?: string;
    rawText: string;
  }) => void;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  mode = 'auto',
  onScanSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'pix' | 'boleto'>(
    mode === 'boleto' ? 'boleto' : 'pix'
  );
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [detectedResult, setDetectedResult] = useState<{
    type: 'pix' | 'boleto';
    pixData?: PixParsedData;
    boletoData?: BoletoParsedData;
    rawText: string;
  } | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'camera-barcode-pix-reader';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Play subtle feedback beep on success
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // Audio context might be restricted or unsupported
    }
  };

  // Sync mode prop with activeTab
  useEffect(() => {
    if (mode === 'boleto') {
      setActiveTab('boleto');
    } else if (mode === 'pix') {
      setActiveTab('pix');
    }
  }, [mode, isOpen]);

  // Handle scanned decoded text
  const handleDecodedText = (decodedText: string) => {
    const cleanText = decodedText.trim();
    if (!cleanText) return;

    playBeep();

    // Check if it's Pix EMVCo, direct pix key or Boleto
    const isEMVCoPix = cleanText.startsWith('000201');
    const isBarcodeLike = cleanText.replace(/\D/g, '').length >= 20;

    let targetType: 'pix' | 'boleto' = activeTab;

    if (isEMVCoPix) {
      targetType = 'pix';
    } else if (isBarcodeLike && !cleanText.includes('@')) {
      targetType = 'boleto';
    }

    if (targetType === 'pix') {
      const pixData = parsePixQRCode(cleanText);
      setDetectedResult({
        type: 'pix',
        pixData: pixData || undefined,
        rawText: cleanText,
      });
    } else {
      const boletoData = parseBoletoCode(cleanText);
      setDetectedResult({
        type: 'boleto',
        boletoData: boletoData || undefined,
        rawText: cleanText,
      });
    }

    // Pause / stop scanner after successful capture to show confirmation preview
    stopScanner();
  };

  // Initialize and start scanner
  const startScanner = async (cameraId?: string) => {
    setErrorMessage('');
    setDetectedResult(null);

    try {
      // Clean up previous instance if any
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
          html5QrCodeRef.current.clear();
        } catch {
          // ignore cleanup errors
        }
      }

      // Query available video cameras
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        setErrorMessage('Nenhuma câmera encontrada no seu dispositivo.');
        return;
      }

      setCameras(devices);

      // Prioritize back camera ("environment") or provided cameraId
      let targetCamera = cameraId || selectedCameraId;
      if (!targetCamera) {
        const backCam = devices.find((d) =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('traseira') ||
          d.label.toLowerCase().includes('environment') ||
          d.label.toLowerCase().includes('rear')
        );
        targetCamera = backCam ? backCam.id : devices[0].id;
        setSelectedCameraId(targetCamera);
      }

      const qrFormats = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.ITF, // Interleaved 2 of 5 (used in boletos)
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
      ];

      const html5QrCode = new Html5Qrcode(readerElementId, {
        formatsToSupport: qrFormats,
        verbose: false,
      });

      html5QrCodeRef.current = html5QrCode;

      // Adjust aspect ratio and bounding box based on active mode
      const isBoleto = activeTab === 'boleto';
      const qrbox = isBoleto
        ? { width: 320, height: 140 } // Wide rectangle for barcodes
        : { width: 250, height: 250 }; // Square for QR codes

      await html5QrCode.start(
        targetCamera,
        {
          fps: 15,
          qrbox,
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleDecodedText(decodedText);
        },
        () => {
          // Frame not detected, ignore frame errors
        }
      );

      setIsScanning(true);

      // Check if torch/flashlight capability is available
      try {
        const capabilities = (html5QrCode as any).getRunningTrackCapabilities?.();
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.error('Erro ao iniciar câmera:', err);
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Permissão de acesso à câmera negada. Por favor, autorize o navegador a usar a câmera.'
          : err?.message || 'Não foi possível acessar a câmera.';
      setErrorMessage(msg);
      setIsScanning(false);
    }
  };

  // Stop scanner
  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Erro ao finalizar scanner:', err);
      }
    }
    setIsScanning(false);
    setTorchEnabled(false);
  };

  // Toggle Torch/Flashlight
  const handleToggleTorch = async () => {
    if (!html5QrCodeRef.current || !isScanning) return;
    try {
      const nextTorch = !torchEnabled;
      await (html5QrCodeRef.current as any).applyVideoConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchEnabled(nextTorch);
    } catch (err) {
      console.warn('Torch not supported on this device:', err);
    }
  };

  // Switch camera (front/back)
  const handleSwitchCamera = () => {
    if (cameras.length < 2) return;
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    setSelectedCameraId(nextCamera.id);
    startScanner(nextCamera.id);
  };

  // File upload barcode/QR decoder fallback
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setErrorMessage('');
      const html5QrCode = new Html5Qrcode('file-scanner-temp', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.CODE_39,
        ],
        verbose: false,
      });

      const decodedText = await html5QrCode.scanFile(file, true);
      handleDecodedText(decodedText);
    } catch (err: any) {
      setErrorMessage('Não foi possível identificar nenhum QR Code ou Código de Barras válido nesta imagem.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Trigger camera start on modal open
  useEffect(() => {
    if (isOpen) {
      // Small timeout to allow DOM element #camera-barcode-pix-reader to mount
      const timer = setTimeout(() => {
        startScanner();
      }, 250);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleConfirmResult = () => {
    if (!detectedResult) return;

    if (detectedResult.type === 'pix') {
      const pix = detectedResult.pixData;
      const chave = pix?.chavePix || detectedResult.rawText;
      const chaveTipo = pix?.chaveTipo || detectPixKeyType(chave);

      onScanSuccess({
        type: 'pix',
        chavePix: chave,
        chavePixTipo: chaveTipo,
        valorDetectado: pix?.valor,
        beneficiarioDetectado: pix?.nomeRecebedor,
        rawText: detectedResult.rawText,
      });
    } else {
      const boleto = detectedResult.boletoData;
      const codigo = boleto?.linhaDigitavelFormatada || boleto?.codigoBarrasLimpo || detectedResult.rawText;

      onScanSuccess({
        type: 'boleto',
        codigoBarras: codigo,
        valorDetectado: boleto?.valor,
        beneficiarioDetectado: boleto?.bancoNome,
        rawText: detectedResult.rawText,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-md">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                Leitor por Câmera
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                  Ao Vivo
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aponte para o QR Code Pix ou Código de Barras do Boleto
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection: Pix QR Code vs. Boleto Barcode */}
        <div className="p-3 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setDetectedResult(null);
              setActiveTab('pix');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'pix'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            QR Code Pix
          </button>

          <button
            type="button"
            onClick={() => {
              setDetectedResult(null);
              setActiveTab('boleto');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'boleto'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Barcode className="w-4 h-4" />
            Código de Barras Boleto
          </button>
        </div>

        {/* Body / Viewfinder */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <div className="space-y-1">
                <p className="font-semibold">{errorMessage}</p>
                <p className="text-[11px] text-rose-600/90 dark:text-rose-400">
                  Dica: Se a câmera estiver bloqueada, você também pode selecionar uma imagem ou foto do código abaixo.
                </p>
              </div>
            </div>
          )}

          {/* Scanned Result Confirmation Card */}
          {detectedResult ? (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl space-y-3 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <h4 className="font-bold text-sm">
                  {detectedResult.type === 'pix'
                    ? 'QR Code Pix Identificado com Sucesso!'
                    : 'Código de Barras de Boleto Lido com Sucesso!'}
                </h4>
              </div>

              {detectedResult.type === 'pix' && (
                <div className="space-y-2 text-xs">
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-200/80 dark:border-slate-800">
                    <span className="text-slate-400 block text-[11px] font-medium">Chave Pix Detectada:</span>
                    <strong className="text-slate-900 dark:text-white font-mono text-sm break-all">
                      {detectedResult.pixData?.chavePix || detectedResult.rawText}
                    </strong>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                        Tipo: {detectedResult.pixData?.chaveTipo || detectPixKeyType(detectedResult.rawText)}
                      </span>
                      {detectedResult.pixData?.tipo === 'emvco' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Pix Copia e Cola Oficial
                        </span>
                      )}
                    </div>
                  </div>

                  {detectedResult.pixData?.nomeRecebedor && (
                    <div className="flex items-center justify-between text-xs px-1 text-slate-700 dark:text-slate-300">
                      <span className="text-slate-400">Beneficiário:</span>
                      <strong>{detectedResult.pixData.nomeRecebedor}</strong>
                    </div>
                  )}

                  {detectedResult.pixData?.valor !== undefined && (
                    <div className="flex items-center justify-between text-xs px-1 text-slate-700 dark:text-slate-300">
                      <span className="text-slate-400">Valor Sugerido:</span>
                      <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          detectedResult.pixData.valor
                        )}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {detectedResult.type === 'boleto' && (
                <div className="space-y-2 text-xs">
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-200/80 dark:border-slate-800">
                    <span className="text-slate-400 block text-[11px] font-medium">Linha Digitável / Código de Barras:</span>
                    <strong className="text-slate-900 dark:text-white font-mono text-xs break-all block mt-0.5">
                      {detectedResult.boletoData?.linhaDigitavelFormatada || detectedResult.rawText}
                    </strong>
                    {detectedResult.boletoData?.bancoNome && (
                      <span className="inline-block mt-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {detectedResult.boletoData.bancoNome}
                      </span>
                    )}
                  </div>

                  {detectedResult.boletoData?.valor !== undefined && (
                    <div className="flex items-center justify-between text-xs px-1 text-slate-700 dark:text-slate-300">
                      <span className="text-slate-400">Valor do Boleto:</span>
                      <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          detectedResult.boletoData.valor
                        )}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDetectedResult(null);
                    startScanner();
                  }}
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Escanear Novamente
                </button>
                <button
                  type="button"
                  id="btn-apply-camera-result"
                  onClick={handleConfirmResult}
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Aplicar Dados ao Pagamento
                </button>
              </div>
            </div>
          ) : (
            /* Live Camera Container */
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-square sm:aspect-4/3 flex items-center justify-center shadow-inner">
              {/* Target Viewfinder & Laser Scan Effect */}
              <div
                id={readerElementId}
                className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full"
              />

              {/* Animated Target Overlay UI */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6">
                <div
                  className={`border-2 border-indigo-400/80 rounded-2xl transition-all duration-300 relative shadow-[0_0_20px_rgba(99,102,241,0.25)] ${
                    activeTab === 'boleto'
                      ? 'w-[85%] h-28 sm:h-32'
                      : 'w-56 h-56 sm:w-64 sm:h-64'
                  }`}
                >
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-indigo-400 rounded-tl-sm" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-indigo-400 rounded-tr-sm" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-indigo-400 rounded-bl-sm" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-indigo-400 rounded-br-sm" />

                  {/* Laser Scanline */}
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-pulse shadow-[0_0_12px_#818cf8]" />
                </div>

                <div className="mt-4 px-3 py-1 bg-slate-900/80 backdrop-blur-md rounded-full border border-slate-700/60 text-[11px] font-medium text-slate-200 flex items-center gap-1.5 shadow-lg">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    {activeTab === 'pix'
                      ? 'Enquadre o QR Code Pix no centro'
                      : 'Alinhe a linha de barras do boleto na moldura'}
                  </span>
                </div>
              </div>

              {/* Floating Camera Controls (Switch, Torch) */}
              <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                {hasTorch && (
                  <button
                    type="button"
                    onClick={handleToggleTorch}
                    className={`p-2 rounded-xl backdrop-blur-md transition-colors cursor-pointer ${
                      torchEnabled
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                        : 'bg-slate-900/80 text-slate-300 hover:bg-slate-900 border border-slate-700/60'
                    }`}
                    title="Ligar/Desligar Lanterna"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                )}

                {cameras.length > 1 && (
                  <button
                    type="button"
                    onClick={handleSwitchCamera}
                    className="p-2 rounded-xl bg-slate-900/80 text-slate-300 hover:bg-slate-900 border border-slate-700/60 backdrop-blur-md transition-colors cursor-pointer"
                    title="Alternar Câmera"
                  >
                    <FlipHorizontal className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Hidden File Input for Image Upload Scanning */}
          <div id="file-scanner-temp" className="hidden" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* Fallback Option: Upload Image from Gallery / File */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Upload className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Tem uma foto ou captura de tela do código?</span>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Escolher Imagem
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/30">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <Info className="w-3.5 h-3.5 text-indigo-500" />
            <span>Suporta QR Code Pix, Boletos CIP (44 e 47 dígitos) e Concessionárias.</span>
          </div>

          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
