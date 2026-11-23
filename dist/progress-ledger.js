/* Offline progress merge primitives. Legacy balances overlap, so only event IDs
 * can prove that XP earned on two devices is additional. No account/session is
 * read here: callers must validate the owner, portal and reset epoch first. */
(function (root) {
  'use strict';
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const object = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
  const put = (target, key, value) => Object.defineProperty(target, key, {value, enumerable: true, writable: true, configurable: true});
  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (!object(value)) return value;
    const result = {};
    Object.keys(value).sort().forEach(key => put(result, key, clone(value[key])));
    return result;
  }
  const stable = value => JSON.stringify(clone(value));
  const text = (value, limit = 256) => typeof value === 'string' ? value.slice(0, limit) : '';
  function number(value, fallback = 0) {
    if (typeof value !== 'number' && typeof value !== 'string') return fallback;
    if (typeof value === 'string' && !value.trim()) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= Number.MAX_SAFE_INTEGER ? parsed : fallback;
  }
  const winner = (a, b) => a === undefined ? clone(b) : b === undefined ? clone(a) : clone(stable(a) >= stable(b) ? a : b);
  function mergeObject(a, b) {
    const result = {};
    const left = object(a) ? a : {}, right = object(b) ? b : {};
    [...new Set([...Object.keys(left), ...Object.keys(right)])].sort().forEach(key => put(result, key, winner(left[key], right[key])));
    return result;
  }
  function dateValue(value) {
    if (typeof value !== 'string' || !value || !Number.isFinite(Date.parse(value))) return null;
    return value;
  }
  function dateChoice(a, b, earliest) {
    const dates = [dateValue(a), dateValue(b)].filter(Boolean);
    dates.sort((x, y) => Date.parse(x) - Date.parse(y) || x.localeCompare(y));
    return dates.length ? dates[earliest ? 0 : dates.length - 1] : winner(a, b);
  }
  function sanitizeEvent(value) {
    if (!object(value)) return null;
    const points = number(value.points);
    if (!(points > 0 && points <= 10000)) return null;
    const event = {points, reason: text(value.reason, 500), at: text(value.at, 64), campaignId: text(value.campaignId), ownerId: text(value.ownerId)};
    if (own(value, 'resetEpoch') && number(value.resetEpoch, -1) >= 0) event.resetEpoch = number(value.resetEpoch);
    return event;
  }
  function eventsFrom(value) {
    const result = {};
    if (!object(value)) return result;
    Object.keys(value).sort().forEach(id => {
      if (!id || id.length > 2048) return;
      const event = sanitizeEvent(value[id]);
      if (event) put(result, id, event);
    });
    return result;
  }
  const eventSum = events => Object.values(events).reduce((sum, event) => sum + event.points, 0);
  function normalizeLearning(learning) {
    const result = object(learning) ? clone(learning) : {};
    const validLedger = object(result.xpLedger) && result.xpLedger.version === 1;
    const events = eventsFrom(validLedger ? result.xpLedger.events : {});
    const earned = eventSum(events);
    // Older clients can still increment raw XP. Preserve the excess as an
    // overlapping legacy baseline; never turn it into an additive event.
    const legacyBase = Math.max(number(validLedger ? result.xpLedger.legacyBase : 0), Math.max(0, number(result.xp) - earned));
    result.xpLedger = {version: 1, legacyBase, events};
    result.xp = legacyBase + earned;
    return result;
  }
  function unionRecords(a, b, identity) {
    const records = new Map();
    [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].forEach(record => {
      if (!object(record)) return;
      const id = identity(record);
      records.set(id, winner(records.get(id), record));
    });
    return [...records.entries()].sort(([ka, va], [kb, vb]) => {
      const da = Date.parse(va.date || va.at || va.finishedAt || '') || 0;
      const db = Date.parse(vb.date || vb.at || vb.finishedAt || '') || 0;
      return da - db || ka.localeCompare(kb);
    }).map(([, record]) => record);
  }
  function scope(record) {
    return [record.ownerId || record.userId || '', record.campaignId || record.campaign_id || ''];
  }
  function scoreIdentity(record) {
    const explicit = record.sessionId || record.attemptId || record.recordId || record.session_id || record.attempt_id;
    if (typeof explicit === 'string' && explicit.trim()) return stable(['session', ...scope(record), explicit]);
    // Legacy `id` is commonly a mission ID, shared by many attempts.
    return stable(['legacy', ...scope(record), record.date || record.at || record.finishedAt || '', record.missionId || record.id || '', record.subject || record.subjectKey || '', record.topic || record.topicKey || '', record.total ?? '', record.correct ?? '', record.mode || '']);
  }
  const mergeScores = (a, b) => unionRecords(a, b, scoreIdentity);
  function mergeCompleted(a, b) {
    const result = mergeObject(a, b);
    Object.keys(result).forEach(key => {
      const left = object(a) && own(a, key) ? a[key] : undefined;
      const right = object(b) && own(b, key) ? b[key] : undefined;
      if (object(left) || object(right)) {
        const value = mergeObject(left, right);
        if ((object(left) && own(left, 'score')) || (object(right) && own(right, 'score'))) value.score = Math.max(number(left && left.score), number(right && right.score));
        if ((left && left.date) || (right && right.date)) value.date = dateChoice(left && left.date, right && right.date, true);
        put(result, key, value);
      } else if (typeof left === 'boolean' || typeof right === 'boolean') put(result, key, Boolean(left || right));
    });
    return result;
  }
  function logIdentity(record) {
    const id = record.eventId || record.event_id;
    return id ? stable(['event', ...scope(record), id]) : stable(['legacy', ...scope(record), record.at || record.date || '', record.amount ?? record.points ?? '', record.reason || '']);
  }
  function mergeLearning(a, b) {
    const left = normalizeLearning(a), right = normalizeLearning(b);
    const result = mergeObject(left, right);
    const events = mergeObject(left.xpLedger.events, right.xpLedger.events);
    result.xpLedger = {version: 1, legacyBase: Math.max(left.xpLedger.legacyBase, right.xpLedger.legacyBase), events};
    result.xp = result.xpLedger.legacyBase + eventSum(events);
    if (own(left, 'completed') || own(right, 'completed')) result.completed = mergeCompleted(left.completed, right.completed);
    if (own(left, 'missionReceipts') || own(right, 'missionReceipts')) result.missionReceipts = mergeObject(left.missionReceipts, right.missionReceipts);
    if (own(left, 'xpLog') || own(right, 'xpLog')) result.xpLog = unionRecords(left.xpLog, right.xpLog, logIdentity);
    return result;
  }
  function awardLearning(learning, points, reason, eventId, metadata) {
    const result = normalizeLearning(learning);
    const amount = number(points);
    if (!(amount > 0 && amount <= 10000) || typeof eventId !== 'string' || !eventId || eventId.length > 2048 || own(result.xpLedger.events, eventId)) return result;
    const details = object(metadata) ? metadata : {};
    const event = sanitizeEvent({points: amount, reason, at: details.at || new Date().toISOString(), campaignId: details.campaignId, ownerId: details.ownerId, ...(own(details, 'resetEpoch') ? {resetEpoch: details.resetEpoch} : {})});
    put(result.xpLedger.events, eventId, event);
    result.xp = result.xpLedger.legacyBase + eventSum(result.xpLedger.events);
    result.xpLog = unionRecords(result.xpLog, [{eventId, at: event.at, amount, reason: event.reason, campaignId: event.campaignId, ownerId: event.ownerId}], logIdentity);
    return result;
  }
  function masteryScope(record) {
    return ['ownerId', 'campaignId', 'subjectKey', 'topicKey'].map(key => text(record && record[key]));
  }
  function incompatibleScope(a, b) {
    const left = masteryScope(a), right = masteryScope(b);
    return left.some((value, index) => value && right[index] && value !== right[index]);
  }
  function mergeTopicMastery(a, b) {
    const left = object(a) ? a : {}, right = object(b) ? b : {};
    const result = {};
    [...new Set([...Object.keys(left), ...Object.keys(right)])].sort().forEach(key => {
      const first = object(left[key]) ? left[key] : {}, second = object(right[key]) ? right[key] : {};
      // A key collision with explicit different scope cannot be safely added.
      // Retain both originals for review, with a deterministic visible winner.
      if (incompatibleScope(first, second)) {
        const record = winner(first, second);
        record.scopeConflict = true;
        record.scopeConflicts = unionRecords([first], [second], value => stable(masteryScope(value)));
        put(result, key, record);
        return;
      }
      const record = mergeObject(first, second);
      record.attempts = Math.max(number(first.attempts), number(second.attempts));
      record.correct = Math.min(record.attempts, Math.max(number(first.correct), number(second.correct)));
      record.mastery = Number((record.attempts < 5 ? record.correct * 20 : record.correct / record.attempts * 100).toFixed(2));
      record.bonus70Paid = Boolean(first.bonus70Paid || second.bonus70Paid);
      record.bonus85Paid = Boolean(first.bonus85Paid || second.bonus85Paid);
      if (first.lastAttemptAt || second.lastAttemptAt) record.lastAttemptAt = dateChoice(first.lastAttemptAt, second.lastAttemptAt, false);
      put(result, key, record);
    });
    return result;
  }
  root.JCProgress = Object.freeze({normalizeLearning, mergeLearning, awardLearning, mergeScores, mergeTopicMastery});
})(typeof window !== 'undefined' ? window : globalThis);
