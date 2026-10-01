import { QUESTIONS } from './questions.js';
import { baseQuestionId, nextQuestionId } from './flow.js';
import { FORM_PREVIEW_ASSETS, REGIONS } from './form-preview-v2.js';

// A paper region opens only its related questions. No unrelated answers are invented.
export const PAPER_GROUPS_V4 = Object.freeze({
  identity:{title:'氏名・住所・勤務先',start:null,stops:[]},
  salary:{title:'あなたの給与と基礎控除',start:'target',stops:['spouse','end']},
  spouse:{title:'配偶者',start:'spouse',stops:['dependents']},
  dependents:{title:'扶養する家族',start:'dependents',stops:['disabilitySelf']},
  disability:{title:'障害者',start:'disabilitySelf',stops:['parentStatus']},
  family:{title:'ひとり親・寡婦',start:'parentStatus',stops:['student']},
  student:{title:'勤労学生',start:'student',stops:['life']},
  life:{title:'生命保険料',start:'life',stops:['earthquake']},
  earthquake:{title:'地震保険料',start:'earthquake',stops:['social']},
  social:{title:'社会保険料',start:'social',stops:['ideco']},
  ideco:{title:'iDeCoなど',start:'ideco',stops:['housing']},
  housing:{title:'住宅ローン',start:'housing',stops:['special']},
  special:{title:'そのほかの事情',start:'special',stops:['result']}
});

export const PAPER_TABS_V4 = Object.freeze([
  {id:'dependentForm',asset:'fuyou',short:'家族・本人の用紙',groups:['identity','salary','spouse','dependents','disability','family','student','special']},
  {id:'combinedForm',asset:'combined',short:'所得・控除の用紙',groups:['identity','salary','spouse','dependents','disability','special']},
  {id:'insuranceForm',asset:'insurance',short:'保険料の用紙',groups:['identity','life','earthquake','social','ideco','dependents','special']}
]);

const REGION_GROUP_V4 = Object.freeze({
  fuyouHead:'identity',fuyouSpouse:'spouse',fuyouDependent:'dependents',fuyouUnder16:'dependents',
  fuyouDisability:'disability',fuyouParent:'family',fuyouStudent:'student',
  basicIncome:'salary',basicOtherIncome:'salary',basicDeduction:'salary',combinedSpouse:'spouse',
  spouseIncome:'spouse',spouseDeduction:'spouse',specificRelative:'dependents',incomeAdjustment:'salary',
  lifeGeneral:'life',lifeCare:'life',lifePension:'life',lifeTotal:'life',quake:'earthquake',social:'social',ideco:'ideco'
});

export function paperZonesV4(tabId){
 const tab=PAPER_TABS_V4.find(x=>x.id===tabId);
 if(!tab)return [];
 const owner=tab.asset==='combined'?{id:'combinedHead',group:'identity',title:'本人と勤務先の欄',mark:[487,86,1320,185],asset:FORM_PREVIEW_ASSETS.combined}:
  tab.asset==='insurance'?{id:'insuranceHead',group:'identity',title:'本人と勤務先の欄',mark:[400,87,1520,216],asset:FORM_PREVIEW_ASSETS.insurance}:null;
 return [...(owner?[owner]:[]),...Object.entries(REGION_GROUP_V4).filter(([id])=>REGIONS[id].asset===tab.asset)
  .map(([id,group])=>({id,group,title:REGIONS[id].title,mark:REGIONS[id].mark,asset:FORM_PREVIEW_ASSETS[tab.asset]}))];
}

export function groupSequenceV4(groupId,answers={}){
 const group=PAPER_GROUPS_V4[groupId];
 if(!group?.start)return [];
 const sequence=[];let id=group.start;
 for(let i=0;i<1500;i++){
  if(group.stops.includes(id))return sequence;
  if(!QUESTIONS[baseQuestionId(id)])throw new Error(`Unknown question: ${id}`);
  sequence.push(id);
  if(!Object.hasOwn(answers,id))return sequence;
  id=nextQuestionId(id,answers[id],{answers});
  if(!id)throw new Error(`No transition from ${sequence.at(-1)}`);
 }
 throw new Error(`Question route too long: ${groupId}`);
}

export function groupStatusV4(groupId,answers={}){
 if(groupId==='identity')return 'manual';
 const sequence=groupSequenceV4(groupId,answers),pending=sequence.find(id=>!Object.hasOwn(answers,id));
 if(pending)return sequence.some(id=>Object.hasOwn(answers,id))?'in_progress':'not_started';
 return sequence.some(id=>answers[id]==='分からない'||Array.isArray(answers[id])&&answers[id].includes('分からない'))?'needs_confirmation':'complete';
}

export function groupPendingV4(groupId,answers={}){
 return groupSequenceV4(groupId,answers).find(id=>!Object.hasOwn(answers,id))||null;
}

