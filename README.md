# Home Server Deploy Manager (HSDM)

Panel web self-hosted untuk **auto-deploy dari GitHub ke direktori situs di aaPanel**. Setiap `git push` langsung memicu `git pull` di folder situs, menjalankan perintah sebelum/sesudah deploy, dan mencatat seluruh riwayat deployment.

Target utama: **Ubuntu Server + aaPanel**, diakses publik lewat **Cloudflare Tunnel**.

## Fitur

- **Auto-deploy via webhook GitHub** — push = situs langsung update (verifikasi HMAC-SHA256, retry ganda otomatis di-dedup)
- **Manajemen repositori** — tambah repo GitHub, pilih branch, tentukan direktori target di `/www/wwwroot`, mode CLONE/CONNECT
- **Perintah before/post-pull** — mis. `npm install && npm run build`, restart service
- **SSH key management** — generate key di UI, tempel ke GitHub Deploy Keys
- **Pemantauan lengkap** — riwayat deployment + log output, riwayat webhook, audit log
- **Keamanan** — JWT auth (secret persist acak), rate limit login, batas direktori deploy, validasi URL git

## Teknologi

- **Frontend:** React 19, Vite, Tailwind CSS 4
- **Backend:** Express, SQLite bawaan Node (`node:sqlite`, butuh **Node 22.5+**)
- **Proses tunggal:** satu port melayani API + SPA

## Mulai Cepat (Development)

```bash
npm install
npm run dev        # http://localhost:3000 (ganti port dengan env PORT)
npm run lint       # typecheck (tsc --noEmit)
npm run build      # build produksi -> dist/
```

Login default: `admin` / `admin123` — **segera ganti** di Settings → Account Settings.

## Deploy di aaPanel (Ubuntu Server)

Panduan deploy lengkap + troubleshooting ada di bagian bawah README ini (lihat **[Pemecahan Masalah](#pemecahan-masalah)**).

### 1. Prasyarat

- Ubuntu 20.04+ dengan **aaPanel** terpasang
- **Node.js 22.5+** (wajib — aplikasi memakai SQLite bawaan Node)
- `git`, `cloudflared`

### 2. Install Node.js 22

Lewat GUI aaPanel:

> **aaPanel → App Store → cari "Node.js" → Install (Node.js 22)**

Atau lewat terminal:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git
node -v   # harus >= 22.5
```

### 3. Upload project & build

1. Lewat GUI: **aaPanel → File → /www/wwwroot** → buat folder `hsdm` → upload ZIP project → Extract.
2. Lalu di terminal:

```bash
cd /www/wwwroot/hsdm
npm install
npm run build
```

### 4. Jalankan dengan PM2

**Cara A — lewat GUI aaPanel (disarankan):**

> **aaPanel → App Store → "PM2 Manager" → Install**
> Setelah terpasang: **Website → tambah situs (bisa port-only)** atau buka **PM2 Manager** → *Add project*:
> - Project path: `/www/wwwroot/hsdm/dist/server.cjs`
> - Start file: `server.cjs`
> - Env: `NODE_ENV=production`, `PORT=3210`, `JWT_SECRET=<acak panjang>`

**Cara B — lewat terminal:**

```bash
sudo npm install -g pm2
cd /www/wwwroot/hsdm
JWT_SECRET="$(openssl rand -hex 32)" PORT=3210 NODE_ENV=production pm2 start dist/server.cjs --name hsdm
pm2 save
pm2 startup
```

> Aplikasi **tidak membaca `.env` otomatis** — env harus di-set (PM2 GUI "Env" atau command di atas). Port bawaan `3000`; jika sudah terpakai ganti lewat `PORT`.

Verifikasi: `curl http://localhost:3210/api/health` → `{"status":"ok",...}`

### 5. Cloudflare Tunnel (domain publik)

```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
cloudflared tunnel login
cloudflared tunnel create hsdm
```

`~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: app.domain-anda.com
    service: http://localhost:3210
  - service: http_status:404
```

```bash
cloudflared tunnel route dns hsdm app.domain-anda.com
sudo cloudflared service install && sudo systemctl start cloudflared
```

Verifikasi: buka `https://app.domain-anda.com/api/health` di browser.

### 6. Setup auto-deploy

1. **Login** → ganti kredensial default di Settings → Account Settings.
2. **Git & SSH** → Generate SSH Key → tempel public key ke GitHub (repo → Settings → Deploy keys).
3. **Repositories → Add Repository**:
   - Git URL: `git@github.com:user/repo.git`
   - Branch: `main`
   - Local Path: `/www/wwwroot/nama-situs` (wajib di dalam *Allowed Deploy Roots*, default `/www/wwwroot`)
   - Execution User: `nova` (pastikan pemilik folder: `chown -R nova:nova /www/wwwroot/nama-situs`)
   - Deployment Trigger: `BOTH`
4. **Webhook GitHub**: di repo → Settings → Webhooks → Add webhook:
   - Payload URL: `https://app.domain-anda.com/webhooks/github/<id_repo>`
   - Content type: `application/json`
   - Secret: isi *Webhook Secret* dari detail repositori di aplikasi

Selesai — setiap push otomatis pull + jalankan command dan situs ter-update.

## Pemecahan Masalah

| Gejala | Penyebab & Solusi |
|---|---|
| Webhook 404/timeout di GitHub | Tunnel mati: `systemctl status cloudflared`; pastikan URL publik benar (`curl https://app.domain-anda.com/api/health`) |
| Webhook 200 tapi tidak deploy | Branch di GitHub ≠ branch repo; `deployment_trigger` belum `WEBHOOK`/`BOTH`; webhook untuk repo lain |
| `Signature verification failed` | Webhook Secret di GitHub ≠ secret di aplikasi |
| `Permission denied` saat pull | Folder bukan milik user eksekusi: `chown -R nova:nova /www/wwwroot/xxx` |
| `Path not allowed` saat tambah repo | Local Path di luar *Allowed Deploy Roots* |
| Log: `This is an experimental feature` (SQLite) | Wajar di Node 22, tidak berbahaya |
| Situs update tapi build tidak jalan | Isi `post_pull_command` (mis. `cd ... && npm install && npm run build`) |
| Lupa password | Hapus `database/deployment_manager.db` lalu restart PM2 → user `admin/admin123` dibuat ulang (catatan: data repo ikut hilang) |

## Keamanan

- Semua endpoint API (kecuali login & webhook) butuh JWT
- JWT secret: env `JWT_SECRET`, fallback secret acak persist (bukan hardcoded)
- Rate limit login 10 percobaan/15 menit per IP
- Direktori sistem (`/etc`, `/home`, `/`, dll.) dilarang sebagai deploy root
- URL git yang diawali `-` (injeksi argumen) ditolak

## Struktur

```
server.ts                  # Express + Vite middleware, port dari env PORT
src/server/                # db (SQLite), routes/, services/, middleware/
src/                       # Frontend React: pages/, components/, services/api.ts
README.md                  # Panduan deploy aaPanel + Cloudflare Tunnel + penggunaan
```
