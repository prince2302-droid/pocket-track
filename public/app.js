/**
 * PocketTrack — Student Multi-Account Expense Tracker
 * Frontend Application Controller
 * Connects to Express + MongoDB Atlas REST Backend
 * Features: Dual Wallets (UPI & Cash), Visual Analytics, Presets, Confetti & Sounds
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
      osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.09);
    } catch (_) {}
  }

  playSuccess() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.06, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.22);
      });
    } catch (_) {}
  }
}

// ==========================================
// Main Application Class
// ==========================================
class StudentExpenseApp {
  constructor() {
    this.transactions = [];
    this.summary = null;
    this.currency = localStorage.getItem('pt_currency') || '₹';
    this.theme = localStorage.getItem('pt_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    this.sound = new SoundFX();
    
    this.filters = {
      account: 'all',
      type: 'all',
      category: 'all',
      sort: 'date-desc',
      search: ''
    };

    this.chartFilterAccount = 'all';
    this.chartType = 'doughnut';
    this.chart = null;

    this.initDOMElements();
    this.initTheme();
    this.populateCategoryOptions('expense');
    this.populateFilterCategories();
    this.bindEvents();
    this.setDefaultDate();
    this.initChart();

    // Initial Load from Cloud API
    this.checkCloudStatus();
    this.fetchTransactions();
  }

  initDOMElements() {
    // Stats Cards
    this.statUpiBalance = document.getElementById('statUpiBalance');
    this.statUpiCount = document.getElementById('statUpiCount');
    this.statCashBalance = document.getElementById('statCashBalance');
    this.statCashCount = document.getElementById('statCashCount');
    this.statTotalPocketMoney = document.getElementById('statTotalPocketMoney');
    this.statPocketMoneyCount = document.getElementById('statPocketMoneyCount');
    this.statTotalSpent = document.getElementById('statTotalSpent');
    this.statSpendRatioBadge = document.getElementById('statSpendRatioBadge');
    this.statSpentBar = document.getElementById('statSpentBar');
    this.statRemainingPocketMoney = document.getElementById('statRemainingPocketMoney');

    // Chart & Analytics
    this.chartCategoryCount = document.getElementById('chartCategoryCount');
    this.chartCenterOverlay = document.getElementById('chartCenterOverlay');
    this.chartCenterAmount = document.getElementById('chartCenterAmount');
    this.chartCenterSubtext = document.getElementById('chartCenterSubtext');
    this.categoryLeaderboard = document.getElementById('categoryLeaderboard');
    this.noDataChart = document.getElementById('noDataChart');
    this.chartFilterAll = document.getElementById('chartFilterAll');
    this.chartFilterUPI = document.getElementById('chartFilterUPI');
    this.chartFilterCash = document.getElementById('chartFilterCash');
    this.chartViewDonut = document.getElementById('chartViewDonut');
    this.chartViewBar = document.getElementById('chartViewBar');

    // Form
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

    // History & Filters
    this.transactionList = document.getElementById('transactionList');
    this.emptyState = document.getElementById('emptyState');
    this.txCountBadge = document.getElementById('txCountBadge');
    this.searchInput = document.getElementById('searchInput');
    this.clearSearchBtn = document.getElementById('clearSearchBtn');
    this.filterCategory = document.getElementById('filterCategory');
    this.filterType = document.getElementById('filterType');
    this.filterSort = document.getElementById('filterSort');
    this.tabFilterAll = document.getElementById('tabFilterAll');
    this.tabFilterUPI = document.getElementById('tabFilterUPI');
    this.tabFilterCash = document.getElementById('tabFilterCash');

    // Transfer Modal
    this.transferModal = document.getElementById('transferModal');
    this.transferModalContent = document.getElementById('transferModalContent');
    this.openTransferModalBtn = document.getElementById('openTransferModalBtn');
    this.closeTransferModalBtn = document.getElementById('closeTransferModalBtn');
    this.cancelTransferBtn = document.getElementById('cancelTransferBtn');
    this.transferForm = document.getElementById('transferForm');
    this.transferFrom = document.getElementById('transferFrom');
    this.transferTo = document.getElementById('transferTo');
    this.transferAmount = document.getElementById('transferAmount');
    this.transferNotes = document.getElementById('transferNotes');
    this.transferCurrencyPrefix = document.getElementById('transferCurrencyPrefix');

    // Header & Actions
    this.currencySelector = document.getElementById('currencySelector');
    this.themeToggleBtn = document.getElementById('themeToggleBtn');
    this.themeIcon = document.getElementById('themeIcon');
    this.exportCsvBtn = document.getElementById('exportCsvBtn');
    this.loadDemoBtn = document.getElementById('loadDemoBtn');
    this.emptyLoadDemoBtn = document.getElementById('emptyLoadDemoBtn');
    this.cloudStatusBadge = document.getElementById('cloudStatusBadge');
    this.cloudStatusDot = document.getElementById('cloudStatusDot');
    this.cloudStatusText = document.getElementById('cloudStatusText');
    this.toastContainer = document.getElementById('toastContainer');
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

  setDefaultDate() {
    if (this.txDate) {
      this.txDate.value = new Date().toISOString().split('T')[0];
    }
  }

  bindEvents() {
    // Theme & Currency
    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    }

    if (this.currencySelector) {
      this.currencySelector.value = this.currency;
      if (this.amountSymbolPrefix) this.amountSymbolPrefix.textContent = this.currency;
      if (this.transferCurrencyPrefix) this.transferCurrencyPrefix.textContent = this.currency;
      this.currencySelector.addEventListener('change', (e) => {
        this.currency = e.target.value;
        localStorage.setItem('pt_currency', this.currency);
        if (this.amountSymbolPrefix) this.amountSymbolPrefix.textContent = this.currency;
        if (this.transferCurrencyPrefix) this.transferCurrencyPrefix.textContent = this.currency;
        this.render();
        this.sound.playPop();
        this.showToast(`Currency set to ${this.currency}`, 'info');
      });
    }

    // Type Selector (Spent vs Pocket Money)
    if (this.btnTypeExpense) this.btnTypeExpense.addEventListener('click', () => { this.setType('expense'); this.sound.playPop(); });
    if (this.btnTypeIncome) this.btnTypeIncome.addEventListener('click', () => { this.setType('income'); this.sound.playPop(); });

    // Account Radios (UPI vs Cash)
    document.querySelectorAll('input[name="txAccountRadio"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        this.setAccount(e.target.value);
        this.sound.playPop();
      });
    });

    // Campus Quick Presets
    document.querySelectorAll('.preset-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const title = chip.getAttribute('data-title');
        const amount = chip.getAttribute('data-amount');
        const cat = chip.getAttribute('data-cat');
        const acc = chip.getAttribute('data-acc');
        const type = chip.getAttribute('data-type');

        this.applyPreset({ title, amount, cat, acc, type });
        this.sound.playPop();
      });
    });

    // Form Submit
    if (this.transactionForm) {
      this.transactionForm.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    // Demo Data Generators
    if (this.loadDemoBtn) {
      this.loadDemoBtn.addEventListener('click', () => this.loadDemoData());
    }
    if (this.emptyLoadDemoBtn) {
      this.emptyLoadDemoBtn.addEventListener('click', () => this.loadDemoData());
    }

    // Transfer Modal
    if (this.openTransferModalBtn) this.openTransferModalBtn.addEventListener('click', () => this.openTransferModal());
    if (this.closeTransferModalBtn) this.closeTransferModalBtn.addEventListener('click', () => this.closeTransferModal());
    if (this.cancelTransferBtn) this.cancelTransferBtn.addEventListener('click', () => this.closeTransferModal());
    if (this.transferModal) {
      this.transferModal.addEventListener('click', (e) => {
        if (e.target === this.transferModal) this.closeTransferModal();
      });
    }
    if (this.transferForm) {
      this.transferForm.addEventListener('submit', (e) => this.handleTransferSubmit(e));
    }

    // History Account Filter Tabs
    if (this.tabFilterAll) this.tabFilterAll.addEventListener('click', () => this.setHistoryAccountFilter('all'));
    if (this.tabFilterUPI) this.tabFilterUPI.addEventListener('click', () => this.setHistoryAccountFilter('UPI'));
    if (this.tabFilterCash) this.tabFilterCash.addEventListener('click', () => this.setHistoryAccountFilter('Cash'));

    // Search & Filter Dropdowns
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value.trim().toLowerCase();
        if (this.clearSearchBtn) this.clearSearchBtn.classList.toggle('hidden', !e.target.value);
        this.renderHistoryList();
      });
    }

    if (this.clearSearchBtn) {
      this.clearSearchBtn.addEventListener('click', () => {
        this.searchInput.value = '';
        this.filters.search = '';
        this.clearSearchBtn.classList.add('hidden');
        this.renderHistoryList();
        this.searchInput.focus();
      });
    }

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

    if (this.exportCsvBtn) {
      this.exportCsvBtn.addEventListener('click', () => this.exportToCSV());
    }

    // Chart Account Filters
    if (this.chartFilterAll) this.chartFilterAll.addEventListener('click', () => this.setChartAccountFilter('all'));
    if (this.chartFilterUPI) this.chartFilterUPI.addEventListener('click', () => this.setChartAccountFilter('UPI'));
    if (this.chartFilterCash) this.chartFilterCash.addEventListener('click', () => this.setChartAccountFilter('Cash'));

    // Chart Type View Toggles
    if (this.chartViewDonut) this.chartViewDonut.addEventListener('click', () => this.setChartView('doughnut'));
    if (this.chartViewBar) this.chartViewBar.addEventListener('click', () => this.setChartView('bar'));

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (this.searchInput) this.searchInput.focus();
      } else if (e.key === 'Escape') {
        if (!this.transferModal.classList.contains('hidden')) {
          this.closeTransferModal();
        }
      }
    });
  }

  applyPreset({ title, amount, cat, acc, type }) {
    this.setType(type);
    this.setAccount(acc);
    if (this.txTitle) this.txTitle.value = title;
    if (this.txAmount) this.txAmount.value = amount;
    if (this.txCategory) this.txCategory.value = cat;

    // Pulse feedback on form
    if (this.transactionForm) {
      this.transactionForm.classList.add('ring-2', 'ring-brand-500/50');
      setTimeout(() => this.transactionForm.classList.remove('ring-2', 'ring-brand-500/50'), 400);
    }
    this.showToast(`Preset filled: ${title} (${this.currency}${amount})`, 'info');
  }

  setChartView(type) {
    if (this.chartType === type) return;
    this.chartType = type;
    this.sound.playPop();

    const activeClass = 'px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white transition';
    const inactiveClass = 'px-2.5 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition';

    if (this.chartViewDonut) this.chartViewDonut.className = type === 'doughnut' ? activeClass : inactiveClass;
    if (this.chartViewBar) this.chartViewBar.className = type === 'bar' ? activeClass : inactiveClass;

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    this.initChart();
    this.renderChart();
  }

  exportToCSV() {
    if (this.transactions.length === 0) {
      this.showToast('No transactions to export yet.', 'info');
      return;
    }

    const headers = ['ID', 'Type', 'Account', 'Title', 'Amount', 'Currency', 'Category', 'Date', 'Notes'];
    const rows = this.transactions.map((t) => [
      `"${t._id}"`,
      `"${t.type}"`,
      `"${t.account}"`,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.amount,
      `"${this.currency}"`,
      `"${t.category}"`,
      `"${new Date(t.date).toISOString().split('T')[0]}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pockettrack_student_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.sound.playSuccess();
    this.showToast('CSV statement downloaded successfully! 📊', 'success');
  }

  setType(type) {
    this.txType.value = type;
    if (type === 'expense') {
      this.btnTypeExpense.className = 'py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 bg-rose-600 text-white shadow-sm shadow-rose-600/30';
      this.btnTypeIncome.className = 'py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
      this.submitBtn.className = 'w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-rose-600 via-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white shadow-lg shadow-rose-600/25 active:scale-[0.99] transition flex items-center justify-center gap-2';
      this.submitBtnText.textContent = 'Add Expense';
    } else {
      this.btnTypeIncome.className = 'py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 bg-emerald-600 text-white shadow-sm shadow-emerald-600/30';
      this.btnTypeExpense.className = 'py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
      this.submitBtn.className = 'w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 via-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-lg shadow-emerald-600/25 active:scale-[0.99] transition flex items-center justify-center gap-2';
      this.submitBtnText.textContent = 'Add Pocket Money';
    }
    this.populateCategoryOptions(type);
  }

  setAccount(account) {
    this.txAccount.value = account;
    const upiRadio = document.querySelector('input[name="txAccountRadio"][value="UPI"]');
    const cashRadio = document.querySelector('input[name="txAccountRadio"][value="Cash"]');

    if (account === 'UPI') {
      if (upiRadio) upiRadio.checked = true;
      this.accountLabelUPI.className = 'cursor-pointer border-2 border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 rounded-xl p-3 flex items-center gap-3 transition shadow-sm';
      this.accountLabelCash.className = 'cursor-pointer border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl p-3 flex items-center gap-3 transition';
    } else {
      if (cashRadio) cashRadio.checked = true;
      this.accountLabelCash.className = 'cursor-pointer border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-xl p-3 flex items-center gap-3 transition shadow-sm';
      this.accountLabelUPI.className = 'cursor-pointer border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl p-3 flex items-center gap-3 transition';
    }
  }

  populateCategoryOptions(type) {
    const list = CATEGORIES[type] || [];
    this.txCategory.innerHTML = list.map((c) => `<option value="${c.id}">${c.id}</option>`).join('');
  }

  populateFilterCategories() {
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

    const activeClass = 'px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white transition';
    const inactiveClass = 'px-2.5 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition';

    this.tabFilterAll.className = account === 'all' ? activeClass : inactiveClass;
    this.tabFilterUPI.className = (account === 'UPI' ? activeClass : inactiveClass) + ' flex items-center gap-1';
    this.tabFilterCash.className = (account === 'Cash' ? activeClass : inactiveClass) + ' flex items-center gap-1';

    this.renderHistoryList();
  }

  setChartAccountFilter(account) {
    this.chartFilterAccount = account;
    this.sound.playPop();

    const activeClass = 'px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white transition';
    const inactiveClass = 'px-2.5 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition';

    this.chartFilterAll.className = account === 'all' ? activeClass : inactiveClass;
    this.chartFilterUPI.className = account === 'UPI' ? activeClass : inactiveClass;
    this.chartFilterCash.className = account === 'Cash' ? activeClass : inactiveClass;

    this.renderChart();
  }

  // ==========================================
  // BACKEND CLOUD API CALLS
  // ==========================================

  async checkCloudStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.connected) {
        this.cloudStatusBadge.className = 'flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 transition';
        if (this.cloudStatusDot) {
          this.cloudStatusDot.className = 'w-2 h-2 rounded-full bg-emerald-500 live-indicator';
        }
        if (this.cloudStatusText) {
          this.cloudStatusText.textContent = 'MongoDB Atlas Cloud';
        }
      } else {
        this.cloudStatusBadge.className = 'flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80 transition';
        if (this.cloudStatusDot) {
          this.cloudStatusDot.className = 'w-2 h-2 rounded-full bg-amber-500 live-indicator';
        }
        if (this.cloudStatusText) {
          this.cloudStatusText.textContent = 'Local Standalone Mode';
        }
      }
    } catch (e) {
      console.warn('Backend status check failed', e);
    }
  }

  calculateLocalSummary(transactions) {
    let upiBalance = 0;
    let cashBalance = 0;
    let totalPocketMoney = 0;
    let totalSpent = 0;
    const categoryMap = {};

    transactions.forEach((tx) => {
      const amt = Number(tx.amount);
      if (tx.type === 'income') {
        totalPocketMoney += amt;
        if (tx.account === 'UPI') upiBalance += amt;
        else if (tx.account === 'Cash') cashBalance += amt;
      } else if (tx.type === 'expense') {
        totalSpent += amt;
        if (tx.account === 'UPI') upiBalance -= amt;
        else if (tx.account === 'Cash') cashBalance -= amt;
        categoryMap[tx.category] = (categoryMap[tx.category] || 0) + amt;
      }
    });

    return {
      upiBalance,
      cashBalance,
      totalBalance: upiBalance + cashBalance,
      totalPocketMoney,
      totalSpent,
      remainingPocketMoney: totalPocketMoney - totalSpent,
      spendRatio: totalPocketMoney > 0 ? ((totalSpent / totalPocketMoney) * 100).toFixed(1) : 0,
      categoryBreakdown: categoryMap
    };
  }

  async fetchTransactions() {
    try {
      const res = await fetch('/api/transactions');
      const data = await res.json();
      if (data.success) {
        this.transactions = data.transactions || [];
        this.summary = data.summary;
        this.render();
      }
    } catch (e) {
      console.warn('Backend not detected, falling back to local storage', e);
      const saved = localStorage.getItem('pt_local_txs');
      if (saved) {
        this.transactions = JSON.parse(saved);
      } else {
        this.transactions = [];
      }
      this.summary = this.calculateLocalSummary(this.transactions);
      this.render();
    }
  }

  async loadDemoData() {
    this.sound.playPop();
    const demoItems = [
      { title: 'Monthly Pocket Money from Parents', amount: 5000, type: 'income', account: 'UPI', category: 'Pocket Money', notes: 'Received via GPay' },
      { title: 'Campus ATM Cash Withdrawal', amount: 1500, type: 'expense', account: 'UPI', category: 'Transfer', notes: 'ATM withdraw' },
      { title: 'Cash Deposit in Wallet', amount: 1500, type: 'income', account: 'Cash', category: 'Transfer', notes: 'Cash withdrawn for physical expenses' },
      { title: 'College Semester Textbooks & Notes', amount: 650, type: 'expense', account: 'UPI', category: 'College & Academics', notes: 'Engineering books' },
      { title: 'Canteen Lunch & Cold Coffee', amount: 120, type: 'expense', account: 'Cash', category: 'Food & Canteen', notes: 'Canteen meal' },
      { title: 'Monthly Metro Smartcard Recharge', amount: 400, type: 'expense', account: 'UPI', category: 'Transport & Metro', notes: 'Daily campus commute' },
      { title: 'Weekend Movie & Popcorn with Friends', amount: 350, type: 'expense', account: 'UPI', category: 'Entertainment & Hangouts', notes: 'Multiplex ticket' },
      { title: 'Lab Assignment Printout & Xerox', amount: 45, type: 'expense', account: 'Cash', category: 'College & Academics', notes: 'Stationery shop' }
    ];

    try {
      for (const item of demoItems) {
        await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...item, date: new Date() })
        });
      }
      await this.fetchTransactions();
      this.sound.playSuccess();
      confetti({ particleCount: 65, spread: 80, origin: { y: 0.6 } });
      this.showToast('Sample student finances loaded successfully! 🎉', 'success');
    } catch (err) {
      console.warn('Failed to post demo data to cloud, using local fallback:', err);
      this.transactions = demoItems.map((d, i) => ({
        _id: 'demo-' + Date.now() + '-' + i,
        ...d,
        date: new Date()
      }));
      localStorage.setItem('pt_local_txs', JSON.stringify(this.transactions));
      this.summary = this.calculateLocalSummary(this.transactions);
      this.render();
      this.sound.playSuccess();
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
      this.showToast('Sample student data loaded locally! 🚀', 'success');
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

    if (!title) {
      this.showToast('Please enter a description.', 'error');
      this.txTitle.focus();
      return;
    }

    if (isNaN(amount) || amount <= 0) {
      this.showToast('Please enter a valid amount.', 'error');
      this.txAmount.focus();
      return;
    }

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, amount, type, account, category, date, notes })
      });

      const data = await res.json();
      if (data.success) {
        this.transactions.unshift(data.transaction);
        this.summary = data.summary;
        this.resetForm();
        this.render();

        const toastMsg = type === 'income' ? `Pocket Money added to ${account}! 🎉` : `Expense logged from ${account}`;
        this.showToast(toastMsg, 'success');

        if (type === 'income') {
          this.sound.playSuccess();
          confetti({ particleCount: 50, spread: 65, origin: { y: 0.7 } });
        } else {
          this.sound.playPop();
        }
      } else {
        this.showToast(data.error || 'Failed to save transaction', 'error');
      }
    } catch (err) {
      console.warn('Network error, saving locally:', err);
      const localTx = {
        _id: 'local-' + Date.now(),
        title,
        amount,
        type,
        account,
        category,
        date: date ? new Date(date) : new Date(),
        notes
      };
      this.transactions.unshift(localTx);
      localStorage.setItem('pt_local_txs', JSON.stringify(this.transactions));
      this.summary = this.calculateLocalSummary(this.transactions);
      this.resetForm();
      this.render();
      this.showToast(type === 'income' ? `Pocket Money logged to ${account}!` : `Expense logged from ${account}`, 'success');
      if (type === 'income') {
        this.sound.playSuccess();
        confetti({ particleCount: 50, spread: 65, origin: { y: 0.7 } });
      } else {
        this.sound.playPop();
      }
    }
  }

  resetForm() {
    this.txTitle.value = '';
    this.txAmount.value = '';
    this.txNotes.value = '';
    this.setDefaultDate();
    this.setType('expense');
  }

  async deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this record?')) return;
    this.sound.playPop();

    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        this.transactions = this.transactions.filter((t) => t._id !== id);
        this.summary = data.summary;
        this.render();
        this.showToast('Transaction deleted.', 'info');
      } else {
        this.showToast(data.error || 'Failed to delete transaction', 'error');
      }
    } catch (err) {
      console.warn('Network error, deleting locally:', err);
      this.transactions = this.transactions.filter((t) => t._id !== id);
      localStorage.setItem('pt_local_txs', JSON.stringify(this.transactions));
      this.summary = this.calculateLocalSummary(this.transactions);
      this.render();
      this.showToast('Transaction deleted.', 'info');
    }
  }

  // --- Quick Transfer Modal ---
  openTransferModal() {
    this.sound.playPop();
    this.transferModal.classList.remove('hidden');
    setTimeout(() => {
      this.transferModalContent.classList.remove('scale-95', 'opacity-0');
      this.transferModalContent.classList.add('scale-100', 'opacity-100');
    }, 10);
    this.transferAmount.focus();
  }

  closeTransferModal() {
    this.transferModalContent.classList.remove('scale-100', 'opacity-100');
    this.transferModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
      this.transferModal.classList.add('hidden');
      this.transferForm.reset();
    }, 200);
  }

  async handleTransferSubmit(e) {
    e.preventDefault();
    const fromAccount = this.transferFrom.value;
    const toAccount = this.transferTo.value;
    const amount = parseFloat(this.transferAmount.value);
    const notes = this.transferNotes.value.trim();

    if (!amount || amount <= 0) {
      this.showToast('Please enter a valid transfer amount.', 'error');
      return;
    }

    if (fromAccount === toAccount) {
      this.showToast('From and To accounts must be different.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/transactions/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromAccount, toAccount, amount, notes })
      });

      const data = await res.json();
      if (data.success) {
        this.closeTransferModal();
        this.fetchTransactions();
        this.sound.playSuccess();
        this.showToast(`Transferred ${this.formatCurrency(amount)} from ${fromAccount} to ${toAccount} 🔄`, 'success');
      } else {
        this.showToast(data.error || 'Transfer failed.', 'error');
      }
    } catch (err) {
      console.warn('Network error, executing transfer locally:', err);
      const deb = {
        _id: 'local-' + Date.now() + '-1',
        title: `Transfer to ${toAccount}`,
        amount,
        type: 'expense',
        account: fromAccount,
        category: 'Transfer',
        date: new Date(),
        notes: notes || `Transfer from ${fromAccount} to ${toAccount}`
      };
      const cred = {
        _id: 'local-' + Date.now() + '-2',
        title: `Transfer from ${fromAccount}`,
        amount,
        type: 'income',
        account: toAccount,
        category: 'Transfer',
        date: new Date(),
        notes: notes || `Transfer from ${fromAccount} to ${toAccount}`
      };
      this.transactions.unshift(deb, cred);
      localStorage.setItem('pt_local_txs', JSON.stringify(this.transactions));
      this.summary = this.calculateLocalSummary(this.transactions);
      this.closeTransferModal();
      this.render();
      this.sound.playSuccess();
      this.showToast(`Transferred ${this.formatCurrency(amount)} from ${fromAccount} to ${toAccount} 🔄`, 'success');
    }
  }

  formatCurrency(val) {
    const formatted = Math.abs(Number(val) || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
    return `${this.currency}${formatted}`;
  }

  // ==========================================
  // RENDERING PIPELINE
  // ==========================================

  render() {
    this.renderDashboardStats();
    this.renderChart();
    this.renderHistoryList();
  }

  renderDashboardStats() {
    if (!this.summary) return;

    const { upiBalance, cashBalance, totalPocketMoney, totalSpent, remainingPocketMoney, spendRatio } = this.summary;

    // UPI & Cash
    this.statUpiBalance.textContent = (upiBalance < 0 ? '-' : '') + this.formatCurrency(upiBalance);
    this.statCashBalance.textContent = (cashBalance < 0 ? '-' : '') + this.formatCurrency(cashBalance);

    const upiCount = this.transactions.filter((t) => t.account === 'UPI').length;
    const cashCount = this.transactions.filter((t) => t.account === 'Cash').length;
    const pocketMoneyCount = this.transactions.filter((t) => t.type === 'income').length;

    this.statUpiCount.textContent = `${upiCount} record${upiCount === 1 ? '' : 's'}`;
    this.statCashCount.textContent = `${cashCount} record${cashCount === 1 ? '' : 's'}`;
    this.statPocketMoneyCount.textContent = `${pocketMoneyCount} deposit${pocketMoneyCount === 1 ? '' : 's'}`;

    // Pocket Money & Spent
    this.statTotalPocketMoney.textContent = this.formatCurrency(totalPocketMoney);
    this.statTotalSpent.textContent = this.formatCurrency(totalSpent);

    this.statSpendRatioBadge.textContent = `${spendRatio}% Spent`;
    this.statSpentBar.style.width = `${Math.min(100, Math.max(0, spendRatio))}%`;

    if (remainingPocketMoney >= 0) {
      this.statRemainingPocketMoney.textContent = `${this.formatCurrency(remainingPocketMoney)} remaining pocket money`;
      this.statRemainingPocketMoney.className = 'text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 truncate font-semibold';
    } else {
      this.statRemainingPocketMoney.textContent = `Deficit of ${this.formatCurrency(Math.abs(remainingPocketMoney))}! Over budget`;
      this.statRemainingPocketMoney.className = 'text-[11px] text-rose-600 dark:text-rose-400 mt-2 truncate font-semibold';
    }
  }

  // --- Visual Analytics Chart & Leaderboard ---
  initChart() {
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)';
    const ctx = document.getElementById('categoryChart').getContext('2d');
    const isBar = this.chartType === 'bar';

    const config = {
      type: this.chartType,
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            backgroundColor: [],
            borderWidth: isBar ? 0 : 2,
            borderColor: isDark ? '#0f172a' : '#ffffff',
            borderRadius: isBar ? 6 : 0,
            hoverOffset: isBar ? 0 : 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: isBar ? 'y' : 'x',
        cutout: isBar ? undefined : '72%',
        onClick: (e, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const clickedCat = this.chart.data.labels[index];
            if (clickedCat) {
              this.filterByCategory(clickedCat);
            }
          }
        },
        plugins: {
          legend: {
            display: !isBar,
            position: 'bottom',
            labels: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 10, weight: '500' },
              boxWidth: 8,
              boxHeight: 8,
              padding: 8,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            titleColor: isDark ? '#f8fafc' : '#0f172a',
            bodyColor: isDark ? '#cbd5e1' : '#334155',
            borderColor: isDark ? '#334155' : '#e2e8f0',
            borderWidth: 1,
            padding: 9,
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return ` ${label}: ${this.formatCurrency(value)} (${pct}%)`;
              }
            }
          }
        }
      }
    };

    if (isBar) {
      config.options.scales = {
        x: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 10 },
            callback: (v) => `${this.currency}${v}`
          }
        },
        y: {
          grid: { display: false },
          ticks: {
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' }
          }
        }
      };
    }

    this.chart = new Chart(ctx, config);
  }

  renderChart() {
    if (!this.chart) return;

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const borderColor = isDark ? '#0f172a' : '#ffffff';
    const isDoughnut = this.chartType === 'doughnut';

    // Filter expenses based on chart account filter (All / UPI / Cash)
    const expenseTxs = this.transactions.filter((t) => {
      if (t.type !== 'expense') return false;
      if (this.chartFilterAccount !== 'all' && t.account !== this.chartFilterAccount) return false;
      return true;
    });

    const categoryMap = {};
    let totalExpense = 0;

    expenseTxs.forEach((t) => {
      const amt = Number(t.amount);
      categoryMap[t.category] = (categoryMap[t.category] || 0) + amt;
      totalExpense += amt;
    });

    const sorted = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map((s) => s[0]);
    const data = sorted.map((s) => s[1]);

    this.chartCategoryCount.textContent = `${labels.length} Categories`;

    if (labels.length === 0) {
      this.noDataChart.classList.remove('hidden');
      this.chartCenterOverlay.classList.add('hidden');
      document.getElementById('categoryChart').classList.add('opacity-0');
      this.categoryLeaderboard.innerHTML = `
        <div class="py-8 text-center text-slate-400">
          <i class="fa-solid fa-receipt text-2xl mb-1.5 text-slate-300 dark:text-slate-700"></i>
          <p class="text-xs font-medium">No expenses logged for this view.</p>
        </div>
      `;
    } else {
      this.noDataChart.classList.add('hidden');
      document.getElementById('categoryChart').classList.remove('opacity-0');

      if (isDoughnut) {
        this.chartCenterOverlay.classList.remove('hidden');
        this.chartCenterAmount.textContent = this.formatCurrency(totalExpense);
        this.chartCenterSubtext.textContent = this.chartFilterAccount === 'all' ? 'all wallets' : `${this.chartFilterAccount} only`;
      } else {
        this.chartCenterOverlay.classList.add('hidden');
      }

      const bgColors = labels.map((l) => {
        const found = CATEGORIES.expense.find((c) => c.id === l);
        return found ? found.color : '#64748b';
      });

      this.chart.data.labels = labels;
      this.chart.data.datasets[0].data = data;
      this.chart.data.datasets[0].backgroundColor = bgColors;
      this.chart.data.datasets[0].borderColor = borderColor;

      // Render Leaderboard list
      this.categoryLeaderboard.innerHTML = sorted
        .map(([catName, amt]) => {
          const pct = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : 0;
          const catMeta = CATEGORIES.expense.find((c) => c.id === catName) || {
            icon: 'fa-tag',
            color: '#6366f1',
            bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
          };

          return `
            <div onclick="window.app.filterByCategory('${catName}')" title="Click to view history for ${catName}" class="py-2.5 px-2 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 rounded-xl cursor-pointer transition group">
              <div class="flex items-center justify-between mb-1.5 text-xs">
                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 rounded-md flex items-center justify-center text-[10px] ${catMeta.bg}">
                    <i class="fa-solid ${catMeta.icon}"></i>
                  </span>
                  <span class="font-bold text-slate-800 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">${catName}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="font-extrabold text-slate-900 dark:text-white">${this.formatCurrency(amt)}</span>
                  <span class="font-semibold px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/40 dark:border-slate-700/40">${pct}%</span>
                </div>
              </div>
              <div class="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div class="leaderboard-bar h-1.5 rounded-full" style="width: ${pct}%; background-color: ${catMeta.color};"></div>
              </div>
            </div>
          `;
        })
        .join('');
    }

    if (this.chart.options.plugins && this.chart.options.plugins.legend) {
      this.chart.options.plugins.legend.labels.color = textColor;
    }
    this.chart.update();
  }

  filterByCategory(catName) {
    this.filters.category = catName;
    if (this.filterCategory) this.filterCategory.value = catName;
    this.sound.playPop();
    this.renderHistoryList();
    document.getElementById('history-heading').scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.showToast(`Filtered by "${catName}"`, 'info');
  }

  // --- History List Rendering ---
  getFilteredTransactions() {
    const { account, type, category, search, sort } = this.filters;

    return this.transactions
      .filter((t) => {
        if (account !== 'all' && t.account !== account) return false;
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

  renderHistoryList() {
    const filtered = this.getFilteredTransactions();
    this.txCountBadge.textContent = filtered.length;

    if (filtered.length === 0) {
      this.transactionList.innerHTML = '';
      this.emptyState.classList.remove('hidden');
      return;
    }

    this.emptyState.classList.add('hidden');

    this.transactionList.innerHTML = filtered
      .map((t) => {
        const isIncome = t.type === 'income';
        const isUPI = t.account === 'UPI';
        const metaList = CATEGORIES[t.type] || [];
        const catMeta = metaList.find((c) => c.id === t.category) || {
          icon: isIncome ? 'fa-arrow-up' : 'fa-arrow-down',
          bg: isIncome ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
        };

        const dateObj = new Date(t.date);
        const formattedDate = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

        return `
          <div class="glass-panel tx-item rounded-xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 group">
            
            <!-- Left Info -->
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm shrink-0 ${catMeta.bg}">
                <i class="fa-solid ${catMeta.icon}"></i>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h4 class="text-sm font-bold text-slate-900 dark:text-white truncate">${this.escapeHTML(t.title)}</h4>
                  <!-- Account Badge -->
                  <span class="text-[9px] font-bold px-1.5 py-0.5 rounded ${isUPI ? 'badge-upi' : 'badge-cash'}">
                    ${t.account}
                  </span>
                </div>
                <div class="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  <span class="text-[11px] font-medium">${t.category}</span>
                  <span>•</span>
                  <span class="text-[11px]">${formattedDate}</span>
                  ${t.notes ? `<span class="truncate max-w-[140px] text-slate-400 italic">(${this.escapeHTML(t.notes)})</span>` : ''}
                </div>
              </div>
            </div>

            <!-- Right Info & Delete Button -->
            <div class="flex items-center gap-3 shrink-0">
              <span class="text-sm sm:text-base font-extrabold ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}">
                ${isIncome ? '+' : '-'}${this.formatCurrency(t.amount)}
              </span>
              <button onclick="window.app.deleteTransaction('${t._id}')" title="Delete transaction" class="tx-action-btn w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition">
                <i class="fa-regular fa-trash-can text-xs"></i>
              </button>
            </div>

          </div>
        `;
      })
      .join('');
  }

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, (tag) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
  }

  showToast(message, type = 'info') {
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

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new StudentExpenseApp();
});
