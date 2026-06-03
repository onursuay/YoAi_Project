// Standalone verification script for isScheduleDue logic.
// Byte-consistent with lib/seo/timezone.ts implementation.
// Run: node scripts/verify-schedule-due.mjs

const WEEKDAY_MAP = { Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6 }

function getLocalParts(tz, at) {
  const fmt = new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,weekday:'short'})
  const p = fmt.formatToParts(at); const g=(t)=>p.find(x=>x.type===t)?.value??''
  let hour=parseInt(g('hour'),10); if(hour===24)hour=0
  return { date:`${g('year')}-${g('month')}-${g('day')}`, hour, minute:parseInt(g('minute'),10), weekday:WEEKDAY_MAP[g('weekday')]??0 }
}

function lastDayOfMonth(y,m){return new Date(y,m,0).getDate()}

function isScheduleDue(input, at) {
  const local=getLocalParts(input.timezone,at)
  const [h,m]=input.publishTime.split(':'); const target=parseInt(h,10)*60+parseInt(m,10)
  if(input.lastRunDate===local.date)return false
  const [y,mo,d]=local.date.split('-').map(n=>parseInt(n,10))
  const mode=input.scheduleMode||''; let dayOk
  if(mode==='weekly_days')dayOk=(input.daysOfWeek??[]).includes(local.weekday)
  else if(mode==='monthly_days'){const dom=input.daysOfMonth??[];const last=lastDayOfMonth(y,mo);dayOk=dom.some(x=>x===d||(x>last&&d===last))}
  else if(mode==='daily')dayOk=true
  else{const f=input.frequency??'daily';if(f==='weekdays'&&(local.weekday===0||local.weekday===6))dayOk=false;else if(f==='weekly'&&input.weekday!=null&&local.weekday!==input.weekday)dayOk=false;else dayOk=true}
  if(!dayOk)return false
  return local.hour*60+local.minute>=target
}

const TZ='Europe/Istanbul'
const wed = new Date('2026-06-03T09:00:00Z') // 12:00 TR, Çarşamba (weekday=3)

// Debug: print local parts so we can verify date/weekday assumptions.
const localParts = getLocalParts(TZ, wed)
console.log('Local parts for 2026-06-03T09:00:00Z in Europe/Istanbul:', localParts)

let pass=true
const check=(name,got,exp)=>{ if(got!==exp){console.error('FAIL',name,'got',got,'expected',exp);pass=false}else{console.log('PASS',name)} }

check('daily', isScheduleDue({publishTime:'10:00',timezone:TZ,lastRunDate:null,scheduleMode:'daily'},wed), true)
check('weekly hit', isScheduleDue({publishTime:'10:00',timezone:TZ,lastRunDate:null,scheduleMode:'weekly_days',daysOfWeek:[1,3,5]},wed), true)
check('weekly miss', isScheduleDue({publishTime:'10:00',timezone:TZ,lastRunDate:null,scheduleMode:'weekly_days',daysOfWeek:[1,5]},wed), false)
check('monthly hit', isScheduleDue({publishTime:'10:00',timezone:TZ,lastRunDate:null,scheduleMode:'monthly_days',daysOfMonth:[1,3,15]},wed), true)
check('monthly miss', isScheduleDue({publishTime:'10:00',timezone:TZ,lastRunDate:null,scheduleMode:'monthly_days',daysOfMonth:[1,15]},wed), false)
check('time not yet', isScheduleDue({publishTime:'23:00',timezone:TZ,lastRunDate:null,scheduleMode:'daily'},wed), false)
check('already ran', isScheduleDue({publishTime:'10:00',timezone:TZ,lastRunDate:'2026-06-03',scheduleMode:'daily'},wed), false)
check('legacy weekly', isScheduleDue({publishTime:'10:00',timezone:TZ,lastRunDate:null,frequency:'weekly',weekday:3},wed), true)

console.log(pass?'✅ isScheduleDue PASS':'❌ FAIL'); process.exit(pass?0:1)
