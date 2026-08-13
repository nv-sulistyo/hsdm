import React from 'react';
import { RepoStatus, DeploymentStatus } from '../types.js';
import { CheckCircle2, AlertTriangle, RefreshCw, XCircle, FileCode, WifiOff, Clock } from 'lucide-react';

interface RepoStatusBadgeProps {
  status: RepoStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const RepoStatusBadge: React.FC<RepoStatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[11px] gap-1 font-semibold rounded-lg',
    md: 'px-2.5 py-1 text-xs gap-1.5 font-semibold rounded-xl',
    lg: 'px-3 py-1.5 text-xs gap-2 font-semibold rounded-2xl'
  };

  switch (status) {
    case 'SYNCED':
      return (
        <span className={`inline-flex items-center bg-[#82937E]/15 text-[#3D4F38] border border-[#82937E]/30 ${sizeClasses[size]}`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-[#4A5D45]" />
          SYNCED
        </span>
      );
    case 'BEHIND':
      return (
        <span className={`inline-flex items-center bg-[#D4A373]/20 text-[#8C5828] border border-[#D4A373]/40 ${sizeClasses[size]}`}>
          <RefreshCw className="w-3.5 h-3.5 text-[#B87333] animate-spin-slow" />
          BEHIND (PULL NEEDED)
        </span>
      );
    case 'DIRTY':
      return (
        <span className={`inline-flex items-center bg-[#D4A373]/25 text-[#7A4B1D] border border-[#D4A373]/50 ${sizeClasses[size]}`}>
          <AlertTriangle className="w-3.5 h-3.5 text-[#A36124]" />
          LOCAL CHANGES
        </span>
      );
    case 'AHEAD':
      return (
        <span className={`inline-flex items-center bg-[#6B8E9E]/15 text-[#2C5263] border border-[#6B8E9E]/30 ${sizeClasses[size]}`}>
          <RefreshCw className="w-3.5 h-3.5 text-[#3B6678]" />
          LOCAL AHEAD
        </span>
      );
    case 'DIVERGED':
      return (
        <span className={`inline-flex items-center bg-[#917B93]/15 text-[#593E5B] border border-[#917B93]/30 ${sizeClasses[size]}`}>
          <AlertTriangle className="w-3.5 h-3.5 text-[#6B4D6D]" />
          DIVERGED
        </span>
      );
    case 'NOT_A_REPOSITORY':
      return (
        <span className={`inline-flex items-center bg-[#8C857E]/15 text-[#59534E] border border-[#8C857E]/30 ${sizeClasses[size]}`}>
          <FileCode className="w-3.5 h-3.5 text-[#6E6760]" />
          NOT CLONED
        </span>
      );
    case 'UNREACHABLE':
      return (
        <span className={`inline-flex items-center bg-[#C08F5D]/20 text-[#7D5325] border border-[#C08F5D]/40 ${sizeClasses[size]}`}>
          <WifiOff className="w-3.5 h-3.5 text-[#A1672A]" />
          UNREACHABLE
        </span>
      );
    case 'ERROR':
      return (
        <span className={`inline-flex items-center bg-[#C86D51]/15 text-[#9E391C] border border-[#C86D51]/30 ${sizeClasses[size]}`}>
          <XCircle className="w-3.5 h-3.5 text-[#C86D51]" />
          ERROR
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center bg-[#8C857E]/15 text-[#6E6760] border border-[#8C857E]/30 ${sizeClasses[size]}`}>
          <Clock className="w-3.5 h-3.5 text-[#8C857E]" />
          UNCHECKED
        </span>
      );
  }
};

export const DeploymentStatusBadge: React.FC<{ status: DeploymentStatus }> = ({ status }) => {
  switch (status) {
    case 'SUCCESS':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-[#82937E]/15 text-[#3D4F38] border border-[#82937E]/30">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#4A5D45]" />
          SUCCESS
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-[#C86D51]/15 text-[#9E391C] border border-[#C86D51]/30">
          <XCircle className="w-3.5 h-3.5 text-[#C86D51]" />
          FAILED
        </span>
      );
    case 'RUNNING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-[#6B8E9E]/15 text-[#2C5263] border border-[#6B8E9E]/30 animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#3B6678]" />
          RUNNING
        </span>
      );
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-[#D4A373]/20 text-[#8C5828] border border-[#D4A373]/40">
          <Clock className="w-3.5 h-3.5 text-[#B87333]" />
          PENDING
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-[#8C857E]/15 text-[#59534E] border border-[#8C857E]/30">
          {status}
        </span>
      );
  }
};
