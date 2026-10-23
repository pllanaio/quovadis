import type {EventIntelligence,OpportunityCategory} from '../lib/business-triggers';
export type Finding={url:string;quote:string;insight?:string;kind?:string;publishedAt?:string|null;checkedAt?:string;sourceReliability?:string};
export type CompanyFact={field:string;value:string;sourceUrl:string;quote:string;group?:'company'|'management'|'financial'|'technology';publishedAt?:string|null;checkedAt?:string;sourceReliability?:string};
export type BusinessContact={kind:string;label?:string;value:string;url?:string;sourceUrl:string;quote?:string;checkedAt?:string};
export type Assessment={
 needStatus?:string;externalReadiness?:string;scoreBreakdown?:Record<string,number>;scoreReason?:string;
 conversationOpener?:string;matchForecast?:string;serviceFit?:string;serviceOffer?:string;
 pricing?:{hourlyRateMin:number;hourlyRateMax:number;estimated:boolean;basis?:number;currency?:string;net?:boolean};
 monthlyPotential?:string;monthlyReason?:string;facts?:CompanyFact[];contacts?:BusinessContact[];
 researchCoverage?:{searches:number;verifiedPages:number;financialDataFound:boolean;checkedAt:string;limitations:string[]};
};
export type ResearchLead={
 id:number;research_stage?:string|null;research_attempts?:number;research_next_attempt_at?:string|null;research_updated_at?:string|null;evidence_quote?:string|null;research_status?:string;research_summary?:string|null;
 research_sources?:Finding[];research_error?:string|null;contact_source_url?:string|null;
 detected_at?:string|null;researched_at?:string|null;last_checked_at?:string|null;
 need_status?:string;external_readiness?:string;assessment?:Assessment;
};
export type Lead=ResearchLead&{
 name:string;city:string;signal:string;summary:string;source_url:string;score:number;opportunity_category?:OpportunityCategory;it_need_confidence?:number;entry_opportunity_score?:number;external_engagement?:string;event_intelligence?:EventIntelligence|null;
 phone?:string|null;email?:string|null;company_url?:string|null;created_at?:string;
 published_at?:string|null;is_stale?:boolean;chart_eligible?:boolean;last_note_at?:string|null;
 freshness_at?:string|null;stale_at?:string|null;ranking_score?:number;signal_count?:number;
};
export type Activity={id:number;kind:'note'|'call'|'email';note:string;created_at:string};
export type OpportunitySignal={id:number;source_url:string;evidence_quote:string;signal:string;category:string;priority:string;source_reliability:string;published_at:string|null;first_seen_at:string;last_checked_at:string;status:string};
export type SignalEvent={signal_id:number;kind:string;detail:string;created_at:string};

export function dateLabel(value?:string|null,withTime=false){
 if(!value)return 'Unbekannt';const date=new Date(value);if(!Number.isFinite(date.getTime()))return 'Unbekannt';
 return new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',...(withTime?{timeStyle:'short' as const}:{}),timeZone:'Europe/Berlin'}).format(date);
}
export function scoreColor(score:number):'success'|'warning'|'danger'{return score>=80?'success':score>=60?'warning':'danger'}
export function researchLabel(status?:string){return status==='complete'?'Recherche abgeschlossen':status==='researching'?'Dossier wird vertieft':status==='pending'?'Zur Vertiefung eingeplant':status==='needs_source'?'Weitere Quellen gesucht':status==='failed'?'Recherche fehlgeschlagen':'Signal erfasst'}
export function sourceLabel(kind?:string){return kind==='first_party'?'Unternehmensquelle':kind==='public_portal'?'Öffentliches Portal':kind==='secondary'?'Drittquelle':'Öffentliche Webseite'}
export function webHref(value?:string|null){try{const url=new URL(value||'');return ['https:','http:'].includes(url.protocol)?url.href:undefined}catch{return undefined}}
