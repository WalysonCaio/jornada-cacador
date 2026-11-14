// Public question projection: never repairs a missing key by guessing A.
export function normalizeSharedQuestion(value, defaults = {}) {
  if (!value || typeof value !== 'object' || !String(value.statement ?? '').trim()) return null;
  if (!Array.isArray(value.options) || value.options.length < 2 || value.options.length > 5) return null;
  const options = value.options.map(option => String(option ?? '').trim());
  if (options.some(option => !option) || new Set(options.map(option => option.toLocaleLowerCase('pt-BR'))).size !== options.length) return null;
  const raw = value.correct_index;
  const valid = raw !== null && raw !== undefined && typeof raw !== 'boolean' && typeof raw !== 'object' &&
    String(raw).trim() !== '' && Number.isInteger(Number(raw)) && Number(raw) >= 0 && Number(raw) < options.length && !value.answer_unknown;
  return {
    subject: String(value.subject || defaults.subject || 'Conteúdo Geral'),
    topic: String(value.topic || defaults.topic || 'Assunto não informado'),
    board: String(value.board || defaults.board || 'Banca não informada'),
    difficulty: ['facil', 'medio', 'dificil'].includes(value.difficulty) ? value.difficulty : 'medio',
    origin: String(value.origin || defaults.origin || 'importada'),
    statement: String(value.statement).trim(),
    options,
    correct_index: valid ? Number(raw) : -1,
    explanation: String(value.explanation || ''),
    ...(value.source || defaults.source ? {source: String(value.source || defaults.source)} : {}),
    ...(value.exam_title ? {exam_title: String(value.exam_title)} : {}),
    ...(value.exam_year !== null && value.exam_year !== undefined && String(value.exam_year).trim() !== '' && Number.isInteger(Number(value.exam_year)) ? {exam_year: Number(value.exam_year)} : {}),
    ...(value.key_reference ? {key_reference: String(value.key_reference)} : {}),
    ...(valid ? {} : {answer_unknown: true}),
    ...(value.key_source ? {key_source: String(value.key_source)} : {}),
    ...(value.answer_key_validation ? {answer_key_validation: String(value.answer_key_validation)} : {}),
    ...(value.annulled || value.anulada ? {annulled: true} : {}),
  };
}
