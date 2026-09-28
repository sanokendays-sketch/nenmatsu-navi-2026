import { TAX_RULES_2026 } from './rules-2026.js';

export function baseQuestionId(routeId) {
  if(routeId.startsWith('dep:')) return `dependent${routeId.split(':')[2][0].toUpperCase()}${routeId.split(':')[2].slice(1)}`;
  if(routeId.startsWith('life:')) return `life${routeId.split(':')[2][0].toUpperCase()}${routeId.split(':')[2].slice(1)}`;
  if(routeId.startsWith('earthquake:')) return `earthquake${routeId.split(':')[2][0].toUpperCase()}${routeId.split(':')[2].slice(1)}`;
  if(routeId.startsWith('disability:')) return routeId.endsWith(':cohabit') ? 'disabilityCohabit' : 'disabilityPerson';
  return routeId;
}

export function widowGenderMayBeNeeded(answers) {
  if(answers.parentStatus==='死別・生死不明') return true;
  if(answers.parentStatus!=='離婚') return false;
  for(let i=1;i<=(Number(answers.depCount)||0);i++) {
    const kin=answers[`dep:${i}:kin`],claim=answers[`dep:${i}:shared`],income=answers[`dep:${i}:income`];
    if(kin==='はい'&&claim==='いいえ'&&['ない','給与がある','給与以外の所得がある','分からない'].includes(income)) return true;
    if(kin==='分からない'||claim==='分からない'||income==='分からない') return true;
  }
  return false;
}

// Pure transition function: every branch can be inspected without a DOM/browser.
export function nextQuestionId(routeId,value,{answers={},state={}}={}) {
  const id=baseQuestionId(routeId);
  if(id==='target') return value==='いいえ'?'end':'form';
  if(id==='form') return 'salaryLimit';
  if(id==='salaryLimit') return 'changedJob';
  if(id==='changedJob') return value==='はい'?'priorSlip':'otherSalary';
  if(id==='priorSlip') return 'otherSalary';
  if(id==='otherSalary') return value==='はい'?'allSalary':'ownSalary';
  if(id==='allSalary'||id==='ownSalary') return 'otherIncome';
  if(id==='otherIncome') return 'spouse';
  if(id==='spouse') return value==='はい'?'spouseShared':'dependents';
  if(id==='spouseShared') return 'spouseClaimed';
  if(id==='spouseClaimed') return 'spouseAge';
  if(id==='spouseAge') return 'spouseIncomeType';
  if(id==='spouseIncomeType') return value==='給与だけ'?'spouseSalary':'dependents';
  if(id==='spouseSalary') return 'dependents';
  if(id==='dependents') return value==='はい'?'dependentCount':'disabilitySelf';
  if(id==='dependentCount') return 'dep:1:kin';
  if(routeId.startsWith('dep:')) {
    const [,n,part]=routeId.split(':'); const i=Number(n),prefix=`dep:${i}:`;
    if(part==='kin') return `${prefix}age`;
    if(part==='age') return `${prefix}income`;
    if(part==='income') return value==='給与がある'?`${prefix}salary`:`${prefix}shared`;
    if(part==='salary') return `${prefix}shared`;
    const next=i+1,more=next<=Number(answers.depCount);
    if(part==='shared') return Number(answers[`${prefix}age`])>=70?`${prefix}parent`:more?`dep:${next}:kin`:'disabilitySelf';
    if(part==='parent') return value==='はい'?`${prefix}cohabit`:more?`dep:${next}:kin`:'disabilitySelf';
    if(part==='cohabit') return more?`dep:${next}:kin`:'disabilitySelf';
  }
  if(id==='disabilitySelf') return 'disabilityFamily';
  if(id==='disabilityFamily') return value==='はい'?(answers.spouse==='はい'?'disability:spouse:level':Number(answers.depCount)>0?'disability:dep:1:level':'parentStatus'):'parentStatus';
  if(routeId.startsWith('disability:')) {
    const [,person,n,part]=routeId.split(':');
    const nextDep=i=>i<Number(answers.depCount)?`disability:dep:${i+1}:level`:'parentStatus';
    if(person==='spouse') return value==='特別障害者'?'disability:spouse:cohabit':Number(answers.depCount)>0?'disability:dep:1:level':'parentStatus';
    const i=Number(n);
    if(part==='level') return value==='特別障害者'?`disability:dep:${i}:cohabit`:nextDep(i);
    if(part==='cohabit') return nextDep(i);
  }
  if(id==='parentStatus') return value==='婚姻中'?'student':'deFactoPartner';
  if(id==='deFactoPartner') return value==='はい'?'student':'parentChild';
  if(id==='parentChild') return value==='はい'?'parentChildIncomeKnown':widowGenderMayBeNeeded(answers)?'widowGender':'student';
  if(id==='parentChildIncomeKnown') return value==='はい'?'parentChildIncome':'parentChildClaimed';
  if(id==='parentChildIncome') return 'parentChildClaimed';
  if(id==='parentChildClaimed') return widowGenderMayBeNeeded(answers)?'widowGender':'student';
  if(id==='widowGender') return 'student';
  if(id==='student') return value==='はい'?'studentSchool':'life';
  if(id==='studentSchool') return 'life';
  if(id==='life') return value==='はい'?'lifeCount':'earthquake';
  if(id==='lifeCount') return 'life:1:type';
  if(routeId.startsWith('life:')) {
    const [,n,part]=routeId.split(':'); const i=Number(n),prefix=`life:${i}:`;
    if(part==='type') return `${prefix}amount`;
    if(part==='amount') return `${prefix}paid`;
    if(part==='paid') return value==='いいえ'?i<Number(answers.lifeCount)?`life:${i+1}:type`:'earthquake':`${prefix}recipient`;
    const next=i<Number(answers.lifeCount)?`life:${i+1}:type`:'earthquake';
    const pension=answers[`${prefix}type`]?.includes('個人年金');
    if(part==='recipient') return `${prefix}companyName`;
    if(part==='companyName') return `${prefix}insuranceKind`;
    if(part==='insuranceKind') return `${prefix}insurancePeriod`;
    if(part==='insurancePeriod') return `${prefix}holderName`;
    if(part==='holderName') return `${prefix}recipientName`;
    if(part==='recipientName') return ['本人','配偶者'].includes(answers[`${prefix}recipient`])?(pension?`${prefix}pensionStartDate`:next):`${prefix}recipientRelationship`;
    if(part==='recipientRelationship') return pension?`${prefix}pensionStartDate`:next;
    if(part==='pensionStartDate') return next;
  }
  if(id==='earthquake') return value==='はい'?'earthquakeCount':'social';
  if(id==='earthquakeCount') return 'earthquake:1:type';
  if(routeId.startsWith('earthquake:')) {
    const [,n,part]=routeId.split(':'); const i=Number(n),prefix=`earthquake:${i}:`,more=i<Number(answers.earthquakeCount);
    if(part==='type') return answers[`${prefix}type`]==='両方'?`${prefix}election`:`${prefix}amount`;
    if(part==='amount') return `${prefix}paid`;
    if(part==='election') return `${prefix}amount`;
    if(part==='paid') return value==='いいえ'?(more?`earthquake:${i+1}:type`:'social'):`${prefix}companyName`;
    if(part==='companyName') return `${prefix}insuranceKind`;
    if(part==='insuranceKind') return `${prefix}insurancePeriod`;
    if(part==='insurancePeriod') return `${prefix}holderName`;
    if(part==='holderName') return `${prefix}insuredName`;
    if(part==='insuredName') return `${prefix}insuredRelationship`;
    if(part==='insuredRelationship') return more?`earthquake:${i+1}:type`:'social';
  }
  if(id==='social') return value==='はい'?'socialTypes':'ideco';
  if(id==='socialTypes') return 'socialAmount';
  if(id==='socialAmount') return 'ideco';
  if(id==='ideco') return value==='はい'?'idecoType':'housing';
  if(id==='idecoType') return 'idecoAmount';
  if(id==='idecoAmount') return 'housing';
  if(id==='housing') return value==='はい'?'housingFirst':'special';
  if(id==='housingFirst') return value==='いいえ'?'housingDocs':'special';
  if(id==='housingDocs') return 'housingBalance';
  if(id==='housingBalance') return 'special';
  if(id==='special') return 'result';
  return null;
}

