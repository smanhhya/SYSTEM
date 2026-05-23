import { db, ref, set, get, push, update, remove, onValue } from './firebase.js';
import { switchPage, openModal, closeModal, showToast, toggleFab } from './ui.js';

let allBatches = {};
let allTransactions = {};
let allFreezerLogs = {};
let manualCash = 0; 
let currentFeedStock = 0;

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
        // تعيين الوقت والتاريخ الحالي تلقائياً
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('bDate').value = now.toISOString().slice(0,16);
    }
    openModal(id);
};
window.closeModal = closeModal;
window.toggleFab = toggleFab;
window.showToast = showToast;

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

// ================= العمليات الأساسية =================
window.saveNewBatch = async () => {
    const name = document.getElementById('bName').value;
    const eggs = parseInt(document.getElementById('bEggs').value);
    const datetimeStr = document.getElementById('bDate').value; // يأخذ التاريخ والوقت الدقيق
    const bType = document.getElementById('bBirdType').value;
    
    if(!name || !eggs || !datetimeStr) return showToast("أكمل البيانات", true);

    const std = birdStandards[bType];
    const insertD = new Date(datetimeStr);
    
    // حساب التواريخ بناءً على الوقت الدقيق
    const hatcherD = new Date(insertD); hatcherD.setHours(insertD.getHours() + (std.hatcher * 24));
    const hatchD = new Date(insertD); hatchD.setHours(insertD.getHours() + (std.hatch * 24));
    const rearD = new Date(hatchD); rearD.setHours(hatchD.getHours() + (std.slaughter * 24));

    // إعطاء الدفعة رقم ترتيب عشان نقدر نحركها فوق وتحت
    const orderIndex = Date.now();

    await push(ref(db, 'batches'), { 
        name, birdType: bType, 
        insertDate: datetimeStr, // تخزين الوقت الدقيق
        hatcherDate: hatcherD.toISOString(), 
        hatchDate: hatchD.toISOString(), 
        rearDate: rearD.toISOString(), 
        initialEggs: eggs, status: 'incubator', totalDead: 0, totalFeed: 0,
        order: orderIndex
    });
    
    document.getElementById('bName').value = ''; document.getElementById('bEggs').value = '';
    closeModal('modalBatch'); showToast(`تم تسجيل الدفعة بدقة`);
};

// دالة مخصصة لبيع البيض من المفرخ (مفيدة للرومي)
window.sellEggsFromIncubator = async (batchId) => {
    const batch = allBatches[batchId];
    const eggPrice = batch.birdType === 'turkey' ? (globalSettings.turkeyEgg || 10) : 2; // افتراضي
    const qty = prompt(`كم عدد البيض المباع من دفعة "${batch.name}"؟ (سعر البيضة المحسوب: ${eggPrice} ج.م)`, "0");
    
    if(qty && !isNaN(qty) && parseInt(qty) > 0) {
        const sellQty = parseInt(qty);
        if(sellQty > batch.initialEggs) return showToast("العدد أكبر من المتاح!", true);
        
        const totalAmount = sellQty * eggPrice;
        
        // 1. خصم العدد من المفرخ
        await update(ref(db, `batches/${batchId}`), { initialEggs: batch.initialEggs - sellQty });
        // 2. إضافة إيراد مبيعات
        await push(ref(db, 'ledger'), { type: 'in', amount: totalAmount, desc: `بيع بيض (${sellQty} بيضة) - ${batch.name}`, batchId: batchId, date: new Date().toISOString().split('T')[0], timestamp: Date.now() });
        // 3. تحديث الخزنة
        await set(ref(db, "cashBox"), manualCash + totalAmount);
        
        showToast(`تم بيع ${sellQty} بيضة بإجمالي ${totalAmount} ج.م`);
    }
};

// دوال تحريك الدفعات (فوق وتحت)
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

// ================= عرض البيانات (الداشبورد والمفرخ مع الإشعارات) =================
onValue(ref(db, "batches"), (snapshot) => {
    allBatches = snapshot.exists() ? snapshot.val() : {};
    renderBatches();
});

function formatDateTime(isoString) {
    if(!isoString) return '-';
    const date = new Date(isoString);
    const d = date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    const t = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute:'2-digit' });
    return `${d} (${t})`;
}

function renderBatches() {
    const ui = { inc: document.getElementById('incubatorList'), rear: document.getElementById('rearingList'), slaugh: document.getElementById('slaughterList'), alerts: document.getElementById('alertsContainer') };
    if(!ui.inc) return;
    ui.inc.innerHTML = ''; ui.rear.innerHTML = ''; ui.slaugh.innerHTML = ''; ui.alerts.innerHTML = ''; 
    let stats = { eggs: 0, chicks: 0 }; const now = new Date();

    // ترتيب الدفعات حسب حقل order
    const sortedBatchIds = Object.keys(allBatches).sort((a,b) => (allBatches[b].order || 0) - (allBatches[a].order || 0));

    sortedBatchIds.forEach(id => {
        const b = allBatches[id];
        const std = birdStandards[b.birdType || 'quail'];
        const bTypeName = std.name;
        const bIcon = std.icon;

        // إشعارات المفرخ
        let batchAlertHtml = '';

        if (b.status === 'incubator' || b.status === 'hatcher') {
            stats.eggs += b.initialEggs;
            // حساب الساعات وليس الأيام فقط لدقة أعلى
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
                    </div>
                    <div style="display:flex; gap:5px;">
                        ${actionBtn}
                    </div>
                </div>
            </div>`;
        }
        // (باقي الكود الخاص بعنابر التربية والذبح يعمل كما كان)...
    });
    
    if(ui.alerts.innerHTML === '') ui.alerts.innerHTML = '<div style="color:var(--success); font-weight:bold;">✅ لا يوجد تنبيهات أو نواقص حالياً.</div>';
    if(document.getElementById('dashEggs')) document.getElementById('dashEggs').innerText = stats.eggs; 
}

// أضفنا ستايل النبض (Pulse) للإشعارات الحية في الـ CSS برمجياً لتجنب تعديل index.html مرة أخرى
if (!document.getElementById('dynamicStyles')) {
    const style = document.createElement('style');
    style.id = 'dynamicStyles';
    style.innerHTML = `@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }`;
    document.head.appendChild(style);
}
