/* Local recovery of a question workout. No network access or cross-account sharing. */
(function (root) {
  'use strict';
  const PREFIX = 'jornada-active-question-session-v174:';
  function scopeKey(scope) {
    if (!scope || !scope.userId || !scope.campaignId) return null;
    return PREFIX + encodeURIComponent(scope.userId) + ':' + encodeURIComponent(scope.campaignId) + ':' + encodeURIComponent(scope.kind || 'practice');
  }
  function timedRemainingSeconds(battle, nowMs = Date.now()) {
    if (!Number.isFinite(battle?.totalSeconds) || !Number.isFinite(battle?.startedAt) || !Number.isFinite(nowMs)) return 0;
    return Math.max(0, Math.min(battle.totalSeconds, battle.totalSeconds - Math.max(0, Math.floor((nowMs - battle.startedAt) / 1000))));
  }
  function createStore({ storage, fallbackStorage, now = Date.now, maxAgeMs = 7 * 86400000 } = {}) {
    const stores = [storage, fallbackStorage].filter(Boolean);
    function valid(payload, scope) {
      const battle = payload?.battle;
      return payload?.version === 1 && payload.scope?.userId === scope.userId &&
        payload.scope?.campaignId === scope.campaignId &&
        (payload.scope?.kind || 'practice') === (scope.kind || 'practice') &&
        Number(payload.scope?.resetEpoch || 0) === Number(scope.resetEpoch || 0) &&
        Number.isFinite(payload.savedAt) && payload.savedAt <= now() + 300000 &&
        now() - payload.savedAt <= maxAgeMs &&
        Array.isArray(battle?.questions) && battle.questions.length > 0 &&
        battle.questions.every(item => item && typeof item.statement === 'string' &&
          Array.isArray(item.options) && item.options.length >= 2 && item.options.length <= 5) &&
        Number.isInteger(battle.current) && battle.current >= 0 && battle.current < battle.questions.length &&
        ((scope.kind || 'practice') === 'timed'
          ? Number.isFinite(battle.startedAt) && battle.startedAt <= now() + 300000 && Number.isFinite(battle.totalSeconds) && battle.totalSeconds > 0 && !battle.finished &&
            typeof battle.sessionId === 'string' && battle.sessionId.length > 0 &&
            Array.isArray(battle.answers) && battle.answers.length === battle.questions.length &&
            battle.answers.every((answer, index) => answer === null || (Number.isInteger(answer) && answer >= 0 && answer < battle.questions[index].options.length)) &&
            Array.isArray(battle.eliminated) && battle.eliminated.length === battle.questions.length &&
            battle.eliminated.every((items, index) => Array.isArray(items) && items.every(option => Number.isInteger(option) && option >= 0 && option < battle.questions[index].options.length))
          : Number.isInteger(battle.correct) && battle.correct >= 0 && battle.correct <= battle.questions.length);
    }
    function read(scope) {
      const key = scopeKey(scope);
      if (!key) return null;
      const candidates = [];
      for (const target of stores) {
        try {
          const payload = JSON.parse(target.getItem(key) || 'null');
          if (valid(payload, scope)) candidates.push(payload);
          else if (payload) target.removeItem(key);
        } catch { try { target.removeItem(key); } catch {} }
      }
      return candidates.sort((a, b) => b.savedAt - a.savedAt)[0] || null;
    }
    function save(scope, value) {
      const key = scopeKey(scope);
      const payload = { version: 1, scope: { ...scope }, savedAt: now(), title: String(value?.title || 'Treino de Questões').slice(0, 200), battle: value?.battle };
      if (!key || !valid(payload, scope)) return null;
      let serialized;
      try { serialized = JSON.stringify(payload); } catch { return null; }
      for (let index = 0; index < stores.length; index++) {
        try {
          stores[index].setItem(key, serialized);
          // A fresh durable snapshot supersedes an older tab-only fallback.
          if (stores[index] === storage && fallbackStorage) try { fallbackStorage.removeItem(key); } catch {}
          return stores[index] === storage ? 'local' : 'session';
        } catch {}
      }
      return null;
    }
    function clear(scope) {
      const key = scopeKey(scope);
      if (key) for (const target of stores) try { target.removeItem(key); } catch {}
    }
    function clearAll() {
      for (const target of stores) {
        try {
          const keys = Array.from({ length: target.length }, (_, index) => target.key(index));
          for (const key of keys) if (key?.startsWith(PREFIX)) target.removeItem(key);
        } catch {}
      }
    }
    return { read, save, clear, clearAll };
  }
  root.JornadaQuestionSessions = { createStore, scopeKey, timedRemainingSeconds, prefix: PREFIX };
})(typeof window === 'undefined' ? globalThis : window);
