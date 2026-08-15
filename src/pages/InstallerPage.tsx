import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api.js';
import { StackStatus, InstallJob } from '../types.js';
import { Package, Container, Globe, RefreshCw, Terminal, Download, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface ComponentDef {
  id: 'docker' | 'nginx' | 'caddy' | 'caddy_container';
  label: string;
  description: string;
  icon: React.ReactNode;
  statusKey?: 'docker' | 'compose' | 'nginx' | 'caddy' | 'caddyContainer';
}

const COMPONENTS: ComponentDef[] = [
  {
    id: 'docker',
    label: 'Docker + Compose',
    description: 'Docker Engine (docker.io) dan Docker Compose plugin. Basis untuk deploy `docker compose up -d --build`.',
    icon: <Container className="w-5 h-5 text-[#4A5D45]" />
  },
  {
    id: 'nginx',
    label: 'nginx',
    description: 'Web server & reverse proxy. Menyediakan site config, `nginx -t`, dan generator reverse proxy.',
    icon: <Globe className="w-5 h-5 text-[#C86D51]" />
  },
  {
    id: 'caddy',
    label: 'Caddy (native)',
    description: 'Caddy via apt-get dengan auto-HTTPS (Let\'s Encrypt). Caddyfile dikelola dari tab Web Server.',
    icon: <Globe className="w-5 h-5 text-[#82937E]" />
  },
  {
    id: 'caddy_container',
    label: 'Caddy (container)',
    description: 'Caddy di dalam Docker container pada network proxy — reverse proxy dengan nama service, tanpa mengubah compose repo.',
    icon: <Container className="w-5 h-5 text-[#82937E]" />,
    statusKey: 'caddyContainer'
  }
];

const statusCard = (def: ComponentDef, status: StackStatus | null, installing: boolean) => {
  const item = def.statusKey ? status?.[def.statusKey] : status?.[def.id];
  const installable = status?.installable ?? false;
  const isInstalled = item?.installed ?? false;

  return (
    <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 rounded-2xl bg-[#F3EFEA]">{def.icon}</div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
            isInstalled ? 'bg-[#4A5D45]/10 text-[#4A5D45] border-[#4A5D45]/25' : 'bg-[#F3EFEA] text-[#8C857E] border-[#E5E0D8]'
          }`}
        >
          <CheckCircle2 className={`w-3.5 h-3.5 ${isInstalled ? '' : 'opacity-0'}`} />
          {isInstalled ? 'Terpasang' : 'Belum'}
        </span>
      </div>
      <h3 className="text-sm font-serif font-bold text-[#4A5D45]">{def.label}</h3>
      <p className="text-xs text-[#8C857E] mt-1 flex-1">{def.description}</p>
      <div className="mt-3 text-[11px] text-[#6E6760]">
        {item?.version ? <span className="font-mono">{item.version}</span> : <span className="italic">—</span>}
        {item?.installedAt && <span className="block text-[#8C857E]">sejak {new Date(item.installedAt).toLocaleString()}</span>}
      </div>
      {!isInstalled && (
        <button
          disabled={!installable || installing}
          className={`mt-4 px-3.5 py-2 rounded-2xl text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
            installable
              ? 'text-white bg-[#4A5D45] hover:bg-[#3E4F3A] shadow-sm'
              : 'text-[#8C857E] bg-[#F3EFEA] cursor-not-allowed border border-[#E5E0D8]'
          }`}
        >
          <Download className="w-3.5 h-3.5" /> Install
        </button>
      )}
    </div>
  );
};

export const InstallerPage: React.FC = () => {
  const [status, setStatus] = useState<StackStatus | null>(null);
  const [job, setJob] = useState<InstallJob>({ status: null, components: [], log: [] });
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setStatus(await api.getStackStatus());
    } catch (err) {
      console.error('Failed to fetch stack status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchJob = useCallback(async () => {
    try {
      setJob(await api.getInstallJob());
    } catch (err) {
      console.error('Failed to fetch install job:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchStatus(), fetchJob()]);
  }, [fetchStatus, fetchJob]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (job.status !== 'RUNNING') return;
    const t = setInterval(fetchJob, 2000);
    return () => clearInterval(t);
  }, [job.status, fetchJob]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [job.log]);

  useEffect(() => {
    if (job.status === 'SUCCESS' || job.status === 'FAILED') {
      setInstalling(false);
      fetchStatus();
    }
  }, [job.status, fetchStatus]);

  const startInstall = async (component: string) => {
    if (!window.confirm(`Mulai instalasi ${component.toUpperCase()}? Aksi ini memakan waktu beberapa menit dan memerlukan koneksi internet.`)) return;
    setInstalling(true);
    try {
      const j = await api.startInstall([component]);
      setJob(j);
    } catch (err: any) {
      alert(err.message || 'Gagal memulai instalasi');
      setInstalling(false);
    }
  };

  const running = job.status === 'RUNNING';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif text-[#4A5D45] tracking-tight">Stack Installer</h2>
          <p className="text-xs text-[#8C857E] mt-0.5">One-click installer untuk Docker, nginx, dan caddy via apt-get (noninteractive)</p>
        </div>
        <button
          onClick={refreshAll}
          disabled={loading}
          className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition flex items-center gap-1.5 shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {status && !status.installable && (
        <div className="p-5 rounded-[28px] bg-white border border-[#C86D51]/30 shadow-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#C86D51] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-serif font-bold text-[#9E391C]">Installer membutuhkan akses root</h4>
            <p className="text-xs text-[#6E6760] mt-1">
              Jalankan HSDM sebagai root (atau sebagai user dengan sudo) di server Linux agar fitur instalasi aktif. Status root saat ini:{' '}
              <span className="font-semibold">{status.isRoot ? 'root' : 'bukan root'}</span>.
            </p>
          </div>
        </div>
      )}

      {/* Component cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COMPONENTS.map((def) => statusCard(def, status, installing || running))}
      </div>

      {status && (
        <div className="p-4 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#F3EFEA] text-[#4A5D45]">
            <Globe className="w-4 h-4" />
          </div>
          <p className="text-xs text-[#6E6760]">
            Mode proxy aktif:{' '}
            <span className="font-semibold text-[#4A5D45]">{status.proxyMode === 'container' ? 'container (Caddy in Docker)' : 'native (nginx / caddy via apt)'}</span>
            {status.proxyMode === 'container' && <span className="text-[#8C857E]"> — reverse proxy memakai nama service di network proxy.</span>}
          </p>
        </div>
      )}

      {/* Install job log */}
      {(job.status === 'RUNNING' || job.status === 'SUCCESS' || job.status === 'FAILED') && (
        <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-serif font-bold text-[#4A5D45] flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#82937E]" /> Install Job
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                job.status === 'SUCCESS'
                  ? 'bg-[#4A5D45]/10 text-[#4A5D45] border-[#4A5D45]/25'
                  : job.status === 'FAILED'
                    ? 'bg-[#C86D51]/10 text-[#9E391C] border-[#C86D51]/25'
                    : 'bg-[#82937E]/15 text-[#82937E] border-[#82937E]/25'
              }`}
            >
              {job.status === 'RUNNING' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {job.status === 'SUCCESS' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {job.status === 'FAILED' && <XCircle className="w-3.5 h-3.5" />}
              {job.status}
            </span>
          </div>
          {job.components.length > 0 && (
            <div className="mb-3 text-[11px] text-[#8C857E]">
              Komponen: {job.components.map((c) => c.toUpperCase()).join(', ')}
              {job.startedAt && <> · mulai {new Date(job.startedAt).toLocaleString()}</>}
              {job.finishedAt && <> · selesai {new Date(job.finishedAt).toLocaleString()}</>}
            </div>
          )}
          <div ref={logRef} className="h-72 overflow-y-auto bg-[#F3EFEA] border border-[#E5E0D8] rounded-2xl p-4 font-mono text-[11px] text-[#2C2C2C] leading-relaxed">
            {job.log.length > 0 ? (
              job.log.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-words">
                  {line}
                </div>
              ))
            ) : (
              <div className="text-[#8C857E]">Belum ada output.</div>
            )}
          </div>
        </div>
      )}

      <p className="text-[11px] text-[#8C857E]">
        Catatan: installer menjalankan daftar perintah apt-get yang sudah ditetapkan (tidak menerima perintah bebas dari user). Setiap komponen diverifikasi
        setelah instalasi dan statusnya tersimpan di pengaturan. Fitur Docker/Web Server aktif otomatis setelah komponen terpasang.
      </p>
    </div>
  );
};