// Hide calculations whose prerequisite group has not been answered. Identity
// fields are explicit inputs and may be shown independently of tax answers.
export function visiblePaperEntryV4(entry,answers={}){
 const key=entry.key;
 if(key.startsWith('identity-'))return true;
 const done=id=>['complete','needs_confirmation'].includes(groupStatusV4(id,answers));
 if(key.startsWith('dependent-')||key.startsWith('specific-'))return done('dependents');
 if(key==='spouse-salary-revenue')return typeof answers.spouseSalary==='number';
 if(key.startsWith('spouse-')||key.startsWith('withholding-spouse'))return done('spouse')&&done('salary');
 const contract=key.match(/^(life|earthquake)-contract-(\d+)-/);
 if(contract){
  const prefix=`${contract[1]}:${contract[2]}:`;
  return typeof answers[prefix+'amount']==='number'&&answers[prefix+'paid']==='はい';
 }
 if(key.startsWith('life-')){
  if(!done('life'))return false;
  if(key.includes('deduction'))return done('dependents');
  return true;
 }
 if(key.startsWith('earthquake-')||key.startsWith('old-long-term-'))return done('earthquake');
 if(key.startsWith('social-'))return done('social');
 if(key.startsWith('mutual-aid-'))return done('ideco');
 if(key.startsWith('disability-'))return done('disability')&&done('dependents');
 if(key.startsWith('parent-'))return done('family')&&done('salary');
 if(key.startsWith('student-'))return done('student')&&done('salary');
 if(key==='salary-revenue')return typeof (answers.allSalary??answers.ownSalary)==='number';
 if(['salary-income','total-income','basic-deduction','non-salary-income'].includes(key)){
  if(!done('salary'))return false;
  const gross=answers.allSalary??answers.ownSalary;
  return !(typeof gross==='number'&&gross>8500000)||done('dependents')&&done('disability');
 }
 return false;
}

export function paperPreflightDetailsV4(tabId,answers,identity,guide,page){
 const tab=PAPER_TABS_V4.find(x=>x.id===tabId);if(!tab)return [];
 const items=[],add=(message,group=null)=>items.push({message,group});
 if(!identity.taxpayer?.name)add('本人の氏名が未入力です。用紙へ手書きする場合も確認してください。','identity');
 if(!identity.taxpayer?.address)add('本人の住所が未入力です。用紙へ手書きする場合も確認してください。','identity');
 if(!identity.employer?.name)add('勤務先の名称が未入力です。会社が記入する場合は案内を確認してください。','identity');
 const emptyOwner=[['フリガナ',identity.taxpayer?.kana],['勤務先の所在地',identity.employer?.address],...(tabId==='dependentForm'?[['郵便番号',identity.taxpayer?.postalCode],['生年月日',identity.taxpayer?.birthDate],['世帯主の氏名',identity.taxpayer?.householdName],['世帯主の、あなたとの続柄',identity.taxpayer?.householdRelationship]]:[])].filter(([,value])=>!value).map(([label])=>label);
 if(emptyOwner.length)add(`本人・勤務先の未入力欄：${emptyOwner.join('、')}。`,'identity');
 if(answers.target==='いいえ')add('この会社では年末調整を受けない回答です。申告先を確認してください。','salary');
 for(const id of tab.groups){
  if(id==='identity')continue;
  if(tabId==='insuranceForm'&&id==='dependents'&&answers.life!=='はい')continue;
  const status=groupStatusV4(id,answers);
  if(status==='not_started'||status==='in_progress')add(`${PAPER_GROUPS_V4[id].title}：質問がまだ終わっていません。`,id);
  if(status==='needs_confirmation')add(`${PAPER_GROUPS_V4[id].title}：「分からない」の回答があります。`,id);
 }
 if(answers.spouse==='はい'&&tabId!=='insuranceForm'){
  const missing=[['氏名',identity.spouse?.name],['フリガナ',identity.spouse?.kana],['生年月日',identity.spouse?.birthDate]].filter(([,value])=>!value).map(([label])=>label);
  if(missing.length)add(`配偶者の未入力欄：${missing.join('、')}。`,'identity');
 }
 if(answers.dependents==='はい'&&tabId!=='insuranceForm')for(let i=0;i<Number(answers.depCount||0);i++){
  const person=identity.dependents?.[i]||{},missing=[['氏名',person.name],['フリガナ',person.kana],['生年月日',person.birthDate],['続柄',person.relationship]].filter(([,value])=>!value).map(([label])=>label);
  if(missing.length)add(`${i+1}人目の家族の未入力欄：${missing.join('、')}。`,'identity');
 }
 if(tabId==='dependentForm')add('A欄、該当チェック、個人番号などは自動完成の対象外です。会社の案内と用紙を確認してください。');
 if(tabId==='combinedForm')add('判定区分・計算の途中欄など、自動転記しない欄を用紙で確認してください。');
 if(tabId==='insuranceForm')add('契約数が用紙の行数を超える場合は添付別紙と証明書を確認してください。');
 const documents=(guide.requiredDocuments||[]).filter(x=>tabId==='insuranceForm'?/保険|年金|共済|iDeCo|支払額|別紙/.test(x):/源泉徴収票/.test(x));
 if(documents.length)add(`用意する書類・証明書：${documents.join('、')}。`);
 for(const message of page?.notes||[])add(message);
 for(const message of guide.identityWarnings||[])add(message,'identity');
 for(const message of guide.staffConfirmations||[])if(answers.form!==undefined||!message.startsWith('扶養控除等申告書を提出済みか'))add(message);
 const unique=new Map();
 for(const item of items)if(!unique.has(item.message))unique.set(item.message,item);
 return [...unique.values()];
}

export function paperPreflightV4(tabId,answers,identity,guide,page){
 return paperPreflightDetailsV4(tabId,answers,identity,guide,page).map(item=>item.message);
}
