import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { SystemEnvironment } from '../types.js';
import {
  Key,
  Terminal,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  AlertCircle,
  PlusCircle,
  Code2,
  CheckCircle2,
  UserCheck,
  Folder,
  Shield
} from 'lucide-react';

export const GitSshPage: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [systemEnv, setSystemEnv] = useState<SystemEnvironment | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const [sshRes, envRes] = await Promise.all([
        api.getSshKeyStatus(),
        api.detectEnvironment().catch(() => null)
      ]);
      setStatus(sshRes);
      if (envRes) setSystemEnv(envRes);
    } catch (err: any) {
      console.error('Failed to fetch SSH status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testGithub();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Connection test failed',
        details: err.message
      });
    } finally {
      setTesting(false);
    }
  };

  const handleGenerateSshKey = async (force = false) => {
    setGeneratingKey(true);
    setActionMessage(null);
    try {
      const res = await api.generateSshKey(force);
      setStatus(res.status);
      setActionMessage('SSH key generated successfully for system user!');
      setConfirmRegenerate(false);
    } catch (err: any) {
      setActionMessage(`Key generation failed: ${err.message}`);
    } finally {
      setGeneratingKey(false);
    }
  };

  const copyPublicKey = () => {
    if (status?.publicKeyContent) {
      navigator.clipboard.writeText(status.publicKeyContent);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif text-[#4A5D45] tracking-tight">Git & SSH Identity Manager</h2>
          <p className="text-xs text-[#8C857E] mt-0.5">Execution user credentials, SSH deploy keys, and GitHub connectivity diagnostics</p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition flex items-center gap-1.5 shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#82937E] ${loading ? 'animate-spin' : ''}`} /> Scan Environment
        </button>
      </div>

      {actionMessage && (
        <div className="p-3.5 rounded-2xl bg-[#82937E]/15 border border-[#82937E]/30 text-xs text-[#3D4F38] font-medium">
          {actionMessage}
        </div>
      )}

      {/* Grid Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Execution User Identity Box */}
        <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-serif font-bold text-[#4A5D45] flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#4A5D45]" /> Execution User
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-[#3D4F38] bg-[#82937E]/20 px-2.5 py-0.5 rounded-lg border border-[#82937E]/30">
              {status?.executionUser || 'nova'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] text-xs space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span className="text-[#8C857E]">Home Dir:</span>
              <span className="text-[#2C2C2C] font-semibold">{status?.executionUserHome || '/home/nova'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8C857E]">System User Exists:</span>
              <span className="text-[#3D4F38] font-bold">{status?.userExistsOnSystem ? 'YES' : 'FALLBACK'}</span>
            </div>
          </div>
        </div>

        {/* Git Executable Box */}
        <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-serif font-bold text-[#4A5D45] flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#82937E]" /> System Git CLI
            </h3>
            {status?.gitInstalled ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3D4F38] bg-[#82937E]/20 px-2.5 py-0.5 rounded-lg border border-[#82937E]/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4A5D45]" /> INSTALLED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#9E391C] bg-[#C86D51]/15 px-2.5 py-0.5 rounded-lg border border-[#C86D51]/30">
                <AlertCircle className="w-3.5 h-3.5 text-[#C86D51]" /> NOT FOUND
              </span>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] text-xs space-y-1 font-mono">
            <div className="flex justify-between">
              <span className="text-[#8C857E]">Version Output:</span>
              <span className="text-[#2C2C2C] font-semibold">{status?.gitVersion || 'Checking...'}</span>
            </div>
          </div>
        </div>

        {/* SSH Key Box */}
        <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-serif font-bold text-[#4A5D45] flex items-center gap-2">
              <Key className="w-4 h-4 text-[#B87333]" /> SSH Key Status
            </h3>
            {status?.privateKeyExists ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3D4F38] bg-[#82937E]/20 px-2.5 py-0.5 rounded-lg border border-[#82937E]/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4A5D45]" /> KEY AVAILABLE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#9E391C] bg-[#C86D51]/15 px-2.5 py-0.5 rounded-lg border border-[#C86D51]/30">
                <AlertCircle className="w-3.5 h-3.5 text-[#C86D51]" /> MISSING
              </span>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] text-xs space-y-1 font-mono">
            <div className="flex justify-between truncate">
              <span className="text-[#8C857E]">Path:</span>
              <span className="text-[#2C2C2C] font-semibold truncate">{status?.keyPath || '~/.ssh/id_ed25519'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SSH Key Management Section */}
      <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-4">
        {!status?.privateKeyExists ? (
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-serif font-bold text-[#4A5D45]">Generate SSH Ed25519 Key</h3>
              <p className="text-xs text-[#8C857E]">Create a secure key pair for system user '{status?.executionUser || 'nova'}'</p>
            </div>
            <button
              onClick={() => handleGenerateSshKey(false)}
              disabled={generatingKey}
              className="px-4 py-2.5 rounded-2xl text-xs font-semibold bg-[#4A5D45] hover:bg-[#3D4F38] text-white transition flex items-center gap-2 shadow-sm"
            >
              {generatingKey ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              {generatingKey ? 'Generating...' : 'Generate SSH Key'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-serif font-bold text-[#4A5D45]">Existing Key Detected</h3>
                <p className="text-xs text-[#8C857E]">Key is active at <code>{status?.keyPath}</code>. Re-generating will overwrite this key.</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-[#8C5828]">
                  <input
                    type="checkbox"
                    checked={confirmRegenerate}
                    onChange={(e) => setConfirmRegenerate(e.target.checked)}
                    className="w-4 h-4 rounded border-[#E5E0D8]"
                  />
                  <span>Confirm Overwrite</span>
                </label>
                <button
                  onClick={() => handleGenerateSshKey(true)}
                  disabled={!confirmRegenerate || generatingKey}
                  className="px-3.5 py-2 rounded-2xl text-xs font-semibold bg-[#C86D51] hover:bg-[#A6533A] text-white disabled:opacity-40 transition shadow-sm"
                >
                  Regenerate Key
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Public Key Display Box */}
      {status?.publicKeyExists && (
        <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-serif font-bold text-[#4A5D45]">SSH Public Key (Deploy Key)</h3>
              <p className="text-xs text-[#8C857E]">Add this public key as a Deploy Key in GitHub repository settings</p>
            </div>
            <button
              onClick={copyPublicKey}
              className="px-3.5 py-2 rounded-2xl bg-[#4A5D45] hover:bg-[#3D4F38] text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
            >
              {copiedKey ? <Check className="w-3.5 h-3.5 text-[#D4A373]" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey ? 'Copied to Clipboard' : 'Copy Public Key'}
            </button>
          </div>

          <textarea
            readOnly
            value={status.publicKeyContent}
            rows={3}
            className="w-full p-3.5 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] font-mono text-xs text-[#2C2C2C] focus:outline-none resize-none"
          />
        </div>
      )}

      {/* GitHub Connection Diagnostic Runner */}
      <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-serif font-bold text-[#4A5D45]">Test GitHub Connection</h3>
            <p className="text-xs text-[#8C857E]">Executes SSH authentication test as '{status?.executionUser || 'nova'}' against git@github.com</p>
          </div>
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2 rounded-2xl text-xs font-semibold text-white bg-[#4A5D45] hover:bg-[#3D4F38] disabled:opacity-50 transition shadow-md shadow-[#4A5D45]/20 flex items-center gap-1.5"
          >
            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {testing ? 'Testing Connection...' : 'Test GitHub Connection'}
          </button>
        </div>

        {testResult && (
          <div
            className={`p-4 rounded-2xl border space-y-2 ${
              testResult.success
                ? 'bg-[#82937E]/15 border-[#82937E]/30 text-[#3D4F38]'
                : 'bg-[#D4A373]/20 border-[#D4A373]/40 text-[#8C5828]'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              {testResult.success ? <CheckCircle2 className="w-5 h-5 text-[#4A5D45]" /> : <AlertCircle className="w-5 h-5 text-[#B87333]" />}
              <span>{testResult.message}</span>
            </div>

            <pre className="p-3.5 rounded-xl bg-[#F3EFEA] border border-[#E5E0D8] font-mono text-xs text-[#2C2C2C] whitespace-pre-wrap max-h-48 overflow-y-auto">
              {testResult.details}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

