import { db, ref, set, get, push, update, remove, onValue } from './firebase.js';
import { switchPage, openModal, closeModal, showToast, toggleFab } from './ui.js';

// ================= 1. المتغيرات العامة (State Management) =================
let allBatches = {};
let allTransactions = {};
let allFreezerLogs = {};
let manualCash = 0; 
let currentFeedStock = 0;
let dynamicFreezerConfig = {}; // مصدر الحقيقة لأصناف الفريزر وأسعارها

const birdStandards = {
    quail: { name: 'سمان', icon: '🕊️', hatcher: 15, hatch: 18, slaughter: 35 },
    chicken: { name: 'فراخ بيضاء', icon: '🐔', hatcher: 18, hatch: 21, slaughter: 40 },
    turkey: { name: 'رومي', icon: '🦃', hatcher: 25, hatch: 28, slaughter: 90 }
};

let globalSettings = { 
    birdType: 'quail', feedPrice: 30, 
    quailChick: 3.5, chickenChick: 25, turkeyChick: 60, turkeyEgg: 10 
};

// ================= 2. واجهة المستخدم والتبديل (UI & Modals) =================
window.switchPage = (pageId) => { const e = window.event; switchPage(pageId, e ? e.currentTarget : null); };
window.closeModal = closeModal;
window.toggleFab = toggleFab;
window.showToast = showToast;

window.openModal = (id) => {
    if(id === 'modalBatch') {
        const typeEl = document.getElementById('bBirdType');
        if(typeEl) typeEl.value = globalSettings.birdType || 'quail';
        const dateEl = document.getElementById('bDate');
        if(dateEl) {
            const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            dateEl.value = now.toISOString().slice(0,16);
        }
    } 
    openModal(id);
};

window.switchSettingsTab = (tabId, element) => {
    document.querySelectorAll('.settings-nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.settings-tab').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
};

// ================= 3. إعدادات النظام والمظهر (Settings & Themes) =================
window.setThemeMode = (mode, el) => {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('erp_theme', mode);
    if(el) {
        el.parentElement.querySelectorAll('.theme-option').forEach(s => s.classList.remove('active'));
        el.classList.add('active');
    }
    if(window.renderDashboardChart) window.renderDashboardChart(); 
    showToast(mode === 'dark' ? "تم تفعيل الوضع الليلي 🌙" : "تم تفعيل الوضع الفاتح ☀️");
};

window.setPrimaryColor = (color, el) => {
    document.documentElement.style.setProperty('--primary', color);
    localStorage.setItem('erp_primary_color', color);
    if(el) {
        el.parentElement.querySelectorAll('.color-circle').forEach(s => s.classList.remove('active'));
        el.classList.add('active');
    }
    showToast("تم تغيير لون النظام بنجاح 🎨");
};

onValue(ref(db, "settings"), (snapshot) => {
    if(snapshot.exists()) {
        globalSettings = { ...globalSettings, ...snapshot.val() };
        ['setBirdType', 'setFeed', 'setQuailChick', 'setChickenChick', 'setTurkeyChick', 'setTurkeyEgg'].forEach(id => {
            const el = document.getElementById(id);
            if(el && globalSettings[id.replace('set', '').charAt(0).toLowerCase() + id.replace('set', '').slice(1)]) {
                el.value = globalSettings[id.replace('set', '').charAt(0).toLowerCase() + id.replace('set', '').slice(1)];
            }
        });
    }
});

window.saveSettings = async () => {
    const newSet = {
        birdType: document.getElementById('setBirdType')?.value || 'quail',
        feedPrice: parseFloat(document.getElementById('setFeed')?.value) || 30,
        quailChick: parseFloat(document.getElementById('setQuailChick')?.value) || 3.5,
        chickenChick: parseFloat(document.getElementById('setChickenChick')?.value) || 25,
        turkeyChick: parseFloat(document.getElementById('setTurkeyChick')?.value) || 60,
        turkeyEgg: parseFloat(document.getElementById('setTurkeyEgg')?.value) || 10
    };
    await set(ref(db, 'settings'), newSet); showToast("تم حفظ إعدادات التشغيل 💾");
};

// ================= 4. إدارة المخزون والخزنة =================
onValue(ref(db, "inventory/feedStock"), (snapshot) => {
    currentFeedStock = snapshot.exists() ? parseFloat(snapshot.val()) : 0;
    const el = document.getElementById('feedStockDisplay');
    if(el) el.innerText = currentFeedStock + " كجم";
});

