/* Account-independent partition of the actual records and actual training pool.
 * Counts describe the selected pool; they never manufacture a replacement pool. */
(function(root){
  'use strict';
  function partition(records,ready,classifyExcluded){
    const source=Array.isArray(records)?records:[],pool=Array.isArray(ready)?ready:[];
    const remaining=new Map();
    for(const item of pool)remaining.set(item,(remaining.get(item)||0)+1);
    const result={total:source.length,available:pool.length,availableInStore:0,review:0,pendingKey:0,annulled:0,otherFilters:0,supplemental:0};
    for(const item of source){
      const count=remaining.get(item)||0;
      if(count){remaining.set(item,count-1);result.availableInStore++;continue}
      const reason=typeof classifyExcluded==='function'?classifyExcluded(item):'otherFilters';
      if(['review','pendingKey','annulled'].includes(reason))result[reason]++;
      else result.otherFilters++;
    }
    result.supplemental=pool.length-result.availableInStore;
    return Object.freeze(result);
  }
  function describe(counts){
    if(!counts)return '';
    const parts=[`${counts.total} questões no aparelho`,`${counts.availableInStore} prontas neste filtro`];
    if(counts.review)parts.push(`${counts.review} aguardam revisão do conteúdo ou classificação`);
    if(counts.pendingKey)parts.push(`${counts.pendingKey} sem gabarito validado`);
    if(counts.annulled)parts.push(`${counts.annulled} anuladas`);
    if(counts.otherFilters)parts.push(`${counts.otherFilters} fora dos filtros ou do modo selecionado`);
    if(counts.supplemental)parts.push(`${counts.supplemental} disponíveis na base complementar deste modo`);
    return parts.join(' · ')+'.';
  }
  root.JCQuestionAvailability=Object.freeze({partition,describe});
})(typeof window==='undefined'?globalThis:window);
