# Деплой IB4 Sales на VPS

Руководство по развёртыванию на VPS с учётом уже работающих приложений и VPN.

## Изоляция от других сервисов

| Сервис | Порт | Как избежать конфликта |
|--------|------|------------------------|
| IB4 Sales | **3001** | Приложение слушает порт 3001 (не 3000) |
| Nginx | 80, 443 | Reverse proxy по поддомену или пути |
| VPN (WireGuard и т.п.) | обычно UDP 51820 | Не пересекается с HTTP |
| Другое приложение | 3000 или иное | IB4 Sales на 3001 |

## 1. Подготовка VPS

```bash
# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2
sudo npm install -g pm2

# PostgreSQL (если ещё нет)
sudo apt install -y postgresql postgresql-contrib
```

## 2. Клонирование и сборка

```bash
cd /opt  # или ваша директория
git clone <ваш-репозиторий> ib4sales
cd ib4sales

npm install
npm run build
```

## 3. База данных

```bash
sudo -u postgres createdb ib4sales
sudo -u postgres createuser -P ib4user  # введите пароль
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ib4sales TO ib4user;"
```

## 4. Переменные окружения

Создайте `/opt/ib4sales/.env`:

```
DATABASE_URL=postgres://ib4user:пароль@localhost:5432/ib4sales
NEXTAUTH_SECRET=сгенерируйте-openssl-rand-base64-32
NEXTAUTH_URL=https://ib4sales.ваш-домен.com
```

Для production `NEXTAUTH_URL` должен быть полным URL (с https).

## 5. Миграции и первый пользователь

```bash
cd /opt/ib4sales
npm run db:init
npm run db:migrate
npm run db:create-user admin ваш_пароль
```

## 6. Запуск через PM2

```bash
cd /opt/ib4sales
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # автозапуск при перезагрузке
```

Приложение будет доступно на `http://localhost:3001`.

## 7. Nginx (reverse proxy)

Добавьте отдельный `server` блок — по поддомену или по пути. Пример для поддомена:

```nginx
# /etc/nginx/sites-available/ib4sales
server {
    listen 80;
    server_name ib4sales.ваш-домен.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }
}
```

Активация:

```bash
sudo ln -s /etc/nginx/sites-available/ib4sales /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 8. HTTPS (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d ib4sales.ваш-домен.com
```

После этого обновите `.env`:

```
NEXTAUTH_URL=https://ib4sales.ваш-домен.com
```

и перезапустите приложение:

```bash
pm2 restart ib4sales
```

## 9. Папка uploads

По умолчанию файлы сохраняются в `./uploads`. Для production можно вынести в отдельный каталог:

```
UPLOAD_DIR=/var/lib/ib4sales/uploads
```

Создайте каталог и выдайте права:

```bash
sudo mkdir -p /var/lib/ib4sales/uploads
sudo chown -R www-data:www-data /var/lib/ib4sales
# или пользователь, под которым запущен PM2
```

## 10. VPN

- **VPN-сервер** (WireGuard, OpenVPN) — использует свои порты (UDP). С HTTP (80, 443, 3001) не пересекается.
- **VPN-клиент** на VPS — трафик идёт через туннель, порты приложений не меняются.

Конфликтов с IB4 Sales не должно быть.

## Полезные команды

```bash
pm2 logs ib4sales      # логи
pm2 restart ib4sales   # перезапуск после изменений
pm2 stop ib4sales      # остановка
```
