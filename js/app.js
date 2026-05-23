import { db, ref, set, get, push, update, remove, onValue } from './firebase.js';
import { switchPage, openModal, closeModal, showToast, toggleFab } from './ui.js';

// ================= المتغيرات وحالة النظام =================
let allBatches = {};
let allTransactions = {};
let allFreezerLogs = {};

const birdStandards = {
    quail: { name: 'سمان', hatcher: 15, hatch: 18, slaughter: 35 },
    chicken: { name: 'فراخ بيضاء', hatcher: 18, hatch: 21, slaughter: 40 },
    turkey: { name: 'رومي', hatcher: 25, hatch: 28, slaughter: 90 }
};

let globalSettings = { birdType: 'quail', feedPrice: 30, royal: 120, super_special: 110, special: 100, jumbo: 90, super: 80, bad: 0 };
const gradeNames = { royal: 'رويال', super_special: 'سوبر سبشيال', special: 'سبشيال', jumbo: 'جامبو', super: 'سوبر', bad: 'كسر/فرز' };

// ================= ربط دوال الواجهة بالـ Window =================
window.switchPage = (pageId) => switchPage(pageId, event.currentTarget);
window.openModal = (id) => {
    if(id === 'modalBatch') document.getElementById('bBirdType').value = globalSettings.birdType || 'quail';
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
        bad: 0
    };
    await set(ref(db, 'settings'), newSet);
    showToast("تم تحديث الإعدادات والأسعار");
};

// ================= العمليات الحسابية والأساسية =================
window.calculateSaleTotal = () => {
    const grade = document.getElementById('sGrade').value;
    const qty = parseInt(document.getElementById('sQty').value) || 0;
    const price = globalSettings[grade] || 0;
    document.getElementById('saleTotalDisplay').innerText = (qty * price) + " ج.م";
};

window.saveNewBatch = async () => {
    const name = document.getElementById('bName').value;
    const eggs = parseInt(document.getElementById('bEggs').value);
    const dateStr = document.getElementById('bDate').value;
    const bType = document.getElementById('bBirdType').value;
    
    if(!name || !eggs) return showToast("أكمل البيانات", true);

    const std = birdStandards[bType];
    const insertD = new Date(dateStr);
    
    const hatcherD = new Date(insertD); hatcherD.setDate(insertD.getDate() + std.hatcher);
    const hatchD = new Date(insertD); hatchD.setDate(insertD.getDate() + std.hatch);
    const rearD = new Date(hatchD); rearD.setDate(hatchD.getDate() + std.slaughter);

    await push(ref(db, 'batches'), { 
        name, birdType: bType, insertDate: dateStr, hatcherDate: hatcherD.toISOString().split('T')[0], hatchDate: hatchD.toISOString().split('T')[0], rearDate: rearD.toISOString().split('T')[0], initialEggs: eggs, status: 'incubator', totalDead: 0, totalFeed: 0 
    });
    
    document.getElementById('bName').value = '';
    document.getElementById('bEggs').value = '';
    closeModal('modalBatch');
    showToast(`تم بدء دورة (${std.name})`);
};

window.saveDailyLog = async () => {
    const id = document.getElementById('dBatch').value;
    const dead = parseInt(document.getElementById('dDead').value) || 0;
    const feed = parseFloat(document.getElementById('dFeed').value) || 0;
    if(!id || (dead===0 && feed===0)) return showToast("أدخل بيانات صحيحة", true);

    const b = allBatches[id];
    const today = new Date().toISOString().split('T')[0];

    await push(ref(db, `batches/${id}/dailyLogs`), { date: today, dead, feed });

    if(feed > 0) {
        const cost = feed * (globalSettings.feedPrice || 30);
        await push(ref(db, 'ledger'), { type: 'out', amount: cost, desc: `علف تلقائي (${feed}ك) - ${b.name}`, batchId: id, date: today, timestamp: Date.now() });
    }

    await update(ref(db, `batches/${id}`), { totalDead: (b.totalDead||0) + dead, totalFeed: (b.totalFeed||0) + feed });
    document.getElementById('dDead').value = 0;
    document.getElementById('dFeed').value = 0;
    closeModal('modalDaily');
    showToast("تم حفظ السجل");
};

