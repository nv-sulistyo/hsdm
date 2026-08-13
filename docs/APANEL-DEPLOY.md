# Panduan Deploy & Penggunaan — Home Server Deploy Manager

Setup yang didukung panduan ini: **Ubuntu Server + aaPanel**, diakses lewat domain dengan **Cloudflare Tunnel**.

---

## 1. Ringkasan

Aplikasi ini adalah panel web (React + Express + SQLite) untuk:
- Menambah repositori GitHub dan melakukan `git pull` otomatis ke direktori situs di aaPanel (`/www/wwwroot/...`).
- Auto-deploy via **webhook GitHub** (setiap push langsung update situs).
- Menjalankan perintah sebelum/sesudah pull (mis. `npm install && npm run build`).
- Menyimpan log deployment, riwayat webhook, dan audit log.

**Arsitektur:**

```
GitHub (push)
   │  webhook POST https://app.domain-anda.com/webhooks/github/<id>
   ▼
Cloudflare Tunnel (cloudflared) ──► http://localhost:3210
                                          │
                              Home Server Deploy Manager
                                          │ git pull + before/post command
                                          ▼
                              /www/wwwroot/nama-situs  (aaPanel website)
```

---

## 2. Prasyarat

| Kebutuhan | Versi / Keterangan |
|---|---|
| OS | Ubuntu 20.04+ (dengan aaPanel terpasang) |
| Node.js | **22.5+** (wajib — aplikasi memakai SQLite bawaan `node:sqlite`) |
| Git | `apt install git` |
| cloudflared | Untuk Cloudflare Tunnel |
| GitHub repo | Repositori yang ingin di-deploy |

Periksa versi Node:

```bash
node -v   # harus >= 22.5
npm -v
```

---

## 3. Deploy Aplikasi di aaPanel

### 3.1 Install Node.js 22

Lewat aaPanel:
**App Store → Node.js → Install Node.js 22 (LTS)**

Atau manual:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3.2 Upload Project

Letakkan project di direktori sendiri, contoh: `/www/wwwroot/hsdm` (bukan di root situs yang akan dikelola).

```bash
cd /www/wwwroot/hsdm
# upload file project (zip via panel, git clone, atau scp)
npm install --omit=dev
```

> Catatan: `--omit=dev` tidak wajib; jika ingin menjalankan build di server tetap perlu devDependencies (vite, esbuild, tsx). Saran: jalankan `npm install` lengkap saat build, lalu `npm prune --omit=dev`.

### 3.3 Build Produksi

```bash
cd /www/wwwroot/hsdm
npm install
npm run build
```

Hasil: `dist/` (SPA statis) + `dist/server.cjs` (bundle server).

### 3.4 Set JWT_SECRET & PORT

> **Penting:** aplikasi TIDAK membaca file `.env` secara otomatis. `JWT_SECRET` harus dari environment. Tanpa di-set, secret dibuat acak dan disimpan di `database/.jwt_secret` (otomatis persist, jadi aman juga — tapi lebih baik eksplisit).
>
> **Port**: bawaan `3000`. Jika sudah terpakai, tentukan port lain lewat env `PORT` (contoh di bawah memakai `3210` — sesuaikan dengan port Anda). Ingat untuk menyesuaikan Nginx / tunnel bila port diubah.

```bash
export JWT_SECRET="$(openssl rand -hex 32)"
export PORT=3210
```

### 3.5 Jalankan dengan PM2 (disarankan)

Install PM2:

```bash
sudo npm install -g pm2
```

Start:

```bash
cd /www/wwwroot/hsdm
JWT_SECRET="ganti_dengan_secret_acak_panjang" PORT=3210 NODE_ENV=production pm2 start dist/server.cjs --name hsdm
pm2 save
pm2 startup   # ikuti perintah yang muncul
```

Cek: `pm2 status` → status `online`. Uji: `curl http://localhost:3210/api/health`.

**Update aplikasi di kemudian hari:**

```bash
cd /www/wwwroot/hsdm
git pull            # jika di-clone dari git, atau upload ulang
npm install
npm run build
pm2 restart hsdm
```

### 3.6 (Opsional) Nginx Reverse Proxy di aaPanel

Situs → tambah situs → **Reverse Proxy** → target `http://127.0.0.1:3210` (ganti port sesuai `PORT`). Berguna jika ingin akses lewat IP/domain panel tanpa tunnel. Konfigurasi defaultnya:

```nginx
location / {
    proxy_pass http://127.0.0.1:3210;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## 4. Cloudflare Tunnel (domain publik)

Karena **GitHub tidak bisa mengakses `localhost`/LAN**, webhook harus memakai URL publik. Pakai Cloudflare Tunnel (gratis):

### 4.1 Instal cloudflared

```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

### 4.2 Login & buat named tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create hsdm
```

### 4.3 Konfigurasi `~/.cloudflared/config.yml`

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: app.domain-anda.com
    service: http://localhost:3210
  - service: http_status:404
```

