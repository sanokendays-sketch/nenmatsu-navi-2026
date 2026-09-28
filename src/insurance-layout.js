// UI limit, not a statutory limit. Keep enough room for an attached statement.
export const INSURANCE_INPUT_LIMIT = 100;

// Row counts checked against the 2026 blank insurance return (2026bun_04.pdf).
// New/old contracts share the same rows. 2026 NTA example 307.pdf, pp. 1-2,
// permits an attachment in an appropriate format when there are too few rows.
export const INSURANCE_PAPER_GROUPS = Object.freeze([
  {id:'general',title:'一般の生命保険料',capacity:4,categories:['新生命保険料','旧生命保険料']},
  {id:'care',title:'介護医療保険料',capacity:3,categories:['介護医療保険料']},
  {id:'pension',title:'個人年金保険料',capacity:3,categories:['新個人年金保険料','旧個人年金保険料']},
  {id:'earthquake',title:'地震保険料・旧長期損害保険料',capacity:2,categories:['地震保険料','旧長期損害保険料']}
]);

export function assignInsurancePlacements(contracts) {
  const counts={};
  return contracts.map(contract=>{
    const group=INSURANCE_PAPER_GROUPS.find(g=>g.categories.includes(contract.category));
    if(!group)return {...contract,placement:{location:'unassigned',label:'区分を確認してから記入先を決めます'}};
    const position=counts[group.id]=(counts[group.id]||0)+1;
    const main=position<=group.capacity,rowNumber=main?position:position-group.capacity;
    return {...contract,placement:{groupId:group.id,title:group.title,location:main?'main_form':'supplement',rowNumber,label:`${group.title}：${main?'申告書本体':'添付別紙'}の${rowNumber}行目`}};
  });
}

// Copy existing transfer totals. No tax calculation or HTML is produced here.
export function buildInsuranceSupplement(sections) {
  const contracts=sections.flatMap(s=>s.contracts||[]);
  const groups=INSURANCE_PAPER_GROUPS.map(group=>{
    const records=contracts.filter(c=>c.placement.groupId===group.id);
    return {...group,count:records.length,mainCount:records.filter(c=>c.placement.location==='main_form').length,
      contracts:records.filter(c=>c.placement.location==='supplement')};
  });
  const overflow=groups.filter(g=>g.contracts.length);
  return {required:overflow.length>0,groups:overflow,
    rowCount:overflow.reduce((sum,g)=>sum+g.contracts.length,0),
    unassigned:contracts.filter(c=>c.placement.location==='unassigned'),
    transferFields:sections.flatMap(s=>s.fields).filter(f=>/^(life-paid-|earthquake-paid$|old-long-term-paid$)/.test(f.key)&&f.status!=='not_applicable'),
    deductionFields:sections.flatMap(s=>s.fields).filter(f=>['life-deduction-amount','earthquake-deduction'].includes(f.key)&&f.status!=='not_applicable')};
}
