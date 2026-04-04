import React, { useState, useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Wallet, Calendar } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { useTransactions } from '../hooks/useTransactions';
import { useBudgets } from '../hooks/useBudgets';
import { TrendingUp, TrendingDown, Target, Info } from 'lucide-react';
import toast from 'react-hot-toast';

const MONTHS_VI = ['Th.1','Th.2','Th.3','Th.4','Th.5','Th.6','Th.7','Th.8','Th.9','Th.10','Th.11','Th.12'];

export default function Dashboard() {
  const [chartMode, setChartMode] = useState('month');
  const { transactions, loading } = useTransactions();
  const { budgets } = useBudgets();

  const fmt = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);
  const fmtShort = (val) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
    return val;
  };

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const thisMonthTxs = useMemo(() => transactions.filter(tx => {
    const parts = tx.date.split('/');
    return parseInt(parts[1]) === currentMonth && (parseInt(parts[2] || currentYear) === currentYear || parts.length < 3);
  }), [transactions, currentMonth]);

  const totalIncome = thisMonthTxs.filter(t => t.type === 'income').reduce((a, b) => a + Math.abs(b.amount), 0);
  const totalExpense = thisMonthTxs.filter(t => t.type === 'expense').reduce((a, b) => a + Math.abs(b.amount), 0);
  const totalBalance = totalIncome - totalExpense;

  const monthlyDailyData = useMemo(() => {
    const map = {};
    [...thisMonthTxs].reverse().forEach(tx => {
      const day = tx.date.split('/')[0];
      const key = `${day.padStart(2,'0')}/${String(currentMonth).padStart(2,'0')}`;
      if (!map[key]) map[key] = { date: key, income: 0, expense: 0 };
      if (tx.type === 'income') map[key].income += Math.abs(tx.amount);
      else map[key].expense += Math.abs(tx.amount);
    });
    return Object.values(map).sort((a, b) => parseInt(a.date) - parseInt(b.date));
  }, [thisMonthTxs]);

  const yearlyMonthData = useMemo(() => {
    return MONTHS_VI.map((label, i) => {
      const m = i + 1;
      const txs = transactions.filter(tx => {
        const p = tx.date.split('/');
        return parseInt(p[1]) === m && (parseInt(p[2] || currentYear) === currentYear);
      });
      return {
        date: label,
        income: txs.filter(t => t.type === 'income').reduce((a, b) => a + Math.abs(b.amount), 0),
        expense: txs.filter(t => t.type === 'expense').reduce((a, b) => a + Math.abs(b.amount), 0),
      };
    });
  }, [transactions, currentYear]);

  // --- LOGIC PHÂN TÍCH XU HƯỚNG ---
  const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  
  const lastMonthTxs = useMemo(() => transactions.filter(tx => {
    const p = tx.date.split('/');
    return parseInt(p[1]) === lastMonth && parseInt(p[2] || lastMonthYear) === lastMonthYear;
  }), [transactions, lastMonth, lastMonthYear]);

  const lastMonthExpense = lastMonthTxs.filter(t => t.type === 'expense').reduce((a, b) => a + Math.abs(b.amount), 0);
  const expenseDiffPercent = lastMonthExpense > 0 
    ? ((totalExpense - lastMonthExpense) / lastMonthExpense * 100).toFixed(1)
    : 0;
  
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : 0;

  // --- HỆ THỐNG THÔNG BÁO NGÂN SÁCH ---
  React.useEffect(() => {
    if (budgets.length === 0 || thisMonthTxs.length === 0) return;

    const sendBrowserNotification = async (msg) => {
      try {
        if (!('Notification' in window)) return;

        // ✋ Chỉ gửi thông báo hệ thống khi user ĐANG mở app
        // Nếu tab bị ẩn hoặc cửa sổ không focus → KHÔNG gửi, chỉ dùng toast
        const isAppVisible = document.visibilityState === 'visible' && document.hasFocus();
        if (!isAppVisible) return;

        let permission = Notification.permission;
        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }
        if (permission === 'granted') {
          new Notification('Quản lý chi tiêu', { body: msg });
        }
      } catch (err) {
        console.warn('Notification error:', err);
      }
    };

    budgets.forEach(b => {
      const spent = thisMonthTxs
        .filter(tx => tx.category === b.category && tx.type === 'expense')
        .reduce((a, c) => a + Math.abs(c.amount), 0);

      const ratio = (spent / b.amount) * 100;

      if (ratio >= 80) {
        const msg = `⚠️ Hạn mức [${b.category}] đã ${ratio >= 100 ? 'vượt' : 'đạt'} ${ratio.toFixed(0)}%!`;

        // Toast luôn hiện khi đang trong app
        if (ratio >= 100) toast.error(msg, { id: `alert-${b.category}` });
        else toast(msg, { icon: '🔔', id: `alert-${b.category}` });

        // Browser notification: chỉ khi đang mở app
        sendBrowserNotification(msg);
      }
    });
  }, [budgets, thisMonthTxs]);

  const recentTransactions = transactions.slice(0, 5);

  const chartData = chartMode === 'month'
    ? (monthlyDailyData.length ? monthlyDailyData : [{ date: 'Hôm nay', income: 0, expense: 0 }])
    : yearlyMonthData;

  const chartTitle = chartMode === 'month'
    ? `Dòng tiền tháng ${currentMonth}/${currentYear}`
    : `So sánh Thu/Chi từng tháng ${currentYear}`;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500 animate-pulse">Đang tải dữ liệu...</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Số dư tháng {currentMonth}</p>
              <h3 className={`text-2xl font-bold mt-1 ${totalBalance >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                {fmt(totalBalance)}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
              <Wallet size={20} />
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Tổng thu tháng {currentMonth}</p>
              <h3 className="text-2xl font-bold text-green-500 mt-1">+{fmt(totalIncome)}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-500">
              <ArrowUpRight size={20} />
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Tổng chi tháng {currentMonth}</p>
              <h3 className="text-2xl font-bold text-red-500 mt-1">-{fmt(totalExpense)}</h3>
              <p className={`text-xs mt-2 flex items-center gap-1 ${parseFloat(expenseDiffPercent) <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {parseFloat(expenseDiffPercent) <= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                {Math.abs(expenseDiffPercent)}% so với tháng trước
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
              <ArrowDownRight size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* TREND ANALYSIS PANEL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-2xl shadow-md text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Target size={24} />
            </div>
            <h2 className="text-lg font-bold">Hiệu quả tiết kiệm</h2>
          </div>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-4xl font-black">{savingsRate}%</span>
            <span className="mb-2 text-blue-100 text-sm">thu nhập được giữ lại</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-3 mb-4 overflow-hidden">
            <div className="bg-green-400 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }}></div>
          </div>
          <p className="text-sm text-blue-100 leading-relaxed italic">
            {savingsRate > 30 ? "🔥 Tuyệt vời! Bạn đang tiết kiệm rất tốt." : "💡 Hãy cố gắng kiểm soát các khoản chi không cần thiết nhé."}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-orange-50 rounded-lg text-orange-500">
              <Info size={24} />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Cảnh báo Ngân sách</h2>
          </div>
          <div className="space-y-4">
            {budgets.slice(0, 3).map(b => {
              const spent = thisMonthTxs
                .filter(tx => tx.category === b.category && tx.type === 'expense')
                .reduce((a, c) => a + Math.abs(c.amount), 0);
              const ratio = Math.min(100, (spent / b.amount) * 100);
              return (
                <div key={b.category}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-gray-700">{b.category}</span>
                    <span className={`font-bold ${ratio >= 90 ? 'text-red-500' : 'text-gray-500'}`}>{ratio.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`h-full rounded-full transition-all ${ratio >= 100 ? 'bg-red-500' : ratio >= 80 ? 'bg-orange-400' : 'bg-blue-500'}`} style={{ width: `${ratio}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-gray-800">{chartTitle}</h2>
            <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
              <button onClick={() => setChartMode('month')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${chartMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Tháng này</button>
              <button onClick={() => setChartMode('yearly')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${chartMode === 'yearly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Cả năm</button>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === 'month' ? (
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill:'#6B7280',fontSize:11}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill:'#6B7280',fontSize:11}} tickFormatter={fmtShort} dx={-5} />
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{borderRadius:'8px',border:'none',boxShadow:'0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Legend iconType="circle" wrapperStyle={{paddingTop:'20px'}} />
                  <Line type="monotone" name="Thu nhập" dataKey="income" stroke="#22c55e" strokeWidth={3} dot={{r:4}} activeDot={{r:6}} />
                  <Line type="monotone" name="Chi tiêu" dataKey="expense" stroke="#ef4444" strokeWidth={3} dot={{r:4}} activeDot={{r:6}} />
                </LineChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill:'#6B7280',fontSize:11}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill:'#6B7280',fontSize:11}} tickFormatter={fmtShort} dx={-5} />
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{borderRadius:'8px',border:'none',boxShadow:'0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Legend iconType="square" wrapperStyle={{paddingTop:'20px'}} />
                  <Bar name="Thu nhập" dataKey="income" fill="#22c55e" radius={[4,4,0,0]} maxBarSize={28} />
                  <Bar name="Chi tiêu" dataKey="expense" fill="#ef4444" radius={[4,4,0,0]} maxBarSize={28} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-800">Giao dịch gần nhất</h2>
          </div>
          <div className="space-y-4">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'income' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
                    {tx.type === 'income' ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-800 line-clamp-1 max-w-[130px]">{tx.content}</h4>
                    <p className="text-xs text-gray-400">{tx.date}</p>
                  </div>
                </div>
                <div className={`text-sm font-bold shrink-0 ${tx.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                  {tx.type === 'income' ? '+' : ''}{fmt(tx.amount)}
                </div>
              </div>
            ))}
            {recentTransactions.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-4">Chưa có giao dịch nào</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
