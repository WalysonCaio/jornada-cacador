/* Deterministic PDF typography and question-boundary checks. No missing
 * question or answer key is inferred; source evidence stays on review copies. */
(function(root){
  'use strict';
  const typographyCache=new Map(),questionCache=new WeakMap();
  // Keep code, formulas, URLs and quoted typography examples byte-for-byte.
  const protectedPattern=/```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`|\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|https?:\/\/[^\s]+|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi;
  function protectedRanges(text){return [...text.matchAll(protectedPattern)].map(match=>({start:match.index,end:match.index+match[0].length}));}
  function isProtected(index,ranges){return ranges.some(range=>index>=range.start&&index<range.end);}
  function normalizeProseLine(value){
    if(/[=<>]|\?[^\n]*:|\b(?:const|let|var|return|function|SELECT|FROM)\b|=>|\{[^}]*\}/.test(value))return value;
    // No general single-letter join: A, O, E and unknown fragments are words.
    let text=value.normalize('NFC').replace(/[\u00a0\u202f]/g,' ');
    for(const [pattern,replacement]of [[/\bs[ \t]+empre\b/gi,'sempre'],[/\bresponsáve[ \t]+l\b/gi,'responsável'],[/\bilegal[ \t]+idade\b/gi,'ilegalidade'],[/\breportag[ \t]+em\b/gi,'reportagem'],[/\ble[ \t]+i\b/gi,'lei']]){
      text=text.replace(pattern,match=>/^[A-ZÁÉÍÓÚÇ]/.test(match)?replacement[0].toUpperCase()+replacement.slice(1):replacement);
    }
    // A finite verb vocabulary avoids treating identifiers (foo - se, let - me)
    // as Portuguese enclisis. Unknown forms await geometry/source evidence.
    text=text.replace(/\b(fazê|faze|aplica|aplicar|aplicam|considera|considerar|deve|dever|trata|tratar|refere|referir|assegura|garante|pode|podem|permite|observa|exige|admite|configura|dispõe|realiza|utiliza|torna|cabe|concede|conceder|diz)[ \t]+-[ \t]+(lo|la|los|las|lhe|lhes|me|te|se|nos|vos)\b/giu,'$1-$2');
    text=text.replace(/\b(habeas)[ \t]+-[ \t]+(corpus)\b/giu,'$1-$2').replace(/\b(licença)[ \t]+-[ \t]+(maternidade|paternidade)\b/giu,'$1-$2');
    return text.replace(/[ \t]+([,.;:!?])/g,'$1');
  }
  function normalizeProse(value){return value.split(/(\r?\n)/).map(normalizeProseLine).join('');}
  function normalizeTypography(value){
    const raw=String(value??'');
    if(raw.length<=4000&&typographyCache.has(raw))return typographyCache.get(raw);
    let cursor=0,text='';
    for(const range of protectedRanges(raw)){text+=normalizeProse(raw.slice(cursor,range.start))+raw.slice(range.start,range.end);cursor=range.end;}
    text+=normalizeProse(raw.slice(cursor));
    if(raw.length<=4000){if(typographyCache.size>=5000)typographyCache.clear();typographyCache.set(raw,text);}
    return text;
  }
  function quotedAt(text,index){
    let quote='';
    for(let i=0;i<index;i++){
      const c=text[i];
      if(c==='\\'){i++;continue;}
      if(!quote&&['"','“','‘'].includes(c))quote=c==='“'?'”':c==='‘'?'’':'"';
      else if(quote&&c===quote)quote='';
      else if(!quote&&c==="'"&&!/[\p{L}\d]/u.test(text[i-1]||' '))quote="'";
    }
    return Boolean(quote);
  }
  function optionLabels(text,ranges=[]){
    return [...text.matchAll(/(?:^|[\s;:])(?:\([ \t]*)?([a-e])[ \t]*[).][ \t\r\n]+(?=\S)/gi)]
      .map(match=>({letter:match[1].toLowerCase(),index:match.index+(match[0].length-match[0].trimStart().length)}))
      .filter(label=>!isProtected(label.index,ranges)&&!quotedAt(text,label.index));
  }
  function optionSequence(labels){return labels.find((label,index)=>label.letter==='a'&&labels[index+1]?.letter==='b'&&labels[index+2]?.letter==='c');}
  function analyzeOption(value){
    const raw=String(value??''),ranges=protectedRanges(raw),labels=optionLabels(raw,ranges),candidates=[];
    function add(index,kind,canCut=true){
      if(index<0||isProtected(index,ranges)||quotedAt(raw,index))return;
      const prefix=raw.slice(0,index),trimmed=prefix.trimEnd();
      if(trimmed.length<5||!/[.!?][\s\r\n]*$/.test(prefix))return;
      candidates.push({index,kind,canCut});
    }
    for(const match of raw.matchAll(/\bGABARITO[ \t\r\n]+COMENTADO(?:[ \t]*[-–—:]?[ \t]*BLOCO[ \t]*\d+)?/gi))add(match.index,'answer_key_header');
    // A bare block label needs its own line and page/number-style suffix.
    for(const match of raw.matchAll(/(?:^|\n)[ \t]*(BLOCO[ \t]+\d+(?:[ \t]+\d+\.)?)[ \t]*(?=\r?\n|$)/g))add(match.index+match[0].indexOf(match[1]),'block_header');
    const command=/\b(?:Assinale[ \t\r\n]+(?:a|o)[ \t\r\n]+(?:alternativa|opção|item)\b|Julgue[ \t\r\n]+(?:os?[ \t\r\n]+)?itens?\b|Marque[ \t\r\n]+(?:a|o)[ \t\r\n]+(?:opção|alternativa|item)\b)/gi;
    for(const match of raw.matchAll(command))add(match.index,'following_question',Boolean(optionSequence(labels.filter(label=>label.index>match.index))));
    for(const match of raw.matchAll(/\((?:FUNCAB|AOCP|CESPE|CEBRASPE|FGV|FCC|VUNESP|IBFC)\)[ \t\r\n]+/gi))add(match.index,'following_board_question',Boolean(optionSequence(labels.filter(label=>label.index>match.index))));
    const sequence=optionSequence(labels);
    if(sequence){
      const prefix=raw.slice(0,sequence.index);
      const listIntro=/\b(?:hipóteses|seguintes|itens|inclui|lista|casos|etapas|categorias|exemplos|alíneas|requisitos|regras)\b[^.!?]*[.!?:]?[\s\r\n]*$/i.test(prefix);
      if(!listIntro&&/[.!?][ \t\r\n]+/.test(prefix)&&!quotedAt(raw,sequence.index))candidates.push({index:sequence.index,kind:'nested_options',canCut:false});
    }
    candidates.sort((a,b)=>a.index-b.index);
    const leak=candidates[0];
    if(!leak)return{text:normalizeTypography(raw),needs_review:false,raw};
    const retainedRaw=leak.canCut?raw.slice(0,leak.index).trimEnd():raw;
    return{text:normalizeTypography(retainedRaw),needs_review:true,kind:leak.kind,raw,leaked_text:raw.slice(leak.index),cut_index:leak.canCut?leak.index:null,retained_raw:retainedRaw};
  }
  function analyzeQuestion(item){
    if(!item||typeof item!=='object')return{needs_review:false,options:[],leaks:[]};
    const options=Array.isArray(item.options)?item.options:[],pending=item.text_integrity_review?.pending===true;
    const cached=questionCache.get(item);
    if(cached&&cached.pending===pending&&cached.options.length===options.length&&cached.options.every((value,index)=>value===options[index]))return cached.result;
    const analyses=options.map(analyzeOption),leaks=analyses.flatMap((result,index)=>result.needs_review?[{index,...result}]:[]);
    const needsReview=pending||leaks.length>0;
    const result={needs_review:needsReview,needs_source:needsReview,options:analyses.map(result=>result.text),leaks,
      reason:needsReview?'Uma alternativa pode incluir outra questão ou cabeçalho de gabarito. O original e o gabarito anterior foram preservados para conferir a página do PDF antes de liberar o treino.':'Texto disponível para conferência.'};
    questionCache.set(item,{options:[...options],pending,result});return result;
  }
  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  function cleanQuestion(item,sourceEvidence){
    if(!item||typeof item!=='object')return item;
    const analysis=analyzeQuestion(item),copy={...item};
    for(const key of ['statement','question','associated_text','command','explanation'])if(typeof copy[key]==='string')copy[key]=normalizeTypography(copy[key]);
    if(Array.isArray(copy.options))copy.options=analysis.options;
    if(analysis.needs_review){
      const snapshot={};
      for(const key of ['statement','question','associated_text','command','options','correct_index','key_source','answer_key_validation','key_reference','answer_key_history','answer_unknown','annulled','anulada','suggested_correct_index','explanation','explanation_needs_review'])if(Object.hasOwn(item,key))snapshot[key]=clone(item[key]);
      if(sourceEvidence!==undefined)snapshot.source_text=String(sourceEvidence);
      const previous=item.text_integrity_review;
      copy.text_integrity_review={version:1,pending:true,original:clone(previous?.original||snapshot),leaks:analysis.leaks.length?analysis.leaks.map(({index,kind,raw,leaked_text,text,cut_index,retained_raw})=>({index,kind,raw,leaked_text,retained_text:text,retained_raw,cut_index})):clone(previous?.leaks||[])};
      copy.needs_source=true;copy.structure_needs_review=true;copy.quality_status='alternative_leak';copy.quality_reason=analysis.reason;
      copy.answer_unknown=true;copy.correct_index=-1;copy.answer_key_validation='pendente_revisao_fonte';copy.explanation_needs_review=true;
      if(item.key_source==='manual_revisado'||item.key_source==='manual')copy.answer_key_override_stale=true;
    }
    return copy;
  }
  root.JCQuestionText=Object.freeze({normalizeTypography,analyzeOption,analyzeQuestion,cleanQuestion});
})(typeof window==='undefined'?globalThis:window);
