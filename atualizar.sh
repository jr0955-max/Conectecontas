#!/bin/bash
# ==============================================================================
# Script de Atualização Rápida - Conectecontas
# Execução: ./atualizar.sh ou bash atualizar.sh
# ==============================================================================

echo "=================================================="
echo "🚀 Iniciando Atualização do Conectecontas..."
echo "=================================================="

# 1. Puxar atualizações do Git (se repositório clonado)
if [ -d ".git" ]; then
  echo "📥 Puxando código mais recente do repositório..."
  git pull origin main || git pull
fi

# 2. Instalar dependências (caso novos pacotes tenham sido adicionados)
echo "📦 Verificando e instalando dependências npm..."
npm install

# 3. Gerar novo build de produção
echo "🔨 Compilando aplicação e servidor (npm run build)..."
npm run build

# 4. Recarregar processo no PM2
if command -v pm2 &> /dev/null; then
  echo "🔄 Verificando e recarregando serviço no PM2..."
  # Se já existir o processo financeiro, reinicia/recarrega; senão inicia
  if pm2 describe financeiro &> /dev/null; then
    pm2 reload financeiro || pm2 restart financeiro
  else
    pm2 start dist/server.cjs --name "financeiro"
  fi
  pm2 save

  echo ""
  echo "📊 Status dos processos no PM2:"
  pm2 list
else
  echo "⚠️ PM2 não detectado globalmente. Se estiver rodando com node direto, reinicie o processo."
fi

echo "=================================================="
echo "✅ Conectecontas atualizado e pronto para uso!"
echo "=================================================="
