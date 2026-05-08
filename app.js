const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const API_URL = 'https://wtx.tele68.com/v1/tx/sessions';
const HISTORY_FILE = 'predictions_safe.json';

let predictionsDB = [];
let lastFetchTime = 0;
let cachedHistory = null;

// ======================= HÀM KIỂM TRA API (CACHE 5 GIÂY) =======================
async function checkApiStatus() {
    const now = Date.now();
    if (cachedHistory && (now - lastFetchTime) < 5000) {
        return cachedHistory;
    }
    
    try {
        const res = await axios.get(API_URL, { timeout: 8000 });
        if (res.status === 200 && res.data && res.data.list) {
            cachedHistory = res.data.list;
            lastFetchTime = now;
            return cachedHistory;
        }
        return cachedHistory || null;
    } catch(e) {
        console.log('❌ API tele68 lỗi:', e.message);
        return cachedHistory || null;
    }
}

// ======================= 15+ CẦU CHUẨN =======================
function phatHienCau(history) {
    if (!history || history.length < 3) {
        return { prediction: 'Tài', confidence: 50, reason: '📊 Chưa đủ 3 phiên, dự đoán Tài' };
    }
    
    const results = history.map(h => h.resultTruyenThong);
    const len = results.length;
    
    // 1. Bệt 3-8 phiên
    for (let betLen = 3; betLen <= 8; betLen++) {
        if (len < betLen) continue;
        let isBet = true;
        for (let i = 1; i < betLen; i++) {
            if (results[i] !== results[0]) { isBet = false; break; }
        }
        if (isBet) {
            const pred = results[0] === 'TAI' ? 'Tài' : 'Xỉu';
            const conf = Math.min(88, 50 + betLen * 5);
            return { prediction: pred, confidence: conf, reason: `🔴 Cầu bệt ${betLen} phiên ${pred}` };
        }
    }
    
    // 2. Đảo 1-1 (ziczac)
    for (let daoLen = 4; daoLen <= 12; daoLen++) {
        if (len < daoLen) continue;
        let isDao = true;
        for (let i = 1; i < daoLen; i++) {
            if (results[i] === results[i-1]) { isDao = false; break; }
        }
        if (isDao) {
            const pred = results[daoLen-1] === 'TAI' ? 'Xỉu' : 'Tài';
            const conf = Math.min(85, 55 + daoLen * 2.5);
            return { prediction: pred, confidence: conf, reason: `🟡 Cầu đảo 1-1 dài ${daoLen} nhịp → ${pred}` };
        }
    }
    
    // 3. Cầu 2-2
    if (len >= 4) {
        const a = results[0] === 'TAI' ? 'T' : 'X';
        const b = results[1] === 'TAI' ? 'T' : 'X';
        const c = results[2] === 'TAI' ? 'T' : 'X';
        const d = results[3] === 'TAI' ? 'T' : 'X';
        if (a === b && b !== c && c === d) {
            const pred = c === 'T' ? 'Xỉu' : 'Tài';
            return { prediction: pred, confidence: 80, reason: `🟢 Cầu 2-2 (${a}${b}${c}${d}) → ${pred}` };
        }
    }
    
    // 4. Cầu 3-3
    if (len >= 6) {
        const a = results[0] === 'TAI' ? 'T' : 'X';
        const b = results[3] === 'TAI' ? 'T' : 'X';
        const ok1 = results[0] === results[1] && results[1] === results[2];
        const ok2 = results[3] === results[4] && results[4] === results[5];
        if (ok1 && ok2 && a !== b) {
            const pred = b === 'T' ? 'Xỉu' : 'Tài';
            return { prediction: pred, confidence: 82, reason: `🟣 Cầu 3-3 (${a.repeat(3)}${b.repeat(3)}) → ${pred}` };
        }
    }
    
    // 5. Cầu 1-2-1
    if (len >= 4) {
        const a = results[0] === 'TAI' ? 'T' : 'X';
        const b = results[1] === 'TAI' ? 'T' : 'X';
        const c = results[2] === 'TAI' ? 'T' : 'X';
        const d = results[3] === 'TAI' ? 'T' : 'X';
        if (a !== b && b === c && c !== d && a === d) {
            const pred = a === 'T' ? 'Tài' : 'Xỉu';
            return { prediction: pred, confidence: 83, reason: `🎯 Cầu 1-2-1 (${a}${b}${c}${d}) → ${pred}` };
        }
    }
    
    // 6. Cầu 2-1-2
    if (len >= 5) {
        const a = results[0] === 'TAI' ? 'T' : 'X';
        const b = results[1] === 'TAI' ? 'T' : 'X';
        const c = results[2] === 'TAI' ? 'T' : 'X';
        const d = results[3] === 'TAI' ? 'T' : 'X';
        const e = results[4] === 'TAI' ? 'T' : 'X';
        if (a === b && b !== c && c === d && d !== e && a !== c) {
            const pred = a === 'T' ? 'Xỉu' : 'Tài';
            return { prediction: pred, confidence: 84, reason: `🎯 Cầu 2-1-2 (${a}${b}${c}${d}${e}) → ${pred}` };
        }
    }
    
    // 7. Cầu nhảy cóc
    if (len >= 5) {
        const v1 = results[0];
        const v2 = results[2];
        const v3 = results[4];
        if (v1 === v2 && v2 === v3) {
            const pred = v1 === 'TAI' ? 'Tài' : 'Xỉu';
            return { prediction: pred, confidence: 76, reason: `🐸 Cầu nhảy cóc 3 bước → ${pred}` };
        }
    }
    
    // 8. Cẩu 1-1-2-2
    if (len >= 4) {
        const a = results[0] === 'TAI' ? 'T' : 'X';
        const b = results[2] === 'TAI' ? 'T' : 'X';
        if (results[0] === results[1] && results[2] === results[3] && results[0] !== results[2]) {
            const pred = b === 'T' ? 'Xỉu' : 'Tài';
            return { prediction: pred, confidence: 78, reason: `🔷 Cầu 1-1-2-2 (${a}${a}${b}${b}) → ${pred}` };
        }
    }
    
    // 9. Nóng 7/10
    const last10 = results.slice(0, Math.min(10, len));
    const tai10 = last10.filter(r => r === 'TAI').length;
    if (tai10 >= 7) {
        return { prediction: 'Xỉu', confidence: 78, reason: `🔥 Tài nóng ${tai10}/10, bẻ Xỉu` };
    }
    if (tai10 <= 3) {
        return { prediction: 'Tài', confidence: 78, reason: `❄️ Xỉu nóng ${10-tai10}/10, bẻ Tài` };
    }
    
    // 10. Chênh lệch 30 phiên
    const last30 = results.slice(0, Math.min(30, len));
    const tai30 = last30.filter(r => r === 'TAI').length;
    const xiu30 = last30.length - tai30;
    const diff = Math.abs(tai30 - xiu30);
    if (diff >= 6) {
        const pred = tai30 > xiu30 ? 'Xỉu' : 'Tài';
        const conf = 68 + Math.min(15, diff);
        return { prediction: pred, confidence: conf, reason: `⚖️ Chênh ${tai30}/${xiu30} (${diff}) → ${pred}` };
    }
    
    // 11. Xu hướng 3 phiên cuối
    const last3 = results.slice(0, 3);
    const tai3 = last3.filter(r => r === 'TAI').length;
    const pred = tai3 >= 2 ? 'Tài' : 'Xỉu';
    return { 
        prediction: pred, 
        confidence: 62, 
        reason: `📈 Xu hướng 3 phiên cuối (${tai3}T-${3-tai3}X) → ${pred}` 
    };
}

