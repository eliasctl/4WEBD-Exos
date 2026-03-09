// =============================================================================
// Banking SPA — Main JavaScript
// =============================================================================

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let token = localStorage.getItem('token');
  let user = null;
  let account = null;

  // ---------------------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------------------

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ---------------------------------------------------------------------------
  // Formatting helpers
  // ---------------------------------------------------------------------------

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return (
      pad(d.getDate()) + '/' +
      pad(d.getMonth() + 1) + '/' +
      d.getFullYear() + ' ' +
      pad(d.getHours()) + ':' +
      pad(d.getMinutes())
    );
  }

  function formatAmount(amount) {
    if (amount == null) return '—';
    return Number(amount).toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' \u20AC';
  }

  // ---------------------------------------------------------------------------
  // Toast system
  // ---------------------------------------------------------------------------

  function showToast(message, type) {
    type = type || 'info';
    const container = $('#toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    container.appendChild(toast);

    // Force reflow for CSS transition if needed
    toast.offsetHeight; // eslint-disable-line no-unused-expressions

    setTimeout(function () {
      toast.classList.add('toast-hide');
      toast.addEventListener('transitionend', function () {
        toast.remove();
      });
      // Fallback removal in case transitionend does not fire
      setTimeout(function () {
        if (toast.parentNode) toast.remove();
      }, 500);
    }, 3000);
  }

  // ---------------------------------------------------------------------------
  // API helper
  // ---------------------------------------------------------------------------

  async function api(method, path, body) {
    const options = {
      method: method,
      headers: {},
    };

    if (token) {
      options.headers['Authorization'] = 'Bearer ' + token;
    }

    if (body !== undefined && body !== null) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const response = await fetch(path, options);
    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.error || data.message || 'Une erreur est survenue';
      throw new Error(errorMessage);
    }

    return data;
  }

  // ---------------------------------------------------------------------------
  // Auth flow
  // ---------------------------------------------------------------------------

  function showAuth() {
    $('#auth-view').classList.add('active');
    $('#main-app').classList.add('hidden');
  }

  function switchAuthTab(tabName) {
    $$('button.auth-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });
    if (tabName === 'login') {
      $('#login-form').classList.remove('hidden');
      $('#register-form').classList.add('hidden');
    } else {
      $('#login-form').classList.add('hidden');
      $('#register-form').classList.remove('hidden');
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;

    if (!email || !password) {
      showToast('Veuillez remplir tous les champs', 'error');
      return;
    }

    try {
      const data = await api('POST', '/api/auth/login', { email: email, password: password });
      token = data.token;
      user = data.user;
      localStorage.setItem('token', token);
      showToast('Connexion réussie', 'success');
      initApp();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const firstName = $('#register-firstName').value.trim();
    const lastName = $('#register-lastName').value.trim();
    const email = $('#register-email').value.trim();
    const password = $('#register-password').value;

    if (!firstName || !lastName || !email || !password) {
      showToast('Veuillez remplir tous les champs', 'error');
      return;
    }

    try {
      await api('POST', '/api/auth/register', {
        firstName: firstName,
        lastName: lastName,
        email: email,
        password: password,
      });
      showToast('Inscription réussie ! Vous pouvez vous connecter.', 'success');
      switchAuthTab('login');
      // Pre-fill login email for convenience
      $('#login-email').value = email;
      $('#login-password').value = '';
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function validateToken() {
    if (!token) {
      showAuth();
      return;
    }
    try {
      user = await api('GET', '/api/auth/me');
      initApp();
    } catch (err) {
      token = null;
      user = null;
      localStorage.removeItem('token');
      showAuth();
    }
  }

  // ---------------------------------------------------------------------------
  // App initialization
  // ---------------------------------------------------------------------------

  function initApp() {
    $('#auth-view').classList.remove('active');
    $('#main-app').classList.remove('hidden');

    // Set user name
    const userNameEl = $('#user-name');
    if (userNameEl && user) {
      userNameEl.textContent = user.firstName + ' ' + user.lastName;
    }

    // Show admin elements if user is admin
    $$('.admin-only').forEach(function (el) {
      if (user && user.role === 'ADMIN') {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });

    // Load dashboard by default
    navigateTo('dashboard');
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  function navigateTo(viewName) {
    // Update nav links
    $$('a.nav-link').forEach(function (link) {
      link.classList.toggle('active', link.getAttribute('data-view') === viewName);
    });

    // Update views
    $$('.view').forEach(function (view) {
      view.classList.remove('active');
    });
    var targetView = $('#' + viewName + '-view');
    if (targetView) {
      targetView.classList.add('active');
    }

    // Load data for the view
    switch (viewName) {
      case 'dashboard':
        loadDashboard();
        break;
      case 'transactions':
        loadTransactions();
        break;
      case 'notifications':
        loadNotifications();
        break;
      case 'admin':
        loadUsers();
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  async function loadDashboard() {
    try {
      var data = await api('GET', '/api/accounts');
      var accounts = data.data || [];

      var balanceEl = $('#account-balance');
      var idEl = $('#account-id');
      var currencyEl = $('#account-currency');
      var createBtn = $('#create-account-btn');

      if (accounts.length > 0) {
        account = accounts[0];
        if (balanceEl) balanceEl.textContent = formatAmount(account.balance);
        if (idEl) idEl.textContent = account.id;
        if (currencyEl) currencyEl.textContent = account.currency || 'EUR';
        if (createBtn) createBtn.style.display = 'none';
      } else {
        account = null;
        if (balanceEl) balanceEl.textContent = '—';
        if (idEl) idEl.textContent = '—';
        if (currencyEl) currencyEl.textContent = '—';
        if (createBtn) createBtn.style.display = '';
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleCreateAccount() {
    try {
      await api('POST', '/api/accounts', { currency: 'EUR' });
      showToast('Compte créé avec succès', 'success');
      await loadDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleQuickDeposit() {
    var amountInput = $('#quick-deposit-amount');
    if (!amountInput) return;

    var amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) {
      showToast('Veuillez entrer un montant valide', 'error');
      return;
    }
    if (!account) {
      showToast('Aucun compte trouvé. Créez un compte d\'abord.', 'error');
      return;
    }

    try {
      await api('POST', '/api/accounts/' + account.id + '/deposit', { amount: amount });
      showToast('Dépôt de ' + formatAmount(amount) + ' effectué', 'success');
      amountInput.value = '';
      await loadDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleQuickWithdraw() {
    var amountInput = $('#quick-withdraw-amount');
    if (!amountInput) return;

    var amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) {
      showToast('Veuillez entrer un montant valide', 'error');
      return;
    }
    if (!account) {
      showToast('Aucun compte trouvé. Créez un compte d\'abord.', 'error');
      return;
    }

    try {
      await api('POST', '/api/accounts/' + account.id + '/withdraw', { amount: amount });
      showToast('Retrait de ' + formatAmount(amount) + ' effectué', 'success');
      amountInput.value = '';
      await loadDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Transactions
  // ---------------------------------------------------------------------------

  async function loadTransactions() {
    var tbody = $('#transaction-list');
    if (!tbody) return;

    if (!account) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Aucun compte trouvé</td></tr>';
      return;
    }

    try {
      var data = await api('GET', '/api/transactions');
      var transactions = data.data || [];

      if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Aucune transaction</td></tr>';
        return;
      }

      tbody.innerHTML = transactions.map(function (tx) {
        return (
          '<tr>' +
          '<td>' + escapeHtml(tx.id) + '</td>' +
          '<td><span class="badge badge-' + tx.type.toLowerCase() + '">' + escapeHtml(tx.type) + '</span></td>' +
          '<td>' + escapeHtml(tx.fromAccount || '—') + '</td>' +
          '<td>' + escapeHtml(tx.toAccount || '—') + '</td>' +
          '<td>' + formatAmount(tx.amount) + '</td>' +
          '<td>' + formatDate(tx.createdAt) + '</td>' +
          '</tr>'
        );
      }).join('');
    } catch (err) {
      showToast(err.message, 'error');
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Erreur lors du chargement</td></tr>';
    }
  }

  async function handleTransfer(e) {
    e.preventDefault();

    var toAccountId = $('#transfer-to').value.trim();
    var amount = parseFloat($('#transfer-amount').value);
    var description = $('#transfer-description').value.trim();

    if (!toAccountId) {
      showToast('Veuillez entrer un compte destinataire', 'error');
      return;
    }
    if (!amount || amount <= 0) {
      showToast('Veuillez entrer un montant valide', 'error');
      return;
    }
    if (!account) {
      showToast('Aucun compte trouvé. Créez un compte d\'abord.', 'error');
      return;
    }

    try {
      await api('POST', '/api/transactions/transfer', {
        toAccountId: toAccountId,
        amount: amount,
        description: description || undefined,
      });
      showToast('Virement effectué avec succès', 'success');

      // Clear form
      $('#transfer-to').value = '';
      $('#transfer-amount').value = '';
      $('#transfer-description').value = '';

      // Reload both views
      await loadTransactions();
      await loadDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------

  async function loadNotifications() {
    var container = $('#notification-list');
    if (!container) return;

    try {
      var data = await api('GET', '/api/notifications');
      var notifications = data.data || [];

      if (notifications.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#888;">Aucune notification</p>';
        return;
      }

      container.innerHTML = notifications.map(function (notif) {
        var badgeClass = 'badge badge-' + (notif.type || 'info').toLowerCase();
        return (
          '<div class="notification-item">' +
          '<div class="notification-header">' +
          '<span class="' + badgeClass + '">' + escapeHtml(notif.type) + '</span>' +
          '<span class="notification-date">' + formatDate(notif.createdAt) + '</span>' +
          '</div>' +
          '<p class="notification-message">' + escapeHtml(notif.message) + '</p>' +
          '<p class="notification-recipient"><small>Destinataire : ' + escapeHtml(notif.recipient) + '</small></p>' +
          '</div>'
        );
      }).join('');
    } catch (err) {
      showToast(err.message, 'error');
      container.innerHTML = '<p style="text-align:center;color:#888;">Erreur lors du chargement</p>';
    }
  }

  // ---------------------------------------------------------------------------
  // Admin — User list
  // ---------------------------------------------------------------------------

  async function loadUsers() {
    if (!user || user.role !== 'ADMIN') return;

    var tbody = $('#user-list');
    if (!tbody) return;

    try {
      var data = await api('GET', '/api/users');
      var users = data.data || [];

      if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Aucun utilisateur</td></tr>';
        return;
      }

      tbody.innerHTML = users.map(function (u) {
        var isSelf = user && u.id === user.id;
        var toggleLabel = u.role === 'ADMIN' ? 'Passer USER' : 'Passer ADMIN';
        var toggleRole = u.role === 'ADMIN' ? 'USER' : 'ADMIN';
        var actions = isSelf
          ? '<em style="color:#888">—</em>'
          : '<button class="btn btn-sm" onclick="adminChangeRole(\'' + escapeHtml(u.id) + '\',\'' + toggleRole + '\')">' + toggleLabel + '</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="adminDeleteUser(\'' + escapeHtml(u.id) + '\')">Supprimer</button>';
        return (
          '<tr>' +
          '<td>' + escapeHtml(u.id) + '</td>' +
          '<td>' + escapeHtml(u.firstName) + '</td>' +
          '<td>' + escapeHtml(u.lastName) + '</td>' +
          '<td>' + escapeHtml(u.email) + '</td>' +
          '<td><span class="badge badge-' + u.role.toLowerCase() + '">' + escapeHtml(u.role) + '</span></td>' +
          '<td>' + formatDate(u.createdAt) + '</td>' +
          '<td>' + actions + '</td>' +
          '</tr>'
        );
      }).join('');
    } catch (err) {
      showToast(err.message, 'error');
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Erreur lors du chargement</td></tr>';
    }
  }

  // ---------------------------------------------------------------------------
  // Admin — Change user role / Delete user
  // ---------------------------------------------------------------------------

  async function adminChangeRole(userId, newRole) {
    try {
      await api('PUT', '/api/users/' + userId, { role: newRole });
      showToast('Rôle mis à jour : ' + newRole, 'success');
      loadUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function adminDeleteUser(userId) {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    try {
      await api('DELETE', '/api/users/' + userId);
      showToast('Utilisateur supprimé', 'success');
      loadUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Expose for inline onclick handlers
  window.adminChangeRole = adminChangeRole;
  window.adminDeleteUser = adminDeleteUser;

  // ---------------------------------------------------------------------------
  // Admin — Send notification
  // ---------------------------------------------------------------------------

  async function handleSendNotification(e) {
    e.preventDefault();

    var type = $('#notif-type').value;
    var recipient = $('#notif-recipient').value.trim();
    var message = $('#notif-message').value.trim();

    if (!recipient || !message) {
      showToast('Veuillez remplir tous les champs', 'error');
      return;
    }

    try {
      await api('POST', '/api/notifications', { type: type, recipient: recipient, message: message });
      showToast('Notification envoyee avec succes', 'success');
      $('#notif-recipient').value = '';
      $('#notif-message').value = '';
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  function handleLogout() {
    token = null;
    user = null;
    account = null;
    localStorage.removeItem('token');
    window.location.reload();
  }

  // ---------------------------------------------------------------------------
  // Utility — HTML escaping
  // ---------------------------------------------------------------------------

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ---------------------------------------------------------------------------
  // Event listeners
  // ---------------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', function () {

    // --- Auth tabs -----------------------------------------------------------
    $$('button.auth-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchAuthTab(btn.getAttribute('data-tab'));
      });
    });

    // --- Login form ----------------------------------------------------------
    var loginForm = $('#login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }

    // --- Register form -------------------------------------------------------
    var registerForm = $('#register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', handleRegister);
    }

    // --- Navigation ----------------------------------------------------------
    $$('a.nav-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var view = link.getAttribute('data-view');
        if (view) navigateTo(view);
      });
    });

    // --- Create account button -----------------------------------------------
    var createAccountBtn = $('#create-account-btn');
    if (createAccountBtn) {
      createAccountBtn.addEventListener('click', handleCreateAccount);
    }

    // --- Quick deposit -------------------------------------------------------
    var depositAmountInput = $('#quick-deposit-amount');
    if (depositAmountInput) {
      // Support pressing Enter in the input field
      depositAmountInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleQuickDeposit();
        }
      });
      // Also look for a sibling or nearby button
      var depositBtn = depositAmountInput.parentElement &&
        depositAmountInput.parentElement.querySelector('button');
      if (depositBtn) {
        depositBtn.addEventListener('click', handleQuickDeposit);
      }
    }

    // --- Quick withdraw ------------------------------------------------------
    var withdrawAmountInput = $('#quick-withdraw-amount');
    if (withdrawAmountInput) {
      withdrawAmountInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleQuickWithdraw();
        }
      });
      var withdrawBtn = withdrawAmountInput.parentElement &&
        withdrawAmountInput.parentElement.querySelector('button');
      if (withdrawBtn) {
        withdrawBtn.addEventListener('click', handleQuickWithdraw);
      }
    }

    // --- Transfer form -------------------------------------------------------
    var transferForm = $('#transfer-form');
    if (transferForm) {
      transferForm.addEventListener('submit', handleTransfer);
    }

    // --- Send notification form (admin) --------------------------------------
    var sendNotifForm = $('#send-notification-form');
    if (sendNotifForm) {
      sendNotifForm.addEventListener('submit', handleSendNotification);
    }

    // --- Logout --------------------------------------------------------------
    var logoutBtn = $('#logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        handleLogout();
      });
    }

    // --- Initial load --------------------------------------------------------
    validateToken();
  });
})();
