import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, get, push, update, remove, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCVlbWLaLqYnQVsWgFPTe4PL38bWLTLyuU",
    authDomain: "sman-6512c.firebaseapp.com",
    databaseURL: "https://sman-6512c-default-rtdb.firebaseio.com",
    projectId: "sman-6512c",
    storageBucket: "sman-6512c.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// تصدير كل دوال قاعدة البيانات عشان باقي الملفات تشوفها
export { db, ref, set, get, push, update, remove, onValue };
