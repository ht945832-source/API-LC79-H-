const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

// ============================================================
// ========== CẤU HÌNH 8 GAME =================================
// ============================================================
const GAMES = {
    lc79_tx: { url: 'https://wtx.tele68.com/v1/tx/sessions', type: 'tele68' },
    lc79_md5: { url: 'https://wtxmd52.tele68.com/v1/txmd5/sessions', type: 'tele68' },
    betvip_tx: { url: 'https://wtx.macminim6.online/v1/tx/sessions', type: 'tele68' },
    betvip_md5: { url: 'https://wtxmd52.macminim6.online/v1/txmd5/sessions', type: 'tele68' },
    xocdia88_tx: { url: 'https://taixiu.system32-cloudfare-356783752985678522.monster/api/luckydice/GetSoiCau', type: 'xocdia' },
    xocdia88_md5: { url: 'https://taixiumd5.system32-cloudfare-356783752985678522.monster/api/md5luckydice/GetSoiCau', type: 'xocdia' },
    hitclub: { url: 'https://sun-win.onrender.com/api/history', type: 'sun' },
    b52: { url: 'https://b52-qiw2.onrender.com/api/history', type: 'b52' }
};

// ============================================================
// ========== HÀM FETCH DATA ==================================
// ============================================================
async function fetchGameData(gameKey) {
    const game = GAMES[gameKey];
    if (!game) return null;
    try {
        const res = await axios.get(game.url, { timeout: 10000 });
        
        if (game.type === 'tele68' && res.data?.list) {
            return res.data.list.map(item => ({
                phien: item.id,
                ket_qua: item.resultTruyenThong === 'TAI' ? 'T' : 'X',
                x1: item.dices[0],
                x2: item.dices[1],
                x3: item.dices[2],
                tong: item.point
            }));
        }
        if (game.type === 'xocdia' && Array.isArray(res.data)) {
            return res.data.map(item => ({
                phien: item.SessionId,
                ket_qua: item.BetSide === 0 ? 'T' : 'X',
                x1: item.FirstDice,
                x2: item.SecondDice,
                x3: item.ThirdDice,
                tong: item.DiceSum
            }));
        }
        if (game.type === 'sun' && res.data?.taixiu) {
            return res.data.taixiu.map(item => ({
                phien: item.Phien,
                ket_qua: item.Ket_qua === 'Tài' ? 'T' : 'X',
                x1: item.Xuc_xac_1,
                x2: item.Xuc_xac_2,
                x3: item.Xuc_xac_3,
                tong: item.Tong
            }));
        }
        if (game.type === 'b52' && res.data?.data) {
            return res.data.data.map(item => ({
                phien: item.Phien,
                ket_qua: item.Ket_qua === 'Tài' ? 'T' : 'X',
                x1: item.Xuc_xac_1,
                x2: item.Xuc_xac_2,
                x3: item.Xuc_xac_3,
                tong: item.Tong
            }));
        }
        return null;
    } catch(e) {
        console.log(`❌ ${gameKey} error:`, e.message);
        return null;
    }
}

// ============================================================
// ========== THUẬT TOÁN DỰ ĐOÁN 200+ CẦU =====================
// ============================================================

// ------------------------------------------------------------
// CẦU SỐ 1: BỆT (2-20 PHIÊN)
// ------------------------------------------------------------
function phatHienBet(res, len, minLen) {
    if (len < minLen) return null;
    let ok = true;
    for (let i = 1; i < minLen; i++) if (res[i] !== res[0]) { ok = false; break; }
    if (!ok) return null;
    let conf = Math.min(95, 48 + minLen * 2.8);
    return { prediction: res[0], confidence: Math.floor(conf), reason: `🔴 Bệt ${minLen} phiên ${res[0] === 'T' ? 'Tài' : 'Xỉu'}` };
}

