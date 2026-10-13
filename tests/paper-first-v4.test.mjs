import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS } from '../src/questions.js';
import { buildResult } from '../src/calculations.js';
import { buildFormGuide } from '../src/form-guide.js';
import { commitWizardAnswer } from '../src/wizard-v2.js';
import { createIdentityV3, syncIdentityV3, attachIdentityToGuideV3 } from '../src/identity-v3.js';
import { buildOfficialOutputV3 } from '../src/official-output-v3.js';
import { serializeDraftV4, readDraftV4, draftHasDataV4 } from '../src/session-v4.js';
import { PAPER_GROUPS_V4, PAPER_TABS_V4, paperZonesV4, groupStatusV4, groupSequenceV4, visiblePaperEntryV4, paperPreflightDetailsV4 } from '../src/paper-first-v4.js';

const baseline={target:'はい',form:'はい',salaryLimit:QUESTIONS.salaryLimit.choices[0],changedJob:'いいえ',otherSalary:'いいえ',ownSalary:4800000,otherIncome:'ない',spouse:'いいえ',dependents:'いいえ',disabilitySelf:'ない',disabilityFamily:'いいえ',parentStatus:'婚姻中',student:'いいえ',life:'いいえ',earthquake:'いいえ',social:'いいえ',ideco:'いいえ',housing:'いいえ',special:['どれもない']};
const snapshot=(answers,identity=syncIdentityV3(createIdentityV3(),answers))=>serializeDraftV4(answers,identity,'insuranceForm');

test('restoring must confirm even when only employer or a family name has been entered',()=>{
 assert.equal(draftHasDataV4({},createIdentityV3()),false);
 assert.equal(draftHasDataV4({},{taxpayer:{},employer:{name:'試験勤務先'}}),true);
 assert.equal(draftHasDataV4({},{dependents:[{name:'試験家族'}]}),true);
});
test('parent and student paper hotspots do not cover each other',()=>{
 const zones=paperZonesV4('dependentForm');const parent=zones.find(z=>z.id==='fuyouParent').mark,student=zones.find(z=>z.id==='fuyouStudent').mark;
 assert.ok(parent[1]+parent[3]<=student[1]);
});

