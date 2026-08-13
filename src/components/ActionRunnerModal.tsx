import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api.js';
import { Repository, ActionTemplate, ActionRun } from '../types.js';
import { X, Copy, Check, Terminal, Play, AlertCircle, Clock, Loader2, Trash2 } from 'lucide-react';

interface ActionRunnerModalProps {
  repo: Repository | null;
  onClose: () => void;
}

const TIMEOUT_OPTIONS = [
  { value: 600, label: '10 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '60 minutes' }
];

export const ActionRunnerModal: React.FC<ActionRunnerModalProps> = ({ repo, onClose }) => {
  const [templates, setTemplates] = useState<ActionTemplate[]>([]);
  const [templateId, setTemplateId] = useState<number | ''>('');
  const [commandsText, setCommandsText] = useState('');
  const [timeoutSeconds, setTimeoutSeconds] = useState(1800);
  const [run, setRun] = useState<ActionRun | null>(null);
  const [recentRuns, setRecentRuns] = useState<ActionRun[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!repo) return;
    api.getActionTemplates()
      .then(t => {
        setTemplates(t);
        if (t.length > 0) {
          setTemplateId(t[0].id);
          setCommandsText(t[0].commands.join('\n'));
        }
      })
      .catch(err => setError(err.message));
    api.getActionRuns(repo.id, 5)
      .then(setRecentRuns)
      .catch(() => {});
  }, [repo]);

  useEffect(() => {
    if (run && run.status === 'RUNNING') {
      const interval = setInterval(async () => {
        try {
          const updated = await api.getActionRun(run.id);
          setRun(updated);
          if (updated.status !== 'RUNNING') {
            setRecentRuns(await api.getActionRuns(repo?.id, 5));
          }
        } catch (err) {
          console.error('Poll action run failed:', err);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [run?.status, run?.id, repo?.id]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [run?.output]);

  if (!repo) return null;

  const handleTemplateSelect = (id: number | '') => {
    setTemplateId(id);
    if (id !== '') {
      const t = templates.find(t => t.id === id);
      if (t) setCommandsText(t.commands.join('\n'));
    } else {
      setCommandsText('');
    }
  };

  const handleRun = async () => {
    setStarting(true);
    setError('');
    try {
      const commands = commandsText.split('\n').map(c => c.trim()).filter(Boolean);
      if (commands.length === 0) {
        throw new Error('No commands to execute. Enter at least one command.');
      }
      const newRun = await api.runAction(repo.id, {
        templateId: templateId === '' ? undefined : templateId,
        commands,
        timeoutSeconds
      });
      setRun(newRun);
      setRecentRuns(await api.getActionRuns(repo.id, 5));
    } catch (err: any) {
      setError(err.message || 'Failed to run action');
    } finally {
      setStarting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(run?.output || run?.error || 'No log output recorded.');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearRuns = async () => {
    if (!window.confirm(`Clear ALL action run history for '${repo.name}'? This cannot be undone.`)) return;
    try {
      await api.clearActionRuns(repo.id);
      setRecentRuns([]);
    } catch (err: any) {
      setError(err.message || 'Failed to clear action runs');
    }
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
              <h3 className="text-base font-serif font-bold text-[#4A5D45]">Run Action — {repo.name}</h3>
              <p className="text-xs text-[#8C857E] mt-0.5">
                {repo.local_path} · executes as <span className="font-semibold text-[#4A5D45]">{repo.execution_user}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#8C857E] hover:text-[#2C2C2C] hover:bg-[#E5E0D8]/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!run ? (
          /* ---------- Form View ---------- */
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {error && (
              <div className="p-3.5 rounded-2xl bg-[#C86D51]/15 border border-[#C86D51]/30 text-[#9E391C] text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[#C86D51] shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#4A5D45]">Action Template</label>
              <select
                value={templateId}
                onChange={e => handleTemplateSelect(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-sm text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
              >
                <option value="">— Custom command —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.tech_stack})
                  </option>
                ))}
              </select>
              {templateId !== '' && (
                <p className="text-xs text-[#8C857E]">
                  {templates.find(t => t.id === templateId)?.description || 'Template commands are listed below — you can edit them before running.'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#4A5D45]">Commands (one per line, run sequentially)</label>
              <textarea
                value={commandsText}
                onChange={e => setCommandsText(e.target.value)}
                rows={6}
                spellCheck={false}
                placeholder={'npm install\nnpm run build'}
                className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-sm font-mono text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45] resize-y"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#4A5D45]">Timeout (long-running processes are terminated after this)</label>
              <select
                value={timeoutSeconds}
                onChange={e => setTimeoutSeconds(parseInt(e.target.value, 10))}
                className="px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-sm text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
              >
                {TIMEOUT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-[#8C857E]">
                Kelola template di <span className="font-semibold text-[#4A5D45]">Settings → Action Templates</span>
              </p>
              <button
                onClick={handleRun}
                disabled={starting}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#4A5D45] hover:bg-[#3D4F38] text-white disabled:opacity-50 transition shadow-sm"
              >
                {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {starting ? 'Starting...' : 'Run Action'}
              </button>
            </div>

            {/* Recent runs */}
            {recentRuns.length > 0 && (
              <div className="pt-3 border-t border-[#E5E0D8]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-[#4A5D45] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#82937E]" /> Recent Runs
                  </h4>
                  <button
                    onClick={handleClearRuns}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-[#9E391C] bg-[#F3EFEA] hover:bg-[#C86D51]/15 border border-[#E5E0D8] transition"
                    title="Clear run history for this repository"
                  >
                    <Trash2 className="w-3 h-3 text-[#C86D51]" /> Clear Runs
                  </button>
                </div>
                <div className="space-y-1.5">
                  {recentRuns.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setRun(r)}
                      className="w-full text-left px-3.5 py-2 rounded-xl bg-[#F3EFEA]/70 hover:bg-[#EAE4DC] border border-[#E5E0D8] transition flex items-center justify-between gap-3"
                    >
                      <span className="text-xs font-mono truncate text-[#2C2C2C]">
                        #{r.id} · {r.template_name || 'Custom'}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${
                            r.status === 'SUCCESS'
                              ? 'bg-[#82937E]/15 text-[#3D4F38]'
                              : r.status === 'FAILED'
                                ? 'bg-[#C86D51]/15 text-[#9E391C]'
                                : 'bg-[#6B8E9E]/15 text-[#2C5263]'
                          }`}
                        >
                          {r.status}
                        </span>
                        <span className="text-[10px] text-[#8C857E]">
                          {new Date(r.created_at).toLocaleString()}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ---------- Run / Live View ---------- */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-3 bg-[#F3EFEA]/60 border-b border-[#E5E0D8] text-xs">
              <div>
                <span className="text-[#8C857E] block">Run</span>
                <span className="font-mono font-semibold text-[#2C2C2C]">#{run.id}</span>
              </div>
              <div>
                <span className="text-[#8C857E] block">Template</span>
                <span className="text-[#2C2C2C] font-medium">{run.template_name || 'Custom command'}</span>
              </div>
              <div>
                <span className="text-[#8C857E] block">Status</span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold mt-0.5 ${
                    run.status === 'SUCCESS'
                      ? 'bg-[#82937E]/15 text-[#3D4F38]'
                      : run.status === 'FAILED'
                        ? 'bg-[#C86D51]/15 text-[#9E391C]'
                        : 'bg-[#6B8E9E]/15 text-[#2C5263]'
                  }`}
                >
                  {run.status === 'RUNNING' && <Loader2 className="w-3 h-3 animate-spin" />}
                  {run.status}
                </span>
              </div>
              <div>
                <span className="text-[#8C857E] block">Started</span>
                <span className="text-[#2C2C2C] font-medium">{new Date(run.created_at).toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-hidden bg-[#F3EFEA] border-b border-[#E5E0D8] flex flex-col">
              {run.error && (
                <div className="p-3.5 rounded-2xl bg-[#C86D51]/15 border border-[#C86D51]/30 text-[#9E391C] flex items-start gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-[#C86D51] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Error Summary:</span>
                    <p>{run.error}</p>
                  </div>
                </div>
              )}
              <pre
                ref={outputRef}
                className="flex-1 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs text-[#2C2C2C] leading-relaxed select-text"
              >
                {run.output || (run.status === 'RUNNING' ? 'Executing...' : 'No log output recorded.')}
              </pre>
            </div>

            <div className="flex items-center justify-between px-6 py-3 bg-[#F3EFEA] text-xs text-[#8C857E]">
              <span>
                {run.finished_at && run.started_at
                  ? `Duration: ${Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s · Exit code: ${run.exit_code ?? 'N/A'}`
                  : `Exit code: ${run.exit_code ?? 'N/A'}`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#EAE4DC] transition border border-[#E5E0D8]"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#4A5D45]" /> : <Copy className="w-3.5 h-3.5 text-[#82937E]" />}
                  {copied ? 'Copied' : 'Copy Log'}
                </button>
                <button
                  onClick={() => setRun(null)}
                  className="px-4 py-1.5 rounded-xl font-semibold text-[#4A5D45] bg-white hover:bg-[#EAE4DC] transition border border-[#E5E0D8]"
                >
                  {run.status === 'RUNNING' ? 'Back (keeps running)' : 'Back'}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-xl font-semibold text-white bg-[#4A5D45] hover:bg-[#3D4F38] transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};