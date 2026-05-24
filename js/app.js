import { db, ref, set, get, push, update, remove, onValue } from './firebase.js';
import { switchPage, openModal, closeModal, showToast, toggleFab } from './ui.js';

let allBatches = {};
let allTransactions = {};
let allFreezerLogs = {};
let manualCash = 0; 
let currentFeedStock = 0; // متغير المخزن

// الأيقونات والأسماء لتوضيح النوع بلمحة بصرية
const birdStandards = {
    quail: { name: 'سمان', icon: '🕊️', hatcher: 15, hatch: 18, slaughter: 35 },
    chicken: { name: 'فراخ بيضاء', icon: '🐔', hatcher: 18, hatch: 21, slaughter: 40 },
    turkey: { name: 'رومي', icon: '🦃', hatcher: 25, hatch: 28, slaughter: 90 }
};

let globalSettings = { 
    birdType: 'quail', feedPrice: 30, royal: 120, super_special: 110, special: 100, jumbo: 90, super: 80, bad: 0,
    quailChick: 3.5, chickenChick: 25, turkeyChick: 60, turkeyEgg: 10 
};
const gradeNames = { royal: 'رويال', super_special: 'سوبر سبشيال', special: 'سبشيال', jumbo: 'جامبو', super: 'سوبر', bad: 'كسر/فرز' };

window.switchPage = (pageId) => switchPage(pageId, event.currentTarget);
window.openModal = (id) => {
    if(id === 'modalBatch') {
        document.getElementById('bBirdType').value = globalSettings.birdType || 'quail';
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('bDate').value = now.toISOString().slice(0,16);
    } 
    openModal(id);
};
window.closeModal = closeModal;
window.toggleFab = toggleFab;
window.showToast = showToast;

// ================= مراقبة مخزن العلف =================
onValue(ref(db, "inventory/feedStock"), (snapshot) => {
    currentFeedStock = snapshot.exists() ? parseFloat(snapshot.val()) : 0;
    const feedEl = document.getElementById('feedStockDisplay');
    if(feedEl) feedEl.innerText = currentFeedStock + " كجم";
    if(Object.keys(allBatches).length > 0) renderBatches();
});

// ================= شراء وتوريد العلف =================
window.buyFeed = async () => {
    const qty = parseFloat(document.getElementById('bfQty').value);
    const cost = parseFloat(document.getElementById('bfTotalCost').value);
    if(!qty || !cost) return showToast("برجاء إدخال الكمية والتكلفة", true);

    await set(ref(db, "inventory/feedStock"), currentFeedStock + qty);
    await push(ref(db, 'ledger'), { type: 'out', amount: cost, desc: `شراء وتوريد علف للمخزن (${qty} كجم)`, batchId: 'general', date: new Date().toISOString().split('T')[0], timestamp: Date.now() });
    await set(ref(db, "cashBox"), manualCash - cost);

    document.getElementById('bfQty').value = ''; document.getElementById('bfTotalCost').value = '';
    closeModal('modalBuyFeed');
    showToast(`تم إضافة ${qty} كجم للمخزن وخصم ${cost} ج.م`);
};

// ================= الخزنة والكاش =================
onValue(ref(db, "cashBox"), (snapshot) => {
    manualCash = snapshot.exists() ? snapshot.val() : 0;
    updateCashDisplay();
});

function updateCashDisplay() {
    const netProfitEl = document.getElementById('netProfit');
    if (!netProfitEl) return;
    
    let cashBoxEl = document.getElementById('customCashBoxDisplay');
    if (!cashBoxEl) {
        const parent = netProfitEl.parentElement;
        const container = document.createElement('div');
        container.id = 'customCashBox';
        container.style.marginTop = '15px'; container.style.paddingTop = '12px'; container.style.borderTop = '1px dashed var(--border)'; container.style.textAlign = 'center';
        container.innerHTML = `
            <span style="font-size: 13px; color: var(--text-secondary); display:block; margin-bottom:4px;">💵 الكاش الفعلي بالخزنة الآن:</span>
            <div style="font-size: 26px; font-weight: 800; margin-bottom: 8px; color:var(--warning);" id="customCashBoxDisplay">0 ج.م</div>
            <button onclick="editCashBox()" style="background: transparent; border: 1px solid var(--border); color: var(--text-primary); padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: bold; transition: var(--transition-smooth);"><i class="fas fa-edit"></i> تعديل الكاش اليدوي ✏️</button>
        `;
        parent.appendChild(container);
        cashBoxEl = document.getElementById('customCashBoxDisplay');
    }
    if (cashBoxEl) cashBoxEl.innerText = manualCash + " ج.م";
}

window.editCashBox = async () => {
    const newCash = prompt("اكتب المبلغ الفعلي المتواجد في جيبك أو خزنتك الآن لتحديث الرصيد:", manualCash);
    if (newCash !== null && !isNaN(newCash) && newCash.trim() !== "") {
        await set(ref(db, "cashBox"), parseFloat(newCash)); showToast("تم تحديث رصيد الكاش بنجاح");
    }
};

