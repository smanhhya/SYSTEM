// js/ui.js

// 1. إصلاح مشاكل الـ Navigation
export function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // استخدام العنصر نفسه بدل currentTarget لمنع أخطاء الموبايل
            const pageId = this.getAttribute('data-page');
            switchPage(pageId, this);
        });
    });
}

function switchPage(pageId, activeElement) {
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(activeElement) activeElement.classList.add('active');
}

// 2. إدارة الـ Modals
export function openModal(id) {
    document.getElementById(id).style.display = 'flex';
}

export function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

// 3. إضافة Loading States
export function toggleLoader(show, text = "جاري المعالجة...") {
    const loader = document.getElementById('globalLoader');
    if (show) {
        loader.querySelector('.loader-text').innerText = text;
        loader.style.display = 'flex';
    } else {
        loader.style.display = 'none';
    }
}

// 4. رسائل التنبيه (Toast)
export function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.style.backgroundColor = isError ? 'var(--danger)' : 'var(--success)';
    t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 3000);
}