window.buyFeed = async () => {
    const qty = parseFloat(document.getElementById('bfQty')?.value || 0);
    const cost = parseFloat(document.getElementById('bfTotalCost')?.value || 0);
    if(!qty || !cost) return showToast("برجاء إدخال البيانات المطلوبة", true);
    await set(ref(db, "inventory/feedStock"), currentFeedStock + qty);
    await push(ref(db, 'ledger'), { type: 'out', amount: cost, desc: `شراء علف (${qty} كجم)`, batchId: 'general', date: new Date().toISOString().split('T')[0], timestamp: Date.now() });
    await set(ref(db, "cashBox"), manualCash - cost);
    closeModal('modalBuyFeed'); showToast(`تم إضافة ${qty} كجم للمخزن`);
};

onValue(ref(db, "cashBox"), (snapshot) => {
    manualCash = snapshot.exists() ? snapshot.val() : 0;
    const el = document.getElementById('customCashBoxDisplay');
    if(el) el.innerText = manualCash + " ج.م";
});

// ================= 5. إدارة الفريزر الديناميكي =================
onValue(ref(db, "inventory/freezerConfig"), (snapshot) => {
    dynamicFreezerConfig = snapshot.exists() ? snapshot.val() : {};
    
    // تحديث قائمة المبيعات أوتوماتيكياً
    const saleSelect = document.getElementById('sGrade');
    if(saleSelect) {
        saleSelect.innerHTML = '<option value="">-- اختر الصنف --</option>';
        Object.keys(dynamicFreezerConfig).forEach(id => {
            saleSelect.innerHTML += `<option value="${id}">${dynamicFreezerConfig[id].name}</option>`;
        });
    }

    get(ref(db, "inventory/freezerStock")).then(stockSnap => {
        const stock = stockSnap.exists() ? stockSnap.val() : {};
        const grid = document.getElementById('freezerGrid');
        const dashTotal = document.getElementById('dashFreezer');
        if(!grid) return;
        
        grid.innerHTML = ''; let totalCount = 0;
        Object.keys(dynamicFreezerConfig).forEach(id => {
            const item = dynamicFreezerConfig[id]; const qty = stock[id] || 0; totalCount += qty;
            grid.innerHTML += `
                <div class="card" onclick="editFreezerItem('${id}', ${qty}, ${item.price}, '${item.name}')" style="cursor:pointer; text-align:center; padding:15px; margin:0;">
                    <h4 style="margin:0; color:var(--text-secondary); font-size:14px;">${item.name}</h4>
                    <div style="font-size:28px; font-weight:800; color:var(--primary); margin:5px 0;">${qty}</div>
                    <div style="font-size:12px; color:var(--success); font-weight:bold;">${item.price} ج.م</div>
                </div>`;
        });
        if(dashTotal) dashTotal.innerText = totalCount;
    });
});

window.addNewCategory = async () => {
    const name = document.getElementById('newCatName').value;
    const price = parseFloat(document.getElementById('newCatPrice').value);
    if(!name || !price) return showToast("أكمل البيانات", true);
    const id = name.replace(/\s+/g, '_').toLowerCase(); 
    await set(ref(db, `inventory/freezerConfig/${id}`), { name, price });
    await set(ref(db, `inventory/freezerStock/${id}`), 0);
    closeModal('modalAddCategory'); showToast("تم إضافة الصنف الجديد");
};

window.editFreezerItem = (id, currentStock, currentPrice, name) => {
    const newQty = prompt(`تعديل رصيد صنف (${name}):`, currentStock);
    const newPrice = prompt(`تعديل سعر صنف (${name}):`, currentPrice);
    if(newQty !== null && newPrice !== null) {
        update(ref(db, `inventory/freezerStock`), { [id]: parseInt(newQty) });
        update(ref(db, `inventory/freezerConfig/${id}`), { price: parseFloat(newPrice) });
        showToast("تم تحديث الصنف بنجاح");
    }
};

