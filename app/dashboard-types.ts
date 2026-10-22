import type {Lead} from './lead-types';
export type ResearchRun={id:number;status:string;stage?:string|null;started_at:string;finished_at?:string|null;searched:number;discovered?:number;verified:number;imported:number;rejected?:number;error?:string|null};
export type Overview={items:Lead[];stats:{total:number;active:number;stale:number;highMatch:number;researched:number;pending:number;contactable:number;newToday:number;averageScore:number};charts:{scoreBands:{label:string;color:string;count:number}[];cities:{city:string;count:number}[]};latestRun:ResearchRun|null};
export type SearchConfig={dailyAt:string;timezone:string;dailyEnabled:boolean;cities:string[];radiusKm:number;searchLimit:number};
export const emptyOverview:Overview={items:[],stats:{total:0,active:0,stale:0,highMatch:0,researched:0,pending:0,contactable:0,newToday:0,averageScore:0},charts:{scoreBands:[],cities:[]},latestRun:null};
export function dateLabel(value?:string|null){return value?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}).format(new Date(value)):'Noch keine Aktivität'}
