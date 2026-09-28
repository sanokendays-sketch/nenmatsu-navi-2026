import { TAX_RULES_2026 } from './rules-2026.js';
import { QUESTIONS } from './questions.js';
import { baseQuestionId } from './flow.js';
import { calculateLifeInsuranceDeduction, calculateEarthquakeDeduction, calculateSocialInsuranceDeduction, calculateSmallBusinessMutualAidDeduction, calculateDisabilityDeduction, calculateFamilyDisabilityDeduction, calculateSingleParentOrWidow, calculateWorkingStudent } from './deductions-step4.js';

function validAmount(value) {
  return Number.isFinite(value) && value >= 0;
}

// 国税庁の令和8年分給与所得計算表を使い、給与所得控除後の給与所得額を返します。
export function calculateSalaryIncome(grossSalary) {
  if (!validAmount(grossSalary)) return null;
  const t = TAX_RULES_2026.salary.table;
  if (grossSalary < t.zeroIncomeBelow) return 0;
  if (grossSalary < t.linearGrossEndExclusive) return Math.max(0, grossSalary - 740_000);
  for (const band of t.steppedBands) {
    if (grossSalary >= band.start && grossSalary < band.endExclusive) return band.income;
  }
  for (const band of t.formulaBands) {
    if (grossSalary >= band.start && grossSalary < band.endExclusive) {
      const increments = Math.floor((grossSalary - band.baseGross) / band.divisor);
      return Math.max(0, band.baseIncome + increments * band.incomePerStep);
    }
  }
  for (const band of t.proportionalBands) {
    if (grossSalary >= band.start && (band.endExclusive === undefined || grossSalary < band.endExclusive)) {
      return Math.max(0, Math.floor(grossSalary * band.rate - band.deduction));
    }
  }
  return 0;
}

export function calculateBasicDeduction(totalIncome) {
  if (!validAmount(totalIncome)) return null;
  return TAX_RULES_2026.basicDeduction.find((band) => totalIncome <= band.maxIncome)?.amount ?? 0;
}

// 給与収入8,500,000円超で法定要件がある場合の所得金額調整控除。
export function calculateIncomeAdjustmentDeduction(grossSalary, qualifies) {
  if (!validAmount(grossSalary)) return null;
  if (grossSalary <= TAX_RULES_2026.incomeAdjustment.salaryThreshold) return 0;
  if (qualifies === null || qualifies === undefined) return null;
  if (!qualifies) return 0;
  const r = TAX_RULES_2026.incomeAdjustment;
  return Math.min(r.maxAmount, Math.ceil((Math.min(grossSalary, r.salaryCap) - r.salaryThreshold) * r.rate));
}

function taxpayerIncomeBandIndex(totalIncome) {
  const bands = TAX_RULES_2026.thresholds.taxpayerIncomeBands;
  if (totalIncome <= bands[0]) return 0;
  if (totalIncome <= bands[1]) return 1;
  if (totalIncome <= bands[2]) return 2;
  return -1;
}

// spouseAgeは12月31日時点。要件のうち婚姻・生計・事業専従者等は呼出側でも確認します。
export function calculateSpouseDeduction(taxpayerTotalIncome, spouseTotalIncome, { spouseAge = null } = {}) {
  const none = { type: 'none', amount: 0 };
  if (!validAmount(taxpayerTotalIncome) || !validAmount(spouseTotalIncome)) return { ...none, status: 'unknown' };
  const taxpayerBand = taxpayerIncomeBandIndex(taxpayerTotalIncome);
  if (taxpayerBand < 0) return none;
  const bands = TAX_RULES_2026.spouseDeduction.incomeBands;
  const band = bands.find((entry) => spouseTotalIncome <= entry.maxIncome);
  if (!band) return none;
  if (spouseTotalIncome <= TAX_RULES_2026.thresholds.spouseIncome) {
    if (band.elderly && spouseAge === null) return { ...none, type: 'spouse', amount: null, status: 'needs-spouse-age' };
    const elderly = Number.isFinite(spouseAge) && spouseAge >= TAX_RULES_2026.spouseDeduction.elderlySpouseAge;
    return { type: 'spouse', amount: (elderly ? band.elderly : band.standard)[taxpayerBand], status: 'candidate' };
  }
  return { type: 'special', amount: band.standard[taxpayerBand], status: 'candidate' };
}

