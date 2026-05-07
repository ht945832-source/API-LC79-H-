const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const API_URL = 'https://wtx.tele68.com/v1/tx/sessions';
const HISTORY_FILE = 'predictions.json';

let predictionsDB = [];

// ======================= THƯ VIỆN CẦU =======================

// 1. Cầu Bệt (2-15 phiên)
function phatHienBet(results, minLen) {
    if (results.length < minLen) return null;
    let streak = 1;
    for (let i = 1; i < minLen; i++) {
        if (results[i] === results[0]) streak++;
        else return null;
    }
    return {
        type: 'Cầu Bệt',
        prediction: results[0] === 'TAI' ? 'Tài' : 'Xỉu',
        confidence: Math.min(88, 50 + minLen * 4),
        detail: `${minLen} phiên ${results[0] === 'TAI' ? 'Tài' : 'Xỉu'} liên tiếp`
    };
}

// 2. Cầu 1-1 (Ziczac chuẩn)
function phatHienZiczac11(results, len) {
    if (results.length < len) return null;
    for (let i = 0; i < len - 1; i++) {
        if (results[i] === results[i+1]) return null;
    }
    let last = results[len-1];
    let next = last === 'TAI' ? 'Xỉu' : 'Tài';
    return {
        type: 'Cầu 1-1 (Ziczac)',
        prediction: next,
        confidence: Math.min(85, 55 + len * 2.5),
        detail: `Đảo ${len} phiên liên tiếp, chạm đuôi ${last === 'TAI' ? 'Tài' : 'Xỉu'}`
    };
}

// 3. Cầu 2-2 (TTXX TTXX)
function phatHien22(results, capSo) {
    if (results.length < capSo * 2) return null;
    let pattern = [];
    for (let i = 0; i < capSo * 2; i += 2) {
        if (results[i] !== results[i+1]) return null;
        pattern.push(results[i]);
    }
    for (let i = 1; i < pattern.length; i++) {
        if (pattern[i] === pattern[i-1]) return null;
    }
    let lastPair = pattern[pattern.length-1];
    return {
        type: 'Cầu 2-2',
        prediction: lastPair === 'TAI' ? 'Xỉu' : 'Tài',
        confidence: Math.min(84, 60 + capSo * 3),
        detail: `${capSo} cặp đảo (${pattern.map(p => p === 'TAI' ? 'T' : 'X').join('')})`
    };
}

// 4. Cầu 3-3
function phatHien33(results, blocks) {
    if (results.length < blocks * 3) return null;
    let triples = [];
    for (let i = 0; i < blocks * 3; i += 3) {
        if (results[i] !== results[i+1] || results[i+1] !== results[i+2]) return null;
        triples.push(results[i]);
    }
    for (let i = 1; i < triples.length; i++) {
        if (triples[i] === triples[i-1]) return null;
    }
    let lastBlock = triples[triples.length-1];
    return {
        type: 'Cầu 3-3',
        prediction: lastBlock === 'TAI' ? 'Xỉu' : 'Tài',
        confidence: Math.min(86, 62 + blocks * 2.5),
        detail: `${blocks} bộ ba đảo`
    };
}

// 5. Cầu 4-4
function phatHien44(results, blocks) {
    if (results.length < blocks * 4) return null;
    let quads = [];
    for (let i = 0; i < blocks * 4; i += 4) {
        if (results[i] !== results[i+1] || results[i+1] !== results[i+2] || results[i+2] !== results[i+3]) return null;
        quads.push(results[i]);
    }
    for (let i = 1; i < quads.length; i++) {
        if (quads[i] === quads[i-1]) return null;
    }
    let lastQuad = quads[quads.length-1];
    return {
        type: 'Cầu 4-4 (Siêu chuẩn)',
        prediction: lastQuad === 'TAI' ? 'Xỉu' : 'Tài',
        confidence: Math.min(88, 65 + blocks * 2),
        detail: `${blocks} bộ bốn đảo`
    };
}

