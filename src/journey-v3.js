import { traceWizard, commitWizardAnswer } from './wizard-v2.js';

export function createJourneyV3(){return {answers:{},mode:'home',currentId:null,checkpointPage:null,returnToResult:false};}
export function currentItemV3(journey){
 const trace=traceWizard(journey.answers);
 return trace.items.find(x=>x.id===journey.currentId)||trace.items.find(x=>!x.answered)||trace.items.at(-1);
}
export function startJourneyV3(journey){journey.mode='question';journey.currentId=traceWizard(journey.answers).pending;}
export function editAnswerV3(journey,id){
 if(!traceWizard(journey.answers).items.some(x=>x.id===id))return;
 journey.returnToResult=journey.mode==='result';journey.mode='question';journey.currentId=id;
}
export function submitAnswerV3(journey,id,value){
 const before=traceWizard(journey.answers).items.find(x=>x.id===id);
 if(!before)return;
 const trace=commitWizardAnswer(journey.answers,id,value);
 if(trace.terminal==='end'){journey.mode='end';journey.currentId='target';journey.returnToResult=false;return;}
 if(journey.returnToResult){journey.returnToResult=false;journey.mode=trace.terminal==='result'?'result':'question';journey.currentId=trace.pending;return;}
 const index=trace.items.findIndex(x=>x.id===id),next=trace.items[index+1];
 journey.currentId=next?.id||trace.pending;
 if(!next||next.page!==before.page){journey.mode='checkpoint';journey.checkpointPage=before.page;}
 else journey.mode='question';
}
export function continueJourneyV3(journey){
 const trace=traceWizard(journey.answers);
 if(trace.terminal==='end'){journey.mode='end';return;}
 if(!journey.currentId&&trace.terminal==='result'){journey.mode='result';return;}
 journey.mode='question';journey.currentId=journey.currentId||trace.pending;
}
export function backJourneyV3(journey){
 const trace=traceWizard(journey.answers);
 journey.returnToResult=false;
 if(journey.mode==='result'){journey.currentId=trace.items.at(-1)?.id;journey.mode='question';return;}
 if(journey.mode==='checkpoint'){journey.currentId=trace.items.filter(x=>x.page===journey.checkpointPage).at(-1)?.id;journey.mode='question';return;}
 const index=trace.items.findIndex(x=>x.id===journey.currentId);
 if(index>0){journey.currentId=trace.items[index-1].id;journey.mode='question';}
}