### 4.4 DNS di Cloudflare

```bash
cloudflared tunnel route dns hsdm app.domain-anda.com
```

### 4.5 Jalankan sebagai service

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
systemctl status cloudflared   # active (running)
```

Uji: buka `https://app.domain-anda.com/api/health` di browser → harus JSON `{"status":"ok",...}`.

> Mode cepat alternatif (tanpa config file): `cloudflared tunnel --url http://localhost:3210` — URL acak `https://xxxx.trycloudflare.com`; cocok untuk tes, bukan produksi.

---

## 5. Cara Penggunaan

### 5.1 Login pertama

1. Buka `https://app.domain-anda.com`.
2. Login default: username **`admin`**, password **`admin123`**.
3. **Segera ganti** di **Settings → Account Settings** (username & password, wajib isi password lama).

### 5.2 Tambah SSH Key untuk GitHub

Tab **Git & SSH** → **Generate SSH Key** (default `~/.ssh/id_ed25519` untuk user eksekusi, mis. `nova`). Salin **public key**, lalu di GitHub:

**repo → Settings → Deploy keys → Add deploy key** (read-only cukup untuk pull).

### 5.3 Tambah Repositori

Tab **Repositories → Add Repository**:

| Field | Contoh | Keterangan |
|---|---|---|
| Name | `my-website` | Nama tampilan |
| Git URL | `git@github.com:user/my-website.git` | Boleh https/ssh |
| Branch | `main` | Branch yang di-deploy |
| Local Path | `/www/wwwroot/my-website` | Direktori situs di aaPanel — **wajib di dalam allowed deploy roots** |
| Mode | `CLONE` | CLONE untuk clone baru, CONNECT untuk folder yang sudah ada |
| Execution User | `nova` | User Linux yang punya folder (biasanya `www`) |
| Deployment Trigger | `BOTH` | `MANUAL`, `WEBHOOK`, atau `BOTH` |
| Auto Deploy | on | Deploy otomatis saat webhook |

**Before / Post-Pull Command** (opsional): perintah shell yang dijalankan sebelum/sesudah pull, mis. `npm install && npm run build` atau restart service.

> Folder target harus dimiliki user eksekusi:
> ```bash
> chown -R nova:nova /www/wwwroot/my-website
> ```

### 5.4 Konfigurasi Webhook GitHub

1. Buka detail repositori di aplikasi → salin **Webhook URL** (`https://app.domain-anda.com/webhooks/github/<id_repo>`) dan **Webhook Secret**.
2. Di GitHub: **repo → Settings → Webhooks → Add webhook**:
   - **Payload URL**: URL di atas
   - **Content type**: `application/json`
   - **Secret**: isi dari aplikasi
   - Events: pilih **Just the push event** (cukup)
3. Klik Add webhook. GitHub langsung kirim event tes (`ping`) — harus menerima 200.

Sekarang setiap `git push` ke branch itu → aplikasi otomatis `pull` + jalankan command + situs update.

### 5.5 Pemantauan

- **Deployments**: riwayat deploy, log output lengkap, status (SUCCESS/FAILED).
- **Webhooks**: riwayat event masuk, valid/tidaknya signature, deteksi retry ganda GitHub (dedup otomatis).
- **Audit Logs**: jejak login, perubahan repo, perubahan pengaturan.
- **Dashboard**: ringkasan status semua repo.

### 5.6 Pengaturan penting (Settings)

| Pengaturan | Fungsi |
|---|---|
| System Execution User | User Linux tempat semua git & command dijalankan (baca `/etc/passwd`) |
| Allowed Deploy Roots | Batas direktori tempat repo boleh diletakkan (default `/www/wwwroot`; direktori sistem seperti `/etc`, `/home` ditolak) |
| Git Executable / SSH Key / Known Hosts | Path git, key SSH, dan known_hosts |

---

## 6. Troubleshooting

| Gejala | Penyebab & Solusi |
|---|---|
| Webhook 404/timeout di GitHub | Tunnel mati: `systemctl status cloudflared`; pastikan URL publik benar (`curl https://app.domain-anda.com/api/health`) |
| Webhook 200 tapi tidak deploy | Branch di GitHub ≠ branch repo; `deployment_trigger` belum `WEBHOOK`/`BOTH`; webhook untuk repo lain |
| `Signature verification failed` | Webhook Secret di GitHub ≠ secret di aplikasi |
| `Permission denied` saat pull | Folder bukan milik user eksekusi: `chown -R nova:nova /www/wwwroot/xxx` |
| `Path not allowed` saat tambah repo | Local Path di luar allowed roots |
| Log: `This is an experimental feature` (SQLite) | Wajar di Node 22, tidak berbahaya |
| Situs update tapi build tidak jalan | Isi `post_pull_command` (mis. `cd ... && npm install && npm run build`) |
| Lupa password | Hapus `database/deployment_manager.db` lalu restart PM2 → user `admin/admin123` dibuat ulang (catatan: data repo ikut hilang) |