// 6. Cầu 5-5
function phatHien55(results, blocks) {
    if (results.length < blocks * 5) return null;
    let quints = [];
    for (let i = 0; i < blocks * 5; i += 5) {
        let ok = true;
        for (let j = 0; j < 4; j++) {
            if (results[i+j] !== results[i+j+1]) { ok = false; break; }
        }
        if (!ok) return null;
        quints.push(results[i]);
    }
    for (let i = 1; i < quints.length; i++) if (quints[i] === quints[i-1]) return null;
    return {
        type: 'Cầu 5-5 (Sảnh Rồng)',
        prediction: quints[quints.length-1] === 'TAI' ? 'Xỉu' : 'Tài',
        confidence: Math.min(90, 68 + blocks * 1.5),
        detail: `${blocks} bộ năm đảo`
    };
}

// 7. Cầu 1-2-1
function phatHien121(results) {
    if (results.length < 4) return null;
    let a = results[0], b = results[1], c = results[2], d = results[3];
    if (a !== b && b === c && c !== d && a === d) {
        return {
            type: 'Cầu 1-2-1 (Vẩy rồng)',
            prediction: a === 'TAI' ? 'Tài' : 'Xỉu',
            confidence: 82,
            detail: `Mẫu ${a === 'TAI' ? 'T' : 'X'}${b === 'TAI' ? 'T' : 'X'}${c === 'TAI' ? 'T' : 'X'}${d === 'TAI' ? 'T' : 'X'}`
        };
    }
    return null;
}

// 8. Cầu 2-1-2
function phatHien212(results) {
    if (results.length < 5) return null;
    let a = results[0], b = results[1], c = results[2], d = results[3], e = results[4];
    if (a === b && b !== c && c === d && d !== e && a !== c) {
        return {
            type: 'Cầu 2-1-2',
            prediction: a === 'TAI' ? 'Xỉu' : 'Tài',
            confidence: 83,
            detail: `Mẫu ${a === 'TAI' ? 'T' : 'X'}${a === 'TAI' ? 'T' : 'X'}${c === 'TAI' ? 'T' : 'X'}${c === 'TAI' ? 'T' : 'X'}${e === 'TAI' ? 'T' : 'X'}`
        };
    }
    return null;
}

// 9. Cầu 1-2-3 (tăng dần block)
function phatHien123(results) {
    if (results.length < 6) return null;
    let block1 = results[0] === results[1] && results[1] === results[2];
    let block2 = results[3] === results[4];
    let check = results[5];
    if (block1 && block2 && results[0] !== results[3] && results[3] !== check) {
        return {
            type: 'Cầu 1-2-3 (Thang máy)',
            prediction: check === 'TAI' ? 'Tài' : 'Xỉu',
            confidence: 80,
            detail: `3T/3X - 2T/2X - 1 (${check === 'TAI' ? 'Tài' : 'Xỉu'})`
        };
    }
    return null;
}

// 10. Cầu 3-2-1
function phatHien321(results) {
    if (results.length < 6) return null;
    let block1 = results[0] === results[1];
    let block2 = results[2] === results[3] && results[3] === results[4];
    let check = results[5];
    if (block1 && block2 && results[0] !== results[2] && results[2] !== check) {
        return {
            type: 'Cầu 3-2-1 (Lùi dần)',
            prediction: results[2] === 'TAI' ? 'Tài' : 'Xỉu',
            confidence: 80,
            detail: `1T/1X - 3T/3X - 2 (${check === 'TAI' ? 'Tài' : 'Xỉu'})`
        };
    }
    return null;
}

