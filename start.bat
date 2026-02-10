@echo off
echo 正在启动基金估值系统...

:: 启动后端
start "后端服务" cmd /k "cd /d %~dp0backend && npm run dev"

:: 等待2秒让后端先启动
timeout /t 2 /nobreak > nul

:: 启动前端
start "前端服务" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo 启动完成！
echo.
echo 本地访问:
echo   后端: http://localhost:3001
echo   前端: http://localhost:5173
echo.
echo IP 访问 (替换 YOUR_IP 为你的电脑 IP):
echo   后端: http://YOUR_IP:3001
echo   前端: http://YOUR_IP:5173
echo.
echo 查看 IP 地址: ipconfig
echo.
