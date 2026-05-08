const express = require('express');
const axios = require('axios');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3000;

// ==================== 10 GAME HOÀN CHỈNH ====================
const GAMES = {
    // LC79 - 2 bàn
    lc79_tx: {
        name: 'LC79 Tài Xỉu',
        api_url: 'https://wtx.tele68.com/v1/tx/sessions',
        type: 'tele68_format',
        active: true,
        history_file: 'history_lc79_tx.json'
    },
    lc79_md5: {
        name: 'LC79 MD5',
        api_url: 'https://wtxmd52.tele68.com/v1/txmd5/sessions',
        type: 'tele68_format',
        active: true,
        history_file: 'history_lc79_md5.json'
    },
    // BETVIP - 2 bàn
    betvip_tx: {
        name: 'BETVIP Tài Xỉu',
        api_url: 'https://wtx.macminim6.online/v1/tx/sessions',
        type: 'tele68_format',
        active: true,
        history_file: 'history_betvip_tx.json'
    },
    betvip_md5: {
        name: 'BETVIP MD5',
        api_url: 'https://wtxmd52.macminim6.online/v1/txmd5/sessions',
        type: 'tele68_format',
        active: true,
        history_file: 'history_betvip_md5.json'
    },
    // XOCDIA88 - 2 bàn
    xocdia88_tx: {
        name: 'XocDia88 Tài Xỉu',
        api_url: 'https://taixiu.system32-cloudfare-356783752985678522.monster/api/luckydice/GetSoiCau',
        type: 'xocdia_format',
        active: true,
        history_file: 'history_xocdia88_tx.json'
    },
    xocdia88_md5: {
        name: 'XocDia88 MD5',
        api_url: 'https://taixiumd5.system32-cloudfare-356783752985678522.monster/api/md5luckydice/GetSoiCau',
        type: 'xocdia_format',
        active: true,
        history_file: 'history_xocdia88_md5.json'
    },
    // HITCLUB (thay sunwin)
    hitclub: {
        name: 'HITCLUB',
        api_url: 'https://sun-win.onrender.com/api/history',
        type: 'sun_format',
        active: true,
        history_file: 'history_hitclub.json'
    },
    // B52
    b52: {
        name: 'B52',
        api_url: 'https://b52-qiw2.onrender.com/api/history',
        type: 'b52_format',
        active: true,
        history_file: 'history_b52.json'
    }
};

let predictionsDB = {};
for (const key of Object.keys(GAMES)) {
    predictionsDB[key] = [];
    try {
        if (fs.existsSync(GAMES[key].history_file)) {
            predictionsDB[key] = JSON.parse(fs.readFileSync(GAMES[key].history_file, 'utf8'));
            console.log(`✅ Loaded ${predictionsDB[key].length} records for ${GAMES[key].name}`);
        }
    } catch(e) {}
}

function saveHistory(gameKey) {
    try {
        fs.writeFileSync(GAMES[gameKey].history_file, JSON.stringify(predictionsDB[gameKey], null, 2));
    } catch(e) {}
}

// ==================== FETCH DATA ====================
async function fetchGameData(gameKey) {
    const game = GAMES[gameKey];
    if (!game || !game.active) return null;
    try {
        const res = await axios.get(game.api_url, { timeout: 10000 });
        
        if (game.type === 'tele68_format' && res.data?.list) {
            return res.data.list.map(item => ({
                phien: item.id, ket_qua: item.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu',
                x1: item.dices[0], x2: item.dices[1], x3: item.dices[2], tong: item.point
            }));
        }
        if (game.type === 'xocdia_format' && Array.isArray(res.data)) {
            return res.data.map(item => ({
                phien: item.SessionId, ket_qua: item.BetSide === 0 ? 'Tài' : 'Xỉu',
                x1: item.FirstDice, x2: item.SecondDice, x3: item.ThirdDice, tong: item.DiceSum
            }));
        }
        if (game.type === 'sun_format' && res.data?.taixiu) {
            return res.data.taixiu.map(item => ({
                phien: item.Phien, ket_qua: item.Ket_qua,
                x1: item.Xuc_xac_1, x2: item.Xuc_xac_2, x3: item.Xuc_xac_3, tong: item.Tong
            }));
        }
        if (game.type === 'b52_format' && res.data?.data) {
            return res.data.data.map(item => ({
                phien: item.Phien, ket_qua: item.Ket_qua,
                x1: item.Xuc_xac_1, x2: item.Xuc_xac_2, x3: item.Xuc_xac_3, tong: item.Tong
            }));
        }
        return null;
    } catch(e) { return null; }
}