// 11. Cầu nhảy cóc (cách 1 phiên)
function phatHienNhayCoc(results, step) {
    if (results.length < step * 2 + 1) return null;
    let hops = [];
    for (let i = 0; i <= step * 2; i += step) hops.push(results[i]);
    let allSame = hops.every(h => h === hops[0]);
    if (allSame && hops.length >= 2) {
        return {
            type: `Cầu nhảy cóc bậc ${step}`,
            prediction: hops[0] === 'TAI' ? 'Tài' : 'Xỉu',
            confidence: 75,
            detail: `Cách ${step} phiên, tất cả đều ${hops[0] === 'TAI' ? 'Tài' : 'Xỉu'}`
        };
    }
    let alternating = true;
    for (let i = 1; i < hops.length; i++) if (hops[i] === hops[i-1]) alternating = false;
    if (alternating && hops.length >= 3) {
        let next = hops[hops.length-1] === 'TAI' ? 'Xỉu' : 'Tài';
        return {
            type: `Cầu nhảy cóc bậc ${step} đảo`,
            prediction: next,
            confidence: 78,
            detail: `Cách ${step} phiên, pattern đảo`
        };
    }
    return null;
}

// 12. Cầu gương (palindrome)
function phatHienGuong(results, len) {
    if (results.length < len) return null;
    let slice = results.slice(0, len);
    let ok = true;
    for (let i = 0; i < len / 2; i++) if (slice[i] !== slice[len-1-i]) ok = false;
    if (ok && len % 2 === 0) {
        let mid = len / 2;
        let pred = slice[mid-1] === 'TAI' ? 'Xỉu' : 'Tài';
        return {
            type: `Cầu gương ${len}`,
            prediction: pred,
            confidence: 76,
            detail: `Đối xứng ${slice.map(s => s === 'TAI' ? 'T' : 'X').join('')}`
        };
    }
    return null;
}

// 13. Cầu chu kỳ lặp
function phatHienCycle(results, cycle) {
    if (results.length < cycle * 2) return null;
    let pattern = results.slice(0, cycle);
    for (let i = cycle; i < results.length; i++) {
        if (results[i] !== pattern[i % cycle]) return null;
    }
    let next = pattern[results.length % cycle];
    return {
        type: `Chu kỳ ${cycle} phiên`,
        prediction: next === 'TAI' ? 'Tài' : 'Xỉu',
        confidence: 80,
        detail: `Lặp mỗi ${cycle} phiên (${pattern.map(p => p === 'TAI' ? 'T' : 'X').join('')})`
    };
}

// 14. Cầu cộng dồn tổng
function phatHienSumTrend(data, direction) {
    if (data.length < 3) return null;
    let sums = data.slice(0, 10).map(d => d.point);
    let count = 0;
    for (let i = 0; i < sums.length - 1; i++) {
        if (direction === 'up' && sums[i] < sums[i+1]) count++;
        if (direction === 'down' && sums[i] > sums[i+1]) count++;
    }
    if (count >= sums.length - 2) {
        return {
            type: direction === 'up' ? 'Tổng tăng dần' : 'Tổng giảm dần',
            prediction: direction === 'up' ? 'Tài' : 'Xỉu',
            confidence: 72,
            detail: `Xu hướng ${direction === 'up' ? 'tăng' : 'giảm'} liên tục`
        };
    }
    return null;
}

// 15. Cầu dựa vào xúc xắc
function phatHienDicePattern(data) {
    if (data.length < 3) return null;
    let recent = data.slice(0, 5);
    let highCount = 0, lowCount = 0;
    recent.forEach(d => {
        [d.dices[0], d.dices[1], d.dices[2]].forEach(face => {
            if (face >= 4) highCount++; else lowCount++;
        });
    });
    if (highCount >= 10) return { type: 'Xúc xắc cao (4-5-6)', prediction: 'Xỉu', confidence: 74, detail: `Mặt cao ${highCount}/15 lần` };
    if (lowCount >= 10) return { type: 'Xúc xắc thấp (1-2-3)', prediction: 'Tài', confidence: 74, detail: `Mặt thấp ${lowCount}/15 lần` };
    return null;
}

