/** @param {unknown} value */
export function validTime(value){return typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value)}

/** @param {unknown} value */
export function validTimezone(value){
 if(typeof value!=='string'||!value.trim())return false;
 try{new Intl.DateTimeFormat('en',{timeZone:value}).format();return true}catch{return false}
}

/**
 * Calendar-day scheduling deliberately uses the selected time zone, not 24-hour
 * intervals. A skipped DST minute runs at the next valid minute. During the
 * repeated autumn hour the persisted date prevents a second execution.
 * @param {{dailyAt:string,timezone:string,dailyEnabled:boolean}} settings
 * @param {string|null|undefined} lastScheduledDate
 * @param {Date} [now]
 */
export function scheduleState(settings,lastScheduledDate,now=new Date()){
 if(!validTime(settings.dailyAt)||!validTimezone(settings.timezone))throw Error('Ungültiger Tageszeitplan');
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:settings.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const value=Object.fromEntries(parts.map(part=>[part.type,part.value]));
 const scheduleDate=`${value.year}-${value.month}-${value.day}`,localTime=`${value.hour}:${value.minute}`;
 return {scheduleDate,localTime,scheduledDue:settings.dailyEnabled&&localTime>=settings.dailyAt&&(!lastScheduledDate||lastScheduledDate<scheduleDate),lastScheduledDate:lastScheduledDate||null};
}
