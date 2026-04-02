import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const config = {
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    },
    logger: false
};

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const moneyRegex = /(?:Số tiền(?! khả dụng)|Giao dịch|Phát sinh Nợ|Phát sinh Có|Số tiền GD|vừa tăng|vừa giảm|biến động)\s*[:]*\s*([+-]?\s*[0-9\.\,]+)\s*(?:VND|VNĐ|đ)?/i;
const descRegex = /(?:Nội dung(?: giao dịch)?|Ghi chú|Chi tiết|Nội dung GD|Mô tả)\s*[:]*\s*([^\.\n\r]+)/i;

async function processEmail(source, uid) {
    try {
        const parsed = await simpleParser(source);
        const text = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ') : '') || '';

        let content = parsed.subject || 'Không có tiêu đề';
        let type = 'expense';
        let amount = 0;

        const moneyMatch = text.match(moneyRegex);
        if (moneyMatch && moneyMatch[1]) {
            const amountStr = moneyMatch[1].replace(/[^\d\+\-]/g, '');
            amount = parseInt(amountStr, 10);
            const matchContext = moneyMatch[0].toLowerCase();
            if (matchContext.includes('nợ') || matchContext.includes('giảm') || matchContext.includes('-')) type = 'expense';
            else if (matchContext.includes('có') || matchContext.includes('tăng') || matchContext.includes('+')) type = 'income';
            amount = Math.abs(amount);
        }

        const descMatch = text.match(descRegex);
        if (descMatch && descMatch[1]) content = descMatch[1].trim();

        let finalCategory = 'Kinh doanh / Khác';
        if (type === 'income') {
            finalCategory = 'Thu nhập';
        } else {
            const t = content.toLowerCase();
            const foodKeywords = ['an', 'com', 'bun', 'pho', 'bep', 'quan an', 'nha hang', 'cafe', 'coffee', 'tra sua', 'banh', 'food', 'bakery', 'pizz', 'nha hang'];
            const shopKeywords = ['shopee', 'lazada', 'tiktok', 'mua hang', 'sieu thi', 'clothing', 'fashion', 'ao ', 'quan ', 'mall', 'tiki'];
            const transportKeywords = ['xang', 'grab', 'gojek', 'xe om', 'taxi', 'be ', 'xanh sm', 'petrolimex', 'xe may', 'o to'];
            const homeKeywords = ['dien', 'nuoc', 'internet', 'tien nha', 'thue nha', 'mang', 'wifi', 'fpt', 'viettel', 'tro', 'phong tro'];
            const livingKeywords = ['chuyen tien', 'transfer', 'tiet kiem', 'tra no', 'sinh hoat', 'hoc phi', 'vien phi'];

            // Hàm kiểm tra từ khóa chính xác (không bị dính vào giữa từ khác)
            const check = (keywords) => keywords.some(k => {
                const regex = new RegExp(`\\b${k}\\b`, 'i');
                return regex.test(t);
            });

            if (check(shopKeywords)) finalCategory = 'Mua sắm';
            else if (check(foodKeywords)) finalCategory = 'Ăn uống';
            else if (check(transportKeywords)) finalCategory = 'Xăng xe';
            else if (check(homeKeywords)) finalCategory = 'Nhà cửa';
            else if (check(livingKeywords)) finalCategory = 'Sinh hoạt';
        }

        if (amount > 0) {
            return {
                id: uid.toString(),
                content,
                amount: type === 'expense' ? -amount : amount,
                date: parsed.date ? new Intl.DateTimeFormat('vi-VN').format(parsed.date) : 'Unknown',
                type,
                category: finalCategory
            };
        }
        return null;
    } catch (err) {
        console.error('Lỗi parse email UID:', uid, err.message);
        return null;
    }
}

async function runSync() {
    console.log('🔄 Bắt đầu đồng bộ Email qua GitHub Action...');
    const client = new ImapFlow(config);
    try {
        await client.connect();
        await client.mailboxOpen('INBOX');

        const since = new Date();
        since.setDate(since.getDate() - 3); // Lùi 3 ngày

        const results = [];
        for await (let msg of client.fetch({ since }, { source: true, uid: true })) {
            if (msg.source) {
                const tx = await processEmail(msg.source, msg.uid);
                if (tx) results.push(tx);
            }
        }

        if (results.length > 0) {
            const { error } = await supabase
                .from('transactions')
                .upsert(results, { onConflict: 'id', ignoreDuplicates: true });
            
            if (error) console.error('❌ Supabase Error:', error.message);
            else console.log(`✅ Thành công! Đã cập nhật ${results.length} giao dịch.`);
        } else {
            console.log('ℹ️ Không có giao dịch mới trong 3 ngày qua.');
        }

    } catch (err) {
        console.error('❌ Lỗi hệ thống:', err.message);
        process.exit(1);
    } finally {
        await client.logout();
        console.log('🆗 Hoàn tất đồng bộ.');
    }
}

runSync();