// 16. Cầu 1-1-2-2
function phatHien1122(results) {
    if (results.length < 4) return null;
    let a = results[0], b = results[1], c = results[2], d = results[3];
    if (a === b && b !== c && c === d) {
        return { type: 'Cầu 1-1-2-2 (Bệt đôi)', prediction: c === 'TAI' ? 'Xỉu' : 'Tài', confidence: 77, detail: `${a === 'TAI' ? 'T' : 'X'}${a === 'TAI' ? 'T' : 'X'}${c === 'TAI' ? 'T' : 'X'}${c === 'TAI' ? 'T' : 'X'}` };
    }
    return null;
}

// 17. Cầu 2-2-1-1
function phatHien2211(results) {
    if (results.length < 4) return null;
    let a = results[0], b = results[1], c = results[2], d = results[3];
    if (a !== b && b === c && c === d) {
        return { type: 'Cầu 2-2-1-1 (Gãy đôi)', prediction: a, confidence: 77, detail: `${a === 'TAI' ? 'T' : 'X'}${b === 'TAI' ? 'T' : 'X'}${b === 'TAI' ? 'T' : 'X'}${b === 'TAI' ? 'T' : 'X'}` };
    }
    return null;
}

// 18. Cầu 1-2-2-1
function phatHien1221(results) {
    if (results.length < 6) return null;
    let a = results[0], b = results[1], c = results[2], d = results[3], e = results[4], f = results[5];
    if (a !== b && b === c && c === d && d !== e && e === f && a !== b) {
        return { type: 'Cầu 1-2-2-1 (Cánh bướm)', prediction: a, confidence: 81, detail: `${a === 'TAI' ? 'T' : 'X'}${b === 'TAI' ? 'T' : 'X'}${b === 'TAI' ? 'T' : 'X'}${b === 'TAI' ? 'T' : 'X'}${e === 'TAI' ? 'T' : 'X'}${a === 'TAI' ? 'T' : 'X'}` };
    }
    return null;
}

// 19. Cầu 2-1-1-2
function phatHien2112(results) {
    if (results.length < 6) return null;
    let a = results[0], b = results[1], c = results[2], d = results[3], e = results[4], f = results[5];
    if (a === b && b !== c && c === d && d !== e && e === f && a !== c) {
        return { type: 'Cầu 2-1-1-2 (Kép đơn kép)', prediction: a, confidence: 81, detail: `${a === 'TAI' ? 'T' : 'X'}${a === 'TAI' ? 'T' : 'X'}${c === 'TAI' ? 'T' : 'X'}${c === 'TAI' ? 'T' : 'X'}${e === 'TAI' ? 'T' : 'X'}${f === 'TAI' ? 'T' : 'X'}` };
    }
    return null;
}

// 20. Cầu 2-3-2
function phatHien232(results) {
    if (results.length < 7) return null;
    let a = results[0], b = results[1], c = results[2], d = results[3], e = results[4], f = results[5], g = results[6];
    if (a === b && a === c && c !== d && d === e && d !== f && f === g && a !== d && d !== f) {
        return { type: 'Cầu 2-3-2', prediction: f === 'TAI' ? 'Xỉu' : 'Tài', confidence: 82, detail: `2 ${a === 'TAI' ? 'T' : 'X'}, 3 ${d === 'TAI' ? 'T' : 'X'}, 2 ${f === 'TAI' ? 'T' : 'X'}` };
    }
    return null;
}

