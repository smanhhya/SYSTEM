import { db, ref, set, get, push, update, remove, onValue } from './firebase.js';
import { switchPage, openModal, closeModal, showToast, toggleFab } from './ui.js';

let allBatches = {};
let allTransactions = {};
let allFreezerLogs = {};
let manualCash = 0; 
let currentFeedStock = 0; 
let dynamicFreezerConfig = {}; 

let currentLedgerFilter = 'all'; 
let currentLedgerSearch = '';

const birdStandards = {
    quail: { name: 'سمان', icon: '🕊️', hatcher: 15, hatch: 18, slaughter: 35 },
    chicken: { name: 'فراخ بيضاء', icon: '🐔', hatcher: 18, hatch: 21, slaughter: 40 },
    turkey: { name: 'رومي', icon: '🦃', hatcher: 25, hatch: 28, slaughter: 90 }
};

let globalSettings = { 
    birdType: 'quail', feedPrice: 30, quailChick: 3.5, chickenChick: 25, turkeyChick: 60, turkeyEgg: 10 
};

// ================= 1. التبديل والواجهة =================
window.switchPage = (pageId) => {
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if(targetPage) targetPage.classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }
};

window.switchSettingsTab = (tabId, element) => {
    document.querySelectorAll('.settings-nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.settings-tab').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
};

