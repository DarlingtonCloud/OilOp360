/* Shared helpers used across dashboard, contractors, and assets pages. */

const STORE = {
  user: 'oilops360User',
  contractors: 'oilops360Contractors',
  assets: 'oilops360Assets',
  contractorsTrash: 'oilops360ContractorsTrash',
  assetsTrash: 'oilops360AssetsTrash',
};

const TRASH_RETENTION_DAYS = 30;

function requireAuth() {
  const raw = localStorage.getItem(STORE.user);
  if (!raw) {
    window.location.href = 'index.html';
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    window.location.href = 'index.html';
    return null;
  }
}

function wireLogout() {
  document.querySelectorAll('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', () => {
      localStorage.removeItem(STORE.user);
      window.location.href = 'index.html';
    });
  });
}

function readList(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getUserRole() {
  const fallback = { role: 'Compliance Manager' };
  try {
    return (JSON.parse(localStorage.getItem(STORE.user) || JSON.stringify(fallback))).role;
  } catch {
    return fallback.role;
  }
}

function canEdit() {
  return getUserRole() !== 'Viewer';
}

/* ---------- Recovery / trash ----------
   Deletes are never destructive by default: a removed record moves into a
   parallel trash list with a deletedAt timestamp. It can be restored to the
   live list, purged immediately, or it ages out automatically after
   TRASH_RETENTION_DAYS. */

function purgeExpired(trashKey) {
  const cutoff = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const trash = readList(trashKey).filter((item) => {
    const deletedAt = new Date(item.deletedAt).getTime();
    return !deletedAt || deletedAt > cutoff;
  });
  writeList(trashKey, trash);
  return trash;
}

function moveToTrash(liveKey, trashKey, id) {
  const live = readList(liveKey);
  const index = live.findIndex((item) => item.id === id);
  if (index === -1) return;
  const [record] = live.splice(index, 1);
  record.deletedAt = new Date().toISOString();
  writeList(liveKey, live);
  const trash = purgeExpired(trashKey);
  trash.unshift(record);
  writeList(trashKey, trash);
}

function restoreFromTrash(liveKey, trashKey, id) {
  const trash = readList(trashKey);
  const index = trash.findIndex((item) => item.id === id);
  if (index === -1) return;
  const [record] = trash.splice(index, 1);
  delete record.deletedAt;
  writeList(trashKey, trash);
  const live = readList(liveKey);
  live.unshift(record);
  writeList(liveKey, live);
}

function purgeFromTrash(trashKey, id) {
  writeList(trashKey, readList(trashKey).filter((item) => item.id !== id));
}

function daysRemaining(deletedAt) {
  const elapsedMs = Date.now() - new Date(deletedAt).getTime();
  const remaining = TRASH_RETENTION_DAYS - Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  return Math.max(0, remaining);
}

function seedIfEmpty() {
  if (readList(STORE.contractors).length === 0) {
    writeList(STORE.contractors, [
      { id: uid(), company: 'Atlas Wellhead Services', contact: 'Maria Okafor', scope: 'Drilling', status: 'Compliant', expiry: '2026-11-04', documents: ['insurance_cert.pdf', 'safety_audit.pdf'] },
      { id: uid(), company: 'Ridgeline Transport Co.', contact: 'Daniel Reyes', scope: 'Transport', status: 'Pending', expiry: '2026-07-18', documents: ['permit_2026.pdf'] },
      { id: uid(), company: 'Coastal HSE Partners', contact: 'Funmi Adeyemi', scope: 'HSE Services', status: 'Expired', expiry: '2026-05-02', documents: [] },
      { id: uid(), company: 'Ironclad Maintenance Ltd', contact: 'Tom Bracken', scope: 'Maintenance', status: 'Compliant', expiry: '2027-01-22', documents: ['maint_license.pdf'] },
    ]);
  }
  if (readList(STORE.assets).length === 0) {
    writeList(STORE.assets, [
      { id: uid(), name: 'Wellhead WH-12', type: 'Wellhead', location: 'Pad 4, North Field', inspector: 'J. Falade', condition: 'Ready', lastInspection: '2026-05-10', nextInspection: '2026-08-10', files: ['wh12_inspection.pdf'], notes: '' },
      { id: uid(), name: 'Pump P-07', type: 'Pump', location: 'Station C', inspector: 'A. Idris', condition: 'Due', lastInspection: '2026-03-02', nextInspection: '2026-07-02', files: [], notes: 'Bearing noise reported last cycle.' },
      { id: uid(), name: 'Storage Tank ST-2', type: 'Storage Tank', location: 'Tank Farm 1', inspector: 'K. Williams', condition: 'Critical', lastInspection: '2026-01-15', nextInspection: '2026-06-15', files: ['st2_corrosion_report.pdf'], notes: 'Corrosion noted on east seam, escalate.' },
      { id: uid(), name: 'Generator G-3', type: 'Generator', location: 'Backup Power Yard', inspector: 'J. Falade', condition: 'Ready', lastInspection: '2026-06-01', nextInspection: '2026-09-01', files: [], notes: '' },
    ]);
  }
}

function badgeClass(value) {
  const v = String(value || '').toLowerCase();
  if (v === 'compliant' || v === 'ready') return 'good';
  if (v === 'pending' || v === 'due') return 'warn';
  if (v === 'expired' || v === 'critical') return 'danger';
  return 'neutral';
}

function downloadCSV(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => {
    const str = String(cell ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
