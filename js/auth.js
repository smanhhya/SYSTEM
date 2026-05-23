export function initAuth(onLoginSuccess) {
    // تخطي تسجيل الدخول فوراً
    if (onLoginSuccess) onLoginSuccess();
}
// دوال فارغة عشان ميعملش إيرور لو اتنادوا
window.login = () => {};
window.logout = () => {};
