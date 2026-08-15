import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { AppSettings, SystemEnvironment } from '../types.js';
import {
  BookOpen,
  Key,
  FolderGit2,
  Webhook,
  Settings,
  ShieldCheck,
  CheckCircle2,
  Terminal,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Lock,
  Zap,
  Layers,
  HelpCircle,
  Copy,
  Check,
  RefreshCw,
  UserCheck
} from 'lucide-react';

type GuideSection = 'quickstart' | 'workflow' | 'webhooks' | 'security' | 'vps' | 'faq';

const GUIDE_SECTIONS: GuideSection[] = ['quickstart', 'workflow', 'webhooks', 'security', 'vps', 'faq'];

function getSectionFromHash(): GuideSection {
  const seg = window.location.hash.replace(/^#\/?/, '').split('/')[1] as GuideSection;
  return GUIDE_SECTIONS.includes(seg) ? seg : 'quickstart';
}

export const GuidePage: React.FC = () => {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<GuideSection>(getSectionFromHash);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [systemEnv, setSystemEnv] = useState<SystemEnvironment | null>(null);
  const [sshKeyPath, setSshKeyPath] = useState<string>('~/.ssh/id_ed25519');
  const [loading, setLoading] = useState(true);

  const fetchLiveConfig = async () => {
    setLoading(true);
    try {
      const [settingsRes, envRes, sshRes] = await Promise.all([
        api.getSettings().catch(() => null),
        api.detectEnvironment().catch(() => null),
        api.getSshKeyStatus().catch(() => null)
      ]);
      if (settingsRes) setSettings(settingsRes);
      if (envRes) setSystemEnv(envRes);
      if (sshRes?.keyPath) setSshKeyPath(sshRes.keyPath);
    } catch (err) {
      console.error('Failed to load live config for guide:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveConfig();
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const top = window.location.hash.replace(/^#\/?/, '').split('/')[0];
      if (top === 'guide') setActiveSection(getSectionFromHash());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const selectSection = (section: GuideSection) => {
    setActiveSection(section);
    const target = `#guide/${section}`;
    if (window.location.hash === target) return;
    window.location.hash = target;
  };

  const activeUser = settings?.execution_user || systemEnv?.executionUser || 'nova';
  const activeKeyPath = sshKeyPath || settings?.ssh_key_path || '~/.ssh/id_ed25519';
  const primaryRoot = settings?.allowed_deploy_roots?.[0] || '/www/wwwroot';
  const allowedRootsStr = settings?.allowed_deploy_roots?.join(', ') || '/www/wwwroot';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 md:p-8 rounded-[32px] bg-gradient-to-r from-[#4A5D45] to-[#3D4F38] text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center pr-10 pointer-events-none">
          <BookOpen className="w-64 h-64 text-white" />
        </div>
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-[#E5E0D8] border border-white/20">
              <BookOpen className="w-3.5 h-3.5 text-[#A3B899]" /> Panduan Penggunaan Real-time
            </div>
            <button
              onClick={fetchLiveConfig}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-xs font-medium text-[#E5E0D8] border border-white/20 transition"
              title="Refresh konfigurasi aktif"
            >
              <RefreshCw className={`w-3 h-3 text-[#A3B899] ${loading ? 'animate-spin' : ''}`} /> Sync Settings
            </button>
          </div>

          <h2 className="text-3xl font-serif tracking-tight font-bold">
            Home Server Deploy Manager
          </h2>
          <p className="text-xs md:text-sm text-[#E5E0D8] leading-relaxed">
            Sistem otomatisasi deployment Git aman tanpa hak akses root/sudo, didesain khusus untuk server aaPanel / Linux dengan isolasi user <code className="bg-black/30 px-1.5 py-0.5 rounded text-white font-mono font-bold">{activeUser}</code> dan proteksi webhook berstandar HMAC SHA256.
          </p>

          {/* Active Settings Summary Box */}
          <div className="pt-2">
            <div className="p-3 rounded-2xl bg-black/20 border border-white/15 text-xs text-[#E5E0D8] font-mono grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <span className="text-[#A3B899]">User System:</span> <strong className="text-white">{activeUser}</strong>
              </div>
              <div>
                <span className="text-[#A3B899]">SSH Key Path:</span> <strong className="text-white">{activeKeyPath}</strong>
              </div>
              <div className="truncate">
                <span className="text-[#A3B899]">Deploy Root:</span> <strong className="text-white">{primaryRoot}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Nav Pills */}
        <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-white/10 text-xs">
          <button
            onClick={() => selectSection('quickstart')}
            className={`px-3.5 py-1.5 rounded-xl font-medium transition ${
              activeSection === 'quickstart'
                ? 'bg-white text-[#4A5D45] font-bold shadow-xs'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            🚀 Alur Cepat (Quickstart)
          </button>
          <button
            onClick={() => selectSection('workflow')}
            className={`px-3.5 py-1.5 rounded-xl font-medium transition ${
              activeSection === 'workflow'
                ? 'bg-white text-[#4A5D45] font-bold shadow-xs'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            📁 Manajemen Repositori
          </button>
          <button
            onClick={() => selectSection('webhooks')}
            className={`px-3.5 py-1.5 rounded-xl font-medium transition ${
              activeSection === 'webhooks'
                ? 'bg-white text-[#4A5D45] font-bold shadow-xs'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            🔗 GitHub Webhook Auto-Deploy
          </button>
          <button
            onClick={() => selectSection('security')}
            className={`px-3.5 py-1.5 rounded-xl font-medium transition ${
              activeSection === 'security'
                ? 'bg-white text-[#4A5D45] font-bold shadow-xs'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            🛡️ Arsitektur Keamanan
          </button>
          <button
            onClick={() => selectSection('vps')}
            className={`px-3.5 py-1.5 rounded-xl font-medium transition ${
              activeSection === 'vps'
                ? 'bg-white text-[#4A5D45] font-bold shadow-xs'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            🧩 VPS Stack (Docker + Caddy)
          </button>
          <button
            onClick={() => selectSection('faq')}
            className={`px-3.5 py-1.5 rounded-xl font-medium transition ${
              activeSection === 'faq'
                ? 'bg-white text-[#4A5D45] font-bold shadow-xs'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            ❓ Troubleshooting & FAQ
          </button>
        </div>
      </div>

      {/* SECTION 1: QUICKSTART GUIDE */}
      {activeSection === 'quickstart' && (
        <div className="space-y-6">
          <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-4">
            <h3 className="text-lg font-serif font-bold text-[#4A5D45] flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#B87333]" /> Langkah-Langkah Konfigurasi Awal (3 Menit)
            </h3>
            <p className="text-xs text-[#8C857E]">
              Ikuti 4 langkah utama berikut untuk mulai menggunakan aplikasi ini dan mengaktifkan auto-deploy dari GitHub ke aaPanel server Anda.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Step 1 */}
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-[#4A5D45] text-white flex items-center justify-center font-bold text-xs shrink-0">1</span>
                  <h4 className="text-sm font-bold text-[#2C2C2C] flex-1">Setup SSH Key Server</h4>
                  <Key className="w-4 h-4 text-[#82937E] shrink-0" />
                </div>
                <p className="text-xs text-[#6E6760] leading-relaxed text-left">
                  Buka menu <strong className="text-[#4A5D45]">Git / SSH</strong>. Jika belum ada SSH key untuk user <code className="font-mono text-[#3D4F38] font-bold">{activeUser}</code>, klik <code className="bg-white px-1 py-0.5 rounded border border-[#E5E0D8] text-[11px]">Generate SSH Key</code>. Salin Public Key tersebut.
                </p>
                <p className="text-[11px] font-medium text-[#4A5D45] pt-1 text-left">
                  Lokasi Key Aktif: <code className="font-mono text-[#3D4F38]">{activeKeyPath}.pub</code>
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-[#4A5D45] text-white flex items-center justify-center font-bold text-xs shrink-0">2</span>
                  <h4 className="text-sm font-bold text-[#2C2C2C] flex-1">Pasang Key di GitHub (Account-Level)</h4>
                  <ExternalLink className="w-4 h-4 text-[#82937E] shrink-0" />
                </div>
                <p className="text-xs text-[#6E6760] leading-relaxed text-left">
                  Di GitHub buka <strong className="text-[#2C2C2C]">Settings &gt; SSH and GPG keys &gt; New SSH key</strong>, paste public key (type: Authentication Key). Satu key akun otomatis berlaku untuk <strong>semua</strong> repo Anda — termasuk repo private.
                </p>
                <p className="text-[11px] text-[#8C5828] leading-relaxed text-left">
                  Catatan: Jangan memasangnya sebagai <strong>Deploy Key per repo</strong> — satu deploy key hanya bisa ditempel di satu repo; repo kedua akan ditolak dengan error "Key already in use".
                </p>
                <p className="text-[11px] font-medium text-[#4A5D45] pt-1 text-left">
                  Tes Koneksi: Gunakan tombol <em>"Test GitHub Connection"</em> di menu Git/SSH dan pastikan muncul "Authenticated as: &lt;username akun Anda&gt;".
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-[#4A5D45] text-white flex items-center justify-center font-bold text-xs shrink-0">3</span>
                  <h4 className="text-sm font-bold text-[#2C2C2C] flex-1">Hubungkan Repositori</h4>
                  <FolderGit2 className="w-4 h-4 text-[#82937E] shrink-0" />
                </div>
                <p className="text-xs text-[#6E6760] leading-relaxed text-left">
                  Buka menu <strong className="text-[#4A5D45]">Repositories</strong>, lalu klik <code className="bg-white px-1 py-0.5 rounded border border-[#E5E0D8] text-[11px]">+ Add Repository</code>. Masukkan URL SSH (contoh: <code className="text-[#B87333]">git@github.com:user/repo.git</code>) dan Path Website di server (contoh: <code className="text-[#3D4F38]">{primaryRoot}/domain.com</code>).
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-[#4A5D45] text-white flex items-center justify-center font-bold text-xs shrink-0">4</span>
                  <h4 className="text-sm font-bold text-[#2C2C2C] flex-1">Pasang GitHub Webhook</h4>
                  <Webhook className="w-4 h-4 text-[#82937E] shrink-0" />
                </div>
                <p className="text-xs text-[#6E6760] leading-relaxed text-left">
                  Buka menu <strong className="text-[#4A5D45]">Webhooks</strong>. Salin Webhook Payload URL & Secret Key. Pasang di GitHub Repository <strong className="text-[#2C2C2C]">Settings &gt; Webhooks &gt; Add webhook</strong> (Content type: <code className="text-[#3D4F38]">application/json</code>).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: REPOSITORY WORKFLOW */}
      {activeSection === 'workflow' && (
        <div className="space-y-6">
          <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-4">
            <h3 className="text-lg font-serif font-bold text-[#4A5D45] flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-[#4A5D45]" /> Detail Cara Menambahkan & Mengelola Repositori
            </h3>
            <p className="text-xs text-[#8C857E]">
              Sistem mendukung dua mode penambahan repositori untuk fleksibilitas di server aaPanel:
            </p>

            <div className="space-y-4">
              {/* Mode 1: Clone New */}
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-[#4A5D45]">
                  <span className="px-2 py-0.5 rounded bg-[#4A5D45] text-white text-xs">Mode A</span>
                  Clone Repositori Baru (Clone New Repository)
                </div>
                <p className="text-xs text-[#6E6760] leading-relaxed">
                  Gunakan mode ini jika folder tujuan di server (misalnya <code className="text-[#3D4F38] font-mono">{primaryRoot}/my-app</code>) belum dibuat atau masih kosong. Aplikasi akan mengeksekusi <code className="font-mono text-[#B87333]">git clone &lt;git_url&gt; &lt;local_path&gt;</code> di bawah akun user <code className="font-mono text-[#3D4F38] font-bold">{activeUser}</code> secara otomatis.
                </p>
                <div className="bg-white p-3 rounded-xl border border-[#E5E0D8] text-xs font-mono space-y-1 text-[#2C2C2C]">
                  <div>Repository Name: <span className="text-[#4A5D45]">My E-Commerce Site</span></div>
                  <div>Git Remote URL: <span className="text-[#B87333]">git@github.com:mycompany/ecommerce.git</span></div>
                  <div>Target Local Path: <span className="text-[#3D4F38]">{primaryRoot}/ecommerce.com</span></div>
                  <div>Execution User: <span className="text-[#4A5D45]">{activeUser}</span></div>
                  <div>Git Branch: <span className="text-[#4A5D45]">main</span></div>
                </div>
              </div>

              {/* Mode 2: Link Existing */}
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-[#3D4F38]">
                  <span className="px-2 py-0.5 rounded bg-[#82937E] text-white text-xs">Mode B</span>
                  Hubungkan Folder yang Sudah Ada (Link Existing Directory)
                </div>
                <p className="text-xs text-[#6E6760] leading-relaxed">
                  Gunakan mode ini jika Anda sudah memiliki file website di <code className="text-[#3D4F38] font-mono">{primaryRoot}/domain.com</code> (misal website hasil setup dari dashboard aaPanel). Aplikasi akan mendeteksi apakah folder tersebut sudah merupakan Git repository. Jika sudah, status commit dan remote URL akan otomatis terbaca!
                </p>
              </div>

              {/* Git Strategies */}
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#4A5D45]">Opsi Strategi Git Pull (Pull Strategy)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-[#E5E0D8] space-y-1">
                    <span className="font-bold text-[#3D4F38] block">Stash & Pull (Default / Aman)</span>
                    <p className="text-[11px] text-[#8C857E]">
                      Menyimpan perubahan lokal sementara dengan <code className="font-mono">git stash</code>, menarik update terbaru, lalu mengembalikan stash.
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-[#E5E0D8] space-y-1">
                    <span className="font-bold text-[#C86D51] block">Force Reset (Overwrites Local)</span>
                    <p className="text-[11px] text-[#8C857E]">
                      Menimpa semua perubahan lokal di server dengan <code className="font-mono">git reset --hard origin/branch</code>. Sangat cocok untuk server produksi yang selalu mengikuti versi repo.
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-[#E5E0D8] space-y-1">
                    <span className="font-bold text-[#4A5D45] block">Fast-Forward Only</span>
                    <p className="text-[11px] text-[#8C857E]">
                      Hanya mengizinkan pull jika commit bersifat linier (<code className="font-mono">git pull --ff-only</code>).
                    </p>
                  </div>
                </div>
              </div>

              {/* Build Hooks */}
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#4A5D45]">Build & Post-Pull Commands (Deployment Hooks)</h4>
                <p className="text-xs text-[#6E6760]">
                  Anda dapat menentukan perintah bash yang secara otomatis akan dieksekusi setelah <code className="font-mono">git pull</code> berhasil. Semuanya berjalan di bawah akun sistem <code className="font-mono text-[#3D4F38] font-bold">{activeUser}</code>.
                </p>
                <div className="p-3 bg-[#2C2C2C] text-[#E5E0D8] rounded-xl font-mono text-xs space-y-1">
                  <div className="text-[#8C857E]"># Contoh untuk Node.js / React / Next.js:</div>
                  <div className="text-[#A3B899]">npm ci && npm run build</div>
                  <div className="text-[#8C857E] pt-2"># Contoh untuk Laravel / PHP:</div>
                  <div className="text-[#A3B899]">composer install --no-dev --optimize-autoloader && php artisan migrate --force</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: WEBHOOKS & AUTOMATION */}
      {activeSection === 'webhooks' && (
        <div className="space-y-6">
          <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-4">
            <h3 className="text-lg font-serif font-bold text-[#4A5D45] flex items-center gap-2">
              <Webhook className="w-5 h-5 text-[#82937E]" /> Panduan Integrasi GitHub Webhook
            </h3>
            <p className="text-xs text-[#8C857E]">
              Webhook memungkinkan GitHub untuk memberitahu server Anda secara instan setiap kali ada <code className="font-mono">git push</code> baru, pemicu deployment tanpa intervensi manual.
            </p>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-3">
                <h4 className="font-bold text-[#2C2C2C] text-sm">Langkah-Langkah Pasang Webhook di GitHub:</h4>
                <ol className="list-decimal list-inside space-y-2 text-[#6E6760] leading-relaxed">
                  <li>Buka repositori Anda di GitHub web.</li>
                  <li>Klik tab <strong className="text-[#2C2C2C]">Settings</strong> (di bagian kanan atas repositori).</li>
                  <li>Di menu sebelah kiri, pilih <strong className="text-[#2C2C2C]">Webhooks</strong>.</li>
                  <li>Klik tombol <strong className="text-[#4A5D45]">Add webhook</strong>.</li>
                  <li>Isi formulir webhook sesuai dengan data dari aplikasi ini:</li>
                </ol>

                <div className="bg-white p-3.5 rounded-xl border border-[#E5E0D8] space-y-2.5 font-mono">
                  <div className="flex justify-between items-center pb-2 border-b border-[#E5E0D8]">
                    <span className="text-[#8C857E]">Payload URL:</span>
                    <span className="text-[#3D4F38] font-bold">{typeof window !== 'undefined' ? window.location.origin : ''}/webhooks/github/&lt;id_repo&gt;</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-[#E5E0D8]">
                    <span className="text-[#8C857E]">Content type:</span>
                    <span className="text-[#2C2C2C] font-bold">application/json</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#8C857E]">Secret:</span>
                    <span className="text-[#B87333] font-bold">[Secret Key yang dibuat di menu Webhooks]</span>
                  </div>
                </div>

                <div className="p-3 bg-[#82937E]/15 rounded-xl text-[#3D4F38] space-y-1">
                  <span className="font-bold block">💡 Verifikasi Keamanan HMAC SHA256:</span>
                  <p className="text-[11px] text-[#6E6760]">
                    Setiap request webhook dari GitHub dilengkapi dengan header <code className="font-mono">X-Hub-Signature-256</code>. Server Home Server secara ketat memverifikasi signature ini. Request tanpa signature yang valid akan langsung ditolak dengan status HTTP 401.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: SECURITY ARCHITECTURE */}
      {activeSection === 'security' && (
        <div className="space-y-6">
          <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-4">
            <h3 className="text-lg font-serif font-bold text-[#4A5D45] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#4A5D45]" /> Arsitektur & Prinsip Keamanan Sistem
            </h3>
            <p className="text-xs text-[#8C857E]">
              Sistem ini dibangun dengan beberapa lapisan perlindungan (Defense in Depth) untuk menjamin keamanan penuh pada server aaPanel Anda:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Security Point 1 */}
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#4A5D45]">
                  <Lock className="w-4 h-4 text-[#82937E]" /> 1. Non-Root Execution (<code className="font-mono font-bold">{activeUser}</code>)
                </div>
                <p className="text-[#6E6760] leading-relaxed">
                  Aplikasi ini berjalan di bawah akun sistem khusus bernama <code className="font-mono text-[#3D4F38] font-bold">{activeUser}</code>. Tidak ada perintah yang berjalan sebagai <code className="font-mono text-[#C86D51]">root</code> atau menggunakan <code className="font-mono">sudo</code>, mencegah potensi privilege escalation jika ada instruksi malicious di hook script.
                </p>
              </div>

              {/* Security Point 2 */}
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#4A5D45]">
                  <ShieldCheck className="w-4 h-4 text-[#82937E]" /> 2. Allowed Deploy Roots Boundary
                </div>
                <p className="text-[#6E6760] leading-relaxed">
                  Sistem membatasi folder mana saja yang boleh disentuh oleh Git operation melalui whitelist <code className="font-mono text-[#3D4F38]">allowed_deploy_roots</code> (Aktif: <code className="font-mono text-[#3D4F38] font-bold">{allowedRootsStr}</code>). Usaha untuk meng-clone atau memanipulasi folder sistem seperti <code className="font-mono">/etc</code> atau <code className="font-mono">/usr</code> akan ditolak secara eksplisit.
                </p>
              </div>

              {/* Security Point 3 */}
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#4A5D45]">
                  <Terminal className="w-4 h-4 text-[#82937E]" /> 3. Command Injection Defense
                </div>
                <p className="text-[#6E6760] leading-relaxed">
                  Seluruh pemanggilan perintah Git dan SSH menggunakan <code className="font-mono text-[#3D4F38]">execFile</code> dengan array argumen terpisah. Hal ini meniadakan pemrosesan shell (<code className="font-mono">/bin/sh</code>) sehingga memblokir serangan injection via nama branch, URL, atau path.
                </p>
              </div>

              {/* Security Point 4 */}
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#4A5D45]">
                  <Layers className="w-4 h-4 text-[#82937E]" /> 4. Full Audit Trail Logging
                </div>
                <p className="text-[#6E6760] leading-relaxed">
                  Setiap aksi kritis—termasuk login, penambahan repositori, pemicuan deployment, pembuatan SSH key, dan pengubahan settings—dicatat secara permanen di database lokal <code className="font-mono">audit_logs</code> yang dapat dipantau di menu <strong className="text-[#4A5D45]">Audit Log</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: VPS STACK */}
      {activeSection === 'vps' && (
        <div className="space-y-6">
          <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-4">
            <h3 className="text-lg font-serif font-bold text-[#4A5D45] flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#B87333]" /> VPS Stack — Docker + Caddy Container (Level B)
            </h3>
            <p className="text-xs text-[#8C857E]">
              Topologi produksi: Cloudflare DNS proxy langsung (tanpa tunnel) ke satu container Caddy di network{' '}
              <code className="font-mono">proxy</code>, lalu ke container aplikasi berdasarkan <strong>nama service</strong> — bukan IP host.
            </p>

            <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] font-mono text-[11px] text-[#6E6760] space-y-1">
              <div className="text-[#4A5D45] font-semibold">// Topologi</div>
              <div>Cloudflare (proxy) ──▶ 80/443 ──▶ Caddy container (network `proxy`)</div>
              <div className="pl-6">├── reverse_proxy web:3000   (service web ter-attach ke `proxy`)</div>
              <div className="pl-6">├── reverse_proxy api:8080   (service api ter-attach ke `proxy`)</div>
              <div className="pl-6">└── db / redis ──▶ network project sendiri (TIDAK terjangkau Caddy)</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#4A5D45]">
                  <Settings className="w-4 h-4 text-[#82937E]" /> Cara kerja
                </div>
                <p className="text-[#6E6760] leading-relaxed">
                  HSDM <strong>tidak mengubah</strong> file compose GitHub. HSDM menulis <code className="font-mono">docker-compose.override.yml</code> otomatis
                  yang menambahkan service-service bertanda ke network <code className="font-mono">proxy</code>. File override digabung via{' '}
                  <code className="font-mono">docker compose -f compose.yml -f compose.override.yml up -d</code> saat deploy.
                </p>
                <p className="text-[#6E6760] leading-relaxed">
                  Service yang tidak ditandai (mis. db, redis) hanya berada di network default project → isolasi otomatis dari Caddy dan project lain.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#4A5D45]">
                  <CheckCircle2 className="w-4 h-4 text-[#82937E]" /> Menandai service untuk proxy
                </div>
                <p className="text-[#6E6760] leading-relaxed">
                  Tandai service web-facing (web, api) di dua tempat yang sama:
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    <li>Form repository: field <em>Services yang di-expose ke proxy</em>, atau</li>
                    <li>Tab Docker → tombol <em>Proxy Network</em> per service.</li>
                  </ul>
                  Keduanya tersimpan ke kolom <code className="font-mono">compose_proxy_services</code>.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#4A5D45]">
                  <Zap className="w-4 h-4 text-[#82937E]" /> expose vs ports
                </div>
                <p className="text-[#6E6760] leading-relaxed">
                  <code className="font-mono">expose:</code> hanya terbuka antar-container (internal) — <strong>disarankan</strong>.{' '}
                  <code className="font-mono">ports:</code> mem-publish ke host (risiko tabrakan port &amp; akses luar). Dalam mode container,
                  hanya Caddy yang membuka port 80/443 ke host.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#4A5D45]">
                  <Terminal className="w-4 h-4 text-[#82937E]" /> Generate Reverse Proxy
                </div>
                <p className="text-[#6E6760] leading-relaxed">
                  Di tab <strong>Web Server</strong>, pilih engine Caddy. Saat mode <em>container</em>, field <em>Target host</em> memakai{' '}
                  <strong>nama service</strong> (mis. <code className="font-mono">web</code>), bukan <code className="font-mono">127.0.0.1</code>.
                  Caddyfile divalidasi &amp; di-reload lewat <code className="font-mono">docker exec caddy ...</code>.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-3">
            <h4 className="text-sm font-serif font-bold text-[#4A5D45] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#82937E]" /> Langkah setup
            </h4>
            <ol className="list-decimal pl-5 space-y-2 text-xs text-[#6E6760]">
              <li>
                <strong className="text-[#4A5D45]">Installer</strong> → pasang <em>Docker + Compose</em> lalu <em>Caddy (container)</em> (membuat network{' '}
                <code className="font-mono">proxy</code> + compose infra di <code className="font-mono">{settings?.infrastructure_dir || '/opt/hsdm/infrastructure'}/caddy</code>).
                Opsional: Portainer (https://IP:9443) &amp; Netdata (http://IP:19999).
              </li>
              <li>
                <strong className="text-[#4A5D45]">Settings → VPS Stack</strong> → pastikan <em>Proxy Mode</em> = <em>container (Docker)</em>, Deploy Root, dan nama container.
              </li>
              <li>
                <strong className="text-[#4A5D45]">Tambahkan repository</strong> dengan path di dalam Deploy Root. Tandai service web-facing di form repo.
              </li>
              <li>
                <strong className="text-[#4A5D45]">Web Server → Generate Reverse Proxy</strong> → pilih Caddy, domain, target host = nama service, port internal.
              </li>
              <li>
                <strong className="text-[#4A5D45]">DNS</strong> → arahkan domain ke IP server (Cloudflare proxy). Caddy menerbitkan TLS otomatis via Let's Encrypt.
              </li>
            </ol>
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] text-[11px] text-[#6E6760]">
              <AlertTriangle className="w-4 h-4 text-[#B87333] shrink-0 mt-0.5" />
              <span>
                Mode <em>native</em> tetap tersedia untuk ko-eksistensi dengan aaPanel (nginx di host, reverse proxy ke 127.0.0.1). Webhook{' '}
                <code className="font-mono">/webhooks/github/:id</code> tetap berjalan di kedua mode. Uji coba penuh memerlukan server Linux dengan Docker daemon.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: FAQ & TROUBLESHOOTING */}
      {activeSection === 'faq' && (
        <div className="space-y-6">
          <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-4">
            <h3 className="text-lg font-serif font-bold text-[#4A5D45] flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#B87333]" /> Pertanyaan Umum & Pemecahan Masalah (Troubleshooting)
            </h3>

            <div className="space-y-3 text-xs">
              {/* FAQ 1 */}
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-1.5">
                <h4 className="font-bold text-[#2C2C2C] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#B87333]" /> Q: Muncul error "Permission denied (publickey)" saat Test Connection atau Git Pull?
                </h4>
                <p className="text-[#6E6760] leading-relaxed">
                  <strong>Penyebab:</strong> Public Key server belum ditambahkan ke GitHub, atau SSH Key dibuat untuk user lain.<br />
                  <strong>Solusi:</strong> Buka menu <strong>Git / SSH</strong>, salin SSH Public Key (lokasi aktif: <code className="font-mono text-[#3D4F38]">{activeKeyPath}.pub</code>), lalu tambahkan ke GitHub &gt; Settings &gt; SSH and GPG keys sebagai Authentication Key. Klik tombol <em>"Test GitHub Connection"</em> di menu Git/SSH dan pastikan status "AUTHENTICATED" beserta "Authenticated as: &lt;username Anda&gt;".
                </p>
              </div>

              {/* FAQ 2 */}
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-1.5">
                <h4 className="font-bold text-[#2C2C2C] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#B87333]" /> Q: Muncul error "Permission denied" atau "EACCES" saat menulis file di {primaryRoot}?
                </h4>
                <p className="text-[#6E6760] leading-relaxed">
                  <strong>Penyebab:</strong> Folder website di aaPanel dibuat oleh user <code className="font-mono">www</code> atau <code className="font-mono">root</code> sehingga user execution <code className="font-mono text-[#3D4F38] font-bold">{activeUser}</code> tidak memiliki akses tulis.<br />
                  <strong>Solusi:</strong> Di terminal server aaPanel, berikan kepemilikan atau grup yang sesuai kepada user <code className="font-mono text-[#3D4F38] font-bold">{activeUser}</code>. Contoh perintah:
                </p>
                <div className="p-2.5 bg-[#2C2C2C] text-[#E5E0D8] font-mono rounded-xl">
                  chown -R {activeUser}:www {primaryRoot}/domain.com
                </div>
              </div>

              {/* FAQ 3 */}
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-1.5">
                <h4 className="font-bold text-[#2C2C2C] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#B87333]" /> Q: GitHub Webhook mengembalikan response 401 "Invalid Signature"?
                </h4>
                <p className="text-[#6E6760] leading-relaxed">
                  <strong>Penyebab:</strong> Secret Key yang dikonfigurasi di GitHub Webhook Settings tidak cocok dengan Secret Key di menu Webhooks aplikasi.<br />
                  <strong>Solusi:</strong> Salin ulang Secret Key dari menu <strong>Webhooks</strong> di aplikasi ini dan paste tepat di kolom "Secret" pada GitHub Webhook settings.
                </p>
              </div>

              {/* FAQ 4 */}
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-1.5">
                <h4 className="font-bold text-[#2C2C2C] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#B87333]" /> Q: Error "Local Path is not inside allowed deploy roots"?
                </h4>
                <p className="text-[#6E6760] leading-relaxed">
                  <strong>Solusi:</strong> Buka menu <strong>Settings</strong>, lalu tambahkan direktori induk website Anda (misalnya <code className="font-mono">{primaryRoot}</code>) ke dalam daftar <strong>Allowed Deploy Roots</strong>, lalu simpan settings.
                </p>
              </div>

              {/* FAQ 5 */}
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-1.5">
                <h4 className="font-bold text-[#2C2C2C] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#B87333]" /> Q: Muncul "Key already in use" saat menambah Deploy Key di GitHub?
                </h4>
                <p className="text-[#6E6760] leading-relaxed">
                  <strong>Penyebab:</strong> Public key yang sama sudah terdaftar sebagai <strong>SSH key akun</strong> (GitHub &gt; Settings &gt; SSH and GPG keys) — satu key tidak bisa dipakai di dua tempat.<br />
                  <strong>Solusi:</strong> <strong>Tidak perlu menambah Deploy Key</strong>. SSH key akun otomatis berlaku untuk semua repo Anda, termasuk repo private. Cukup pastikan status di menu Git/SSH menunjukkan "AUTHENTICATED".
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
