#!/bin/bash
echo "=============================================="
echo "🌱 INICIANDO INSTALAÇÃO DE DEPENDÊNCIAS"
echo "=============================================="
sleep 1

# 1. Limpeza de caches e pacotes antigos
echo "🧹 Limpando dependências antigas..."
rm -rf node_modules package-lock.json pnpm-lock.yaml yarn.lock dist build .next
sleep 1

# 2. Detecta o gerenciador de pacotes automaticamente
if [ -f "pnpm-lock.yaml" ]; then
  PM="pnpm"
elif [ -f "yarn.lock" ]; then
  PM="yarn"
else
  PM="npm"
fi

echo "📦 Gerenciador de pacotes detectado: $PM"
sleep 1

# 3. Instala dependências com força total
echo "⚙️ Instalando dependências..."
if [ "$PM" = "pnpm" ]; then
  pnpm install --force
elif [ "$PM" = "yarn" ]; then
  yarn install --force
else
  npm install --force
fi
sleep 1

# 4. Correções automáticas
echo "🔧 Aplicando correções automáticas..."
if [ "$PM" = "yarn" ]; then
  yarn audit --fix || true
else
  npm audit fix --force || true
fi
sleep 1

# 5. Teste rápido de build
echo "🏗️ Testando compilação (build)..."
if [ -f "package.json" ]; then
  if grep -q "\"build\"" package.json; then
    $PM run build || echo "⚠️ O build falhou, verifique o log acima."
  else
    echo "ℹ️ Nenhum script 'build' encontrado no package.json."
  fi
fi

# 6. Conclusão
echo "=============================================="
echo "✅ Instalação concluída com sucesso!"
echo "Se não houver erros acima, seu ambiente está pronto."
echo "Para publicar: vá em Publishing → Approve and publish"
echo "=============================================="