window.saveTransaction = async (type, amountOverride = null, descOverride = null) => {
    const amount = amountOverride || parseFloat(document.getElementById('eAmount').value);
    const desc = descOverride || document.getElementById('eType').value;
    const batchId = type === 'out' ? document.getElementById('eBatch').value : 'general';
    if(!amount) return showToast("أدخل المبلغ", true);

    await push(ref(db, 'ledger'), { type, amount, desc, batchId, date: new Date().toISOString().split('T')[0], timestamp: Date.now() });
    
    if(!amountOverride) {
        document.getElementById('eAmount').value = '';
        document.getElementById('eType').value = '';
        closeModal('modalExpense');
        showToast("تم التسجيل بالدفتر");
    }
};

window.processSale = async () => {
    const grade = document.getElementById('sGrade').value;
    const qty = parseInt(document.getElementById('sQty').value) || 0;
    const price = globalSettings[grade] || 0;
    const amount = qty * price;

    if(!qty) return showToast("أدخل العدد", true);

    const snap = await get(ref(db, `inventory/freezer/${grade}`));
    const currentStock = snap.exists() ? snap.val() : 0;
    if(currentStock < qty) return showToast(`لا يوجد رصيد! المتاح: ${currentStock}`, true);

    await set(ref(db, `inventory/freezer/${grade}`), currentStock - qty);
    await saveTransaction('in', amount, `مبيعات (${qty} جوز - ${gradeNames[grade]})`);
    
    document.getElementById('sQty').value = '';
    document.getElementById('saleTotalDisplay').innerText = "0 ج.م";
    closeModal('modalSale');
    showToast("تم البيع بنجاح");
};

// ================= أزرار الإجراءات (تعديل وحذف) =================
window.renameBatch = async (id) => {
    const currentName = allBatches[id].name;
    const newName = prompt("أدخل الاسم الجديد للدفعة:", currentName);
    
    if (newName && newName.trim() !== "" && newName !== currentName) {
        await update(ref(db, `batches/${id}`), { name: newName.trim() });
        showToast("تم تغيير اسم الدفعة بنجاح");
    }
};

window.deleteBatch = async (id) => {
    if(confirm("⚠️ هل أنت متأكد من حذف هذه الدفعة نهائياً؟")) {
        await remove(ref(db, `batches/${id}`));
        showToast("تم حذف الدفعة");
    }
};

window.resetSystem = async () => {
    if(confirm("🛑 تحذير خطير: سيتم مسح كل البيانات!")) {
        let p = prompt("اكتب كلمة 'تأكيد' لمسح البيانات:");
        if(p === 'تأكيد') {
            await remove(ref(db, 'batches')); await remove(ref(db, 'ledger')); await remove(ref(db, 'inventory'));
            showToast("تم تصفير النظام بالكامل");
        }
    }
};

window.updateStage = async (id, stage) => { await update(ref(db, `batches/${id}`), { status: stage }); };
window.promptHatch = (id) => { document.getElementById('hatchBatchId').value = id; openModal('modalHatch'); };
window.moveToRearing = async () => {
    const id = document.getElementById('hatchBatchId').value;
    const healthy = parseInt(document.getElementById('hHealthy').value);
    const batch = allBatches[id];
    
    if(!healthy) return showToast("أدخل العدد", true);
    
    const unfert = parseInt(document.getElementById('hUnfert').value)||0;
    const deadShell = parseInt(document.getElementById('hDead').value)||0;
    const hatchRate = ((healthy / batch.initialEggs) * 100).toFixed(1);

    await update(ref(db, `batches/${id}`), { status: 'rearing', hatchedChicks: healthy, hatchRate: hatchRate, unfertilized: unfert, deadInShell: deadShell });
    closeModal('modalHatch'); showToast(`تم النقل للتربية. نسبة الفقس: ${hatchRate}%`);
};

