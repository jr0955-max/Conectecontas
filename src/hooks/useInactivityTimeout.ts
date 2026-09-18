import { useState, useEffect, useRef, useCallback } from 'react';

interface UseInactivityTimeoutOptions {
  timeoutMinutes: number; // e.g. 15
  warningSeconds?: number; // e.g. 60 (show countdown 60s before lock)
  requireLoginOnReopen?: boolean; // if true, opening after tab closed requires login
  onTimeout: (reason: string) => void;
  isEnabled: boolean;
}

export function useInactivityTimeout({
  timeoutMinutes,
  warningSeconds = 60,
  requireLoginOnReopen = true,
  onTimeout,
  isEnabled,
}: UseInactivityTimeoutOptions) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(warningSeconds);

  const lastActivityRef = useRef<number>(Date.now());
  const lastStorageSyncRef = useRef<number>(0);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const timeoutMs = Math.max(1, timeoutMinutes) * 60 * 1000;
  const warningMs = Math.max(10, warningSeconds) * 1000;

  // Atualiza carimbo de atividade do usuário
  const recordActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;

    // Atualiza o localStorage com moderação (a cada 5 segundos no máximo) para sincronizar entre abas
    if (now - lastStorageSyncRef.current > 5000) {
      lastStorageSyncRef.current = now;
      try {
        localStorage.setItem('fin_last_activity', String(now));
      } catch (e) {}
    }

    if (showWarning) {
      setShowWarning(false);
    }
  }, [showWarning]);

  // Força extensão explícita da sessão (quando o usuário clica em "Continuar Conectado")
  const extendSession = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    lastStorageSyncRef.current = now;
    setShowWarning(false);
    setCountdown(warningSeconds);
    try {
      localStorage.setItem('fin_last_activity', String(now));
    } catch (e) {}
  }, [warningSeconds]);

  useEffect(() => {
    if (!isEnabled) {
      setShowWarning(false);
      return;
    }

    // Inicializa carimbo atual
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem('fin_last_activity', String(now));
    } catch (e) {}

    // Eventos do usuário para detectar atividade real
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    // Throttle do listener de evento
    let lastHandled = 0;
    const handleUserActivity = () => {
      const current = Date.now();
      if (current - lastHandled > 2000) {
        lastHandled = current;
        recordActivity();
      }
    };

    events.forEach((eventName) => {
      window.addEventListener(eventName, handleUserActivity, { passive: true });
    });

    // Função de verificação do tempo ocioso
    const checkInactivity = () => {
      const currentTime = Date.now();
      
      // Lê se outra aba do mesmo navegador registrou atividade mais recente
      let mostRecentActivity = lastActivityRef.current;
      try {
        const storedActivity = localStorage.getItem('fin_last_activity');
        if (storedActivity) {
          const parsed = Number(storedActivity);
          if (!isNaN(parsed) && parsed > mostRecentActivity) {
            mostRecentActivity = parsed;
            lastActivityRef.current = parsed;
          }
        }
      } catch (e) {}

      const elapsed = currentTime - mostRecentActivity;
      const timeLeft = timeoutMs - elapsed;

      if (timeLeft <= 0) {
        // Tempo expirado!
        setShowWarning(false);
        onTimeoutRef.current(
          `Sessão encerrada automaticamente após ${timeoutMinutes} minutos sem atividade.`
        );
      } else if (timeLeft <= warningMs) {
        // Prestes a expirar: exibe aviso com contagem regressiva
        setShowWarning(true);
        setCountdown(Math.ceil(timeLeft / 1000));
      } else {
        setShowWarning(false);
      }
    };

    // Intervalo de verificação a cada 1 segundo para precisão da contagem regressiva
    const interval = setInterval(checkInactivity, 1000);

    // Quando o usuário volta à aba ou desbloqueia o celular
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserActivity);
      });
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [isEnabled, timeoutMs, warningMs, timeoutMinutes, recordActivity]);

  return {
    showWarning,
    countdown,
    extendSession,
    recordActivity,
  };
}
