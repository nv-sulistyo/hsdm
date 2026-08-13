import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';

interface LocalChangesModalProps {
  repoName: string;
  dirtyFiles: string[];
  onCancel: () => void;
  onConfirmForcePull: () => void;
  loading?: boolean;
}

export const LocalChangesModal: React.FC<LocalChangesModalProps> = ({
  repoName,
  dirtyFiles,
  onCancel,
  onConfirmForcePull,
  loading = false
}) => {
  const [understood, setUnderstood] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg bg-white border border-[#E5E0D8] rounded-[28px] shadow-2xl p-6 text-[#2C2C2C]">
        <button
          onClick={onCancel}
          disabled={loading}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-[#8C857E] hover:text-[#2C2C2C] hover:bg-[#E5E0D8]/50 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 text-[#B87333] mb-4">
          <div className="p-2.5 rounded-2xl bg-[#D4A373]/20 border border-[#D4A373]/30">
            <AlertTriangle className="w-6 h-6 text-[#B87333]" />
          </div>
          <div>
            <h3 className="text-lg font-serif italic font-bold text-[#4A5D45]">Local Changes Detected</h3>
            <p className="text-xs text-[#B87333] font-medium">Working tree in '{repoName}' has uncommitted files</p>
          </div>
        </div>

        <p className="text-sm text-[#6E6760] mb-4 leading-relaxed">
          Standard Git pull has been canceled to protect your working directory. Overwriting uncommitted local changes will result in permanent data loss.
        </p>

        {dirtyFiles && dirtyFiles.length > 0 && (
          <div className="mb-4">
            <span className="text-xs font-semibold text-[#8C857E] uppercase tracking-wider block mb-2">
              Modified Uncommitted Files ({dirtyFiles.length}):
            </span>
            <div className="max-h-32 overflow-y-auto p-3.5 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] font-mono text-xs text-[#8C5828] space-y-1">
              {dirtyFiles.map((file, i) => (
                <div key={i} className="truncate">
                  {file}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-3.5 rounded-2xl bg-[#C86D51]/15 border border-[#C86D51]/30 text-xs text-[#9E391C] mb-5 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-[#C86D51] shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">High Risk Action (Force Pull):</span>
            Force Pull executes <code className="text-[#9E391C] bg-white px-1.5 py-0.5 rounded border border-[#C86D51]/30 font-mono">git reset --hard origin/branch</code>, discarding all local modifications permanently.
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 text-xs text-[#6E6760]">
          <input
            type="checkbox"
            id="forceCheck"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            className="w-4 h-4 rounded border-[#E5E0D8] bg-white text-[#4A5D45] focus:ring-[#4A5D45] cursor-pointer"
          />
          <label htmlFor="forceCheck" className="cursor-pointer select-none">
            I understand that Force Pull will permanently overwrite all local uncommitted changes.
          </label>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition shadow-2xs"
          >
            Cancel Pull
          </button>
          <button
            onClick={onConfirmForcePull}
            disabled={!understood || loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#C86D51] hover:bg-[#9E391C] disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md shadow-[#C86D51]/20"
          >
            {loading ? 'Executing Force Pull...' : 'Force Pull (Overwrite Local)'}
          </button>
        </div>
      </div>
    </div>
  );
};
