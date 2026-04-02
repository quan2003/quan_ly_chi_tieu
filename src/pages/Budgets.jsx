import React, { useState } from 'react';
import { Wallet, Pencil, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import VndInput from '../components/VndInput';
import { useBudgets } from '../hooks/useBudgets';
import { useTransactions } from '../hooks/useTransactions';

export default function Budgets() {
  const { budgets, loading, saveBudget, deleteBudget } = useBudgets();
  const { transactions } = useTransactions();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [catNameInput, setCatNameInput] = useState('');
  const [amtInput, setAmtInput] = useState('');

  const fmt = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

  const handleDelete = async (category) => {
    if (!window.confirm(`Xoá ngân sách "${category}"?`)) return;
    const ok = await deleteBudget(category);
    if (ok) toast.success(`Đã xoá ngân sách "${category}"!`);
    else toast.error('Xoá thất bại!');
  };

  const openCreate = () => {
    setEditingCategory(null); setCatNameInput(''); setAmtInput('');
    setIsModalOpen(true);
  };

  const openEdit = (cat, amt) => {
    setEditingCategory(cat); setCatNameInput(cat); setAmtInput(amt.toString());
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!catNameInput.trim() || !amtInput) return;
    const ok = await saveBudget(catNameInput.trim(), parseInt(amtInput, 10), editingCategory);
    if (ok) {
      setIsModalOpen(false);
      toast.success(editingCategory ? 'Đã cập nhật ngân sách!' : 'Tạo ngân sách thành công!');
    } else {
      toast.error('Lưu thất bại!');
    }
  };

  // Tính chi tiêu thực tế từ giao dịch
  const budgetList = budgets.map(b => {
    const spent = transactions
      .filter(tx => tx.type === 'expense' && tx.category === b.category)
      .reduce((a, tx) => a + Math.abs(tx.amount), 0);
    return { ...b, spent };
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500 animate-pulse">Đang tải ngân sách...</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Ngân sách của bạn</h2>
        <button onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
          + Tạo ngân sách
        </button>
      </div>

      {budgetList.length === 0 && (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
          <Wallet size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Chưa có ngân sách nào. Hãy tạo một ngân sách mới!</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {budgetList.map((budget) => {
          const percent = budget.amount > 0 ? Math.min((budget.spent / budget.amount) * 100, 100) : 100;
          let colorClass = 'bg-green-500';
          if (percent >= 80) colorClass = 'bg-red-500';
          else if (percent >= 50) colorClass = 'bg-yellow-400';

          return (
            <div key={budget.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 relative group">
              <div className="absolute top-4 right-4 hidden group-hover:flex gap-2">
                <button onClick={() => openEdit(budget.category, budget.amount)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={16} /></button>
                <button onClick={() => handleDelete(budget.category)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                  <Wallet size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 pr-16 truncate">{budget.category}</h3>
                  <p className="text-xs text-gray-500">Đã dùng {budget.amount > 0 ? ((budget.spent / budget.amount) * 100).toFixed(0) : 0}%</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">{fmt(budget.spent)}</span>
                  <span className="text-gray-500">{fmt(budget.amount)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div className={`h-2.5 rounded-full ${colorClass} transition-all duration-500`} style={{ width: `${percent}%` }}></div>
                </div>
                <p className="text-xs text-center text-gray-500 pt-1">
                  Còn lại: <span className="font-medium text-gray-800">{fmt(budget.amount - budget.spent)}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 px-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X size={20} /></button>
            <h3 className="text-xl font-bold text-gray-900 mb-4">{editingCategory ? 'Chỉnh sửa ngân sách' : 'Tạo ngân sách mới'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên mục / Phân loại</label>
                <input type="text" autoFocus required placeholder="Ví dụ: Ăn uống, Du lịch..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  value={catNameInput} onChange={e => setCatNameInput(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền mục tiêu (VND)</label>
                <VndInput required value={amtInput} onChange={setAmtInput}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors">Hủy</button>
                <button type="submit"
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">
                  {editingCategory ? 'Lưu thay đổi' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