// ==================== 80+ LOẠI CẦU THUẬT TOÁN CỰC DÀI ====================
function phatHienCau(history) {
    if (!history || history.length < 3) {
        return { prediction: 'Tài', confidence: 50, reason: '📊 Chưa đủ 3 phiên' };
    }

    const res = history.map(h => h.ket_qua);
    const sums = history.map(h => h.tong);
    const len = res.length;

    // ========== 1. CẦU BỆT (2-20 phiên) ==========
    for (let l = 2; l <= 20; l++) {
        if (len < l) continue;
        let ok = true;
        for (let i = 1; i < l; i++) if (res[i] !== res[0]) { ok = false; break; }
        if (ok) {
            let conf = Math.min(95, 48 + l * 2.8);
            return { prediction: res[0], confidence: Math.floor(conf), reason: `🔴 Bệt ${l} phiên ${res[0]}` };
        }
    }

    // ========== 2. CẦU ĐẢO 1-1 (3-20 phiên) ==========
    for (let l = 3; l <= 20; l++) {
        if (len < l) continue;
        let ok = true;
        for (let i = 1; i < l; i++) if (res[i] === res[i-1]) { ok = false; break; }
        if (ok) {
            let pred = res[l-1] === 'Tài' ? 'Xỉu' : 'Tài';
            let conf = Math.min(92, 52 + l * 2);
            return { prediction: pred, confidence: Math.floor(conf), reason: `🟡 Đảo 1-1 dài ${l} nhịp → ${pred}` };
        }
    }

    // ========== 3-7. CẦU 2-2, 3-3, 4-4, 5-5 ==========
    for (let block = 2; block <= 5; block++) {
        let needLen = block * 2;
        if (len >= needLen) {
            let ok = true;
            for (let i = 0; i < block; i++) {
                if (res[i] !== res[i+block]) { ok = false; break; }
            }
            if (ok && res[0] !== res[block]) {
                let pred = res[block] === 'Tài' ? 'Xỉu' : 'Tài';
                let conf = 78 + block;
                return { prediction: pred, confidence: conf, reason: `🟢 Cầu ${block}-${block}` };
            }
        }
    }

    // ========== 8-12. CẦU 1-2-1, 2-1-2, 1-2-3, 3-2-1, 1-3-1 ==========
    if (len >= 4 && res[0] !== res[1] && res[1] === res[2] && res[2] !== res[3] && res[0] === res[3]) {
        return { prediction: res[0], confidence: 86, reason: `🎯 Cầu 1-2-1` };
    }
    if (len >= 5 && res[0] === res[1] && res[1] !== res[2] && res[2] === res[3] && res[3] !== res[4] && res[0] !== res[2]) {
        let pred = res[0] === 'Tài' ? 'Xỉu' : 'Tài';
        return { prediction: pred, confidence: 87, reason: `🎯 Cầu 2-1-2` };
    }
    if (len >= 6 && res[0]===res[1] && res[1]===res[2] && res[3]===res[4] && res[0] !== res[3] && res[3] !== res[5]) {
        return { prediction: res[5], confidence: 84, reason: `📈 Cầu 1-2-3` };
    }
    if (len >= 6 && res[0]===res[1] && res[2]===res[3] && res[3]===res[4] && res[0] !== res[2] && res[2] !== res[5]) {
        return { prediction: res[2], confidence: 84, reason: `📉 Cầu 3-2-1` };
    }
    if (len >= 5 && res[0] !== res[1] && res[1] !== res[2] && res[2] !== res[3] && res[0] === res[2] && res[1] === res[3]) {
        let pred = res[3] === 'Tài' ? 'Xỉu' : 'Tài';
        return { prediction: pred, confidence: 83, reason: `🎯 Cầu 1-3-1` };
    }

    // ========== 13-18. CẦU 1-1-2-2, 2-2-1-1, 1-2-2-1, 2-1-1-2, 1-1-1-2, 2-2-2-1 ==========
    if (len >= 4 && res[0] === res[1] && res[2] === res[3] && res[0] !== res[2]) {
        let pred = res[2] === 'Tài' ? 'Xỉu' : 'Tài';
        return { prediction: pred, confidence: 82, reason: `🔷 Cầu 1-1-2-2` };
    }
    if (len >= 4 && res[0] !== res[1] && res[1] === res[2] && res[2] === res[3]) {
        return { prediction: res[0], confidence: 82, reason: `🔶 Cầu 2-2-1-1` };
    }
    if (len >= 6 && res[0] !== res[1] && res[1] === res[2] && res[2] === res[3] && res[3] !== res[4] && res[4] === res[5] && res[0] !== res[1]) {
        return { prediction: res[0], confidence: 86, reason: `🦋 Cầu 1-2-2-1` };
    }
    if (len >= 6 && res[0] === res[1] && res[1] !== res[2] && res[2] === res[3] && res[3] !== res[4] && res[4] === res[5] && res[0] !== res[2]) {
        return { prediction: res[0], confidence: 86, reason: `🦋 Cầu 2-1-1-2` };
    }
    if (len >= 5 && res[0] === res[1] && res[1] === res[2] && res[2] !== res[3] && res[0] !== res[3]) {
        let pred = res[3] === 'Tài' ? 'Xỉu' : 'Tài';
        return { prediction: pred, confidence: 80, reason: `🔹 Cầu 3-1 (3T/3X - 1)` };
    }
    if (len >= 5 && res[0] !== res[1] && res[1] === res[2] && res[2] === res[3] && res[3] === res[4]) {
        return { prediction: res[0], confidence: 80, reason: `🔸 Cầu 1-4` };
    }

    // ========== 19-23. CẦU NHẢY CÓC ==========
    for (let step = 1; step <= 4; step++) {
        let needLen = (step + 1) * 2 + 1;
        if (len >= needLen) {
            let ok = true;
            for (let i = 0; i <= step * 2; i += step) {
                if (res[i] !== res[0]) { ok = false; break; }
            }
            if (ok) {
                let conf = 78 - step;
                return { prediction: res[0], confidence: conf, reason: `🐸 Nhảy cóc bậc ${step} (${step+1} bước)` };
            }
        }
    }

    // ========== 24-28. CẦU GƯƠNG ==========
    for (let mirrorLen = 4; mirrorLen <= 10; mirrorLen += 2) {
        if (len >= mirrorLen) {
            let ok = true;
            for (let i = 0; i < mirrorLen / 2; i++) {
                if (res[i] !== res[mirrorLen - 1 - i]) { ok = false; break; }
            }
            if (ok) {
                let pred = res[mirrorLen/2 - 1] === 'Tài' ? 'Xỉu' : 'Tài';
                let conf = 76 + mirrorLen/2;
                return { prediction: pred, confidence: conf, reason: `🪞 Cầu gương ${mirrorLen} phiên` };
            }
        }
    }

    // ========== 29-35. CẦU CHU KỲ (2-8) ==========
    for (let cycle = 2; cycle <= 8; cycle++) {
        if (len >= cycle * 2) {
            let ok = true;
            for (let i = cycle; i < Math.min(len, cycle * 3); i++) {
                if (res[i] !== res[i % cycle]) { ok = false; break; }
            }
            if (ok) {
                let next = res[len % cycle];
                let conf = 80 - cycle;
                return { prediction: next, confidence: conf, reason: `🔄 Chu kỳ ${cycle} phiên` };
            }
        }
    }

    // ========== 36-40. CẦU ZICZAC CÁC LOẠI ==========
    if (len >= 4 && res[0] !== res[1] && res[1] !== res[2]) {
        if (res[0] === res[2]) {
            let pred = res[2] === 'Tài' ? 'Xỉu' : 'Tài';
            return { prediction: pred, confidence: 74, reason: `⚡ Ziczac 3 nhịp` };
        }
    }
    if (len >= 6 && res[0]!==res[1] && res[1]!==res[2] && res[2]!==res[3] && res[3]!==res[4] && res[4]!==res[5]) {
        let pred = res[5] === 'Tài' ? 'Xỉu' : 'Tài';
        return { prediction: pred, confidence: 73, reason: `⚡ Ziczac 6 nhịp` };
    }
    if (len >= 8 && res[0]!==res[1] && res[2]!==res[3] && res[4]!==res[5] && res[6]!==res[7] && res[0]===res[2] && res[2]===res[4]) {
        let pred = res[6] === 'Tài' ? 'Xỉu' : 'Tài';
        return { prediction: pred, confidence: 76, reason: `⚡ Ziczac kép` };
    }

    // ========== 41-48. CẦU DỰA TRÊN TỔNG ĐIỂM ==========
    if (sums.length >= 5) {
        let avg5 = sums.slice(0,5).reduce((a,b)=>a+b,0)/5;
        if (avg5 >= 13.5) return { prediction: 'Xỉu', confidence: 74, reason: `📊 Tổng TB cao ${avg5.toFixed(1)}` };
        if (avg5 <= 8.5) return { prediction: 'Tài', confidence: 74, reason: `📊 Tổng TB thấp ${avg5.toFixed(1)}` };
        
        let avg10 = sums.slice(0,Math.min(10,len)).reduce((a,b)=>a+b,0)/Math.min(10,len);
        if (avg10 >= 13) return { prediction: 'Xỉu', confidence: 72, reason: `📊 Xu hướng tổng cao 10 phiên` };
        if (avg10 <= 9) return { prediction: 'Tài', confidence: 72, reason: `📊 Xu hướng tổng thấp 10 phiên` };
    }

    // ========== 49-52. XU HƯỚNG TỔNG ==========
    if (sums.length >= 4 && sums[0] < sums[1] && sums[1] < sums[2] && sums[2] < sums[3]) {
        return { prediction: 'Tài', confidence: 75, reason: `📈 Tổng tăng 4 phiên liên tiếp` };
    }
    if (sums.length >= 4 && sums[0] > sums[1] && sums[1] > sums[2] && sums[2] > sums[3]) {
        return { prediction: 'Xỉu', confidence: 75, reason: `📉 Tổng giảm 4 phiên liên tiếp` };
    }
    if (sums.length >= 5) {
        let up = 0, down = 0;
        for (let i = 0; i < 4; i++) {
            if (sums[i] < sums[i+1]) up++; else if (sums[i] > sums[i+1]) down++;
        }
        if (up >= 3) return { prediction: 'Tài', confidence: 70, reason: `📈 Xu hướng tăng ${up}/4 phiên` };
        if (down >= 3) return { prediction: 'Xỉu', confidence: 70, reason: `📉 Xu hướng giảm ${down}/4 phiên` };
    }

    // ========== 53-58. CỰC ĐIỂM ==========
    let high15 = sums.slice(0,10).filter(s => s >= 15).length;
    let low6 = sums.slice(0,10).filter(s => s <= 6).length;
    if (high15 >= 3) return { prediction: 'Xỉu', confidence: 76, reason: `⚡ Cực điểm cao ${high15}/10 phiên` };
    if (low6 >= 3) return { prediction: 'Tài', confidence: 76, reason: `⚡ Cực điểm thấp ${low6}/10 phiên` };
    
    let high16 = sums.filter(s => s >= 16).length;
    let low5 = sums.filter(s => s <= 5).length;
    if (high16 >= 2) return { prediction: 'Xỉu', confidence: 78, reason: `🎲 Bùng nổ ${high16} lần >=16 điểm` };
    if (low5 >= 2) return { prediction: 'Tài', confidence: 78, reason: `🎲 Đáy ${low5} lần <=5 điểm` };

    // ========== 59-63. NÓNG/LẠNH ==========
    let last10 = res.slice(0, Math.min(10, len));
    let tai10 = last10.filter(r => r === 'Tài').length;
    if (tai10 >= 8) return { prediction: 'Xỉu', confidence: 82, reason: `🔥 Cực nóng Tài ${tai10}/10, bẻ Xỉu` };
    if (tai10 <= 2) return { prediction: 'Tài', confidence: 82, reason: `❄️ Cực lạnh Xỉu ${10-tai10}/10, bẻ Tài` };
    if (tai10 >= 7) return { prediction: 'Xỉu', confidence: 76, reason: `🔥 Tài nóng ${tai10}/10` };
    if (tai10 <= 3) return { prediction: 'Tài', confidence: 76, reason: `❄️ Xỉu nóng ${10-tai10}/10` };

    // ========== 64-68. CHÊNH LỆCH ==========
    let last20 = res.slice(0, Math.min(20, len));
    let tai20 = last20.filter(r => r === 'Tài').length;
    let diff20 = Math.abs(tai20 - (last20.length - tai20));
    if (diff20 >= 6) {
        let pred = tai20 > last20.length/2 ? 'Xỉu' : 'Tài';
        return { prediction: pred, confidence: 70 + Math.min(12, diff20), reason: `⚖️ Chênh ${tai20}/${last20.length-tai20} (20 phiên)` };
    }
    
    let last30 = res.slice(0, Math.min(30, len));
    let tai30 = last30.filter(r => r === 'Tài').length;
    let diff30 = Math.abs(tai30 - (last30.length - tai30));
    if (diff30 >= 8) {
        let pred = tai30 > last30.length/2 ? 'Xỉu' : 'Tài';
        return { prediction: pred, confidence: 68 + Math.min(14, diff30), reason: `⚖️ Chênh ${tai30}/${last30.length-tai30} (30 phiên)` };
    }

    // ========== 69-73. CẦU NHỊP NGHIÊNG ==========
    if (len >= 5) {
        let last5 = res.slice(0,5);
        let tai5 = last5.filter(r => r === 'Tài').length;
        if (tai5 >= 4) return { prediction: 'Xỉu', confidence: 74, reason: `📐 Nghiêng Tài 4/5` };
        if (tai5 <= 1) return { prediction: 'Tài', confidence: 74, reason: `📐 Nghiêng Xỉu 4/5` };
    }
    if (len >= 7) {
        let last7 = res.slice(0,7);
        let tai7 = last7.filter(r => r === 'Tài').length;
        if (tai7 >= 5) return { prediction: 'Xỉu', confidence: 73, reason: `📐 Nghiêng Tài 5/7` };
        if (tai7 <= 2) return { prediction: 'Tài', confidence: 73, reason: `📐 Nghiêng Xỉu 5/7` };
    }

    // ========== 74-77. CẦU SÓNG ==========
    if (len >= 8) {
        let song = [], cur = res[0], cnt = 1;
        for (let i = 1; i < 8; i++) {
            if (res[i] === cur) cnt++;
            else { song.push(cnt); cur = res[i]; cnt = 1; }
        }
        song.push(cnt);
        if (song.length >= 3) {
            let inc = song[0] < song[1] && song[1] < song[2];
            let dec = song[0] > song[1] && song[1] > song[2];
            if (inc) return { prediction: res[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 75, reason: `🌊 Sóng mở rộng ${song.join('-')}` };
            if (dec) return { prediction: res[0], confidence: 73, reason: `🌊 Sóng thu hẹp ${song.join('-')}` };
        }
    }

    // ========== 78-80. XU HƯỚNG 3-5 PHIÊN ==========
    let last3 = res.slice(0, 3);
    let tai3 = last3.filter(r => r === 'Tài').length;
    if (tai3 === 3) return { prediction: 'Xỉu', confidence: 72, reason: `📈 3 Tài liên tiếp, bẻ Xỉu` };
    if (tai3 === 0) return { prediction: 'Tài', confidence: 72, reason: `📈 3 Xỉu liên tiếp, bẻ Tài` };
    
    let last5 = res.slice(0, 5);
    let tai5 = last5.filter(r => r === 'Tài').length;
    if (tai5 >= 4) return { prediction: 'Xỉu', confidence: 68, reason: `📈 Xu hướng 4/5 Tài → bẻ` };
    if (tai5 <= 1) return { prediction: 'Tài', confidence: 68, reason: `📈 Xu hướng 4/5 Xỉu → bẻ` };

    // ========== DEFAULT ==========
    return { 
        prediction: tai3 >= 2 ? 'Tài' : 'Xỉu', 
        confidence: 62, 
        reason: `📊 Theo xu hướng ${tai3}T-${3-tai3}X (3 phiên cuối)` 
    };
}

// ==================== DỰ ĐOÁN CHO 1 GAME ====================
async function getPredictionForGame(gameKey) {
    const game = GAMES[gameKey];
    if (!game) return { success: false, error: 'Game không tồn tại' };
    
    const history = await fetchGameData(gameKey);
    if (!history || history.length === 0) {
        return { success: false, error: 'Không lấy được dữ liệu', game: game.name };
    }
    
    const latestPhien = history[0].phien;
    const nextPhien = latestPhien + 1;
    const analysis = phatHienCau(history);
    
    const record = {
        phien: nextPhien,
        du_doan: analysis.prediction,
        ty_le: analysis.confidence + '%',
        ly_do: analysis.reason,
        game: game.name,
        timestamp: new Date().toISOString()
    };
    
    predictionsDB[gameKey].unshift(record);
    if (predictionsDB[gameKey].length > 50) predictionsDB[gameKey] = predictionsDB[gameKey].slice(0, 50);
    saveHistory(gameKey);
    
    return {
        success: true,
        game: game.name,
        phien_hien_tai: nextPhien,
        du_doan: analysis.prediction,
        ty_le: analysis.confidence + '%',
        ly_do: analysis.reason,
        timestamp: new Date().toISOString()
    };
}

// ==================== API ====================
app.get('/', (req, res) => { res.send(`<!DOCTYPE html>
<html><head><title>🎲 TÀI XỈU - 10 GAME</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);min-height:100vh;color:#eee;padding:16px}.container{max-width:1400px;margin:0 auto}h1{text-align:center;margin-bottom:20px;font-size:clamp(1.3rem,5vw,1.8rem);background:linear-gradient(135deg,#f093fb,#f5576c);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.games-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:15px;margin-bottom:30px}.game-card{background:rgba(255,255,255,0.1);backdrop-filter:blur(10px);border-radius:20px;padding:15px;border:1px solid rgba(255,255,255,0.1)}.game-name{font-size:1rem;font-weight:bold;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.2)}.prediction-box{background:linear-gradient(135deg,#667eea,#764ba2);border-radius:16px;padding:12px;text-align:center;margin:12px 0}.prediction-value{font-size:1.8rem;font-weight:800;margin:8px 0}.confidence{font-size:.75rem}.reason{font-size:.65rem;margin-top:8px;background:rgba(0,0,0,0.2);display:inline-block;padding:4px 10px;border-radius:20px}.btn{background:rgba(255,255,255,0.2);border:none;padding:6px 12px;border-radius:20px;color:#fff;cursor:pointer;margin-top:6px;width:100%;font-size:.7rem}.btn:hover{background:rgba(255,255,255,0.3)}.status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;animation:pulse 1s infinite;margin-right:6px}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}.update-time{font-size:.65rem;text-align:center;margin-top:15px;color:#aaa}.history-section{background:rgba(0,0,0,0.3);border-radius:16px;padding:15px;margin-top:20px;overflow-x:auto;max-height:400px;overflow-y:auto}select{background:rgba(0,0,0,0.5);color:#fff;border:1px solid rgba(255,255,255,0.2);padding:8px;border-radius:8px;margin-bottom:12px;width:200px}table{width:100%;border-collapse:collapse;font-size:.7rem}th,td{padding:6px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.1)}th{background:rgba(255,255,255,0.05)}.tai{color:#f87171;font-weight:bold}.xiu{color:#60a5fa;font-weight:bold}</style>
</head><body><div class="container"><h1>🎲 TÀI XỈU - 10 GAME + 80 CẦU</h1><div style="text-align:center;margin-bottom:12px"><span class="status-dot"></span><span id="timer">Đang cập nhật...</span></div>
<div class="games-grid" id="gamesGrid"><div style="text-align:center;padding:40px">Đang tải...</div></div>
<div class="history-section"><h3 style="margin-bottom:12px">📜 LỊCH SỬ DỰ ĐOÁN</h3><select id="gameSelect" onchange="loadHistory()"><option value="">-- Chọn game --</option></select><div id="historyContainer">Chọn game để xem lịch sử</div></div>
<div class="update-time" id="updateTime"></div></div>
<script>const games=${JSON.stringify(Object.keys(GAMES).map(k=>({key:k,name:GAMES[k].name})))};
async function loadAll(){try{const r=await fetch('/api/all-predictions');const d=await r.json();if(d.success){renderGames(d.predictions);document.getElementById('updateTime').innerHTML='🕐 '+new Date().toLocaleString()}}catch(e){}}
function renderGames(p){let h='';for(const[k,v]of Object.entries(p)){let c=v.du_doan==='Tài'?'#f87171':'#60a5fa';h+=`<div class="game-card"><div class="game-name">🎮 ${v.game}</div><div class="prediction-box"><div class="prediction-value" style="color:${c}">${v.du_doan}</div><div class="confidence">🎯 Độ tin cậy: ${v.ty_le}</div><div class="reason">📐 ${v.ly_do}</div><div class="reason" style="margin-top:4px">📌 Phiên: #${v.phien_hien_tai}</div></div><button class="btn" onclick="refresh('${k}')">🔄 Dự đoán lại</button><button class="btn btn-reset" onclick="resetHis('${k}')" style="background:rgba(239,68,68,0.3)">🗑️ Reset</button></div>`;}document.getElementById('gamesGrid').innerHTML=h;
let opts='<option value="">-- Chọn game --</option>';for(let g of games)opts+=`<option value="${g.key}">${g.name}</option>`;document.getElementById('gameSelect').innerHTML=opts;}
async function refresh(k){try{let btn=event.target;btn.textContent='⏳';btn.disabled=true;await fetch('/api/predict/'+k);loadAll();btn.textContent='🔄 Dự đoán lại';btn.disabled=false;}catch(e){}}
async function resetHis(k){if(!confirm('Xóa lịch sử game này?'))return;await fetch('/api/reset/'+k,{method:'POST'});loadAll();if(document.getElementById('gameSelect').value===k)loadHistory();}
async function loadHistory(){let k=document.getElementById('gameSelect').value;if(!k){document.getElementById('historyContainer').innerHTML='Chọn game';return;}let r=await fetch('/api/history/'+k);let d=await r.json();if(d.success&&d.history?.length){let html='<table><thead><th>Thời gian</th><th>Phiên</th><th>Dự đoán</th><th>Tỉ lệ</th><th>Cầu</th></thead><tbody>';for(let h of d.history){let cls=h.du_doan==='Tài'?'tai':'xiu';html+=`<tr><td>${new Date(h.timestamp).toLocaleString()}</td><td>#${h.phien}</td><td class="${cls}">${h.du_doan}</td><td>${h.ty_le}</td><td style="font-size:.6rem">${h.ly_do}</td></tr>`;}html+='</tbody></table>';document.getElementById('historyContainer').innerHTML=html;}else document.getElementById('historyContainer').innerHTML='<div style="text-align:center;padding:20px">Chưa có dữ liệu</div>';}
let count=20;function timer(){document.getElementById('timer').innerHTML='⏱️ Cập nhật sau: '+count+' giây';count--;if(count<0){count=20;loadAll();}}loadAll();setInterval(timer,1000);</script></body></html>`); });

app.get('/api/all-predictions', async (req, res) => {
    let predictions = {};
    for (let key of Object.keys(GAMES)) {
        if (GAMES[key].active) predictions[key] = await getPredictionForGame(key);
    }
    res.json({ success: true, predictions, timestamp: new Date().toISOString() });
});

app.get('/api/predict/:gameKey', async (req, res) => { res.json(await getPredictionForGame(req.params.gameKey)); });
app.get('/api/history/:gameKey', (req, res) => { let k = req.params.gameKey; res.json({ success: true, game: GAMES[k]?.name, history: predictionsDB[k] || [] }); });
app.post('/api/reset/:gameKey', (req, res) => { let k = req.params.gameKey; predictionsDB[k] = []; saveHistory(k); res.json({ success: true, game: GAMES[k]?.name }); });
app.get('/api/games', (req, res) => { let games = {}; for (let [k,v] of Object.entries(GAMES)) games[k] = { name: v.name, active: v.active }; res.json({ success: true, games }); });

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 TÀI XỈU - 10 GAME + 80 LOẠI CẦU`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log(`\n📡 API CHO 10 GAME:`);
    for (let key of Object.keys(GAMES)) {
        console.log(`   GET /api/predict/${key}`);
        console.log(`   GET /api/history/${key}`);
        console.log(`   POST /api/reset/${key}`);
    }
});
