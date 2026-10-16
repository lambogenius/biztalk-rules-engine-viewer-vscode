const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DOMParser } = require('@xmldom/xmldom');

const { parse } = require('../media/parser.js');

const parseXml = source => new DOMParser().parseFromString(source, 'application/xml');
const fixture = name => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

test('BRL: the version comes from the <version> child of the ruleset', () => {
  const [policy] = parse('discounts.brl', fixture('discounts.brl'), parseXml).policies;
  assert.equal(policy.name, 'OrderDiscounts');
  assert.equal(policy.major, '1');
  assert.equal(policy.minor, '2');
  assert.equal(policy.modifiedBy, 'CONTOSO\\rules.admin');
  assert.match(policy.date, /^2024-03-05/);
});

test('BRL: compare conditions read as field operator value', () => {
  const [policy] = parse('discounts.brl', fixture('discounts.brl'), parseXml).policies;
  const [large, retired] = policy.rules;
  assert.equal(large.name, 'LargeOrderDiscount');
  assert.equal(large.priority, '10');
  assert.equal(large.condition, 'Total > 1000 AND Region = "East"');
  assert.equal(large.action, 'Discount(0.05)');
  assert.equal(retired.active, false);
  assert.equal(retired.condition, 'Total < 50');
  assert.equal(retired.action, 'No action found');
});

test('simple form: major/minor attributes on the RuleSet still work', () => {
  const source = '<Policies><RuleSet Name="Simple" Major="2" Minor="1"><Rule Name="R1" Priority="5"><If><GreaterThan><Field Name="Score"/><Value Value="7"/></GreaterThan></If><Then><Action Name="Approve"/></Then></Rule></RuleSet></Policies>';
  const [policy] = parse('simple.xml', source, parseXml).policies;
  assert.equal(`${policy.major}.${policy.minor}`, '2.1');
  assert.equal(policy.rules[0].condition, 'Score > 7');
  assert.equal(policy.rules[0].action, 'Approve');
});

test('files without a RuleSet are refused', () => {
  assert.throws(() => parse('other.xml', '<root/>', parseXml), /No RuleSet elements found/);
});
