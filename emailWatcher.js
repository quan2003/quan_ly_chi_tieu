import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 phút

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // dùng service key cho Node.js (không phải anon key)
);

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

const moneyRegex = /(?:Số tiền(?! khả dụng)|Giao dịch|Phát sinh Nợ|Phát sinh Có|Số tiền GD|vừa tăng|vừa giảm)\s*[:]*\s*([+-]?\s*[0-9\.\,]+)\s*(?:VND|VNĐ|đ)?/i;
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
            // Có dấu
            const hasAccent =
                t.includes('ăn') || t.includes('cafe') || t.includes('food') || t.includes('nhà hàng') ||
                t.includes('com ') || t.includes('bun ') || t.includes('pho');

            // Không dấu (Timo thường gửi không dấu)
            const noAccentFood = /\ban\b|com|bun|pho|bep|quan an|nha hang|cafe|coffee|tra sua|banh/.test(t);
            const noAccentShop = /shopee|lazada|tiktok|mua hang|sieu thi|grab food|baemin/.test(t);
            const noAccentFuel = /xang|grab (bike|car)|gojek|xe om|taxi|be /.test(t);
            const noAccentBill = /dien|nuoc|internet|tien nha|thue nha|mang/.test(t);
            const noAccentTransfer = /chuyen tien|ck |ck$|transfer/.test(t);

            if (noAccentShop || t.includes('shopee') || t.includes('tiktok') || t.includes('lazada')) finalCategory = 'Mua sắm';
            else if (hasAccent || noAccentFood) finalCategory = 'Ăn uống';
            else if (noAccentFuel || t.includes('xăng') || t.includes('grab') || t.includes('gojek')) finalCategory = 'Xăng xe';
            else if (noAccentBill || t.includes('điện') || t.includes('nước') || t.includes('internet')) finalCategory = 'Nhà cửa';
            else if (noAccentTransfer || t.includes('chuyển tiền')) finalCategory = 'Sinh hoạt';
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

async function fetchAndUpdate() {
    const client = new ImapFlow(config);
    try {
        await client.connect();
        let lock = await client.getMailboxLock('INBOX');
        const results = [];
        try {
            // Lùi về 3 ngày trước để bắt hết email theo múi giờ
            const since = new Date();
            since.setDate(since.getDate() - 3);
            for await (let msg of client.fetch({ since }, { source: true, uid: true })) {
                if (msg.source) {
                    const tx = await processEmail(msg.source, msg.uid);
                    if (tx) results.push(tx);
                }
            }
        } finally {
            lock.release();
        }

        if (results.length > 0) {
            // Upsert vào Supabase (tránh trùng lặp dựa theo id = uid email)
            const { error } = await supabase
                .from('transactions')
                .upsert(results, { onConflict: 'id', ignoreDuplicates: true });
            if (error) {
                console.error('Supabase upsert error:', error.message);
                return -1;
            }
            return results.length;
        }
        return 0;
    } catch (err) {
        console.error('Lỗi kết nối:', err.message);
        return -1;
    } finally {
        try { await client.logout(); } catch {}
    }
}

async function getCurrentCount() {
    const { count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true });
    return count || 0;
}

async function runWatcher() {
    console.log('🚀 Email Watcher đã khởi động!');
    console.log(`📧 Tài khoản: ${config.auth.user}`);
    console.log(`⏱  Kiểm tra mỗi: ${POLL_INTERVAL_MS / 1000 / 60} phút`);
    console.log('─'.repeat(50));

    const check = async () => {
        const prevCount = await getCurrentCount();
        const now = new Date().toLocaleTimeString('vi-VN');
        process.stdout.write(`[${now}] Đang kiểm tra email mới...`);

        const count = await fetchAndUpdate();
        if (count < 0) {
            console.log(' ❌ Lỗi kết nối!');
        } else if (count > prevCount) {
            const newCount = count - prevCount;
            console.log(` ✅ Cập nhật ${newCount} giao dịch mới! (Tổng: ${count})`);
        } else {
            console.log(` Không có giao dịch mới (Tổng: ${count})`);
        }
    };

    // Chạy ngay lập tức lần đầu
    await check();

    // Sau đó lặp mỗi 2 phút
    setInterval(check, POLL_INTERVAL_MS);
}

// Kiểm tra credentials trước khi chạy
if (!config.auth.user || !config.auth.pass) {
    console.error('❌ LỖI: Chưa cấu hình EMAIL_USER hoặc EMAIL_PASSWORD trong file .env');
    process.exit(1);
}

runWatcher();
