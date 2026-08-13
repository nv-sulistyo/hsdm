import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { AuditLog } from '../types.js';
import { ShieldCheck, RefreshCw, Search, Clock, User, Globe, Trash2 } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [clearing, setClearing] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs(100);
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Clear ALL audit logs? This cannot be undone.')) return;
    setClearing(true);
    try {
      await api.clearAuditLogs();
      await fetchLogs();
    } catch (err: any) {
      console.error('Failed to clear audit logs:', err);
      alert(err.message || 'Failed to clear audit logs');
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.details || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif text-[#4A5D45] tracking-tight">Audit Log Stream</h2>
          <p className="text-xs text-[#8C857E] mt-0.5">Security history and administrative execution audit record</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-[#82937E] absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Filter audit logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-[#E5E0D8] text-xs text-[#2C2C2C] placeholder-[#8C857E] focus:outline-none focus:border-[#4A5D45]"
            />
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition flex items-center gap-1.5 shrink-0 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#82937E] ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>

          <button
            onClick={handleClearLogs}
            disabled={clearing || logs.length === 0}
            className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#9E391C] bg-white hover:bg-[#C86D51]/15 border border-[#E5E0D8] transition flex items-center gap-1.5 shrink-0 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
            title="Clear all audit logs"
          >
            <Trash2 className={`w-3.5 h-3.5 text-[#C86D51] ${clearing ? 'animate-spin' : ''}`} /> Clear Logs
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm">
        <div className="overflow-x-auto">
          {filtered.length > 0 ? (
            <table className="w-full text-left text-xs text-[#2C2C2C]">
              <thead className="bg-[#F3EFEA] text-[#4A5D45] text-[11px] uppercase font-semibold border-b border-[#E5E0D8]">
                <tr>
                  <th className="py-3 px-3 rounded-l-xl">Timestamp</th>
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Action</th>
                  <th className="py-3 px-3">Repository</th>
                  <th className="py-3 px-3">Details</th>
                  <th className="py-3 px-3 rounded-r-xl">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D8]">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F3EFEA]/60 transition">
                    <td className="py-3.5 px-3 text-[#8C857E] whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-[#2C2C2C]">
                      {log.username || 'system'}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-mono text-[11px] font-bold text-[#4A5D45] bg-[#82937E]/20 px-2.5 py-0.5 rounded-lg border border-[#82937E]/30">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-serif text-sm font-semibold text-[#4A5D45]">
                      {log.repository_name || (log.repository_id ? `#${log.repository_id}` : '—')}
                    </td>
                    <td className="py-3.5 px-3 text-[#6E6760] font-sans max-w-xs truncate">
                      {log.details || '—'}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-[11px] text-[#8C857E]">
                      {log.ip_address || 'local'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center text-xs text-[#8C857E]">
              No audit log entries recorded.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
