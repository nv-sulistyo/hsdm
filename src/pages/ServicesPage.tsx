import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';
import { SystemdService } from '../types.js';
import { Server, RefreshCw, Search, Play, Square, RotateCw, Lock, Unlock, Terminal, X, Activity } from 'lucide-react';

interface StatusModalProps {
  title: string;
  content: string;
  onClose: () => void;
}

const StatusModal: React.FC<StatusModalProps> = ({ title, content, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
    <div className="relative w-full max-w-3xl max-h-[90vh] bg-white border border-[#E5E0D8] rounded-[28px] shadow-2xl flex flex-col overflow-hidden text-[#2C2C2C]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E0D8] bg-[#F3EFEA]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white border border-[#E5E0D8] text-[#4A5D45]">
            <Terminal className="w-5 h-5 text-[#82937E]" />
          </div>
          <h3 className="text-base font-serif font-bold text-[#4A5D45]">{title}</h3>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-xl text-[#8C857E] hover:text-[#2C2C2C] hover:bg-[#E5E0D8]/50 transition">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <pre className="whitespace-pre-wrap break-words font-mono text-xs text-[#2C2C2C] bg-[#F3EFEA] p-4 rounded-2xl border border-[#E5E0D8] leading-relaxed max-h-[60vh] overflow-y-auto">
          {content || '(tidak ada output)'}
        </pre>
      </div>
    </div>
  </div>
);

const subPill = (sub: string) => {
  const active = sub === 'running';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
        active ? 'bg-[#4A5D45]/10 text-[#4A5D45] border-[#4A5D45]/25' : 'bg-[#F3EFEA] text-[#8C857E] border-[#E5E0D8]'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-[#4A5D45] animate-pulse' : 'bg-[#C6BEB4]'}`} />
      {sub}
    </span>
  );
};

export const ServicesPage: React.FC = () => {
  const [services, setServices] = useState<SystemdService[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [statusModal, setStatusModal] = useState<{ title: string; content: string } | null>(null);

  const fetchServices = useCallback(async () => {
    try {
      const data = await api.getSystemdServices(filter);
      setServices(data);
      setAvailable(true);
    } catch (err) {
      console.error('Failed to fetch services:', err);
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    const t = setInterval(fetchServices, 10000);
    return () => clearInterval(t);
  }, [fetchServices]);

  const action = async (unit: string, fn: () => Promise<any>) => {
    try {
      await fn();
      await fetchServices();
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    }
  };

  const showStatus = async (unit: string) => {
    try {
      const { output } = await api.getSystemdServiceStatus(unit);
      setStatusModal({ title: `systemctl status ${unit}`, content: output });
    } catch (err: any) {
      alert(err.message || 'Failed to get status');
    }
  };

  const showLogs = async (unit: string) => {
    try {
      const { log } = await api.getSystemdServiceLogs(unit, 500);
      setStatusModal({ title: `journalctl -u ${unit}`, content: log || '(tidak ada log)' });
    } catch (err: any) {
      alert(err.message || 'Failed to get logs');
    }
  };

  if (available === false) {
    return (
      <div className="p-10 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#F3EFEA] flex items-center justify-center text-[#82937E] mb-4">
          <Server className="w-7 h-7" />
        </div>
        <h3 className="text-base font-serif font-bold text-[#4A5D45]">systemd tidak tersedia</h3>
        <p className="text-xs text-[#8C857E] mt-1 max-w-md mx-auto">
          Halaman ini aktif pada Linux dengan systemd (server VPS Ubuntu/Debian). Di lingkungan ini, systemctl tidak ditemukan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif text-[#4A5D45] tracking-tight">System Services</h2>
          <p className="text-xs text-[#8C857E] mt-0.5">Kelola service systemd: start, stop, restart, enable, dan lihat log (journalctl)</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-[#82937E] absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Filter service..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-[#E5E0D8] text-xs text-[#2C2C2C] placeholder-[#8C857E] focus:outline-none focus:border-[#4A5D45]"
            />
          </div>
          <button
            onClick={fetchServices}
            disabled={loading}
            className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition flex items-center gap-1.5 shrink-0 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Services table */}
      <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm">
        <div className="overflow-x-auto">
          {services.length > 0 ? (
            <table className="w-full text-left text-xs text-[#2C2C2C]">
              <thead className="bg-[#F3EFEA] text-[#4A5D45] text-[11px] uppercase font-semibold border-b border-[#E5E0D8]">
                <tr>
                  <th className="py-3 px-3 rounded-l-xl">Unit</th>
                  <th className="py-3 px-3">State</th>
                  <th className="py-3 px-3">Sub</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3 text-right rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D8]">
                {services.map((s) => (
                  <tr key={s.unit} className="hover:bg-[#F3EFEA]/60 transition">
                    <td className="py-3 px-3 font-mono text-[11px] font-semibold text-[#4A5D45]">{s.unit}</td>
                    <td className="py-3 px-3">{s.active}</td>
                    <td className="py-3 px-3">{subPill(s.sub)}</td>
                    <td className="py-3 px-3 text-[#6E6760]">{s.description || '—'}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => showStatus(s.unit)} title="Status" className="p-1.5 rounded-lg hover:bg-[#82937E]/15 text-[#82937E] transition">
                          <Activity className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => showLogs(s.unit)} title="Logs" className="p-1.5 rounded-lg hover:bg-[#82937E]/15 text-[#82937E] transition">
                          <Terminal className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => action(s.unit, () => api.systemdAction(s.unit, 'start'))} title="Start" className="p-1.5 rounded-lg hover:bg-[#4A5D45]/10 text-[#4A5D45] transition">
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => action(s.unit, () => api.systemdAction(s.unit, 'stop'))} title="Stop" className="p-1.5 rounded-lg hover:bg-[#C86D51]/10 text-[#C86D51] transition">
                          <Square className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => action(s.unit, () => api.systemdAction(s.unit, 'restart'))} title="Restart" className="p-1.5 rounded-lg hover:bg-[#82937E]/15 text-[#82937E] transition">
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => action(s.unit, () => api.systemdAction(s.unit, 'enable'))} title="Enable" className="p-1.5 rounded-lg hover:bg-[#4A5D45]/10 text-[#4A5D45] transition">
                          <Lock className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => action(s.unit, () => api.systemdAction(s.unit, 'disable'))} title="Disable" className="p-1.5 rounded-lg hover:bg-[#C86D51]/10 text-[#C86D51] transition">
                          <Unlock className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-[#8C857E] text-center py-8">{loading ? 'Memuat…' : 'Tidak ada service yang cocok dengan filter.'}</p>
          )}
        </div>
      </div>

      {statusModal && (
        <StatusModal title={statusModal.title} content={statusModal.content} onClose={() => setStatusModal(null)} />
      )}
    </div>
  );
};