(() => {
  const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined;
  const state = { model: null, policy: 0, query: '', showInactive: true };
  const $ = id => document.getElementById(id);
  const esc = value => { const span = document.createElement('span'); span.textContent = value ?? ''; return span.innerHTML; };
  const attr = (node, ...names) => { for (const name of names) { const value = node?.getAttribute(name); if (value != null) return value; } return ''; };
  const children = node => [...(node?.children || [])];
  const is = (node, name) => node.localName.toLowerCase() === name;
  const descendants = (node, name) => [...node.getElementsByTagName('*')].filter(item => is(item, name));
  const direct = (node, names) => children(node).filter(item => names.includes(item.localName.toLowerCase()));
  const operators = { and: 'AND', or: 'OR', not: 'NOT', equal: '=', notequal: '≠', greaterthan: '>', lessthan: '<', greaterthanorequal: '≥', lessthanorequal: '≤', add: '+', subtract: '−', multiply: '×', divide: '÷' };

  function describe(node) {
    if (!node) return '';
    const name = node.localName.toLowerCase();
    const parts = children(node).map(describe).filter(Boolean);
    const value = attr(node, 'value', 'Value', 'name', 'Name', 'member', 'Member', 'field', 'Field', 'class', 'Class', 'type', 'Type');
    const text = children(node).length ? '' : node.textContent.trim();
    if (operators[name]) return name === 'not' ? `NOT (${parts.join(' ')})` : parts.join(` ${operators[name]} `);
    if (['if', 'condition', 'conditions', 'then', 'actions', 'action'].includes(name)) return parts.join(name === 'conditions' ? ' AND ' : '; ');
    if (parts.length) return value ? `${value}(${parts.join(', ')})` : parts.join(' ');
    return value || text || node.localName;
  }

  function parse(fileName, source) {
    const xml = new DOMParser().parseFromString(source, 'application/xml');
    const parseError = xml.querySelector('parsererror');
    if (parseError) throw new Error(`Invalid rules XML: ${parseError.textContent.split('\n')[0]}`);
    const ruleSets = [xml.documentElement, ...xml.getElementsByTagName('*')].filter(node => is(node, 'ruleset'));
    const uniqueRuleSets = [...new Set(ruleSets)];
    if (!uniqueRuleSets.length) throw new Error('No RuleSet elements found. Open an exported BizTalk BRE policy XML file.');
    return { fileName, policies: uniqueRuleSets.map((node, policyIndex) => {
      const rules = descendants(node, 'rule').filter(rule => !descendants(rule, 'rule').length).map((rule, ruleIndex) => {
        const condition = direct(rule, ['if', 'condition', 'conditions'])[0] || descendants(rule, 'if')[0] || descendants(rule, 'condition')[0];
        const action = direct(rule, ['then', 'actions', 'action'])[0] || descendants(rule, 'then')[0] || descendants(rule, 'actions')[0];
        const enabled = attr(rule, 'active', 'Active', 'enabled', 'Enabled').toLowerCase();
        return { name: attr(rule, 'name', 'Name') || `Rule ${ruleIndex + 1}`, priority: attr(rule, 'priority', 'Priority') || '0', active: !['false', '0', 'no'].includes(enabled), condition: describe(condition) || 'Always', action: describe(action) || 'No action found' };
      });
      return { name: attr(node, 'name', 'Name') || `Policy ${policyIndex + 1}`, major: attr(node, 'major', 'Major', 'majorVersion', 'MajorVersion'), minor: attr(node, 'minor', 'Minor', 'minorVersion', 'MinorVersion'), rules };
    }) };
  }

  function render() {
    const model = state.model; if (!model) return;
    $('title').textContent = model.fileName;
    const total = model.policies.reduce((sum, policy) => sum + policy.rules.length, 0);
    $('stats').innerHTML = `<span class="pill">${model.policies.length} policies</span><span class="pill">${total} rules</span>`;
    $('policy').innerHTML = model.policies.map((policy, index) => `<option value="${index}" ${index === state.policy ? 'selected' : ''}>${esc(policy.name)}${policy.major || policy.minor ? ` v${esc(policy.major || '0')}.${esc(policy.minor || '0')}` : ''}</option>`).join('');
    const policy = model.policies[state.policy];
    $('summary').innerHTML = `<article><span>POLICY</span><strong>${esc(policy.name)}</strong><small>${policy.major || policy.minor ? `Version ${esc(policy.major || '0')}.${esc(policy.minor || '0')}` : 'Version not specified'}</small></article><i>→</i><article><span>RULE SET</span><strong>${policy.rules.length} rules</strong><small>${policy.rules.filter(rule => rule.active).length} active</small></article>`;
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