// ======================= TỔNG HỢP TẤT CẢ CẦU =======================
function tongHopCau(history) {
    if (!history || !history.length) return { prediction: 'Tài', confidence: 50, reason: 'Chưa đủ dữ liệu' };
    
    const results = history.map(h => h.resultTruyenThong);
    const data = history;
    let allDetections = [];
    
    // Quét tất cả các loại cầu
    for (let i = 2; i <= 8; i++) {
        let bet = phatHienBet(results, i);
        if (bet) allDetections.push(bet);
    }
    
    for (let i = 3; i <= 10; i++) {
        let zz = phatHienZiczac11(results, i);
        if (zz) allDetections.push(zz);
    }
    
    for (let i = 2; i <= 5; i++) {
        let c22 = phatHien22(results, i);
        if (c22) allDetections.push(c22);
    }
    
    for (let i = 1; i <= 3; i++) {
        let c33 = phatHien33(results, i);
        if (c33) allDetections.push(c33);
        let c44 = phatHien44(results, i);
        if (c44) allDetections.push(c44);
        let c55 = phatHien55(results, i);
        if (c55) allDetections.push(c55);
    }
    
    let c121 = phatHien121(results);
    if (c121) allDetections.push(c121);
    
    let c212 = phatHien212(results);
    if (c212) allDetections.push(c212);
    
    let c123 = phatHien123(results);
    if (c123) allDetections.push(c123);
    
    let c321 = phatHien321(results);
    if (c321) allDetections.push(c321);
    
    for (let step of [2, 3]) {
        let nhay = phatHienNhayCoc(results, step);
        if (nhay) allDetections.push(nhay);
    }
    
    for (let len of [4, 6, 8]) {
        let guong = phatHienGuong(results, len);
        if (guong) allDetections.push(guong);
    }
    
    for (let cycle of [2, 3, 4, 5]) {
        let cyclePat = phatHienCycle(results, cycle);
        if (cyclePat) allDetections.push(cyclePat);
    }
    
    let sumUp = phatHienSumTrend(data, 'up');
    if (sumUp) allDetections.push(sumUp);
    let sumDown = phatHienSumTrend(data, 'down');
    if (sumDown) allDetections.push(sumDown);
    
    let dice = phatHienDicePattern(data);
    if (dice) allDetections.push(dice);
    
    let c1122 = phatHien1122(results);
    if (c1122) allDetections.push(c1122);
    
    let c2211 = phatHien2211(results);
    if (c2211) allDetections.push(c2211);
    
    let c1221 = phatHien1221(results);
    if (c1221) allDetections.push(c1221);
    
    let c2112 = phatHien2112(results);
    if (c2112) allDetections.push(c2112);
    
    let c232 = phatHien232(results);
    if (c232) allDetections.push(c232);
    
    // Nếu không có cầu nào, dùng xu hướng 3 phiên cuối
    if (allDetections.length === 0) {
        let last3 = results.slice(0, 3);
        let tai3 = last3.filter(r => r === 'TAI').length;
        let defaultPred = tai3 >= 2 ? 'Tài' : 'Xỉu';
        return { prediction: defaultPred, confidence: 60, reason: `Xu hướng 3 phiên cuối (${tai3}T-${3-tai3}X)` };
    }
    
    // Chọn cầu có độ tin cậy cao nhất
    let best = allDetections.reduce((max, cur) => cur.confidence > max.confidence ? cur : max, allDetections[0]);
    return {
        prediction: best.prediction,
        confidence: best.confidence,
        reason: `${best.type} (${best.detail})`
    };
}

// ======================= LƯU & CẬP NHẬT KẾT QUẢ =======================
function loadPredictions() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            predictionsDB = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
            console.log(`📂 Đã tải ${predictionsDB.length} dự đoán`);
        }
    } catch(e) { console.error('Lỗi load:', e.message); }
}

function savePredictions() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(predictionsDB, null, 2));
    } catch(e) { console.error('Lỗi lưu:', e.message); }
}

function addPrediction(phien, prediction, confidence, reason) {
    predictionsDB.unshift({
        phien: phien,
        du_doan: prediction,
        ty_le: confidence + '%',
        ly_do: reason,
        ket_qua_thuc_te: null,
        trang_thai: '⏳ Chờ',
        timestamp: new Date().toISOString(),
        id: '@tranhoang2286'
    });
    if (predictionsDB.length > 200) predictionsDB = predictionsDB.slice(0, 200);
    savePredictions();
}

