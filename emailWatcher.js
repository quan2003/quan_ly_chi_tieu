import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import http from 'http';

dotenv.config();

// Cấu hình linh hoạt
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 phút quét backup nếu IDLE lỗi
const SELF_PING_MS = 5 * 60 * 1000;   // 5 phút ping chính mình để chống ngủ
const port = process.env.PORT || 3000;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// --- LOGIC TỰ PING (CHỐNG RENDER NGỦ ĐÔNG) ---
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
setInterval(() => {
    const url = RENDER_URL.startsWith('http') ? RENDER_URL : `https://${RENDER_URL}`;
    http.get(url, (res) => {
        console.log(`[${new Date().toLocaleTimeString()}] 💓 Health Check (Ping): ${res.statusCode}`);
    }).on('error', (err) => {
        console.error('⚠️ Lỗi tự ping:', err.message);
    });
}, SELF_PING_MS);

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

// Regex cải tiến để bắt chính xác hơn
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

        // Phân loại nâng cao
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
        console.error('❌ Lỗi parse email UID:', uid, err.message);
        return null;
    }
}

// Hàm sync sử dụng client hiện hữu thay vì tạo client mới
async function syncEmails(client) {
    const nowStr = new Date().toLocaleTimeString('vi-VN');
    process.stdout.write(`[${nowStr}] 🔍 Đang quét email...`);

    try {
        const since = new Date();
        since.setDate(since.getDate() - 3); // Quét 3 ngày gần nhất

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
            
            if (error) {
                console.log(` ❌ Lỗi Supabase: ${error.message}`);
            } else {
                console.log(` ✅ Đã đồng bộ ${results.length} giao dịch.`);
            }
        } else {
            console.log(' ℹ️ Không có giao dịch mới.');
        }
    } catch (err) {
        console.log(` ❌ Lỗi Sync: ${err.message}`);
    }
}

async function startWatcher() {
    console.log('🚀 Dịch vụ Email Watcher đang khởi động...');
    
    if (!config.auth.user || !config.auth.pass) {
        console.error('❌ LỖI: Thiếu email hoặc mật khẩu app trong .env');
        process.exit(1);
    }

    const client = new ImapFlow(config);

    const connectAndListen = async () => {
        try {
            console.log('🔗 Đang kết nối tới IMAP server...');
            await client.connect();
            console.log('🔓 Đã kết nối! Đang chế độ REAL-TIME (IDLE).');

            await client.mailboxOpen('INBOX');

            // Chạy sync lần đầu
            await syncEmails(client);

            // Lắng nghe mail mới
            client.once('exists', async () => {
                console.log(`\n[${new Date().toLocaleTimeString()}] 🔔 Có mail mới!`);
                await syncEmails(client);
                // Sau khi xong thì reset listener để lắng nghe tiếp (imapflow recommend once cho exists)
                setupExistsListener();
            });

            const setupExistsListener = () => {
                client.once('exists', async () => {
                    console.log(`\n[${new Date().toLocaleTimeString()}] 🔔 Có mail mới!`);
                    await syncEmails(client);
                    setupExistsListener();
                });
            };

        } catch (err) {
            console.error('❌ Lỗi kết nối IMAP:', err.message);
            console.log('🔄 Sẽ thử lại sau 30 giây...');
            setTimeout(connectAndListen, 30000);
        }
    };

    // Keep alive bằng NOOP
    setInterval(async () => {
        if (client.usable) {
            try {
                await client.noop();
            } catch (e) {
                console.log('⚠️ Kết nối bị treo, đang kết nối lại...');
                await connectAndListen();
            }
        } else {
            await connectAndListen();
        }
    }, 2 * 60 * 1000); // 2 phút noop 1 lần

    // Backup Sync mỗi 30 phút phòng trường hợp IDLE miss
    setInterval(async () => {
        if (client.usable) {
            await syncEmails(client);
        }
    }, 30 * 60 * 1000);

    await connectAndListen();
}

// Cải tiến Health Check Server (Trả lời 200 cho MỌI path để chống 404 trên Render)
http.createServer((req, res) => {
    console.log(`[HTTP] ${req.method} ${req.url} - Trả lời: 200 OK`);
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Spending Manager (Email Watcher) is ACTIVE 💓');
}).listen(port, () => {
    console.log(`📡 Health-check server listening on port ${port}`);
});

startWatcher();
