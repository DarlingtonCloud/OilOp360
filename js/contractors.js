document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth();
  if (!user) return;
  wireLogout();
  seedIfEmpty();
  purgeExpired(STORE.contractorsTrash);

  const form = document.getElementById('contractorForm');
  const formTitle = document.getElementById('contractorFormTitle');
  const idField = document.getElementById('contractorId');
  const companyField = document.getElementById('company');
  const contactField = document.getElementById('contact');
  const scopeField = document.getElementById('scope');
  const statusField = document.getElementById('contractorStatus');
  const expiryField = document.getElementById('expiry');
  const filesField = document.getElementById('documents');
  const chipsBox = document.getElementById('documentChips');
  const tableBody = document.getElementById('contractorTable');
  const searchInput = document.getElementById('contractorSearch');
  const statusFilter = document.getElementById('contractorStatusFilter');
  const trashTableBody = document.getElementById('contractorTrashTable');
  const trashCount = document.getElementById('contractorTrashCount');

  let pendingDocs = [];

  function load() { return readList(STORE.contractors); }
  function save(list) { writeList(STORE.contractors, list); }

  function renderChips() {
    chipsBox.innerHTML = pendingDocs.length
      ? pendingDocs.map((name) => `<span class="chip">${name}</span>`).join('')
      : '<span class="chip">No documents attached</span>';
  }

  function resetForm() {
    form.reset();
    idField.value = '';
    pendingDocs = [];
    renderChips();
    formTitle.textContent = 'Add Contractor';
  }

  function matchesFilters(c) {
    const term = searchInput.value.trim().toLowerCase();
    const statusOk = statusFilter.value === 'All' || c.status === statusFilter.value;
    const termOk = !term || [c.company, c.contact, c.scope].some((v) => v.toLowerCase().includes(term));
    return statusOk && termOk;
  }

  function render() {
    const list = load().filter(matchesFilters);
    const editable = canEdit();
    if (list.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6"><p class="empty-state">No contractors match these filters.</p></td></tr>`;
    } else {
      tableBody.innerHTML = list.map((c) => `
        <tr>
          <td>
            <strong>${c.company}</strong><br>
            <span style="color:var(--muted); font-size:0.82rem;">${c.contact}</span>
          </td>
          <td>${c.scope}</td>
          <td><span class="badge ${badgeClass(c.status)}">${c.status}</span></td>
          <td>${c.documents.length ? c.documents.length + ' file' + (c.documents.length > 1 ? 's' : '') : '—'}</td>
          <td>${c.expiry}</td>
          <td>
            <div class="row-actions">
              <button type="button" class="icon-button" data-edit="${c.id}" ${editable ? '' : 'disabled'}>Edit</button>
              <button type="button" class="icon-button danger" data-delete="${c.id}" ${editable ? '' : 'disabled'}>Delete</button>
            </div>
          </td>
        </tr>
      `).join('');
    }
    renderTrash();
  }

  function renderTrash() {
    const trashed = purgeExpired(STORE.contractorsTrash);
    trashCount.textContent = trashed.length;
    const editable = canEdit();
    if (trashed.length === 0) {
      trashTableBody.innerHTML = `<tr><td colspan="5"><p class="empty-state">Nothing in recovery right now.</p></td></tr>`;
      return;
    }
    trashTableBody.innerHTML = trashed.map((c) => `
      <tr class="trash-row">
        <td><span class="row-title">${c.company}</span></td>
        <td>${c.scope}</td>
        <td><span class="badge ${badgeClass(c.status)}">${c.status}</span></td>
        <td>${new Date(c.deletedAt).toLocaleDateString()} · ${daysRemaining(c.deletedAt)}d left</td>
        <td>
          <div class="row-actions">
            <button type="button" class="icon-button" data-restore="${c.id}" ${editable ? '' : 'disabled'}>Restore</button>
            <button type="button" class="icon-button danger" data-purge="${c.id}" ${editable ? '' : 'disabled'}>Delete forever</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  filesField.addEventListener('change', () => {
    pendingDocs = [...pendingDocs, ...Array.from(filesField.files).map((f) => f.name)];
    renderChips();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!canEdit()) return;
    const list = load();
    const existing = idField.value ? list.find((c) => c.id === idField.value) : null;
    const record = {
      id: idField.value || uid(),
      company: companyField.value.trim(),
      contact: contactField.value.trim(),
      scope: scopeField.value,
      status: statusField.value,
      expiry: expiryField.value,
      documents: pendingDocs.length ? pendingDocs : (existing ? existing.documents : []),
    };
    if (idField.value) {
      const index = list.findIndex((c) => c.id === idField.value);
      if (index >= 0) list[index] = record;
    } else {
      list.unshift(record);
    }
    save(list);
    resetForm();
    render();
  });

  document.getElementById('resetContractorForm').addEventListener('click', resetForm);

  tableBody.addEventListener('click', (event) => {
    const editId = event.target.dataset.edit;
    const deleteId = event.target.dataset.delete;
    if (editId) {
      const record = load().find((c) => c.id === editId);
      if (!record) return;
      idField.value = record.id;
      companyField.value = record.company;
      contactField.value = record.contact;
      scopeField.value = record.scope;
      statusField.value = record.status;
      expiryField.value = record.expiry;
      pendingDocs = [...record.documents];
      renderChips();
      formTitle.textContent = 'Edit Contractor';
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (deleteId) {
      if (!canEdit()) return;
      moveToTrash(STORE.contractors, STORE.contractorsTrash, deleteId);
      render();
    }
  });

  trashTableBody.addEventListener('click', (event) => {
    const restoreId = event.target.dataset.restore;
    const purgeId = event.target.dataset.purge;
    if (restoreId) {
      if (!canEdit()) return;
      restoreFromTrash(STORE.contractors, STORE.contractorsTrash, restoreId);
      render();
    }
    if (purgeId) {
      if (!canEdit()) return;
      if (!confirm('Permanently delete this contractor? This cannot be undone.')) return;
      purgeFromTrash(STORE.contractorsTrash, purgeId);
      renderTrash();
    }
  });

  searchInput.addEventListener('input', render);
  statusFilter.addEventListener('change', render);

  document.getElementById('newContractorBtn').addEventListener('click', () => {
    resetForm();
    companyField.focus();
  });

  document.getElementById('exportContractors').addEventListener('click', () => {
    const list = load().filter(matchesFilters);
    downloadCSV('contractors_report.csv', [
      ['Company', 'Contact', 'Scope', 'Status', 'Expiry', 'Documents'],
      ...list.map((c) => [c.company, c.contact, c.scope, c.status, c.expiry, c.documents.join('; ')]),
    ]);
  });

  if (!canEdit()) {
    document.getElementById('newContractorBtn').disabled = true;
    form.querySelectorAll('input, select, textarea, button').forEach((el) => {
      if (el.id !== 'resetContractorForm') el.disabled = true;
    });
  }

  renderChips();
  render();
});
