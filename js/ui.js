// دوال التنقل بين الصفحات
export function switchPage(pageId, activeElement) {
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(pageId);
    if (target) target.classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(activeElement) activeElement.classList.add('active');
}

// دوال فتح وقفل النوافذ المنبثقة (Modals)
export function openModal(id) {
    const m = document.getElementById(id);
    if(m) m.style.display = 'flex';
}

export function closeModal(id) {
    const m = document.getElementById(id);
    if(m) m.style.display = 'none';
}

// دالة التنبيهات
export function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    if(!t) return;
    t.innerText = msg;
    t.style.backgroundColor = isError ? 'var(--danger)' : 'var(--success)';
    t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 3000);
}

// دالة الزر العائم السريع
export function toggleFab() {
    const fab = document.getElementById('fabMenu');
    if(fab) fab.classList.toggle('active');
}