export const DISPLAY_CONDITIONS={
  lifeCompanyName:'本人が支払った（または支払者未確定の）生命保険契約ごと。',lifeInsuranceKind:'同上。',lifeInsurancePeriod:'同上。',lifeHolderName:'同上。',lifeRecipientName:'同上。',lifeRecipientRelationship:'受取人が本人・配偶者以外の場合のみ。',lifePensionStartDate:'新・旧個人年金保険料の場合のみ。',
  earthquakeCompanyName:'本人が支払った（または支払者未確定の）地震保険契約ごと。',earthquakeInsuranceKind:'同上。',earthquakeInsurancePeriod:'同上。',earthquakeHolderName:'同上。',earthquakeInsuredName:'同上。',earthquakeInsuredRelationship:'同上。',
  target:'開始直後。いいえで対象外画面へ。',form:'Q01が「はい」または「分からない」。',salaryLimit:'Q01が「はい」または「分からない」。',changedJob:'基本確認の続き。',priorSlip:'転職した場合のみ。',otherSalary:'基本確認の続き。',allSalary:'他社給与ありの場合のみ。',ownSalary:'他社給与なしの場合のみ。',otherIncome:'本人給与額を確認した後。',
  spouse:'本人の収入確認後。',spouseShared:'配偶者ありの場合のみ。',spouseClaimed:'配偶者ありの場合のみ。',spouseAge:'配偶者ありの場合のみ。',spouseIncomeType:'配偶者ありの場合のみ。',spouseSalary:'配偶者の収入が給与だけの場合のみ。',dependents:'配偶者ブロックの後。',dependentCount:'扶養家族ありの場合のみ。',
  dependentKin:'家族ごとに1〜N回。',dependentAge:'家族ごと。',dependentIncome:'家族ごと。',dependentSalary:'その家族に給与収入がある場合のみ。',dependentShared:'家族ごと。',dependentParent:'その家族が70歳以上の場合のみ。',dependentCohabit:'70歳以上で父母・祖父母等と回答した場合のみ。',
  disabilitySelf:'本人・家族確認後。',disabilityFamily:'本人の障害状態の後。',disabilityPerson:'障害者控除対象家族がいる場合、配偶者・扶養家族ごと。',disabilityCohabit:'家族の区分が特別障害者の場合のみ。',parentStatus:'家族の障害状態確認後。',deFactoPartner:'未婚・離婚・死別の場合のみ。',parentChild:'事実婚関係がない場合のみ。',parentChildIncomeKnown:'生計を一にする子がいる場合のみ。',parentChildIncome:'子の所得金額を確認できる場合のみ。',parentChildClaimed:'子の所得金額質問の後。',widowGender:'離婚・死別等で寡婦控除の可能性がある場合のみ。',student:'家族状況確認後。',studentSchool:'在学中の場合のみ。',
  life:'本人・家族確認後。',lifeCount:'生命保険証明書ありの場合のみ。',lifeType:'保険契約ごとに1〜N回。',lifeAmount:'保険契約ごと。',lifePaid:'保険契約ごと。',lifeRecipient:'保険契約ごと。',earthquake:'生命保険の後。',earthquakeCount:'地震保険控除証明書ありの場合のみ。',earthquakeType:'地震保険証明書の契約ごと。',earthquakeAmount:'契約ごと。',earthquakeElection:'同一契約に両区分が含まれる場合のみ。',earthquakePaid:'契約ごと。',social:'地震保険の後。',socialTypes:'給与天引き外の支払いありの場合のみ。',socialAmount:'同上。',ideco:'社会保険の後。',idecoType:'対象掛金を支払った場合のみ。',idecoAmount:'掛金支払いありの場合のみ。',housing:'iDeCo等の後。',housingFirst:'住宅ローン控除ありの場合のみ。',housingDocs:'住宅ローン控除あり・2年目以降の場合。',housingBalance:'同上。',special:'全ブロックの最後。'
};