onValue(ref(db, "inventory/freezerLogs"), (snapshot) => {
    allFreezerLogs = snapshot.exists() ? snapshot.val() : {}; 
    const logsEl = document.getElementById('freezerLogs');
    if(!logsEl) return;
    
    let html = ''; const now = new Date();
    Object.keys(allFreezerLogs).sort((a,b)=> new Date(allFreezerLogs[b].dateAdded) - new Date(allFreezerLogs[a].dateAdded)).forEach(key => {
        const log = allFreezerLogs[key]; const daysOld = Math.floor((now - new Date(log.dateAdded)) / 86400000);
        let itemsStr = Object.keys(log.items).filter(k => log.items[k]>0).map(k => `${dynamicFreezerConfig[k]?.name || k}: ${log.items[k]}`).join(' | ');
        html += `<div style="background:var(--bg-main); padding:12px; border-radius:8px; margin-bottom:8px; border-left:4px solid var(--info);">
            <div style="display:flex; justify-content:space-between;"><strong>${log.batchName}</strong><span style="font-size:11px;">منذ ${daysOld} يوم</span></div>
            <div style="color:var(--text-secondary); font-size:12px; margin:5px 0;">تاريخ: ${log.dateAdded}</div>
            <div style="font-weight:bold; color:var(--primary); font-size:13px;">${itemsStr}</div></div>`;
    });
    logsEl.innerHTML = html || '<div style="text-align:center;">لا توجد سجلات</div>';
});

// ================= 6. دورة حياة الدفعات (Batches Lifecycle) =================
onValue(ref(db, "batches"), (snapshot) => { 
    allBatches = snapshot.exists() ? snapshot.val() : {}; 
    renderBatches(); 
    if(document.getElementById('reportBatchSelect')?.value) window.generateBatchReport(); 
});

window.saveNewBatch = async () => {
    const name = document.getElementById('bName').value;
    const eggs = parseInt(document.getElementById('bEggs').value);
    const dateStr = document.getElementById('bDate').value; 
    const bType = document.getElementById('bBirdType').value;
    
    if(!name || !eggs || !dateStr) return showToast("أكمل البيانات", true);
    const std = birdStandards[bType]; const insertD = new Date(dateStr);
    const hatcherD = new Date(insertD); hatcherD.setHours(insertD.getHours() + (std.hatcher * 24));
    const hatchD = new Date(insertD); hatchD.setHours(insertD.getHours() + (std.hatch * 24));
    const rearD = new Date(hatchD); rearD.setHours(hatchD.getHours() + (std.slaughter * 24));

    await push(ref(db, 'batches'), { name, birdType: bType, insertDate: dateStr, hatcherDate: hatcherD.toISOString(), hatchDate: hatchD.toISOString(), rearDate: rearD.toISOString(), initialEggs: eggs, status: 'incubator', totalDead: 0, totalFeed: 0, order: Date.now() });
    closeModal('modalBatch'); showToast("تم التسجيل بدقة");
};

window.moveToRearing = async () => {
    const id = document.getElementById('hatchBatchId').value;
    const healthy = parseInt(document.getElementById('hHealthy').value);
    if(!healthy) return showToast("أدخل العدد", true);
    const hatchRate = ((healthy / allBatches[id].initialEggs) * 100).toFixed(1);
    await update(ref(db, `batches/${id}`), { status: 'rearing', hatchedChicks: healthy, hatchRate, rearingSystem: document.getElementById('hRearingSystem').value, unfertilized: parseInt(document.getElementById('hUnfert').value)||0, deadInShell: parseInt(document.getElementById('hDead').value)||0 });
    closeModal('modalHatch'); showToast("تم النقل للعنبر");
};

window.updateStage = async (id, stage) => { 
    if (stage === 'slaughter' && !confirm("⚠️ نقل الدفعة للذبح؟")) return;
    await update(ref(db, `batches/${id}`), { status: stage }); 
    showToast("تم التحديث");
};

window.deleteBatch = async (id) => { if(confirm("هل أنت متأكد من الحذف؟")) { await remove(ref(db, `batches/${id}`)); showToast("تم الحذف"); } };

// ================= 7. المبيعات والحسابات والمهام =================
window.calculateSaleTotal = () => {
    const grade = document.getElementById('sGrade').value; 
    const qty = parseInt(document.getElementById('sQty').value) || 0;
    const price = dynamicFreezerConfig[grade]?.price || 0;
    document.getElementById('saleTotalDisplay').innerText = (qty * price) + " ج.م";
};

