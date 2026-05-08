const express = require('express');
const axios = require('axios');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3000;

// ==================== CẤU HÌNH 5 GAME ====================
const GAMES = {
    sunwin: {
        name: 'Sun Win',
        api_url: 'https://sun-win.onrender.com/api/history',
        type: 'sun_format',
        active: true,
        history_file: 'history_sunwin.json'
    },
    b52: {
        name: 'B52',
        api_url: 'https://b52-qiw2.onrender.com/api/history',
        type: 'b52_format',
        active: true,
        history_file: 'history_b52.json'
    },
    tele68_tx: {
        name: 'Tele68 TX',
        api_url: 'https://wtx.tele68.com/v1/tx/sessions',
        type: 'tele68_format',
        active: true,
        history_file: 'history_tele68_tx.json'
    },
    tele68_md5: {
        name: 'Tele68 MD5',
        api_url: 'https://wtxmd52.tele68.com/v1/txmd5/sessions',
        type: 'tele68_format',
        active: true,
        history_file: 'history_tele68_md5.json'
    },
    xocdia88: {
        name: 'XocDia88',
        api_url: 'https://taixiu.system32-cloudfare-356783752985678522.monster/api/luckydice/GetSoiCau',
        type: 'xocdia_format',
        active: true,
        history_file: 'history_xocdia88.json'
    }
};

// Store predictions
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