test('v4 draft roundtrip restores empty and partial out-of-order answers',()=>{
 for(const a of [{},{life:'いいえ',earthquake:'いいえ'},{...baseline}])assert.deepEqual(readDraftV4(snapshot(a)).answers,a);
});
test('v4 draft roundtrip restores the generated dependent count alias and two identities',()=>{
 const a={...baseline};commitWizardAnswer(a,'dependents','はい');commitWizardAnswer(a,'dependentCount',2);
 const identity=syncIdentityV3(createIdentityV3(),a);identity.dependents[0].name='試験家族A';identity.dependents[1].name='試験家族B';
 const restored=readDraftV4(snapshot(a,identity));assert.deepEqual(restored.answers,a);assert.equal(restored.identity.dependents[1].name,'試験家族B');
});
test('v4 draft restores 100 insurance contracts and holder-name references',()=>{
 const a={life:'はい',lifeCount:100};
 for(let i=1;i<=100;i++)Object.assign(a,{[`life:${i}:type`]:'新生命保険料',[`life:${i}:amount`]:i,[`life:${i}:paid`]:'はい',[`life:${i}:recipient`]:'本人',[`life:${i}:companyName`]:'試験保険',[`life:${i}:insuranceKind`]:'生命保険',[`life:${i}:insurancePeriod`]:'終身',[`life:${i}:holderName`]:'試験本人',[`life:${i}:recipientName`]:'__same_contract_holder__'});
 assert.deepEqual(readDraftV4(snapshot(a)).answers,a);
});
test('v4 draft rejects inconsistent dependent counts and out-of-range indexed records',()=>{
 for(const a of [{dependents:'はい',dependentCount:1,depCount:2},{life:'はい',lifeCount:1,'life:2:type':'新生命保険料'},{dependents:'いいえ',dependentCount:1,depCount:1}])assert.throws(()=>readDraftV4(snapshot(a)));
});
test('v4 draft rejects wrong year, negative money, unknown choices and malformed JSON',()=>{
 assert.throws(()=>readDraftV4('{'));
 const wrong=JSON.parse(snapshot({}));wrong.year=2025;assert.throws(()=>readDraftV4(JSON.stringify(wrong)));
 for(const a of [{ownSalary:-1},{spouse:'unexpected'},{special:['どれもない','unexpected']}])assert.throws(()=>readDraftV4(snapshot(a)));
});
test('paper groups complete with baseline and refer only to known questions and groups',()=>{
 for(const id of Object.keys(PAPER_GROUPS_V4))if(id!=='identity')assert.equal(groupStatusV4(id,baseline),'complete');
 for(const t of PAPER_TABS_V4)for(const z of paperZonesV4(t.id))assert.ok(PAPER_GROUPS_V4[z.group]);
 assert.equal(groupSequenceV4('salary',{target:'いいえ'}).length,1);
});
test('paper dependency blocks incomplete salary and special life deduction amounts',()=>{
 assert.equal(visiblePaperEntryV4({key:'salary-income'},{ownSalary:4800000}),false);
 assert.equal(visiblePaperEntryV4({key:'salary-revenue'},{ownSalary:4800000}),true);
 assert.equal(visiblePaperEntryV4({key:'basic-deduction'},baseline),true);
 assert.equal(visiblePaperEntryV4({key:'life-deduction-amount'},{life:'いいえ'}),false);
});
test('paper preflight retains navigation for duplicate identity warnings and unknowns',()=>{
 const a={...baseline,ownSalary:'分からない'},identity=createIdentityV3();
 const guide={...buildFormGuide(buildResult(a)),identityWarnings:['試験の氏名要確認'],staffConfirmations:['試験の氏名要確認']};
 const issues=paperPreflightDetailsV4('combinedForm',a,identity,guide,{notes:[]});
 assert.equal(issues.filter(x=>x.message==='試験の氏名要確認').length,1);
 assert.equal(issues.find(x=>x.message==='試験の氏名要確認').group,'identity');
 assert.ok(issues.some(x=>x.group==='salary'&&x.message.includes('分からない')));
});
test('out-of-order paper edits remove spouse, removed family identities and excess policies',()=>{
 const a={...baseline,spouse:'はい',spouseAge:30,spouseSalary:1000000,dependents:'はい',dependentCount:2,depCount:2,'dep:1:age':20,'dep:2:age':70,life:'はい',lifeCount:2,'life:1:amount':30000,'life:2:amount':20000};
 let identity=syncIdentityV3({taxpayer:{name:'試験本人'},employer:{},spouse:{name:'試験配偶者'},dependents:[{name:'試験A'},{name:'試験B'}]},a);
 commitWizardAnswer(a,'spouse','いいえ');commitWizardAnswer(a,'dependentCount',1);commitWizardAnswer(a,'lifeCount',1);identity=syncIdentityV3(identity,a);
 assert.deepEqual(identity.spouse,{});assert.equal(identity.dependents.length,1);assert.equal(a['life:2:amount'],undefined);assert.equal(a.ownSalary,4800000);
});
test('unknown salary produces no numeric calculated overlay and no duplicate documents',()=>{
 const a={...baseline,ownSalary:'分からない'};const g=attachIdentityToGuideV3(buildFormGuide(buildResult(a)),createIdentityV3(),a);
 const page=buildOfficialOutputV3(g).pages.find(p=>p.id==='combinedForm');
 assert.equal(page.entries.some(e=>e.key==='basic-deduction'),false);assert.equal(new Set(g.requiredDocuments).size,g.requiredDocuments.length);
});