window.promptClassify = (id) => { document.getElementById('classBatchId').value = id; openModal('modalClassify'); };
window.finishSlaughter = async () => {
    const id = document.getElementById('classBatchId').value;
    const batch = allBatches[id];
    let yieldTotal = 0; const toAdd = {};
    
    Object.keys(gradeNames).forEach(g => {
        const val = parseInt(document.getElementById(`c_${g}`).value) || 0;
        toAdd[g] = val; if(g !== 'bad') yieldTotal += val;
    });
    if(yieldTotal === 0 && toAdd['bad'] === 0) return showToast("أدخل ناتج التصنيف", true);

    const snap = await get(ref(db, "inventory/freezer"));
    let currentF = snap.exists() ? snap.val() : {};
    Object.keys(toAdd).forEach(g => currentF[g] = (currentF[g]||0) + toAdd[g]);
    await set(ref(db, "inventory/freezer"), currentF);

    const today = new Date().toISOString().split('T')[0];
    await push(ref(db, 'inventory/freezerLogs'), { batchId: id, batchName: batch.name, birdType: batch.birdType || 'quail', dateAdded: today, items: toAdd });

    await update(ref(db, `batches/${id}`), { status: 'completed', slaughterYield: yieldTotal, classifyData: toAdd });
    closeModal('modalClassify'); showToast("اكتملت الدفعة");
};

// ================= عرض البيانات (Realtime) =================
onValue(ref(db, "batches"), (snapshot) => {
    allBatches = snapshot.exists() ? snapshot.val() : {};
    renderBatches();
    if(document.getElementById('reportBatchSelect').value) window.generateBatchReport();
});