window.processSale = async () => {
    const grade = document.getElementById('sGrade').value; 
    const qty = parseInt(document.getElementById('sQty').value) || 0;
    if(!grade || !qty) return showToast("أكمل البيانات", true);
    
    const price = dynamicFreezerConfig[grade].price;
    const amount = qty * price;
    
    const snap = await get(ref(db, `inventory/freezerStock/${grade}`));
    const currentStock = snap.exists() ? snap.val() : 0;
    if(currentStock < qty) return showToast(`المتاح: ${currentStock} فقط`, true);

    await set(ref(db, `inventory/freezerStock/${grade}`), currentStock - qty);
    await saveTransaction('in', amount, `مبيعات (${qty} جوز - ${dynamicFreezerConfig[grade].name})`);
    closeModal('modalSale'); showToast("تمت البيعة بنجاح");
};

window.saveTransaction = async (type, amountOverride = null, descOverride = null) => {
    const amount = amountOverride || parseFloat(document.getElementById('eAmount').value);
    const desc = descOverride || document.getElementById('eType').value;
    const batchId = (type === 'out') ? document.getElementById('eBatch').value : 'general';
    if(!amount) return;
    await push(ref(db, 'ledger'), { type, amount, desc, batchId, date: new Date().toISOString().split('T')[0], timestamp: Date.now() });
    await set(ref(db, "cashBox"), manualCash + (type === 'in' ? amount : -amount));
    if(!amountOverride) { closeModal('modalExpense'); showToast("تم تسجيل الدفتر"); }
};

window.saveDailyLog = async () => {
    const id = document.getElementById('dBatch').value;
    const dead = parseInt(document.getElementById('dDead').value) || 0;
    const feed = parseFloat(document.getElementById('dFeed').value) || 0;
    if(!id || (dead===0 && feed===0)) return;

    if(feed > 0) {
        if(currentFeedStock < feed) return alert(`⚠️ الرصيد (${currentFeedStock} ك) لا يكفي!`);
        await set(ref(db, "inventory/feedStock"), currentFeedStock - feed);
        await saveTransaction('batch_cost', feed * globalSettings.feedPrice, `سحب علف (${feed}ك)`, id);
    }
    const b = allBatches[id];
    await push(ref(db, `batches/${id}/dailyLogs`), { date: new Date().toISOString().split('T')[0], dead, feed });
    await update(ref(db, `batches/${id}`), { totalDead: (b.totalDead||0) + dead, totalFeed: (b.totalFeed||0) + feed });
    closeModal('modalDaily'); showToast("تم التسجيل والخصم");
};

// ================= 8. كابينة التشغيل الفائقة (Slaughter Cockpit) =================
let activeCockpitBatchId = null;

window.promptClassify = (id) => {
    activeCockpitBatchId = id;
    document.getElementById('cockpitBatchName').innerText = `دفعة: ${allBatches[id].name}`;
    const grid = document.getElementById('cockpitInputsGrid');
    grid.innerHTML = '';
    
    const ids = Object.keys(dynamicFreezerConfig);
    if(ids.length === 0) return alert("لا يوجد أصناف بالفريزر!");

    ids.forEach((catId, index) => {
        grid.innerHTML += `<div class="cockpit-input-card">
            <span style="font-size: 16px; color: var(--text-secondary);">${dynamicFreezerConfig[catId].name}</span>
            <input type="number" id="cockpit_in_${catId}" data-index="${index}" value="0" oninput="calculateCockpitTotal()" onclick="this.select()">
        </div>`;
    });

    document.getElementById('slaughterCockpit').style.display = 'flex';
    document.getElementById('cockpitTotalDisplay').innerText = '0';

    setTimeout(() => {
        const firstInput = document.querySelector('#cockpitInputsGrid input');
        if(firstInput) firstInput.focus();
        document.querySelectorAll('#cockpitInputsGrid input').forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const nextInput = document.querySelector(`#cockpitInputsGrid input[data-index="${parseInt(input.getAttribute('data-index')) + 1}"]`);
                    if(nextInput) nextInput.focus(); else document.querySelector('.cockpit-footer button').focus();
                }
            });
        });
    }, 200);
};

window.closeSlaughterCockpit = () => { document.getElementById('slaughterCockpit').style.display = 'none'; activeCockpitBatchId = null; };

window.calculateCockpitTotal = () => {
    let total = 0; document.querySelectorAll('#cockpitInputsGrid input').forEach(inp => total += parseInt(inp.value) || 0);
    document.getElementById('cockpitTotalDisplay').innerText = total;
};

