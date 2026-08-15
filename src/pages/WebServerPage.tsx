import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';
import { NginxSite, WebServerStatus, Repository } from '../types.js';
import { Globe, RefreshCw, Pencil, Power, PowerOff, FileCheck2, RotateCw, X, Plus, Save, ShieldCheck } from 'lucide-react';

type Engine = 'nginx' | 'caddy';

interface EditorModalProps {
  title: string;
  content: string;
  note?: string;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
}

const EditorModal: React.FC<EditorModalProps> = ({ title, content, note, onClose, onSave }) => {
  const [value, setValue] = useState(content);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await onSave(value);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white border border-[#E5E0D8] rounded-[28px] shadow-2xl flex flex-col overflow-hidden text-[#2C2C2C]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E0D8] bg-[#F3EFEA]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white border border-[#E5E0D8] text-[#4A5D45]">
              <Pencil className="w-5 h-5 text-[#82937E]" />
            </div>
            <h3 className="text-base font-serif font-bold text-[#4A5D45]">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-[#8C857E] hover:text-[#2C2C2C] hover:bg-[#E5E0D8]/50 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {note && <p className="text-[11px] text-[#8C857E] mb-3">{note}</p>}
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            spellCheck={false}
            className="w-full h-[50vh] font-mono text-xs bg-[#F3EFEA] border border-[#E5E0D8] rounded-2xl p-4 text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45] leading-relaxed"
          />
        </div>
        <div className="flex items-center justify-between px-6 py-3 bg-[#F3EFEA] border-t border-[#E5E0D8]">
          <span className="text-[11px] text-[#8C857E]">Konfigurasi divalidasi sebelum disimpan; dikembalikan otomatis jika invalid.</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 rounded-xl text-xs font-semibold text-[#6E6760] bg-white hover:bg-[#EAE4DC] transition border border-[#E5E0D8]">
              Batal
            </button>
            <button onClick={save} disabled={busy} className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#4A5D45] hover:bg-[#3E4F3A] transition flex items-center gap-1.5 disabled:opacity-40">
              <Save className="w-3.5 h-3.5" /> Simpan & Validasi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const WebServerPage: React.FC = () => {
  const [engine, setEngine] = useState<Engine>('nginx');
  const [status, setStatus] = useState<WebServerStatus | null>(null);
  const [sites, setSites] = useState<NginxSite[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<{ title: string; content: string; note?: string; save: (c: string) => Promise<void> } | null>(null);
  const [proxyOpen, setProxyOpen] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await api.getWebServerStatus();
      setStatus(s);
      if (!s.nginx.installed && s.caddy.installed) setEngine('caddy');
      return s;
    } catch (err) {
      console.error('Failed to fetch web server status:', err);
      return null;
    }
  }, []);

  const fetchSites = useCallback(async () => {
    try {
      setSites(await api.getNginxSites());
    } catch (err) {
      console.error('Failed to fetch nginx sites:', err);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const s = await fetchStatus();
    if (s?.nginx.installed) await fetchSites();
    try {
      setRepositories(await api.getRepositories());
    } catch (err) {
      console.error('Failed to fetch repositories:', err);
    }
    setLoading(false);
  }, [fetchStatus, fetchSites]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openNginxEditor = async (name: string) => {
    try {
      const { content } = await api.getNginxSite(name);
      setEditor({
        title: `nginx — ${name}`,
        content,
        note: 'Divalidasi dengan `nginx -t` sebelum disimpan.',
        save: (c) => api.saveNginxSite(name, c)
      });
    } catch (err: any) {
      alert(err.message || 'Failed to load config');
    }
  };

  const openCaddyEditor = async () => {
    try {
      const { path, content } = await api.getCaddyfile();
      setEditor({
        title: `Caddyfile — ${path}`,
        content,
        note: 'Divalidasi dengan `caddy validate` sebelum disimpan.',
        save: (c) => api.saveCaddyfile(c)
      });
    } catch (err: any) {
      alert(err.message || 'Failed to load Caddyfile');
    }
  };

  const nginxSiteAction = async (site: NginxSite, enable: boolean) => {
    if (!window.confirm(`${enable ? 'Enable' : 'Disable'} site "${site.name}"?`)) return;
    try {
      await api.nginxSiteAction(site.name, enable ? 'enable' : 'disable');
      await fetchSites();
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    }
  };

  const runSimple = async (fn: () => Promise<any>, okMsg: string) => {
    try {
      const res = await fn();
      if (okMsg) alert(okMsg);
      return res;
    } catch (err: any) {
      alert(err.message || 'Operation failed');
      return null;
    }
  };

  const notInstalled = status && !status.nginx.installed && !status.caddy.installed;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif text-[#4A5D45] tracking-tight">Web Server</h2>
          <p className="text-xs text-[#8C857E] mt-0.5">
            {status?.nginx.installed && `nginx ${status.nginx.version || ''} · `}
            {status?.caddy.installed && `caddy ${status.caddy.version || ''}`}
            {!status?.nginx.installed && !status?.caddy.installed && 'Kelola konfigurasi nginx / caddy dan generate reverse proxy'}
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition flex items-center gap-1.5 shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {notInstalled ? (
        <div className="p-10 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#F3EFEA] flex items-center justify-center text-[#82937E] mb-4">
            <Globe className="w-7 h-7" />
          </div>
          <h3 className="text-base font-serif font-bold text-[#4A5D45]">nginx / caddy belum terpasang</h3>
          <p className="text-xs text-[#8C857E] mt-1 max-w-md mx-auto">
            Install nginx atau caddy lewat tab "Installer". Halaman ini aktif otomatis setelah salah satunya terpasang.
          </p>
        </div>
      ) : (
        <>
          {/* Engine tabs */}
          <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8]">
            <button
              onClick={() => setEngine('nginx')}
              disabled={!status?.nginx.installed}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                engine === 'nginx' ? 'bg-white text-[#4A5D45] shadow-sm' : 'text-[#8C857E] hover:text-[#4A5D45]'
              }`}
            >
              nginx {status?.nginx.installed ? '✓' : '(tidak terpasang)'}
            </button>
            <button
              onClick={() => setEngine('caddy')}
              disabled={!status?.caddy.installed}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                engine === 'caddy' ? 'bg-white text-[#4A5D45] shadow-sm' : 'text-[#8C857E] hover:text-[#4A5D45]'
              }`}
            >
              caddy {status?.caddy.installed ? '✓' : '(tidak terpasang)'}
            </button>
          </div>

          {/* nginx panel */}
          {engine === 'nginx' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => runSimple(() => api.testNginx(), '')}
                  className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition flex items-center gap-1.5 shadow-xs"
                >
                  <FileCheck2 className="w-3.5 h-3.5" /> nginx -t
                </button>
                <button
                  onClick={() => runSimple(() => api.reloadNginx(), 'nginx reloaded')}
                  className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition flex items-center gap-1.5 shadow-xs"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Reload
                </button>
                <button
                  onClick={() => setProxyOpen(true)}
                  className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-white bg-[#4A5D45] hover:bg-[#3E4F3A] transition flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Generate Reverse Proxy
                </button>
              </div>

              <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm">
                <h3 className="text-sm font-serif font-bold text-[#4A5D45] mb-3">Sites ({status?.nginx.sitesDir || '/etc/nginx/sites-available'})</h3>
                <div className="overflow-x-auto">
                  {sites.length > 0 ? (
                    <table className="w-full text-left text-xs text-[#2C2C2C]">
                      <thead className="bg-[#F3EFEA] text-[#4A5D45] text-[11px] uppercase font-semibold border-b border-[#E5E0D8]">
                        <tr>
                          <th className="py-3 px-3 rounded-l-xl">Site</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3 text-right rounded-r-xl">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E0D8]">
                        {sites.map((site) => (
                          <tr key={site.name} className="hover:bg-[#F3EFEA]/60 transition">
                            <td className="py-3.5 px-3 font-mono text-[11px] font-semibold text-[#4A5D45]">{site.name}</td>
                            <td className="py-3.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                                  site.enabled ? 'bg-[#4A5D45]/10 text-[#4A5D45] border-[#4A5D45]/25' : 'bg-[#F3EFEA] text-[#8C857E] border-[#E5E0D8]'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${site.enabled ? 'bg-[#4A5D45]' : 'bg-[#C6BEB4]'}`} />
                                {site.enabled ? 'enabled' : 'disabled'}
                              </span>
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="flex items-center justify-end gap-1.5">
                                <button onClick={() => openNginxEditor(site.name)} title="Edit config" className="p-1.5 rounded-lg hover:bg-[#82937E]/15 text-[#82937E] transition">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                {!site.enabled ? (
                                  <button onClick={() => nginxSiteAction(site, true)} title="Enable" className="p-1.5 rounded-lg hover:bg-[#4A5D45]/10 text-[#4A5D45] transition">
                                    <Power className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button onClick={() => nginxSiteAction(site, false)} title="Disable" className="p-1.5 rounded-lg hover:bg-[#C86D51]/10 text-[#C86D51] transition">
                                    <PowerOff className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-[#8C857E] text-center py-6">Tidak ada site config.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* caddy panel */}
          {engine === 'caddy' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => openCaddyEditor()}
                  className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition flex items-center gap-1.5 shadow-xs"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit Caddyfile
                </button>
                <button
                  onClick={() => runSimple(() => api.reloadCaddy(), 'caddy reloaded')}
                  className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition flex items-center gap-1.5 shadow-xs"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Reload
                </button>
                <button
                  onClick={() => setProxyOpen(true)}
                  className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-white bg-[#4A5D45] hover:bg-[#3E4F3A] transition flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Generate Reverse Proxy
                </button>
              </div>

              <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-serif font-bold text-[#4A5D45]">Caddyfile</h3>
                    <p className="text-[11px] text-[#8C857E] mt-0.5 font-mono">{status?.caddy.caddyfilePath || '/etc/caddy/Caddyfile'}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-[#4A5D45]/10 text-[#4A5D45] border-[#4A5D45]/25">
                    <ShieldCheck className="w-3.5 h-3.5" /> Auto-HTTPS
                  </span>
                </div>
                <p className="text-xs text-[#8C857E] mt-3">
                  Caddy mengurus sertifikat TLS otomatis (Let's Encrypt) untuk tiap domain. Blok proxy hasil generate memakai marker{' '}
                  <code className="font-mono"># HSDM-BEGIN</code> / <code className="font-mono"># HSDM-END</code> sehingga aman di-update.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {editor && <EditorModal {...editor} onClose={() => setEditor(null)} />}

      {proxyOpen && (
        <ReverseProxyModal
          engine={engine}
          repositories={repositories}
          onClose={() => setProxyOpen(false)}
          onDone={async () => {
            if (engine === 'nginx') await fetchSites();
          }}
        />
      )}
    </div>
  );
};

// ---------- Reverse Proxy Generator ----------

const ReverseProxyModal: React.FC<{
  engine: Engine;
  repositories: Repository[];
  onClose: () => void;
  onDone: () => Promise<void>;
}> = ({ engine, repositories, onClose, onDone }) => {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [targetPort, setTargetPort] = useState('3000');
  const [busy, setBusy] = useState(false);

  const applyRepo = (repoId: number) => {
    const repo = repositories.find((r) => r.id === repoId);
    if (!repo) return;
    if (repo.domain) setDomain(repo.domain);
    if (repo.proxy_target_port) setTargetPort(String(repo.proxy_target_port));
    if (!name.trim()) setName(repo.name);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const result = await api.generateReverseProxy({
        engine,
        name,
        domain,
        targetPort: parseInt(targetPort, 10)
      });
      alert(result.message);
      await onDone();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Gagal membuat reverse proxy');
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full px-3.5 py-2 rounded-xl bg-white border border-[#E5E0D8] text-xs text-[#2C2C2C] placeholder-[#8C857E] focus:outline-none focus:border-[#4A5D45]';
  const labelCls = 'text-[11px] font-semibold text-[#4A5D45] uppercase tracking-wider block mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg max-h-[90vh] bg-white border border-[#E5E0D8] rounded-[28px] shadow-2xl flex flex-col overflow-hidden text-[#2C2C2C]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E0D8] bg-[#F3EFEA]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white border border-[#E5E0D8] text-[#4A5D45]">
              <Globe className="w-5 h-5 text-[#82937E]" />
            </div>
            <h3 className="text-base font-serif font-bold text-[#4A5D45]">Generate Reverse Proxy — {engine}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-[#8C857E] hover:text-[#2C2C2C] hover:bg-[#E5E0D8]/50 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className={labelCls}>Prefill dari repository (opsional)</label>
            <select
              onChange={(e) => e.target.value !== '' && applyRepo(Number(e.target.value))}
              className={inputCls}
            >
              <option value="">— Pilih repository —</option>
              {repositories.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Nama site / label *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-app" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Domain *</label>
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="app.example.com" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Target port (aplikasi) *</label>
            <input value={targetPort} onChange={(e) => setTargetPort(e.target.value)} type="number" min={1} max={65535} placeholder="3000" className={inputCls} />
          </div>
          <p className="text-[11px] text-[#8C857E] bg-[#F3EFEA] border border-[#E5E0D8] rounded-2xl p-3">
            {engine === 'nginx'
              ? 'Membuat file di sites-available, enable symlink, jalankan `nginx -t`, lalu reload. Arahkan DNS domain ke IP server.'
              : 'Menambahkan blok site ke Caddyfile (auto-HTTPS), validasi `caddy validate`, lalu reload. Arahkan DNS domain ke IP server.'}
          </p>
        </div>
        <div className="flex justify-end gap-2 px-6 py-3 bg-[#F3EFEA] border-t border-[#E5E0D8]">
          <button onClick={onClose} className="px-4 py-1.5 rounded-xl text-xs font-semibold text-[#6E6760] bg-white hover:bg-[#EAE4DC] transition border border-[#E5E0D8]">
            Batal
          </button>
          <button
            onClick={submit}
            disabled={busy || !name.trim() || !domain.trim() || !targetPort}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#4A5D45] hover:bg-[#3E4F3A] transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" /> Generate
          </button>
        </div>
      </div>
    </div>
  );
};