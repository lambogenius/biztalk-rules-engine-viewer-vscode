// Reads exported BizTalk Business Rules Engine policies: the BRL format (<brl><ruleset><version major minor/>
// <rule><if><compare operator>…</if><then>…</then></rule>) and simpler hand-made variants. Used by the webview
// (media/main.js) and the tests.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RulesParser = api;
})(typeof self !== 'undefined' ? self : this, () => {
  const local = node => (node.localName || node.nodeName).toLowerCase();
  const children = node => Array.from(node?.childNodes || []).filter(item => item.nodeType === 1);
  const is = (node, name) => local(node) === name;
  const descendants = (node, name) => Array.from(node.getElementsByTagName('*')).filter(item => is(item, name));
  const direct = (node, names) => children(node).filter(item => names.includes(local(item)));
  const attr = (node, ...names) => { for (const name of names) { const value = node?.getAttribute(name); if (value != null && value !== '') return value; } return ''; };
  const text = node => (node?.textContent || '').trim();

  const operators = { and: 'AND', or: 'OR', not: 'NOT', equal: '=', notequal: '≠', greaterthan: '>', lessthan: '<', greaterthanorequal: '≥', lessthanorequal: '≤', add: '+', subtract: '−', multiply: '×', divide: '÷' };
  // BRL <compare operator="…"> spells operators out.
  const compareOperators = {
    'equal': '=', 'equal to': '=', 'not equal': '≠', 'not equal to': '≠',
    'greater than': '>', 'less than': '<', 'greater than equal': '≥', 'greater than or equal to': '≥',
    'less than equal': '≤', 'less than or equal to': '≤', 'between': 'between', 'match': 'matches',
  };
  // Binding and tooling details that carry no meaning for a reader.
  const hidden = ['vocabularylink', 'bindings', 'configuration', 'selector', 'selectoralias', 'schema', 'xpath', 'version'];

  function constant(node) {
    const typed = children(node)[0];
    if (!typed) return text(node);
    const value = text(typed);
    return is(typed, 'string') ? `"${value}"` : value || local(typed);
  }

  function member(node) {
    // An XML field: its alias (the name a vocabulary or the composer gave it) reads best, then the XPath field.
    const name = text(direct(node, ['fieldalias'])[0]) || text(direct(node, ['field'])[0]) || attr(node, 'member', 'Member', 'name', 'Name', 'column', 'Column') || local(node);
    const args = direct(node, ['argument']).map(describe).filter(Boolean);
    return args.length ? `${name}(${args.join(', ')})` : name;
  }

  function describe(node) {
    if (!node) return '';
    const name = local(node);
    if (hidden.includes(name)) return '';
    if (name === 'constant') return constant(node);
    if (name === 'compare') {
      const operator = attr(node, 'operator', 'Operator');
      const symbol = compareOperators[operator.toLowerCase()] || operator || '?';
      return `${describe(direct(node, ['lhs'])[0])} ${symbol} ${describe(direct(node, ['rhs'])[0])}`.trim();
    }
    if (['xmldocumentmember', 'classmember', 'databasecolumn', 'datarowmember'].includes(name)) return member(node);
    const parts = children(node).map(describe).filter(Boolean);
    if (['lhs', 'rhs', 'argument', 'function'].includes(name)) return parts.join(' ');
    const value = attr(node, 'value', 'Value', 'name', 'Name', 'member', 'Member', 'field', 'Field', 'class', 'Class', 'type', 'Type');
    const leaf = children(node).length ? '' : text(node);
    if (operators[name]) return name === 'not' ? `NOT (${parts.join(' ')})` : parts.map(part => (parts.length > 1 && / (AND|OR) /.test(part) ? `(${part})` : part)).join(` ${operators[name]} `);
    // Containers join their parts; an empty one (<Action Name="Approve"/>) falls through to its name below.
    if (['if', 'condition', 'conditions', 'then', 'actions', 'action'].includes(name) && parts.length) return parts.join(name === 'conditions' ? ' AND ' : '; ');
    if (['if', 'condition', 'conditions', 'then', 'actions'].includes(name)) return '';
    if (parts.length) return value ? `${value}(${parts.join(', ')})` : parts.join(' ');
    return value || leaf || node.localName;
  }

  function version(ruleSet) {
    // BRL keeps the version in a child <version major="1" minor="0" modifiedby="…" date="…"/>; simpler exports put
    // major/minor on the RuleSet itself.
    const child = direct(ruleSet, ['version'])[0];
    return {
      major: attr(child, 'major', 'Major') || attr(ruleSet, 'major', 'Major', 'majorVersion', 'MajorVersion'),
      minor: attr(child, 'minor', 'Minor') || attr(ruleSet, 'minor', 'Minor', 'minorVersion', 'MinorVersion'),
      modifiedBy: attr(child, 'modifiedby', 'modifiedBy', 'ModifiedBy'),
      date: attr(child, 'date', 'Date'),
      description: attr(child, 'description', 'Description'),
    };
  }

  function parse(fileName, source, parseXml) {
    const xml = parseXml(source);
    const ruleSets = [xml.documentElement, ...Array.from(xml.getElementsByTagName('*'))].filter(node => is(node, 'ruleset'));
    const uniqueRuleSets = [...new Set(ruleSets)];
    if (!uniqueRuleSets.length) throw new Error('No RuleSet elements found. Open an exported BizTalk BRE policy XML file.');
    return {
      fileName,
      policies: uniqueRuleSets.map((node, policyIndex) => {
        const rules = descendants(node, 'rule').filter(rule => !descendants(rule, 'rule').length).map((rule, ruleIndex) => {
          const condition = direct(rule, ['if', 'condition', 'conditions'])[0] || descendants(rule, 'if')[0] || descendants(rule, 'condition')[0];
          const action = direct(rule, ['then', 'actions', 'action'])[0] || descendants(rule, 'then')[0] || descendants(rule, 'actions')[0];
          const enabled = attr(rule, 'active', 'Active', 'enabled', 'Enabled').toLowerCase();
          return {
            name: attr(rule, 'name', 'Name') || `Rule ${ruleIndex + 1}`,
            priority: attr(rule, 'priority', 'Priority') || '0',
            active: !['false', '0', 'no'].includes(enabled),
            condition: describe(condition) || 'Always',
            action: describe(action) || 'No action found',
          };
        });
        return { name: attr(node, 'name', 'Name') || `Policy ${policyIndex + 1}`, ...version(node), rules };
      }),
    };
  }

  return { parse, describe };
});
