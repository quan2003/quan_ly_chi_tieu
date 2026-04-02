import { Bell, Menu, User } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function Topbar({ onMenuClick }) {
  const location = useLocation();
  
  const pageTitles = {
    '/': 'Tổng quan',
    '/transactions': 'Giao dịch',
    '/budgets': 'Ngân sách'
  };

  const title = pageTitles[location.pathname] || 'Dashboard';

  return (
    <header className="h-16 bg-white flex items-center justify-between px-4 lg:px-6 shadow-sm z-10">
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuClick}
          className="p-2 -ml-2 text-gray-500 rounded-lg hover:bg-gray-100 lg:hidden"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <User size={18} />
          </div>
          <span className="text-sm font-medium text-gray-700 hidden sm:block">Admin</span>
        </div>
      </div>
    </header>
  );
}
