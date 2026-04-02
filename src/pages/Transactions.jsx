import React, { useState } from 'react';
import { Search, Filter, ArrowUpRight, ArrowDownRight, Plus, X, Pencil, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import VndInput from '../components/VndInput';
import { useTransactions } from '../hooks/useTransactions';
import { useBudgets } from '../hooks/useBudgets';

export default function Transactions() {
  const { transactions, loading, addTransaction, updateCategory, updateContent } = useTransactions();
  const { budgets } = useBudgets();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterExactDate, setFilterExactDate] = useState('');

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualType, setManualType] = useState('expense');
  const [manualCategory, setManualCategory] = useState('');

  const fmt = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

  // Danh sách phân loại từ Supabase budgets
  const EXPENSE_CATEGORIES = budgets.map(b => b.category);
  const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, 'Thu nhập'];

  const handleCategoryChange = async (id, newCat) => {
    const ok = await updateCategory(id, newCat);
    if (ok) toast.success('Đã phân loại thành ' + newCat);
    else toast.error('Cập nhật thất bại!');
  };

  const startEdit = (tx) => {
    setEditingId(tx.id);
    setEditingText(tx.content);
  };

  const saveEdit = async (id) => {
    if (!editingText.trim()) return;
    const ok = await updateContent(id, editingText.trim());
    if (ok) toast.success('Đã cập nhật mô tả!');
    else toast.error('Cập nhật thất bại!');
    setEditingId(null);
  };

  const currentMonth = (new Date().getMonth() + 1).toString();

  const handleCreateTransaction = async (e) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualAmount) return;

    const pad = (n) => n < 10 ? '0' + n : n;
    const d = new Date();
    const dateFormatted = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const amt = parseInt(manualAmount, 10);

    const newTx = {
      id: 'manual_' + Date.now().toString(),
      content: manualTitle.trim(),
      amount: manualType === 'expense' ? -amt : amt,
      date: dateFormatted,
      type: manualType,
      category: manualType === 'income' ? 'Thu nhập' : (manualCategory || EXPENSE_CATEGORIES[0] || 'Kinh doanh / Khác'),
      source: 'manual'
    };

    const ok = await addTransaction(newTx);
    if (ok) {
      setIsAddModalOpen(false);
      setManualTitle(''); setManualAmount(''); setManualType('expense'); setManualCategory('');
      toast.success('Đã thêm giao dịch thủ công!');
    } else {
      toast.error('Thêm giao dịch thất bại!');
    }
  };

  const parseDateForSort = (dateStr) => {
    if (!dateStr || dateStr === 'Unknown') return 0;
    const parts = dateStr.split('/');
    if (parts.length === 3) return parseInt(`${parts[2]}${parts[1].padStart(2, '0')}${parts[0].padStart(2, '0')}`, 10);
    return 0;
  };

  const filteredTransactions = transactions
    .filter(tx => {
      // Tìm theo nội dung hoặc ngày (vd gõ "2/4" sẽ ra)
      const matchSearch = tx.content.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (tx.date && tx.date.includes(searchTerm));
      const matchType = filterType === 'all' || tx.type === filterType;
      
      let matchMonth = true;
      if (filterMonth === 'current') {
        const txMonth = tx.date.split('/')[1] || '';
        matchMonth = parseInt(txMonth, 10) === parseInt(currentMonth, 10);
      }

      let matchExactDate = true;
      if (filterExactDate) {
        // filterExactDate is "yyyy-mm-dd", tx.date is "d/m/yyyy"
        const [y, m, d] = filterExactDate.split('-');
        const targetDate = `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;
        matchExactDate = tx.date === targetDate;
      }

      return matchSearch && matchType && matchMonth && matchExactDate;
    })
    .sort((a, b) => {
      // Ưu tiên hiển thị ngày mới nhất trên cùng
      const dDiff = parseDateForSort(b.date) - parseDateForSort(a.date);
      if (dDiff !== 0) return dDiff;
      // Dùng ID để sort phụ (do id chứa uid của mail hoặc timestamp nếu thủ công)
      return b.id.localeCompare(a.id);
    });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500 animate-pulse">Đang tải giao dịch...</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-800">Lịch sử giao dịch</h2>
        <button onClick={() => setIsAddModalOpen(true)} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
          <Plus size={18} /> Thêm giao dịch
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50/50">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Tìm tên hoặc ngày (vd: 1/4)..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <input 
              type="date" 
              title="Lọc theo ngày cụ thể"
              className="text-sm px-3 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg bg-white font-medium text-gray-700" 
              value={filterExactDate} 
              onChange={(e) => setFilterExactDate(e.target.value)}
            />

            <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-white shrink-0">
              <Filter size={16} className="text-gray-500 shrink-0" />
              <select className="text-sm bg-transparent border-none focus:ring-0 text-gray-700 font-medium cursor-pointer" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
                <option value="all">Tất cả tháng</option>
                <option value="current">Tháng này</option>
              </select>
              <div className="w-px h-4 bg-gray-300 mx-2 shrink-0"></div>
              <select className="text-sm bg-transparent border-none focus:ring-0 text-gray-700 font-medium cursor-pointer" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="all">Tất cả loại</option>
                <option value="income">Thu nhập</option>
                <option value="expense">Chi tiêu</option>
              </select>
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-100">
                <th className="px-6 py-4 font-medium">Loại</th>
                <th className="px-6 py-4 font-medium">Ngày</th>
                <th className="px-6 py-4 font-medium">Nội dung</th>
                <th className="px-6 py-4 font-medium">Phân loại</th>
                <th className="px-6 py-4 font-medium text-right">Số tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {tx.type === 'income' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{tx.date}</td>
                  <td className="px-6 py-4">
                    {editingId === tx.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          className="border border-blue-400 rounded px-2 py-1 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-blue-300 w-48"
                          value={editingText}
                          onChange={e => setEditingText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(tx.id); if (e.key === 'Escape') setEditingId(null); }}
                        />
                        <button onClick={() => saveEdit(tx.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={16} /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group/content">
                        <span className="font-medium text-gray-900">{tx.content}</span>
                        <button onClick={() => startEdit(tx)} className="opacity-0 group-hover/content:opacity-100 p-1 text-gray-400 hover:text-blue-600 transition-opacity" title="Sửa mô tả">
                          <Pencil size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <select value={tx.category || ''} onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                      className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium border-transparent focus:ring-0 cursor-pointer outline-none w-36">
                      {ALL_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </td>
                  <td className={`px-6 py-4 text-right font-bold ${tx.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                    {tx.type === 'income' ? '+' : ''}{fmt(tx.amount)}
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">Không tìm thấy giao dịch nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {filteredTransactions.map((tx) => (
            <div key={tx.id} className="p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                {tx.type === 'income' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-semibold text-gray-900 truncate pr-2">{tx.content}</h4>
                  <span className={`font-bold shrink-0 ${tx.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                    {tx.type === 'income' ? '+' : ''}{fmt(tx.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500 mt-2">
                  <span>{tx.date}</span>
                  <select value={tx.category || ''} onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                    className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600 font-medium border-transparent focus:ring-0 outline-none w-32">
                    {ALL_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
          {filteredTransactions.length === 0 && (
            <div className="p-8 text-center text-gray-500">Không tìm thấy giao dịch nào.</div>
          )}
        </div>
      </div>

      {/* ADD MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 px-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 relative">
            <button onClick={() => setIsAddModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X size={20} /></button>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Ghi chép giao dịch</h3>
            <form onSubmit={handleCreateTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại & Phân loại</label>
                <div className="flex gap-2">
                  <select value={manualType} onChange={e => setManualType(e.target.value)}
                    className="w-1/3 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="expense">Chi tiêu</option>
                    <option value="income">Thu nhập</option>
                  </select>
                  <select value={manualCategory} onChange={e => setManualCategory(e.target.value)}
                    disabled={manualType === 'income'}
                    className={`w-2/3 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 ${manualType === 'income' ? 'bg-gray-100 text-gray-500' : ''}`}>
                    {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung</label>
                <input type="text" autoFocus required placeholder="Ví dụ: Ăn trưa..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  value={manualTitle} onChange={e => setManualTitle(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền (VND)</label>
                <VndInput required value={manualAmount} onChange={setManualAmount}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors">Hủy</button>
                <button type="submit"
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">Ghi chép</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