function renderBatches() {
    const ui = { inc: document.getElementById('incubatorList'), rear: document.getElementById('rearingList'), slaugh: document.getElementById('slaughterList'), alerts: document.getElementById('alertsContainer'), dSelect: document.getElementById('dBatch'), eSelect: document.getElementById('eBatch'), rSelect: document.getElementById('reportBatchSelect') };
    ui.inc.innerHTML = ''; ui.rear.innerHTML = ''; ui.slaugh.innerHTML = ''; ui.alerts.innerHTML = ''; ui.dSelect.innerHTML = ''; ui.eSelect.innerHTML = '<option value="general">مصروف عام</option>'; ui.rSelect.innerHTML = '<option value="">-- اختر الدفعة للتقرير --</option>';
    
    let stats = { eggs: 0, chicks: 0 }; const now = new Date();

    Object.keys(allBatches).forEach(id => {
        const b = allBatches[id];
        const bTypeName = birdStandards[b.birdType || 'quail']?.name || 'طائر';
        
        ui.rSelect.innerHTML += `<option value="${id}">${b.name} (${bTypeName})</option>`;
        if(b.status !== 'completed') ui.eSelect.innerHTML += `<option value="${id}">${b.name}</option>`;

        const datesHtml = `<div class="dates-row"><span>📅 بيض: ${b.insertDate}</span><span>🥚 مفقس: ${b.hatcherDate||'-'}</span><span>🐣 فقس: ${b.hatchDate||'-'}</span><span>🐥 ذبح: ${b.rearDate||'-'}</span></div>`;
        
        // الأزرار المحدثة (تعديل + حذف)
        const actionsHtml = `<div class="batch-actions">
            <button onclick="renameBatch('${id}')" title="تعديل اسم الدفعة" style="color: var(--info);">✏️</button>
            <button onclick="deleteBatch('${id}')" title="حذف الدفعة" style="color: var(--danger);">🗑️</button>
        </div>`;

        if (b.status === 'incubator' || b.status === 'hatcher') {
            stats.eggs += b.initialEggs;
            const daysIn = Math.floor((now - new Date(b.insertDate)) / 86400000);
            let badge = '', actionBtn = '';
            const bStd = birdStandards[b.birdType || 'quail'];
            
            if(b.status === 'incubator') {
                badge = `<span class="badge" style="background:var(--info);">حضانة (${bTypeName})</span>`;
                if(daysIn >= bStd.hatcher) { actionBtn = `<button class="btn btn-info" onclick="updateStage('${id}','hatcher')">نقل للمفقس</button>`; ui.alerts.innerHTML += `<div>⚠️ الدفعة <b>${b.name}</b> جاهزة للمفقس.</div>`; }
            } else {
                badge = `<span class="badge" style="background:var(--purple);">مفقس (${bTypeName})</span>`;
                if(daysIn >= bStd.hatch) { actionBtn = `<button class="btn btn-primary" onclick="promptHatch('${id}')">إتمام الفقس</button>`; ui.alerts.innerHTML += `<div>🐣 الدفعة <b>${b.name}</b> موعد فقسها اليوم!</div>`; }
            }

            ui.inc.innerHTML += `<div class="batch-card stage-${b.status}"><div style="display:flex; justify-content:space-between; align-items:center;"><strong>${b.name}</strong> ${badge}</div>${datesHtml}<div style="margin-top:10px; font-weight:bold;">البيض: ${b.initialEggs}</div>${actionBtn} ${actionsHtml}</div>`;
        }
        else if (b.status === 'rearing') {
            const alive = b.hatchedChicks - (b.totalDead||0); stats.chicks += alive;
            const age = Math.floor((now - new Date(b.hatchDate)) / 86400000);
            const bStd = birdStandards[b.birdType || 'quail'];

            ui.dSelect.innerHTML += `<option value="${id}">${b.name} (عمر ${age} يوم)</option>`;
            if(age >= bStd.slaughter) ui.alerts.innerHTML += `<div>⏳ الدفعة <b>${b.name}</b> بلغت ${age} يوم (جاهزة للذبح).</div>`;

            ui.rear.innerHTML += `<div class="batch-card stage-rearing"><div style="display:flex; justify-content:space-between;"><strong>${b.name}</strong> <span class="badge" style="background:var(--warning);color:#000;">عمر ${age} يوم</span></div>${datesHtml}<div style="font-size:12px; color:var(--primary); margin-top:5px; font-weight:bold;">🐣 نسبة الفقس: ${b.hatchRate||0}%</div><div class="grid-2" style="margin-top:10px; background:var(--bg); padding:10px; border-radius:8px; text-align:center;"><div>متبقي: <b>${alive}</b></div><div>علف: <b>${b.totalFeed||0} ك</b></div></div><button class="btn btn-danger" onclick="updateStage('${id}','slaughter')">نقل لغرفة الذبح</button>${actionsHtml}</div>`;
        }
        else if (b.status === 'slaughter') {
            ui.slaugh.innerHTML += `<div class="batch-card stage-slaughter"><div style="display:flex; justify-content:space-between;"><strong>${b.name}</strong> <span class="badge" style="background:var(--danger);">قيد الذبح</span></div><button class="btn btn-success" onclick="promptClassify('${id}')">تصنيف وترحيل للفريزر</button>${actionsHtml}</div>`;
        }
    });
    if(ui.alerts.innerHTML === '') ui.alerts.innerHTML = '<div class="text-success" style="font-weight:bold;">✅ لا يوجد تنبيهات.</div>';
    document.getElementById('dashEggs').innerText = stats.eggs; document.getElementById('dashChicks').innerText = stats.chicks;
}