window.submitSlaughterCockpit = async () => {
    if(!activeCockpitBatchId) return;
    const id = activeCockpitBatchId; let yieldTotal = 0; const toAdd = {};
    
    Object.keys(dynamicFreezerConfig).forEach(catId => {
        const val = parseInt(document.getElementById(`cockpit_in_${catId}`).value) || 0;
        toAdd[catId] = val; yieldTotal += val;
    });

    if(yieldTotal === 0 && !confirm("⚠️ ترحيل بأرقام صفرية؟")) return;

    const stockSnap = await get(ref(db, "inventory/freezerStock"));
    let currentStock = stockSnap.exists() ? stockSnap.val() : {};
    Object.keys(toAdd).forEach(catId => currentStock[catId] = (currentStock[catId] || 0) + toAdd[catId]);
    
    await set(ref(db, "inventory/freezerStock"), currentStock);
    await push(ref(db, 'inventory/freezerLogs'), { batchId: id, batchName: allBatches[id].name, dateAdded: new Date().toISOString().split('T')[0], items: toAdd });
    await update(ref(db, `batches/${id}`), { status: 'completed', slaughterYield: yieldTotal, classifyData: toAdd });

    closeSlaughterCockpit(); showToast(`🚀 تم تصنيف وتجميد ${yieldTotal} طائر!`);
};

// ================= 9. رندر الداشبورد والعنابر (Render Core) =================
function formatDateTime(iso) { const d = new Date(iso); return `${d.toLocaleDateString('ar-EG', {month:'short',day:'numeric'})} (${d.toLocaleTimeString('ar-EG', {hour:'2-digit',minute:'2-digit'})})`; }

function renderBatches() {
    const ui = { inc: document.getElementById('incubatorList'), rear: document.getElementById('rearingList'), slaugh: document.getElementById('slaughterList'), dSelect: document.getElementById('dBatch'), alerts: document.getElementById('alertsContainer') };
    if(!ui.inc) return;
    ui.inc.innerHTML = ''; ui.rear.innerHTML = ''; ui.slaugh.innerHTML = ''; ui.alerts.innerHTML = ''; 
    if(ui.dSelect) ui.dSelect.innerHTML = '';
    
    let stats = { eggs: 0, chicks: 0 }; const now = new Date();
    Object.keys(allBatches).sort((a,b) => (allBatches[b].order||0) - (allBatches[a].order||0)).forEach(id => {
        const b = allBatches[id]; const std = birdStandards[b.birdType||'quail']; const bIcon = std.icon;
        
        if (b.status === 'incubator' || b.status === 'hatcher') {
            stats.eggs += b.initialEggs; const days = (Math.floor((now - new Date(b.insertDate)) / 3600000) / 24).toFixed(1);
            let action = b.status === 'incubator' ? `<button class="btn btn-info" onclick="updateStage('${id}','hatcher')" style="margin:0;"><i class="fas fa-arrow-down"></i> للمفقس</button>` : `<button class="btn btn-primary" onclick="promptHatch('${id}')" style="margin:0;"><i class="fas fa-egg"></i> فقس</button>`;
            
            ui.inc.innerHTML += `<div class="batch-card stage-${b.status}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div><span style="font-size:20px;">${bIcon}</span> <strong>${b.name}</strong></div>
                    <span class="badge" style="background:var(--${b.status==='incubator'?'info':'primary'})">${b.status==='incubator'?'حضانة':'مفقس'}</span>
                </div>
                <div style="margin:10px 0; font-size:13px; color:var(--text-secondary);">بيض: <b style="color:var(--primary); font-size:16px;">${b.initialEggs}</b> | مر: ${days} يوم</div>
                <div style="display:flex; justify-content:space-between; gap:10px; margin-top:10px; border-top:1px dashed var(--border); padding-top:10px;">
                    <button class="btn" style="background:transparent; border:1px solid var(--danger); color:var(--danger); padding:8px;" onclick="deleteBatch('${id}')"><i class="fas fa-trash"></i></button>
                    ${action}
                </div></div>`;
        }
        else if (b.status === 'rearing') {
            const alive = b.hatchedChicks - (b.totalDead||0); stats.chicks += alive; const age = Math.floor((now - new Date(b.hatchDate)) / 86400000);
            if(ui.dSelect) ui.dSelect.innerHTML += `<option value="${id}">${b.name} (${age} يوم)</option>`;
            
            ui.rear.innerHTML += `<div class="batch-card stage-rearing">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div><span style="font-size:20px;">${bIcon}</span> <strong>${b.name}</strong></div>
                    <span class="badge" style="background:var(--warning); color:#000;">عمر ${age} يوم</span>
                </div>
                <div class="grid-2" style="margin-top:10px; background:var(--bg-main); padding:10px; border-radius:8px; text-align:center;">
                    <div>متبقي: <b>${alive}</b></div><div>علف: <b>${b.totalFeed||0} ك</b></div>
                </div>
                <div style="display:flex; justify-content:space-between; gap:10px; margin-top:10px;">
                    <button class="btn btn-info" style="margin:0; padding:8px;" onclick="openDailyGuide('${id}')"><i class="fas fa-tasks"></i> مهام</button>
                    <button class="btn btn-danger" style="margin:0; padding:8px;" onclick="updateStage('${id}','slaughter')"><i class="fas fa-knife"></i> للذبح</button>
                </div></div>`;
        }
        else if (b.status === 'slaughter') { 
            ui.slaugh.innerHTML += `<div class="batch-card stage-slaughter">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div><span style="font-size:20px;">${bIcon}</span> <strong>${b.name}</strong></div>
                    <span class="badge" style="background:var(--danger)">قيد الذبح</span>
                </div>
                <div style="display:flex; justify-content:space-between; gap:10px; margin-top:15px;">
                    <button class="btn" style="background:transparent; border:1px solid var(--border); color:var(--text-primary); margin:0; padding:8px;" onclick="updateStage('${id}','rearing')"><i class="fas fa-undo"></i> تراجع</button>
                    <button class="btn btn-success" style="margin:0; padding:8px; flex:1;" onclick="promptClassify('${id}')">تصنيف للترحيل ❄️</button>
                </div></div>`;
        }
    });
    
    if(document.getElementById('dashEggs')) document.getElementById('dashEggs').innerText = stats.eggs;
    if(document.getElementById('dashChicks')) document.getElementById('dashChicks').innerText = stats.chicks;
}

