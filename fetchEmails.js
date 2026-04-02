import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

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

// Regex nhận diện các thông báo ngân hàng phổ biến (bao gồm Timo)
const moneyRegex = /(?:Số tiền(?! khả dụng)|Giao dịch|Phát sinh Nợ|Phát sinh Có|Số tiền GD|vừa tăng|vừa giảm)\s*[:]*\s*([+-]?\s*[0-9\.\,]+)\s*(?:VND|VNĐ|đ)?/i;
const descRegex = /(?:Nội dung(?: giao dịch)?|Ghi chú|Chi tiết|Nội dung GD|Mô tả)\s*[:]*\s*([^\.\n\r]+)/i;

async function processEmail(source, uid) {
    try {
        const parsed = await simpleParser(source);
        // Lấy text, nếu email chỉ có HTML thì loại bỏ các thẻ HTML để lấy nội dung thô
        const text = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ') : '') || '';
        
        let amountStr = null;
        let content = parsed.subject || 'Không có tiêu đề';
        let type = 'expense';
        let amount = 0;

        const moneyMatch = text.match(moneyRegex);
        if (moneyMatch && moneyMatch[1]) {
            amountStr = moneyMatch[1].replace(/[^\d\+\-]/g, ''); 
            amount = parseInt(amountStr, 10);
            
            const matchContext = moneyMatch[0].toLowerCase();
            // Xử lý type (Thu / Chi)
            if (matchContext.includes('nợ') || matchContext.includes('giảm') || matchContext.includes('-')) {
                type = 'expense';
            } else if (matchContext.includes('có') || matchContext.includes('tăng') || matchContext.includes('+')) {
                type = 'income';
            } else {
                type = 'expense'; // default fallback
            }

            amount = Math.abs(amount);
        }

        const descMatch = text.match(descRegex);
        if (descMatch && descMatch[1]) {
            content = descMatch[1].trim();
        }

        let finalCategory = 'Kinh doanh / Khác';
        if (type === 'income') {
            finalCategory = 'Thu nhập';
        } else {
            const textToLower = content.toLowerCase();
            if (textToLower.includes('shopee') || textToLower.includes('tiktok') || textToLower.includes('mua sắm') || textToLower.includes('siêu thị') || textToLower.includes('lazada') || textToLower.includes('clothes')) finalCategory = 'Mua sắm';
            else if (textToLower.includes('ăn') || textToLower.includes('phở') || textToLower.includes('bun') || textToLower.includes('cafe') || textToLower.includes('food') || textToLower.includes('nhà hàng')) finalCategory = 'Ăn uống';
            else if (textToLower.includes('xăng') || textToLower.includes('xe') || textToLower.includes('grab') || textToLower.includes('be ') || textToLower.includes('gojek')) finalCategory = 'Xăng xe';
            else if (textToLower.includes('điện') || textToLower.includes('nước') || textToLower.includes('thuê nhà') || textToLower.includes('internet') || textToLower.includes('mạng')) finalCategory = 'Nhà cửa';
            else if (textToLower.includes('chuyen tien') || textToLower.includes('chuyển tiền')) finalCategory = 'Sinh hoạt';
        }

        if (amount > 0) {
            return {
                id: uid.toString(),
                content: content,
                amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
                date: parsed.date ? new Intl.DateTimeFormat('vi-VN').format(parsed.date) : 'Unknown',
                type: type,
                category: finalCategory
            };
        }
        return null; // Không có thông tin giao dịch
    } catch (err) {
        console.error('Error parsing email UID:', uid, err);
        return null;
    }
}

async function main() {
    console.log("Bắt đầu kết nối tới Email Server...");
    if (!config.auth.user || !config.auth.pass) {
        console.error("LỖI: Chưa cấu hình EMAIL_USER hoặc EMAIL_PASSWORD trong file .env");
        process.exit(1);
    }

    const client = new ImapFlow(config);
    try {
        await client.connect();
        console.log("Kết nối thành công. Đang chọn hộp thư INBOX...");
        
        let lock = await client.getMailboxLock('INBOX');
        try {
            // Lùi lại 1-2 ngày để tránh lỗi timezone UTC
            const searchCriteria = { since: new Date('2026-03-30T00:00:00Z') };
            console.log("Đang tìm kiếm email từ ngày 30/03/2026...");
            
            // Sử dụng seq numbers để fetch nội dung
            let results = [];
            
            // Generate sequence list
            for await (let msg of client.fetch(searchCriteria, { source: true, uid: true })) {
                if(msg.source) {
                    const parsedTx = await processEmail(msg.source, msg.uid);
                    if (parsedTx) {
                        results.push(parsedTx);
                    }
                }
            }

            console.log(`Tìm thấy và phân tích được ${results.length} giao dịch.`);
            
            if(results.length > 0) {
                // Sắp xếp giảm dần theo id/date
                results.reverse();
                
                const realDataPath = path.join(process.cwd(), 'src', 'data', 'realData.json');
                fs.writeFileSync(realDataPath, JSON.stringify(results, null, 2), 'utf-8');
                console.log(`Đã xuất dữ liệu thành công vào tệp: ${realDataPath}`);
                console.log(`Vui lòng cập nhật src/data/mockData.js sang import file này nhé!`);
            } else {
                 console.log("Không tìm thấy email thông báo số dư nào hợp lệ.");
            }

        } finally {
            lock.release();
        }
    } catch (err) {
        console.error('Đã có lỗi xảy ra:', err);
    } finally {
        await client.logout();
        console.log("Đã đăng xuất khỏi Email Server.");
    }
}

main().catch(err => console.error(err));