export function classifyDependentAge(age) {
  if (!Number.isInteger(age) || age < 0 || age > 120) return null;
  const t = TAX_RULES_2026.dependentDeduction.ageThresholds;
  if (age < t.minor) return 'under16';
  if (age < t.specific) return '16to18';
  if (age < t.adult) return '19to22';
  if (age < t.elderly) return '23to69';
  return '70plus';
}

// 年齢・所得・質問で確認済みの基本条件による控除候補。金額は国税庁令和8年分表。
export function calculateDependentDeduction({ age, totalIncome, isRelative, claimedByOther, parentOrGrandparent, livingArrangement } = {}) {
  const ageGroup = classifyDependentAge(age);
  const none = { type: 'none', amount: 0, ageGroup };
  if (!ageGroup || !validAmount(totalIncome)) return { ...none, status: 'unknown' };
  if (isRelative !== true || claimedByOther !== false || totalIncome > TAX_RULES_2026.dependentDeduction.incomeLimit) return { ...none, status: 'not-qualified' };
  if (ageGroup === 'under16') return { ...none, status: 'no-deduction-by-age' };
  const a = TAX_RULES_2026.dependentDeduction.amounts;
  if (ageGroup === '16to18' || ageGroup === '23to69') return { type: 'general', amount: a.general, ageGroup, status: 'candidate' };
  if (ageGroup === '19to22') return { type: 'specific-dependent', amount: a.specific, ageGroup, status: 'candidate' };
  const cohabitingParent = parentOrGrandparent === true && livingArrangement === 'はい';
  return { type: cohabitingParent ? 'cohabiting-elderly-parent' : 'elderly', amount: cohabitingParent ? a.cohabitingElderlyParent : a.elderly, ageGroup, status: 'candidate' };
}

// 特定親族特別控除額。年齢・親族関係・生計要件などを満たすかは呼出側で先に確認します。
export function calculateSpecificRelativeDeduction(age, totalIncome) {
  const r = TAX_RULES_2026.specificRelativeDeduction;
  if (!Number.isInteger(age) || age < r.minAge || age >= r.maxAgeExclusive || !validAmount(totalIncome) || totalIncome <= TAX_RULES_2026.thresholds.dependentIncome || totalIncome > r.maxIncome) {
    return { type: 'none', amount: 0 };
  }
  const band = r.amountBands.find((entry) => totalIncome <= entry.maxIncome);
  return band ? { type: 'specific-relative', amount: band.amount } : { type: 'none', amount: 0 };
}

function incomeFromAnswer(incomeType, grossSalary) {
  if (incomeType === 'ない' || incomeType === '収入なし') return 0;
  if (incomeType === '給与がある' || incomeType === '給与だけ') return grossSalary===undefined||grossSalary===null?null:calculateSalaryIncome(grossSalary);
  return null;
}

