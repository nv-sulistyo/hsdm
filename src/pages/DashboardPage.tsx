import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { DashboardStats, Deployment } from '../types.js';
import { DeploymentStatusBadge } from '../components/StatusBadge.js';
import { LogViewerModal } from '../components/LogViewerModal.js';
import {
  FolderGit2,
  Zap,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Terminal,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Key
} from 'lucide-react';

interface DashboardPageProps {
  onNavigateToRepo: () => void;
  onNavigateToSsh: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateToRepo, onNavigateToSsh }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [sshStatus, setSshStatus] = useState<any>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [s, ssh] = await Promise.all([
        api.getDashboardStats(),
        api.getSshKeyStatus()
      ]);
      setStats(s);
      setSshStatus(ssh);
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif text-[#4A5D45] tracking-tight">Home Server Overview</h2>
          <p className="text-xs text-[#8C857E] mt-0.5">Git repository automation activity & system deployment health</p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#82937E] ${loading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* System Warning Banner if SSH key missing */}
      {sshStatus && (!sshStatus.privateKeyExists || !sshStatus.gitInstalled) && (
        <div className="p-4 rounded-[20px] bg-[#D4A373]/15 border border-[#D4A373]/30 text-xs text-[#7A4B1D] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-[#A36124] shrink-0" />
            <div>
              <span className="font-bold text-[#2C2C2C] block">System Configuration Notice</span>
              <p className="text-[#8C5828]">
                {!sshStatus.gitInstalled
                  ? 'Git CLI executable is not found in PATH. Check Settings.'
                  : `SSH Private Key is missing at ${sshStatus.keyPath}. Generate or upload your SSH key to enable GitHub access.`}
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToSsh}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#4A5D45] text-white hover:bg-[#3D4F38] transition shrink-0 shadow-sm"
          >
            Configure SSH / Git
          </button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-[24px] bg-white border border-[#E5E0D8] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold text-[#8C857E]">Total Repositories</span>
            <div className="text-2xl font-serif font-bold text-[#4A5D45] mt-1">
              {stats ? stats.totalRepositories : 0}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#82937E]/15 text-[#4A5D45] border border-[#82937E]/25">
            <FolderGit2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-[24px] bg-white border border-[#E5E0D8] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold text-[#8C857E]">Auto Deploy Active</span>
            <div className="text-2xl font-serif font-bold text-[#D4A373] mt-1">
              {stats ? stats.autoDeployCount : 0}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#D4A373]/20 text-[#8C5828] border border-[#D4A373]/30">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-[24px] bg-white border border-[#E5E0D8] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold text-[#8C857E]">Successful Deployments</span>
            <div className="text-2xl font-serif font-bold text-[#4A5D45] mt-1">
              {stats ? stats.successfulDeployments : 0}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#82937E]/15 text-[#3D4F38] border border-[#82937E]/25">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-[24px] bg-white border border-[#E5E0D8] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold text-[#8C857E]">Failed Deployments</span>
            <div className="text-2xl font-serif font-bold text-[#C86D51] mt-1">
              {stats ? stats.failedDeployments : 0}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#C86D51]/15 text-[#C86D51] border border-[#C86D51]/25">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Deployments Table */}
        <div className="lg:col-span-2 p-5 rounded-[24px] bg-white border border-[#E5E0D8] flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-serif text-[#4A5D45]">Recent Deployments</h3>
              <p className="text-[11px] text-[#8C857E]">Latest manual & automated deployment triggers</p>
            </div>
            <button
              onClick={onNavigateToRepo}
              className="text-xs font-semibold text-[#4A5D45] hover:text-[#82937E] flex items-center gap-1 transition"
            >
              Manage Repos <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            {stats?.recentDeployments && stats.recentDeployments.length > 0 ? (
              <table className="w-full text-left text-xs text-[#2C2C2C]">
                <thead className="bg-[#F3EFEA] text-[#6E6760] text-[11px] uppercase font-semibold border-b border-[#E5E0D8]">
                  <tr>
                    <th className="py-2.5 px-3">Repo</th>
                    <th className="py-2.5 px-3">Trigger</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3 text-right">Log</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E0D8]/60">
                  {stats.recentDeployments.map((dep) => (
                    <tr key={dep.id} className="hover:bg-[#F9F6F2] transition">
                      <td className="py-3 px-3 font-semibold text-[#2C2C2C]">
                        {dep.repository_name || `#${dep.repository_id}`}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono text-[11px] bg-[#F3EFEA] px-2 py-0.5 rounded-lg border border-[#E5E0D8] text-[#6E6760]">
                          {dep.trigger_type}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <DeploymentStatusBadge status={dep.status} />
                      </td>
                      <td className="py-3 px-3 text-[#8C857E]">
                        {new Date(dep.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setSelectedDeployment(dep)}
                          className="px-2.5 py-1 rounded-xl bg-[#F3EFEA] hover:bg-[#EAE4DC] text-[#4A5D45] transition border border-[#E5E0D8] text-[11px] inline-flex items-center gap-1 font-semibold"
                        >
                          <Terminal className="w-3 h-3 text-[#82937E]" /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-xs text-[#8C857E]">
                No deployment jobs recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Recent Audit Log Stream */}
        <div className="p-5 rounded-[24px] bg-white border border-[#E5E0D8] flex flex-col shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-serif text-[#4A5D45]">Audit Stream</h3>
            <p className="text-[11px] text-[#8C857E]">Security & administrator actions</p>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[380px] space-y-3 pr-1">
            {stats?.recentAuditLogs && stats.recentAuditLogs.length > 0 ? (
              stats.recentAuditLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] text-xs">
                  <div className="flex items-center justify-between text-[#8C857E] mb-1">
                    <span className="font-semibold text-[#4A5D45]">{log.action}</span>
                    <span className="text-[10px] text-[#8C857E]">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[#2C2C2C] text-[11px] truncate">{log.details || 'Action completed'}</p>
                  <div className="text-[10px] text-[#8C857E] mt-1 flex items-center gap-2">
                    <span>User: {log.username || 'system'}</span>
                    {log.ip_address && <span>• IP: {log.ip_address}</span>}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-[#8C857E]">
                No audit logs recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Log Viewer Modal */}
      {selectedDeployment && (
        <LogViewerModal
          deployment={selectedDeployment}
          onClose={() => setSelectedDeployment(null)}
        />
      )}
    </div>
  );
};