// ================= الإعدادات =================
onValue(ref(db, "settings"), (snapshot) => {
    if(snapshot.exists()) {
        globalSettings = { ...globalSettings, ...snapshot.val() };
        document.getElementById('setBirdType').value = globalSettings.birdType || 'quail';
        document.getElementById('setFeed').value = globalSettings.feedPrice;
        document.getElementById('setRoyal').value = globalSettings.royal;
        document.getElementById('setSuperSpecial').value = globalSettings.super_special;
        document.getElementById('setSpecial').value = globalSettings.special;
        document.getElementById('setJumbo').value = globalSettings.jumbo;
        document.getElementById('setSuper').value = globalSettings.super;
        if(document.getElementById('setQuailChick')) document.getElementById('setQuailChick').value = globalSettings.quailChick || 3.5;
        if(document.getElementById('setChickenChick')) document.getElementById('setChickenChick').value = globalSettings.chickenChick || 25;
        if(document.getElementById('setTurkeyChick')) document.getElementById('setTurkeyChick').value = globalSettings.turkeyChick || 60;
        if(document.getElementById('setTurkeyEgg')) document.getElementById('setTurkeyEgg').value = globalSettings.turkeyEgg || 10;
    }
});

window.saveSettings = async () => {
    const newSet = {
        birdType: document.getElementById('setBirdType').value,
        feedPrice: parseFloat(document.getElementById('setFeed').value) || 0,
        royal: parseFloat(document.getElementById('setRoyal').value) || 0,
        super_special: parseFloat(document.getElementById('setSuperSpecial').value) || 0,
        special: parseFloat(document.getElementById('setSpecial').value) || 0,
        jumbo: parseFloat(document.getElementById('setJumbo').value) || 0,
        super: parseFloat(document.getElementById('setSuper').value) || 0,
        quailChick: parseFloat(document.getElementById('setQuailChick')?.value) || 3.5,
        chickenChick: parseFloat(document.getElementById('setChickenChick')?.value) || 25,
        turkeyChick: parseFloat(document.getElementById('setTurkeyChick')?.value) || 60,
        turkeyEgg: parseFloat(document.getElementById('setTurkeyEgg')?.value) || 10,
        bad: 0
    };
    await set(ref(db, 'settings'), newSet); showToast("تم حفظ الإعدادات بنجاح");
};

// ================= إدارة الدفعات (المدمجة) =================
window.saveNewBatch = async () => {
    const name = document.getElementById('bName').value;
    const eggs = parseInt(document.getElementById('bEggs').value);
    const datetimeStr = document.getElementById('bDate').value; 
    const bType = document.getElementById('bBirdType').value;
    
    if(!name || !eggs || !datetimeStr) return showToast("أكمل البيانات", true);

    const std = birdStandards[bType];
    const insertD = new Date(datetimeStr);
    
    const hatcherD = new Date(insertD); hatcherD.setHours(insertD.getHours() + (std.hatcher * 24));
    const hatchD = new Date(insertD); hatchD.setHours(insertD.getHours() + (std.hatch * 24));
    const rearD = new Date(hatchD); rearD.setHours(hatchD.getHours() + (std.slaughter * 24));

    const orderIndex = Date.now();

    await push(ref(db, 'batches'), { 
        name, birdType: bType, 
        insertDate: datetimeStr, 
        hatcherDate: hatcherD.toISOString(), 
        hatchDate: hatchD.toISOString(), 
        rearDate: rearD.toISOString(), 
        initialEggs: eggs, status: 'incubator', totalDead: 0, totalFeed: 0,
        order: orderIndex
    });
    
    document.getElementById('bName').value = ''; document.getElementById('bEggs').value = '';
    closeModal('modalBatch'); showToast(`تم تسجيل الدفعة بدقة`);
};

window.sellEggsFromIncubator = async (batchId) => {
    const batch = allBatches[batchId];
    const eggPrice = batch.birdType === 'turkey' ? (globalSettings.turkeyEgg || 10) : (batch.birdType === 'chicken' ? 15 : 2);
    const qty = prompt(`كم عدد البيض المباع من دفعة "${batch.name}"؟ (سعر البيضة المحسوب: ${eggPrice} ج.م)`, "0");
    
    if(qty && !isNaN(qty) && parseInt(qty) > 0) {
        const sellQty = parseInt(qty);
        if(sellQty > batch.initialEggs) return showToast("العدد أكبر من المتاح!", true);
        
        const totalAmount = sellQty * eggPrice;
        await update(ref(db, `batches/${batchId}`), { initialEggs: batch.initialEggs - sellQty });
        await push(ref(db, 'ledger'), { type: 'in', amount: totalAmount, desc: `بيع بيض (${sellQty} بيضة) - ${batch.name}`, batchId: batchId, date: new Date().toISOString().split('T')[0], timestamp: Date.now() });
        await set(ref(db, "cashBox"), manualCash + totalAmount);
        
        showToast(`تم بيع ${sellQty} بيضة بإجمالي ${totalAmount} ج.م`);
    }
};

window.moveBatchUp = async (id) => {
    const batchesArr = Object.keys(allBatches).map(key => ({ id: key, ...allBatches[key] })).sort((a,b) => (b.order || 0) - (a.order || 0));
    const currentIndex = batchesArr.findIndex(b => b.id === id);
    if(currentIndex > 0) {
        const prevBatch = batchesArr[currentIndex - 1];
        const tempOrder = prevBatch.order;
        await update(ref(db, `batches/${prevBatch.id}`), { order: batchesArr[currentIndex].order });
        await update(ref(db, `batches/${id}`), { order: tempOrder });
    }
};

window.moveBatchDown = async (id) => {
    const batchesArr = Object.keys(allBatches).map(key => ({ id: key, ...allBatches[key] })).sort((a,b) => (b.order || 0) - (a.order || 0));
    const currentIndex = batchesArr.findIndex(b => b.id === id);
    if(currentIndex < batchesArr.length - 1) {
        const nextBatch = batchesArr[currentIndex + 1];
        const tempOrder = nextBatch.order;
        await update(ref(db, `batches/${nextBatch.id}`), { order: batchesArr[currentIndex].order });
        await update(ref(db, `batches/${id}`), { order: tempOrder });
    }
};