onValue(ref(db, "inventory/freezer"), (snapshot) => {
    const data = snapshot.exists() ? snapshot.val() : {};
    let total = 0; let html = '';
    Object.keys(gradeNames).forEach(g => {
        if(g === 'bad') return;
        const count = data[g] || 0; total += count;
        html += `<div style="background:var(--bg); padding:15px; border-radius:10px; text-align:center; border:1px solid var(--border);"><span style="font-size:13px; color:var(--text-muted); font-weight:bold;">${gradeNames[g]}</span><div style="font-size:22px; font-weight:900; color:var(--primary); margin-top:5px;">${count}</div></div>`;
    });
    document.getElementById('freezerGrid').innerHTML = html; document.getElementById('dashFreezer').innerText = total;
});

onValue(ref(db, "inventory/freezerLogs"), (snapshot) => {
    allFreezerLogs = snapshot.exists() ? snapshot.val() : {};
    let html = ''; const now = new Date();
    Object.keys(allFreezerLogs).sort((a,b)=> new Date(allFreezerLogs[b].dateAdded) - new Date(allFreezerLogs[a].dateAdded)).forEach(key => {
        const log = allFreezerLogs[key];
        const daysOld = Math.floor((now - new Date(log.dateAdded)) / 86400000);
        let ageTag = daysOld <= 7 ? '<span class="freezer-tag-new">جديد</span>' : (daysOld > 30 ? '<span class="freezer-tag-old">قديم</span>' : `<span style="font-size:11px;color:#777;">منذ ${daysOld} يوم</span>`);
        let itemsStr = Object.keys(log.items).filter(k => log.items[k]>0).map(k => `${gradeNames[k]}: ${log.items[k]}`).join(' | ');
        html += `<div class="freezer-log"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong>${log.batchName}</strong>${ageTag}</div><div style="color:var(--text-muted); font-size:12px; margin-bottom:5px;">تاريخ التخزين: ${log.dateAdded}</div><div style="font-weight:bold; color:var(--primary);">${itemsStr}</div></div>`;
    });
    document.getElementById('freezerLogs').innerHTML = html || '<div style="text-align:center; padding:10px;">لا توجد سجلات تخزين</div>';
});

onValue(ref(db, "ledger"), (snapshot) => {
    allTransactions = snapshot.exists() ? snapshot.val() : {};
    let tIn = 0, tOut = 0, html = '';
    Object.keys(allTransactions).sort((a,b)=>allTransactions[b].timestamp-allTransactions[a].timestamp).forEach(id => {
        const t = allTransactions[id];
        if(t.type === 'in') tIn += t.amount; else tOut += t.amount;
        html += `<div class="transaction-item"><div><b>${t.desc}</b><br><span style="font-size:12px;color:#777;">${t.date}</span></div><div style="font-weight:900; color:${t.type==='in'?'var(--success)':'var(--danger)'}" dir="ltr">${t.type==='in'?'+':'-'} ${t.amount}</div></div>`;
    });
    document.getElementById('totalRev').innerText = tIn; document.getElementById('totalExp').innerText = tOut;
    document.getElementById('netProfit').innerText = (tIn - tOut) + " ج.م"; document.getElementById('dashSales').innerText = tIn;
    document.getElementById('ledgerList').innerHTML = html || '<div style="text-align:center;padding:20px;">لا يوجد سجلات</div>';
    if(document.getElementById('reportBatchSelect').value) window.generateBatchReport();
});

