// js/auth.js
import { auth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from './firebase.js';
import { toggleLoader, showToast } from './ui.js';

export function initAuth(onLoginSuccess) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            document.getElementById('loginScreen').style.display = 'none';
            onLoginSuccess(); 
        } else {
            document.getElementById('loginScreen').style.display = 'flex';
        }
    });

    window.login = login;
    window.logout = logout;
}

async function login() {
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value.trim();
    const errorElement = document.getElementById('loginError');

    if (!email || !password) {
        errorElement.innerText = "برجاء إدخال الإيميل وكلمة المرور";
        errorElement.style.display = 'block';
        return;
    }

    toggleLoader(true, "جاري التحقق من الصلاحيات...");
    errorElement.style.display = 'none';

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast("مرحباً بك في النظام");
    } catch (error) {
        errorElement.innerText = "بيانات الدخول غير صحيحة، أو ليس لديك صلاحية.";
        errorElement.style.display = 'block';
        console.error(error);
    } finally {
        toggleLoader(false);
    }
}

async function logout() {
    if(confirm("هل تريد بالتأكيد تسجيل الخروج؟")) {
        try {
            await signOut(auth);
            window.location.reload(); 
        } catch (error) {
            showToast("حدث خطأ أثناء تسجيل الخروج", true);
        }
    }
}
