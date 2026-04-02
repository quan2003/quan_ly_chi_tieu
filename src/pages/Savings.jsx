import React, { useState } from 'react';
import { Target, Plus, X, Trash2, TrendingUp, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGoals } from '../hooks/useGoals';
import { useTransactions } from '../hooks/useTransactions';
import VndInput from '../components/VndInput';

export default function Savings() {
  const { goals, loading, addGoal, deleteGoal, updateGoalProgress } = useGoals();
  const { transactions } = useTransactions();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newCurrent, setNewCurrent] = useState('0');

  const fmt = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

  // Tính số dư trung bình hàng tháng để dự báo
  const avgMonthlySavings = React.useMemo(() => {
     const income = transactions.filter(t => t.type === 'income').reduce((a, b) => a + Math.abs(b.amount), 0);
     const expense = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + Math.abs(b.amount), 0);
     const totalMonths = new Set(transactions.map(t => t.date.split('/')[1] + '/' + t.date.split('/')[2])).size || 1;
     return (income - expense) / totalMonths;
  }, [transactions]);

  const handleAddGoal = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newTarget) return;

    // Loại bỏ dấu chấm/phẩy nếu có trước khi lưu
    const targetAmt = parseInt(newTarget.toString().replace(/[^\d]/g, ''), 10);
    const currentAmt = parseInt(newCurrent.toString().replace(/[^\d]/g, ''), 10) || 0;

    const ok = await addGoal({
      title: newTitle.trim(),
      target_amount: targetAmt,
      current_amount: currentAmt,
      created_at: new Date().toISOString()
    });

    if (ok) {
      toast.success('Đã thêm mục tiêu tiết kiệm!');
      setIsAddModalOpen(false);
      setNewTitle(''); setNewTarget(''); setNewCurrent('0');
    } else {
      toast.error('Có lỗi xảy ra, hãy kiểm tra bảng savings_goals!');
    }
  };

  const calculateETA = (target, current) => {
    if (avgMonthlySavings <= 0) return 'Vô hạn (Số dư ≤ 0)';
    const remaining = target - current;
    const months = Math.ceil(remaining / avgMonthlySavings);
    return months > 0 ? `${months} tháng` : 'Đã đạt được!';
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500 animate-pulse">Đang tải mục tiêu...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Mục tiêu tiết kiệm</h2>
          <p className="text-sm text-gray-500 mt-1">Số dư trung bình: {fmt(avgMonthlySavings)}/tháng</p>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm">
          <Plus size={18} /> Thêm mục tiêu
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {goals.map(goal => {
          const ratio = Math.min(100, (goal.current_amount / goal.target_amount) * 100);
          return (
            <div key={goal.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative group">
              <button 
                onClick={() => { if(window.confirm('Xóa mục tiêu này?')) deleteGoal(goal.id); }}
                className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors md:opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={16} />
              </button>

              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                  <Target size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{goal.title}</h3>
                  <p className="text-xs text-gray-400">Tạo ngày: {new Date(goal.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tiến độ: <span className="font-bold text-indigo-600">{ratio.toFixed(1)}%</span></span>
                  <span className="text-gray-900 font-medium">{fmt(goal.current_amount)} / {fmt(goal.target_amount)}</span>
                </div>

                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-blue-500 h-full rounded-full transition-all duration-700" style={{ width: `${ratio}%` }}></div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Cần thêm</p>
                    <p className="text-sm font-bold text-gray-800">{fmt(goal.target_amount - goal.current_amount)}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Dự kiến xong</p>
                    <p className="text-sm font-bold text-gray-800 flex items-center gap-1">
                      <Clock size={12} className="text-indigo-400" />
                      {calculateETA(goal.target_amount, goal.current_amount)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {goals.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 py-16 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-3xl text-gray-400">
            <Target size={48} className="mb-4 stroke-gray-300" />
            <p className="font-medium">Bạn chưa có mục tiêu tiết kiệm nào.</p>
            <button onClick={() => setIsAddModalOpen(true)} className="mt-4 text-indigo-600 hover:text-indigo-800 font-bold text-sm">Hãy bắt đầu ngay!</button>
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-60 px-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button onClick={() => setIsAddModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors"><X size={24} /></button>
            <h3 className="text-2xl font-black text-gray-900 mb-6">Mục tiêu của bạn là gì?</h3>
            
            <form onSubmit={handleAddGoal} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Tên mục tiêu (Ví dụ: Mua iPhone 15)</label>
                <input type="text" autoFocus required placeholder="Bạn đang tiết kiệm để làm gì?..."
                  className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-0 transition-all font-medium"
                  value={newTitle} onChange={e => setNewTitle(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Số tiền đích (VND)</label>
                  <VndInput required value={newTarget} onChange={setNewTarget}
                    className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-all font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Đã có sẵn (VND)</label>
                  <VndInput required value={newCurrent} onChange={setNewCurrent}
                    className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-all font-medium" />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-6 py-3.5 text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-xl font-bold transition-all">Quay lại</button>
                <button type="submit"
                  className="flex-1 px-6 py-3.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200">Bắt đầu tiết kiệm</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
