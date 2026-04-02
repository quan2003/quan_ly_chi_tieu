/**
 * Đọc danh sách phân loại từ ngân sách người dùng đã tạo (localStorage).
 * Luôn kèm "Thu nhập" ở cuối để dùng chung.
 */
export function getCategories() {
  try {
    const raw = localStorage.getItem('budgetConfigs');
    const configs = raw ? JSON.parse(raw) : {};
    const cats = Object.keys(configs);
    // Đảm bảo "Thu nhập" luôn có mặt
    if (!cats.includes('Thu nhập')) cats.push('Thu nhập');
    return cats;
  } catch {
    return ['Ăn uống', 'Xăng xe', 'Mua sắm', 'Nhà cửa', 'Kinh doanh / Khác', 'Thu nhập'];
  }
}