// ================= العمليات اليومية والمبيعات =================
window.saveDailyLog = async () => {
    const id = document.getElementById('dBatch').value;
    const dead = parseInt(document.getElementById('dDead').value) || 0;
    const feed = parseFloat(document.getElementById('dFeed').value) || 0;
    if(!id || (dead===0 && feed===0)) return showToast("أدخل بيانات صحيحة", true);

    const b = allBatches[id]; const today = new Date().toISOString().split('T')[0];

    await push(ref(db, `batches/${id}/dailyLogs`), { date: today, dead, feed });

    if(feed > 0) {
        if(currentFeedStock < feed) {
            alert(`⚠️ تحذير: رصيد المخزن (${currentFeedStock} ك) لا يكفي لهذه الوجبة! الرجاء شراء علف أولاً.`);
            return;
        }
        await set(ref(db, "inventory/feedStock"), currentFeedStock - feed);
        const cost = feed * (globalSettings.feedPrice || 30);
        await push(ref(db, 'ledger'), { type: 'batch_cost', amount: cost, desc: `سحب علف من المخزن (${feed}ك)`, batchId: id, date: today, timestamp: Date.now() });
    }

    await update(ref(db, `batches/${id}`), { totalDead: (b.totalDead||0) + dead, totalFeed: (b.totalFeed||0) + feed });
    document.getElementById('dDead').value = 0; document.getElementById('dFeed').value = 0;
    closeModal('modalDaily'); showToast("تم تسجيل الاستهلاك وخصمه من المخزن");
};

window.calculateSaleTotal = () => {
    const grade = document.getElementById('sGrade').value; const qty = parseInt(document.getElementById('sQty').value) || 0;
    document.getElementById('saleTotalDisplay').innerText = (qty * (globalSettings[grade] || 0)) + " ج.م";
};

window.processSale = async () => {
    const grade = document.getElementById('sGrade').value; const qty = parseInt(document.getElementById('sQty').value) || 0;
    const amount = qty * (globalSettings[grade] || 0);
    if(!qty) return showToast("أدخل العدد", true);

    const snap = await get(ref(db, `inventory/freezer/${grade}`));
    const currentStock = snap.exists() ? snap.val() : 0;
    if(currentStock < qty) return showToast(`الرصيد لا يكفي! المتاح: ${currentStock}`, true);

    await set(ref(db, `inventory/freezer/${grade}`), currentStock - qty);
    await saveTransaction('in', amount, `مبيعات (${qty} جوز - ${gradeNames[grade]})`);
    document.getElementById('sQty').value = ''; document.getElementById('saleTotalDisplay').innerText = "0 ج.م"; closeModal('modalSale'); showToast("تم البيع بنجاح");
};

window.saveTransaction = async (type, amountOverride = null, descOverride = null) => {
    const amount = amountOverride || parseFloat(document.getElementById('eAmount').value);
    const desc = descOverride || document.getElementById('eType').value;
    const batchId = type === 'out' ? document.getElementById('eBatch').value : 'general';
    if(!amount) return showToast("أدخل المبلغ", true);

    await push(ref(db, 'ledger'), { type, amount, desc, batchId, date: new Date().toISOString().split('T')[0], timestamp: Date.now() });
    if (type === 'in') await set(ref(db, "cashBox"), manualCash + amount);
    else if (type === 'out') await set(ref(db, "cashBox"), manualCash - amount); 

    if(!amountOverride) { document.getElementById('eAmount').value = ''; document.getElementById('eType').value = ''; closeModal('modalExpense'); showToast("تم التسجيل بالدفتر"); }
};

window.renameBatch = async (id) => {
    const currentName = allBatches[id].name; const newName = prompt("الاسم الجديد للدفعة:", currentName);
    if (newName && newName.trim() !== "" && newName !== currentName) { await update(ref(db, `batches/${id}`), { name: newName.trim() }); showToast("تم التغيير"); }
};

window.deleteBatch = async (id) => { if(confirm("هل أنت متأكد من الحذف؟")) { await remove(ref(db, `batches/${id}`)); showToast("تم الحذف"); } };

window.deleteTransaction = async (id) => {
    if(confirm("حذف هذه المعاملة؟")) {
        const t = allTransactions[id];
        if (t.type === 'in') await set(ref(db, "cashBox"), manualCash - t.amount);
        else if (t.type === 'out') await set(ref(db, "cashBox"), manualCash + t.amount);
        await remove(ref(db, `ledger/${id}`)); showToast("تم الحذف وتعديل الخزنة");
    }
};

window.resetSystem = async () => {
    if(confirm("🛑 سيتم مسح كل البيانات!")) {
        if(prompt("اكتب 'تأكيد':") === 'تأكيد') {
            await remove(ref(db, 'batches')); await remove(ref(db, 'ledger')); await remove(ref(db, 'inventory')); await remove(ref(db, 'cashBox')); showToast("تم التصفير");
        }
    }
};

window.updateStage = async (id, stage) => { 
    // لو المرحلة ذبح، لازم نأكد الأول
    if (stage === 'slaughter') {
        if (!confirm("⚠️ هل أنت متأكد؟ هذا الإجراء سينقل الدفعة لمرحلة الذبح ولا يمكن التراجع عنه بسهولة!")) {
            return; // لو داس كنسل، مش هنعمل حاجة
        }
    }
    await update(ref(db, `batches/${id}`), { status: stage }); 
    showToast("تم تحديث حالة الدفعة بنجاح");
};

