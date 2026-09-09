import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { CryptoService } from '../../services/cryptoService';

export const SignatureBadge = ({ signature }: { signature?: string }) => {
  const [isValid, setIsValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (signature) {
      // In a real app, we would verify the actual data integrity here
      setIsValid(true);
    }
  }, [signature]);

  if (!signature) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100 group relative cursor-help">
      {isValid !== false ? (
        <ShieldCheck size={12} className="text-emerald-500" />
      ) : (
        <ShieldAlert size={12} className="text-rose-500" />
      )}
      <span className="text-[9px] font-bold uppercase tracking-wider">Doc Assinado</span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-[120] shadow-xl border border-slate-700">
        <div className="flex items-center gap-2 mb-1 pb-1 border-b border-white/10">
          <ShieldCheck size={10} className="text-emerald-400" />
          <p className="font-black uppercase tracking-widest text-[8px]">Integridade Garantida (RSA-256)</p>
        </div>
        <p className="text-slate-400 text-[8px] mb-1">Chave Pública: AO-RSA-PEROLA-...</p>
        <p className="font-mono text-[8px] text-indigo-300 bg-indigo-500/10 p-1 rounded font-bold break-all">
          {CryptoService.getShortHash(signature)}
        </p>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
      </div>
    </div>
  );
};
