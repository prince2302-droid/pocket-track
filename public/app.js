/**
 * PocketTrack — Student Multi-Account Expense Tracker
 * Frontend Controller (SPA Multi-View Architecture)
 * Features:
 * - Home Page: Clean minimal display of ONLY UPI balance, Cash balance, and Total Pocket Money
 * - Dynamic SPA Views: Home, Record, Transfer, Analytics, Passbook, Settings
 * - Instant Access: Auto-authenticates and persists permanently in MongoDB Atlas
 * - PWA Support: Standalone app capability with home screen installation
 */

const CATEGORIES = {
  expense: [
    { id: 'Food & Canteen', icon: 'fa-utensils', color: '#f97316', bg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
    { id: 'College & Academics', icon: 'fa-graduation-cap', color: '#6366f1', bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
    { id: 'Transport & Metro', icon: 'fa-bus', color: '#0284c7', bg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
    { id: 'Entertainment & Hangouts', icon: 'fa-film', color: '#ec4899', bg: 'bg-pink-500/10 text-pink-600 dark:text-pink-400' },
    { id: 'Online Shopping', icon: 'fa-bag-shopping', color: '#a855f7', bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
    { id: 'Recharge & Bills', icon: 'fa-bolt', color: '#eab308', bg: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
    { id: 'Hostel & Rent', icon: 'fa-house', color: '#14b8a6', bg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' },
    { id: 'Transfer', icon: 'fa-right-left', color: '#64748b', bg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
    { id: 'Other Expense', icon: 'fa-ellipsis', color: '#64748b', bg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' }
  ],
  income: [
    { id: 'Pocket Money', icon: 'fa-hand-holding-dollar', color: '#10b981', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    { id: 'Internship / Stipend', icon: 'fa-laptop-code', color: '#06b6d4', bg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' },
    { id: 'Gifts & Cash', icon: 'fa-gift', color: '#f43f5e', bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
    { id: 'Transfer', icon: 'fa-right-left', color: '#64748b', bg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
    { id: 'Other Income', icon: 'fa-plus', color: '#64748b', bg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' }
  ]
};

// ==========================================
// Subtle Web Audio Synthesizer (Micro-haptics)
// ==========================================
class SoundFX {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playPop() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.09);
    } catch (e) {}
  }

  playSuccess() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.05);
        gain.gain.setValueAtTime(0.06, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.2);
      });
    } catch (e) {}
  }
}

// ==========================================
// Main Application Controller
// ==========================================
class StudentExpenseApp {
  constructor() {
    this.sound = new SoundFX();
    this.currentView = 'dashboard';
    this.chart = null;
    this.chartType = 'doughnut';
    this.chartFilterAccount = 'all';

    // Authentication State (JWT)
    this.token = localStorage.getItem('pt_jwt_token') || null;
    this.user = JSON.parse(localStorage.getItem('pt_user') || 'null');
    this.authMode = 'login';

    // Preferences
    this.currency = localStorage.getItem('pt_currency') || (this.user ? this.user.defaultCurrency : '₹') || '₹';
    this.theme = localStorage.getItem('pt_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    // Data Store
    this.transactions = [];
    this.summary = {
      upiBalance: 0,
      cashBalance: 0,
      totalBalance: 0,
      totalPocketMoney: 0,
      totalSpent: 0,
      remainingPocketMoney: 0,
      spendRatio: 0,
      categoryBreakdown: {}
    };

    // History Passbook Filters
    this.filters = {
      account: 'all',
      type: 'all',
      category: 'all',
      search: '',
      sort: 'date-desc'
    };

    this.cacheDOMElements();
    this.initTheme();
    this.bindEvents();
    this.updateUserUI();
    this.populateCategoryOptions('expense');
    this.populateFilterCategories();
    this.initChart();
    this.checkCloudStatus();
    this.initSession();
    this.initPWA();
    this.updateHeaderDate();
  }

  cacheDOMElements() {
    // Views
    this.views = {
      dashboard: document.getElementById('viewDashboard'),
      add: document.getElementById('viewAdd'),
      transfer: document.getElementById('viewTransfer'),
      analytics: document.getElementById('viewAnalytics'),
      history: document.getElementById('viewHistory'),
      settings: document.getElementById('viewSettings')
    };

    // Navigation Tabs
    this.navTabs = {
      dashboard: document.getElementById('navTabDashboard'),
      add: document.getElementById('navTabAdd'),
      transfer: document.getElementById('navTabTransfer'),
      analytics: document.getElementById('navTabAnalytics'),
      history: document.getElementById('navTabHistory'),
      settings: document.getElementById('navTabSettings')
    };

    // Home Page Balance Cards (The 3 cards requested)
    this.statUpiBalance = document.getElementById('statUpiBalance');
    this.statCashBalance = document.getElementById('statCashBalance');
    this.statPocketMoneyTotal = document.getElementById('statPocketMoneyTotal');

    // Record / Add Form Elements
    this.transactionForm = document.getElementById('transactionForm');
    this.btnTypeExpense = document.getElementById('btnTypeExpense');
    this.btnTypeIncome = document.getElementById('btnTypeIncome');
    this.txType = document.getElementById('txType');
    this.txAccount = document.getElementById('txAccount');
    this.accountLabelUPI = document.getElementById('accountLabelUPI');
    this.accountLabelCash = document.getElementById('accountLabelCash');
    this.txTitle = document.getElementById('txTitle');
    this.txAmount = document.getElementById('txAmount');
    this.txCategory = document.getElementById('txCategory');
    this.txDate = document.getElementById('txDate');
    this.txNotes = document.getElementById('txNotes');
    this.submitBtn = document.getElementById('submitBtn');
    this.submitBtnText = document.getElementById('submitBtnText');
    this.amountSymbolPrefix = document.getElementById('amountSymbolPrefix');

    // Transfer Form Elements
    this.transferForm = document.getElementById('transferForm');
    this.transferFrom = document.getElementById('transferFrom');
    this.transferTo = document.getElementById('transferTo');
    this.transferAmount = document.getElementById('transferAmount');
    this.transferNotes = document.getElementById('transferNotes');
    this.transferCurrencyPrefix = document.getElementById('transferCurrencyPrefix');

    // Analytics Elements
    this.expenseChartCanvas = document.getElementById('expenseChart');
    this.chartCenterOverlay = document.getElementById('chartCenterOverlay');
    this.chartCenterAmount = document.getElementById('chartCenterAmount');
    this.chartCategoryCount = document.getElementById('chartCategoryCount');
    this.categoryLeaderboard = document.getElementById('categoryLeaderboard');
    this.noDataChart = document.getElementById('noDataChart');
    this.chartFilterAll = document.getElementById('chartFilterAll');
    this.chartFilterUPI = document.getElementById('chartFilterUPI');
    this.chartFilterCash = document.getElementById('chartFilterCash');
    this.chartViewDonut = document.getElementById('chartViewDonut');
    this.chartViewBar = document.getElementById('chartViewBar');
    this.exportCsvBtn = document.getElementById('exportCsvBtn');

    // Passbook History Elements
    this.searchInput = document.getElementById('searchInput');
    this.clearSearchBtn = document.getElementById('clearSearchBtn');
    this.tabFilterAll = document.getElementById('tabFilterAll');
    this.tabFilterUPI = document.getElementById('tabFilterUPI');
    this.tabFilterCash = document.getElementById('tabFilterCash');
    this.filterCategory = document.getElementById('filterCategory');
    this.filterType = document.getElementById('filterType');
    this.filterSort = document.getElementById('filterSort');
    this.txCountBadge = document.getElementById('txCountBadge');
    this.transactionList = document.getElementById('transactionList');
    this.emptyState = document.getElementById('emptyState');

    // Settings Elements
    this.settingsUserName = document.getElementById('settingsUserName');
    this.settingsUserEmail = document.getElementById('settingsUserEmail');
    this.settingsUserAvatarLetter = document.getElementById('settingsUserAvatarLetter');
    this.settingsAuthActionBtn = document.getElementById('settingsAuthActionBtn');
    this.currencySelector = document.getElementById('currencySelector');

    // Auth Elements
    this.authBtn = document.getElementById('authBtn');
    this.authBtnText = document.getElementById('authBtnText');
    this.authBtnIcon = document.getElementById('authBtnIcon');
    this.authModal = document.getElementById('authModal');
    this.authModalContent = document.getElementById('authModalContent');
    this.closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
    this.tabAuthLogin = document.getElementById('tabAuthLogin');
    this.tabAuthSignup = document.getElementById('tabAuthSignup');
    this.authNameField = document.getElementById('authNameField');
    this.authName = document.getElementById('authName');
    this.authEmail = document.getElementById('authEmail');
    this.authPassword = document.getElementById('authPassword');
    this.authSubmitBtn = document.getElementById('authSubmitBtn');
    this.authSubmitText = document.getElementById('authSubmitText');
    this.authErrorAlert = document.getElementById('authErrorAlert');
    this.authErrorMsg = document.getElementById('authErrorMsg');
    this.continueGuestBtn = document.getElementById('continueGuestBtn');

    // Global
    this.cloudStatusBadge = document.getElementById('cloudStatusBadge');
    this.cloudStatusDot = document.getElementById('cloudStatusDot');
    this.cloudStatusText = document.getElementById('cloudStatusText');
    this.userWelcomeText = document.getElementById('userWelcomeText');
    this.headerDateDisplay = document.getElementById('headerDateDisplay');
    this.activeCurrencyDisplay = document.getElementById('activeCurrencyDisplay');
    this.themeToggleBtn = document.getElementById('themeToggleBtn');
    this.themeIcon = document.getElementById('themeIcon');
    this.toastContainer = document.getElementById('toastContainer');

    // PWA
    this.installAppBtn = document.getElementById('installAppBtn');
    this.installModal = document.getElementById('installModal');
    this.installModalContent = document.getElementById('installModalContent');
    this.closeInstallModalBtn = document.getElementById('closeInstallModalBtn');
    this.dismissInstallModalBtn = document.getElementById('dismissInstallModalBtn');
    this.triggerNativeInstallBtn = document.getElementById('triggerNativeInstallBtn');
    this.nativeInstallPromptBox = document.getElementById('nativeInstallPromptBox');
    this.deferredInstallPrompt = null;
  }

  // ==========================================
  // SESSION & INSTANT ACCESS
  // ==========================================
  async initSession() {
    if (!this.token) {
      try {
        const res = await fetch('/api/auth/auto-login', { method: 'POST' });
        const data = await res.json();
        if (data.success && data.token) {
          this.token = data.token;
          this.user = data.user;
          localStorage.setItem('pt_jwt_token', this.token);
          localStorage.setItem('pt_user', JSON.stringify(this.user));
          this.updateUserUI();
        }
      } catch (e) {
        console.warn('Auto-login notice:', e);
      }
    }
    this.fetchTransactions();
  }

  // ==========================================
  // SPA MULTI-VIEW NAVIGATION
  // ==========================================
  switchView(viewName, options = {}) {
    if (!this.views[viewName]) return;
    this.currentView = viewName;
    this.sound.playPop();

    // Show only the selected view
    Object.keys(this.views).forEach((key) => {
      const el = this.views[key];
      if (el) {
        if (key === viewName) {
          el.classList.remove('hidden');
          el.classList.add('active-view');
        } else {
          el.classList.add('hidden');
          el.classList.remove('active-view');
        }
      }
    });

    // Update Top Navigation Tabs
    Object.keys(this.navTabs).forEach((key) => {
      const tab = this.navTabs[key];
      if (tab) {
        if (key === viewName) {
          tab.className = 'px-3.5 py-1.5 rounded-xl border border-transparent transition flex items-center gap-2 nav-tab-active font-extrabold whitespace-nowrap shadow-sm';
        } else {
          tab.className = 'px-3.5 py-1.5 rounded-xl border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-2 whitespace-nowrap font-bold';
        }
      }
    });

    // Handle view-specific initializations
    if (viewName === 'add') {
      if (options.type) this.setType(options.type);
      this.setDefaultDate();
    } else if (viewName === 'transfer') {
      if (this.transferAmount) this.transferAmount.focus();
    } else if (viewName === 'analytics') {
      this.renderChart();
    } else if (viewName === 'history') {
      this.renderHistoryList();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================
  // AUTHENTICATION MODAL
  // ==========================================
  openAuthModal(mode = 'login') {
    this.authMode = mode;
    this.updateAuthModalUI();
    if (this.authErrorAlert) this.authErrorAlert.classList.add('hidden');
    if (this.authModal) {
      this.authModal.classList.remove('hidden');
      setTimeout(() => {
        if (this.authModalContent) {
          this.authModalContent.classList.remove('scale-95', 'opacity-0');
          this.authModalContent.classList.add('scale-100', 'opacity-100');
        }
      }, 10);
    }
  }

  closeAuthModal() {
    if (this.authModalContent) {
      this.authModalContent.classList.remove('scale-100', 'opacity-100');
      this.authModalContent.classList.add('scale-95', 'opacity-0');
    }
    setTimeout(() => {
      if (this.authModal) this.authModal.classList.add('hidden');
    }, 200);
  }

  updateAuthModalUI() {
    if (this.authMode === 'signup') {
      if (this.tabAuthSignup) this.tabAuthSignup.className = 'py-2 rounded-lg bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white transition font-bold';
      if (this.tabAuthLogin) this.tabAuthLogin.className = 'py-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition';
      if (this.authNameField) this.authNameField.classList.remove('hidden');
      if (this.authSubmitText) this.authSubmitText.textContent = 'Create Account';
    } else {
      if (this.tabAuthLogin) this.tabAuthLogin.className = 'py-2 rounded-lg bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white transition font-bold';
      if (this.tabAuthSignup) this.tabAuthSignup.className = 'py-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition';
      if (this.authNameField) this.authNameField.classList.add('hidden');
      if (this.authSubmitText) this.authSubmitText.textContent = 'Sign In';
    }
  }

  async handleAuthSubmit(e) {
    e.preventDefault();
    const email = this.authEmail.value.trim();
    const password = this.authPassword.value.trim();
    const name = this.authName ? this.authName.value.trim() : '';

    if (!email || !password) {
      this.showAuthError('Please enter both email and password.');
      return;
    }

    if (this.authMode === 'signup' && !name) {
      this.showAuthError('Please enter your full name.');
      return;
    }

    const endpoint = this.authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
    const payload = this.authMode === 'signup' ? { name, email, password } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success && data.token) {
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('pt_jwt_token', this.token);
        localStorage.setItem('pt_user', JSON.stringify(this.user));

        this.updateUserUI();
        this.closeAuthModal();
        this.sound.playSuccess();
        confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
        this.showToast(`Logged in as ${this.user.name}! Permanent sync ready.`, 'success');

        this.fetchTransactions();
      } else {
        this.showAuthError(data.error || 'Authentication failed.');
      }
    } catch (err) {
      this.showAuthError('Connection error. Please try again.');
    }
  }

  showAuthError(msg) {
    if (this.authErrorAlert) {
      this.authErrorMsg.textContent = msg;
      this.authErrorAlert.classList.remove('hidden');
    }
  }

  updateUserUI() {
    const displayName = this.user ? this.user.name : 'Prince';
    const displayEmail = this.user ? this.user.email : 'princeshrivastva12@gmail.com';

    if (this.userWelcomeText) {
      this.userWelcomeText.innerHTML = `Welcome back, <strong class="text-brand-600 dark:text-brand-400 font-extrabold">${this.escapeHTML(displayName)}</strong>! Permanent MongoDB Atlas sync active.`;
    }
    if (this.authBtnText) this.authBtnText.textContent = displayName.split(' ')[0];
    if (this.settingsUserName) this.settingsUserName.textContent = displayName;
    if (this.settingsUserEmail) this.settingsUserEmail.textContent = displayEmail;
    if (this.settingsUserAvatarLetter) this.settingsUserAvatarLetter.textContent = (displayName[0] || 'P').toUpperCase();
    if (this.activeCurrencyDisplay) this.activeCurrencyDisplay.textContent = `${this.currency} (${this.currency === '₹' ? 'INR' : 'USD'})`;
    if (this.currencySelector) this.currencySelector.value = this.currency;
    if (this.amountSymbolPrefix) this.amountSymbolPrefix.textContent = this.currency;
    if (this.transferCurrencyPrefix) this.transferCurrencyPrefix.textContent = this.currency;
  }

  // ==========================================
  // EVENT BINDINGS
  // ==========================================
  bindEvents() {
    // Theme
    if (this.themeToggleBtn) this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());

    // Currency
    if (this.currencySelector) {
      this.currencySelector.addEventListener('change', (e) => {
        this.currency = e.target.value;
        localStorage.setItem('pt_currency', this.currency);
        this.updateUserUI();
        this.render();
        this.sound.playPop();
        this.showToast(`Currency set to ${this.currency}`, 'info');
      });
    }

    // Type Switcher
    if (this.btnTypeExpense) this.btnTypeExpense.addEventListener('click', () => { this.setType('expense'); this.sound.playPop(); });
    if (this.btnTypeIncome) this.btnTypeIncome.addEventListener('click', () => { this.setType('income'); this.sound.playPop(); });

    // Account Radios
    document.querySelectorAll('input[name="txAccountRadio"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        this.setAccount(e.target.value);
        this.sound.playPop();
      });
    });

    // Campus Presets
    document.querySelectorAll('.preset-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const { title, amount, cat, acc, type } = chip.dataset;
        this.applyPreset({ title, amount, cat, acc, type });
      });
    });

    // Forms
    if (this.transactionForm) this.transactionForm.addEventListener('submit', (e) => this.handleSubmit(e));
    if (this.transferForm) this.transferForm.addEventListener('submit', (e) => this.handleTransferSubmit(e));

    // History Passbook Filters & Search
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value.toLowerCase().trim();
        if (this.clearSearchBtn) this.clearSearchBtn.classList.toggle('hidden', !this.filters.search);
        this.renderHistoryList();
      });
    }

    if (this.clearSearchBtn) {
      this.clearSearchBtn.addEventListener('click', () => {
        if (this.searchInput) this.searchInput.value = '';
        this.filters.search = '';
        this.clearSearchBtn.classList.add('hidden');
        this.renderHistoryList();
      });
    }

    if (this.tabFilterAll) this.tabFilterAll.addEventListener('click', () => this.setHistoryAccountFilter('all'));
    if (this.tabFilterUPI) this.tabFilterUPI.addEventListener('click', () => this.setHistoryAccountFilter('UPI'));
    if (this.tabFilterCash) this.tabFilterCash.addEventListener('click', () => this.setHistoryAccountFilter('Cash'));

    if (this.filterCategory) {
      this.filterCategory.addEventListener('change', (e) => {
        this.filters.category = e.target.value;
        this.renderHistoryList();
      });
    }

    if (this.filterType) {
      this.filterType.addEventListener('change', (e) => {
        this.filters.type = e.target.value;
        this.renderHistoryList();
      });
    }

    if (this.filterSort) {
      this.filterSort.addEventListener('change', (e) => {
        this.filters.sort = e.target.value;
        this.renderHistoryList();
      });
    }

    // Chart Filters
    if (this.chartFilterAll) this.chartFilterAll.addEventListener('click', () => this.setChartAccountFilter('all'));
    if (this.chartFilterUPI) this.chartFilterUPI.addEventListener('click', () => this.setChartAccountFilter('UPI'));
    if (this.chartFilterCash) this.chartFilterCash.addEventListener('click', () => this.setChartAccountFilter('Cash'));
    if (this.chartViewDonut) this.chartViewDonut.addEventListener('click', () => this.setChartView('doughnut'));
    if (this.chartViewBar) this.chartViewBar.addEventListener('click', () => this.setChartView('bar'));
    if (this.exportCsvBtn) this.exportCsvBtn.addEventListener('click', () => this.exportToCSV());

    // Auth Modal Triggers
    if (this.authBtn) this.authBtn.addEventListener('click', () => this.openAuthModal('login'));
    if (this.settingsAuthActionBtn) this.settingsAuthActionBtn.addEventListener('click', () => this.openAuthModal('login'));
    if (this.tabAuthLogin) this.tabAuthLogin.addEventListener('click', () => { this.authMode = 'login'; this.updateAuthModalUI(); });
    if (this.tabAuthSignup) this.tabAuthSignup.addEventListener('click', () => { this.authMode = 'signup'; this.updateAuthModalUI(); });
    if (this.closeAuthModalBtn) this.closeAuthModalBtn.addEventListener('click', () => this.closeAuthModal());
    if (this.continueGuestBtn) this.continueGuestBtn.addEventListener('click', () => this.closeAuthModal());
    if (this.authForm) this.authForm.addEventListener('submit', (e) => this.handleAuthSubmit(e));

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.switchView('history');
        if (this.searchInput) this.searchInput.focus();
      } else if (e.key === 'Escape') {
        if (this.authModal && !this.authModal.classList.contains('hidden')) this.closeAuthModal();
        if (this.installModal && !this.installModal.classList.contains('hidden')) this.closeInstallModal();
      }
    });
  }

  // ==========================================
  // API CLIENT
  // ==========================================
  getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  async checkCloudStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.connected && this.cloudStatusBadge) {
        this.cloudStatusBadge.className = 'flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 transition';
        if (this.cloudStatusDot) this.cloudStatusDot.className = 'w-2 h-2 rounded-full bg-emerald-500 live-indicator';
        if (this.cloudStatusText) this.cloudStatusText.textContent = 'MongoDB Atlas';
      }
    } catch (e) {}
  }

  async fetchTransactions() {
    try {
      const res = await fetch('/api/transactions', { headers: this.getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        this.transactions = data.transactions || [];
        this.summary = data.summary;
        this.render();
      }
    } catch (e) {
      console.warn('Network notice:', e);
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    const title = this.txTitle.value.trim();
    const amount = parseFloat(this.txAmount.value);
    const type = this.txType.value;
    const account = this.txAccount.value;
    const category = this.txCategory.value;
    const date = this.txDate.value;
    const notes = this.txNotes.value.trim();

    if (!title || isNaN(amount) || amount <= 0) {
      this.showToast('Please provide a description and a valid amount.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ title, amount, type, account, category, date, notes })
      });
      const data = await res.json();

      if (data.success) {
        this.transactions.unshift(data.transaction);
        this.summary = data.summary;
        this.transactionForm.reset();
        this.setDefaultDate();
        this.render();

        const toastMsg = type === 'income' ? `Pocket Money added to ${account}! 🎉` : `Expense logged from ${account}`;
        this.showToast(toastMsg, 'success');
        if (type === 'income') {
          this.sound.playSuccess();
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        } else {
          this.sound.playPop();
        }

        // Return smoothly to the clean Home page showing updated balances
        setTimeout(() => this.switchView('dashboard'), 350);
      } else {
        this.showToast(data.error || 'Failed to save transaction', 'error');
      }
    } catch (err) {
      this.showToast('Network error saving transaction', 'error');
    }
  }

  async handleTransferSubmit(e) {
    e.preventDefault();
    const fromAccount = this.transferFrom.value;
    const toAccount = this.transferTo.value;
    const amount = parseFloat(this.transferAmount.value);
    const notes = this.transferNotes.value.trim();

    if (isNaN(amount) || amount <= 0) {
      this.showToast('Please enter a valid transfer amount.', 'error');
      return;
    }

    if (fromAccount === toAccount) {
      this.showToast('Source and destination accounts must be different.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/transactions/transfer', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ fromAccount, toAccount, amount, notes })
      });
      const data = await res.json();

      if (data.success) {
        (data.transactions || []).forEach((t) => this.transactions.unshift(t));
        this.summary = data.summary;
        this.transferForm.reset();
        this.render();
        this.sound.playSuccess();
        this.showToast(`Transferred ${this.currency}${amount} from ${fromAccount} to ${toAccount} 🔄`, 'success');
        setTimeout(() => this.switchView('dashboard'), 350);
      } else {
        this.showToast(data.error || 'Transfer failed', 'error');
      }
    } catch (err) {
      this.showToast('Network error executing transfer', 'error');
    }
  }

  async deleteTransaction(id) {
    if (!confirm('Are you sure you want to permanently delete this record from MongoDB Atlas?')) return;
    this.sound.playPop();

    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      const data = await res.json();

      if (data.success) {
        this.transactions = this.transactions.filter((t) => t._id !== id && t.id !== id);
        this.summary = data.summary;
        this.render();
        this.showToast('Transaction permanently deleted.', 'info');
      } else {
        this.showToast(data.error || 'Failed to delete transaction', 'error');
      }
    } catch (err) {
      this.showToast('Network error deleting transaction', 'error');
    }
  }

  // ==========================================
  // RENDERING
  // ==========================================
  render() {
    this.renderHomeBalances();
    this.renderHistoryList();
    this.renderChart();
  }

  formatCurrency(amount) {
    const num = Number(amount) || 0;
    return `${this.currency}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // HOME PAGE: ONLY SHOWS UPI, CASH & TOTAL POCKET MONEY
  renderHomeBalances() {
    const { upiBalance, cashBalance, totalPocketMoney } = this.summary;
    if (this.statUpiBalance) this.statUpiBalance.textContent = this.formatCurrency(upiBalance);
    if (this.statCashBalance) this.statCashBalance.textContent = this.formatCurrency(cashBalance);
    if (this.statPocketMoneyTotal) this.statPocketMoneyTotal.textContent = this.formatCurrency(totalPocketMoney);
  }

  renderHistoryList() {
    if (!this.transactionList) return;
    const filtered = this.getFilteredTransactions();
    if (this.txCountBadge) this.txCountBadge.textContent = filtered.length;

    if (filtered.length === 0) {
      this.transactionList.innerHTML = '';
      if (this.emptyState) this.emptyState.classList.remove('hidden');
      return;
    }

    if (this.emptyState) this.emptyState.classList.add('hidden');
    this.transactionList.innerHTML = filtered.map((t) => this.renderTransactionItemHTML(t)).join('');
  }

  renderTransactionItemHTML(t) {
    const txId = t._id || t.id;
    const isTransfer = t.type === 'transfer';
    const isIncome = t.type === 'income';
    const isUPI = t.account === 'UPI';

    const metaList = CATEGORIES[t.type] || [];
    const catMeta = metaList.find((c) => c.id === t.category) || {
      icon: isTransfer ? 'fa-right-left' : isIncome ? 'fa-arrow-up' : 'fa-arrow-down',
      bg: isTransfer ? 'bg-indigo-500/10 text-brand-600' : isIncome ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
    };

    const dateObj = new Date(t.date);
    const formattedDate = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    let accountBadge = '';
    if (isTransfer) {
      const from = t.from_account || (t.account === 'UPI' ? 'UPI' : 'Cash');
      const to = t.to_account || (from === 'UPI' ? 'Cash' : 'UPI');
      accountBadge = `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-brand-600 border border-brand-200 dark:border-brand-800">${from} → ${to}</span>`;
    } else {
      accountBadge = `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded ${isUPI ? 'badge-upi' : 'badge-cash'}">${t.account || 'UPI'}</span>`;
    }

    return `
      <div class="glass-panel tx-item rounded-xl p-3 sm:p-3.5 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 group">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center text-xs shrink-0 ${catMeta.bg}">
            <i class="fa-solid ${catMeta.icon}"></i>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h4 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">${this.escapeHTML(t.title)}</h4>
              ${accountBadge}
            </div>
            <div class="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
              <span class="font-medium text-slate-600 dark:text-slate-300">${t.category}</span>
              <span>•</span>
              <span>${formattedDate}</span>
              ${t.notes ? `<span class="truncate max-w-[120px] italic">(${this.escapeHTML(t.notes)})</span>` : ''}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <span class="text-xs sm:text-sm font-extrabold ${isTransfer ? 'text-brand-600 dark:text-brand-400' : isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}">
            ${isTransfer ? '⇄ ' : isIncome ? '+' : '-'}${this.formatCurrency(t.amount)}
          </span>
          <button onclick="window.app.deleteTransaction('${txId}')" title="Delete record" class="tx-action-btn w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition">
            <i class="fa-regular fa-trash-can text-xs"></i>
          </button>
        </div>
      </div>
    `;
  }

  getFilteredTransactions() {
    const { account, type, category, search, sort } = this.filters;

    return this.transactions
      .filter((t) => {
        if (account !== 'all' && t.account !== account && t.from_account !== account && t.to_account !== account) return false;
        if (type !== 'all' && t.type !== type) return false;
        if (category !== 'all' && t.category !== category) return false;

        if (search) {
          const inTitle = (t.title || '').toLowerCase().includes(search);
          const inNotes = (t.notes || '').toLowerCase().includes(search);
          const inCat = (t.category || '').toLowerCase().includes(search);
          if (!inTitle && !inNotes && !inCat) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sort === 'date-desc') return new Date(b.date) - new Date(a.date);
        if (sort === 'date-asc') return new Date(a.date) - new Date(b.date);
        if (sort === 'amount-desc') return b.amount - a.amount;
        if (sort === 'amount-asc') return a.amount - b.amount;
        return 0;
      });
  }

  // ==========================================
  // CHART.JS ANALYTICS
  // ==========================================
  initChart() {
    if (!this.expenseChartCanvas) return;
    const ctx = this.expenseChartCanvas.getContext('2d');
    this.chart = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.label}: ${this.formatCurrency(context.raw)}`
            }
          }
        },
        cutout: '72%'
      }
    });
  }

  renderChart() {
    if (!this.chart) return;

    let relevantTx = this.transactions.filter((t) => t.type === 'expense');
    if (this.chartFilterAccount !== 'all') {
      relevantTx = relevantTx.filter((t) => t.account === this.chartFilterAccount);
    }

    const catMap = {};
    let total = 0;
    relevantTx.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      catMap[tx.category] = (catMap[tx.category] || 0) + amt;
      total += amt;
    });

    const categories = Object.keys(catMap);
    const amounts = Object.values(catMap);

    if (this.chartCenterAmount) this.chartCenterAmount.textContent = this.formatCurrency(total);
    if (this.chartCategoryCount) this.chartCategoryCount.textContent = `${categories.length} Categories`;

    if (categories.length === 0) {
      if (this.noDataChart) this.noDataChart.classList.remove('hidden');
      if (this.chartCenterOverlay) this.chartCenterOverlay.classList.add('hidden');
      if (this.categoryLeaderboard) this.categoryLeaderboard.innerHTML = '';
      this.chart.data.labels = [];
      this.chart.data.datasets[0].data = [];
      this.chart.update();
      return;
    }

    if (this.noDataChart) this.noDataChart.classList.add('hidden');
    if (this.chartCenterOverlay) this.chartCenterOverlay.classList.remove('hidden');

    const colors = categories.map((cat) => {
      const meta = CATEGORIES.expense.find((c) => c.id === cat);
      return meta ? meta.color : '#6366f1';
    });

    this.chart.data.labels = categories;
    this.chart.data.datasets[0].data = amounts;
    this.chart.data.datasets[0].backgroundColor = colors;
    this.chart.update();

    const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    if (this.categoryLeaderboard) {
      this.categoryLeaderboard.innerHTML = sorted.map(([cat, amt]) => {
        const pct = total > 0 ? ((amt / total) * 100).toFixed(1) : 0;
        const meta = CATEGORIES.expense.find((c) => c.id === cat) || { icon: 'fa-tag', color: '#6366f1' };

        return `
          <div class="space-y-1">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <i class="fa-solid ${meta.icon}" style="color: ${meta.color}"></i> ${cat}
              </span>
              <span class="font-extrabold text-slate-900 dark:text-white">${this.formatCurrency(amt)} <span class="text-[10px] text-slate-400 font-normal">(${pct}%)</span></span>
            </div>
            <div class="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div class="h-full rounded-full" style="width: ${pct}%; background-color: ${meta.color}"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  setChartAccountFilter(account) {
    this.chartFilterAccount = account;
    this.sound.playPop();
    const active = 'px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white transition';
    const inactive = 'px-2.5 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition';
    if (this.chartFilterAll) this.chartFilterAll.className = account === 'all' ? active : inactive;
    if (this.chartFilterUPI) this.chartFilterUPI.className = account === 'UPI' ? active : inactive;
    if (this.chartFilterCash) this.chartFilterCash.className = account === 'Cash' ? active : inactive;
    this.renderChart();
  }

  setChartView(type) {
    if (this.chartType === type) return;
    this.chartType = type;
    this.sound.playPop();

    const active = 'px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white transition';
    const inactive = 'px-2.5 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition';
    if (this.chartViewDonut) this.chartViewDonut.className = type === 'doughnut' ? active : inactive;
    if (this.chartViewBar) this.chartViewBar.className = type === 'bar' ? active : inactive;

    if (this.chart) {
      this.chart.destroy();
      const ctx = this.expenseChartCanvas.getContext('2d');
      this.chart = new Chart(ctx, {
        type: type,
        data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          cutout: type === 'doughnut' ? '72%' : 0
        }
      });
      this.renderChart();
    }
  }

  exportToCSV() {
    if (this.transactions.length === 0) {
      this.showToast('No transactions to export yet.', 'info');
      return;
    }
    const headers = ['ID', 'Type', 'Account', 'Title', 'Amount', 'Currency', 'Category', 'Date', 'Notes'];
    const rows = this.transactions.map((t) => [
      `"${t._id || t.id}"`,
      `"${t.type}"`,
      `"${t.account || ''}"`,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.amount,
      `"${this.currency}"`,
      `"${t.category}"`,
      `"${new Date(t.date).toISOString().split('T')[0]}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `pockettrack_student_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.sound.playSuccess();
    this.showToast('CSV statement downloaded successfully! 📊', 'success');
  }

  // ==========================================
  // HELPERS
  // ==========================================
  setType(type) {
    if (this.txType) this.txType.value = type;
    if (type === 'expense') {
      if (this.btnTypeExpense) this.btnTypeExpense.className = 'py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 bg-rose-600 text-white shadow-sm shadow-rose-600/30';
      if (this.btnTypeIncome) this.btnTypeIncome.className = 'py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
      if (this.submitBtn) this.submitBtn.className = 'w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white shadow-lg shadow-rose-600/25 active:scale-[0.99] transition flex items-center justify-center gap-2';
      if (this.submitBtnText) this.submitBtnText.textContent = 'Add Expense';
    } else {
      if (this.btnTypeIncome) this.btnTypeIncome.className = 'py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 bg-emerald-600 text-white shadow-sm shadow-emerald-600/30';
      if (this.btnTypeExpense) this.btnTypeExpense.className = 'py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
      if (this.submitBtn) this.submitBtn.className = 'w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-lg shadow-emerald-600/25 active:scale-[0.99] transition flex items-center justify-center gap-2';
      if (this.submitBtnText) this.submitBtnText.textContent = 'Add Pocket Money';
    }
    this.populateCategoryOptions(type);
  }

  setAccount(account) {
    if (this.txAccount) this.txAccount.value = account;
    const upiRadio = document.querySelector('input[name="txAccountRadio"][value="UPI"]');
    const cashRadio = document.querySelector('input[name="txAccountRadio"][value="Cash"]');

    if (account === 'UPI') {
      if (upiRadio) upiRadio.checked = true;
      if (this.accountLabelUPI) this.accountLabelUPI.className = 'cursor-pointer border-2 border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 rounded-xl p-3 flex items-center gap-3 transition shadow-sm';
      if (this.accountLabelCash) this.accountLabelCash.className = 'cursor-pointer border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl p-3 flex items-center gap-3 transition';
    } else {
      if (cashRadio) cashRadio.checked = true;
      if (this.accountLabelCash) this.accountLabelCash.className = 'cursor-pointer border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-xl p-3 flex items-center gap-3 transition shadow-sm';
      if (this.accountLabelUPI) this.accountLabelUPI.className = 'cursor-pointer border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl p-3 flex items-center gap-3 transition';
    }
  }

  applyPreset({ title, amount, cat, acc, type }) {
    this.setType(type);
    this.setAccount(acc);
    if (this.txTitle) this.txTitle.value = title;
    if (this.txAmount) this.txAmount.value = amount;
    if (this.txCategory) this.txCategory.value = cat;
    this.showToast(`Preset: ${title} (${this.currency}${amount})`, 'info');
  }

  populateCategoryOptions(type) {
    if (!this.txCategory) return;
    const list = CATEGORIES[type] || [];
    this.txCategory.innerHTML = list.map((c) => `<option value="${c.id}">${c.id}</option>`).join('');
  }

  populateFilterCategories() {
    if (!this.filterCategory) return;
    let options = '<option value="all">All Categories</option>';
    const all = [...CATEGORIES.expense, ...CATEGORIES.income];
    const unique = Array.from(new Set(all.map((c) => c.id)));
    unique.forEach((cat) => {
      options += `<option value="${cat}">${cat}</option>`;
    });
    this.filterCategory.innerHTML = options;
  }

  setHistoryAccountFilter(account) {
    this.filters.account = account;
    this.sound.playPop();
    const active = 'px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white transition';
    const inactive = 'px-2.5 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition';
    if (this.tabFilterAll) this.tabFilterAll.className = account === 'all' ? active : inactive;
    if (this.tabFilterUPI) this.tabFilterUPI.className = (account === 'UPI' ? active : inactive) + ' flex items-center gap-1';
    if (this.tabFilterCash) this.tabFilterCash.className = (account === 'Cash' ? active : inactive) + ' flex items-center gap-1';
    this.renderHistoryList();
  }

  setDefaultDate() {
    if (this.txDate && !this.txDate.value) {
      this.txDate.value = new Date().toISOString().split('T')[0];
    }
  }

  updateHeaderDate() {
    if (this.headerDateDisplay) {
      this.headerDateDisplay.textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }
  }

  initTheme() {
    if (this.theme === 'dark') {
      document.documentElement.classList.add('dark');
      if (this.themeIcon) this.themeIcon.className = 'fa-solid fa-sun text-amber-400 text-xs';
    } else {
      document.documentElement.classList.remove('dark');
      if (this.themeIcon) this.themeIcon.className = 'fa-solid fa-moon text-slate-600 text-xs';
    }
  }

  toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    this.theme = isDark ? 'light' : 'dark';
    localStorage.setItem('pt_theme', this.theme);
    this.initTheme();
    this.renderChart();
    this.sound.playPop();
    this.showToast(`Switched to ${this.theme} mode`, 'info');
  }

  // ==========================================
  // PWA APP INSTALLATION
  // ==========================================
  initPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      if (this.nativeInstallPromptBox) this.nativeInstallPromptBox.classList.remove('hidden');
      if (this.installAppBtn) {
        this.installAppBtn.classList.remove('hidden');
        this.installAppBtn.classList.add('animate-pulse');
      }
    });

    window.addEventListener('appinstalled', () => {
      this.deferredInstallPrompt = null;
      this.showToast('PocketTrack installed as an App! 🎉', 'success');
      if (this.installAppBtn) {
        this.installAppBtn.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-300"></i> <span class="hidden sm:inline">Installed</span>';
        this.installAppBtn.classList.remove('animate-pulse');
      }
      this.closeInstallModal();
    });

    if (this.installAppBtn) {
      this.installAppBtn.addEventListener('click', () => {
        if (this.deferredInstallPrompt) {
          this.handleNativeInstall();
        } else {
          this.openInstallModal();
        }
      });
    }

    if (this.triggerNativeInstallBtn) {
      this.triggerNativeInstallBtn.addEventListener('click', () => this.handleNativeInstall());
    }

    if (this.closeInstallModalBtn) this.closeInstallModalBtn.addEventListener('click', () => this.closeInstallModal());
    if (this.dismissInstallModalBtn) this.dismissInstallModalBtn.addEventListener('click', () => this.closeInstallModal());

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      });
    }

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone && this.installAppBtn) {
      this.installAppBtn.innerHTML = '<i class="fa-solid fa-mobile-screen text-emerald-300"></i> <span class="hidden sm:inline">App Active</span>';
      this.installAppBtn.classList.remove('animate-pulse');
    }
  }

  openInstallModal() {
    this.sound.playPop();
    if (this.installModal) {
      this.installModal.classList.remove('hidden');
      setTimeout(() => {
        if (this.installModalContent) {
          this.installModalContent.classList.remove('scale-95', 'opacity-0');
          this.installModalContent.classList.add('scale-100', 'opacity-100');
        }
      }, 10);
    }
  }

  closeInstallModal() {
    if (this.installModalContent) {
      this.installModalContent.classList.remove('scale-100', 'opacity-100');
      this.installModalContent.classList.add('scale-95', 'opacity-0');
    }
    setTimeout(() => {
      if (this.installModal) this.installModal.classList.add('hidden');
    }, 200);
  }

  async handleNativeInstall() {
    if (this.deferredInstallPrompt) {
      this.deferredInstallPrompt.prompt();
      const choice = await this.deferredInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        this.sound.playSuccess();
        this.showToast('PocketTrack app installed! 🚀', 'success');
      }
      this.deferredInstallPrompt = null;
      this.closeInstallModal();
    } else {
      this.openInstallModal();
    }
  }

  // ==========================================
  // UTILITIES
  // ==========================================
  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, (tag) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
  }

  showToast(message, type = 'info') {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast-item pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold text-white transition-all`;

    let icon = 'fa-info-circle';
    let bg = 'bg-slate-800';

    if (type === 'success') {
      icon = 'fa-circle-check';
      bg = 'bg-emerald-600 shadow-emerald-600/30';
    } else if (type === 'error') {
      icon = 'fa-circle-exclamation';
      bg = 'bg-rose-600 shadow-rose-600/30';
    } else if (type === 'info') {
      icon = 'fa-bell';
      bg = 'bg-indigo-600 shadow-indigo-600/30';
    }

    toast.className += ` ${bg}`;
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-leave');
      setTimeout(() => toast.remove(), 250);
    }, 3000);
  }
}

// Bootstrap Application
document.addEventListener('DOMContentLoaded', () => {
  window.app = new StudentExpenseApp();
});
