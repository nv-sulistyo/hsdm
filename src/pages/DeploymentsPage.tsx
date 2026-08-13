import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { Deployment } from '../types.js';
import { DeploymentStatusBadge } from '../components/StatusBadge.js';
import { LogViewerModal } from '../components/LogViewerModal.js';
import { History, RefreshCw, Terminal, Search, Clock, Calendar } from 'lucide-react';

export const DeploymentsPage: React.FC = () => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);

  const fetchDeployments = async () => {
    setLoading(true);
    try {
      const data = await api.getDeployments(undefined, 100);
      setDeployments(data);
    } catch (err) {
      console.error('Failed to fetch deployments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeployments();
  }, []);

  const filtered = deployments.filter(
    (d) =>
      (d.repository_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.trigger_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif italic text-[#4A5D45] tracking-tight">Deployment Logs</h2>
          <p className="text-xs text-[#8C857E] mt-0.5">Complete execution record of all manual & automated pull deployments</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-[#82937E] absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Search deployment logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-[#E5E0D8] text-xs text-[#2C2C2C] placeholder-[#8C857E] focus:outline-none focus:border-[#4A5D45]"
            />
          </div>

          <button
            onClick={fetchDeployments}
            disabled={loading}
            className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition flex items-center gap-1.5 shrink-0 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#82937E] ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Deployments Table */}
      <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm">
        <div className="overflow-x-auto">
          {filtered.length > 0 ? (
            <table className="w-full text-left text-xs text-[#2C2C2C]">
              <thead className="bg-[#F3EFEA] text-[#4A5D45] text-[11px] uppercase font-semibold border-b border-[#E5E0D8]">
                <tr>
                  <th className="py-3 px-3 rounded-l-xl">Job ID</th>
                  <th className="py-3 px-3">Repository</th>
                  <th className="py-3 px-3">Trigger</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Commit Diff</th>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3 text-right rounded-r-xl">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D8]">
                {filtered.map((dep) => (
                  <tr key={dep.id} className="hover:bg-[#F3EFEA]/60 transition">
                    <td className="py-3.5 px-3 font-mono font-bold text-[#8C857E]">#{dep.id}</td>
                    <td className="py-3.5 px-3 font-serif italic text-sm font-semibold text-[#4A5D45]">
                      {dep.repository_name || `Repo #${dep.repository_id}`}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-mono text-[11px] bg-[#F3EFEA] px-2.5 py-1 rounded-lg border border-[#E5E0D8] text-[#6E6760] font-semibold">
                        {dep.trigger_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <DeploymentStatusBadge status={dep.status} />
                    </td>
                    <td className="py-3.5 px-3 font-mono text-[11px] text-[#6E6760]">
                      {dep.commit_before ? dep.commit_before.slice(0, 7) : '—'} →{' '}
                      {dep.commit_after ? dep.commit_after.slice(0, 7) : '—'}
                    </td>
                    <td className="py-3.5 px-3 text-[#8C857E]">
                      {new Date(dep.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => setSelectedDeployment(dep)}
                        className="px-3 py-1.5 rounded-xl bg-[#F3EFEA] hover:bg-[#EAE4DC] text-[#4A5D45] transition border border-[#E5E0D8] text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs"
                      >
                        <Terminal className="w-3.5 h-3.5 text-[#82937E]" /> View Log
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center text-xs text-[#8C857E]">
              No deployment jobs found.
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {selectedDeployment && (
        <LogViewerModal deployment={selectedDeployment} onClose={() => setSelectedDeployment(null)} />
      )}
    </div>
  );
};
