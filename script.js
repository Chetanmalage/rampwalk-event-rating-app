// =============================================================
//  FIREBASE IMPORTS
// =============================================================
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, remove } from 'firebase/database';

// =============================================================
//  FIREBASE CONFIG
// =============================================================
const firebaseConfig = {
  apiKey: "AIzaSyCcoFlX7EZSJPYz8fku1i8LwuEpRj0F2uE",
  authDomain: "rampwalkapp-b3427.firebaseapp.com",
  databaseURL: "https://rampwalkapp-b3427-default-rtdb.firebaseio.com",
  projectId: "rampwalkapp-b3427",
  storageBucket: "rampwalkapp-b3427.firebasestorage.app",
  messagingSenderId: "197673561253",
  appId: "1:197673561253:web:c6c288c5b48aace624b14c",
  measurementId: "G-3BQ4Y9MZDD"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// =============================================================
//  ADMIN PASSWORD
// =============================================================
const ADMIN_PASSWORD = 'mcaadmin01';

// =============================================================
//  DOM REFS
// =============================================================
const $ = id => document.getElementById(id);

const loginOverlay = $('loginOverlay');
const loginBtn = $('loginBtn');
const loginClose = $('loginClose');
const loginError = $('loginError');
const adminPasswordInput = $('adminPassword');
const adminToggleBtn = $('adminToggleBtn');
const adminLock = $('adminLock');
const adminProtected = $('adminProtected');
const adminContent = $('adminContent');
const gridContainer = $('gridContainer');

const participantName = $('participantName');
const startPollBtn = $('startPollBtn');
const resetMemoryBtn = $('resetMemoryBtn');
const deleteAllBtn = $('deleteAllBtn');

const headerParticipant = $('headerParticipant');
const statusDot = $('statusDot');
const statusLabel = $('statusLabel');
const ratingParticipant = $('ratingParticipant');
const ratingButtonsWrapper = $('ratingButtonsWrapper');
const ratingMessage = $('ratingMessage');
const avgDisplay = $('avgDisplay');
const votesDisplay = $('votesDisplay');
const noDataMsg = $('noDataMsg');
const participantList = $('participantList');

const toast = $('toast');
const toastIcon = $('toastIcon');
const toastMessage = $('toastMessage');

// =============================================================
//  CHART
// =============================================================
const ctx = document.getElementById('ratingChart').getContext('2d');
const chart = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: ['Poor', 'Fair', 'Good', 'Great', 'Excel.'],
        datasets: [{
            label: 'Votes',
            data: [0, 0, 0, 0, 0],
            backgroundColor: [
                'rgba(248,113,113,0.75)',
                'rgba(251,146,60,0.75)',
                'rgba(251,191,36,0.75)',
                'rgba(74,222,128,0.75)',
                'rgba(96,165,250,0.75)',
            ],
            borderColor: ['#f87171','#fb923c','#fbbf24','#4ade80','#60a5fa'],
            borderWidth: 2,
            borderRadius: 8,
            barPercentage: 0.7,
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, color: '#6a6a8a' }, grid: { color: 'rgba(255,255,255,0.04)' } },
            x: { ticks: { color: '#6a6a8a', font: { size: 10 } }, grid: { display: false } }
        },
        animation: { duration: 400 }
    }
});

// =============================================================
//  STATE
// =============================================================
let currentRampwalk = null;
let unsubscribeRatings = null;
let allParticipants = {};
let votedRampwalks = JSON.parse(localStorage.getItem('votedRampwalks')) || {};
let userId = localStorage.getItem('userId');
if (!userId) {
    userId = 'user_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('userId', userId);
}
let isAdminLoggedIn = false;

