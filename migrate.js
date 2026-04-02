import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function migrate() {
  console.log('🚀 Bắt đầu migrate dữ liệu lên Supabase...');

  // 1. Migrate transactions
  const realDataPath = path.join(process.cwd(), 'src', 'data', 'realData.json');
  if (fs.existsSync(realDataPath)) {
    const transactions = JSON.parse(fs.readFileSync(realDataPath, 'utf-8'));
    if (transactions.length > 0) {
      const { error } = await supabase
        .from('transactions')
        .upsert(transactions, { onConflict: 'id', ignoreDuplicates: true });
      if (error) console.error('❌ Lỗi migrate transactions:', error.message);
      else console.log(`✅ Đã upload ${transactions.length} giao dịch từ email!`);
    }
  }

  // 2. Migrate manual transactions từ localStorage (không thể truy cập trực tiếp, bỏ qua)
  console.log('ℹ️  Giao dịch thủ công trong localStorage sẽ không migrate được (chỉ có trong trình duyệt)');

  // 3. Migrate budgets từ budgetConfigs localStorage (hardcode default nếu không có)
  const defaultBudgets = [
    { category: 'Ăn uống', amount: 4000000 },
    { category: 'Xăng xe', amount: 1000000 },
    { category: 'Mua sắm', amount: 2500000 },
    { category: 'Nhà cửa', amount: 3000000 },
    { category: 'Kinh doanh / Khác', amount: 2000000 },
    { category: 'Sinh hoạt', amount: 2000000 },
  ];

  const { error: budgetError } = await supabase
    .from('budgets')
    .upsert(defaultBudgets, { onConflict: 'category', ignoreDuplicates: true });

  if (budgetError) console.error('❌ Lỗi migrate budgets:', budgetError.message);
  else console.log(`✅ Đã tạo ${defaultBudgets.length} ngân sách mặc định!`);

  console.log('');
  console.log('🎉 Migrate hoàn tất! Truy cập http://localhost:5173 để kiểm tra.');
}

migrate().catch(console.error);
