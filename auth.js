(async () => {
  const r = await fetch('/api/me');
  const d = await r.json();
  if (!d.user) {
    location.href = '/login.html';
    return;
  }
  window.currentUser = d.user;

  document.querySelectorAll('[data-user-name]').forEach(e => {
    e.textContent = d.user.display_name;
  });

  const isStaff = d.user.role === 'Admin' || d.user.role === 'Creator';
  document.querySelectorAll('[data-admin]').forEach(e => {
    e.style.display = isStaff ? '' : 'none';
  });
})();

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  location.href = '/login.html';
}
