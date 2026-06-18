@echo off
chcp 65001 >nul
cd /d E:\健身小程序

echo 🔗 正在推送至 Gitee...
git push -u origin master

echo.
echo ✅ 推送完成！
echo 📌 接下来：Gitee 仓库 -> 服务 -> Gitee Pages -> 部署
echo 🎉 稍等片刻即可上线！
pause
