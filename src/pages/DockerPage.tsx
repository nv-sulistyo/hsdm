import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';
import {
  DockerContainer,
  DockerImage,
  ComposePsEntry,
  ComposeServiceInput,
  Repository,
  ToolVersion
} from '../types.js';
import {
  Container,
  RefreshCw,
  Play,
  Square,
  RotateCw,
  Trash2,
  Terminal,
  Plus,
  Layers,
  Save,
  X,
  Rocket,
  Hammer,
  StopCircle,
  AlertTriangle,
  Package,
  CheckSquare
} from 'lucide-react';

type SubTab = 'containers' | 'compose' | 'images';

interface ModalProps {
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ title, icon, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
    <div className="relative w-full max-w-3xl max-h-[90vh] bg-white border border-[#E5E0D8] rounded-[28px] shadow-2xl flex flex-col overflow-hidden text-[#2C2C2C]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E0D8] bg-[#F3EFEA]">
        <div className="flex items-center gap-3">
          {icon && <div className="p-2 rounded-xl bg-white border border-[#E5E0D8] text-[#4A5D45]">{icon}</div>}
          <h3 className="text-base font-serif font-bold text-[#4A5D45]">{title}</h3>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-xl text-[#8C857E] hover:text-[#2C2C2C] hover:bg-[#E5E0D8]/50 transition">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  </div>
);

const statusPill = (state: string) => {
  const running = state === 'running';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
        running ? 'bg-[#4A5D45]/10 text-[#4A5D45] border-[#4A5D45]/25' : 'bg-[#C86D51]/10 text-[#9E391C] border-[#C86D51]/25'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${running ? 'bg-[#4A5D45] animate-pulse' : 'bg-[#C86D51]'}`} />
      {state}
    </span>
  );
};

export const DockerPage: React.FC = () => {
  const [subTab, setSubTab] = useState<SubTab>('containers');
  const [status, setStatus] = useState<{ docker: ToolVersion; compose: ToolVersion; installed: boolean } | null>(null);
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);

  const [logsModal, setLogsModal] = useState<{ title: string; log: string } | null>(null);
  const [pullImageName, setPullImageName] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const s = await api.getDockerStatus();
      setStatus(s);
      return s;
    } catch (err) {
      console.error('Failed to fetch docker status:', err);
      return null;
    }
  }, []);

  const fetchContainers = useCallback(async () => {
    try {
      const data = await api.getContainers(true);
      setContainers(data);
    } catch (err) {
      console.error('Failed to fetch containers:', err);
    }
  }, []);

  const fetchImages = useCallback(async () => {
    try {
      const data = await api.getDockerImages();
      setImages(data);
    } catch (err) {
      console.error('Failed to fetch images:', err);
    }
  }, []);

  const fetchRepositories = useCallback(async () => {
    try {
      const data = await api.getRepositories();
      setRepositories(data);
    } catch (err) {
      console.error('Failed to fetch repositories:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    const s = await fetchStatus();
    if (s?.installed) {
      await Promise.all([fetchContainers(), fetchImages(), fetchRepositories()]);
    }
    setLoading(false);
  }, [fetchStatus, fetchContainers, fetchImages, fetchRepositories]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!status?.installed) return;
    const t = setInterval(() => {
      fetchContainers();
    }, 10000);
    return () => clearInterval(t);
  }, [status, fetchContainers]);

  const containerAction = async (id: string, fn: () => Promise<any>) => {
    try {
      await fn();
      await fetchContainers();
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    }
  };

  const handleRemoveContainer = (c: DockerContainer) => {
    if (!window.confirm(`Remove container "${c.name}" (${c.id.slice(0, 12)})? This cannot be undone.`)) return;
    containerAction(c.id, () => api.removeContainer(c.id, false));
  };

  const showLogs = async (id: string, title: string) => {
    try {
      const { log } = await api.getContainerLogs(id, 500);
      setLogsModal({ title, log: log || '(no log output)' });
    } catch (err: any) {
      alert(err.message || 'Failed to fetch logs');
    }
  };

  const handlePull = async () => {
    const image = pullImageName.trim();
    if (!image) return;
    try {
      const result = await api.pullDockerImage(image);
      alert(result.message);
      setPullImageName('');
      await fetchImages();
    } catch (err: any) {
      alert(err.message || 'Pull failed');
    }
  };

  const handleRemoveImage = (img: DockerImage) => {
    if (!window.confirm(`Remove image ${img.repository}:${img.tag || 'latest'}?`)) return;
    api
      .removeDockerImage(img.id, false)
      .then(() => fetchImages())
      .catch((err: any) => alert(err.message || 'Remove failed'));
  };

  const notInstalled = status && !status.installed;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif text-[#4A5D45] tracking-tight">Docker Management</h2>
          <p className="text-xs text-[#8C857E] mt-0.5">
            {status?.installed
              ? `Docker ${status.docker.version || ''}${status.compose.installed ? ' · Compose ' + (status.compose.version || '') : ' · Compose tidak terpasang'}`.trim()
              : 'Kelola container, images, dan Docker Compose dari dashboard'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status?.installed && (
            <button
              onClick={refreshAll}
              disabled={loading}
              className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition flex items-center gap-1.5 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          )}
        </div>
      </div>

      {notInstalled ? (
        <div className="p-10 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#F3EFEA] flex items-center justify-center text-[#82937E] mb-4">
            <Container className="w-7 h-7" />
          </div>
          <h3 className="text-base font-serif font-bold text-[#4A5D45]">Docker belum terpasang</h3>
          <p className="text-xs text-[#8C857E] mt-1 max-w-md mx-auto">
            Install Docker Engine + Compose Plugin lewat tab "Installer" untuk mengaktifkan halaman ini. Fitur akan aktif otomatis setelah instalasi selesai.
          </p>
        </div>
      ) : (
        <>
          {/* Sub tabs */}
          <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8]">
            {(
              [
                { id: 'containers', label: 'Containers', icon: Container },
                { id: 'compose', label: 'Docker Compose', icon: Layers },
                { id: 'images', label: 'Images', icon: Package }
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const active = subTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSubTab(t.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                    active ? 'bg-white text-[#4A5D45] shadow-sm' : 'text-[#8C857E] hover:text-[#4A5D45]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              );
            })}
          </div>

          {/* Containers */}
          {subTab === 'containers' && (
            <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm">
              <div className="overflow-x-auto">
                {containers.length > 0 ? (
                  <table className="w-full text-left text-xs text-[#2C2C2C]">
                    <thead className="bg-[#F3EFEA] text-[#4A5D45] text-[11px] uppercase font-semibold border-b border-[#E5E0D8]">
                      <tr>
                        <th className="py-3 px-3 rounded-l-xl">Container</th>
                        <th className="py-3 px-3">Image</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Ports</th>
                        <th className="py-3 px-3">Created</th>
                        <th className="py-3 px-3 text-right rounded-r-xl">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E0D8]">
                      {containers.map((c) => (
                        <tr key={c.id} className="hover:bg-[#F3EFEA]/60 transition">
                          <td className="py-3.5 px-3">
                            <span className="font-serif text-sm font-semibold text-[#4A5D45]">{c.name || '(unnamed)'}</span>
                            <span className="block font-mono text-[10px] text-[#8C857E]">{c.id.slice(0, 12)}</span>
                          </td>
                          <td className="py-3.5 px-3 font-mono text-[11px] text-[#6E6760]">{c.image}</td>
                          <td className="py-3.5 px-3">{statusPill(c.state)}</td>
                          <td className="py-3.5 px-3 font-mono text-[11px] text-[#6E6760]">{c.ports || '—'}</td>
                          <td className="py-3.5 px-3 text-[#8C857E]">{c.created_at}</td>
                          <td className="py-3.5 px-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {c.state !== 'running' && (
                                <button onClick={() => containerAction(c.id, () => api.startContainer(c.id))} title="Start" className="p-1.5 rounded-lg hover:bg-[#4A5D45]/10 text-[#4A5D45] transition">
                                  <Play className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {c.state === 'running' && (
                                <>
                                  <button onClick={() => containerAction(c.id, () => api.stopContainer(c.id))} title="Stop" className="p-1.5 rounded-lg hover:bg-[#C86D51]/10 text-[#C86D51] transition">
                                    <Square className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => containerAction(c.id, () => api.restartContainer(c.id))} title="Restart" className="p-1.5 rounded-lg hover:bg-[#82937E]/15 text-[#82937E] transition">
                                    <RotateCw className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              <button onClick={() => showLogs(c.id, `Logs — ${c.name}`)} title="Logs" className="p-1.5 rounded-lg hover:bg-[#82937E]/15 text-[#82937E] transition">
                                <Terminal className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleRemoveContainer(c)} title="Remove" className="p-1.5 rounded-lg hover:bg-[#C86D51]/10 text-[#C86D51] transition">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-xs text-[#8C857E] text-center py-8">Tidak ada container. Mulai stack via tab "Docker Compose" atau buat container lewat compose file.</p>
                )}
              </div>
            </div>
          )}

          {/* Compose */}
          {subTab === 'compose' && <ComposeSection repositories={repositories} />}

          {/* Images */}
          {subTab === 'images' && (
            <div className="space-y-4">
              <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex-1 w-full">
                  <label className="text-[11px] font-semibold text-[#4A5D45] uppercase tracking-wider block mb-1">Pull image</label>
                  <input
                    type="text"
                    value={pullImageName}
                    onChange={(e) => setPullImageName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePull()}
                    placeholder="contoh: nginx:alpine, postgres:16"
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#E5E0D8] text-xs text-[#2C2C2C] placeholder-[#8C857E] focus:outline-none focus:border-[#4A5D45]"
                  />
                </div>
                <button onClick={handlePull} className="px-4 py-2.5 rounded-2xl text-xs font-semibold text-white bg-[#4A5D45] hover:bg-[#3E4F3A] transition flex items-center gap-1.5 shadow-sm mt-4 sm:mt-6 shrink-0">
                  <Rocket className="w-3.5 h-3.5" /> Pull
                </button>
              </div>

              <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm">
                <div className="overflow-x-auto">
                  {images.length > 0 ? (
                    <table className="w-full text-left text-xs text-[#2C2C2C]">
                      <thead className="bg-[#F3EFEA] text-[#4A5D45] text-[11px] uppercase font-semibold border-b border-[#E5E0D8]">
                        <tr>
                          <th className="py-3 px-3 rounded-l-xl">Repository</th>
                          <th className="py-3 px-3">Tag</th>
                          <th className="py-3 px-3">Image ID</th>
                          <th className="py-3 px-3">Size</th>
                          <th className="py-3 px-3">Created</th>
                          <th className="py-3 px-3 text-right rounded-r-xl">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E0D8]">
                        {images.map((img) => (
                          <tr key={img.id} className="hover:bg-[#F3EFEA]/60 transition">
                            <td className="py-3.5 px-3 font-mono text-[11px] font-semibold text-[#4A5D45]">{img.repository || '(none)'}</td>
                            <td className="py-3.5 px-3">
                              <span className="font-mono text-[11px] bg-[#F3EFEA] px-2 py-0.5 rounded border border-[#E5E0D8] text-[#6E6760]">{img.tag || 'latest'}</span>
                            </td>
                            <td className="py-3.5 px-3 font-mono text-[11px] text-[#8C857E]">{img.id.slice(0, 12)}</td>
                            <td className="py-3.5 px-3">{img.size}</td>
                            <td className="py-3.5 px-3 text-[#8C857E]">{img.created_at}</td>
                            <td className="py-3.5 px-3 text-right">
                              <button onClick={() => handleRemoveImage(img)} title="Remove image" className="p-1.5 rounded-lg hover:bg-[#C86D51]/10 text-[#C86D51] transition">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-[#8C857E] text-center py-8">Tidak ada image lokal.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {logsModal && (
        <Modal title={logsModal.title} icon={<Terminal className="w-5 h-5 text-[#82937E]" />} onClose={() => setLogsModal(null)}>
          <pre className="whitespace-pre-wrap break-words font-mono text-xs text-[#2C2C2C] bg-[#F3EFEA] p-4 rounded-2xl border border-[#E5E0D8] leading-relaxed max-h-[60vh] overflow-y-auto">
            {logsModal.log}
          </pre>
        </Modal>
      )}
    </div>
  );
};

// ---------- Compose Section ----------

const ComposeSection: React.FC<{ repositories: Repository[] }> = ({ repositories }) => {
  const [selectedId, setSelectedId] = useState<number | ''>('');
  const [composeFile, setComposeFile] = useState('docker-compose.yml');
  const [psEntries, setPsEntries] = useState<ComposePsEntry[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [proxiedServices, setProxiedServices] = useState<string[]>([]);
  const [overrideMsg, setOverrideMsg] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ title: string; output: string } | null>(null);

  const loadCompose = useCallback(
    async (repoId: number, file: string) => {
      setBusy(true);
      try {
        const [ps, svc, ovr] = await Promise.all([
          api.composePs(repoId, file),
          api.getComposeServices(repoId, file),
          api.getComposeOverride(repoId, file).catch(() => ({ proxiedServices: [] as string[] }))
        ]);
        setPsEntries(ps);
        setServices(svc);
        setProxiedServices(ovr.proxiedServices || []);
      } catch (err) {
        console.error('Failed to load compose:', err);
        setPsEntries([]);
        setServices([]);
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const toggleProxy = async (service: string) => {
    if (selectedId === '') return;
    setBusy(true);
    setOverrideMsg(null);
    const next = proxiedServices.includes(service)
      ? proxiedServices.filter((s) => s !== service)
      : [...proxiedServices, service];
    try {
      const res = await api.writeComposeOverride(selectedId, composeFile, next);
      setProxiedServices(next);
      setOverrideMsg(res.message);
    } catch (err: any) {
      alert(err.message || 'Failed to update proxy attachment');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (selectedId !== '') {
      loadCompose(selectedId, composeFile);
    }
  }, [selectedId, composeFile, loadCompose]);

  const run = async (fn: () => Promise<{ message: string; output?: string }>) => {
    if (selectedId === '') return;
    setBusy(true);
    try {
      const res = await fn();
      setResult({ title: res.message, output: res.output || '' });
      await loadCompose(selectedId, composeFile);
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    } finally {
      setBusy(false);
    }
  };

  const openEditor = async () => {
    if (selectedId === '') return;
    try {
      const { content } = await api.getComposeContent(selectedId, composeFile);
      setEditorContent(content || '');
      setEditorOpen(true);
    } catch (err: any) {
      alert(err.message || 'Failed to read compose file');
    }
  };

  const saveEditor = async () => {
    if (selectedId === '') return;
    setBusy(true);
    try {
      await api.saveComposeContent(selectedId, composeFile, editorContent);
      setEditorOpen(false);
      await loadCompose(selectedId, composeFile);
    } catch (err: any) {
      alert(err.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Repo selector + actions */}
      <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-[11px] font-semibold text-[#4A5D45] uppercase tracking-wider block mb-1">Repository</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#E5E0D8] text-xs text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
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
            <label className="text-[11px] font-semibold text-[#4A5D45] uppercase tracking-wider block mb-1">Compose file</label>
            <select
              value={composeFile}
              onChange={(e) => setComposeFile(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#E5E0D8] text-xs text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
            >
              <option value="docker-compose.yml">docker-compose.yml</option>
              <option value="docker-compose.yaml">docker-compose.yaml</option>
              <option value="compose.yml">compose.yml</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <button
              onClick={() => run(() => api.composeUp(selectedId as number, composeFile, true))}
              disabled={selectedId === '' || busy}
              className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-white bg-[#4A5D45] hover:bg-[#3E4F3A] transition flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Rocket className="w-3.5 h-3.5" /> Up —build
            </button>
            <button
              onClick={() => run(() => api.composeBuild(selectedId as number, composeFile))}
              disabled={selectedId === '' || busy}
              className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition flex items-center gap-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Hammer className="w-3.5 h-3.5" /> Build
            </button>
            <button
              onClick={() => run(() => api.composeDown(selectedId as number, composeFile))}
              disabled={selectedId === '' || busy}
              className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#9E391C] bg-white hover:bg-[#C86D51]/15 border border-[#E5E0D8] transition flex items-center gap-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <StopCircle className="w-3.5 h-3.5" /> Down
            </button>
            <button
              onClick={openEditor}
              disabled={selectedId === ''}
              className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition flex items-center gap-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" /> Edit File
            </button>
            <button
              onClick={() => setWizardOpen(true)}
              disabled={selectedId === ''}
              className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition flex items-center gap-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" /> Add Service
            </button>
          </div>
        </div>

        {selectedId !== '' && (
          <>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-[#8C857E]">
              <Layers className="w-3.5 h-3.5" />
              <span>Services di {composeFile}:</span>
              {services.length > 0 ? (
                services.map((s) => (
                  <span key={s} className="font-mono text-[11px] bg-[#F3EFEA] px-2 py-0.5 rounded border border-[#E5E0D8] text-[#4A5D45] font-semibold">
                    {s}
                  </span>
                ))
              ) : (
                <span className="italic">belum ada — tambah lewat "Add Service" atau "Edit File"</span>
              )}
            </div>

            {services.length > 0 && (
              <div className="mt-4 p-4 rounded-2xl bg-[#F3EFEA]/70 border border-[#E5E0D8]">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <h4 className="text-xs font-semibold text-[#4A5D45]">Proxy Network</h4>
                    <p className="text-[11px] text-[#8C857E] mt-0.5">
                      Centang service yang boleh diakses dari internet (Caddy/nginx akan rout ke service ini). Database tidak perlu di-centang — otomatis terisolasi.
                    </p>
                  </div>
                  {overrideMsg && <span className="text-[11px] text-[#3D4F38] font-semibold shrink-0">{overrideMsg}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {services.map((s) => {
                    const checked = proxiedServices.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() => toggleProxy(s)}
                        disabled={busy}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition disabled:opacity-50 ${
                          checked
                            ? 'bg-[#4A5D45] text-white border-[#4A5D45]'
                            : 'bg-white text-[#6E6760] border-[#E5E0D8] hover:bg-[#EAE4DC]'
                        }`}
                      >
                        <CheckSquare className={`w-3.5 h-3.5 ${checked ? 'text-white' : 'text-[#8C857E]'}`} />
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-4 overflow-x-auto">
              {psEntries.length > 0 ? (
                <table className="w-full text-left text-xs text-[#2C2C2C]">
                  <thead className="bg-[#F3EFEA] text-[#4A5D45] text-[11px] uppercase font-semibold border-b border-[#E5E0D8]">
                    <tr>
                      <th className="py-3 px-3 rounded-l-xl">Name</th>
                      <th className="py-3 px-3">Service</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 rounded-r-xl">Ports</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E0D8]">
                    {psEntries.map((p) => (
                      <tr key={p.name + p.service} className="hover:bg-[#F3EFEA]/60 transition">
                        <td className="py-3 px-3 font-mono text-[11px] font-semibold text-[#4A5D45]">{p.name}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-[#6E6760]">{p.service}</td>
                        <td className="py-3 px-3 text-[#6E6760]">{p.status}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-[#8C857E]">{p.ports || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-[#8C857E] text-center py-6">
                  {busy ? 'Memuat...' : 'Stack belum berjalan untuk repo ini.'}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {editorOpen && (
        <Modal title={`Edit ${composeFile}`} icon={<Save className="w-5 h-5 text-[#82937E]" />} onClose={() => setEditorOpen(false)}>
          <p className="text-[11px] text-[#8C857E] mb-3">
            Perubahan divalidasi dengan <code className="font-mono">docker compose config -q</code> sebelum disimpan. File dikembalikan otomatis jika invalid.
          </p>
          <textarea
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
            spellCheck={false}
            className="w-full h-[50vh] font-mono text-xs bg-[#F3EFEA] border border-[#E5E0D8] rounded-2xl p-4 text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45] leading-relaxed"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setEditorOpen(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6E6760] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition">
              Batal
            </button>
            <button onClick={saveEditor} disabled={busy} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#4A5D45] hover:bg-[#3E4F3A] transition flex items-center gap-1.5 disabled:opacity-40">
              <Save className="w-3.5 h-3.5" /> Simpan & Validasi
            </button>
          </div>
        </Modal>
      )}

      {wizardOpen && selectedId !== '' && (
        <AddServiceWizard
          repositoryId={selectedId}
          file={composeFile}
          onClose={() => setWizardOpen(false)}
          onSaved={() => loadCompose(selectedId, composeFile)}
        />
      )}

      {result && (
        <Modal title={result.title} icon={<Terminal className="w-5 h-5 text-[#82937E]" />} onClose={() => setResult(null)}>
          <pre className="whitespace-pre-wrap break-words font-mono text-xs text-[#2C2C2C] bg-[#F3EFEA] p-4 rounded-2xl border border-[#E5E0D8] leading-relaxed max-h-[60vh] overflow-y-auto">
            {result.output || '(tidak ada output)'}
          </pre>
        </Modal>
      )}
    </div>
  );
};

// ---------- Add Service Wizard ----------

const RESTART_POLICIES = ['', 'no', 'always', 'unless-stopped', 'on-failure'];

const AddServiceWizard: React.FC<{
  repositoryId: number;
  file: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ repositoryId, file, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [containerName, setContainerName] = useState('');
  const [command, setCommand] = useState('');
  const [restart, setRestart] = useState('');
  const [network, setNetwork] = useState('');
  const [portsText, setPortsText] = useState('');
  const [exposeText, setExposeText] = useState('');
  const [volumesText, setVolumesText] = useState('');
  const [envText, setEnvText] = useState('');
  const [dependsOnText, setDependsOnText] = useState('');
  const [busy, setBusy] = useState(false);

  const parseLines = (text: string): string[] => text.split('\n').map((l) => l.trim()).filter(Boolean);

  const submit = async () => {
    setBusy(true);
    const input: ComposeServiceInput = {
      name,
      image,
      container_name: containerName || undefined,
      command: command || undefined,
      restart: restart || undefined,
      network: network || undefined,
      networks: network
        ? network.split(',').map((n) => n.trim()).filter(Boolean)
        : undefined,
      ports: parseLines(portsText),
      expose: parseLines(exposeText),
      volumes: parseLines(volumesText),
      environment: parseLines(envText),
      depends_on: parseLines(dependsOnText)
    };
    try {
      await api.addComposeService(repositoryId, file, input);
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Gagal menambah service');
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full px-3.5 py-2 rounded-xl bg-white border border-[#E5E0D8] text-xs text-[#2C2C2C] placeholder-[#8C857E] focus:outline-none focus:border-[#4A5D45]';
  const labelCls = 'text-[11px] font-semibold text-[#4A5D45] uppercase tracking-wider block mb-1';

  return (
    <Modal title={`Add Service — ${file}`} icon={<Plus className="w-5 h-5 text-[#82937E]" />} onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Service name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="contoh: web, db" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Image *</label>
          <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="nginx:alpine" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Container name</label>
          <input value={containerName} onChange={(e) => setContainerName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Restart policy</label>
          <select value={restart} onChange={(e) => setRestart(e.target.value)} className={inputCls}>
            {RESTART_POLICIES.map((r) => (
              <option key={r} value={r}>
                {r === '' ? '(default)' : r}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Command</label>
          <input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npm run start" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Network</label>
          <input value={network} onChange={(e) => setNetwork(e.target.value)} placeholder="default, proxy" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Depends on (comma)</label>
          <input value={dependsOnText} onChange={(e) => setDependsOnText(e.target.value)} placeholder="db, redis" className={inputCls} />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Ports publik (host:container, satu per baris)</label>
          <textarea value={portsText} onChange={(e) => setPortsText(e.target.value)} rows={2} placeholder={'8080:80\n5432:5432'} className={inputCls} />
          <span className="text-[11px] text-[#8C857E] mt-1 block">Terekspos ke host — hanya untuk service yang memang harus publik (mis. database jangan di sini).</span>
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Expose internal (satu per baris)</label>
          <textarea value={exposeText} onChange={(e) => setExposeText(e.target.value)} rows={2} placeholder={'3000\n80'} className={inputCls} />
          <span className="text-[11px] text-[#8C857E] mt-1 block">Internal-only (tidak bisa diakses dari luar) — Caddy/nginx di network yang sama tetap bisa menjangkaunya via nama service.</span>
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Volumes (satu per baris)</label>
          <textarea value={volumesText} onChange={(e) => setVolumesText(e.target.value)} rows={2} placeholder={'./data:/var/lib/postgresql/data'} className={inputCls} />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Environment (KEY=value, satu per baris)</label>
          <textarea value={envText} onChange={(e) => setEnvText(e.target.value)} rows={2} placeholder={'POSTGRES_PASSWORD=secret'} className={inputCls} />
        </div>
      </div>
      <div className="flex items-center gap-2 mt-5 bg-[#F3EFEA] border border-[#E5E0D8] rounded-2xl p-3 text-[11px] text-[#8C857E]">
        <AlertTriangle className="w-4 h-4 text-[#82937E] shrink-0" />
        Service divalidasi dengan <code className="font-mono">docker compose config -q</code> setelah ditambahkan.
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6E6760] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition">
          Batal
        </button>
        <button onClick={submit} disabled={busy || !name.trim() || !image.trim()} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#4A5D45] hover:bg-[#3E4F3A] transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
          <Plus className="w-3.5 h-3.5" /> Tambah Service
        </button>
      </div>
    </Modal>
  );
};