// Store the reference rather than copying a name, so later holder edits propagate.
export const SAME_CONTRACT_HOLDER='__same_contract_holder__';
export function contractAnswer(routeId,answers={}) {
  const value=answers[routeId];
  return value===SAME_CONTRACT_HOLDER?answers[routeId.replace(/:(recipientName|insuredName)$/,':holderName')]??null:value??null;
}
export function createInitialState(){
  return {
    answers:{}, salaryGross:null, salaryIncome:null,
    spouse:{exists:null,sharedHousehold:null,claimedByOther:null,age:null,incomeType:null,salaryGross:null,salaryIncome:null,disability:{level:null,cohabiting:null}},
    dependents:[], lifeInsuranceContracts:[], earthquakeContracts:[],
    disability:{selfLevel:null,hasFamily:null,people:[]},
    familyStatus:{maritalStatus:null,deFactoPartner:null,hasQualifyingChild:null,childIncomeKnown:null,childTotalIncome:null,childClaimedElsewhere:null,widowGender:null,isStudent:null,qualifyingSchool:null},
    insurance:{lifeCertificate:null,earthquakeCertificate:null},
    socialInsurance:{paidOutsidePayroll:null,types:[],amount:null},
    ideco:{paid:null,type:null,amount:null}, housing:{hasDeduction:null,firstYear:null,documents:null,balance:null},
    specialCases:[],requiredDocuments:[],staffConfirmations:[]
  };
}

export function syncState(state){
  const a=state.answers;state.salaryGross=a.allSalary??a.ownSalary??null;state.salaryIncome=null;
  state.spouse={exists:a.spouse??null,sharedHousehold:a.spouseShared??null,claimedByOther:a.spouseClaimed??null,age:a.spouseAge??null,incomeType:a.spouseIncomeType??null,salaryGross:a.spouseSalary??null,salaryIncome:null,disability:{level:a['disability:spouse:level']??null,cohabiting:a['disability:spouse:cohabit']??null}};
  state.dependents=Array.from({length:Number(a.depCount)||0},(_,n)=>{
    const i=n+1,age=a[`dep:${i}:age`];
    const ageBand=age===undefined||age===null||!Number.isInteger(Number(age))?null:Number(age)<=15?'0-15':Number(age)<=18?'16-18':Number(age)<=22?'19-22':Number(age)<=69?'23-69':'70+';
    return {relative:a[`dep:${i}:kin`]??null,age:age??null,ageBand,incomeType:a[`dep:${i}:income`]??null,salaryIncome:a[`dep:${i}:salary`]??null,claimedByOther:a[`dep:${i}:shared`]??null,parentOrGrandparent:a[`dep:${i}:parent`]??null,livingArrangement:a[`dep:${i}:cohabit`]??null,disability:{level:a[`disability:dep:${i}:level`]??null,cohabiting:a[`disability:dep:${i}:cohabit`]??null}};
  });
  const disabilityPeople=[];
  if(a['disability:spouse:level']) disabilityPeople.push({person:'spouse',level:a['disability:spouse:level'],cohabiting:a['disability:spouse:cohabit']??null});
  for(let i=1;i<=Number(a.depCount||0);i++) if(a[`disability:dep:${i}:level`]) disabilityPeople.push({person:`dependent-${i}`,level:a[`disability:dep:${i}:level`],cohabiting:a[`disability:dep:${i}:cohabit`]??null});
  state.disability={selfLevel:a.disabilitySelf??null,hasFamily:a.disabilityFamily??null,people:disabilityPeople};
  state.familyStatus={maritalStatus:a.parentStatus??null,deFactoPartner:a.deFactoPartner??null,hasQualifyingChild:a.parentChild??null,childIncomeKnown:a.parentChildIncomeKnown??null,childTotalIncome:a.parentChildIncome??null,childClaimedElsewhere:a.parentChildClaimed??null,widowGender:a.widowGender??null,isStudent:a.student??null,qualifyingSchool:a.studentSchool??null};
  state.lifeInsuranceContracts=Array.from({length:Number(a.lifeCount)||0},(_,n)=>{const i=n+1,p=`life:${i}:`;return {category:a[p+'type']??null,amount:a[p+'amount']??null,payer:a[p+'paid']??null,beneficiary:a[p+'recipient']??null,...Object.fromEntries(['companyName','insuranceKind','insurancePeriod','holderName','recipientName','recipientRelationship','pensionStartDate'].map(key=>[key,contractAnswer(p+key,a)])),recipientRelationship:['本人','配偶者'].includes(a[p+'recipient'])?a[p+'recipient']:a[p+'recipientRelationship']??null};});
  state.earthquakeContracts=Array.from({length:Number(a.earthquakeCount)||0},(_,n)=>{const i=n+1,p=`earthquake:${i}:`;return {category:a[p+'type']??null,amount:a[p+'amount']??null,election:a[p+'election']??null,payer:a[p+'paid']??null,...Object.fromEntries(['companyName','insuranceKind','insurancePeriod','holderName','insuredName','insuredRelationship'].map(key=>[key,contractAnswer(p+key,a)]))};});
  state.insurance={lifeCertificate:a.life??null,earthquakeCertificate:a.earthquake??null};
  state.socialInsurance={paidOutsidePayroll:a.social??null,types:a.socialTypes??[],amount:a.socialAmount??null};
  state.ideco={paid:a.ideco??null,type:a.idecoType??null,amount:a.idecoAmount??null};
  state.housing={hasDeduction:a.housing??null,firstYear:a.housingFirst??null,documents:a.housingDocs??null,balance:a.housingBalance??null};
  state.specialCases=a.special??[];
  return state;
}

export function pruneState(state,route,selections={}){
  const active=new Set(route),a=state.answers;
  if(!route.includes('dependentCount')&&!route.some(x=>x.startsWith('dep:'))) delete a.depCount;
  if(!route.includes('lifeCount')&&!route.some(x=>x.startsWith('life:'))) delete a.lifeCount;
  if(!route.includes('earthquakeCount')&&!route.some(x=>x.startsWith('earthquake:'))) delete a.earthquakeCount;
  for(const key of Object.keys(a)) if(!['depCount','lifeCount','earthquakeCount','confirmations'].includes(key)&&!active.has(key)) delete a[key];
  for(const key of Object.keys(selections)) if(!active.has(key)) delete selections[key];
  syncState(state);
  return state;
}
