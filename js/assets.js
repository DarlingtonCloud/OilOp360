document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth();
  if (!user) return;
  wireLogout();
  seedIfEmpty();
  purgeExpired(STORE.assetsTrash);

  const form = document.getElementById('assetForm');
  const formTitle = document.getElementById('assetFormTitle');
  const idField = document.getElementById('assetId');
  const nameField = document.getElementById('assetName');
  const typeField = document.getElementById('assetType');
  const locationField = document.getElementById('location');
  const inspectorField = document.getElementById('inspector');
  const conditionField = document.getElementById('condition');
  const lastField = document.getElementById('lastInspection');
  const nextField = document.getElementById('nextInspection');
  const filesField = document.getElementById('inspectionFiles');
  const chipsBox = document.getElementById('inspectionFileChips');
  const notesField = document.getElementById('notes');
  const tableBody = document.getElementById('assetTable');
  const searchInput = document.getElementById('assetSearch');
  const conditionFilter = document.getElementById('assetConditionFilter');
  const trashTableBody = document.getElementById('assetTrashTable');
  const trashCount = document.getElementById('assetTrashCount');

  let pendingFiles = [];

  function load() { return readList(STORE.assets); }
  function save(list) { writeList(STORE.assets, list); }

  function renderChips() {
    chipsBox.innerHTML = pendingFiles.length
      ? pendingFiles.map((name) => `<span class="chip">${name}</span>`).join('')
      : '<span class="chip">No inspection files attached</span>';
  }

  function resetForm() {
    form.reset();
    idField.value = '';
    pendingFiles = [];
    renderChips();
    formTitle.textContent = 'Add Asset';
  }

  function matchesFilters(a) {
    const term = searchInput.value.trim().toLowerCase();
    const condOk = conditionFilter.value === 'All' || a.condition === conditionFilter.value;
    const termOk = !term || [a.name, a.location, a.inspector, a.type].some((v) => v.toLowerCase().includes(term));
    return condOk && termOk;
  }

  function render() {
    const list = load().filter(matchesFilters);
    const editable = canEdit();
    if (list.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6"><p class="empty-state">No assets match these filters.</p></td></tr>`;
    } else {
      tableBody.innerHTML = list.map((a) => `
        <tr>
          <td>
            <strong>${a.name}</strong><br>
            <span style="color:var(--muted); font-size:0.82rem;">${a.type}</span>
          </td>
          <td>${a.location}</td>
          <td><span class="badge ${badgeClass(a.condition)}">${a.condition}</span></td>
          <td>${a.nextInspection}</td>
          <td>${a.files.length ? a.files.length + ' file' + (a.files.length > 1 ? 's' : '') : '—'}</td>
          <td>
            <div class="row-actions">
              <button type="button" class="icon-button" data-edit="${a.id}" ${editable ? '' : 'disabled'}>Edit</button>
              <button type="button" class="icon-button danger" data-delete="${a.id}" ${editable ? '' : 'disabled'}>Delete</button>
            </div>
          </td>
        </tr>
      `).join('');
    }
    renderTrash();
  }

  function renderTrash() {
    const trashed = purgeExpired(STORE.assetsTrash);
    trashCount.textContent = trashed.length;
    const editable = canEdit();
    if (trashed.length === 0) {
      trashTableBody.innerHTML = `<tr><td colspan="5"><p class="empty-state">Nothing in recovery right now.</p></td></tr>`;
      return;
    }
    trashTableBody.innerHTML = trashed.map((a) => `
      <tr class="trash-row">
        <td><span class="row-title">${a.name}</span></td>
        <td>${a.location}</td>
        <td><span class="badge ${badgeClass(a.condition)}">${a.condition}</span></td>
        <td>${new Date(a.deletedAt).toLocaleDateString()} · ${daysRemaining(a.deletedAt)}d left</td>
        <td>
          <div class="row-actions">
            <button type="button" class="icon-button" data-restore="${a.id}" ${editable ? '' : 'disabled'}>Restore</button>
            <button type="button" class="icon-button danger" data-purge="${a.id}" ${editable ? '' : 'disabled'}>Delete forever</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  filesField.addEventListener('change', () => {
    pendingFiles = [...pendingFiles, ...Array.from(filesField.files).map((f) => f.name)];
    renderChips();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!canEdit()) return;
    const list = load();
    const existing = idField.value ? list.find((a) => a.id === idField.value) : null;
    const record = {
      id: idField.value || uid(),
      name: nameField.value.trim(),
      type: typeField.value,
      location: locationField.value.trim(),
      inspector: inspectorField.value.trim(),
      condition: conditionField.value,
      lastInspection: lastField.value,
      nextInspection: nextField.value,
      files: pendingFiles.length ? pendingFiles : (existing ? existing.files : []),
      notes: notesField.value.trim(),
    };
    if (idField.value) {
      const index = list.findIndex((a) => a.id === idField.value);
      if (index >= 0) list[index] = record;
    } else {
      list.unshift(record);
    }
    save(list);
    resetForm();
    render();
  });

  document.getElementById('resetAssetForm').addEventListener('click', resetForm);

  tableBody.addEventListener('click', (event) => {
    const editId = event.target.dataset.edit;
    const deleteId = event.target.dataset.delete;
    if (editId) {
      const record = load().find((a) => a.id === editId);
      if (!record) return;
      idField.value = record.id;
      nameField.value = record.name;
      typeField.value = record.type;
      locationField.value = record.location;
      inspectorField.value = record.inspector;
      conditionField.value = record.condition;
      lastField.value = record.lastInspection;
      nextField.value = record.nextInspection;
      notesField.value = record.notes || '';
      pendingFiles = [...record.files];
      renderChips();
      formTitle.textContent = 'Edit Asset';
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (deleteId) {
      if (!canEdit()) return;
      moveToTrash(STORE.assets, STORE.assetsTrash, deleteId);
      render();
    }
  });

  trashTableBody.addEventListener('click', (event) => {
    const restoreId = event.target.dataset.restore;
    const purgeId = event.target.dataset.purge;
    if (restoreId) {
      if (!canEdit()) return;
      restoreFromTrash(STORE.assets, STORE.assetsTrash, restoreId);
      render();
    }
    if (purgeId) {
      if (!canEdit()) return;
      if (!confirm('Permanently delete this asset? This cannot be undone.')) return;
      purgeFromTrash(STORE.assetsTrash, purgeId);
      renderTrash();
    }
  });

  searchInput.addEventListener('input', render);
  conditionFilter.addEventListener('change', render);

  document.getElementById('newAssetBtn').addEventListener('click', () => {
    resetForm();
    nameField.focus();
  });

  document.getElementById('exportAssets').addEventListener('click', () => {
    const list = load().filter(matchesFilters);
    downloadCSV('assets_report.csv', [
      ['Asset', 'Type', 'Location', 'Inspector', 'Condition', 'Last inspection', 'Next inspection', 'Notes'],
      ...list.map((a) => [a.name, a.type, a.location, a.inspector, a.condition, a.lastInspection, a.nextInspection, a.notes]),
    ]);
  });

  if (!canEdit()) {
    document.getElementById('newAssetBtn').disabled = true;
    form.querySelectorAll('input, select, textarea, button').forEach((el) => {
      if (el.id !== 'resetAssetForm') el.disabled = true;
    });
  }

  renderChips();
  render();
});