window.autoCalcDates = () => {
    const type = document.getElementById('bBirdType').value;
    const dateStr = document.getElementById('bDate').value;
    if(!dateStr) return;
    
    const std = birdStandards[type] || birdStandards['quail'];
    const insertD = new Date(dateStr);
    
    const hatcherD = new Date(insertD); hatcherD.setHours(insertD.getHours() + (std.hatcher * 24));
    const hatchD = new Date(insertD); hatchD.setHours(insertD.getHours() + (std.hatch * 24));
    
    let slDays = parseInt(document.getElementById('bSlaughterDays')?.value) || std.slaughter;
    const rearD = new Date(hatchD); rearD.setHours(hatchD.getHours() + (slDays * 24));
    
    const formatForInput = (d) => {
        const pad = (n) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    
    if(document.getElementById('bHatcherDate')) document.getElementById('bHatcherDate').value = formatForInput(hatcherD);
    if(document.getElementById('bHatchDate')) document.getElementById('bHatchDate').value = formatForInput(hatchD);
    if(document.getElementById('bSlaughterDate')) document.getElementById('bSlaughterDate').value = formatForInput(rearD);
};

window.openModal = (id) => {
    const modalEl = document.getElementById(id);
    if(modalEl) {
        modalEl.querySelectorAll('input[type="number"], input[type="text"]').forEach(input => {
            if(input.id !== 'bHatcherDate' && input.id !== 'bHatchDate' && input.id !== 'bSlaughterDate') {
                input.value = '';
            }
        });
    }

    if(id === 'modalBatch') {
        const typeEl = document.getElementById('bBirdType');
        if(typeEl) typeEl.value = globalSettings.birdType || 'quail';
        const dateEl = document.getElementById('bDate');
        if(dateEl) {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            dateEl.value = now.toISOString().slice(0,16);
        }
        setTimeout(window.autoCalcDates, 50); 
    } 
    openModal(id); 
};

window.closeModal = closeModal;
window.toggleFab = toggleFab;
window.showToast = showToast;

// ================= 2. المظهر =================
const savedTheme = localStorage.getItem('erp_theme') || 'light';
const savedColor = localStorage.getItem('erp_primary_color') || '#2563eb';
document.documentElement.setAttribute('data-theme', savedTheme);
document.documentElement.style.setProperty('--primary', savedColor);

window.setThemeMode = (mode, el) => {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('erp_theme', mode);
    if(el) {
        el.parentElement.querySelectorAll('.theme-option').forEach(s => s.classList.remove('active'));
        el.classList.add('active');
    }
    showToast(mode === 'dark' ? "تم تفعيل الوضع الليلي 🌙" : "تم تفعيل الوضع الفاتح ☀️");
};

window.setPrimaryColor = (color, el) => {
    document.documentElement.style.setProperty('--primary', color);
    localStorage.setItem('erp_primary_color', color);
    if(el) {
        el.parentElement.querySelectorAll('.color-circle').forEach(s => s.classList.remove('active'));
        el.classList.add('active');
    }
    showToast("تم تغيير اللون بنجاح 🎨");
};

// ================= 3. إعدادات الخزنة والمخزن =================
onValue(ref(db, "inventory/feedStock"), (snapshot) => {
    currentFeedStock = snapshot.exists() ? parseFloat(snapshot.val()) : 0;
    const feedEl = document.getElementById('feedStockDisplay');
    if(feedEl) {
        feedEl.innerHTML = `
            <div onclick="editFeedStock()" style="cursor:pointer; display:inline-block; border-bottom: 2px dashed var(--primary); padding-bottom: 2px;">
                ${currentFeedStock} <span style="font-size: 16px;">كجم</span> <i class="fas fa-edit" style="font-size: 14px; color: var(--primary);"></i>
            </div>`;
    }
});

window.editFeedStock = async () => {
    const newQty = prompt("تعديل رصيد العلف يدوياً (بالكجم):", currentFeedStock);
    if(newQty !== null && !isNaN(newQty)) {
        const val = Number(newQty);
        try {
            await set(ref(db, "inventory/feedStock"), val);
            currentFeedStock = val;
            const feedEl = document.getElementById('feedStockDisplay');
            if(feedEl) {
                feedEl.innerHTML = `
                    <div onclick="editFeedStock()" style="cursor:pointer; display:inline-block; border-bottom: 2px dashed var(--primary); padding-bottom: 2px;">
                        ${val} <span style="font-size: 16px;">كجم</span> <i class="fas fa-edit" style="font-size: 14px; color: var(--primary);"></i>
                    </div>`;
            }
            showToast("تم تحديث رصيد العلف بنجاح 👍");
        } catch(err) {
            console.error(err);
            showToast("فشل تعديل الرصيد ❌", true);
        }
    }
};

window.buyFeed = async () => {
    const qty = parseFloat(document.getElementById('bfQty')?.value) || 0;
    const cost = parseFloat(document.getElementById('bfTotalCost')?.value) || 0;
    if(!qty || !cost) return showToast("برجاء إدخال البيانات", true);

    await set(ref(db, "inventory/feedStock"), currentFeedStock + qty);
    await push(ref(db, 'ledger'), { type: 'out', amount: cost, desc: `شراء علف (${qty} كجم)`, batchId: 'general', date: new Date().toISOString().split('T')[0], timestamp: Date.now() });
    await set(ref(db, "cashBox"), manualCash - cost);
    closeModal('modalBuyFeed'); showToast(`تم إضافة ${qty} كجم`);
};

onValue(ref(db, "cashBox"), (snapshot) => {
    manualCash = snapshot.exists() ? snapshot.val() : 0;
    updateCashDisplay();
});

function updateCashDisplay() {
    const netProfitEl = document.getElementById('netProfit');
    if (!netProfitEl) return;
    let cashBoxEl = document.getElementById('customCashBoxDisplay');
    if (!cashBoxEl) {
        const container = document.createElement('div');
        container.innerHTML = `<span style="font-size: 13px; color: var(--text-secondary); display:block; margin-bottom:4px;">💵 الكاش الفعلي بالخزنة الآن:</span><div style="font-size: 26px; font-weight: 800; margin-bottom: 8px; color:var(--warning);" id="customCashBoxDisplay">0 ج.م</div><button onclick="editCashBox()" style="background: transparent; border: 1px solid var(--border); color: var(--text-primary); padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: bold;"><i class="fas fa-edit"></i> تعديل الكاش</button>`;
        netProfitEl.parentElement.appendChild(container);
        cashBoxEl = document.getElementById('customCashBoxDisplay');
    }
    if (cashBoxEl) cashBoxEl.innerText = manualCash + " ج.م";
}

window.editCashBox = async () => {
    const newCash = prompt("المبلغ الفعلي بالخزنة الآن:", manualCash);
    if (newCash !== null && !isNaN(newCash) && newCash.trim() !== "") {
        await set(ref(db, "cashBox"), parseFloat(newCash)); showToast("تم التحديث");
    }
};

onValue(ref(db, "settings"), (snapshot) => {
    if(snapshot.exists()) {
        globalSettings = { ...globalSettings, ...snapshot.val() };
        if(document.getElementById('setBirdType')) document.getElementById('setBirdType').value = globalSettings.birdType || 'quail';
        if(document.getElementById('setFeed')) document.getElementById('setFeed').value = globalSettings.feedPrice;
        if(document.getElementById('setQuailChick')) document.getElementById('setQuailChick').value = globalSettings.quailChick || 3.5;
        if(document.getElementById('setChickenChick')) document.getElementById('setChickenChick').value = globalSettings.chickenChick || 25;
        if(document.getElementById('setTurkeyChick')) document.getElementById('setTurkeyChick').value = globalSettings.turkeyChick || 60;
        if(document.getElementById('setTurkeyEgg')) document.getElementById('setTurkeyEgg').value = globalSettings.turkeyEgg || 10;
    }
});

window.saveSettings = async () => {
    const newSet = {
        birdType: document.getElementById('setBirdType')?.value || 'quail',
        feedPrice: parseFloat(document.getElementById('setFeed')?.value) || 0,
        quailChick: parseFloat(document.getElementById('setQuailChick')?.value) || 3.5,
        chickenChick: parseFloat(document.getElementById('setChickenChick')?.value) || 25,
        turkeyChick: parseFloat(document.getElementById('setTurkeyChick')?.value) || 60,
        turkeyEgg: parseFloat(document.getElementById('setTurkeyEgg')?.value) || 10
    };
    await set(ref(db, 'settings'), newSet); showToast("تم حفظ إعدادات التشغيل");
};

// ================= 4. الفريزر الديناميكي وتحكم الأصناف =================
let currentFreezerStock = {};
onValue(ref(db, "inventory/freezerStock"), (snapshot) => {
    currentFreezerStock = snapshot.exists() ? snapshot.val() : {};
    if(typeof window.renderFreezerGrid === 'function') window.renderFreezerGrid();
});

onValue(ref(db, "inventory/freezerConfig"), async (snapshot) => {
    if(!snapshot.exists() || Object.keys(snapshot.val()).length === 0) {
        const defaultCats = {
            'royal': { name: 'رويال', price: 120 },
            'jumbo': { name: 'جامبو', price: 90 },
            'super': { name: 'سوبر', price: 80 }
        };
        await set(ref(db, "inventory/freezerConfig"), defaultCats);
        await set(ref(db, "inventory/freezerStock"), { 'royal':0, 'jumbo':0, 'super':0 });
        return; 
    }

    dynamicFreezerConfig = snapshot.val();
    
    const saleSelect = document.getElementById('sGrade');
    if(saleSelect) {
        saleSelect.innerHTML = '<option value="">-- اختر الصنف للبيع --</option>';
        Object.keys(dynamicFreezerConfig).forEach(id => {
            saleSelect.innerHTML += `<option value="${id}">${dynamicFreezerConfig[id].name}</option>`;
        });
    }

    if(typeof window.renderManageCategories === 'function') window.renderManageCategories();
    if(typeof window.renderFreezerGrid === 'function') window.renderFreezerGrid();
});

window.renderFreezerGrid = () => {
    const grid = document.getElementById('freezerGrid');
    const dashTotal = document.getElementById('dashFreezer');
    if(!grid) return;
    
    grid.innerHTML = ''; let totalCount = 0;
    
    if(Object.keys(dynamicFreezerConfig).length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:20px; color:var(--text-secondary);">الفريزر فارغ، اضغط على إدارة الأصناف للإضافة.</div>`;
    } else {
        Object.keys(dynamicFreezerConfig).forEach(id => {
            const item = dynamicFreezerConfig[id];
            const qty = currentFreezerStock[id] || 0;
            totalCount += qty;
            
            grid.innerHTML += `
                <div class="card" onclick="editFreezerItem('${id}', ${qty}, ${item.price}, '${item.name}')" 
                     style="cursor:pointer; text-align:center; transition:0.3s; border:1px solid var(--border); padding: 15px; margin: 0; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <div style="font-size: 24px; color: var(--primary);">
                        <i class="fas fa-box-open"></i>
                    </div>
                    <h4 style="margin:0; color:var(--text-secondary); font-size:14px;">${item.name}</h4>
                    <div style="font-size:28px; font-weight:800; color:var(--primary); margin:0;">${qty}</div>
                    <div style="font-size:12px; color:var(--success); font-weight:bold; background: rgba(22, 163, 74, 0.1); padding: 4px 8px; border-radius: 6px;">
                        ${item.price} ج.م <i class="fas fa-edit" style="margin-right: 5px;"></i>
                    </div>
                </div>
            `;
        });
    }
    if(dashTotal) dashTotal.innerText = totalCount;
};

window.editFreezerItem = (id, currentStock, currentPrice, name) => {
    const newQtyStr = prompt(`تعديل رصيد صنف (${name}):`, currentStock);
    if(newQtyStr === null) return; 
    
    const newPriceStr = prompt(`تعديل سعر صنف (${name}) بالجنيه:`, currentPrice);
    if(newPriceStr === null) return; 

    const newQty = parseInt(newQtyStr) || 0;
    const newPrice = parseFloat(newPriceStr) || 0;

    update(ref(db, `inventory/freezerStock`), { [id]: newQty });
    update(ref(db, `inventory/freezerConfig/${id}`), { price: newPrice });
    showToast("تم التعديل بنجاح 👍");
};

window.renderManageCategories = () => {
    const container = document.getElementById('freezerCategoriesList');
    if(!container) return;
    container.innerHTML = '';
    
    if(Object.keys(dynamicFreezerConfig).length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#777;">لا توجد أصناف مضافة حالياً.</p>'; return;
    }

    for (const [id, cat] of Object.entries(dynamicFreezerConfig)) {
        container.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border); background: var(--surface); margin-bottom: 5px; border-radius: 5px;">
                <div>
                    <strong style="font-size: 16px; color: var(--text-primary);">${cat.name}</strong> 
                    <span style="color: var(--success); font-size: 14px;">(السعر: ${cat.price})</span>
                </div>
                <button class="btn btn-danger" onclick="deleteFreezerCategory('${id}')" style="padding: 5px 10px; font-size: 12px; margin:0; width:auto;">🗑️ حذف</button>
            </div>
        `;
    }
};

window.addCategoryFromMaster = async () => {
    const nameInput = document.getElementById('masterCatName');
    const priceInput = document.getElementById('masterCatPrice');
    if(!nameInput || !priceInput) return;

    const name = nameInput.value.trim();
    const price = priceInput.value || 0;
    
    if (!name) return showToast("يرجى كتابة اسم الصنف!", true);

    const newId = 'cat_' + Date.now();
    await set(ref(db, `inventory/freezerConfig/${newId}`), { name: name, price: Number(price) });
    await set(ref(db, `inventory/freezerStock/${newId}`), 0);

    nameInput.value = ''; priceInput.value = '';
    showToast("تمت إضافة الصنف بنجاح!");
};

window.deleteFreezerCategory = async (id) => {
    if(confirm("هل أنت متأكد من حذف هذا الصنف؟ \nسيختفي من القوائم.")) {
        await remove(ref(db, `inventory/freezerConfig/${id}`));
        await remove(ref(db, `inventory/freezerStock/${id}`));
        showToast("تم الحذف بنجاح");
    }
};

let isDeleteLogMode = false;
window.toggleLogDeletion = () => {
    isDeleteLogMode = !isDeleteLogMode;
    if(typeof window.renderFreezerLogs === 'function') window.renderFreezerLogs(); 
};

window.deleteFreezerLog = async (logId) => {
    if(confirm("هل أنت متأكد من حذف هذا السجل؟ (هذا الإجراء لا يعدل الرصيد، يحذف السجل فقط)")) {
        await remove(ref(db, `inventory/freezerLogs/${logId}`));
        showToast("تم حذف السجل");
    }
};

onValue(ref(db, "inventory/freezerLogs"), (snapshot) => {
    allFreezerLogs = snapshot.exists() ? snapshot.val() : {}; 
    window.renderFreezerLogs();
});

window.renderFreezerLogs = () => {
    const el = document.getElementById('freezerLogs');
    if(!el) return;
    let html = ''; const now = new Date();
    
    Object.keys(allFreezerLogs).sort((a,b)=> new Date(allFreezerLogs[b].dateAdded) - new Date(allFreezerLogs[a].dateAdded)).forEach(key => {
        const log = allFreezerLogs[key]; 
        const daysOld = Math.floor((now - new Date(log.dateAdded)) / 86400000);
        let ageTag = daysOld <= 7 ? '<span class="freezer-tag-new" style="background:var(--success); color:white; padding:2px 6px; border-radius:4px; font-size:10px;">جديد</span>' : `<span style="font-size:11px;color:var(--text-secondary);">منذ ${daysOld} يوم</span>`;
        
        const safeItems = log.items || {};
        let itemsStr = Object.keys(safeItems).filter(k => safeItems[k]>0).map(k => `${dynamicFreezerConfig[k]?.name || k}: ${safeItems[k]}`).join(' | ');
        
        if(!itemsStr) itemsStr = 'لم يتم تحديد أصناف وقت الذبح';

        let delBtn = isDeleteLogMode ? `<button class="btn btn-danger" style="padding: 4px 8px; font-size: 10px; width:auto; margin:0;" onclick="deleteFreezerLog('${key}')">حذف</button>` : '';

        html += `<div class="freezer-log" style="background:var(--bg-main); padding:12px; border-radius:8px; margin-bottom:8px; border-left:4px solid var(--info);">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; align-items:center;">
                <div><strong>${log.batchName}</strong> ${ageTag}</div>
                ${delBtn}
            </div>
            <div style="color:var(--text-secondary); font-size:12px; margin-bottom:5px;">تاريخ التخزين: ${log.dateAdded}</div>
            <div style="font-weight:bold; color:var(--primary); font-size:13px;">${itemsStr}</div>
        </div>`;
    });
    
    el.innerHTML = html || '<div style="text-align:center; padding:10px; color:var(--text-secondary);">لا توجد سجلات تخزين</div>';
};

// ================= 5. الدفعات والذبح الديناميكي =================
window.saveNewBatch = async () => {
    const name = document.getElementById('bName')?.value || '';
    const eggs = parseInt(document.getElementById('bEggs')?.value) || 0;
    const datetimeStr = document.getElementById('bDate')?.value || ''; 
    const bType = document.getElementById('bBirdType')?.value || 'quail';
    
    const hatcherD = document.getElementById('bHatcherDate')?.value;
    const hatchD = document.getElementById('bHatchDate')?.value;
    const rearD = document.getElementById('bSlaughterDate')?.value;
    
    if(!name || !eggs || !datetimeStr || !hatcherD || !hatchD || !rearD) return showToast("أكمل البيانات والتواريخ المتوقعة", true);

    // 💡 الإصلاح المحاسبي رقم 1: تم إزالة حساب وحفظ تكلفة البيض هنا لعدم المحاسبة مرتين
    // البيض يدخل المفرخ كعهدة عينية بدون تكلفة في الدفتر حتى يتحول لكتاكيت أو يُباع.

    const newBatchRef = push(ref(db, 'batches'));
    await set(newBatchRef, { 
        name, birdType: bType, 
        insertDate: datetimeStr, 
        hatcherDate: new Date(hatcherD).toISOString(), 
        hatchDate: new Date(hatchD).toISOString(), 
        rearDate: new Date(rearD).toISOString(), 
        initialEggs: eggs, status: 'incubator', totalDead: 0, totalFeed: 0,
        order: Date.now()
    });
    
    closeModal('modalBatch'); 
    showToast(`تم تسجيل الدفعة بنجاح بالمفرخ!`);
};

window.openEditBatch = (id) => {
    const b = allBatches[id];
    document.getElementById('editBatchId').value = id;
    document.getElementById('editBName').value = b.name;
    document.getElementById('editBEggs').value = b.initialEggs;
    if(b.insertDate) document.getElementById('editBDate').value = b.insertDate;
    openModal('modalEditBatch');
};

window.saveEditBatch = async () => {
    const id = document.getElementById('editBatchId').value;
    const b = allBatches[id];
    const newName = document.getElementById('editBName').value;
    const newEggs = parseInt(document.getElementById('editBEggs').value);
    const newDateStr = document.getElementById('editBDate').value;
    
    if(!newName || !newEggs || !newDateStr) return showToast("أكمل البيانات", true);

    const std = birdStandards[b.birdType || 'quail'];
    const insertD = new Date(newDateStr);
    const hatcherD = new Date(insertD); hatcherD.setHours(insertD.getHours() + (std.hatcher * 24));
    const hatchD = new Date(insertD); hatchD.setHours(insertD.getHours() + (std.hatch * 24));
    const rearD = new Date(hatchD); rearD.setHours(hatchD.getHours() + (std.slaughter * 24));

    await update(ref(db, `batches/${id}`), { name: newName, initialEggs: newEggs, insertDate: newDateStr, hatcherDate: hatcherD.toISOString(), hatchDate: hatchD.toISOString(), rearDate: rearD.toISOString() });
    closeModal('modalEditBatch'); showToast("تم تحديث الدفعة");
};

window.updateStage = async (id, stage) => { 
    if (stage === 'slaughter' && !confirm("⚠️ هل أنت متأكد من نقل الدفعة للذبح؟")) return;
    await update(ref(db, `batches/${id}`), { status: stage }); 
    showToast("تم تحديث الحالة");
};

window.deleteBatch = async (id) => { if(confirm("هل أنت متأكد من الحذف؟")) { await remove(ref(db, `batches/${id}`)); showToast("تم الحذف"); } };

window.promptHatch = (id) => { const el = document.getElementById('hatchBatchId'); if(el) el.value = id; openModal('modalHatch'); };

window.moveToRearing = async () => {
    const id = document.getElementById('hatchBatchId')?.value;
    const healthy = parseInt(document.getElementById('hHealthy')?.value) || 0;
    const unfert = parseInt(document.getElementById('hUnfert')?.value) || 0;
    const dead = parseInt(document.getElementById('hDead')?.value) || 0;
    const rearingSys = document.getElementById('hRearingSystem')?.value || 'floor';
    
    if(!id || healthy < 0) return showToast("أدخل أرقاماً صحيحة", true);
    
    const b = allBatches[id];
    const initialEggs = b.initialEggs;
    const totalOut = healthy + unfert + dead;

    if (totalOut > initialEggs) {
        return showToast(`❌ مجموع المخرجات (${totalOut}) أكبر من البيض المدخل!`, true);
    }

    // 💡 الإصلاح المحاسبي رقم 2: حساب تكلفة الكتاكيت فقط (قسم التربية يحاسب قسم التفريخ)
    let unitPrice = 0;
    if(b.birdType === 'quail') unitPrice = globalSettings.quailChick || 0;
    else if(b.birdType === 'chicken') unitPrice = globalSettings.chickenChick || 0;
    else if(b.birdType === 'turkey') unitPrice = 0; // الرومي حسب الاتفاق أو التعديل

    const totalChickCost = healthy * unitPrice;

    const hatchRate = ((healthy / initialEggs) * 100).toFixed(1);
    await update(ref(db, `batches/${id}`), { 
        status: 'rearing', 
        hatchedChicks: healthy, 
        hatchRate: hatchRate, 
        rearingSystem: rearingSys, 
        unfertilized: unfert, 
        deadInShell: dead 
    });

    if(totalChickCost > 0) {
        await push(ref(db, 'ledger'), { 
            type: 'batch_cost', 
            amount: totalChickCost, 
            desc: `تكلفة تحويل كتاكيت للتربية (${healthy} طائر × ${unitPrice}ج)`, 
            batchId: id, 
            date: new Date().toISOString().split('T')[0], 
            timestamp: Date.now() 
        });
    }
    
    closeModal('modalHatch'); 
    showToast(`تم النقل للتربية! تم تحميل ${totalChickCost} ج.م كتكلفة للدفعة.`);
};

window.sellEggsFromIncubator = async (batchId) => {
    const batch = allBatches[batchId];
    
    let eggPrice = 0;
    if(batch.birdType === 'quail') eggPrice = globalSettings.quailChick || 0;
    else if(batch.birdType === 'chicken') eggPrice = globalSettings.chickenChick || 0;
    else if(batch.birdType === 'turkey') eggPrice = globalSettings.turkeyEgg || 0;

    const qty = prompt(`كم عدد البيض المباع من دفعة "${batch.name}"؟\n(سعر البيضة المبرمج: ${eggPrice} ج.م)`, "0");
    
    if(qty && !isNaN(qty) && parseInt(qty) > 0) {
        const sellQty = parseInt(qty);
        if(sellQty > batch.initialEggs) return showToast("العدد أكبر من المتاح!", true);
        
        const totalAmount = sellQty * eggPrice;
        
        await update(ref(db, `batches/${batchId}`), { initialEggs: batch.initialEggs - sellQty });
        
        // 💡 الإصلاح المحاسبي رقم 3: البيضة تتباع كإيراد صافي بدون خصم تكلفة سابقة
        await push(ref(db, 'ledger'), { 
            type: 'in', 
            amount: totalAmount, 
            desc: `بيع بيض (${sellQty}) - ${batch.name}`, 
            batchId: batchId, 
            date: new Date().toISOString().split('T')[0], 
            timestamp: Date.now() 
        });
        
        await set(ref(db, "cashBox"), manualCash + totalAmount);
        showToast(`تم بيع ${sellQty} بيضة بإجمالي ${totalAmount} ج.م كإيراد`);
    }
};

window.moveBatchUp = async (id) => {
    const target = allBatches[id];
    const isInc = (status) => ['incubator', 'hatcher'].includes(status);
    const isSamePhase = (s1, s2) => (isInc(s1) && isInc(s2)) || s1 === s2;
    
    const arr = Object.keys(allBatches)
        .map(k => ({ id: k, ...allBatches[k] }))
        .filter(b => b.birdType === target.birdType && isSamePhase(b.status, target.status))
        .sort((a,b) => (b.order || 0) - (a.order || 0));
        
    const idx = arr.findIndex(b => b.id === id);
    if(idx > 0) { 
        await update(ref(db, `batches/${arr[idx - 1].id}`), { order: arr[idx].order }); 
        await update(ref(db, `batches/${id}`), { order: arr[idx - 1].order }); 
    }
};

window.moveBatchDown = async (id) => {
    const target = allBatches[id];
    const isInc = (status) => ['incubator', 'hatcher'].includes(status);
    const isSamePhase = (s1, s2) => (isInc(s1) && isInc(s2)) || s1 === s2;

    const arr = Object.keys(allBatches)
        .map(k => ({ id: k, ...allBatches[k] }))
        .filter(b => b.birdType === target.birdType && isSamePhase(b.status, target.status))
        .sort((a,b) => (b.order || 0) - (a.order || 0));
        
    const idx = arr.findIndex(b => b.id === id);
    if(idx < arr.length - 1) { 
        await update(ref(db, `batches/${arr[idx + 1].id}`), { order: arr[idx].order }); 
        await update(ref(db, `batches/${id}`), { order: arr[idx + 1].order }); 
    }
};

window.promptClassify = (id) => { 
    const classIdEl = document.getElementById('classBatchId');
    if(classIdEl) classIdEl.value = id; 
    
    const modalGrid = document.querySelector('#modalClassify .grid-2');
    if(modalGrid) {
        modalGrid.innerHTML = ''; 
        Object.keys(dynamicFreezerConfig).forEach(catId => {
            modalGrid.innerHTML += `
            <div>
                <label>${dynamicFreezerConfig[catId].name}</label>
                <input type="number" id="c_${catId}" value="0" onclick="this.select()">
            </div>`;
        });
    }
    openModal('modalClassify'); 
};

window.finishSlaughter = async () => {
    const classIdEl = document.getElementById('classBatchId');
    const id = classIdEl ? classIdEl.value : null;
    if(!id) return;
    
    const b = allBatches[id];
    const aliveBirds = (b.hatchedChicks || 0) - (b.totalDead || 0);
    
    let yieldPairs = 0; const toAdd = {};
    
    Object.keys(dynamicFreezerConfig).forEach(catId => { 
        const inputEl = document.getElementById(`c_${catId}`);
        const val = inputEl ? (parseInt(inputEl.value) || 0) : 0; 
        if(val > 0) { toAdd[catId] = val; yieldPairs += val; }
    });
    
    if(yieldPairs === 0 && !confirm("هل أنت متأكد من ترحيل الدفعة بأرقام صفرية؟")) return;

    // 🛡️ الحارس المنطقي للتصنيف
    const totalProcessedBirds = yieldPairs * 2;
    if (totalProcessedBirds > aliveBirds) {
        return showToast(`❌ مستحيل! قمت بتصنيف ${yieldPairs} جوز (${totalProcessedBirds} طائر)، والمتبقي في العنبر ${aliveBirds} طائر فقط!`, true);
    }

    const stockSnap = await get(ref(db, "inventory/freezerStock")); 
    let currentStock = stockSnap.exists() ? stockSnap.val() : {};
    Object.keys(toAdd).forEach(catId => currentStock[catId] = (currentStock[catId]||0) + toAdd[catId]);
    
    await set(ref(db, "inventory/freezerStock"), currentStock);
    await push(ref(db, 'inventory/freezerLogs'), { batchId: id, batchName: b.name, birdType: b.birdType || 'quail', dateAdded: new Date().toISOString().split('T')[0], items: toAdd });
    await update(ref(db, `batches/${id}`), { status: 'completed', slaughterYield: yieldPairs, classifyData: toAdd });
    
    closeModal('modalClassify'); showToast("تم تصنيف الدفعة والترحيل للفريزر ❄️");
};

// ================= 6. المبيعات والمصروفات =================
window.saveDailyLog = async () => {
    const id = document.getElementById('dBatch')?.value;
    const dead = parseInt(document.getElementById('dDead')?.value) || 0;
    const feed = parseFloat(document.getElementById('dFeed')?.value) || 0;
    if(!id || (dead===0 && feed===0) || dead < 0 || feed < 0) return showToast("أدخل بيانات صحيحة", true);

    const b = allBatches[id]; 
    const today = new Date().toISOString().split('T')[0];
    
    const aliveBirds = (b.hatchedChicks || 0) - (b.totalDead || 0);

    if (dead > aliveBirds) {
        return showToast(`❌ خطأ: المتبقي بالعنبر (${aliveBirds} طائر) وأنت تحاول تسجيل (${dead}) نافق!`, true);
    }

    await push(ref(db, `batches/${id}/dailyLogs`), { date: today, dead, feed });

    if(feed > 0) {
        if(currentFeedStock < feed) return alert(`⚠️ الرصيد (${currentFeedStock} ك) لا يكفي!`);
        await set(ref(db, "inventory/feedStock"), currentFeedStock - feed);
        await push(ref(db, 'ledger'), { type: 'batch_cost', amount: feed * (globalSettings.feedPrice || 30), desc: `سحب علف (${feed}ك)`, batchId: id, date: today, timestamp: Date.now() });
    }
    await update(ref(db, `batches/${id}`), { totalDead: (b.totalDead||0) + dead, totalFeed: (b.totalFeed||0) + feed });
    closeModal('modalDaily'); showToast("تم تسجيل الاستهلاك");
};

window.calculateSaleTotal = () => {
    const grade = document.getElementById('sGrade')?.value;
    const qty = parseInt(document.getElementById('sQty')?.value) || 0;
    if(document.getElementById('saleTotalDisplay')) document.getElementById('saleTotalDisplay').innerText = (qty * (dynamicFreezerConfig[grade]?.price || 0)) + " ج.م";
};

window.processSale = async () => {
    const grade = document.getElementById('sGrade')?.value;
    const qty = parseInt(document.getElementById('sQty')?.value) || 0;
    if(!grade || !qty) return showToast("أدخل بيانات البيع", true);

    const amount = qty * (dynamicFreezerConfig[grade]?.price || 0);
    const snap = await get(ref(db, `inventory/freezerStock/${grade}`));
    const currentStock = snap.exists() ? snap.val() : 0;
    if(currentStock < qty) return showToast(`الرصيد لا يكفي! المتاح: ${currentStock}`, true);

    await set(ref(db, `inventory/freezerStock/${grade}`), currentStock - qty);
    await saveTransaction('in', amount, `مبيعات (${qty} جوز - ${dynamicFreezerConfig[grade].name})`);
    closeModal('modalSale'); showToast("تم البيع بنجاح");
};

window.saveTransaction = async (type, amountOverride = null, descOverride = null) => {
    const amount = amountOverride || parseFloat(document.getElementById('eAmount')?.value);
    const desc = descOverride || document.getElementById('eType')?.value;
    const batchId = (type === 'out') ? (document.getElementById('eBatch')?.value || 'general') : 'general';
    if(!amount) return showToast("أدخل المبلغ", true);

    await push(ref(db, 'ledger'), { type, amount, desc, batchId, date: new Date().toISOString().split('T')[0], timestamp: Date.now() });
    await set(ref(db, "cashBox"), manualCash + (type === 'in' ? amount : -amount));
    if(!amountOverride) { closeModal('modalExpense'); showToast("تم التسجيل"); }
};

window.deleteTransaction = async (id) => {
    if(confirm("حذف هذه المعاملة؟")) {
        const t = allTransactions[id];
        if (t.type === 'in') { await set(ref(db, "cashBox"), manualCash - t.amount); } 
        else if (t.type === 'out') { await set(ref(db, "cashBox"), manualCash + t.amount); } 
        else if (t.type === 'batch_cost') {
            const feedQty = t.amount / (globalSettings.feedPrice || 30);
            await set(ref(db, "inventory/feedStock"), currentFeedStock + feedQty);
        }
        await remove(ref(db, `ledger/${id}`)); 
        showToast("تم الحذف وتحديث الأرصدة بنجاح");
    }
};

window.resetSystem = async () => {
    if(confirm("🛑 سيتم مسح كل البيانات!")) {
        if(prompt("اكتب 'تأكيد':") === 'تأكيد') {
            await remove(ref(db, 'batches')); await remove(ref(db, 'ledger')); await remove(ref(db, 'inventory')); await remove(ref(db, 'cashBox')); showToast("تم التصفير");
        }
    }
};

// دالة تصفير الحسابات (أداة التجربة) تعمل بشكل ممتاز
window.resetFinancials = async () => {
    if(confirm("⚠️ هل أنت متأكد من تصفير دفتر الحسابات بالكامل؟\n(سيتم مسح الإيرادات والمصروفات وتصفير الخزنة)")) {
        if(prompt("اكتب 'تأكيد' لتنفيذ التصفير:") === 'تأكيد') {
            await remove(ref(db, 'ledger')); 
            await set(ref(db, 'cashBox'), 0); 
            showToast("تم تصفير الحسابات بنجاح 🧹");
        }
    }
};

// ================= 7. رندر الداشبورد والعنابر =================
onValue(ref(db, "batches"), (snapshot) => { 
    allBatches = snapshot.exists() ? snapshot.val() : {}; 
    renderBatches(); 
    if(document.getElementById('reportBatchSelect')?.value) window.generateBatchReport(); 
});

function formatDateTime(isoString) {
    if(!isoString) return '-';
    const date = new Date(isoString);
    const pad = n => n.toString().padStart(2, '0');
    return `${date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })} (${pad(date.getHours())}:${pad(date.getMinutes())})`;
}

function renderBatches() {
    const ui = { 
        inc: document.getElementById('incubatorList'), 
        rear: document.getElementById('rearingList'), 
        slaugh: document.getElementById('slaughterList'), 
        alerts: document.getElementById('alertsContainer'), 
        dSelect: document.getElementById('dBatch'), 
        eSelect: document.getElementById('eBatch'), 
        rSelect: document.getElementById('reportBatchSelect') 
    };
    
    if(!ui.inc) return;
    ui.inc.innerHTML = ''; ui.rear.innerHTML = ''; ui.slaugh.innerHTML = ''; ui.alerts.innerHTML = ''; 
    if(ui.dSelect) ui.dSelect.innerHTML = ''; 
    if(ui.eSelect) ui.eSelect.innerHTML = '<option value="general">مصروف عام</option>'; 
    if(ui.rSelect) ui.rSelect.innerHTML = '<option value="">-- اختر الدفعة --</option>';
    
    let stats = { eggs: 0, chicks: 0 }; const now = new Date();

    const formatTimeLeft = (hours) => {
        const absHours = Math.abs(hours);
        const d = Math.floor(absHours / 24);
        const h = Math.floor(absHours % 24);
        if (d > 0 && h > 0) return `${d} يوم و ${h} ساعة`;
        if (d > 0) return `${d} يوم`;
        return `${h} ساعة`;
    };

    if (currentFeedStock < 50 && ui.alerts) {
        ui.alerts.innerHTML += `<div style="color:var(--danger); font-weight:800; margin-bottom:12px; padding:10px; border:1px dashed var(--danger); border-radius:8px;"><i class="fas fa-triangle-exclamation"></i> تحذير عاجل: العلف بالمخزن أوشك على النفاذ (${currentFeedStock} كجم فقط)!</div>`;
    }

    let incGroups = { quail: '', chicken: '', turkey: '' };

    Object.keys(allBatches).sort((a,b) => (allBatches[b].order || 0) - (allBatches[a].order || 0)).forEach(id => {
        const b = allBatches[id]; const std = birdStandards[b.birdType || 'quail']; const bTypeName = std?.name || 'طائر'; const bIcon = std?.icon || '🐣';

        if(ui.rSelect) ui.rSelect.innerHTML += `<option value="${id}">${b.name} (${bTypeName})</option>`;
        if(b.status !== 'completed' && ui.eSelect) ui.eSelect.innerHTML += `<option value="${id}">${b.name}</option>`;

        let batchAlertHtml = '';
        const hoursToHatcher = (new Date(b.hatcherDate) - now) / 3600000;
        const hoursToHatch = (new Date(b.hatchDate) - now) / 3600000;
        const hoursToSlaughter = (new Date(b.rearDate) - now) / 3600000;

        if (b.status === 'incubator' || b.status === 'hatcher') {
            stats.eggs += b.initialEggs;
            const daysIn = (Math.floor((now - new Date(b.insertDate)) / 3600000) / 24).toFixed(1);
            let badge = '', actionBtn = '';
            
            if(b.status === 'incubator') {
                badge = `<span class="badge" style="background:var(--info);">حضانة</span>`;
                if (hoursToHatcher > 0 && hoursToHatcher <= 72) {
                    ui.alerts.innerHTML += `<div style="background: rgba(245, 158, 11, 0.1); border-right: 4px solid var(--warning); padding: 8px; margin-bottom: 8px; border-radius: 4px; color: var(--text-primary);">⏳ الدفعة <b>${b.name}</b> متبقي لها <b>${formatTimeLeft(hoursToHatcher)}</b> للنزول للمفقس.</div>`;
                } else if(hoursToHatcher <= 0 && hoursToHatcher > -24) { 
                    actionBtn = `<button class="btn btn-info" onclick="updateStage('${id}','hatcher')" style="margin-top:0; padding:8px;">نقل للمفقس 📥</button>`; 
                    ui.alerts.innerHTML += `<div style="color:var(--info); font-weight:bold; margin-bottom: 8px;">⚠️ الدفعة <b>${b.name}</b> جاهزة للنقل للمفقس الآن!</div>`; 
                    batchAlertHtml = `<div style="background: rgba(14, 165, 233, 0.1); color: var(--info); padding: 8px; border-radius: 8px; font-weight: bold; margin-bottom: 10px; font-size: 13px;">🔔 حان وقت النقل للمفقس!</div>`;
                } else if(hoursToHatcher <= -24) {
                    actionBtn = `<button class="btn btn-info" onclick="updateStage('${id}','hatcher')" style="margin-top:0; padding:8px;">نقل للمفقس 📥</button>`; 
                    ui.alerts.innerHTML += `<div style="background: rgba(220, 38, 38, 0.1); border-right: 4px solid var(--danger); padding: 8px; margin-bottom: 8px; border-radius: 4px; color: var(--danger); font-weight:bold;">🚨 تحذير خطير! الدفعة <b>${b.name}</b> تأخرت عن المفقس بمقدار <b>${formatTimeLeft(hoursToHatcher)}</b>!</div>`; 
                    batchAlertHtml = `<div style="background: rgba(220, 38, 38, 0.1); color: var(--danger); padding: 8px; border-radius: 8px; font-weight: bold; margin-bottom: 10px; font-size: 13px;">🚨 تأخير خطير في النقل!</div>`;
                }
            } else {
                badge = `<span class="badge" style="background:var(--primary);">مفقس</span>`;
                if (hoursToHatch > 0 && hoursToHatch <= 72) {
                    ui.alerts.innerHTML += `<div style="background: rgba(14, 165, 233, 0.1); border-right: 4px solid var(--info); padding: 8px; margin-bottom: 8px; border-radius: 4px; color: var(--text-primary);">🐣 الدفعة <b>${b.name}</b> متبقي لها <b>${formatTimeLeft(hoursToHatch)}</b> على الفقس.</div>`;
                } else if(hoursToHatch <= 0 && hoursToHatch > -24) { 
                    actionBtn = `<button class="btn btn-primary" onclick="promptHatch('${id}')" style="margin-top:0; padding:8px;">إتمام الفقس 🐣</button>`; 
                    ui.alerts.innerHTML += `<div style="color:var(--success); font-weight:bold; margin-bottom: 8px;">🐣 الدفعة <b>${b.name}</b> جاهزة للفقس الآن!</div>`; 
                    batchAlertHtml = `<div style="background: rgba(34, 197, 94, 0.1); color: var(--success); padding: 8px; border-radius: 8px; font-weight: bold; margin-bottom: 10px; font-size: 13px;">🔔 حان موعد الفقس!</div>`;
                } else if(hoursToHatch <= -24) {
                    actionBtn = `<button class="btn btn-primary" onclick="promptHatch('${id}')" style="margin-top:0; padding:8px;">إتمام الفقس 🐣</button>`; 
                    ui.alerts.innerHTML += `<div style="background: rgba(220, 38, 38, 0.1); border-right: 4px solid var(--danger); padding: 8px; margin-bottom: 8px; border-radius: 4px; color: var(--danger); font-weight:bold;">🚨 كارثة محتملة! الدفعة <b>${b.name}</b> تأخر فقسها <b>${formatTimeLeft(hoursToHatch)}</b>!</div>`; 
                    batchAlertHtml = `<div style="background: rgba(220, 38, 38, 0.1); color: var(--danger); padding: 8px; border-radius: 8px; font-weight: bold; margin-bottom: 10px; font-size: 13px;">🚨 تأخير خطير في الفقس!</div>`;
                }
            }

            const cardHTML = `
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
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <span>دخول الماكينة:</span> <strong style="color:var(--text-primary);">${formatDateTime(b.insertDate)}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <span>نزول المفقس:</span> <strong style="color:var(--info);">${formatDateTime(b.hatcherDate)}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <span>موعد الفقس للخروج:</span> <strong style="color:var(--success);">${formatDateTime(b.hatchDate)}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; padding-top:5px; border-top:1px solid var(--border);">
                        <span>موعد الذبح (المبرمج):</span> <strong style="color:var(--danger);">${formatDateTime(b.rearDate)}</strong>
                    </div>
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
                        <button onclick="openEditBatch('${id}')" title="تعديل" style="color: var(--info);">✏️</button>
                        <button onclick="deleteBatch('${id}')" title="حذف" style="color: var(--danger);">🗑️</button>
                    </div>
                    <div style="display:flex; gap:5px;">${actionBtn}</div>
                </div>
            </div>`;

            if(b.birdType === 'quail') incGroups.quail += cardHTML;
            else if(b.birdType === 'turkey') incGroups.turkey += cardHTML;
            else incGroups.chicken += cardHTML;

        } else if (b.status === 'rearing') {
            const alive = b.hatchedChicks - (b.totalDead||0); stats.chicks += alive; 
            const age = Math.floor((now - new Date(b.hatchDate)) / 86400000) || 1; 
            if(ui.dSelect) ui.dSelect.innerHTML += `<option value="${id}">${b.name} (عمر ${age} يوم)</option>`;
            
            if (hoursToSlaughter > 0 && hoursToSlaughter <= 72) {
                 ui.alerts.innerHTML += `<div style="background: rgba(239, 68, 68, 0.1); border-right: 4px solid var(--danger); padding: 8px; margin-bottom: 8px; border-radius: 4px; color: var(--text-primary);">🔪 الدفعة <b>${b.name}</b> متبقي لها <b>${formatTimeLeft(hoursToSlaughter)}</b> لتكون جاهزة للذبح.</div>`;
            } else if (hoursToSlaughter <= 0 && hoursToSlaughter > -48) {
                 ui.alerts.innerHTML += `<div style="color:var(--warning); font-weight:bold; margin-bottom:8px;">⏳ الدفعة <b>${b.name}</b> بلغت ${age} يوم (جاهزة للذبح).</div>`;
            } else if (hoursToSlaughter <= -48) {
                 ui.alerts.innerHTML += `<div style="background: rgba(220, 38, 38, 0.1); border-right: 4px solid var(--danger); padding: 8px; margin-bottom: 8px; border-radius: 4px; color: var(--danger); font-weight:bold;">🚨 استهلاك زائد! الدفعة <b>${b.name}</b> تخطت موعد الذبح بمقدار <b>${formatTimeLeft(hoursToSlaughter)}</b>!</div>`;
            }
            
            ui.rear.innerHTML += `<div class="batch-card stage-rearing">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div><span style="font-size:20px;">${bIcon}</span> <strong>${b.name}</strong></div> 
                <span class="badge" style="background:var(--warning);color:#000;">عمر ${age} يوم</span>
            </div>
            
            <div style="background: var(--bg-main); padding: 10px; border-radius: 8px; font-size: 13px; border: 1px dashed var(--border); margin-top: 10px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span>بداية التربية (الفقس):</span> <strong style="color:var(--text-primary);">${formatDateTime(b.hatchDate)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span>موعد الذبح المتوقع:</span> <strong style="color:var(--danger);">${formatDateTime(b.rearDate)}</strong>
                </div>
            </div>

            <div style="font-size:12px; color:var(--primary); margin-top:10px; font-weight:bold;">🐣 نسبة الفقس: ${b.hatchRate||0}%</div>
            <div class="grid-2" style="margin-top:10px; background:var(--bg-main); padding:10px; border-radius:8px; text-align:center;">
                <div>متبقي: <b style="font-size:18px;">${alive}</b></div>
                <div>استهلكت: <b style="font-size:18px;">${b.totalFeed||0} ك</b></div>
            </div>
            <div class="batch-actions" style="justify-content: space-between; border-top: 1px solid var(--border); padding-top: 10px; margin-top:10px;">
                <div style="display:flex; gap:8px;">
                    <button onclick="openEditBatch('${id}')" title="تعديل الاسم والتواريخ" style="background:none; border:none; color: #0ea5e9; font-size:18px;">✏️</button>
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
            </div></div>`;
        }
        else if (b.status === 'slaughter') { 
            ui.slaugh.innerHTML += `<div class="batch-card stage-slaughter">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:24px;">${bIcon}</span>
                    <div>
                        <strong style="font-size:18px; color:var(--text-primary); display:block;">${b.name}</strong>
                        <span style="font-size:12px; color:var(--text-secondary);">${bTypeName}</span>
                    </div>
                </div> 
                <span class="badge" style="background:var(--danger);">قيد الذبح والتجهيز</span>
            </div>
            
            <div style="margin: 15px 0; padding: 10px; background: var(--bg-main); border-radius: 8px; font-size: 13px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span>الحالة:</span> <strong style="color:var(--danger);">جاهزة للتصنيف والترحيل</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span>الإجمالي للذبح:</span> <strong>${(b.hatchedChicks - b.totalDead) || 0} طائر</strong>
                </div>
            </div>

            <div class="batch-actions" style="justify-content: space-between; border-top: 1px solid var(--border); padding-top: 10px; margin-top:10px;">
                <div style="display:flex; gap:5px;">
                    <button onclick="deleteBatch('${id}')" title="حذف" style="color: var(--danger); background:none; border:none; font-size:18px;">🗑️</button>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-warning" style="margin:0; padding:6px 12px; font-size:13px;" onclick="updateStage('${id}','rearing')"><i class="fas fa-undo"></i> تراجع ↩️</button>
                    <button class="btn btn-success" style="margin:0; padding:6px 12px; font-size:13px;" onclick="promptClassify('${id}')">تصنيف للترحيل ❄️</button>
                </div>
            </div></div>`; 
        }
    });
    
    if(incGroups.quail) ui.inc.innerHTML += `<div class="card-header" style="color:var(--info); font-size:16px; background:var(--bg-main); padding:8px 15px; border-radius:8px;"><i class="fas fa-dove"></i> قسم تفريخ السمان</div>` + incGroups.quail;
    if(incGroups.chicken) ui.inc.innerHTML += `<div class="card-header" style="color:var(--warning); font-size:16px; background:var(--bg-main); padding:8px 15px; border-radius:8px; margin-top:15px;"><i class="fas fa-kiwi-bird"></i> قسم تفريخ الدواجن</div>` + incGroups.chicken;
    if(incGroups.turkey) ui.inc.innerHTML += `<div class="card-header" style="color:var(--danger); font-size:16px; background:var(--bg-main); padding:8px 15px; border-radius:8px; margin-top:15px;"><i class="fas fa-turkey"></i> قسم تفريخ الرومي</div>` + incGroups.turkey;
    
    if(ui.inc.innerHTML === '') ui.inc.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary);">لا توجد دفعات في المفرخ حالياً.</div>';

    if(ui.alerts && ui.alerts.innerHTML === '') ui.alerts.innerHTML = '<div style="color:var(--success); font-weight:bold;">✅ المزرعة مستقرة. لا يوجد تنبيهات أو نواقص حالياً.</div>';
    
    if(document.getElementById('dashEggs')) document.getElementById('dashEggs').innerText = stats.eggs; 
    if(document.getElementById('dashChicks')) document.getElementById('dashChicks').innerText = stats.chicks;
}

// ================= 8. التقارير والماليات =================
onValue(ref(db, "ledger"), (snapshot) => {
    allTransactions = snapshot.exists() ? snapshot.val() : {}; 
    let tIn = 0, tOut = 0;
    
    Object.values(allTransactions).forEach(t => {
        if(t.type === 'in') tIn += t.amount; 
        else if(t.type === 'out') tOut += t.amount;
    });
    
    if(document.getElementById('totalRev')) document.getElementById('totalRev').innerText = tIn; 
    if(document.getElementById('totalExp')) document.getElementById('totalExp').innerText = tOut;
    if(document.getElementById('netProfit')) document.getElementById('netProfit').innerText = (tIn - tOut) + " ج.م"; 
    if(document.getElementById('dashSales')) document.getElementById('dashSales').innerText = tIn;
    
    if(document.getElementById('reportBatchSelect')?.value) window.generateBatchReport(); 
    updateCashDisplay();

    window.renderTransactionsList();
});

window.renderTransactionsList = () => {
    const lList = document.getElementById('ledgerList');
    if(!lList) return;

    let html = '';
    
    let txArray = Object.keys(allTransactions)
        .map(id => ({ id, ...allTransactions[id] }))
        .sort((a,b) => b.timestamp - a.timestamp);

    if (currentLedgerSearch.trim() !== '') {
        txArray = txArray.filter(t => t.desc.toLowerCase().includes(currentLedgerSearch.toLowerCase()));
    }

    if (currentLedgerFilter !== 'all') {
        txArray = txArray.filter(t => t.type === currentLedgerFilter);
    }

    const limit = 50;
    const totalFound = txArray.length;
    txArray = txArray.slice(0, limit);

    txArray.forEach(t => {
        let typeColor = t.type === 'in' ? 'var(--success)' : (t.type === 'out' ? 'var(--danger)' : 'var(--warning)');
        let sign = t.type === 'in' ? '+' : '-';
        let descLabel = t.type === 'batch_cost' ? '(سحب عيني)' : '';
        
        html += `<div class="transaction-item" style="border-right: 4px solid ${typeColor}; padding-right: 10px;">
            <div>
                <b>${t.desc} <span style="font-size:11px; color:var(--warning);">${descLabel}</span></b> 
                <button onclick="deleteTransaction('${t.id}')" style="background:none; border:none; color:var(--danger); cursor:pointer; margin-right:8px;" title="حذف">🗑️</button><br>
                <span style="font-size:12px;color:var(--text-secondary);">${t.date}</span>
            </div>
            <div style="font-weight:900; color:${typeColor}" dir="ltr">${sign} ${t.amount} ج</div>
        </div>`;
    });
    
    if (totalFound > limit) {
        html += `<div style="text-align:center; padding: 12px; color: var(--text-secondary); font-size: 13px; background: var(--bg-main); border-radius: 8px; margin-top: 10px;">
            💡 يتم عرض أحدث 50 حركة من أصل ${totalFound}. استخدم البحث أو التصفية للوصول للحركات الأقدم.
        </div>`;
    }

    lList.innerHTML = html || '<div style="text-align:center;padding:20px;color:var(--text-secondary);">لا توجد سجلات مطابقة للبحث</div>';
};

window.filterLedger = (type) => { currentLedgerFilter = type; window.renderTransactionsList(); };
window.searchLedger = (query) => { currentLedgerSearch = query; window.renderTransactionsList(); };

window.generateBatchReport = () => {
    const id = document.getElementById('reportBatchSelect')?.value;
    const container = document.getElementById('batchReportContainer');
    if(!id || !container) { if(container) container.style.display = 'none'; return; }
    
    const b = allBatches[id]; let batchCost = 0; 
    Object.values(allTransactions).forEach(t => { if(t.batchId === id && (t.type === 'out' || t.type === 'batch_cost')) batchCost += t.amount; });
    const dead = b.totalDead || 0;
    
    if(b.status === 'completed' && b.classifyData) {
        const yieldTotal = b.slaughterYield || 0; let potentialRevenue = 0; let outputHtml = '';
        Object.keys(b.classifyData).forEach(g => { if(b.classifyData[g] > 0) { potentialRevenue += (b.classifyData[g] * (dynamicFreezerConfig[g]?.price || 0)); outputHtml += `<span class="badge" style="background:var(--primary); margin:2px;">${dynamicFreezerConfig[g]?.name || g}: ${b.classifyData[g]}</span>`; } });
        
        const costPerPair = yieldTotal > 0 ? (batchCost / yieldTotal).toFixed(2) : 0; 
        const netProfit = potentialRevenue - batchCost;
        const totalFeedKg = b.totalFeed || 0; 
        const feedPerBirdGrams = yieldTotal > 0 ? ((totalFeedKg * 1000) / (yieldTotal * 2)).toFixed(0) : 0; 
        let fcrStatus = '';

        if(b.birdType === 'quail' || !b.birdType) { if(feedPerBirdGrams < 450) fcrStatus = '<span style="color:var(--success);">ممتاز 🌟</span>'; else if(feedPerBirdGrams <= 550) fcrStatus = '<span style="color:var(--warning);">متوسط ⚠️</span>'; else fcrStatus = '<span style="color:var(--danger);">ضعيف ❌</span>'; } else { fcrStatus = '<span style="color:var(--info);">تم الحساب</span>'; }

        let stampHtml = netProfit > 0 ? `<div class="result-stamp" style="color:var(--success); border-color:var(--success);">✅ مكسب: +${netProfit} ج.م</div>` : (netProfit < 0 ? `<div class="result-stamp" style="color:var(--danger); border-color:var(--danger);">❌ خسارة: ${netProfit} ج.م</div>` : `<div class="result-stamp" style="color:var(--warning); border-color:var(--warning);">➖ تعادل</div>`);

        container.innerHTML = `<div style="background:var(--bg-main); padding:15px; border-radius:10px; border: 1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:15px;">
                <h3 style="margin:0; color:var(--text-primary);">بيان ختامي - ${b.name}</h3>
                <button onclick="deleteBatch('${id}')" title="حذف الدفعة نهائياً" style="background:var(--danger); color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; display:flex; align-items:center; gap:5px;">
                    <i class="fas fa-trash"></i> حذف
                </button>
            </div>
            <div class="grid-2" style="font-size:14px; line-height:2;"><div>🥚 بيض: <b>${b.initialEggs}</b></div><div>🐣 فقس: <b class="text-success">${b.hatchRate||0}%</b></div><div>☠️ نافق: <b class="text-danger">${dead}</b></div><div>🌾 علف: <b>${totalFeedKg} كجم</b></div></div><div style="margin-top:15px; padding:10px; background:var(--surface); border-radius:8px; text-align:center; border:1px solid var(--border);"><span style="font-size:13px; color:var(--text-secondary);">مؤشر الاستهلاك (FCR):</span><br><b style="font-size:22px; color:var(--primary);">${feedPerBirdGrams} جرام/طائر</b> <br><span style="font-size:13px; font-weight:bold;">التقييم التقني: ${fcrStatus}</span></div><hr style="border:1px dashed var(--border); margin:15px 0;"><div style="margin-bottom:15px;"><b>مخرجات الدفعة (الفريزر):</b><br>${outputHtml}</div><div class="grid-2" style="background:var(--surface); padding:10px; border-radius:8px; border:1px solid var(--border);"><div>التكلفة الإجمالية:<br><b class="text-danger" style="font-size:18px;">${batchCost} ج</b></div><div>البيع المتوقع:<br><b class="text-success" style="font-size:18px;">${potentialRevenue} ج</b></div></div><div style="text-align:center; margin-top:15px; background:var(--surface); border:1px solid var(--primary); padding:10px; border-radius:8px;"><span style="font-size:14px;">تكلفة إنتاج <b style="color:var(--warning);">الجوز الواحد</b>: <b style="font-size:18px; color:var(--primary);">${costPerPair} ج.م</b></span></div>${stampHtml}</div>`;
    } else { 
        container.innerHTML = `
        <div style="padding:20px; text-align:center; border: 1px dashed var(--danger); border-radius: 8px; background: rgba(239, 68, 68, 0.05);">
            <div style="color:var(--danger); font-weight:bold; margin-bottom: 15px; font-size:16px;">الدفعة لم تكتمل للبيان الختامي، أو أنها دفعة تجريبية.</div>
            <button onclick="deleteBatch('${id}')" style="background:var(--danger); color:white; border:none; border-radius:6px; padding:8px 20px; font-size:14px; cursor:pointer;">
                <i class="fas fa-trash"></i> مسح الدفعة نهائياً
            </button>
        </div>`; 
    }
    container.style.display = 'block';
};

// ================= 9. المساعد الذكي للتربية (دليل العامل) =================
function getQuailDailyNeeds(age, aliveCount, system) {
    let temp = 35, feedPerBird = 5, meds = "ماء نقي خالي من الإضافات";
    if (age <= 3) { temp = 37; feedPerBird = 4; meds = "مضاد حيوي معوي وتنفسي + فيتامينات (AD3E)"; }
    else if (age <= 7) { temp = 35; feedPerBird = 6; meds = "أملاح معدنية وأحماض أمينية"; }
    else if (age <= 10) { temp = 33; feedPerBird = 8; if(age === 10) meds = "تحصين نيوكاسل (تغطيس أو شرب)"; }
    else if (age <= 14) { temp = 31; feedPerBird = 11; if(age >= 13) meds = "جرعة وقاية: كوكسيديا وكلوستريديا"; }
    else if (age <= 21) { temp = 28; feedPerBird = 15; meds = "فيتامينات (هـ سيلينيوم) لرفع المناعة"; }
    else if (age <= 28) { temp = 25; feedPerBird = 20; meds = "ماء نقي"; }
    else if (age <= 35) { temp = 24; feedPerBird = 24; meds = "ماء نقي (فترة سحب الدواء)"; }
    else { temp = 24; feedPerBird = 28; meds = "ماء نقي - جاهزة للذبح"; }

    let totalFeedKg = (feedPerBird * aliveCount) / 1000;
    let totalWaterLiters = (totalFeedKg * 2.2); 
    let spaceRequired = system === 'battery' ? (aliveCount / 120) : (aliveCount / 60);

    return { temp, feed: totalFeedKg.toFixed(2), water: totalWaterLiters.toFixed(1), space: spaceRequired.toFixed(1), meds };
}

window.openDailyGuide = (id) => {
    const b = allBatches[id];
    if(b.birdType !== 'quail') return showToast("هذا الدليل مبرمج للسمان فقط حالياً!", true);

    const now = new Date();
    const age = Math.floor((now - new Date(b.hatchDate)) / 86400000) || 1; 
    const alive = b.hatchedChicks - (b.totalDead || 0);
    const system = b.rearingSystem || 'floor';

    const needs = getQuailDailyNeeds(age, alive, system);

    document.getElementById('dailyGuideContent').innerHTML = `
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
                <div style="font-size:12px; color:var(--text-secondary);">🌾 العلف لليوم بالكامل (${alive} طائر)</div>
                <div style="font-size:20px; font-weight:bold; color:var(--warning);">${needs.feed} كجم</div>
            </div>
            <div style="background:var(--surface); padding:10px; border-radius:8px; margin-top:10px; border-right:4px solid var(--primary);">
                <div style="font-size:12px; color:var(--text-secondary);">💊 التحصينات اليوم</div>
                <div style="font-size:15px; font-weight:bold; color:var(--primary);">${needs.meds}</div>
            </div>
            <div style="background:var(--surface); padding:10px; border-radius:8px; margin-top:10px; border-right:4px solid var(--success);">
                <div style="font-size:12px; color:var(--text-secondary);">📏 المساحة ونوع التربية</div>
                <div style="font-size:14px; font-weight:bold; color:var(--text-primary);">
                    نظام: ${system === 'floor' ? 'أرضي' : 'بطاريات'} <br>
                    مساحة العنبر: <span style="color:var(--success); font-size:16px;">${needs.space} متر مربع</span>
                </div>
            </div>
        </div>`;
    openModal('modalDailyGuide');
};

// ================= 10. نظام الإنتاجية (Ctrl+K) =================
const sysCmds = [
    { title: 'الانتقال إلى: لوحة القيادة', icon: 'fas fa-chart-pie', action: () => switchPage('dashboard') },
    { title: 'الانتقال إلى: المفرخ', icon: 'fas fa-egg', action: () => switchPage('incubator') },
    { title: 'الانتقال إلى: التربية', icon: 'fas fa-warehouse', action: () => switchPage('rearing') },
    { title: 'الانتقال إلى: الفريزر', icon: 'fas fa-snowflake', action: () => switchPage('freezer') },
    { title: 'الانتقال إلى: الحسابات', icon: 'fas fa-wallet', action: () => switchPage('finance') },
    { title: 'إضافة دفعة 🐣', icon: 'fas fa-plus', action: () => openModal('modalBatch') },
    { title: 'شراء علف 🌾', icon: 'fas fa-truck', action: () => openModal('modalBuyFeed') },
    { title: 'تسجيل مبيعات 💰', icon: 'fas fa-shopping-cart', action: () => openModal('modalSale') }
];
window.openCommandPalette = () => { const cp = document.getElementById('commandPalette'); if(!cp) return; cp.classList.add('active'); setTimeout(() => document.getElementById('cmdInput')?.focus(), 100); renderCmdResults(''); };
window.closeCommandPalette = () => { const cp = document.getElementById('commandPalette'); if(cp) cp.classList.remove('active'); const inp = document.getElementById('cmdInput'); if(inp) inp.value = ''; };

const renderCmdResults = (query) => {
    const c = document.getElementById('cmdResults'); if(!c) return; c.innerHTML = '';
    const f = sysCmds.filter(cmd => cmd.title.toLowerCase().includes(query.toLowerCase()));
    if(f.length === 0) return c.innerHTML = `<div style="padding:15px; text-align:center;">لا توجد أوامر</div>`;
    f.forEach(cmd => {
        const el = document.createElement('div');
        el.innerHTML = `<i class="${cmd.icon}" style="color:var(--primary); width:20px;"></i> <b>${cmd.title}</b>`;
        el.style.cssText = `padding:12px; cursor:pointer; border-radius:8px; display:flex; align-items:center; gap:10px; transition:0.2s;`;
        el.onmouseover = () => el.style.background = 'rgba(37,99,235,0.1)'; el.onmouseout = () => el.style.background = 'transparent';
        el.onclick = () => { closeCommandPalette(); cmd.action(); };
        c.appendChild(el);
    });
};

document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCommandPalette(); } if (e.key === 'Escape') closeCommandPalette(); });
document.addEventListener('click', (e) => { if (e.target === document.getElementById('commandPalette')) closeCommandPalette(); });
document.getElementById('cmdInput')?.addEventListener('input', (e) => renderCmdResults(e.target.value));
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
}