// =============================================================
//  TOAST
// =============================================================
let toastTimer = null;
function showToast(message, type = 'info') {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toastIcon.textContent = icons[type] || icons.info;
    toastMessage.textContent = message;
    toast.className = `toast ${type} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3800);
}

// =============================================================
//  UI HELPERS
// =============================================================
function setStatus(live, participant = null) {
    if (live) {
        statusDot.className = 'dot live';
        statusLabel.textContent = 'Live';
        headerParticipant.textContent = participant || '—';
        ratingParticipant.className = 'rating-participant';
        ratingParticipant.textContent = participant || '—';
        ratingButtonsWrapper.classList.remove('rating-disabled');
        ratingMessage.classList.remove('show');
    } else {
        statusDot.className = 'dot idle';
        statusLabel.textContent = 'Idle';
        headerParticipant.textContent = '—';
        ratingParticipant.className = 'rating-participant idle';
        ratingParticipant.textContent = 'Waiting for poll to start…';
        ratingButtonsWrapper.classList.add('rating-disabled');
        ratingMessage.classList.remove('show');
    }
}

function updateResults(data) {
    if (!data || Object.keys(data).length === 0) {
        avgDisplay.innerHTML = '— <span class="denom">/ 5</span>';
        votesDisplay.textContent = '0 votes';
        noDataMsg.style.display = 'block';
        chart.data.datasets[0].data = [0,0,0,0,0];
        chart.update();
        return;
    }
    const ratings = Object.values(data);
    const total = ratings.length;
    const sum = ratings.reduce((a,b) => a+b, 0);
    const avg = sum / total;
    avgDisplay.innerHTML = `${avg.toFixed(2)} <span class="denom">/ 5</span>`;
    votesDisplay.textContent = `${total} vote${total !== 1 ? 's' : ''}`;
    noDataMsg.style.display = 'none';
    const counts = [0,0,0,0,0];
    ratings.forEach(r => { if (r>=1 && r<=5) counts[r-1]++; });
    chart.data.datasets[0].data = counts;
    chart.update();
}

function renderParticipantList(data) {
    if (!data || Object.keys(data).length === 0) {
        participantList.innerHTML = '<div class="text-muted" style="padding:8px 0;font-size:0.85rem;">No participants yet</div>';
        return;
    }
    let html = '';
    const sorted = Object.keys(data).sort();
    for (const name of sorted) {
        const ratings = Object.values(data[name]);
        const total = ratings.length;
        const avg = total > 0 ? (ratings.reduce((a,b) => a+b, 0) / total).toFixed(2) : '0.00';
        html += `<div class="participant-item"><span class="p-name">${name}</span><span><span class="p-avg">${avg}</span> <span class="p-votes">(${total})</span></span></div>`;
    }
    participantList.innerHTML = html;
}

// =============================================================
//  ADMIN LOGIN / LOGOUT
// =============================================================
function openLogin() {
    loginOverlay.classList.add('open');
    adminPasswordInput.value = '';
    loginError.classList.remove('show');
    adminPasswordInput.focus();
}

function closeLogin() {
    loginOverlay.classList.remove('open');
}

window.attemptLogin = function() {
    const pass = adminPasswordInput.value.trim();
    console.log('Attempting login with:', pass);
    if (pass === ADMIN_PASSWORD) {
        console.log('✅ Login successful');
        isAdminLoggedIn = true;
        adminToggleBtn.textContent = '👑 Logout';
        gridContainer.classList.add('admin-visible');
        closeLogin();
        adminProtected.style.display = 'none';
        adminContent.classList.add('active');
        adminLock.textContent = '🔓';
        showToast('Admin panel unlocked.', 'success');
    } else {
        console.log('❌ Wrong password');
        loginError.classList.add('show');
        adminPasswordInput.value = '';
        adminPasswordInput.focus();
        showToast('Incorrect password.', 'error');
    }
};

function adminLogout() {
    console.log('Logging out');
    isAdminLoggedIn = false;
    adminToggleBtn.textContent = '👑 Admin';
    gridContainer.classList.remove('admin-visible');
    adminProtected.style.display = 'block';
    adminContent.classList.remove('active');
    adminLock.textContent = '🔒';
    showToast('Logged out of admin panel.', 'info');
}

window.toggleAdmin = function() {
    if (isAdminLoggedIn) {
        if (confirm('Logout from admin panel?')) adminLogout();
    } else {
        openLogin();
    }
};

// =============================================================
//  FIREBASE: CURRENT RAMPWALK
// =============================================================
const currentRef = ref(db, 'currentRampwalk');
onValue(currentRef, (snap) => {
    const val = snap.val();
    currentRampwalk = val || null;
    if (currentRampwalk) {
        setStatus(true, currentRampwalk);
        if (unsubscribeRatings) { unsubscribeRatings(); unsubscribeRatings = null; }
        const ratingsRef = ref(db, `ratings/${currentRampwalk}`);
        unsubscribeRatings = onValue(ratingsRef, (rSnap) => {
            const data = rSnap.val();
            updateResults(data);
            if (data && data[userId]) {
                ratingButtonsWrapper.classList.add('rating-disabled');
                ratingMessage.classList.add('show');
            } else {
                ratingButtonsWrapper.classList.remove('rating-disabled');
                ratingMessage.classList.remove('show');
            }
        });
    } else {
        setStatus(false);
        if (unsubscribeRatings) { unsubscribeRatings(); unsubscribeRatings = null; }
        updateResults(null);
        ratingButtonsWrapper.classList.add('rating-disabled');
        ratingMessage.classList.remove('show');
    }
});

// =============================================================
//  FIREBASE: ALL PARTICIPANTS
// =============================================================
const allRatingsRef = ref(db, 'ratings');
onValue(allRatingsRef, (snap) => {
    allParticipants = snap.val() || {};
    renderParticipantList(allParticipants);
});

// =============================================================
//  START POLL
// =============================================================
startPollBtn.addEventListener('click', () => {
    if (!isAdminLoggedIn) { showToast('Admin panel is locked. Please login first.', 'error'); return; }
    const name = participantName.value.trim();
    if (!name) { showToast('Please enter a participant name.', 'error'); return; }
    set(ref(db, `ratings/${name}`), null)
        .then(() => set(ref(db, 'currentRampwalk'), name))
        .then(() => {
            showToast(`Poll started for "${name}"!`, 'success');
            participantName.value = '';
            delete votedRampwalks[name];
            localStorage.setItem('votedRampwalks', JSON.stringify(votedRampwalks));
        })
        .catch(err => showToast('Error: ' + err.message, 'error'));
});
participantName.addEventListener('keydown', (e) => { if (e.key === 'Enter') startPollBtn.click(); });

// =============================================================
//  SUBMIT RATING
// =============================================================
document.querySelectorAll('.rating-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        if (!currentRampwalk) { showToast('No active poll.', 'error'); return; }
        if (ratingButtonsWrapper.classList.contains('rating-disabled')) {
            showToast('You already voted for this participant.', 'info');
            return;
        }
        const value = parseInt(btn.dataset.value, 10);
        if (isNaN(value) || value < 1 || value > 5) return;
        const ratingRef = ref(db, `ratings/${currentRampwalk}/${userId}`);
        set(ratingRef, value)
            .then(() => {
                votedRampwalks[currentRampwalk] = true;
                localStorage.setItem('votedRampwalks', JSON.stringify(votedRampwalks));
                ratingButtonsWrapper.classList.add('rating-disabled');
                ratingMessage.classList.add('show');
                showToast(`You rated ${value} / 5 — thank you!`, 'success');
            })
            .catch(err => showToast('Error submitting rating: ' + err.message, 'error'));
    });
});

// =============================================================
//  RESET MEMORY (clears browser memory AND ends the current poll)
// =============================================================
resetMemoryBtn.addEventListener('click', () => {
    if (!isAdminLoggedIn) { showToast('Admin panel is locked.', 'error'); return; }

    // 1. Clear browser memory
    localStorage.removeItem('votedRampwalks');
    localStorage.removeItem('userId');
    votedRampwalks = {};
    userId = 'user_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('userId', userId);
    ratingButtonsWrapper.classList.remove('rating-disabled');
    ratingMessage.classList.remove('show');

    // 2. End the current poll so the rating panel resets
    set(ref(db, 'currentRampwalk'), null)
        .then(() => {
            showToast('Memory cleared and poll ended. Rating panel reset.', 'info');
        })
        .catch(err => showToast('Error clearing poll: ' + err.message, 'error'));
});

// =============================================================
//  DELETE ALL RECORDS
// =============================================================
deleteAllBtn.addEventListener('click', () => {
    if (!isAdminLoggedIn) { showToast('Admin panel is locked.', 'error'); return; }
    if (!confirm('⚠️ Are you sure? This will DELETE ALL participant records permanently.')) return;
    if (!confirm('Really? This action cannot be undone.')) return;
    remove(ref(db, 'ratings'))
        .then(() => remove(ref(db, 'currentRampwalk')))
        .then(() => {
            showToast('All records deleted.', 'error');
            votedRampwalks = {};
            localStorage.setItem('votedRampwalks', JSON.stringify(votedRampwalks));
        })
        .catch(err => showToast('Error deleting records: ' + err.message, 'error'));
});

// =============================================================
//  CLOSE LOGIN OVERLAY
// =============================================================
loginClose.addEventListener('click', closeLogin);
loginOverlay.addEventListener('click', (e) => { if (e.target === loginOverlay) closeLogin(); });

// =============================================================
//  INIT
// =============================================================
setStatus(false);
ratingButtonsWrapper.classList.add('rating-disabled');
updateResults(null);
console.log('✦ Rampwalk Live — Admin + Rating');
console.log('   Password: admin123');
console.log('   User ID:', userId);