(() => {
  const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined;
  const state = { model: null, policy: 0, query: '', showInactive: true };
  const $ = id => document.getElementById(id);
  const esc = value => { const span = document.createElement('span'); span.textContent = value ?? ''; return span.innerHTML; };
  const parseXml = source => {
    const xml = new DOMParser().parseFromString(source, 'application/xml');
    const parseError = xml.querySelector('parsererror');
    if (parseError) throw new Error(`Invalid rules XML: ${parseError.textContent.split('\n')[0]}`);
    return xml;
  };
  const parse = (fileName, source) => self.RulesParser.parse(fileName, source, parseXml);
  const versionText = policy => {
    const parts = [policy.major || policy.minor ? `Version ${policy.major || '0'}.${policy.minor || '0'}` : 'Version not specified'];
    if (policy.modifiedBy) parts.push(`by ${policy.modifiedBy}`);
    if (policy.date) parts.push(policy.date.slice(0, 10));
    return parts.join(' · ');
  };

  function render() {
    const model = state.model; if (!model) return;
    $('title').textContent = model.fileName;
    const total = model.policies.reduce((sum, policy) => sum + policy.rules.length, 0);
    $('stats').innerHTML = `<span class="pill">${model.policies.length} policies</span><span class="pill">${total} rules</span>`;
    $('policy').innerHTML = model.policies.map((policy, index) => `<option value="${index}" ${index === state.policy ? 'selected' : ''}>${esc(policy.name)}${policy.major || policy.minor ? ` v${esc(policy.major || '0')}.${esc(policy.minor || '0')}` : ''}</option>`).join('');
    const policy = model.policies[state.policy];
    $('summary').innerHTML = `<article><span>POLICY</span><strong>${esc(policy.name)}</strong><small>${esc(versionText(policy))}</small></article><i>→</i><article><span>RULE SET</span><strong>${policy.rules.length} rules</strong><small>${policy.rules.filter(rule => rule.active).length} active</small></article>`;
    const query = state.query.toLowerCase();
    const rules = policy.rules.filter(rule => (state.showInactive || rule.active) && JSON.stringify(rule).toLowerCase().includes(query));
    $('rules').innerHTML = rules.length ? rules.map(rule => `<article class="rule ${rule.active ? '' : 'inactive'}"><div class="rule-head"><strong>${esc(rule.name)}</strong><span class="pill">Priority ${esc(rule.priority)}</span><span class="status">${rule.active ? 'Active' : 'Inactive'}</span></div><div class="rule-body"><section><span>IF</span><p>${esc(rule.condition)}</p></section><section><span>THEN</span><p>${esc(rule.action)}</p></section></div></article>`).join('') : '<div class="empty">No rules match this filter.</div>';
  }
  $('policy').addEventListener('change', event => { state.policy = Number(event.target.value); render(); });
  $('search').addEventListener('input', event => { state.query = event.target.value; render(); });
  $('inactive').addEventListener('change', event => { state.showInactive = event.target.checked; render(); });
  window.addEventListener('message', event => { if (event.data?.type !== 'openRules') return; try { state.model = parse(event.data.fileName || 'rules.xml', event.data.source); state.policy = 0; $('error').hidden = true; render(); } catch (error) { $('error').textContent = error instanceof Error ? error.message : String(error); $('error').hidden = false; $('rules').innerHTML = ''; $('summary').innerHTML = ''; } });
  vscode?.postMessage({ type: 'ready' });
})();