function updatePredictionResult(phien, actualResult) {
    const pred = predictionsDB.find(p => p.phien === phien);
    if (pred && !pred.ket_qua_thuc_te) {
        pred.ket_qua_thuc_te = actualResult;
        pred.trang_thai = (pred.du_doan === actualResult) ? '✅ WIN' : '❌ LOSE';
        savePredictions();
        return true;
    }
    return false;
}

// ======================= FETCH & AUTO VERIFY =======================
async function fetchTele68() {
    try {
        const res = await axios.get(API_URL, { timeout: 10000 });
        if (res.data && res.data.list && res.data.list.length) return res.data.list;
        return null;
    } catch(e) { console.error('Lỗi fetch:', e.message); return null; }
}

async function autoVerify() {
    const history = await fetchTele68();
    if (!history) return;
    for (const session of history) {
        const actual = session.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu';
        updatePredictionResult(session.id, actual);
    }
}

// ======================= API =======================
app.get('/', (req, res) => {
    res.json({ name: 'API Tài Xỉu Tele68 - Full Cầu', version: '4.0', author: '@tranhoang2286', endpoints: ['/du-doan', '/lich-su', '/thong-ke', '/reset'] });
});

app.get('/du-doan', async (req, res) => {
    try {
        const history = await fetchTele68();
        if (!history || history.length === 0) return res.status(503).json({ error: 'Không lấy được dữ liệu' });
        
        await autoVerify();
        const latestPhien = history[0].id;
        const nextPhien = latestPhien + 1;
        const analysis = tongHopCau(history);
        
        addPrediction(nextPhien, analysis.prediction, analysis.confidence, analysis.reason);
        
        const resolved = predictionsDB.filter(p => p.ket_qua_thuc_te !== null);
        const won = resolved.filter(p => p.trang_thai === '✅ WIN').length;
        const lost = resolved.filter(p => p.trang_thai === '❌ LOSE').length;
        
        res.json({
            phien_hien_tai: nextPhien,
            du_doan: analysis.prediction,
            ti_le_tin_cay: analysis.confidence + '%',
            cau_phat_hien: analysis.reason,
            thong_ke: {
                tong: predictionsDB.length,
                thang: won,
                thua: lost,
                ti_le: resolved.length ? ((won / resolved.length) * 100).toFixed(1) + '%' : '0%'
            },
            id: '@tranhoang2286'
        });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/lich-su', async (req, res) => {
    await autoVerify();
    res.json({ type: 'Tele68 Tài Xỉu', tong_so: predictionsDB.length, danh_sach: predictionsDB, id: '@tranhoang2286' });
});

app.get('/thong-ke', async (req, res) => {
    await autoVerify();
    const resolved = predictionsDB.filter(p => p.ket_qua_thuc_te !== null);
    const won = resolved.filter(p => p.trang_thai === '✅ WIN').length;
    const lost = resolved.filter(p => p.trang_thai === '❌ LOSE').length;
    res.json({
        tong_phien: predictionsDB.length,
        da_xong: resolved.length,
        thang: won,
        thua: lost,
        ti_le_thang: resolved.length ? ((won / resolved.length) * 100).toFixed(2) + '%' : '0%',
        id: '@tranhoang2286'
    });
});

app.get('/reset', (req, res) => {
    predictionsDB = [];
    savePredictions();
    res.json({ success: true, message: 'Đã xóa hết', id: '@tranhoang2286' });
});

loadPredictions();
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 API ĐẦY ĐỦ CẦU tại port ${PORT}`);
    console.log(`   Cầu có sẵn: Bệt (2-8), 1-1 (3-10), 2-2 (2-5), 3-3, 4-4, 5-5, 1-2-1, 2-1-2, 1-2-3, 3-2-1, nhảy cóc, gương, chu kỳ, xu hướng tổng, xúc xắc, 1-1-2-2, 2-2-1-1, 1-2-2-1, 2-1-1-2, 2-3-2`);
    setTimeout(() => autoVerify(), 3000);
});
