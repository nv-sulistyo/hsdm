import React, { useState } from 'react';
import { Deployment } from '../types.js';
import { X, Copy, Check, Terminal, ExternalLink, AlertCircle } from 'lucide-react';
import { DeploymentStatusBadge } from './StatusBadge.js';

interface LogViewerModalProps {
  deployment: Deployment | null;
  onClose: () => void;
}

export const LogViewerModal: React.FC<LogViewerModalProps> = ({ deployment, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!deployment) return null;

  const handleCopy = () => {
    const text = deployment.output || deployment.error || 'No log output recorded.';
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white border border-[#E5E0D8] rounded-[28px] shadow-2xl flex flex-col overflow-hidden text-[#2C2C2C]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E0D8] bg-[#F3EFEA]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white border border-[#E5E0D8] text-[#4A5D45]">
              <Terminal className="w-5 h-5 text-[#82937E]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-serif font-bold text-[#4A5D45]">
                  Deployment #{deployment.id}
                </h3>
                <span className="text-sm font-medium text-[#8C857E]">
                  — {deployment.repository_name || `Repo #${deployment.repository_id}`}
                </span>
                <DeploymentStatusBadge status={deployment.status} />
              </div>
              <p className="text-xs text-[#8C857E] mt-0.5">
                Triggered via <span className="font-semibold text-[#4A5D45]">{deployment.trigger_type}</span> at {new Date(deployment.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#EAE4DC] transition border border-[#E5E0D8] shadow-2xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#4A5D45]" /> : <Copy className="w-3.5 h-3.5 text-[#82937E]" />}
              {copied ? 'Copied' : 'Copy Log'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#8C857E] hover:text-[#2C2C2C] hover:bg-[#E5E0D8]/50 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-3 bg-[#F3EFEA]/60 border-b border-[#E5E0D8] text-xs">
          <div>
            <span className="text-[#8C857E] block">Commit Before</span>
            <code className="text-[#2C2C2C] font-mono font-semibold">{deployment.commit_before ? deployment.commit_before.slice(0, 7) : 'N/A'}</code>
          </div>
          <div>
            <span className="text-[#8C857E] block">Commit After</span>
            <code className="text-[#2C2C2C] font-mono font-semibold">{deployment.commit_after ? deployment.commit_after.slice(0, 7) : 'N/A'}</code>
          </div>
          <div>
            <span className="text-[#8C857E] block">Started</span>
            <span className="text-[#2C2C2C] font-medium">{deployment.started_at ? new Date(deployment.started_at).toLocaleTimeString() : 'N/A'}</span>
          </div>
          <div>
            <span className="text-[#8C857E] block">Finished</span>
            <span className="text-[#2C2C2C] font-medium">{deployment.finished_at ? new Date(deployment.finished_at).toLocaleTimeString() : 'N/A'}</span>
          </div>
        </div>

        {/* Console / Terminal Body */}
        <div className="flex-1 p-6 overflow-y-auto bg-[#F3EFEA] border-b border-[#E5E0D8] font-mono text-xs text-[#2C2C2C] leading-relaxed space-y-2 select-text">
          {deployment.error && (
            <div className="p-3.5 rounded-2xl bg-[#C86D51]/15 border border-[#C86D51]/30 text-[#9E391C] flex items-start gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-[#C86D51] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Error Summary:</span>
                <p>{deployment.error}</p>
              </div>
            </div>
          )}

          <pre className="whitespace-pre-wrap break-words font-mono text-[#2C2C2C]">
            {deployment.output || 'No execution log recorded.'}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 bg-[#F3EFEA] text-xs text-[#8C857E]">
          <span>
            {deployment.finished_at && deployment.started_at
              ? `Duration: ${Math.round((new Date(deployment.finished_at).getTime() - new Date(deployment.started_at).getTime()) / 1000)}s`
              : 'Execution duration unknown'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl font-semibold text-[#4A5D45] bg-white hover:bg-[#EAE4DC] transition border border-[#E5E0D8] shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