// ======================= LƯU TRỮ =======================
function loadData() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            predictionsDB = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
            console.log(`✅ Loaded ${predictionsDB.length} predictions`);
        }
    } catch(e) { console.log('No existing data'); }
}

function saveData() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(predictionsDB, null, 2));
    } catch(e) { console.log('Save error:', e.message); }
}

function addPrediction(phien, prediction, confidence, reason) {
    if (predictionsDB.some(p => p.phien === phien)) return;
    
    predictionsDB.unshift({
        phien: phien,
        prediction: prediction,
        confidence: confidence + '%',
        reason: reason,
        actual: null,
        result: null,
        time: new Date().toISOString(),
        id: '@tranhoang2286'
    });
    if (predictionsDB.length > 300) predictionsDB = predictionsDB.slice(0, 300);
    saveData();
}

function updateResult(phien, actual) {
    const pred = predictionsDB.find(p => p.phien === phien);
    if (pred && !pred.actual) {
        pred.actual = actual;
        pred.result = pred.prediction === actual ? 'WIN' : 'LOSE';
        saveData();
        return true;
    }
    return false;
}

// ======================= AUTO UPDATE =======================
async function autoUpdateResults() {
    const data = await checkApiStatus();
    if (!data) return;
    for (const session of data) {
        const actual = session.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu';
        updateResult(session.id, actual);
    }
}

