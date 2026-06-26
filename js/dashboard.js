document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth();
  if (!user) return;
  wireLogout();
  seedIfEmpty();

  document.getElementById('userPill').textContent = user.role || 'User';

  const contractors = readList(STORE.contractors);
  const assets = readList(STORE.assets);

  const compliant = contractors.filter((c) => c.status === 'Compliant').length;
  const pendingDocs = contractors.reduce((sum, c) => sum + Math.max(0, (c.status === 'Compliant' ? 0 : 1)), 0);
  const criticalAssets = assets.filter((a) => a.condition === 'Critical').length;

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const recentInspections = assets.filter((a) => {
    const d = new Date(a.lastInspection);
    return !isNaN(d) && d >= thirtyDaysAgo && d <= today;
  }).length;

  document.getElementById('totalContractors').textContent = contractors.length;
  document.getElementById('compliantContractors').textContent = `${compliant} compliant`;
  document.getElementById('totalAssets').textContent = assets.length;
  document.getElementById('criticalAssets').textContent = `${criticalAssets} critical`;
  document.getElementById('pendingDocs').textContent = pendingDocs;
  document.getElementById('recentInspections').textContent = recentInspections;

  const contractorList = document.getElementById('contractorStatusList');
  if (contractors.length === 0) {
    contractorList.innerHTML = '<p class="empty-state">No contractors on file yet.</p>';
  } else {
    contractorList.innerHTML = contractors.slice(0, 6).map((c) => `
      <div class="status-row">
        <div>
          <strong>${c.company}</strong>
          <span>${c.scope}</span>
        </div>
        <span class="badge ${badgeClass(c.status)}">${c.status}</span>
      </div>
    `).join('');
  }

  const assetList = document.getElementById('assetStatusList');
  if (assets.length === 0) {
    assetList.innerHTML = '<p class="empty-state">No assets on file yet.</p>';
  } else {
    assetList.innerHTML = assets.slice(0, 6).map((a) => `
      <div class="status-row">
        <div>
          <strong>${a.name}</strong>
          <span>Next inspection ${a.nextInspection}</span>
        </div>
        <span class="badge ${badgeClass(a.condition)}">${a.condition}</span>
      </div>
    `).join('');
  }

  const contractorScore = contractors.length ? Math.round((compliant / contractors.length) * 100) : 0;
  const assetScore = assets.length ? Math.round((assets.filter((a) => a.condition === 'Ready').length / assets.length) * 100) : 0;
  document.getElementById('contractorMeter').value = contractorScore;
  document.getElementById('assetMeter').value = assetScore;

  document.getElementById('exportSummary').addEventListener('click', () => {
    downloadCSV('compliance_summary.csv', [
      ['Metric', 'Value'],
      ['Total contractors', contractors.length],
      ['Compliant contractors', compliant],
      ['Total assets', assets.length],
      ['Critical assets', criticalAssets],
      ['Pending documents', pendingDocs],
      ['Recent inspections (30d)', recentInspections],
      ['Contractor compliance %', contractorScore],
      ['Asset readiness %', assetScore],
    ]);
  });
});