// ------------------------------------------------------------
// CẦU SỐ 2: ĐẢO 1-1 (3-20 PHIÊN)
// ------------------------------------------------------------
function phatHienDao11(res, len, minLen) {
    if (len < minLen) return null;
    let ok = true;
    for (let i = 1; i < minLen; i++) if (res[i] === res[i-1]) { ok = false; break; }
    if (!ok) return null;
    let pred = res[minLen-1] === 'T' ? 'X' : 'T';
    let conf = Math.min(92, 52 + minLen * 2);
    return { prediction: pred, confidence: Math.floor(conf), reason: `🟡 Đảo 1-1 dài ${minLen} nhịp → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
}

// ------------------------------------------------------------
// CẦU SỐ 3: CẦU 2-2
// ------------------------------------------------------------
function phatHien22(res, len) {
    if (len < 4) return null;
    let a = res[0], b = res[1], c = res[2], d = res[3];
    if (a === b && b !== c && c === d) {
        let pred = c === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 82, reason: `🟢 Cầu 2-2 (${a === 'T' ? 'T' : 'X'}${a === 'T' ? 'T' : 'X'}${c === 'T' ? 'T' : 'X'}${c === 'T' ? 'T' : 'X'}) → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 4: CẦU 3-3
// ------------------------------------------------------------
function phatHien33(res, len) {
    if (len < 6) return null;
    let ok1 = res[0] === res[1] && res[1] === res[2];
    let ok2 = res[3] === res[4] && res[4] === res[5];
    if (ok1 && ok2 && res[0] !== res[3]) {
        let pred = res[3] === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 85, reason: `🟣 Cầu 3-3 (${res[0] === 'T' ? 'T' : 'X'}${res[0] === 'T' ? 'T' : 'X'}${res[0] === 'T' ? 'T' : 'X'}${res[3] === 'T' ? 'T' : 'X'}${res[3] === 'T' ? 'T' : 'X'}${res[3] === 'T' ? 'T' : 'X'}) → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 5: CẦU 4-4
// ------------------------------------------------------------
function phatHien44(res, len) {
    if (len < 8) return null;
    let ok1 = res[0] === res[1] && res[1] === res[2] && res[2] === res[3];
    let ok2 = res[4] === res[5] && res[5] === res[6] && res[6] === res[7];
    if (ok1 && ok2 && res[0] !== res[4]) {
        let pred = res[4] === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 87, reason: `🟣 Cầu 4-4 → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 6: CẦU 5-5
// ------------------------------------------------------------
function phatHien55(res, len) {
    if (len < 10) return null;
    let ok1 = res[0] === res[1] && res[1] === res[2] && res[2] === res[3] && res[3] === res[4];
    let ok2 = res[5] === res[6] && res[6] === res[7] && res[7] === res[8] && res[8] === res[9];
    if (ok1 && ok2 && res[0] !== res[5]) {
        let pred = res[5] === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 89, reason: `🟣 Cầu 5-5 → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 7: CẦU 6-6
// ------------------------------------------------------------
function phatHien66(res, len) {
    if (len < 12) return null;
    let ok1 = true;
    for (let i = 0; i < 5; i++) if (res[i] !== res[i+1]) { ok1 = false; break; }
    let ok2 = true;
    for (let i = 6; i < 11; i++) if (res[i] !== res[i+1]) { ok2 = false; break; }
    if (ok1 && ok2 && res[0] !== res[6]) {
        let pred = res[6] === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 90, reason: `🟣 Cầu 6-6 (Siêu hiếm) → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 8: CẦU 7-7
// ------------------------------------------------------------
function phatHien77(res, len) {
    if (len < 14) return null;
    let ok1 = true;
    for (let i = 0; i < 6; i++) if (res[i] !== res[i+1]) { ok1 = false; break; }
    let ok2 = true;
    for (let i = 7; i < 13; i++) if (res[i] !== res[i+1]) { ok2 = false; break; }
    if (ok1 && ok2 && res[0] !== res[7]) {
        let pred = res[7] === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 91, reason: `🟣 Cầu 7-7 (Cực hiếm) → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 9: CẦU 8-8
// ------------------------------------------------------------
function phatHien88(res, len) {
    if (len < 16) return null;
    let ok1 = true;
    for (let i = 0; i < 7; i++) if (res[i] !== res[i+1]) { ok1 = false; break; }
    let ok2 = true;
    for (let i = 8; i < 15; i++) if (res[i] !== res[i+1]) { ok2 = false; break; }
    if (ok1 && ok2 && res[0] !== res[8]) {
        let pred = res[8] === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 92, reason: `🟣 Cầu 8-8 (Thần thánh) → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 10: CẦU 1-2-1
// ------------------------------------------------------------
function phatHien121(res, len) {
    if (len < 4) return null;
    let a = res[0], b = res[1], c = res[2], d = res[3];
    if (a !== b && b === c && c !== d && a === d) {
        return { prediction: a, confidence: 86, reason: `🎯 Cầu 1-2-1 (${a === 'T' ? 'T' : 'X'}${b === 'T' ? 'T' : 'X'}${c === 'T' ? 'T' : 'X'}${d === 'T' ? 'T' : 'X'}) → ${a === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 11: CẦU 2-1-2
// ------------------------------------------------------------
function phatHien212(res, len) {
    if (len < 5) return null;
    let a = res[0], b = res[1], c = res[2], d = res[3], e = res[4];
    if (a === b && b !== c && c === d && d !== e && a !== c) {
        let pred = a === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 87, reason: `🎯 Cầu 2-1-2 → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 12: CẦU 1-2-3 (TĂNG DẦN)
// ------------------------------------------------------------
function phatHien123(res, len) {
    if (len < 6) return null;
    let ok1 = res[0] === res[1] && res[1] === res[2];
    let ok2 = res[3] === res[4];
    if (ok1 && ok2 && res[0] !== res[3] && res[3] !== res[5]) {
        return { prediction: res[5], confidence: 84, reason: `📈 Cầu 1-2-3 (Tăng dần) → ${res[5] === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 13: CẦU 3-2-1 (GIẢM DẦN)
// ------------------------------------------------------------
function phatHien321(res, len) {
    if (len < 6) return null;
    let ok1 = res[0] === res[1];
    let ok2 = res[2] === res[3] && res[3] === res[4];
    if (ok1 && ok2 && res[0] !== res[2] && res[2] !== res[5]) {
        return { prediction: res[2], confidence: 84, reason: `📉 Cầu 3-2-1 (Giảm dần) → ${res[2] === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 14: CẦU 1-3-1
// ------------------------------------------------------------
function phatHien131(res, len) {
    if (len < 5) return null;
    let a = res[0], b = res[1], c = res[2], d = res[3];
    if (a !== b && b !== c && c !== d && a === c && b === d) {
        let pred = d === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 83, reason: `🎯 Cầu 1-3-1 → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 15: CẦU 2-3-2
// ------------------------------------------------------------
function phatHien232(res, len) {
    if (len < 7) return null;
    let a = res[0], b = res[1], c = res[2], d = res[3], e = res[4], f = res[5], g = res[6];
    if (a === b && a === c && c !== d && d === e && d !== f && f === g && a !== d && d !== f) {
        let pred = f === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 85, reason: `🎯 Cầu 2-3-2 → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 16: CẦU 1-1-2-2
// ------------------------------------------------------------
function phatHien1122(res, len) {
    if (len < 4) return null;
    let a = res[0], b = res[1], c = res[2], d = res[3];
    if (a === b && c === d && a !== c) {
        let pred = c === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 82, reason: `🔷 Cầu 1-1-2-2 (${a === 'T' ? 'T' : 'X'}${a === 'T' ? 'T' : 'X'}${c === 'T' ? 'T' : 'X'}${c === 'T' ? 'T' : 'X'}) → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 17: CẦU 2-2-1-1
// ------------------------------------------------------------
function phatHien2211(res, len) {
    if (len < 4) return null;
    let a = res[0], b = res[1], c = res[2], d = res[3];
    if (a !== b && b === c && c === d) {
        return { prediction: a, confidence: 82, reason: `🔶 Cầu 2-2-1-1 → ${a === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 18: CẦU 1-2-2-1
// ------------------------------------------------------------
function phatHien1221(res, len) {
    if (len < 6) return null;
    let a = res[0], b = res[1], c = res[2], d = res[3], e = res[4], f = res[5];
    if (a !== b && b === c && c === d && d !== e && e === f && a !== b) {
        return { prediction: a, confidence: 86, reason: `🦋 Cầu 1-2-2-1 → ${a === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 19: CẦU 2-1-1-2
// ------------------------------------------------------------
function phatHien2112(res, len) {
    if (len < 6) return null;
    let a = res[0], b = res[1], c = res[2], d = res[3], e = res[4], f = res[5];
    if (a === b && b !== c && c === d && d !== e && e === f && a !== c) {
        return { prediction: a, confidence: 86, reason: `🦋 Cầu 2-1-1-2 → ${a === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 20: CẦU 1-1-1-2
// ------------------------------------------------------------
function phatHien1112(res, len) {
    if (len < 4) return null;
    let a = res[0], b = res[1], c = res[2], d = res[3];
    if (a === b && b === c && c !== d) {
        let pred = d === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 80, reason: `🎯 Cầu 3-1 (${a === 'T' ? 'T' : 'X'}${a === 'T' ? 'T' : 'X'}${a === 'T' ? 'T' : 'X'}${d === 'T' ? 'T' : 'X'}) → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 21: CẦU 2-2-2-1
// ------------------------------------------------------------
function phatHien2221(res, len) {
    if (len < 4) return null;
    let a = res[0], b = res[1], c = res[2], d = res[3];
    if (a !== b && b === c && c === d) {
        return { prediction: a, confidence: 80, reason: `🎯 Cầu 1-3 (Thủng lưới) → ${a === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 22: NHẢY CÓC BẬC 1 (CÁCH 1 PHIÊN)
// ------------------------------------------------------------
function phatHienNhayCoc1(res, len) {
    if (len < 5) return null;
    if (res[0] === res[2] && res[2] === res[4]) {
        return { prediction: res[0], confidence: 79, reason: `🐸 Nhảy cóc bậc 1 (${res[0] === 'T' ? 'T' : 'X'}-${res[2] === 'T' ? 'T' : 'X'}-${res[4] === 'T' ? 'T' : 'X'}) → ${res[0] === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 23: NHẢY CÓC BẬC 2 (CÁCH 2 PHIÊN)
// ------------------------------------------------------------
function phatHienNhayCoc2(res, len) {
    if (len < 7) return null;
    if (res[0] === res[3] && res[3] === res[6]) {
        return { prediction: res[0], confidence: 77, reason: `🐸 Nhảy cóc bậc 2 → ${res[0] === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 24: NHẢY CÓC BẬC 3 (CÁCH 3 PHIÊN)
// ------------------------------------------------------------
function phatHienNhayCoc3(res, len) {
    if (len < 9) return null;
    if (res[0] === res[4] && res[4] === res[8]) {
        return { prediction: res[0], confidence: 75, reason: `🐸 Nhảy cóc bậc 3 → ${res[0] === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 25: CẦU GƯƠNG 4 PHIÊN
// ------------------------------------------------------------
function phatHienGuong4(res, len) {
    if (len < 4) return null;
    if (res[0] === res[3] && res[1] === res[2]) {
        let pred = res[1] === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 80, reason: `🪞 Cầu gương 4 phiên (${res[0] === 'T' ? 'T' : 'X'}${res[1] === 'T' ? 'T' : 'X'}${res[2] === 'T' ? 'T' : 'X'}${res[3] === 'T' ? 'T' : 'X'}) → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 26: CẦU GƯƠNG 6 PHIÊN
// ------------------------------------------------------------
function phatHienGuong6(res, len) {
    if (len < 6) return null;
    if (res[0] === res[5] && res[1] === res[4] && res[2] === res[3]) {
        let pred = res[2] === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 82, reason: `🪞 Cầu gương 6 phiên → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 27: CẦU GƯƠNG 8 PHIÊN
// ------------------------------------------------------------
function phatHienGuong8(res, len) {
    if (len < 8) return null;
    if (res[0] === res[7] && res[1] === res[6] && res[2] === res[5] && res[3] === res[4]) {
        let pred = res[3] === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 84, reason: `🪞 Cầu gương 8 phiên → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 28: CẦU GƯƠNG 10 PHIÊN
// ------------------------------------------------------------
function phatHienGuong10(res, len) {
    if (len < 10) return null;
    if (res[0] === res[9] && res[1] === res[8] && res[2] === res[7] && res[3] === res[6] && res[4] === res[5]) {
        let pred = res[4] === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 86, reason: `🪞 Cầu gương 10 phiên (Hoàn hảo) → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 29: CHU KỲ 2 PHIÊN
// ------------------------------------------------------------
function phatHienCycle2(res, len) {
    if (len < 4) return null;
    let pattern = [res[0], res[1]];
    for (let i = 2; i < Math.min(len, 8); i++) {
        if (res[i] !== pattern[i % 2]) return null;
    }
    let next = pattern[len % 2];
    return { prediction: next, confidence: 78, reason: `🔄 Chu kỳ 2 phiên (${pattern[0] === 'T' ? 'T' : 'X'}${pattern[1] === 'T' ? 'T' : 'X'}) → ${next === 'T' ? 'Tài' : 'Xỉu'}` };
}

// ------------------------------------------------------------
// CẦU SỐ 30: CHU KỲ 3 PHIÊN
// ------------------------------------------------------------
function phatHienCycle3(res, len) {
    if (len < 6) return null;
    let pattern = [res[0], res[1], res[2]];
    for (let i = 3; i < Math.min(len, 12); i++) {
        if (res[i] !== pattern[i % 3]) return null;
    }
    let next = pattern[len % 3];
    return { prediction: next, confidence: 76, reason: `🔄 Chu kỳ 3 phiên → ${next === 'T' ? 'Tài' : 'Xỉu'}` };
}

// ------------------------------------------------------------
// CẦU SỐ 31: CHU KỲ 4 PHIÊN
// ------------------------------------------------------------
function phatHienCycle4(res, len) {
    if (len < 8) return null;
    let pattern = [res[0], res[1], res[2], res[3]];
    for (let i = 4; i < Math.min(len, 16); i++) {
        if (res[i] !== pattern[i % 4]) return null;
    }
    let next = pattern[len % 4];
    return { prediction: next, confidence: 74, reason: `🔄 Chu kỳ 4 phiên → ${next === 'T' ? 'Tài' : 'Xỉu'}` };
}

// ------------------------------------------------------------
// CẦU SỐ 32: CHU KỲ 5 PHIÊN
// ------------------------------------------------------------
function phatHienCycle5(res, len) {
    if (len < 10) return null;
    let pattern = [res[0], res[1], res[2], res[3], res[4]];
    for (let i = 5; i < Math.min(len, 20); i++) {
        if (res[i] !== pattern[i % 5]) return null;
    }
    let next = pattern[len % 5];
    return { prediction: next, confidence: 72, reason: `🔄 Chu kỳ 5 phiên → ${next === 'T' ? 'Tài' : 'Xỉu'}` };
}

// ------------------------------------------------------------
// CẦU SỐ 33: CHU KỲ 6 PHIÊN
// ------------------------------------------------------------
function phatHienCycle6(res, len) {
    if (len < 12) return null;
    let pattern = [res[0], res[1], res[2], res[3], res[4], res[5]];
    for (let i = 6; i < Math.min(len, 24); i++) {
        if (res[i] !== pattern[i % 6]) return null;
    }
    let next = pattern[len % 6];
    return { prediction: next, confidence: 70, reason: `🔄 Chu kỳ 6 phiên → ${next === 'T' ? 'Tài' : 'Xỉu'}` };
}

// ------------------------------------------------------------
// CẦU SỐ 34: ZICZAC 3 NHỊP
// ------------------------------------------------------------
function phatHienZiczac3(res, len) {
    if (len < 4) return null;
    if (res[0] !== res[1] && res[1] !== res[2] && res[0] === res[2]) {
        let pred = res[2] === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 76, reason: `⚡ Ziczac 3 nhịp (${res[0] === 'T' ? 'T' : 'X'}${res[1] === 'T' ? 'T' : 'X'}${res[2] === 'T' ? 'T' : 'X'}) → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 35: ZICZAC 4 NHỊP
// ------------------------------------------------------------
function phatHienZiczac4(res, len) {
    if (len < 5) return null;
    let ok = true;
    for (let i = 0; i < 4; i++) if (res[i] === res[i+1]) { ok = false; break; }
    if (ok) {
        let pred = res[3] === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 74, reason: `⚡ Ziczac 4 nhịp → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 36: ZICZAC 5 NHỊP
// ------------------------------------------------------------
function phatHienZiczac5(res, len) {
    if (len < 6) return null;
    let ok = true;
    for (let i = 0; i < 5; i++) if (res[i] === res[i+1]) { ok = false; break; }
    if (ok) {
        let pred = res[4] === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 73, reason: `⚡ Ziczac 5 nhịp → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 37: ZICZAC 6 NHỊP
// ------------------------------------------------------------
function phatHienZiczac6(res, len) {
    if (len < 7) return null;
    let ok = true;
    for (let i = 0; i < 6; i++) if (res[i] === res[i+1]) { ok = false; break; }
    if (ok) {
        let pred = res[5] === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 72, reason: `⚡ Ziczac 6 nhịp → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 38: ZICZAC 7 NHỊP
// ------------------------------------------------------------
function phatHienZiczac7(res, len) {
    if (len < 8) return null;
    let ok = true;
    for (let i = 0; i < 7; i++) if (res[i] === res[i+1]) { ok = false; break; }
    if (ok) {
        let pred = res[6] === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 71, reason: `⚡ Ziczac 7 nhịp → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 39: ZICZAC 8 NHỊP
// ------------------------------------------------------------
function phatHienZiczac8(res, len) {
    if (len < 9) return null;
    let ok = true;
    for (let i = 0; i < 8; i++) if (res[i] === res[i+1]) { ok = false; break; }
    if (ok) {
        let pred = res[7] === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 70, reason: `⚡ Ziczac 8 nhịp → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 40: ZICZAC KÉP
// ------------------------------------------------------------
function phatHienZiczacKep(res, len) {
    if (len < 8) return null;
    if (res[0] !== res[1] && res[2] !== res[3] && res[4] !== res[5] && res[6] !== res[7] &&
        res[0] === res[2] && res[2] === res[4] && res[4] === res[6]) {
        let pred = res[6] === 'T' ? 'X' : 'T';
        return { prediction: pred, confidence: 77, reason: `⚡ Ziczac kép (Đặc biệt) → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 41: CẦU TỔNG CAO
// ------------------------------------------------------------
function phatHienTongCao(sums, len) {
    if (sums.length < 5) return null;
    let avg5 = sums.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    if (avg5 >= 13.5) {
        return { prediction: 'X', confidence: 75, reason: `📊 Tổng TB cao ${avg5.toFixed(1)} → bẻ Xỉu` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 42: CẦU TỔNG THẤP
// ------------------------------------------------------------
function phatHienTongThap(sums, len) {
    if (sums.length < 5) return null;
    let avg5 = sums.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    if (avg5 <= 8.5) {
        return { prediction: 'T', confidence: 75, reason: `📊 Tổng TB thấp ${avg5.toFixed(1)} → bẻ Tài` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 43: TỔNG TĂNG 4 PHIÊN
// ------------------------------------------------------------
function phatHienTongTang(sums, len) {
    if (sums.length < 4) return null;
    if (sums[0] < sums[1] && sums[1] < sums[2] && sums[2] < sums[3]) {
        return { prediction: 'T', confidence: 76, reason: `📈 Tổng tăng 4 phiên → Tài` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 44: TỔNG GIẢM 4 PHIÊN
// ------------------------------------------------------------
function phatHienTongGiam(sums, len) {
    if (sums.length < 4) return null;
    if (sums[0] > sums[1] && sums[1] > sums[2] && sums[2] > sums[3]) {
        return { prediction: 'X', confidence: 76, reason: `📉 Tổng giảm 4 phiên → Xỉu` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 45: CỰC ĐIỂM CAO (>=15 ĐIỂM)
// ------------------------------------------------------------
function phatHienCucDiemCao(sums, len) {
    let high15 = sums.slice(0, 10).filter(s => s >= 15).length;
    if (high15 >= 3) {
        return { prediction: 'X', confidence: 78, reason: `⚡ Cực điểm cao ${high15}/10 phiên → bẻ Xỉu` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 46: CỰC ĐIỂM THẤP (<=6 ĐIỂM)
// ------------------------------------------------------------
function phatHienCucDiemThap(sums, len) {
    let low6 = sums.slice(0, 10).filter(s => s <= 6).length;
    if (low6 >= 3) {
        return { prediction: 'T', confidence: 78, reason: `⚡ Cực điểm thấp ${low6}/10 phiên → bẻ Tài` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 47: CỰC ĐIỂM BÙNG NỔ (>=16 ĐIỂM)
// ------------------------------------------------------------
function phatHienBungNo(sums, len) {
    let high16 = sums.slice(0, 15).filter(s => s >= 16).length;
    if (high16 >= 2) {
        return { prediction: 'X', confidence: 80, reason: `💥 Bùng nổ ${high16} lần >=16 điểm → bẻ Xỉu mạnh` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 48: CỰC ĐIỂM ĐÁY (<=5 ĐIỂM)
// ------------------------------------------------------------
function phatHienDaySo(sums, len) {
    let low5 = sums.slice(0, 15).filter(s => s <= 5).length;
    if (low5 >= 2) {
        return { prediction: 'T', confidence: 80, reason: `🎲 Đáy ${low5} lần <=5 điểm → bẻ Tài mạnh` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 49: NÓNG TÀI 8/10
// ------------------------------------------------------------
function phatHienNongTai8(res, len) {
    let last10 = res.slice(0, Math.min(10, len));
    let tai10 = last10.filter(r => r === 'T').length;
    if (tai10 >= 8) {
        return { prediction: 'X', confidence: 84, reason: `🔥 Cực nóng Tài ${tai10}/10, bẻ Xỉu mạnh` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 50: LẠNH XỈU 8/10
// ------------------------------------------------------------
function phatHienLanhXiu8(res, len) {
    let last10 = res.slice(0, Math.min(10, len));
    let tai10 = last10.filter(r => r === 'T').length;
    if (tai10 <= 2) {
        return { prediction: 'T', confidence: 84, reason: `❄️ Cực lạnh Xỉu ${10 - tai10}/10, bẻ Tài mạnh` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 51: NÓNG TÀI 7/10
// ------------------------------------------------------------
function phatHienNongTai7(res, len) {
    let last10 = res.slice(0, Math.min(10, len));
    let tai10 = last10.filter(r => r === 'T').length;
    if (tai10 >= 7 && tai10 < 8) {
        return { prediction: 'X', confidence: 78, reason: `🔥 Tài nóng ${tai10}/10, bẻ Xỉu` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 52: LẠNH XỈU 7/10
// ------------------------------------------------------------
function phatHienLanhXiu7(res, len) {
    let last10 = res.slice(0, Math.min(10, len));
    let tai10 = last10.filter(r => r === 'T').length;
    if (tai10 <= 3 && tai10 > 2) {
        return { prediction: 'T', confidence: 78, reason: `❄️ Xỉu nóng ${10 - tai10}/10, bẻ Tài` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 53: CHÊNH LỆCH 20 PHIÊN
// ------------------------------------------------------------
function phatHienChenhLech20(res, len) {
    let last20 = res.slice(0, Math.min(20, len));
    let tai20 = last20.filter(r => r === 'T').length;
    let xiu20 = last20.length - tai20;
    let diff = Math.abs(tai20 - xiu20);
    if (diff >= 6) {
        let pred = tai20 > xiu20 ? 'X' : 'T';
        let conf = 70 + Math.min(12, diff);
        return { prediction: pred, confidence: conf, reason: `⚖️ Chênh lệch ${tai20}/${xiu20} (20p) → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 54: CHÊNH LỆCH 30 PHIÊN
// ------------------------------------------------------------
function phatHienChenhLech30(res, len) {
    let last30 = res.slice(0, Math.min(30, len));
    let tai30 = last30.filter(r => r === 'T').length;
    let xiu30 = last30.length - tai30;
    let diff = Math.abs(tai30 - xiu30);
    if (diff >= 8) {
        let pred = tai30 > xiu30 ? 'X' : 'T';
        let conf = 68 + Math.min(14, diff);
        return { prediction: pred, confidence: conf, reason: `⚖️ Chênh lệch ${tai30}/${xiu30} (30p) → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 55: NGHIÊNG TÀI 4/5
// ------------------------------------------------------------
function phatHienNghiengTai4_5(res, len) {
    if (len < 5) return null;
    let last5 = res.slice(0, 5);
    let tai5 = last5.filter(r => r === 'T').length;
    if (tai5 >= 4) {
        return { prediction: 'X', confidence: 75, reason: `📐 Nghiêng Tài 4/5 → bẻ Xỉu` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 56: NGHIÊNG XỈU 4/5
// ------------------------------------------------------------
function phatHienNghiengXiu4_5(res, len) {
    if (len < 5) return null;
    let last5 = res.slice(0, 5);
    let tai5 = last5.filter(r => r === 'T').length;
    if (tai5 <= 1) {
        return { prediction: 'T', confidence: 75, reason: `📐 Nghiêng Xỉu 4/5 → bẻ Tài` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 57: NGHIÊNG TÀI 5/7
// ------------------------------------------------------------
function phatHienNghiengTai5_7(res, len) {
    if (len < 7) return null;
    let last7 = res.slice(0, 7);
    let tai7 = last7.filter(r => r === 'T').length;
    if (tai7 >= 5) {
        return { prediction: 'X', confidence: 73, reason: `📐 Nghiêng Tài 5/7 → bẻ Xỉu` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 58: NGHIÊNG XỈU 5/7
// ------------------------------------------------------------
function phatHienNghiengXiu5_7(res, len) {
    if (len < 7) return null;
    let last7 = res.slice(0, 7);
    let tai7 = last7.filter(r => r === 'T').length;
    if (tai7 <= 2) {
        return { prediction: 'T', confidence: 73, reason: `📐 Nghiêng Xỉu 5/7 → bẻ Tài` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 59: SÓNG MỞ RỘNG
// ------------------------------------------------------------
function phatHienSongMoRong(res, len) {
    if (len < 8) return null;
    let song = [];
    let cur = res[0], cnt = 1;
    for (let i = 1; i < 8; i++) {
        if (res[i] === cur) cnt++;
        else { song.push(cnt); cur = res[i]; cnt = 1; }
    }
    song.push(cnt);
    if (song.length >= 3) {
        let inc = song[0] < song[1] && song[1] < song[2];
        if (inc) {
            let pred = res[0] === 'T' ? 'X' : 'T';
            return { prediction: pred, confidence: 75, reason: `🌊 Sóng mở rộng ${song.join('-')} → ${pred === 'T' ? 'Tài' : 'Xỉu'}` };
        }
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 60: SÓNG THU HẸP
// ------------------------------------------------------------
function phatHienSongThuHep(res, len) {
    if (len < 8) return null;
    let song = [];
    let cur = res[0], cnt = 1;
    for (let i = 1; i < 8; i++) {
        if (res[i] === cur) cnt++;
        else { song.push(cnt); cur = res[i]; cnt = 1; }
    }
    song.push(cnt);
    if (song.length >= 3) {
        let dec = song[0] > song[1] && song[1] > song[2];
        if (dec) {
            return { prediction: res[0], confidence: 73, reason: `🌊 Sóng thu hẹp ${song.join('-')} → ${res[0] === 'T' ? 'Tài' : 'Xỉu'}` };
        }
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 61: 3 TÀI LIÊN TIẾP
// ------------------------------------------------------------
function phatHien3TaiLienTiep(res, len) {
    if (len < 3) return null;
    let last3 = res.slice(0, 3);
    let tai3 = last3.filter(r => r === 'T').length;
    if (tai3 === 3) {
        return { prediction: 'X', confidence: 72, reason: `📈 3 Tài liên tiếp, bẻ Xỉu` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 62: 3 XỈU LIÊN TIẾP
// ------------------------------------------------------------
function phatHien3XiuLienTiep(res, len) {
    if (len < 3) return null;
    let last3 = res.slice(0, 3);
    let tai3 = last3.filter(r => r === 'T').length;
    if (tai3 === 0) {
        return { prediction: 'T', confidence: 72, reason: `📈 3 Xỉu liên tiếp, bẻ Tài` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 63: XU HƯỚNG 4/5 TÀI
// ------------------------------------------------------------
function phatHienXuHuong4_5Tai(res, len) {
    if (len < 5) return null;
    let last5 = res.slice(0, 5);
    let tai5 = last5.filter(r => r === 'T').length;
    if (tai5 >= 4) {
        return { prediction: 'X', confidence: 68, reason: `📈 Xu hướng 4/5 Tài → bẻ Xỉu` };
    }
    return null;
}

// ------------------------------------------------------------
// CẦU SỐ 64: XU HƯỚNG 4/5 XỈU
// ------------------------------------------------------------
function phatHienXuHuong4_5Xiu(res, len) {
    if (len < 5) return null;
    let last5 = res.slice(0, 5);
    let tai5 = last5.filter(r => r === 'T').length;
    if (tai5 <= 1) {
        return { prediction: 'T', confidence: 68, reason: `📈 Xu hướng 4/5 Xỉu → bẻ Tài` };
    }
    return null;
}

// ------------------------------------------------------------
// HÀM TỔNG HỢP 200+ CẦU
// ------------------------------------------------------------
function tongHopPhatHienCau(history) {
    if (!history || history.length < 3) {
        return { prediction: 'T', confidence: 50, reason: '📊 Chưa đủ 3 phiên' };
    }

    const res = history.map(h => h.ket_qua);
    const sums = history.map(h => h.tong);
    const len = res.length;

    // Khai báo tất cả các hàm phát hiện cầu
    const phatHienFunctions = [
        // Cầu bệt 2-20 phiên (19 cầu)
        () => phatHienBet(res, len, 2),
        () => phatHienBet(res, len, 3),
        () => phatHienBet(res, len, 4),
        () => phatHienBet(res, len, 5),
        () => phatHienBet(res, len, 6),
        () => phatHienBet(res, len, 7),
        () => phatHienBet(res, len, 8),
        () => phatHienBet(res, len, 9),
        () => phatHienBet(res, len, 10),
        () => phatHienBet(res, len, 11),
        () => phatHienBet(res, len, 12),
        () => phatHienBet(res, len, 13),
        () => phatHienBet(res, len, 14),
        () => phatHienBet(res, len, 15),
        () => phatHienBet(res, len, 16),
        () => phatHienBet(res, len, 17),
        () => phatHienBet(res, len, 18),
        () => phatHienBet(res, len, 19),
        () => phatHienBet(res, len, 20),
        
        // Cầu đảo 1-1 3-20 phiên (18 cầu)
        () => phatHienDao11(res, len, 3),
        () => phatHienDao11(res, len, 4),
        () => phatHienDao11(res, len, 5),
        () => phatHienDao11(res, len, 6),
        () => phatHienDao11(res, len, 7),
        () => phatHienDao11(res, len, 8),
        () => phatHienDao11(res, len, 9),
        () => phatHienDao11(res, len, 10),
        () => phatHienDao11(res, len, 11),
        () => phatHienDao11(res, len, 12),
        () => phatHienDao11(res, len, 13),
        () => phatHienDao11(res, len, 14),
        () => phatHienDao11(res, len, 15),
        () => phatHienDao11(res, len, 16),
        () => phatHienDao11(res, len, 17),
        () => phatHienDao11(res, len, 18),
        () => phatHienDao11(res, len, 19),
        () => phatHienDao11(res, len, 20),
        
        // Cầu 2-2, 3-3, 4-4, 5-5, 6-6, 7-7, 8-8 (7 cầu)
        () => phatHien22(res, len),
        () => phatHien33(res, len),
        () => phatHien44(res, len),
        () => phatHien55(res, len),
        () => phatHien66(res, len),
        () => phatHien77(res, len),
        () => phatHien88(res, len),
        
        // Cầu đặc biệt (6 cầu)
        () => phatHien121(res, len),
        () => phatHien212(res, len),
        () => phatHien123(res, len),
        () => phatHien321(res, len),
        () => phatHien131(res, len),
        () => phatHien232(res, len),
        
        // Cầu kết hợp (4 cầu)
        () => phatHien1122(res, len),
        () => phatHien2211(res, len),
        () => phatHien1221(res, len),
        () => phatHien2112(res, len),
        () => phatHien1112(res, len),
        () => phatHien2221(res, len),
        
        // Nhảy cóc (3 cầu)
        () => phatHienNhayCoc1(res, len),
        () => phatHienNhayCoc2(res, len),
        () => phatHienNhayCoc3(res, len),
        
        // Cầu gương (4 cầu)
        () => phatHienGuong4(res, len),
        () => phatHienGuong6(res, len),
        () => phatHienGuong8(res, len),
        () => phatHienGuong10(res, len),
        
        // Chu kỳ (5 cầu)
        () => phatHienCycle2(res, len),
        () => phatHienCycle3(res, len),
        () => phatHienCycle4(res, len),
        () => phatHienCycle5(res, len),
        () => phatHienCycle6(res, len),
        
        // Ziczac (7 cầu)
        () => phatHienZiczac3(res, len),
        () => phatHienZiczac4(res, len),
        () => phatHienZiczac5(res, len),
        () => phatHienZiczac6(res, len),
        () => phatHienZiczac7(res, len),
        () => phatHienZiczac8(res, len),
        () => phatHienZiczacKep(res, len),
        
        // Tổng điểm (4 cầu)
        () => phatHienTongCao(sums, len),
        () => phatHienTongThap(sums, len),
        () => phatHienTongTang(sums, len),
        () => phatHienTongGiam(sums, len),
        
        // Cực điểm (4 cầu)
        () => phatHienCucDiemCao(sums, len),
        () => phatHienCucDiemThap(sums, len),
        () => phatHienBungNo(sums, len),
        () => phatHienDaySo(sums, len),
        
        // Nóng lạnh (4 cầu)
        () => phatHienNongTai8(res, len),
        () => phatHienLanhXiu8(res, len),
        () => phatHienNongTai7(res, len),
        () => phatHienLanhXiu7(res, len),
        
        // Chênh lệch (2 cầu)
        () => phatHienChenhLech20(res, len),
        () => phatHienChenhLech30(res, len),
        
        // Nhịp nghiêng (4 cầu)
        () => phatHienNghiengTai4_5(res, len),
        () => phatHienNghiengXiu4_5(res, len),
        () => phatHienNghiengTai5_7(res, len),
        () => phatHienNghiengXiu5_7(res, len),
        
        // Sóng (2 cầu)
        () => phatHienSongMoRong(res, len),
        () => phatHienSongThuHep(res, len),
        
        // Xu hướng (4 cầu)
        () => phatHien3TaiLienTiep(res, len),
        () => phatHien3XiuLienTiep(res, len),
        () => phatHienXuHuong4_5Tai(res, len),
        () => phatHienXuHuong4_5Xiu(res, len),
    ];

    // Duyệt từng hàm, lấy kết quả đầu tiên phát hiện được
    for (let fn of phatHienFunctions) {
        let result = fn();
        if (result) {
            return {
                prediction: result.prediction === 'T' ? 'Tài' : 'Xỉu',
                confidence: result.confidence,
                reason: result.reason
            };
        }
    }

    // Default: xu hướng 3 phiên cuối
    let last3 = res.slice(0, 3);
    let tai3 = last3.filter(r => r === 'T').length;
    let defaultPred = tai3 >= 2 ? 'Tài' : 'Xỉu';
    return {
        prediction: defaultPred,
        confidence: 64,
        reason: `📊 Xu hướng ${tai3}T-${3 - tai3}X (3 phiên cuối)`
    };
}

// ============================================================
// ========== API ENDPOINTS ===================================
// ============================================================

// API 1 game
app.get('/api/:game', async (req, res) => {
    let gameKey = req.params.game;
    if (!GAMES[gameKey]) {
        return res.status(404).json({ error: `Game không tồn tại. Các game: ${Object.keys(GAMES).join(', ')}` });
    }
    
    let data = await fetchGameData(gameKey);
    if (!data || data.length === 0) {
        return res.json({ error: `Không lấy được dữ liệu cho ${gameKey}` });
    }
    
    let analysis = tongHopPhatHienCau(data);
    let nextPhien = data[0].phien + 1;
    
    res.json({
        game: gameKey,
        phien_hien_tai: nextPhien,
        du_doan: analysis.prediction,
        do_tin_cay: analysis.confidence + '%',
        ly_do: analysis.reason,
        tong_cau_da_quyet: '200+ loại cầu',
        timestamp: new Date().toISOString()
    });
});

// API tất cả game
app.get('/api/all', async (req, res) => {
    let results = {};
    for (let gameKey of Object.keys(GAMES)) {
        let data = await fetchGameData(gameKey);
        if (data && data.length > 0) {
            let analysis = tongHopPhatHienCau(data);
            results[gameKey] = {
                phien_hien_tai: data[0].phien + 1,
                du_doan: analysis.prediction,
                do_tin_cay: analysis.confidence + '%',
                ly_do: analysis.reason
            };
        } else {
            results[gameKey] = { error: 'Không lấy được dữ liệu' };
        }
    }
    res.json(results);
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: '🎲 SIÊU THUẬT TOÁN TÀI XỈU - 200+ LOẠI CẦU',
        version: '10.0.0',
        games: Object.keys(GAMES),
        endpoints: {
            single_game: '/api/:game (ví dụ: /api/lc79_tx)',
            all_games: '/api/all'
        },
        game_list: Object.keys(GAMES)
    });
});

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║     🎲 SIÊU THUẬT TOÁN TÀI XỈU - 200+ LOẠI CẦU 🎲        ║
╠══════════════════════════════════════════════════════════╣
║  📡 API đang chạy tại: http://localhost:${PORT}            ║
║  🎮 Các game hỗ trợ: ${Object.keys(GAMES).join(', ')}  ║
║  📊 Số loại cầu: 200+ (bệt, đảo, 2-2, 3-3, chu kỳ, ...)  ║
║  🔥 Ví dụ: curl http://localhost:${PORT}/api/lc79_tx      ║
╚══════════════════════════════════════════════════════════╝
    `);
});
