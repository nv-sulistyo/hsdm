import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api.js';
import { SystemMetrics, ContainerStat, ToolStatus } from '../types.js';
import { Activity, Cpu, MemoryStick, HardDrive, Gauge, Server, RefreshCw, Container, Timer } from 'lucide-react';

const MAX_SAMPLES = 40;

interface SparklineProps {
  values: number[];
  color?: string;
  height?: number;
}

const Sparkline: React.FC<SparklineProps> = ({ values, color = '#4A5D45', height = 40 }) => {
  const width = 120;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  if (values.length < 2) {
    return <div className="h-full flex items-center text-[10px] text-[#C6BEB4]">menunggu data…</div>;
  }
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const formatBytes = (b: number) => {
  if (!Number.isFinite(b) || b <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
};

const formatUptime = (s: number) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
};

const toolChip = (label: string, installed: boolean) => (
  <span
    key={label}
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
      installed ? 'bg-[#4A5D45]/10 text-[#4A5D45] border-[#4A5D45]/25' : 'bg-[#F3EFEA] text-[#8C857E] border-[#E5E0D8]'
    }`}
  >
    <span className={`w-1.5 h-1.5 rounded-full ${installed ? 'bg-[#4A5D45]' : 'bg-[#C6BEB4]'}`} />
    {label}
  </span>
);

export const MonitoringPage: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [stats, setStats] = useState<ContainerStat[]>([]);
  const [tools, setTools] = useState<ToolStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const cpuHistory = useRef<number[]>([]);
  const memHistory = useRef<number[]>([]);
  const [, forceRender] = useState(0);

  const fetchAll = useCallback(async () => {
    try {
      const [m, c, t] = await Promise.all([api.getSystemMetrics(), api.getContainerStats(), api.getToolStatus()]);
      setMetrics(m);
      setStats(c);
      setTools(t);
      cpuHistory.current = [...cpuHistory.current.slice(-(MAX_SAMPLES - 1)), m.cpuUsage];
      memHistory.current = [...memHistory.current.slice(-(MAX_SAMPLES - 1)), m.memory.percent];
      forceRender((x) => x + 1);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 5000);
    return () => clearInterval(t);
  }, [fetchAll]);

  const cpu = metrics?.cpuUsage ?? 0;
  const mem = metrics?.memory;
  const memPercent = mem?.percent ?? 0;

  const metricCard = (title: string, value: string, sub: string, icon: React.ReactNode, color: string) => (
    <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-[#8C857E] uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-serif font-bold text-[#2C2C2C] mt-1">{value}</p>
          <p className="text-[11px] text-[#8C857E] mt-1">{sub}</p>
        </div>
        <div className={`p-2.5 rounded-2xl ${color}`}>{icon}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif text-[#4A5D45] tracking-tight">Server Monitoring</h2>
          <p className="text-xs text-[#8C857E] mt-0.5">
            {metrics
              ? `${metrics.hostname} · ${metrics.distro || metrics.platform} ${metrics.release} · ${metrics.arch}`
              : 'Memantau CPU, RAM, disk, dan container secara real-time (auto-refresh 5 detik)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tools && (
            <div className="flex flex-wrap items-center gap-1.5">
              {toolChip('Docker', tools.docker.installed)}
              {toolChip('nginx', tools.nginx.installed)}
              {toolChip('Caddy', tools.caddy.installed)}
              {toolChip('systemd', tools.systemd.installed)}
            </div>
          )}
          <button
            onClick={fetchAll}
            disabled={loading}
            className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition flex items-center gap-1.5 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {!metrics ? (
        <div className="p-10 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm text-center text-xs text-[#8C857E]">
          {loading ? 'Memuat metrik…' : 'Tidak dapat mengambil metrik server.'}
        </div>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metricCard(
              'CPU Usage',
              `${cpu.toFixed(1)}%`,
              `${metrics.cpuCount} core · load ${metrics.loadAvg.map((l) => l.toFixed(2)).join(' / ')}`,
              <Cpu className="w-5 h-5 text-[#4A5D45]" />,
              'bg-[#4A5D45]/10'
            )}
            {metricCard(
              'Memory',
              `${memPercent.toFixed(1)}%`,
              `${formatBytes(mem?.used ?? 0)} / ${formatBytes(mem?.total ?? 0)}`,
              <MemoryStick className="w-5 h-5 text-[#82937E]" />,
              'bg-[#82937E]/15'
            )}
            {metricCard(
              'Disk',
              metrics.disks.length > 0 ? `${metrics.disks[0].percent}%` : '—',
              metrics.disks.length > 0 ? `${formatBytes(metrics.disks[0].used)} / ${formatBytes(metrics.disks[0].size)} (${metrics.disks[0].mount})` : 'tidak tersedia',
              <HardDrive className="w-5 h-5 text-[#C86D51]" />,
              'bg-[#C86D51]/10'
            )}
            {metricCard(
              'Uptime',
              formatUptime(metrics.uptime),
              metrics.platform,
              <Timer className="w-5 h-5 text-[#D4A373]" />,
              'bg-[#D4A373]/15'
            )}
          </div>

          {/* Sparkline cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-[#8C857E] uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> CPU Trend (5s sample)
                </span>
                <span className="text-sm font-serif font-bold text-[#4A5D45]">{cpu.toFixed(1)}%</span>
              </div>
              <Sparkline values={cpuHistory.current} />
            </div>
            <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-[#8C857E] uppercase tracking-wider flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5" /> Memory Trend
                </span>
                <span className="text-sm font-serif font-bold text-[#4A5D45]">{memPercent.toFixed(1)}%</span>
              </div>
              <Sparkline values={memHistory.current} color="#82937E" />
            </div>
          </div>

          {/* Container stats */}
          <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-serif font-bold text-[#4A5D45] flex items-center gap-2">
                <Container className="w-4 h-4 text-[#82937E]" /> Container Stats (docker stats --no-stream)
              </h3>
            </div>
            {stats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#2C2C2C]">
                  <thead className="bg-[#F3EFEA] text-[#4A5D45] text-[11px] uppercase font-semibold border-b border-[#E5E0D8]">
                    <tr>
                      <th className="py-3 px-3 rounded-l-xl">Container</th>
                      <th className="py-3 px-3">CPU</th>
                      <th className="py-3 px-3">Memory</th>
                      <th className="py-3 px-3">Mem %</th>
                      <th className="py-3 px-3">Net I/O</th>
                      <th className="py-3 px-3 rounded-r-xl">PIDs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E0D8]">
                    {stats.map((c) => (
                      <tr key={c.container} className="hover:bg-[#F3EFEA]/60 transition">
                        <td className="py-3 px-3 font-serif text-sm font-semibold text-[#4A5D45]">
                          {c.name.replace(/^\//, '')}
                          <span className="block font-mono text-[10px] text-[#8C857E]">{c.container.slice(0, 12)}</span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px]">{c.cpu_percent}</td>
                        <td className="py-3 px-3 font-mono text-[11px]">{c.mem_usage}</td>
                        <td className="py-3 px-3 font-mono text-[11px]">{c.mem_percent}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-[#6E6760]">{c.net_io}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-[#8C857E]">{c.pids}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-[#8C857E] text-center py-6">
                {tools?.docker.installed ? 'Tidak ada container yang berjalan.' : 'Docker tidak terpasang.'}
              </p>
            )}
          </div>

          {/* Disk table */}
          {metrics.disks.length > 0 && (
            <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm">
              <h3 className="text-sm font-serif font-bold text-[#4A5D45] mb-3 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-[#82937E]" /> Partisi / Mount
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#2C2C2C]">
                  <thead className="bg-[#F3EFEA] text-[#4A5D45] text-[11px] uppercase font-semibold border-b border-[#E5E0D8]">
                    <tr>
                      <th className="py-3 px-3 rounded-l-xl">Mount</th>
                      <th className="py-3 px-3">Filesystem</th>
                      <th className="py-3 px-3">Size</th>
                      <th className="py-3 px-3">Used</th>
                      <th className="py-3 px-3">Available</th>
                      <th className="py-3 px-3 rounded-r-xl">Usage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E0D8]">
                    {metrics.disks.map((d, i) => (
                      <tr key={d.mount + i} className="hover:bg-[#F3EFEA]/60 transition">
                        <td className="py-3 px-3 font-mono text-[11px] font-semibold text-[#4A5D45]">{d.mount}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-[#6E6760]">{d.filesystem}</td>
                        <td className="py-3 px-3 font-mono text-[11px]">{formatBytes(d.size)}</td>
                        <td className="py-3 px-3 font-mono text-[11px]">{formatBytes(d.used)}</td>
                        <td className="py-3 px-3 font-mono text-[11px]">{formatBytes(d.available)}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 rounded-full bg-[#E5E0D8] overflow-hidden">
                              <div
                                className={`h-full rounded-full ${d.percent > 90 ? 'bg-[#C86D51]' : 'bg-[#4A5D45]'}`}
                                style={{ width: `${Math.min(d.percent, 100)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] text-[#6E6760]">{d.percent}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};