// ==================== 50+ LOẠI CẦU ====================
function phatHienCau(history) {
    if (!history || history.length < 3) {
        return { prediction: 'Tài', confidence: 50, reason: '📊 Chưa đủ 3 phiên' };
    }

    const res = history.map(h => h.ket_qua);
    const sums = history.map(h => h.tong);
    const len = res.length;

    // 1. Bệt 2-15 phiên
    for (let l = 2; l <= 15; l++) {
        if (len < l) continue;
        let ok = true;
        for (let i = 1; i < l; i++) if (res[i] !== res[0]) { ok = false; break; }
        if (ok) {
            let conf = Math.min(92, 50 + l * 3);
            return { prediction: res[0], confidence: conf, reason: `🔴 Bệt ${l} phiên ${res[0]}` };
        }
    }

    // 2. Đảo 1-1 dài
    for (let l = 3; l <= 15; l++) {
        if (len < l) continue;
        let ok = true;
        for (let i = 1; i < l; i++) if (res[i] === res[i-1]) { ok = false; break; }
        if (ok) {
            let pred = res[l-1] === 'Tài' ? 'Xỉu' : 'Tài';
            let conf = Math.min(88, 55 + l * 2);
            return { prediction: pred, confidence: conf, reason: `🟡 Đảo 1-1 dài ${l} nhịp → ${pred}` };
        }
    }

    // 3. Cầu 2-2
    if (len >= 4 && res[0] === res[1] && res[1] !== res[2] && res[2] === res[3]) {
        let pred = res[2] === 'Tài' ? 'Xỉu' : 'Tài';
        return { prediction: pred, confidence: 82, reason: `🟢 Cầu 2-2` };
    }

    // 4. Cầu 3-3
    if (len >= 6 && res[0] === res[1] && res[1] === res[2] && res[3] === res[4] && res[4] === res[5] && res[0] !== res[3]) {
        let pred = res[3] === 'Tài' ? 'Xỉu' : 'Tài';
        return { prediction: pred, confidence: 85, reason: `🟣 Cầu 3-3` };
    }

    // 5. Cầu 4-4
    if (len >= 8 && res[0]===res[1] && res[1]===res[2] && res[2]===res[3] && 
        res[4]===res[5] && res[5]===res[6] && res[6]===res[7] && res[0] !== res[4]) {
        let pred = res[4] === 'Tài' ? 'Xỉu' : 'Tài';
        return { prediction: pred, confidence: 87, reason: `🟣 Cầu 4-4` };
    }

    // 6. Cầu 1-2-1
    if (len >= 4 && res[0] !== res[1] && res[1] === res[2] && res[2] !== res[3] && res[0] === res[3]) {
        return { prediction: res[0], confidence: 86, reason: `🎯 Cầu 1-2-1` };
    }

    // 7. Cầu 2-1-2
    if (len >= 5 && res[0] === res[1] && res[1] !== res[2] && res[2] === res[3] && res[3] !== res[4] && res[0] !== res[2]) {
        let pred = res[0] === 'Tài' ? 'Xỉu' : 'Tài';
        return { prediction: pred, confidence: 87, reason: `🎯 Cầu 2-1-2` };
    }

    // 8. Cầu 1-2-3 (tăng)
    if (len >= 6 && res[0]===res[1] && res[1]===res[2] && res[3]===res[4] && res[0] !== res[3] && res[3] !== res[5]) {
        return { prediction: res[5], confidence: 83, reason: `📈 Cầu 1-2-3` };
    }

    // 9. Cầu 3-2-1 (giảm)
    if (len >= 6 && res[0]===res[1] && res[2]===res[3] && res[3]===res[4] && res[0] !== res[2] && res[2] !== res[5]) {
        return { prediction: res[2], confidence: 83, reason: `📉 Cầu 3-2-1` };
    }

    // 10. Cầu 1-1-2-2
    if (len >= 4 && res[0] === res[1] && res[2] === res[3] && res[0] !== res[2]) {
        let pred = res[2] === 'Tài' ? 'Xỉu' : 'Tài';
        return { prediction: pred, confidence: 81, reason: `🔷 Cầu 1-1-2-2` };
    }

    // 11. Cầu 2-2-1-1
    if (len >= 4 && res[0] !== res[1] && res[1] === res[2] && res[2] === res[3]) {
        return { prediction: res[0], confidence: 81, reason: `🔶 Cầu 2-2-1-1` };
    }

    // 12. Cầu 1-2-2-1
    if (len >= 6 && res[0] !== res[1] && res[1] === res[2] && res[2] === res[3] && res[3] !== res[4] && res[4] === res[5] && res[0] !== res[1]) {
        return { prediction: res[0], confidence: 85, reason: `🦋 Cầu 1-2-2-1` };
    }

    // 13. Cầu 2-1-1-2
    if (len >= 6 && res[0] === res[1] && res[1] !== res[2] && res[2] === res[3] && res[3] !== res[4] && res[4] === res[5] && res[0] !== res[2]) {
        return { prediction: res[0], confidence: 85, reason: `🦋 Cầu 2-1-1-2` };
    }

    // 14. Cầu nhảy cóc (cách 1)
    if (len >= 5 && res[0] === res[2] && res[2] === res[4]) {
        return { prediction: res[0], confidence: 79, reason: `🐸 Nhảy cóc 3 bước` };
    }

    // 15. Cầu nhảy cóc (cách 2)
    if (len >= 7 && res[0] === res[3] && res[3] === res[6]) {
        return { prediction: res[0], confidence: 77, reason: `🐸 Nhảy cóc cách 2 phiên` };
    }

    // 16. Cầu gương 4
    if (len >= 4 && res[0] === res[3] && res[1] === res[2]) {
        let pred = res[1] === 'Tài' ? 'Xỉu' : 'Tài';
        return { prediction: pred, confidence: 79, reason: `🪞 Cầu gương 4` };
    }

    // 17. Cầu gương 6
    if (len >= 6 && res[0] === res[5] && res[1] === res[4] && res[2] === res[3]) {
        let pred = res[2] === 'Tài' ? 'Xỉu' : 'Tài';
        return { prediction: pred, confidence: 81, reason: `🪞 Cầu gương 6` };
    }

    // 18-22. Chu kỳ lặp 2-6
    for (let cycle = 2; cycle <= 6; cycle++) {
        if (len >= cycle * 2) {
            let ok = true;
            for (let i = cycle; i < Math.min(len, cycle * 3); i++) {
                if (res[i] !== res[i % cycle]) { ok = false; break; }
            }
            if (ok) {
                let next = res[len % cycle];
                let conf = 76 - (cycle - 2);
                return { prediction: next, confidence: conf, reason: `🔄 Chu kỳ ${cycle} phiên` };
            }
        }
    }

    // 23. Ziczac dài 6
    if (len >= 6 && res[0]!==res[1] && res[1]!==res[2] && res[2]!==res[3] && res[3]!==res[4] && res[4]!==res[5]) {
        let pred = res[5] === 'Tài' ? 'Xỉu' : 'Tài';
        return { prediction: pred, confidence: 72, reason: `⚡ Ziczac 6 nhịp` };
    }

    // 24. Cầu tổng cao
    if (sums.length >= 5) {
        let avg5 = sums.slice(0,5).reduce((a,b)=>a+b,0)/5;
        if (avg5 >= 13) return { prediction: 'Xỉu', confidence: 73, reason: `📊 Tổng TB cao ${avg5.toFixed(1)}` };
        if (avg5 <= 8) return { prediction: 'Tài', confidence: 73, reason: `📊 Tổng TB thấp ${avg5.toFixed(1)}` };
    }

    // 25. Tổng tăng liên tục
    if (sums.length >= 4 && sums[0] < sums[1] && sums[1] < sums[2] && sums[2] < sums[3]) {
        return { prediction: 'Tài', confidence: 74, reason: `📈 Tổng tăng 4 phiên` };
    }

    // 26. Tổng giảm liên tục
    if (sums.length >= 4 && sums[0] > sums[1] && sums[1] > sums[2] && sums[2] > sums[3]) {
        return { prediction: 'Xỉu', confidence: 74, reason: `📉 Tổng giảm 4 phiên` };
    }

    // 27. Cực điểm cao
    if (sums.slice(0,10).filter(s => s >= 15).length >= 3) {
        return { prediction: 'Xỉu', confidence: 75, reason: `⚡ Cực điểm cao 3 lần/10 phiên` };
    }

    // 28. Cực điểm thấp
    if (sums.slice(0,10).filter(s => s <= 6).length >= 3) {
        return { prediction: 'Tài', confidence: 75, reason: `⚡ Cực điểm thấp 3 lần/10 phiên` };
    }

    // 29. Nóng 7/10
    let last10 = res.slice(0, Math.min(10, len));
    let tai10 = last10.filter(r => r === 'Tài').length;
    if (tai10 >= 7) return { prediction: 'Xỉu', confidence: 79, reason: `🔥 Tài nóng ${tai10}/10` };
    if (tai10 <= 3) return { prediction: 'Tài', confidence: 79, reason: `❄️ Xỉu nóng ${10-tai10}/10` };

    // 30. Chênh lệch 30 phiên
    let last30 = res.slice(0, Math.min(30, len));
    let tai30 = last30.filter(r => r === 'Tài').length;
    let diff = Math.abs(tai30 - (last30.length - tai30));
    if (diff >= 8) {
        let pred = tai30 > last30.length/2 ? 'Xỉu' : 'Tài';
        return { prediction: pred, confidence: 68 + Math.min(15, diff), reason: `⚖️ Chênh ${tai30}/${last30.length-tai30}` };
    }

    // 31-35. Cầu nhịp nghiêng
    if (len >= 5) {
        let last5 = res.slice(0,5);
        let tai5 = last5.filter(r => r === 'Tài').length;
        if (tai5 >= 4) return { prediction: 'Xỉu', confidence: 72, reason: `📐 Nghiêng Tài 4/5` };
        if (tai5 <= 1) return { prediction: 'Tài', confidence: 72, reason: `📐 Nghiêng Xỉu 4/5` };
    }

    // 36. Xu hướng 3 phiên cuối
    let last3 = res.slice(0, 3);
    let tai3 = last3.filter(r => r === 'Tài').length;
    return { 
        prediction: tai3 >= 2 ? 'Tài' : 'Xỉu', 
        confidence: 63, 
        reason: `📈 Xu hướng 3 phiên (${tai3}T-${3-tai3}X)` 
    };
}

