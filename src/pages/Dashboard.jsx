import React, { useState, useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Wallet, Calendar } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { useTransactions } from '../hooks/useTransactions';

const MONTHS_VI = ['Th.1','Th.2','Th.3','Th.4','Th.5','Th.6','Th.7','Th.8','Th.9','Th.10','Th.11','Th.12'];

export default function Dashboard() {
  const [chartMode, setChartMode] = useState('month');
  const { transactions, loading } = useTransactions();

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
      const txs = transactions.filter(tx => parseInt(tx.date.split('/')[1]) === m);
      return {
        date: label,
        income: txs.filter(t => t.type === 'income').reduce((a, b) => a + Math.abs(b.amount), 0),
        expense: txs.filter(t => t.type === 'expense').reduce((a, b) => a + Math.abs(b.amount), 0),
      };
    });
  }, [transactions]);

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
            </div>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
              <ArrowDownRight size={20} />
            </div>
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