window.generateBatchReport = () => {
    const id = document.getElementById('reportBatchSelect').value;
    const container = document.getElementById('batchReportContainer');
    if(!id) { container.style.display = 'none'; return; }
    
    const b = allBatches[id]; let batchCost = 0; 
    Object.values(allTransactions).forEach(t => { if(t.batchId === id && t.type === 'out') batchCost += t.amount; });
    const hatched = b.hatchedChicks || 0; const dead = b.totalDead || 0;
    
    if(b.status === 'completed' && b.classifyData) {
        const yieldTotal = b.slaughterYield || 0;
        let potentialRevenue = 0; let outputHtml = '';
        Object.keys(b.classifyData).forEach(g => {
            if(b.classifyData[g] > 0) {
                potentialRevenue += (b.classifyData[g] * (globalSettings[g]||0));
                outputHtml += `<span class="badge" style="background:var(--primary); margin:2px;">${gradeNames[g]}: ${b.classifyData[g]}</span>`;
            }
        });
        
        const costPerPair = yieldTotal > 0 ? ((batchCost / yieldTotal) * 2).toFixed(2) : 0;
        const netProfit = potentialRevenue - batchCost;
        
        const totalFeedKg = b.totalFeed || 0;
        const feedPerBirdGrams = yieldTotal > 0 ? ((totalFeedKg * 1000) / yieldTotal).toFixed(0) : 0;
        let fcrStatus = '';
        if(b.birdType === 'quail' || !b.birdType) {
            if(feedPerBirdGrams < 450) fcrStatus = '<span style="color:var(--success);">ممتاز 🌟</span>';
            else if(feedPerBirdGrams <= 550) fcrStatus = '<span style="color:var(--warning);">متوسط ⚠️</span>';
            else fcrStatus = '<span style="color:var(--danger);">ضعيف ❌</span>';
        } else { fcrStatus = '<span style="color:var(--info);">تم الحساب</span>'; }

        let stampHtml = netProfit > 0 ? `<div class="result-stamp text-success" style="border-color:var(--success);">✅ حققت مكسب: +${netProfit} ج.م</div>` : (netProfit < 0 ? `<div class="result-stamp text-danger" style="border-color:var(--danger);">❌ حققت خسارة: ${netProfit} ج.م</div>` : `<div class="result-stamp text-warning" style="border-color:var(--warning);">➖ تعادل</div>`);

        container.innerHTML = `<div style="background:var(--bg); padding:15px; border-radius:10px; border: 2px solid var(--border);"><div style="text-align:center; border-bottom:1px solid #ccc; padding-bottom:10px; margin-bottom:15px;"><h3 style="margin:0; color:var(--primary);">بيان ختامي - ${b.name}</h3></div><div class="grid-2" style="font-size:14px; line-height:2;"><div>🥚 بيض: <b>${b.initialEggs}</b></div><div>🐣 فقس: <b class="text-success">${b.hatchRate||0}%</b></div><div>☠️ نافق: <b class="text-danger">${dead}</b></div><div>🌾 علف: <b>${totalFeedKg} كجم</b></div></div><div style="margin-top:15px; padding:10px; background:white; border-radius:8px; text-align:center; border:1px solid var(--border);"><span style="font-size:13px; color:var(--text-muted);">مؤشر الاستهلاك (FCR):</span><br><b style="font-size:22px; color:var(--primary);">${feedPerBirdGrams} جرام/طائر</b> <br><span style="font-size:13px; font-weight:bold;">التقييم التقني: ${fcrStatus}</span></div><hr style="border:1px dashed #ccc; margin:15px 0;"><div style="margin-bottom:15px;"><b>مخرجات الدفعة (الفريزر):</b><br>${outputHtml}</div><div class="grid-2" style="background:white; padding:10px; border-radius:8px;"><div>التكلفة الإجمالية:<br><b class="text-danger" style="font-size:18px;">${batchCost} ج</b></div><div>القيمة البيعية المتوقعة:<br><b class="text-success" style="font-size:18px;">${potentialRevenue} ج</b></div></div><div style="text-align:center; margin-top:15px; background:var(--primary); color:white; padding:10px; border-radius:8px;"><span style="font-size:14px;">تكلفة إنتاج <b style="color:var(--warning);">الجوز</b>: <b style="font-size:18px;">${costPerPair} ج.م</b></span></div>${stampHtml}</div>`;
    } else {
        container.innerHTML = `<div style="padding:15px; text-align:center; color:var(--danger); font-weight:bold;">الدفعة لم تكتمل وتُذبح بعد لإصدار بيان ختامي دقيق.</div>`;
    }
    container.style.display = 'block';
};