// ======================= GIAO DIỆN HTML =======================
function getDashboardHTML() {
    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>🎲 Tài Xỉu Tele68 - Pro</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
            min-height: 100vh;
            color: #fff;
            padding: 16px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .header {
            text-align: center;
            margin-bottom: 24px;
            padding: 16px 20px;
            background: rgba(255,255,255,0.08);
            backdrop-filter: blur(12px);
            border-radius: 32px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .header h1 { font-size: 1.6rem; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .live-badge { display: inline-block; background: #ef4444; padding: 4px 12px; border-radius: 50px; font-size: 0.7rem; font-weight: bold; margin-top: 8px; animation: pulse 1s infinite; }
        .update-timer { font-size: 0.7rem; color: #aaa; margin-top: 6px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 24px; }
        .stat-card { background: rgba(255,255,255,0.08); backdrop-filter: blur(12px); border-radius: 20px; padding: 14px; text-align: center; border: 1px solid rgba(255,255,255,0.05); }
        .stat-card .value { font-size: 1.8rem; font-weight: bold; margin: 6px 0; font-family: monospace; }
        .stat-card .label { color: #aaa; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; }
        .win { color: #4ade80; }
        .lose { color: #f87171; }
        .pending { color: #fbbf24; }
        .prediction-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 40px;
            padding: 28px 20px;
            text-align: center;
            margin-bottom: 24px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .prediction-label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 3px; opacity: 0.8; }
        .prediction-value { font-size: 3.5rem; font-weight: 800; margin: 12px 0; text-shadow: 0 0 20px rgba(0,0,0,0.3); letter-spacing: 4px; }
        .confidence { font-size: 1.1rem; font-weight: 600; }
        .reason { font-size: 0.85rem; opacity: 0.9; margin-top: 10px; background: rgba(0,0,0,0.2); display: inline-block; padding: 6px 16px; border-radius: 40px; }
        .history-section { background: rgba(0,0,0,0.3); backdrop-filter: blur(12px); border-radius: 24px; padding: 16px; overflow-x: auto; }
        .section-title { margin-bottom: 16px; font-size: 1rem; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        th, td { padding: 8px 6px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08); }
        th { background: rgba(255,255,255,0.05); font-weight: 600; }
        .badge-win { background: #22c55e; color: white; padding: 3px 8px; border-radius: 20px; font-size: 0.65rem; display: inline-block; }
        .badge-lose { background: #ef4444; color: white; padding: 3px 8px; border-radius: 20px; font-size: 0.65rem; display: inline-block; }
        .badge-pending { background: #eab308; color: black; padding: 3px 8px; border-radius: 20px; font-size: 0.65rem; display: inline-block; }
        @media (max-width: 640px) {
            .prediction-value { font-size: 2.5rem; }
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
            th, td { font-size: 0.65rem; padding: 6px 3px; }
        }
        .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
        .dot-green { background: #22c55e; }
        .dot-red { background: #ef4444; }
        .dot-yellow { background: #eab308; }
        .text-tai { color: #f87171; font-weight: bold; }
        .text-xiu { color: #60a5fa; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎲 TÀI XỈU TELE68 PRO</h1>
            <div class="live-badge">🔴 LIVE 3 GIÂY</div>
            <div class="update-timer" id="timerText">Đang cập nhật...</div>
        </div>
        <div class="stats-grid" id="statsGrid">
            <div class="stat-card"><div class="label">📊 Tổng</div><div class="value" id="totalPred">0</div></div>
            <div class="stat-card"><div class="label">✅ Thắng</div><div class="value win" id="totalWin">0</div></div>
            <div class="stat-card"><div class="label">❌ Thua</div><div class="value lose" id="totalLose">0</div></div>
            <div class="stat-card"><div class="label">📈 Tỉ lệ</div><div class="value" id="winRate">0%</div></div>
            <div class="stat-card"><div class="label">⏳ Chờ</div><div class="value pending" id="totalPending">0</div></div>
        </div>
        <div class="prediction-card">
            <div class="prediction-label">🎲 DỰ ĐOÁN PHIÊN TIẾP THEO</div>
            <div class="prediction-value" id="prediction">--</div>
            <div class="confidence" id="confidence">🎯 --</div>
            <div class="reason" id="reason">--</div>
        </div>
        <div class="history-section">
            <div class="section-title">📜 LỊCH SỬ 20 PHIÊN GẦN NHẤT</div>
            <div id="historyTable"><div style="text-align:center;padding:20px;">Đang tải...</div></div>
        </div>
    </div>
    <script>
        let countdown = 3;
        async function fetchData() {
            try {
                const response = await fetch('/api/prediction');
                const data = await response.json();
                if (data.success) {
                    document.getElementById('prediction').innerHTML = data.du_doan;
                    document.getElementById('confidence').innerHTML = '🎯 Độ tin cậy: ' + data.do_tin_cay;
                    document.getElementById('reason').innerHTML = '📐 ' + data.ly_do;
                    document.getElementById('totalPred').innerText = data.thong_ke.tong_du_doan;
                    document.getElementById('totalWin').innerText = data.thong_ke.thang;
                    document.getElementById('totalLose').innerText = data.thong_ke.thua;
                    document.getElementById('totalPending').innerText = data.thong_ke.dang_cho;
                    document.getElementById('winRate').innerHTML = data.thong_ke.ti_le_win;
                    const winRate = parseFloat(data.thong_ke.ti_le_win);
                    const winRateEl = document.getElementById('winRate');
                    if (winRate >= 60) winRateEl.style.color = '#4ade80';
                    else if (winRate >= 50) winRateEl.style.color = '#fbbf24';
                    else winRateEl.style.color = '#f87171';
                }
                await loadHistory();
            } catch(e) { console.error(e); }
        }
        async function loadHistory() {
            try {
                const response = await fetch('/api/history');
                const data = await response.json();
                if (data.history && data.history.length) {
                    let html = '<table><thead><tr><th>Phiên</th><th>Dự đoán</th><th>Tỉ lệ</th><th>Cầu</th><th>Kết quả</th><th>Status</th></tr></thead><tbody>';
                    for (let i = 0; i < Math.min(data.history.length, 20); i++) {
                        const h = data.history[i];
                        let predClass = h.prediction === 'Tài' ? 'text-tai' : 'text-xiu';
                        let actualHtml = '<span class="badge-pending">⏳ Chờ</span>';
                        let statusHtml = '<span class="badge-pending">⏳</span>';
                        if (h.result === 'WIN') { actualHtml = '<span><span class="dot dot-green"></span>' + h.actual + '</span>'; statusHtml = '<span class="badge-win">✅ WIN</span>'; }
                        else if (h.result === 'LOSE') { actualHtml = '<span><span class="dot dot-red"></span>' + h.actual + '</span>'; statusHtml = '<span class="badge-lose">❌ LOSE</span>'; }
                        else if (h.actual) { actualHtml = '<span><span class="dot dot-yellow"></span>' + h.actual + '</span>'; }
                        html += \`<tr><td>#\${h.phien}</td><td class="\${predClass}"><strong>\${h.prediction}</strong></td><td>\${h.confidence}</td><td style="font-size:0.7rem;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\${h.reason || '--'}</td><td>\${actualHtml}</td><td>\${statusHtml}</td></tr>\`;
                    }
                    html += '</tbody><table>';
                    document.getElementById('historyTable').innerHTML = html;
                } else { document.getElementById('historyTable').innerHTML = '<div style="text-align:center;padding:20px;">Chưa có dữ liệu</div>'; }
            } catch(e) { document.getElementById('historyTable').innerHTML = '<div style="text-align:center;padding:20px;">Lỗi tải</div>'; }
        }
        function updateTimer() { const timerEl = document.getElementById('timerText'); if (timerEl) { timerEl.innerHTML = '⏱️ Cập nhật sau: ' + countdown + ' giây'; } countdown--; if (countdown < 0) { countdown = 3; fetchData(); } }
        fetchData();
        setInterval(updateTimer, 1000);
    </script>
</body>
</html>`;
}

// ======================= API ENDPOINTS =======================
app.get('/', (req, res) => { res.send(getDashboardHTML()); });

app.get('/api/prediction', async (req, res) => {
    try {
        const history = await checkApiStatus();
        if (!history || history.length === 0) return res.status(503).json({ error: 'Tele68 API đang chết' });
        await autoUpdateResults();
        const currentPhien = history[0].id;
        const nextPhien = currentPhien + 1;
        const analysis = phatHienCau(history);
        addPrediction(nextPhien, analysis.prediction, analysis.confidence, analysis.reason);
        const resolved = predictionsDB.filter(p => p.result);
        const won = resolved.filter(p => p.result === 'WIN').length;
        const lost = resolved.filter(p => p.result === 'LOSE').length;
        const pending = predictionsDB.length - resolved.length;
        res.json({ success: true, phien: nextPhien, du_doan: analysis.prediction, do_tin_cay: analysis.confidence + '%', ly_do: analysis.reason, thong_ke: { tong_du_doan: predictionsDB.length, thang: won, thua: lost, dang_cho: pending, ti_le_win: resolved.length ? ((won / resolved.length) * 100).toFixed(1) + '%' : '0%' }, id: '@tranhoang2286' });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/history', async (req, res) => { await autoUpdateResults(); res.json({ success: true, history: predictionsDB, id: '@tranhoang2286' }); });

app.get('/api/stats', async (req, res) => { await autoUpdateResults(); const resolved = predictionsDB.filter(p => p.result); const won = resolved.filter(p => p.result === 'WIN').length; const lost = resolved.filter(p => p.result === 'LOSE').length; res.json({ tong: predictionsDB.length, thang: won, thua: lost, ti_le: resolved.length ? ((won / resolved.length) * 100).toFixed(2) + '%' : '0%', id: '@tranhoang2286' }); });

app.get('/reset', (req, res) => { predictionsDB = []; saveData(); res.json({ success: true, message: 'Đã xóa lịch sử', id: '@tranhoang2286' }); });

// ======================= START =======================
loadData();
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n🚀 DASHBOARD TELE68 - PORT ${PORT}`);
    console.log(`🌐 Mở trình duyệt: http://localhost:${PORT}`);
    console.log(`👤 ID: @tranhoang2286\n`);
    await autoUpdateResults();
});
