import React, { useState } from 'react';
import { api } from '../services/api.js';
import { User } from '../types.js';
import { Terminal, Lock, User as UserIcon, AlertCircle, ArrowRight } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setError('');
    try {
      const res = await api.login(username, password);
      localStorage.setItem('auth_token', res.token);
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setError(err.message || 'Login failed. Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F6F2] flex items-center justify-center p-4 text-[#2C2C2C] font-sans">
      <div className="w-full max-w-md bg-white border border-[#E5E0D8] rounded-[28px] shadow-sm p-8">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-[#4A5D45] text-white flex items-center justify-center font-serif text-2xl shadow-md mb-4">
            H
          </div>
          <h1 className="text-2xl font-serif tracking-tight text-[#4A5D45]">
            Home Server Deploy Manager
          </h1>
          <p className="text-xs text-[#8C857E] mt-1 font-medium">
            Git Automation & Deployment Helper for aaPanel
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-[#C86D51]/10 border border-[#C86D51]/20 text-xs text-[#9E391C] flex items-center gap-2.5 mb-6">
            <AlertCircle className="w-4 h-4 text-[#C86D51] shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#4A5D45] mb-1.5">
              Username
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-[#82937E] absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F3EFEA] border border-[#E5E0D8] text-sm text-[#2C2C2C] placeholder-[#8C857E] focus:outline-none focus:border-[#4A5D45]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4A5D45] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#82937E] absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F3EFEA] border border-[#E5E0D8] text-sm text-[#2C2C2C] placeholder-[#8C857E] focus:outline-none focus:border-[#4A5D45]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-2xl font-semibold text-xs text-white bg-[#4A5D45] hover:bg-[#3D4F38] disabled:opacity-50 transition shadow-md shadow-[#4A5D45]/20 flex items-center justify-center gap-2"
          >
            {loading ? 'Authenticating...' : 'Log In'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};
