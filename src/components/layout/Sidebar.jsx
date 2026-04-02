import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ReceiptText, Wallet, Target, X } from 'lucide-react';
import logo from '../../images/logo_QN.png';

export default function Sidebar({ onClose }) {
  const navItems = [
    { path: '/', label: 'Tổng quan', icon: LayoutDashboard },
    { path: '/transactions', label: 'Giao dịch', icon: ReceiptText },
    { path: '/budgets', label: 'Ngân sách', icon: Wallet },
    { path: '/savings', label: 'Tiết kiệm', icon: Target },
  ];

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-100">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 min-h-[72px]">
        <img src={logo} alt="Logo" className="max-h-14 max-w-[160px] w-auto object-contain" />
        <button onClick={onClose} className="lg:hidden p-2 text-gray-500 shrink-0">
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <Icon size={20} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-gray-100">
        <p className="text-sm text-gray-500 text-center">© 2026 Dashboard</p>
      </div>
    </div>
  );
}
