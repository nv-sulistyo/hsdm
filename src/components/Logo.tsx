import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 36, className }) => (
  <img
    src="/logo.svg"
    width={size}
    height={size}
    alt="HSDM logo"
    className={`object-cover ${className ?? ''}`}
  />
);