window.promptHatch = (id) => { document.getElementById('hatchBatchId').value = id; openModal('modalHatch'); };
window.moveToRearing = async () => {
    const id = document.getElementById('hatchBatchId').value; 
    const healthy = parseInt(document.getElementById('hHealthy').value);
    const rearingSys = document.getElementById('hRearingSystem').value; // سحب نوع التربية
    if(!healthy) return showToast("أدخل العدد", true);
    
    const hatchRate = ((healthy / allBatches[id].initialEggs) * 100).toFixed(1);
    await update(ref(db, `batches/${id}`), { 
        status: 'rearing', 
        hatchedChicks: healthy, 
        hatchRate: hatchRate, 
        rearingSystem: rearingSys, // حفظ نظام التربية
        unfertilized: parseInt(document.getElementById('hUnfert').value)||0, 
        deadInShell: parseInt(document.getElementById('hDead').value)||0 
    });
    closeModal('modalHatch'); showToast("تم النقل للتربية");
};


window.promptClassify = (id) => { document.getElementById('classBatchId').value = id; openModal('modalClassify'); };
window.finishSlaughter = async () => {
    const id = document.getElementById('classBatchId').value; let yieldTotal = 0; const toAdd = {};
    Object.keys(gradeNames).forEach(g => { const val = parseInt(document.getElementById(`c_${g}`).value) || 0; toAdd[g] = val; if(g !== 'bad') yieldTotal += val; });
    if(yieldTotal === 0 && toAdd['bad'] === 0) return showToast("أدخل ناتج التصنيف", true);

    const snap = await get(ref(db, "inventory/freezer")); let currentF = snap.exists() ? snap.val() : {};
    Object.keys(toAdd).forEach(g => currentF[g] = (currentF[g]||0) + toAdd[g]);
    await set(ref(db, "inventory/freezer"), currentF);
    await push(ref(db, 'inventory/freezerLogs'), { batchId: id, batchName: allBatches[id].name, birdType: allBatches[id].birdType || 'quail', dateAdded: new Date().toISOString().split('T')[0], items: toAdd });
    await update(ref(db, `batches/${id}`), { status: 'completed', slaughterYield: yieldTotal, classifyData: toAdd });
    closeModal('modalClassify'); showToast("تم الترحيل للفريزر");
};

// ================= عرض البيانات (داشبورد مدمج) =================
onValue(ref(db, "batches"), (snapshot) => { 
    allBatches = snapshot.exists() ? snapshot.val() : {}; 
    renderBatches(); 
    if(document.getElementById('reportBatchSelect') && document.getElementById('reportBatchSelect').value) window.generateBatchReport(); 
});

function formatDateTime(isoString) {
    if(!isoString) return '-';
    const date = new Date(isoString);
    const d = date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    const t = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute:'2-digit' });
    return `${d} (${t})`;
}

