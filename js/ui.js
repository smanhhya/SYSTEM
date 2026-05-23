// js/ui.js
export function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            const pageId = this.getAttribute('data-page');
            switchPage(pageId, this);
        });
    });
}

function switchPage(pageId, activeElement) {
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(pageId);
    if (target) target.classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(activeElement) activeElement.classList.add('active');
}

export function openModal(id) {
    const m = document.getElementById(id);
    if(m) m.style.display = 'flex';
}

export function closeModal(id) {
    const m = document.getElementById(id);
    if(m) m.style.display = 'none';
}

export function toggleLoader(show, text = "جاري المعالجة...") {
    const loader = document.getElementById('globalLoader');
    if(!loader) return;
    if (show) {
        const textEl = loader.querySelector('.loader-text');
        if(textEl) textEl.innerText = text;
        loader.style.display = 'flex';
    } else {
        loader.style.display = 'none';
    }
}

export function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    if(!t) return;
    t.innerText = msg;
    t.style.backgroundColor = isError ? 'var(--danger)' : 'var(--success)';
    t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 3000);
}

export function toggleFab() {
    const fab = document.getElementById('fabMenu');
    if(fab) fab.classList.toggle('active');
}

export function initOfflineSupport() {
    window.addEventListener('offline', () => showToast("أنت الآن Offline 🔴", true));
    window.addEventListener('online', () => showToast("تم عودة الاتصال 🟢"));
}