// ================= 10. Command Palette (Ctrl+K) =================
const sysCmds = [
    { title: 'الانتقال إلى: لوحة القيادة', icon: 'fas fa-chart-pie', action: () => switchPage('dashboard') },
    { title: 'الانتقال إلى: المفرخ', icon: 'fas fa-egg', action: () => switchPage('incubator') },
    { title: 'الانتقال إلى: الفريزر', icon: 'fas fa-snowflake', action: () => switchPage('freezer') },
    { title: 'إجراء: إضافة دفعة', icon: 'fas fa-plus', action: () => openModal('modalBatch') },
    { title: 'إجراء: تسجيل مبيعات', icon: 'fas fa-shopping-cart', action: () => openModal('modalSale') }
];
window.openCommandPalette = () => { document.getElementById('commandPalette').classList.add('active'); setTimeout(() => document.getElementById('cmdInput').focus(), 100); renderCmdResults(''); };
window.closeCommandPalette = () => { document.getElementById('commandPalette').classList.remove('active'); document.getElementById('cmdInput').value = ''; };

const renderCmdResults = (q) => {
    const c = document.getElementById('cmdResults'); if(!c) return; c.innerHTML = '';
    sysCmds.filter(cmd => cmd.title.toLowerCase().includes(q.toLowerCase())).forEach(cmd => {
        const el = document.createElement('div');
        el.innerHTML = `<div style="display:flex; align-items:center; gap:12px;"><i class="${cmd.icon}" style="color:var(--primary);"></i> <b>${cmd.title}</b></div>`;
        el.style.cssText = `padding: 12px; cursor: pointer; border-radius: 8px; margin-bottom: 4px; transition: 0.2s;`;
        el.onmouseover = () => el.style.background = 'rgba(59,130,246,0.1)'; el.onmouseout = () => el.style.background = 'transparent';
        el.onclick = () => { closeCommandPalette(); cmd.action(); };
        c.appendChild(el);
    });
};
document.addEventListener('keydown', (e) => { if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k') { e.preventDefault(); openCommandPalette(); } if (e.key === 'Escape') closeCommandPalette(); });
document.getElementById('cmdInput')?.addEventListener('input', (e) => renderCmdResults(e.target.value));

// المساعد الذكي
window.openDailyGuide = (id) => {
    const b = allBatches[id]; const age = Math.floor((new Date() - new Date(b.hatchDate)) / 86400000) || 1;
    document.getElementById('dailyGuideContent').innerHTML = `<div style="background:var(--bg-main); padding:15px; border-radius:12px; text-align:center;"><h4>عمر القطيع: ${age} يوم</h4><p>تأكد من توافر المياه والعلف ونظافة الفرشة.</p></div>`;
    openModal('modalDailyGuide');
};
