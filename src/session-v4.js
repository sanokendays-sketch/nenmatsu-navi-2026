import { QUESTIONS } from './questions.js';
import { baseQuestionId } from './flow.js';
import { validateIdentityV3 } from './identity-v3.js';
import { PAPER_GROUPS_V4, PAPER_TABS_V4, groupSequenceV4 } from './paper-first-v4.js';

const FORMAT='nenmatsu-navi-v4-draft';
const YEAR=2026;
const ROUTE=/^(?:[A-Za-z][A-Za-z0-9]*|(?:dep|life|earthquake):[1-9]\d{0,2}:[A-Za-z][A-Za-z0-9]*|disability:(?:spouse|dep:[1-9]\d{0,2}):(?:level|cohabit))$/;

export function serializeDraftV4(answers,identity,tabId){
 return JSON.stringify({format:FORMAT,version:1,year:YEAR,savedAt:new Date().toISOString(),answers,identity,tabId},null,2);
}

export function readDraftV4(text){
 if(typeof text!=='string'||text.length>1000000)throw new Error('作業ファイルが大きすぎます。');
 let raw;
 try{raw=JSON.parse(text);}catch{throw new Error('JSON形式の作業ファイルを読み取れませんでした。');}
 if(!raw||raw.format!==FORMAT||raw.version!==1||raw.year!==YEAR)throw new Error('このv4・令和8年分の作業ファイルではありません。');
 if(!raw.answers||Array.isArray(raw.answers)||typeof raw.answers!=='object')throw new Error('回答データが正しくありません。');
 if(!raw.identity||Array.isArray(raw.identity)||typeof raw.identity!=='object'||!Array.isArray(raw.identity.dependents)||raw.identity.dependents.length>10)throw new Error('氏名・住所のデータが正しくありません。');
 const entries=Object.entries(raw.answers);
 if(entries.length>5000)throw new Error('回答数が多すぎます。');
 const answers={};
 for(const [id,value] of entries){
  if(!ROUTE.test(id)||!QUESTIONS[baseQuestionId(id)])throw new Error('作業ファイルに不明な質問があります。');
  const q=QUESTIONS[baseQuestionId(id)];
  if(q.input){
   const max=q.input==='count'?(q.max??10):q.input==='age'?120:q.input==='money'?999999999:80;
   const min=q.input==='count'?1:0;
   if(value==='分からない'&&q.input!=='count'){}
   else if(q.input==='text'?typeof value!=='string'||!value.trim()||value.length>max:!Number.isInteger(value)||value<min||value>max)throw new Error('作業ファイルに範囲外の入力値があります。');
  }else if(q.multi){
   if(!Array.isArray(value)||!value.length||value.some(item=>!q.choices.includes(item)))throw new Error('作業ファイルに不明な選択肢があります。');
  }else if(!q.choices.includes(value))throw new Error('作業ファイルに不明な選択肢があります。');
  answers[id]=value;
 }
 try{for(const id of Object.keys(PAPER_GROUPS_V4))groupSequenceV4(id,answers);}catch{throw new Error('質問のつながりを確認できませんでした。');}
 const checked=validateIdentityV3(raw.identity,answers);
 if(!checked.ok)throw new Error(`氏名・住所の内容を確認できませんでした。${checked.errors[0].message}`);
 const tabId=PAPER_TABS_V4.some(tab=>tab.id===raw.tabId)?raw.tabId:PAPER_TABS_V4[0].id;
 return {answers,identity:checked.identity,tabId,savedAt:raw.savedAt};
}