// ==================== DỰ ĐOÁN ====================
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
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>🎲 Tài Xỉu Dashboard</title><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:system-ui, -apple-system, 'Segoe UI', sans-serif;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);min-height:100vh;color:#eee;padding:20px}
        .container{max-width:1400px;margin:0 auto}
        h1{text-align:center;margin-bottom:20px;font-size:clamp(1.5rem,5vw,2rem);background:linear-gradient(135deg,#f093fb,#f5576c);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .games-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px;margin-bottom:30px}
        .game-card{background:rgba(255,255,255,0.1);backdrop-filter:blur(10px);border-radius:24px;padding:20px;border:1px solid rgba(255,255,255,0.1);transition:transform .2s}
        .game-card:hover{transform:translateY(-5px)}
        .game-name{font-size:1.2rem;font-weight:bold;margin-bottom:15px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;gap:10px}
        .prediction-box{background:linear-gradient(135deg,#667eea,#764ba2);border-radius:20px;padding:15px;text-align:center;margin:15px 0}
        .prediction-value{font-size:2rem;font-weight:800;margin:10px 0;letter-spacing:2px}
        .confidence{font-size:.85rem;opacity:.9}
        .reason{font-size:.7rem;margin-top:10px;opacity:.8;background:rgba(0,0,0,0.2);display:inline-block;padding:5px 12px;border-radius:20px}
        .btn{background:rgba(255,255,255,0.2);border:none;padding:8px 15px;border-radius:25px;color:white;cursor:pointer;margin-top:8px;width:100%;transition:.2s;font-size:.75rem}
        .btn:hover{background:rgba(255,255,255,0.3)}
        .btn-reset{background:rgba(239,68,68,0.3)}
        .btn-reset:hover{background:rgba(239,68,68,0.5)}
        .status-dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#22c55e;animation:pulse 1s infinite;margin-right:8px}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .update-time{font-size:.7rem;text-align:center;margin-top:20px;color:#aaa}
        .history-section{background:rgba(0,0,0,0.3);border-radius:20px;padding:20px;margin-top:20px;overflow-x:auto;max-height:500px;overflow-y:auto}
        select{background:rgba(0,0,0,0.5);color:#fff;border:1px solid rgba(255,255,255,0.2);padding:10px;border-radius:10px;margin-bottom:15px;width:200px}
        table{width:100%;border-collapse:collapse;font-size:.75rem}
        th,td{padding:8px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.1)}
        th{background:rgba(255,255,255,0.05);position:sticky;top:0}
        .tai{color:#f87171;font-weight:bold}
        .xiu{color:#60a5fa;font-weight:bold}
        .loading{text-align:center;padding:40px;color:#aaa}
        @media (max-width:640px){.games-grid{grid-template-columns:1fr}th,td{font-size:.65rem;padding:5px}}
    </style>
    </head>
    <body>
        <div class="container">
            <h1>🎲 DASHBOARD TÀI XỈU - 5 GAME + 36 CẦU</h1>
            <div style="text-align:center;margin-bottom:15px"><span class="status-dot"></span> <span id="updateTimer">Đang cập nhật...</span></div>
            <div class="games-grid" id="gamesGrid"><div class="loading">Đang tải...</div></div>
            <div class="history-section">
                <h3 style="margin-bottom:15px">📜 LỊCH SỬ DỰ ĐOÁN</h3>
                <select id="gameSelect" onchange="loadHistory()"><option value="">-- Chọn game --</option></select>
                <div id="historyContainer">Chọn game để xem lịch sử</div>
            </div>
            <div class="update-time" id="updateTime"></div>
        </div>
        <script>
            const games = ${JSON.stringify(Object.keys(GAMES).map(k=>({key:k,name:GAMES[k].name})))};
            async function loadAll(){try{
                const res=await fetch('/api/all-predictions');const data=await res.json();
                if(data.success){renderGames(data.predictions);document.getElementById('updateTime').innerHTML='🕐 '+new Date().toLocaleString()}
            }catch(e){}}
            function renderGames(preds){let html='';
                for(const[key,pred]of Object.entries(preds)){
                    let color=pred.du_doan==='Tài'?'#f87171':'#60a5fa';
                    html+=\`<div class="game-card"><div class="game-name">🎮 \${pred.game}</div>
                    <div class="prediction-box"><div class="prediction-value" style="color:\${color}">\${pred.du_doan}</div>
                    <div class="confidence">🎯 Độ tin cậy: \${pred.ty_le}</div>
                    <div class="reason">📐 \${pred.ly_do}</div>
                    <div class="reason" style="margin-top:5px">📌 Phiên: #\${pred.phien_hien_tai}</div></div>
                    <button class="btn" onclick="refresh('\${key}')">🔄 Dự đoán lại</button>
                    <button class="btn btn-reset" onclick="resetHistory('\${key}')">🗑️ Reset lịch sử</button></div>\`;
                }document.getElementById('gamesGrid').innerHTML=html;
                let opts='<option value="">-- Chọn game --</option>';
                for(let g of games)opts+=\`<option value="\${g.key}">\${g.name}</option>\`;
                document.getElementById('gameSelect').innerHTML=opts;
            }
            async function refresh(key){try{
                let btn=event.target;btn.textContent='⏳';btn.disabled=true;
                await fetch('/api/predict/'+key);loadAll();
                btn.textContent='🔄 Dự đoán lại';btn.disabled=false;
            }catch(e){}}
            async function resetHistory(key){if(!confirm('Xóa lịch sử?'))return;
                await fetch('/api/reset/'+key,{method:'POST'});loadAll();if(document.getElementById('gameSelect').value===key)loadHistory();
            }
            async function loadHistory(){let key=document.getElementById('gameSelect').value;
                if(!key){document.getElementById('historyContainer').innerHTML='Chọn game';return;}
                let res=await fetch('/api/history/'+key);let data=await res.json();
                if(data.success&&data.history?.length){let html='<table><thead><th>Thời gian</th><th>Phiên</th><th>Dự đoán</th><th>Tỉ lệ</th><th>Cầu</th></thead><tbody>';
                    for(let h of data.history){
                        let cls=h.du_doan==='Tài'?'tai':'xiu';
                        html+=\`<tr><td>\${new Date(h.timestamp).toLocaleString()}</td><td>#\${h.phien}</td><td class="\${cls}">\${h.du_doan}</td><td>\${h.ty_le}</td><td style="font-size:.65rem">\${h.ly_do}</td></tr>\`;
                    }html+='</tbody></table>';document.getElementById('historyContainer').innerHTML=html;
                }else document.getElementById('historyContainer').innerHTML='<div style="text-align:center;padding:20px">Chưa có dữ liệu</div>';
            }
            let count=15;
            function timer(){document.getElementById('updateTimer').innerHTML='⏱️ Cập nhật sau: '+count+' giây';count--;if(count<0){count=15;loadAll();}}
            loadAll();setInterval(timer,1000);
        </script>
    </body>
    </html>
    `);
});

app.get('/api/all-predictions', async (req, res) => {
    let predictions = {};
    for (let key of Object.keys(GAMES)) {
        if (!GAMES[key].active) continue;
        predictions[key] = await getPredictionForGame(key);
    }
    res.json({ success: true, predictions, timestamp: new Date().toISOString() });
});

app.get('/api/predict/:gameKey', async (req, res) => {
    let result = await getPredictionForGame(req.params.gameKey);
    res.json(result);
});

app.get('/api/history/:gameKey', (req, res) => {
    let key = req.params.gameKey;
    res.json({ success: true, game: GAMES[key]?.name, history: predictionsDB[key] || [] });
});

app.post('/api/reset/:gameKey', (req, res) => {
    let key = req.params.gameKey;
    predictionsDB[key] = [];
    saveHistory(key);
    res.json({ success: true, game: GAMES[key]?.name, message: 'Đã reset' });
});

app.get('/api/games', (req, res) => {
    let games = {};
    for (let [k, v] of Object.entries(GAMES)) games[k] = { name: v.name, active: v.active };
    res.json({ success: true, games });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 DASHBOARD TÀI XỈU - PORT ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log(`\n📡 API:`);
    console.log(`   GET /api/all-predictions`);
    console.log(`   GET /api/predict/:gameKey`);
    console.log(`   GET /api/history/:gameKey`);
    console.log(`   POST /api/reset/:gameKey`);
    console.log(`\n🎮 5 GAME + 36 LOẠI CẦU\n`);
});
