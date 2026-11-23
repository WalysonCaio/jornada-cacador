import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../dist/progress-ledger.js', import.meta.url), 'utf8'), context);
const helper = context.JCProgress;
const plain = value => JSON.parse(JSON.stringify(value));
const equal = (a, b, message) => assert.deepEqual(plain(a), plain(b), message);

assert.ok(helper && Object.isFrozen(helper));
const phone = {xp: 600, completed: {one: {score: 60, date: '2026-11-21'}}, xpLog: [{at: '2026-11-21', amount: 10, reason: 'quiz'}]};
const desktop = {xp: 1000, completed: {one: {score: 90, date: '2026-11-22'}, two: {score: 75, date: '2026-11-22'}}, xpLog: [{at: '2026-11-22', amount: 15, reason: 'review'}]};
const mergedLegacy = helper.mergeLearning(phone, desktop);
assert.equal(mergedLegacy.xp, 1000, 'overlapping legacy balances use MAX, not a sum or last writer');
assert.equal(mergedLegacy.completed.one.score, 90);
assert.equal(mergedLegacy.completed.one.date, '2026-11-21');
assert.equal(mergedLegacy.xpLog.length, 2);
equal(helper.mergeLearning(phone, desktop), helper.mergeLearning(desktop, phone), 'learning merge converges in either direction');
equal(phone, {xp: 600, completed: {one: {score: 60, date: '2026-11-21'}}, xpLog: [{at: '2026-11-21', amount: 10, reason: 'quiz'}]}, 'inputs stay unchanged');

const metadata = {at: '2026-11-23T10:00:00.000Z', ownerId: 'owner-one', campaignId: 'pmpe', resetEpoch: 4, access_token: 'NEVER_COPY', privateState: {token: 'NEVER_COPY'}};
const base = helper.normalizeLearning({xp: 1000});
const a = helper.awardLearning(base, 20, 'question', 'attempt:a', metadata);
const b = helper.awardLearning(base, 30, 'review', 'attempt:b', metadata);
const together = helper.mergeLearning(a, b);
assert.equal(together.xp, 1050, 'different offline events add exactly once');
assert.equal(together.xpLedger.legacyBase, 1000);
assert.equal(together.xpLedger.events['attempt:a'].ownerId, 'owner-one');
assert.equal(together.xpLedger.events['attempt:a'].resetEpoch, 4);
const longId = 'trail:' + 'conteudo-longo-'.repeat(100);
const longAward = helper.awardLearning(base, 5, 'trail', longId, metadata);
assert.equal(helper.normalizeLearning(plain(longAward)).xp, 1005);
assert.equal(helper.mergeLearning(longAward, base).xp, 1005);
const receipts = helper.mergeLearning({missionReceipts: {one: {at: '2026-11-21'}}}, {missionReceipts: {two: {at: '2026-11-22'}}});
assert.deepEqual(Object.keys(receipts.missionReceipts), ['one', 'two']);
assert.ok(!JSON.stringify(together).includes('NEVER_COPY'), 'award whitelists metadata and does not persist sessions or secrets');
equal(helper.awardLearning(a, 20, 'question', 'attempt:a', metadata), a, 'repeated award is idempotent');
equal(helper.mergeLearning(a, b), helper.mergeLearning(b, a));
equal(helper.mergeLearning(together, a), together, 'repeated merge never grants XP again');
assert.equal(helper.normalizeLearning({...plain(a), xp: 1100}).xp, 1100, 'a legacy writer increment is preserved conservatively');
assert.equal(helper.normalizeLearning({...plain(a), xp: 100}).xp, 1020, 'an old low raw balance cannot erase ledger events');
for (const invalid of [0, -1, NaN, Infinity, 10001, null, true, {}, '']) assert.equal(helper.awardLearning(base, invalid, '', 'invalid', metadata).xp, 1000);
const conflict = helper.awardLearning(base, 25, 'different same-id payload', 'attempt:a', {...metadata, at: '2026-11-23T11:00:00.000Z'});
equal(helper.mergeLearning(a, conflict), helper.mergeLearning(conflict, a), 'conflicting event IDs choose one deterministic record');
assert.equal(Object.keys(helper.mergeLearning(a, conflict).xpLedger.events).length, 1);

const sessions = [
  {id: 'same-mission', date: '2026-11-21T10:00:00Z', campaignId: 'pmpe', subject: 'Português', total: 10, correct: 6},
  {id: 'same-mission', date: '2026-11-22T10:00:00Z', campaignId: 'pmpe', subject: 'Português', total: 10, correct: 8}
];
assert.equal(helper.mergeScores(sessions, [sessions[0]]).length, 2, 'two sessions on one mission are retained');
equal(helper.mergeScores(sessions, [sessions[0]]), helper.mergeScores([sessions[0]], sessions));
assert.equal(helper.mergeScores([{sessionId: 'one', date: '2026-11-21', correct: 6}], [{sessionId: 'one', date: '2026-11-21', correct: 8}]).length, 1);
assert.equal(helper.mergeScores([{sessionId: 'one', campaignId: 'pmpe'}], [{sessionId: 'one', campaignId: 'prf'}]).length, 2, 'explicit session IDs retain campaign scope');

const masteryA = {'pmpe::pt::crase': {attempts: 10, correct: 7, bonus70Paid: true, subjectKey: 'pt', topicKey: 'crase'}, 'prf::pt::crase': {attempts: 2, correct: 1}};
const masteryB = {'pmpe::pt::crase': {attempts: 12, correct: 9, bonus85Paid: true, subjectKey: 'pt', topicKey: 'crase'}};
const mastery = helper.mergeTopicMastery(masteryA, masteryB);
assert.equal(mastery['pmpe::pt::crase'].attempts, 12, 'shared cumulative counters use MAX');
assert.equal(mastery['pmpe::pt::crase'].correct, 9);
assert.equal(mastery['pmpe::pt::crase'].mastery, 75);
assert.ok(mastery['pmpe::pt::crase'].bonus70Paid && mastery['pmpe::pt::crase'].bonus85Paid);
assert.equal(mastery['prf::pt::crase'].attempts, 2, 'other portals never combine counters');
equal(helper.mergeTopicMastery(masteryA, masteryB), helper.mergeTopicMastery(masteryB, masteryA));
const unsafe = helper.mergeTopicMastery({collision: {campaignId: 'pmpe', attempts: 10, correct: 8}}, {collision: {campaignId: 'prf', attempts: 20, correct: 19}});
assert.ok(unsafe.collision.scopeConflict && unsafe.collision.scopeConflicts.length === 2);
assert.ok(unsafe.collision.attempts === 10 || unsafe.collision.attempts === 20);

const hostile = JSON.parse('{"xp":0,"xpLedger":{"version":1,"legacyBase":0,"events":{"__proto__":{"points":5}}}}');
assert.equal(helper.normalizeLearning(hostile).xp, 5);
assert.equal({}.points, undefined, 'event IDs cannot change object prototypes');
console.log('r186 progress merge: legacy preservation, additive event XP, idempotency, scope, sessions and mastery passed');
