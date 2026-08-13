import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { WebhookEvent, Repository } from '../types.js';
import { Webhook, RefreshCw, Copy, Check, ShieldCheck, AlertCircle, ExternalLink, Code } from 'lucide-react';

export const WebhooksPage: React.FC = () => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [webhookHistory, setWebhookHistory] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [reposError, setReposError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [reposRes, historyRes] = await Promise.allSettled([
      api.getRepositories(),
      api.getWebhookHistory(50)
    ]);

    if (reposRes.status === 'fulfilled') {
      setRepositories(reposRes.value);
      setReposError('');
    } else {
      console.error('Failed to fetch repositories:', reposRes.reason);
      setRepositories([]);
      setReposError('Failed to load repositories. Please try again.');
    }

    if (historyRes.status === 'fulfilled') {
      setWebhookHistory(historyRes.value);
      setHistoryError('');
    } else {
      console.error('Failed to fetch webhook history:', historyRes.reason);
      setWebhookHistory([]);
      setHistoryError('Failed to load webhook events. Please try again.');
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getWebhookUrl = (repoId: number) => {
    const origin = window.location.origin;
    return `${origin}/webhooks/github/${repoId}`;
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif text-[#4A5D45] tracking-tight">GitHub Webhook Manager</h2>
          <p className="text-xs text-[#8C857E] mt-0.5">HMAC SHA-256 verified automated push triggers for server deployments</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition flex items-center gap-1.5 shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#82937E] ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Webhook URLs per Repository */}
      <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-4">
        <h3 className="text-sm font-serif font-bold text-[#4A5D45]">Repository Webhook Endpoints</h3>

        <div className="space-y-3">
          {reposError ? (
            <div className="py-4 text-center text-xs text-[#9E391C] bg-[#C86D51]/10 rounded-2xl border border-[#C86D51]/20">{reposError}</div>
          ) : repositories.length > 0 ? (
            repositories.map((repo) => {
              const url = getWebhookUrl(repo.id);
              return (
                <div key={repo.id} className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-serif font-bold text-sm text-[#4A5D45]">{repo.name}</span>
                    <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-lg ${repo.webhook_enabled ? 'bg-[#82937E]/20 text-[#3D4F38] border border-[#82937E]/30' : 'bg-white text-[#8C857E] border border-[#E5E0D8]'}`}>
                      {repo.webhook_enabled ? 'WEBHOOK ENABLED' : 'WEBHOOK DISABLED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    <div>
                      <span className="text-[#8C857E] text-[11px] block font-sans mb-1 font-medium">Payload URL:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={url}
                          className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-[#E5E0D8] text-[#2C2C2C] text-[11px] font-mono focus:outline-none"
                        />
                        <button
                          onClick={() => copyText(url, `url_${repo.id}`)}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#EAE4DC] text-[#4A5D45] text-xs font-sans font-semibold transition border border-[#E5E0D8] flex items-center gap-1 shadow-2xs"
                        >
                          {copiedId === `url_${repo.id}` ? <Check className="w-3.5 h-3.5 text-[#4A5D45]" /> : <Copy className="w-3.5 h-3.5 text-[#82937E]" />}
                          {copiedId === `url_${repo.id}` ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[#8C857E] text-[11px] block font-sans mb-1 font-medium">Webhook Secret:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={repo.webhook_secret}
                          className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-[#E5E0D8] text-[#2C2C2C] text-[11px] font-mono focus:outline-none"
                        />
                        <button
                          onClick={() => copyText(repo.webhook_secret, `sec_${repo.id}`)}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#EAE4DC] text-[#4A5D45] text-xs font-sans font-semibold transition border border-[#E5E0D8] flex items-center gap-1 shadow-2xs"
                        >
                          {copiedId === `sec_${repo.id}` ? <Check className="w-3.5 h-3.5 text-[#4A5D45]" /> : <Copy className="w-3.5 h-3.5 text-[#82937E]" />}
                          {copiedId === `sec_${repo.id}` ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-6 text-center text-xs text-[#8C857E]">No repositories registered yet.</div>
          )}
        </div>
      </div>

      {/* GitHub Setup Guide Box */}
      <div className="p-5 rounded-[24px] bg-[#F3EFEA] border border-[#E5E0D8] text-xs text-[#2C2C2C] space-y-2">
        <h4 className="font-serif font-bold text-[#4A5D45] text-sm flex items-center gap-2">
          <Code className="w-4 h-4 text-[#82937E]" /> GitHub Webhook Setup Guide
        </h4>
        <ol className="list-decimal list-inside space-y-1 text-[#6E6760] leading-relaxed">
          <li>Open your repository on GitHub → <strong>Settings</strong> → <strong>Webhooks</strong> → <strong>Add webhook</strong>.</li>
          <li>Paste the <strong>Payload URL</strong> from above into the Payload URL field.</li>
          <li>Set Content type to <strong>application/json</strong>.</li>
          <li>Paste the <strong>Webhook Secret</strong> into the Secret field.</li>
          <li>Select <strong>Just the push event</strong> and click <strong>Add webhook</strong>.</li>
        </ol>
      </div>

      {/* Webhook Events History Table */}
      <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm">
        <h3 className="text-sm font-serif font-bold text-[#4A5D45] mb-4">Webhook Delivery Events</h3>

        <div className="overflow-x-auto">
          {historyError ? (
            <div className="py-8 text-center text-xs text-[#9E391C] bg-[#C86D51]/10 rounded-2xl border border-[#C86D51]/20">{historyError}</div>
          ) : webhookHistory.length > 0 ? (
            <table className="w-full text-left text-xs text-[#2C2C2C]">
              <thead className="bg-[#F3EFEA] text-[#4A5D45] text-[11px] uppercase font-semibold border-b border-[#E5E0D8]">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-xl">Repository</th>
                  <th className="py-2.5 px-3">Event</th>
                  <th className="py-2.5 px-3">HMAC Signature</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 rounded-r-xl">Received At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D8]">
                {webhookHistory.map((evt) => (
                  <tr key={evt.id} className="hover:bg-[#F3EFEA]/60 transition">
                    <td className="py-3 px-3 font-serif font-semibold text-[#4A5D45]">
                      {evt.repository_name || `#${evt.repository_id}`}
                    </td>
                    <td className="py-3 px-3 font-mono text-[#8C5828] font-semibold">{evt.event_type}</td>
                    <td className="py-3 px-3">
                      {evt.signature_valid ? (
                        <span className="inline-flex items-center gap-1 text-[#3D4F38] font-semibold bg-[#82937E]/20 px-2.5 py-0.5 rounded-lg border border-[#82937E]/30">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#4A5D45]" /> VALID
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#9E391C] font-semibold bg-[#C86D51]/15 px-2.5 py-0.5 rounded-lg border border-[#C86D51]/30">
                          <AlertCircle className="w-3.5 h-3.5 text-[#C86D51]" /> INVALID
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-[#6E6760]">{evt.status}</td>
                    <td className="py-3 px-3 text-[#8C857E]">{new Date(evt.received_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-8 text-center text-xs text-[#8C857E]">No webhook payload events received yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};
