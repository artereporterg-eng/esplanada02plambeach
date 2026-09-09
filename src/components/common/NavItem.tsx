import React from 'react';

export interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  collapsed?: boolean;
  activeColor?: string;
}

export function NavItem({ icon, label, active, onClick, collapsed, activeColor = "bg-indigo-500" }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-bold text-xs transition-all duration-200 ${
        active
          ? `${activeColor} text-white shadow-md shadow-indigo-500/20`
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      } ${collapsed ? "justify-center px-2" : ""}`}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}
