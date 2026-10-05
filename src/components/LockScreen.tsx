'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Shield, HardHat, Briefcase, Delete, ArrowRight, UserCheck } from 'lucide-react';
import { UserRole } from '@/lib/types';

interface LockScreenProps {
  onAuthenticated: (auth: {
    role: UserRole;
    name: string;
    allowedSubprojects: string[];
  }) => void;
}

export function LockScreen({ onAuthenticated }: LockScreenProps) {
  const [pin, setPin] = useState('');
  const [technicianName, setTechnicianName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('protemp_remembered_name') || 'Lindani';
    }
    return 'Lindani';
  });
  const [customName, setCustomName] = useState('');
  const [isEnteringName, setIsEnteringName] = useState(false);
  const [detectedRole, setDetectedRole] = useState<UserRole | null>(null);
  const [allowedSubprojects, setAllowedSubprojects] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Quick technician selection list
  const commonTechnicians = ['Lindani', 'Roland', 'Sipho', 'Thabo'];

  const handleKeyPress = (num: string) => {
    if (pin.length < 16) {
      setPin((prev) => prev + num);
      setError(null);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const handleAttemptLogin = async (pinToVerify = pin) => {
    if (!pinToVerify.trim()) {
      setError('Please enter your PIN or Admin password');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const activeName = customName.trim() || technicianName;
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: pinToVerify.trim(),
          technicianName: activeName,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Incorrect PIN or password. Try again.');
        setIsLoading(false);
        return;
      }

      // If contractor or staff, let them confirm or choose their name before entering
      if ((data.role === 'staff' || data.role === 'contractor') && !isEnteringName) {
        setDetectedRole(data.role);
        setAllowedSubprojects(data.allowedSubprojects || []);
        setIsEnteringName(true);
        setIsLoading(false);
        return;
      }

      // Remember name
      if (activeName) {
        localStorage.setItem('protemp_remembered_name', activeName);
      }

      onAuthenticated({
        role: data.role,
        name: activeName || data.name,
        allowedSubprojects: data.allowedSubprojects || [],
      });
    } catch (err: any) {
      setError(err.message || 'Network error connecting to authentication service');
      setIsLoading(false);
    }
  };

  const handleFinishNameSelect = () => {
    const finalName = customName.trim() || technicianName || 'Technician';
    localStorage.setItem('protemp_remembered_name', finalName);

    if (detectedRole) {
      onAuthenticated({
        role: detectedRole,
        name: finalName,
        allowedSubprojects,
      });
    }
  };

  // Auto-attempt login when 4 digits entered if numeric
  useEffect(() => {
    if (pin.length === 4 && /^\d+$/.test(pin) && !isEnteringName) {
      handleAttemptLogin(pin);
    }
  }, [pin]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-accent-light selection:text-white">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(14,165,233,0.15),transparent_50%)] pointer-events-none" />

      <div className="relative w-full max-w-sm bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
        {/* Header Branding */}
        <div className="text-center space-y-1.5 mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent-light/10 text-accent-light border border-accent-light/30 shadow-inner mb-2">
            <Lock className="w-6 h-6 text-sky-400" />
          </div>
          <h1 className="text-lg font-bold text-white tracking-wide">
            PROTEMP OPERATIONS
          </h1>
          <p className="text-xs font-medium text-slate-400">
            AVI Line 4 Site Progress Tracker
          </p>
        </div>

        {/* STEP 2: Name Selection for Staff & Contractors */}
        {isEnteringName ? (
          <div className="space-y-4">
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 text-center">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <UserCheck className="w-3.5 h-3.5" />
                <span>
                  {detectedRole === 'contractor' ? 'Contractor Access' : 'Staff Access'} Verified
                </span>
              </div>
              <p className="text-sm font-semibold text-white">Who is on site today?</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Your name will be stamped on your ticked stages
              </p>
            </div>

            {/* Quick Name Buttons */}
            <div className="grid grid-cols-2 gap-2">
              {commonTechnicians.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setTechnicianName(name);
                    setCustomName('');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                    technicianName === name && !customName
                      ? 'bg-sky-600 border-sky-400 text-white shadow-sm ring-1 ring-sky-400'
                      : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            {/* Custom Name Option */}
            <div className="relative">
              <input
                type="text"
                placeholder="Or enter custom name..."
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
              />
            </div>

            {/* Submit Name Button */}
            <button
              type="button"
              onClick={handleFinishNameSelect}
              className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue to Site Tasks</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* STEP 1: PIN / Password Input */
          <div className="space-y-5">
            {/* PIN Display Input */}
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAttemptLogin();
                  }}
                  placeholder="Enter PIN or Admin Password"
                  className="w-full text-center tracking-widest text-lg font-mono font-bold py-3 px-4 rounded-2xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 placeholder:text-xs placeholder:font-sans placeholder:tracking-normal focus:outline-hidden focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all shadow-inner"
                />
              </div>

              {/* Error Message */}
              {error && (
                <p className="text-xs text-rose-400 text-center font-medium bg-rose-950/40 border border-rose-900/60 rounded-xl py-1.5 px-3 animate-shake">
                  {error}
                </p>
              )}
            </div>

            {/* Mobile Touch Keypad (0-9, Backspace, Clear) */}
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeyPress(digit)}
                  className="h-13 rounded-2xl bg-slate-800/70 hover:bg-slate-700/80 active:bg-slate-600 text-white text-xl font-bold font-mono border border-slate-700/60 shadow-xs transition-all flex items-center justify-center select-none"
                >
                  {digit}
                </button>
              ))}

              {/* Clear button */}
              <button
                type="button"
                onClick={handleClear}
                className="h-13 rounded-2xl bg-slate-800/40 hover:bg-slate-800 active:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold border border-slate-800 shadow-xs transition-all flex items-center justify-center select-none"
              >
                Clear
              </button>

              {/* Zero */}
              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                className="h-13 rounded-2xl bg-slate-800/70 hover:bg-slate-700/80 active:bg-slate-600 text-white text-xl font-bold font-mono border border-slate-700/60 shadow-xs transition-all flex items-center justify-center select-none"
              >
                0
              </button>

              {/* Backspace */}
              <button
                type="button"
                onClick={handleBackspace}
                className="h-13 rounded-2xl bg-slate-800/40 hover:bg-slate-800 active:bg-slate-700 text-slate-400 hover:text-slate-200 text-sm font-semibold border border-slate-800 shadow-xs transition-all flex items-center justify-center select-none"
                title="Backspace"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Submit / Unlock Button */}
            <button
              type="button"
              disabled={isLoading || pin.length === 0}
              onClick={() => handleAttemptLogin()}
              className="w-full py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all shadow-lg shadow-sky-900/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <span>Verifying...</span>
              ) : (
                <>
                  <span>Unlock Tracker</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Access Role Reference Hints */}
            <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                <span>
                  <strong className="text-slate-200">Admin:</strong> Full control, unlock & sync
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span>
                  <strong className="text-slate-200">Staff PIN:</strong> Full site task access
                </span>
              </div>
              <div className="flex items-center gap-2">
                <HardHat className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>
                  <strong className="text-slate-200">Contractor PIN:</strong> Assigned subprojects
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