function renderBatches() {
    const ui = { inc: document.getElementById('incubatorList'), rear: document.getElementById('rearingList'), slaugh: document.getElementById('slaughterList'), alerts: document.getElementById('alertsContainer'), dSelect: document.getElementById('dBatch'), eSelect: document.getElementById('eBatch'), rSelect: document.getElementById('reportBatchSelect') };
    if(!ui.inc) return;
    ui.inc.innerHTML = ''; ui.rear.innerHTML = ''; ui.slaugh.innerHTML = ''; ui.alerts.innerHTML = ''; 
    if(ui.dSelect) ui.dSelect.innerHTML = ''; 
    if(ui.eSelect) ui.eSelect.innerHTML = '<option value="general">مصروف عام</option>'; 
    if(ui.rSelect) ui.rSelect.innerHTML = '<option value="">-- اختر الدفعة --</option>';
    
    let stats = { eggs: 0, chicks: 0 }; const now = new Date();

    if (currentFeedStock < 50) {
        ui.alerts.innerHTML += `<div style="color:var(--danger); font-weight:800; margin-bottom:12px; padding:10px; border:1px dashed var(--danger); border-radius:8px;"><i class="fas fa-triangle-exclamation"></i> تحذير عاجل: العلف بالمخزن أوشك على النفاذ (${currentFeedStock} كجم فقط)!</div>`;
    }

    const sortedBatchIds = Object.keys(allBatches).sort((a,b) => (allBatches[b].order || 0) - (allBatches[a].order || 0));

    sortedBatchIds.forEach(id => {
        const b = allBatches[id];
        const std = birdStandards[b.birdType || 'quail'];
        const bTypeName = std?.name || 'طائر';
        const bIcon = std?.icon || '🐣';

        if(ui.rSelect) ui.rSelect.innerHTML += `<option value="${id}">${b.name} (${bTypeName})</option>`;
        if(b.status !== 'completed' && ui.eSelect) ui.eSelect.innerHTML += `<option value="${id}">${b.name}</option>`;

        let batchAlertHtml = '';

        if (b.status === 'incubator' || b.status === 'hatcher') {
            stats.eggs += b.initialEggs;
            const hoursIn = Math.floor((now - new Date(b.insertDate)) / (1000 * 60 * 60));
            const daysIn = (hoursIn / 24).toFixed(1);
            
            let badge = '', actionBtn = '';
            
            if(b.status === 'incubator') {
                badge = `<span class="badge" style="background:var(--info);">حضانة</span>`;
                if(hoursIn >= (std.hatcher * 24)) { 
                    actionBtn = `<button class="btn btn-info" onclick="updateStage('${id}','hatcher')" style="margin-top:0; padding:8px;">نقل للمفقس 📥</button>`; 
                    ui.alerts.innerHTML += `<div style="color:var(--info); font-weight:bold;">⚠️ الدفعة <b>${b.name}</b> (${bIcon}) جاهزة للنقل للمفقس!</div>`; 
                    batchAlertHtml = `<div style="background: rgba(14, 165, 233, 0.1); color: var(--info); padding: 8px; border-radius: 8px; font-weight: bold; margin-bottom: 10px; font-size: 13px;">🔔 حان وقت النقل للمفقس!</div>`;
                }
            } else {
                badge = `<span class="badge" style="background:var(--primary);">مفقس</span>`;
                if(hoursIn >= (std.hatch * 24)) { 
                    actionBtn = `<button class="btn btn-primary" onclick="promptHatch('${id}')" style="margin-top:0; padding:8px;">إتمام الفقس 🐣</button>`; 
                    ui.alerts.innerHTML += `<div style="color:var(--success); font-weight:bold;">🐣 الدفعة <b>${b.name}</b> (${bIcon}) جاهزة للفقس الآن!</div>`; 
                    batchAlertHtml = `<div style="background: rgba(34, 197, 94, 0.1); color: var(--success); padding: 8px; border-radius: 8px; font-weight: bold; margin-bottom: 10px; font-size: 13px; animation: pulse 2s infinite;">🔔 حان موعد الفقس!</div>`;
                }
            }

            ui.inc.innerHTML += `
            <div class="batch-card stage-${b.status}">
                ${batchAlertHtml}
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:24px;">${bIcon}</span>
                        <div>
                            <strong style="font-size:18px; color:var(--text-primary); display:block;">${b.name}</strong>
                            <span style="font-size:12px; color:var(--text-secondary);">${bTypeName}</span>
                        </div>
                    </div>
                    ${badge}
                </div>
                
                <div style="background: var(--bg-main); padding: 10px; border-radius: 8px; font-size: 13px; border: 1px dashed var(--border); margin-bottom: 10px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>تاريخ الدخول:</span> <strong>${formatDateTime(b.insertDate)}</strong></div>
                    <div style="display:flex; justify-content:space-between; color:var(--text-secondary);"><span>موعد الفقس:</span> <strong>${formatDateTime(b.hatchDate)}</strong></div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; font-weight:bold;">
                    <span>البيض المتاح: <span style="color:var(--primary); font-size:18px;">${b.initialEggs}</span></span>
                    <span>مر ${daysIn} يوم</span>
                </div>

                                <div class="batch-actions" style="justify-content: space-between; border-top: 1px solid var(--border); padding-top: 10px;">
                    <div style="display:flex; gap:5px;">
                        <button onclick="moveBatchUp('${id}')" title="أعلى">⬆️</button>
                        <button onclick="moveBatchDown('${id}')" title="أسفل">⬇️</button>
                        <button onclick="sellEggsFromIncubator('${id}')" title="بيع بيض" style="color:var(--warning);"><i class="fas fa-egg"></i> بيع</button>
                        <button onclick="renameBatch('${id}')" title="تعديل" style="color: var(--info);">✏️</button>
                        <button onclick="deleteBatch('${id}')" title="حذف" style="color: var(--danger);">🗑️</button>
                    </div>
                    <div style="display:flex; gap:5px;">
                        ${actionBtn}
                    </div>
                </div>
            </div>`;
        }
        else if (b.status === 'rearing') {
            const alive = b.hatchedChicks - (b.totalDead||0); stats.chicks += alive; 
            const age = Math.floor((now - new Date(b.hatchDate)) / 86400000); 
            if(ui.dSelect) ui.dSelect.innerHTML += `<option value="${id}">${b.name} (عمر ${age} يوم)</option>`;
            if(age >= std.slaughter) ui.alerts.innerHTML += `<div style="color:var(--warning);">⏳ الدفعة <b>${b.name}</b> بلغت ${age} يوم (جاهزة للذبح).</div>`;
            
            ui.rear.innerHTML += `<div class="batch-card stage-rearing"><div style="display:flex; justify-content:space-between; align-items:center;"><div><span style="font-size:20px;">${bIcon}</span> <strong>${b.name}</strong></div> <span class="badge" style="background:var(--warning);color:#000;">عمر ${age} يوم</span></div>
            <div style="font-size:12px; color:var(--primary); margin-top:10px; font-weight:bold;">🐣 نسبة الفقس: ${b.hatchRate||0}%</div>
            <div class="grid-2" style="margin-top:10px; background:var(--bg-main); padding:10px; border-radius:8px; text-align:center;"><div>متبقي: <b style="font-size:18px;">${alive}</b></div><div>استهلكت: <b style="font-size:18px;">${b.totalFeed||0} ك</b></div></div>
            <div class="batch-actions" style="justify-content: space-between; border-top: 1px solid var(--border); padding-top: 10px; margin-top:10px;">
                <div style="display:flex; gap:5px;">
                    <button onclick="renameBatch('${id}')" title="تعديل" style="color: var(--info);">✏️</button>
                    <button onclick="deleteBatch('${id}')" title="حذف" style="color: var(--danger);">🗑️</button>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="btn btn-info" style="margin:0; padding:8px 12px; font-size:13px;" onclick="openDailyGuide('${id}')"><i class="fas fa-clipboard-check"></i> مهام</button>
                    <button class="btn btn-danger" style="margin:0; padding:8px 12px; font-size:13px;" onclick="updateStage('${id}','slaughter')">للذبح 🔪</button>
                </div>
            </div></div>`;
        }
        else if (b.status === 'slaughter') { 
            ui.slaugh.innerHTML += `<div class="batch-card stage-slaughter"><div style="display:flex; justify-content:space-between; align-items:center;"><div><span style="font-size:20px;">${bIcon}</span> <strong>${b.name}</strong></div> <span class="badge" style="background:var(--danger);">قيد الذبح</span></div>
            // استبدل الـ batch-actions القديمة في الـ rearing بـ دي:
<div class="batch-actions" style="justify-content: space-between; border-top: 1px solid var(--border); padding-top: 10px; margin-top:10px;">
    <div style="display:flex; gap:8px;">
        <button onclick="renameBatch('${id}')" title="تعديل الاسم" style="background:none; border:none; color: #0ea5e9; font-size:18px;">✏️</button>
        <button onclick="deleteBatch('${id}')" title="حذف" style="background:none; border:none; color: #ef4444; font-size:18px;">🗑️</button>
    </div>
    <div style="display:flex; gap:8px;">
        <button class="btn" style="background: #0ea5e9; color: white; padding: 6px 12px; border-radius: 6px; font-size:13px;" onclick="openDailyGuide('${id}')">
            <i class="fas fa-clipboard-check"></i> مهام
        </button>
        <button class="btn" style="background: #ef4444; color: white; padding: 6px 12px; border-radius: 6px; font-size:13px;" onclick="updateStage('${id}','slaughter')">
            <i class="fas fa-knife"></i> للذبح 🔪
        </button>
    </div>
</div>

    });

    
    if(ui.alerts.innerHTML === '') ui.alerts.innerHTML = '<div style="color:var(--success); font-weight:bold;">✅ لا يوجد تنبيهات أو نواقص حالياً.</div>';
    if(document.getElementById('dashEggs')) document.getElementById('dashEggs').innerText = stats.eggs; 
    if(document.getElementById('dashChicks')) document.getElementById('dashChicks').innerText = stats.chicks;
}

if (!document.getElementById('dynamicStyles')) {
    const style = document.createElement('style');
    style.id = 'dynamicStyles';
    style.innerHTML = `@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }`;
    document.head.appendChild(style);
}

// ================= الفريزر وتقارير P&L =================
onValue(ref(db, "inventory/freezer"), (snapshot) => {
    const data = snapshot.exists() ? snapshot.val() : {}; let total = 0; let html = '';
    Object.keys(gradeNames).forEach(g => { if(g === 'bad') return; const count = data[g] || 0; total += count; html += `<div style="background:var(--bg-main); padding:15px; border-radius:10px; text-align:center; border:1px solid var(--border);"><span style="font-size:13px; color:var(--text-secondary); font-weight:bold;">${gradeNames[g]}</span><div style="font-size:22px; font-weight:800; color:var(--primary); margin-top:5px;">${count}</div></div>`; });
    if(document.getElementById('freezerGrid')) document.getElementById('freezerGrid').innerHTML = html; 
    if(document.getElementById('dashFreezer')) document.getElementById('dashFreezer').innerText = total;
});

onValue(ref(db, "inventory/freezerLogs"), (snapshot) => {
    allFreezerLogs = snapshot.exists() ? snapshot.val() : {}; let html = ''; const now = new Date();
    Object.keys(allFreezerLogs).sort((a,b)=> new Date(allFreezerLogs[b].dateAdded) - new Date(allFreezerLogs[a].dateAdded)).forEach(key => {
        const log = allFreezerLogs[key]; const daysOld = Math.floor((now - new Date(log.dateAdded)) / 86400000);
        let ageTag = daysOld <= 7 ? '<span class="freezer-tag-new">جديد</span>' : (daysOld > 30 ? '<span class="freezer-tag-old">قديم</span>' : `<span style="font-size:11px;color:var(--text-secondary);">منذ ${daysOld} يوم</span>`);
        let itemsStr = Object.keys(log.items).filter(k => log.items[k]>0).map(k => `${gradeNames[k]}: ${log.items[k]}`).join(' | ');
        html += `<div class="freezer-log"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong>${log.batchName}</strong>${ageTag}</div><div style="color:var(--text-secondary); font-size:12px; margin-bottom:5px;">تاريخ التخزين: ${log.dateAdded}</div><div style="font-weight:bold; color:var(--primary);">${itemsStr}</div></div>`;
    });
    if(document.getElementById('freezerLogs')) document.getElementById('freezerLogs').innerHTML = html || '<div style="text-align:center; padding:10px; color:var(--text-secondary);">لا توجد سجلات تخزين</div>';
});

onValue(ref(db, "ledger"), (snapshot) => {
    allTransactions = snapshot.exists() ? snapshot.val() : {}; let tIn = 0, tOut = 0, html = '';
    Object.keys(allTransactions).sort((a,b)=>allTransactions[b].timestamp-allTransactions[a].timestamp).forEach(id => {
        const t = allTransactions[id];
        if(t.type === 'in') tIn += t.amount; else if(t.type === 'out') tOut += t.amount;
        let typeColor = t.type === 'in' ? 'var(--success)' : (t.type === 'out' ? 'var(--danger)' : 'var(--warning)');
        let sign = t.type === 'in' ? '+' : '-';
        let descLabel = t.type === 'batch_cost' ? '(سحب عيني)' : '';
        html += `<div class="transaction-item"><div><b>${t.desc} <span style="font-size:11px; color:var(--warning);">${descLabel}</span></b> <button onclick="deleteTransaction('${id}')" style="background:none; border:none; color:var(--danger); cursor:pointer; margin-right:8px;" title="حذف">🗑️</button><br><span style="font-size:12px;color:var(--text-secondary);">${t.date}</span></div><div style="font-weight:900; color:${typeColor}" dir="ltr">${sign} ${t.amount} ج</div></div>`;
    });
    if(document.getElementById('totalRev')) document.getElementById('totalRev').innerText = tIn; 
    if(document.getElementById('totalExp')) document.getElementById('totalExp').innerText = tOut;
    if(document.getElementById('netProfit')) document.getElementById('netProfit').innerText = (tIn - tOut) + " ج.م"; 
    if(document.getElementById('dashSales')) document.getElementById('dashSales').innerText = tIn;
    if(document.getElementById('ledgerList')) document.getElementById('ledgerList').innerHTML = html || '<div style="text-align:center;padding:20px;">لا يوجد سجلات</div>';
    if(document.getElementById('reportBatchSelect') && document.getElementById('reportBatchSelect').value) window.generateBatchReport(); updateCashDisplay();
});

window.generateBatchReport = () => {
    const id = document.getElementById('reportBatchSelect').value; const container = document.getElementById('batchReportContainer');
    if(!id) { container.style.display = 'none'; return; }
    
    const b = allBatches[id]; let batchCost = 0; 
    Object.values(allTransactions).forEach(t => { if(t.batchId === id && (t.type === 'out' || t.type === 'batch_cost')) batchCost += t.amount; });
    const hatched = b.hatchedChicks || 0; const dead = b.totalDead || 0;
    
    if(b.status === 'completed' && b.classifyData) {
        const yieldTotal = b.slaughterYield || 0; let potentialRevenue = 0; let outputHtml = '';
        Object.keys(b.classifyData).forEach(g => { if(b.classifyData[g] > 0) { potentialRevenue += (b.classifyData[g] * (globalSettings[g]||0)); outputHtml += `<span class="badge" style="background:var(--primary); margin:2px;">${gradeNames[g]}: ${b.classifyData[g]}</span>`; } });
        
        const costPerPair = yieldTotal > 0 ? ((batchCost / yieldTotal) * 2).toFixed(2) : 0; const netProfit = potentialRevenue - batchCost;
        const totalFeedKg = b.totalFeed || 0; const feedPerBirdGrams = yieldTotal > 0 ? ((totalFeedKg * 1000) / yieldTotal).toFixed(0) : 0; let fcrStatus = '';
        if(b.birdType === 'quail' || !b.birdType) { if(feedPerBirdGrams < 450) fcrStatus = '<span style="color:var(--success);">ممتاز 🌟</span>'; else if(feedPerBirdGrams <= 550) fcrStatus = '<span style="color:var(--warning);">متوسط ⚠️</span>'; else fcrStatus = '<span style="color:var(--danger);">ضعيف ❌</span>'; } else { fcrStatus = '<span style="color:var(--info);">تم الحساب</span>'; }

        let stampHtml = netProfit > 0 ? `<div class="result-stamp" style="color:var(--success); border-color:var(--success);">✅ مكسب: +${netProfit} ج.م</div>` : (netProfit < 0 ? `<div class="result-stamp" style="color:var(--danger); border-color:var(--danger);">❌ خسارة: ${netProfit} ج.م</div>` : `<div class="result-stamp" style="color:var(--warning); border-color:var(--warning);">➖ تعادل</div>`);

        container.innerHTML = `<div style="background:var(--bg-main); padding:15px; border-radius:10px; border: 1px solid var(--border);"><div style="text-align:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:15px;"><h3 style="margin:0; color:var(--text-primary);">بيان ختامي - ${b.name}</h3></div><div class="grid-2" style="font-size:14px; line-height:2;"><div>🥚 بيض: <b>${b.initialEggs}</b></div><div>🐣 فقس: <b class="text-success">${b.hatchRate||0}%</b></div><div>☠️ نافق: <b class="text-danger">${dead}</b></div><div>🌾 علف: <b>${totalFeedKg} كجم</b></div></div><div style="margin-top:15px; padding:10px; background:var(--surface); border-radius:8px; text-align:center; border:1px solid var(--border);"><span style="font-size:13px; color:var(--text-secondary);">مؤشر الاستهلاك (FCR):</span><br><b style="font-size:22px; color:var(--primary);">${feedPerBirdGrams} جرام/طائر</b> <br><span style="font-size:13px; font-weight:bold;">التقييم التقني: ${fcrStatus}</span></div><hr style="border:1px dashed var(--border); margin:15px 0;"><div style="margin-bottom:15px;"><b>مخرجات الدفعة (الفريزر):</b><br>${outputHtml}</div><div class="grid-2" style="background:var(--surface); padding:10px; border-radius:8px; border:1px solid var(--border);"><div>التكلفة الإجمالية:<br><b class="text-danger" style="font-size:18px;">${batchCost} ج</b></div><div>البيع المتوقع:<br><b class="text-success" style="font-size:18px;">${potentialRevenue} ج</b></div></div><div style="text-align:center; margin-top:15px; background:var(--surface); border:1px solid var(--primary); padding:10px; border-radius:8px;"><span style="font-size:14px;">تكلفة إنتاج <b style="color:var(--warning);">الجوز الواحد</b>: <b style="font-size:18px; color:var(--primary);">${costPerPair} ج.م</b></span></div>${stampHtml}</div>`;
    } else { container.innerHTML = `<div style="padding:15px; text-align:center; color:var(--danger); font-weight:bold;">الدفعة لم تكتمل وتُذبح بعد لإصدار بيان ختامي دقيق.</div>`; }
    container.style.display = 'block';
};
// ================= المساعد الذكي للتربية (دليل العامل) =================
function getQuailDailyNeeds(age, aliveCount, system) {
    let temp = 35, feedPerBird = 5, meds = "ماء نقي خالي من الإضافات";
    
    // خوارزمية السمان من يوم 1 إلى 40
    if (age <= 3) { temp = 37; feedPerBird = 4; meds = "مضاد حيوي معوي وتنفسي + فيتامينات (AD3E)"; }
    else if (age <= 7) { temp = 35; feedPerBird = 6; meds = "أملاح معدنية وأحماض أمينية"; }
    else if (age <= 10) { temp = 33; feedPerBird = 8; if(age === 10) meds = "تحصين نيوكاسل (تغطيس أو ماء شرب)"; }
    else if (age <= 14) { temp = 31; feedPerBird = 11; if(age >= 13) meds = "جرعة وقاية: كوكسيديا وكلوستريديا"; }
    else if (age <= 21) { temp = 28; feedPerBird = 15; meds = "فيتامينات (هـ سيلينيوم) لرفع المناعة"; }
    else if (age <= 28) { temp = 25; feedPerBird = 20; meds = "ماء نقي"; }
    else if (age <= 35) { temp = 24; feedPerBird = 24; meds = "ماء نقي (يمنع إعطاء أدوية لفترة السحب)"; }
    else { temp = 24; feedPerBird = 28; meds = "ماء نقي - الدفعة جاهزة للذبح"; }

    // الحسابات الكلية بناءً على العدد الحي
    let totalFeedKg = (feedPerBird * aliveCount) / 1000;
    // السمان يشرب ماء تقريباً ضعف ونصف إلى ضعفي كمية العلف
    let totalWaterLiters = (totalFeedKg * 2.2); 
    
    // حساب المساحة: الأرضي 60 طائر للمتر، البطاريات 120 طائر للمتر (أرقام السمان البالغ لضمان الراحة)
    let spaceRequired = system === 'battery' ? (aliveCount / 120) : (aliveCount / 60);

    return { 
        temp: temp, 
        feed: totalFeedKg.toFixed(2), 
        water: totalWaterLiters.toFixed(1), 
        space: spaceRequired.toFixed(1), 
        meds: meds 
    };
}

window.openDailyGuide = (id) => {
    const b = allBatches[id];
    if(b.birdType !== 'quail') return showToast("هذا الدليل مبرمج للسمان فقط حالياً!", true);

    const now = new Date();
    const age = Math.floor((now - new Date(b.hatchDate)) / 86400000) || 1; // إذا كان العمر 0 نعتبره اليوم الأول
    const alive = b.hatchedChicks - (b.totalDead || 0);
    const system = b.rearingSystem || 'floor';
    const systemName = system === 'floor' ? 'أرضي (نشارة)' : 'بطاريات (أقفاص)';

    const needs = getQuailDailyNeeds(age, alive, system);

    const content = `
        <div style="background:var(--bg-main); padding:15px; border-radius:12px; border:1px solid var(--border);">
            <div style="text-align:center; margin-bottom:15px;">
                <span style="font-size:14px; color:var(--text-secondary);">دفعة: <strong>${b.name}</strong></span><br>
                <span style="font-size:18px; color:var(--primary); font-weight:800;">عمر: ${age} يوم</span>
            </div>
            
            <div class="grid-2" style="gap:10px;">
                <div style="background:var(--surface); padding:10px; border-radius:8px; border-right:4px solid var(--danger);">
                    <div style="font-size:12px; color:var(--text-secondary);">🌡️ الحرارة المطلوبة</div>
                    <div style="font-size:20px; font-weight:bold; color:var(--text-primary);">${needs.temp} °C</div>
                </div>
                <div style="background:var(--surface); padding:10px; border-radius:8px; border-right:4px solid var(--info);">
                    <div style="font-size:12px; color:var(--text-secondary);">💧 المياه المطلوبة</div>
                    <div style="font-size:20px; font-weight:bold; color:var(--text-primary);">${needs.water} لتر</div>
                </div>
            </div>

            <div style="background:var(--surface); padding:10px; border-radius:8px; margin-top:10px; border-right:4px solid var(--warning);">
                <div style="font-size:12px; color:var(--text-secondary);">🌾 كمية العلف لليوم بالكامل (${alive} طائر)</div>
                <div style="font-size:20px; font-weight:bold; color:var(--warning);">${needs.feed} كجم</div>
            </div>

            <div style="background:var(--surface); padding:10px; border-radius:8px; margin-top:10px; border-right:4px solid var(--primary);">
                <div style="font-size:12px; color:var(--text-secondary);">💊 التحصينات أو الإضافات بالماء اليوم</div>
                <div style="font-size:15px; font-weight:bold; color:var(--primary);">${needs.meds}</div>
            </div>

            <div style="background:var(--surface); padding:10px; border-radius:8px; margin-top:10px; border-right:4px solid var(--success);">
                <div style="font-size:12px; color:var(--text-secondary);">📏 المساحة ونوع التربية</div>
                <div style="font-size:14px; font-weight:bold; color:var(--text-primary);">
                    نظام: ${systemName} <br>
                    مساحة العنبر المطلوبة: <span style="color:var(--success); font-size:16px;">${needs.space} متر مربع</span>
                </div>
            </div>
        </div>
    `;

    document.getElementById('dailyGuideContent').innerHTML = content;
    openModal('modalDailyGuide');
};

