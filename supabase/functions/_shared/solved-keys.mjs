export function validatedSuggestedKeys(originals, generated) {
  if (!Array.isArray(originals) || !Array.isArray(generated)) return [];
  const normalize = text => String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  return originals.flatMap((original, index) => {
    const matches = generated.filter(item => normalize(item?.statement) === normalize(original?.statement));
    if (matches.length !== 1 || !normalize(original?.statement)) return [];
    const match = matches[0], options = original.options;
    if (!Array.isArray(options) || !Array.isArray(match.options) || options.length !== match.options.length ||
        options.some((text, i) => normalize(text) !== normalize(match.options[i]))) return [];
    const raw = match.correct_index;
    if (raw === null || raw === undefined || String(raw).trim() === '' || !Number.isInteger(Number(raw)) || Number(raw) < 0 || Number(raw) >= options.length || !normalize(match.explanation)) return [];
    return [{index: original.index ?? index, correct_index:Number(raw), explanation:'🤖 [Gabarito sugerido pela IA — confira no gabarito oficial quando disponível] '+normalize(match.explanation),key_source:'ia_sugerido',origin:'adaptada_do_pdf'}];
  });
}
