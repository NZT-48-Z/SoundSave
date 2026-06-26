<h1 align="center"> SoundSave </h1>

<p align="center">
  <a href="https://www.python.org/downloads/"><img src="https://img.shields.io/badge/Python-3.12+-blue.svg" alt="Python"></a>
  <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.115+-009688.svg" alt="FastAPI"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-18-61DAFB.svg" alt="React"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License"></a>
</p>

🌐 [EN](README.md) | [RU](README_RUS.md)

---

> **Россия / СНГ:** SoundCloud и YouTube заблокированы на территории РФ. Для работы приложения требуется VPN.

---

<!-- ABOUT -->
<h1 align="left">ℹ️ О проекте</h1>

- **Источники:** SoundCloud, YouTube, любой URL поддерживаемый [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- **Формат:** MP3 320 kbps со встроенными ID3-тегами
- **Backend:** [**`Python 3.12`**](https://www.python.org/) · [**`FastAPI`**](https://fastapi.tiangolo.com/) · [**`yt-dlp`**](https://github.com/yt-dlp/yt-dlp)
- **Frontend:** [**`React 18`**](https://react.dev/) · [**`Vite 5`**](https://vite.dev/) · [**`Tailwind CSS`**](https://tailwindcss.com/)
- **База данных:** [**`SQLite`**](https://www.sqlite.org/) (async через SQLAlchemy)
- **FFmpeg:** загружается автоматически через `static-ffmpeg` — ручная установка не нужна

</br>

---

## 🖼️ Галерея

![Поиск](Images/Demonstration/1.png)
![Результаты](Images/Demonstration/2.png)
![Очередь](Images/Demonstration/3.png)
![Загрузки](Images/Demonstration/4.png)

---

## 🚀 Возможности

- **Поиск** — текстовый поиск по SoundCloud или вставка любой ссылки (SoundCloud, YouTube, все источники yt-dlp)
- **Очередь** — редактирование метаданных перед скачиванием: название, исполнитель, альбом, жанр, обложка
- **Массовое скачивание** — MP3 320 kbps со встроенными ID3-тегами (включая обложку)
- **Импорт трек-листа** — вставь сырой текст с парами «название + ссылка», отдельными ссылками или поисковыми запросами
- **Яндекс Музыка** — импорт публичных плейлистов (требует авторизацию через аккаунт Яндекса)
- **Прогресс в реальном времени** — статус каждого трека: ожидание → загрузка → конвертация → теггинг → готово
- **Отмена** — можно отменить любую загрузку в процессе
- **Альтернативы** — поиск замены, если трек не удалось скачать
- **Предпрослушивание** — слушай превью трека до добавления в очередь
- **Отчёт о сессии** — итоговое модальное окно после каждой партии скачиваний

---

## 📦 Требования

- Python 3.12+
- Node.js 18+
- FFmpeg — **ручная установка не нужна**, скачивается автоматически

## ⚡ Быстрый старт

```bash
git clone https://github.com/NZT-48-Z/SoundSave.git
cd SoundSave
```

**Backend** (терминал 1):

Через [`uv`](https://docs.astral.sh/uv/) (рекомендуется):

```bash
cd backend
uv venv
uv sync
uv run python main.py
```

Или через `pip`:

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install .
python main.py
```

**Frontend** (терминал 2):

```bash
cd frontend
npm install
npm run dev
```

Открой [http://localhost:3000](http://localhost:3000).

---

## ⚙️ Конфигурация

Все настройки по умолчанию работают без изменений. Для переопределения отредактируй `backend/.env`:

```env
PORT=8000
DOWNLOAD_DIR=~/Music/SoundSave
DB_PATH=./soundsave.db
DEBUG=true
```

---

## 🎧 Яндекс Музыка

Для импорта плейлистов подключи аккаунт: нажми кнопку импорта в приложении и пройди OAuth-авторизацию — токен сохраняется локально через системный keyring.

---

## 📄 Лицензия

[MIT](LICENSE)
