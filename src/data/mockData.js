import realData from './realData.json';

// Gộp giao dịch từ email (realData.json) + giao dịch thủ công (localStorage)
const getManuals = () => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('manualTransactions')) || []; }
    catch { return []; }
};

export const allTransactions = [...(realData || []), ...getManuals()];

// Áp đè phân loại thủ công từ người dùng
const savedStr = typeof window !== 'undefined' ? localStorage.getItem('userCategories') : null;
const userOverrides = savedStr ? JSON.parse(savedStr) : {};
allTransactions.forEach(tx => {
    if (userOverrides[tx.id]) tx.category = userOverrides[tx.id];
});

// Lấy 5 giao dịch gần nhất để hiển thị ở Dashboard
export const recentTransactions = allTransactions.slice(0, 5);