export function stateKeyFor(routeId) {
  if(routeId.startsWith('dep:')) return `dependents[${routeId.split(':')[1]-1}].${({kin:'relative',age:'age',income:'incomeType',salary:'salaryIncome',shared:'claimedByOther',parent:'parentOrGrandparent',cohabit:'livingArrangement'})[routeId.split(':')[2]]}`;
  if(routeId.startsWith('life:')) return `lifeInsuranceContracts[${routeId.split(':')[1]-1}].${({type:'category',amount:'amount',paid:'payer',recipient:'beneficiary'})[routeId.split(':')[2]]||routeId.split(':')[2]}`;
  if(routeId.startsWith('earthquake:')) return `earthquakeContracts[${routeId.split(':')[1]-1}].${({type:'category',amount:'amount',election:'election',paid:'payer'})[routeId.split(':')[2]]||routeId.split(':')[2]}`;
  if(routeId.startsWith('disability:')) { const [,person,n,part]=routeId.split(':'); return person==='spouse'?`spouse.disability.${n==='level'?'level':'cohabiting'}`:`dependents[${Number(n)-1}].disability.${part==='level'?'level':'cohabiting'}`; }
  return ({allSalary:'salaryGross',ownSalary:'salaryGross',dependents:'answers.dependents',dependentCount:'dependents.length',spouse:'spouse.exists',spouseShared:'spouse.sharedHousehold',spouseClaimed:'spouse.claimedByOther',spouseAge:'spouse.age',spouseIncomeType:'spouse.incomeType',spouseSalary:'spouse.salaryGross',disabilitySelf:'disability.selfLevel',disabilityFamily:'disability.hasFamily',parentStatus:'familyStatus.maritalStatus',deFactoPartner:'familyStatus.deFactoPartner',parentChild:'familyStatus.hasQualifyingChild',parentChildIncomeKnown:'familyStatus.childIncomeKnown',parentChildIncome:'familyStatus.childTotalIncome',parentChildClaimed:'familyStatus.childClaimedElsewhere',widowGender:'familyStatus.widowGender',student:'familyStatus.isStudent',studentSchool:'familyStatus.qualifyingSchool',life:'insurance.lifeCertificate',lifeCount:'lifeInsuranceContracts.length',earthquake:'insurance.earthquake.certificate',earthquakeCount:'earthquakeContracts.length',social:'socialInsurance.paidOutsidePayroll',socialTypes:'socialInsurance.types',socialAmount:'socialInsurance.amount',ideco:'ideco.paid',idecoType:'ideco.type',idecoAmount:'ideco.amount',housing:'housing.hasDeduction',housingFirst:'housing.firstYear',housingDocs:'housing.documents',housingBalance:'housing.balance',special:'specialCases'})[routeId]||`answers.${routeId}`;
}
