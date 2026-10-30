# MatchStrike Web

Frontend на Vue 3, TypeScript, Vite и Tailwind CSS. Главная страница сейчас использует демонстрационные данные и проверяет доступность Laravel API.

## Локальный запуск

Требуется Node.js 20 или новее.

```powershell
npm install
npm run dev
```

Vite запускает сайт на `http://127.0.0.1:5173` и проксирует запросы `/api/*` в Laravel на `http://127.0.0.1:8000`.

Для production-сборки выполните `npm run build`. В production веб-сервер должен отдавать Vue-приложение на `/`, а запросы `/api/*` направлять в Laravel.