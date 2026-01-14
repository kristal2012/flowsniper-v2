@echo off
TITLE FlowSniper Bot Manager
COLOR 0A

echo ==================================================
echo      FLOWSNIPER - AUTO UPDATE & START SYSTEM
echo ==================================================
echo.

echo [1/2] Verificando atualizacoes no GitHub...
git pull origin main
IF %0 NEQ 0 (
    echo.
    echo [AVISO] Nao foi possivel atualizar Automaticamente.
    echo Continuando com a versao atual...
) ELSE (
    echo.
    echo [SUCESSO] Codigo atualizado com as ultimas correcoes!
)

echo.
echo [2/2] Instalando dependencias novas (se houver)...
call npm install
echo.

echo ==================================================
echo      ROBO INICIADO - NAO FECHE ESTA JANELA
echo ==================================================
echo.
echo Para parar o robo, pressione CTRL + C
echo.

npm run dev -- --host
pause