// STEP 3：計算候補は税制表に基づいて表示し、質問で得られない要件は担当者確認に残します。
export function buildResult(a) {
  const confirmationMap = new Map();
  const addConfirmation=(id,message)=>{
    if(confirmationMap.has(id)||[...confirmationMap.values()].includes(message)) return;
    confirmationMap.set(id,message);
  };
  const docs = new Set();
  const hasUnknown=value=>value==='分からない'||Array.isArray(value)&&value.some(hasUnknown);
  const forms = [{name:'基礎控除申告書',status:'配布された用紙と勤務先の記入案内を確認してください。'}];
  if (a.form !== 'はい') addConfirmation('form-status','扶養控除等申告書を提出済みか、会社の担当者へ確認してください。');
  const basicStatus=a.form==='はい'?'提出済みか確認してください。':a.form==='いいえ'?'未提出と回答しています。提出方法を確認してください。':'提出済みか確認してください。';
  const relevantFields=[a.spouse==='はい'?'配偶者欄':'',a.depCount?'扶養親族欄':'',['一般障害者','特別障害者'].includes(a.disabilitySelf)||a.disabilityFamily==='はい'||a.parentStatus&&a.parentStatus!=='婚姻中'?'該当する障害者・ひとり親等の欄':''].filter(Boolean);
  forms.unshift({name:'扶養控除等申告書',status:`${basicStatus}${relevantFields.length?` 確認する欄：${relevantFields.join('、')}。`:''}`});
  const salaryLimitOver=`${(TAX_RULES_2026.thresholds.salaryLimitForYearEndAdjustment/10000).toLocaleString('ja-JP')}万円超`;
  const salaryLimitUnder=`${(TAX_RULES_2026.thresholds.salaryLimitForYearEndAdjustment/10000).toLocaleString('ja-JP')}万円以下`;
  if (a.salaryLimit === salaryLimitOver) addConfirmation('salary-limit','給与収入が依頼書記載の基準を超える見込みです。年末調整の対象となるか確認してください。');
  const rawGrossSalary=a.allSalary??a.ownSalary;
  const grossSalary=Number(rawGrossSalary);
  const hasGrossSalary=rawGrossSalary!==undefined&&rawGrossSalary!==null&&Number.isFinite(grossSalary)&&grossSalary>=0;
  const salaryIncome=hasGrossSalary?calculateSalaryIncome(grossSalary):null;
  if(Number.isFinite(grossSalary)&&[salaryLimitUnder,salaryLimitOver].includes(a.salaryLimit)&&((a.salaryLimit===salaryLimitOver)!==(grossSalary>TAX_RULES_2026.thresholds.salaryLimitForYearEndAdjustment))) addConfirmation('salary-mismatch','給与収入の見込み回答と入力額が一致しません。金額を確認してください。');
  if (a.otherIncome && !['ない','分からない'].includes(a.otherIncome)) addConfirmation('other-income',`給与以外の収入（${a.otherIncome}）について、会社の担当者へ確認してください。`);
  if (a.changedJob === 'はい') { docs.add('前職の源泉徴収票'); if (a.priorSlip === 'まだ') addConfirmation('prior-slip','前職の源泉徴収票を受け取ってから提出してください。'); }

  // 令和8年分保険料控除申告書裏面4・年末調整Q&A：同じ子で夫婦双方に適用可。
  const under23Facts=Array.from({length:Number(a.depCount)||0},(_,n)=>{
    const i=n+1,age=Number(a[`dep:${i}:age`]),income=incomeFromAnswer(a[`dep:${i}:income`],a[`dep:${i}:salary`]);
    if(age>=TAX_RULES_2026.dependentDeduction.ageThresholds.adult||a[`dep:${i}:kin`]==='いいえ'||income!==null&&income>TAX_RULES_2026.thresholds.dependentIncome)return false;
    if(!Number.isInteger(age)||a[`dep:${i}:age`]===null||a[`dep:${i}:kin`]!=='はい'||income===null)return null;
    return true;
  });
  const adjustmentAgeFact=under23Facts.includes(true);
  const spouseSpecialEligible=a.spouse==='はい'&&a['disability:spouse:level']==='特別障害者'&&a.spouseShared==='はい'&&a.spouseClaimed==='いいえ'&&incomeFromAnswer(a.spouseIncomeType,a.spouseSalary)!==null&&incomeFromAnswer(a.spouseIncomeType,a.spouseSalary)<=TAX_RULES_2026.thresholds.dependentIncome;
  const dependentSpecialEligible=Array.from({length:Number(a.depCount)||0},(_,n)=>{const i=n+1,inc=incomeFromAnswer(a[`dep:${i}:income`],a[`dep:${i}:salary`]);return a[`disability:dep:${i}:level`]==='特別障害者'&&a[`dep:${i}:kin`]==='はい'&&a[`dep:${i}:shared`]==='いいえ'&&inc!==null&&inc<=TAX_RULES_2026.thresholds.dependentIncome;}).some(Boolean);
  const familySpecialFact=spouseSpecialEligible||dependentSpecialEligible;
  const disabilityFamilyUnknown=a.disabilityFamily==='分からない'||a.disabilitySelf==='分からない'||a.disabilityFamily==='はい'&&(a.spouse==='はい'&&(!a['disability:spouse:level']||a['disability:spouse:level']==='分からない')||Array.from({length:Number(a.depCount)||0},(_,n)=>a[`disability:dep:${n+1}:level`]).some(x=>!x||x==='分からない')||a.spouse!=='はい'&&Number(a.depCount)===0);
  const dependentAdjustmentUnknown=under23Facts.includes(null);
  const adjustmentFactsUnknown=disabilityFamilyUnknown||dependentAdjustmentUnknown||Array.from({length:Number(a.depCount)||0},(_,n)=>a[`dep:${n+1}:age`]).some(age=>age===undefined);
  const knownAdjustmentFact=a.disabilitySelf==='特別障害者'||familySpecialFact||adjustmentAgeFact;
  const adjustmentQualifies=knownAdjustmentFact?true:adjustmentFactsUnknown?null:false;
  const incomeAdjustmentDeduction=hasGrossSalary?calculateIncomeAdjustmentDeduction(grossSalary,adjustmentQualifies):null;
  const adjustedSalaryIncome=salaryIncome===null||incomeAdjustmentDeduction===null?null:Math.max(0,salaryIncome-incomeAdjustmentDeduction);
  let totalIncome = a.otherIncome === 'ない' && hasGrossSalary ? adjustedSalaryIncome : null;
  const basicDeduction = totalIncome === null ? null : calculateBasicDeduction(totalIncome);
  const spouseGrossIncome=incomeFromAnswer(a.spouseIncomeType,a.spouseSalary);
  let spouseDeduction={type:'none',amount:0,status:'unknown'};
  if(a.spouse==='はい'&&spouseGrossIncome!==null&&a.spouseShared==='はい'&&a.spouseClaimed==='いいえ') {
    spouseDeduction=calculateSpouseDeduction(totalIncome,spouseGrossIncome,{spouseAge:Number.isFinite(Number(a.spouseAge))?Number(a.spouseAge):null});
  }
  if (a.spouse === 'はい') forms.push({name:'配偶者控除等申告書',status:spouseDeduction.status==='unknown'?'所得内容または生計要件が未確認のため、控除額は未計算です。':spouseDeduction.amount===null?'配偶者の年齢を確認してください。':spouseDeduction.amount>0?`配偶者控除等の候補額：${spouseDeduction.amount.toLocaleString('ja-JP')}円。その他の適用要件は確認が必要です。`:'所得要件上、配偶者控除等の候補額はありません。'});
  if(a.spouseClaimed==='はい') addConfirmation('spouse-overlap','配偶者が他の方の扶養親族等として申告されています。申告先の重複がないか会社の担当者へ確認してください。');
  if(a.spouseIncomeType==='給与以外もある') addConfirmation('spouse-other-income','配偶者に給与以外の収入があります。合計所得金額を確認してください。');
  if(a.spouse==='はい'&&a.spouseShared!=='はい') addConfirmation('spouse-household','配偶者と生計を一にしているか確認してください。');
  if(a.spouse==='はい'&&totalIncome===null) addConfirmation('spouse-taxpayer-income','本人に給与以外の収入があるか、合計所得金額を確認してください。');

  const dependentAges=[];
  const dependentResults=[];
  let specialRelativeNeedsReview=false;
  for (let i=1;i<=Number(a.depCount||0);i++) {
    const age=Number(a[`dep:${i}:age`]); if(Number.isFinite(age)) dependentAges.push(age);
    const incomeType=a[`dep:${i}:income`];
    const personIncome=incomeFromAnswer(incomeType,a[`dep:${i}:salary`]);
    const relative=a[`dep:${i}:kin`]==='はい';
    const sharedByOther=a[`dep:${i}:shared`]==='はい';
    const parent=a[`dep:${i}:parent`]==='はい';
    const result=personIncome===null?{type:'unknown',amount:null,status:'needs-income-details',ageGroup:classifyDependentAge(age)}:calculateDependentDeduction({age,totalIncome:personIncome,isRelative:relative,claimedByOther:sharedByOther,parentOrGrandparent:parent,livingArrangement:a[`dep:${i}:cohabit`]});
    let special=personIncome===null?{type:'unknown',amount:null}:calculateSpecificRelativeDeduction(age,personIncome);
    if(age>=19&&age<23&&(special.amount>0||personIncome===null&&a[`dep:${i}:kin`]!=='いいえ')) specialRelativeNeedsReview=true;
    if(a[`dep:${i}:kin`]!=='はい'||a[`dep:${i}:shared`]!=='いいえ') { result.amount=null; result.status='needs-review'; }
    if(special.amount>0&&(a[`dep:${i}:kin`]!=='はい'||a[`dep:${i}:shared`]!=='いいえ')) special={type:'unknown',amount:null};
    dependentResults.push({index:i,age,ageGroup:result.ageGroup,income:personIncome,deduction:result,specificRelative:special});
    if(a[`dep:${i}:kin`]==='いいえ') addConfirmation(`dep-${i}-not-relative`,`${i}人目の方が扶養控除等の対象となるか、会社の担当者へ確認してください。`);
    if(incomeType==='給与以外の所得がある') addConfirmation(`dep-${i}-other-income`,`${i}人目の家族の合計所得金額を確認してください。`);
    if(sharedByOther) addConfirmation('dependent-overlap',`${i}人目の扶養家族を他の方も申告する可能性があります。`);
    if(personIncome===null&&incomeType!=='分からない') addConfirmation(`dep-${i}-income-detail`,`${i}人目の家族の所得金額を確認してください。`);
    if(special.amount>0) addConfirmation(`special-relative-review-${i}`,`${i}人目は特定親族特別控除の金額候補があります。事業専従者等の追加要件を勤務先へ確認してください。`);
  }
  if(specialRelativeNeedsReview) forms.push({name:'特定親族特別控除申告書',status:'19〜22歳の親族について、所得に応じた控除候補を表示します。事業専従者等の追加要件は担当者へ確認してください。'});
  if(a.parentStatus&&a.parentStatus!=='婚姻中') forms.push({name:'扶養控除等申告書の障害者・ひとり親・寡婦等の欄',status:'該当する欄と必要書類を勤務先の用紙で確認してください。'});

  const lifeContracts=Array.from({length:Number(a.lifeCount||0)},(_,n)=>{const i=n+1;return {category:a[`life:${i}:type`],amount:a[`life:${i}:amount`],payer:a[`life:${i}:paid`],beneficiary:a[`life:${i}:recipient`]};});
  const hasUnder23Dependent=adjustmentAgeFact?true:dependentAdjustmentUnknown?null:false;
  const lifeInsurance=a.life==='分からない'||a.life==='はい'&&!lifeContracts.length?{status:'needs_confirmation',amount:null}:calculateLifeInsuranceDeduction(lifeContracts,hasUnder23Dependent);
  if(a.life==='はい') {
    docs.add('生命保険料控除証明書'); forms.push({name:'保険料控除申告書（生命保険料）',status:lifeInsurance.status==='calculated'?`生命保険料控除の候補額：${lifeInsurance.amount.toLocaleString('ja-JP')}円。契約条件・受取人要件は証明書で確認してください。`:'契約区分または支払者が未確定のため、控除額は計算できません。'});
    for(let i=1;i<=Number(a.lifeCount||0);i++) if(a[`life:${i}:paid`]==='いいえ'||a[`life:${i}:recipient`]==='その他') addConfirmation(`life-${i}-payer-beneficiary`,`${i}件目の生命保険について、支払者・受取人を会社の担当者へ確認してください。`);
    if(lifeInsurance.status==='needs_confirmation'&&!Array.from({length:Number(a.lifeCount)||0},(_,n)=>{const i=n+1;return [a[`life:${i}:type`],a[`life:${i}:amount`],a[`life:${i}:paid`],a[`life:${i}:recipient`]];}).flat().some(hasUnknown)) addConfirmation('life-incomplete',lifeInsurance.reason||'生命保険の支払者・受取人・区分・金額を証明書で確認してください。');
  }
  const earthquakeRecords=Array.from({length:a.earthquake==='はい'?Number(a.earthquakeCount)||0:0},(_,n)=>{const i=n+1;return {category:a[`earthquake:${i}:type`],amount:a[`earthquake:${i}:amount`],election:a[`earthquake:${i}:election`],payer:a[`earthquake:${i}:paid`]};});
  if(a.earthquake==='はい'&&!earthquakeRecords.length) earthquakeRecords.push({});
  const earthquakeDeduction=a.earthquake==='分からない'?{status:'needs_confirmation',amount:null}:calculateEarthquakeDeduction(earthquakeRecords);
  if(a.earthquake==='はい') {docs.add('地震保険料控除証明書');forms.push({name:'保険料控除申告書（地震保険料）',status:earthquakeDeduction.status==='calculated'?`地震保険料控除の候補額：${earthquakeDeduction.amount.toLocaleString('ja-JP')}円。`:'区分・同一契約の選択・支払者が未確定のため計算できません。'});if(earthquakeDeduction.status==='needs_confirmation'&&!Array.from({length:Number(a.earthquakeCount)||0},(_,n)=>{const i=n+1;return [a[`earthquake:${i}:type`],a[`earthquake:${i}:amount`],a[`earthquake:${i}:election`],a[`earthquake:${i}:paid`]];}).flat().some(hasUnknown))addConfirmation('earthquake-incomplete','地震保険料の契約区分、支払者、同一契約の申告選択を確認してください。');}
  const socialPayments=a.social==='はい'&&a.socialAmount!==undefined?[{amount:a.socialAmount}]:[];
  const socialDeduction=calculateSocialInsuranceDeduction(socialPayments,a.social);
  if(a.social==='はい'&&socialDeduction.status==='needs_confirmation'&&!hasUnknown(a.socialAmount))addConfirmation('social-incomplete','給与天引き外の社会保険料の本人支払額を確認してください。');
  if(a.social==='はい') {docs.add('支払額が分かる書類（社会保険料）');if((a.socialTypes||[]).some(x=>['国民年金','国民年金基金'].includes(x)))docs.add('国民年金・国民年金基金の控除証明書または領収証書');forms.push({name:'保険料控除申告書（社会保険料）',status:`給与天引き外に本人が支払った額：${socialDeduction.amount===null?'確認中':`${socialDeduction.amount.toLocaleString('ja-JP')}円`}`} );}
  const mutualAidPayments=a.ideco==='はい'&&a.idecoAmount!==undefined&&a.idecoType? [{type:a.idecoType,amount:a.idecoAmount}]:[];
  const mutualAidDeduction=calculateSmallBusinessMutualAidDeduction(mutualAidPayments,a.ideco);
  if(a.ideco==='はい'&&mutualAidDeduction.status==='needs_confirmation'&&!hasUnknown(a.idecoAmount))addConfirmation('mutual-aid-incomplete','給与天引き外の対象掛金の種類と本人支払額を確認してください。');
  if(a.ideco==='はい') {docs.add('iDeCo・小規模企業共済等の掛金証明書');forms.push({name:'保険料控除申告書（小規模企業共済等掛金）',status:mutualAidDeduction.status==='calculated'?`本人が支払った対象掛金：${mutualAidDeduction.amount.toLocaleString('ja-JP')}円`:'掛金区分または本人支払額を担当者へ確認してください。'});}

  const selfDisability=calculateDisabilityDeduction({level:a.disabilitySelf==='ない'?'なし':a.disabilitySelf,taxpayer:true});
  const familyPeople=[];
  if(a.disabilityFamily==='分からない') familyPeople.push({level:'分からない',eligible:null});
  if(a.disabilityFamily==='はい') {
    if(a.spouse==='はい') { const spouseIncome=incomeFromAnswer(a.spouseIncomeType,a.spouseSalary);const spouseEligible=a.spouseShared==='はい'&&spouseIncome!==null&&spouseIncome<=TAX_RULES_2026.dependentDeduction.incomeLimit&&a.spouseClaimed==='いいえ';familyPeople.push({level:a['disability:spouse:level'],eligible:spouseEligible?true:(spouseIncome===null||a.spouseShared==='分からない'?null:false),cohabiting:a['disability:spouse:cohabit']==='はい'?true:a['disability:spouse:cohabit']==='いいえ'?false:null}); }
    for(let i=1;i<=Number(a.depCount||0);i++) {const income=incomeFromAnswer(a[`dep:${i}:income`],a[`dep:${i}:salary`]);const eligible=a[`dep:${i}:kin`]==='はい'&&a[`dep:${i}:shared`]==='いいえ'&&income!==null&&income<=TAX_RULES_2026.dependentDeduction.incomeLimit;familyPeople.push({level:a[`disability:dep:${i}:level`],eligible:eligible?true:(income===null||a[`dep:${i}:kin`]==='分からない'||a[`dep:${i}:shared`]==='分からない'?null:false),cohabiting:a[`disability:dep:${i}:cohabit`]==='はい'?true:a[`disability:dep:${i}:cohabit`]==='いいえ'?false:null});}
    if(!familyPeople.length) familyPeople.push({level:'分からない',eligible:null});
  }
  const familyDisabilityDeduction=calculateFamilyDisabilityDeduction(familyPeople);
  const disabilityTotal=[selfDisability,familyDisabilityDeduction].some(x=>x.status==='needs_confirmation')?{status:'needs_confirmation',amount:null}: {status:selfDisability.status==='calculated'||familyDisabilityDeduction.status==='calculated'?'calculated':'not_applicable',amount:(selfDisability.amount||0)+(familyDisabilityDeduction.amount||0)};
  const disabilityAnswers=[a.disabilitySelf,a.disabilityFamily,a['disability:spouse:level'],a['disability:spouse:cohabit'],...Array.from({length:Number(a.depCount)||0},(_,n)=>[a[`disability:dep:${n+1}:level`],a[`disability:dep:${n+1}:cohabit`]]).flat()];
  if(disabilityTotal.status==='needs_confirmation'&&!disabilityAnswers.some(hasUnknown)) addConfirmation('disability-eligibility','本人・家族の障害者控除の対象要件、障害区分または同居状況を確認してください。');
  if(disabilityTotal.status==='calculated') forms.push({name:'扶養控除等申告書（障害者控除欄）',status:`障害者控除候補額：${disabilityTotal.amount.toLocaleString('ja-JP')}円。家族分は16歳未満も判定対象です。`});

  const dependentEligibility=Array.from({length:Number(a.depCount)||0},(_,n)=>{const i=n+1,inc=incomeFromAnswer(a[`dep:${i}:income`],a[`dep:${i}:salary`]);return {eligible:a[`dep:${i}:kin`]==='はい'&&a[`dep:${i}:shared`]==='いいえ'&&inc!==null&&inc<=TAX_RULES_2026.dependentDeduction.incomeLimit,unknown:inc===null||a[`dep:${i}:kin`]==='分からない'||a[`dep:${i}:shared`]==='分からない'};});
  const hasTaxDependent=dependentEligibility.some(x=>x.eligible)?true:dependentEligibility.some(x=>x.unknown)?null:false;
  const familyDeduction=calculateSingleParentOrWidow({maritalStatus:a.parentStatus,deFactoPartner:a.deFactoPartner,hasQualifyingChild:a.parentChild==='はい'?true:a.parentChild==='いいえ'?false:a.parentChild,hasDependent:hasTaxDependent,widowGender:a.widowGender==='女性'?true:a.widowGender==='女性以外'?false:a.widowGender,taxpayerTotalIncome:totalIncome,childIncome:a.parentChildIncome,childClaimedElsewhere:a.parentChildClaimed==='いいえ'?false:a.parentChildClaimed==='はい'?true:a.parentChildClaimed});
  const familyStatusAnswers=[a.parentStatus,a.deFactoPartner,a.parentChild,a.parentChildIncomeKnown,a.parentChildIncome,a.parentChildClaimed,a.widowGender];
  if(familyDeduction.status==='needs_confirmation'&&a.parentStatus&&!familyStatusAnswers.some(hasUnknown)) addConfirmation('family-status-review','ひとり親・寡婦控除の所得要件、子または扶養親族の要件を担当者へ確認してください。');
  if(familyDeduction.status==='calculated') forms.push({name:'扶養控除等申告書（ひとり親・寡婦欄）',status:`${familyDeduction.type==='single_parent'?'ひとり親':'寡婦'}控除候補額：${familyDeduction.amount.toLocaleString('ja-JP')}円。`});
  const workIncomeKnown=hasGrossSalary&&grossSalary>0?true:a.otherIncome==='ない'&&hasGrossSalary?false:null;
  const qualifyingSchool=a.studentSchool==='小・中・高校、大学、高等専門学校'||a.studentSchool==='対象課程と確認済みの専修学校等'?true:a.studentSchool==='それ以外'?false:null;
  const studentDeduction=calculateWorkingStudent({isStudent:a.student==='はい'?true:a.student==='いいえ'?false:null,qualifyingSchool,hasWorkIncome:workIncomeKnown,totalIncome,nonWorkIncome:a.otherIncome==='ない'?0:null});
  if(studentDeduction.status==='needs_confirmation'&&a.student==='はい'&&!hasUnknown(a.studentSchool)) addConfirmation('student-status','勤労学生控除の対象学校、勤労所得、合計所得または勤労以外の所得額を確認してください。');
  if(studentDeduction.status==='calculated') forms.push({name:'扶養控除等申告書（勤労学生欄）',status:`勤労学生控除候補額：${studentDeduction.amount.toLocaleString('ja-JP')}円。`});

  if(Number.isFinite(grossSalary)&&grossSalary>TAX_RULES_2026.thresholds.salaryForIncomeAdjustmentQuestion&&(incomeAdjustmentDeduction===null||incomeAdjustmentDeduction>0)) {
    forms.push({name:'所得金額調整控除申告書',status:incomeAdjustmentDeduction===null?'適用要件の一部が未確認です。':`所得金額調整控除の候補額：${incomeAdjustmentDeduction.toLocaleString('ja-JP')}円。`});
    if(incomeAdjustmentDeduction===null) addConfirmation('income-adjustment-candidate','所得金額調整控除の適用要件を確認してください。');
  }
  if(a.housing==='はい'&&a.housingFirst==='いいえ') {docs.add('年末調整のための住宅借入金等特別控除申告書兼控除証明書');docs.add('住宅取得資金に係る借入金の年末残高等証明書または調書方式の年末残高等情報');forms.push({name:'給与所得者の住宅借入金等特別控除申告書（2年目以降）',status:'申告書・年末残高情報の提出方法を勤務先の案内で確認してください。控除額計算は未実装です。'});}
  if(a.housing==='はい'&&a.housingFirst==='はい') {docs.add('住宅ローン控除の初年度の確定申告に必要な書類（住宅・借入・居住等の要件により異なります）');addConfirmation('housing-first-year','住宅ローン控除の初年度は、原則として確定申告が必要です。個別の必要書類と要件を税務署または確定申告案内で確認してください。');}
  if(a.housing==='はい'&&a.housingFirst==='分からない') addConfirmation('housing-year-unknown','住宅ローン控除の適用開始年を確認してください。');

  for(const [key,value] of Object.entries(a)) {
    if(value!=='分からない'&&!(Array.isArray(value)&&value.includes('分からない'))) continue;
    const q=QUESTIONS[baseQuestionId(key)];
    const topic=key.startsWith('dep:')&&key.endsWith(':shared')?'dependent-overlap':`unknown:${key}`;
    addConfirmation(topic,q?.unknown||`${q?.text||key}について会社の担当者へ確認してください。`);
  }
  for(const item of (a.special||[])) if(item!=='どれもない') addConfirmation(item.includes('扶養')?'dependent-overlap':`special:${item}`,`「${item}」について会社の担当者へ確認してください。`);
  return {forms,docs:[...docs],confirmations:[...confirmationMap.values()],a,calculations:{grossSalary:hasGrossSalary?grossSalary:null,salaryIncome, incomeAdjustmentDeduction, adjustedSalaryIncome,totalIncome,basicDeduction,spouse:{grossIncome:spouseGrossIncome,totalIncome:spouseGrossIncome===null?null:spouseGrossIncome,deduction:spouseDeduction},dependents:dependentResults,deductions:{lifeInsurance,earthquake:earthquakeDeduction,socialInsurance:socialDeduction,smallBusinessMutualAid:mutualAidDeduction,disability:disabilityTotal,singleParentOrWidow:familyDeduction,workingStudent:studentDeduction}}};
}
