// Validação determinística: um JSON válido não é necessariamente uma correção válida.
export function validateEssayResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_ESSAY_RESULT');
  if (value.readable !== true) throw new Error('Redação ilegível ou leitura não confirmada. Envie uma imagem mais nítida; nenhuma nota foi atribuída.');
  if (!Array.isArray(value.criteria) || value.criteria.length !== 4) throw new Error('INVALID_ESSAY_CRITERIA');
  const criteria = value.criteria.map(c => {
    if (!c || typeof c.name !== 'string' || !c.name.trim() || typeof c.commentary !== 'string' || !c.commentary.trim() ||
        !Number.isFinite(c.max_score) || c.max_score <= 0 || !Number.isFinite(c.score) || c.score < 0 || c.score > c.max_score) {
      throw new Error('INVALID_ESSAY_CRITERION');
    }
    return {...c};
  });
  const max = criteria.reduce((sum, c) => sum + c.max_score, 0);
  const sum = criteria.reduce((total, c) => total + c.score, 0);
  if (Math.abs(max - 100) > 0.001 || !Number.isFinite(value.score) || Math.abs(value.score - sum) > 0.01) throw new Error('INCONSISTENT_ESSAY_SCORE');
  for (const key of ['diagnosis', 'line_observation', 'model_text']) {
    if (typeof value[key] !== 'string' || !value[key].trim()) throw new Error('INCOMPLETE_ESSAY_FEEDBACK');
  }
  for (const key of ['strengths', 'priority_plan', 'rewrite_suggestions']) {
    if (!Array.isArray(value[key]) || !value[key].length || value[key].some(x => typeof x !== 'string' || !x.trim())) throw new Error('INCOMPLETE_ESSAY_FEEDBACK');
  }
  if (!Array.isArray(value.improvements) || value.improvements.some(x => !x || ['category', 'problem', 'recommendation'].some(k => typeof x[k] !== 'string' || !x[k].trim()))) throw new Error('INVALID_ESSAY_IMPROVEMENTS');
  if (!Array.isArray(value.deviations) || value.deviations.some(x => !x || ['line', 'snippet', 'issue', 'suggestion'].some(k => typeof x[k] !== 'string'))) throw new Error('INVALID_ESSAY_DEVIATIONS');
  const notice = 'Nota estimada para fins pedagógicos; não substitui a correção oficial da banca.';
  return {...value, criteria, score: Math.round(sum * 100) / 100, diagnosis: `${value.diagnosis.trim()}\n${notice}`};
}
