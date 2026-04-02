import React, { useState } from 'react';
import { Target, Plus, X, Trash2, TrendingUp, Clock, Pencil, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGoals } from '../hooks/useGoals';
import { supabase } from '../lib/supabase';
import { useTransactions } from '../hooks/useTransactions';
import VndInput from '../components/VndInput';

export default function Savings() {
  const { goals, loading, addGoal, deleteGoal, updateGoalProgress } = useGoals();
  const { transactions } = useTransactions();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null); // Để lưu goal đang được sửa
  const [contributingGoal, setContributingGoal] = useState(null); // Cho modal cộng thêm tiền
  const [deletingGoal, setDeletingGoal] = useState(null); // Cho modal xác nhận xóa
  
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newCurrent, setNewCurrent] = useState('0');
  const [extraAmount, setExtraAmount] = useState('0'); // Số tiền cộng thêm

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

    const targetAmt = parseInt(newTarget.toString().replace(/[^\d]/g, ''), 10);
    const currentAmt = parseInt(newCurrent.toString().replace(/[^\d]/g, ''), 10) || 0;

    if (editingGoal) {
      // Logic Cập nhật (Edit)
      const { error } = await supabase.from('savings_goals').update({
        title: newTitle.trim(),
        target_amount: targetAmt,
        current_amount: currentAmt
      }).eq('id', editingGoal.id);

      if (!error) {
        toast.success('Đã cập nhật mục tiêu!');
        setEditingGoal(null);
        setIsAddModalOpen(false);
        refetch();
      } else toast.error('Cập nhật thất bại!');
    } else {
      // Logic Thêm mới
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
    }
  };

  const startEdit = (goal) => {
    setEditingGoal(goal);
    setNewTitle(goal.title);
    setNewTarget(goal.target_amount.toString());
    setNewCurrent(goal.current_amount.toString());
    setIsAddModalOpen(true);
  };

  const handleQuickContribute = async (e) => {
    e.preventDefault();
    if (!contributingGoal || !extraAmount) return;

    const extra = parseInt(extraAmount.toString().replace(/[^\d]/g, ''), 10);
    const newTotal = contributingGoal.current_amount + extra;

    const ok = await updateGoalProgress(contributingGoal.id, newTotal);
    if (ok) {
      toast.success(`Đã gửi thêm ${fmt(extra)} vào mục tiêu!`);
      setContributingGoal(null);
      setExtraAmount('0');
    } else toast.error('Cập nhật thất bại!');
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
              <div className="absolute top-4 right-4 flex gap-2 invisible group-hover:visible transition-all">
                <button 
                  onClick={() => startEdit(goal)}
                  className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                  title="Chỉnh sửa"
                >
                  <Pencil size={16} />
                </button>
                <button 
                  onClick={() => setDeletingGoal(goal)}
                  className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                  title="Xóa"
                >
                  <Trash2 size={16} />
                </button>
              </div>

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

                <button 
                  onClick={() => { setContributingGoal(goal); setExtraAmount('0'); }}
                  className="w-full mt-2 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Gửi thêm tiết kiệm
                </button>
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
            <button onClick={() => { setIsAddModalOpen(false); setEditingGoal(null); }} className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors"><X size={24} /></button>
            <h3 className="text-2xl font-black text-gray-900 mb-6">{editingGoal ? 'Cập nhật mục tiêu' : 'Mục tiêu của bạn là gì?'}</h3>
            
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
                  <label className="block text-sm font-bold text-gray-700 mb-2">Đã tiết kiệm được (VND)</label>
                  <VndInput required value={newCurrent} onChange={setNewCurrent}
                    className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-all font-medium" />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingGoal(null); }}
                  className="flex-1 px-6 py-3.5 text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-xl font-bold transition-all">Quay lại</button>
                <button type="submit"
                  className="flex-1 px-6 py-3.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200">
                    {editingGoal ? 'Lưu thay đổi' : 'Bắt đầu tiết kiệm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CỘNG THÊM TIỀN TIẾT KIỆM */}
      {contributingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-60 px-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 relative">
            <button onClick={() => setContributingGoal(null)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors"><X size={24} /></button>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mb-4">
                <TrendingUp size={32} />
              </div>
              <h3 className="text-xl font-black text-gray-900 line-clamp-1">{contributingGoal.title}</h3>
              <p className="text-sm text-gray-500 mt-1">Gửi thêm tiết kiệm dự phòng</p>
            </div>

            <form onSubmit={handleQuickContribute} className="space-y-6">
              <div>
                <label className="block text-center text-sm font-bold text-gray-700 mb-2">Số tiền muốn cộng thêm (VND)</label>
                <VndInput autoFocus required value={extraAmount} onChange={setExtraAmount}
                  className="w-full text-center text-2xl font-black text-indigo-600 border-b-2 border-gray-100 py-2 outline-none focus:border-indigo-500 transition-all bg-transparent" />
              </div>

              <button type="submit"
                className="w-full py-4 text-white bg-green-500 hover:bg-green-600 rounded-2xl font-bold transition-all shadow-lg shadow-green-100 flex items-center justify-center gap-2">
                <Save size={20} /> Xác nhận gửi
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA */}
      {deletingGoal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900 bg-opacity-60 px-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-8 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Xác nhận xóa?</h3>
            <p className="text-sm text-gray-500 mb-6 font-medium">Bạn có chắc muốn xóa mục tiêu "{deletingGoal.title}" không?</p>
            
            <div className="flex gap-3">
              <button onClick={() => setDeletingGoal(null)} className="flex-1 py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl font-bold transition-all">Hủy</button>
              <button 
                onClick={async () => {
                  const ok = await deleteGoal(deletingGoal.id);
                  if (ok) toast.success('Đã xóa mục tiêu!');
                  else toast.error('Xóa thất bại!');
                  setDeletingGoal(null);
                }}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-100"
              >
                Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
