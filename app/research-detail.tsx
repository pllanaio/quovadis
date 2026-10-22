'use client';
import {useEffect,useState} from 'react';

type Finding={url:string;quote:string;insight?:string;kind?:string};
type Fact={field:string;value:string;sourceUrl:string;quote:string};
type Assessment={needStatus?:string;externalReadiness?:string;scoreBreakdown?:Record<string,number>;scoreReason?:string;conversationOpener?:string;pricing?:{hourlyRateMin:number;hourlyRateMax:number;estimated:boolean};monthlyPotential?:string;monthlyReason?:string;facts?:Fact[]};
type Signal={id:number;source_url:string;evidence_quote:string;signal:string;category:string;priority:string;source_reliability:string;published_at:string|null;first_seen_at:string;last_checked_at:string;status:string};
type Event={signal_id:number;kind:string;detail:string;created_at:string};
export type ResearchLead={id:number;evidence_quote?:string|null;research_status?:string;research_summary?:string|null;research_sources?:Finding[];research_error?:string|null;contact_source_url?:string|null;detected_at?:string|null;researched_at?:string|null;last_checked_at?:string|null;need_status?:string;external_readiness?:string;assessment?:Assessment};

const date=(value?:string|null)=>value?new Date(value).toLocaleString('de-DE'):'unbekannt';
export default function ResearchDetail({lead,onRefresh}:{lead:ResearchLead;onRefresh:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[signals,setSignals]=useState<Signal[]>([]),[events,setEvents]=useState<Event[]>([]);
 useEffect(()=>{fetch('/api/opportunities/signals?id='+lead.id).then(response=>response.json()).then(data=>{setSignals(data.signals||[]);setEvents(data.events||[])}).catch(()=>{})},[lead.id,lead.research_status,lead.last_checked_at]);
 if(!lead.evidence_quote)return <p className="muted">Dieser Eintrag stammt aus dem Altbestand. Ein überprüftes IT-Bedarfssignal ist dafür nicht hinterlegt.</p>;
 const label=lead.research_status==='complete'?'Vertiefung abgeschlossen':lead.research_status==='pending'?'Vertiefung ausstehend':lead.research_status==='needs_source'?'Weitere Quellen benötigt':lead.research_status==='failed'?'Vertiefung fehlgeschlagen':'Signal erkannt';
 async function retry(){setBusy(true);setError('');try{const response=await fetch('/api/research/deep',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:lead.id})});const result=await response.json();if(!response.ok)throw Error(result.error||'Recherche fehlgeschlagen');onRefresh()}catch(cause){setError(String(cause))}finally{setBusy(false)}}
 const assessment=lead.assessment||{};
 return <>
  <div className="research-status">{label} · {lead.need_status==='suspected'?'IT-Bedarf vermutet':'IT-Bedarf belegt'}</div>
  <blockquote className="research-quote">„{lead.evidence_quote}“</blockquote>
  <p className="muted research-meta">Erfasst: {date(lead.detected_at)} · Zuletzt geprüft: {date(lead.last_checked_at)}</p>
  <p className="muted research-meta">Offenheit für externe IT-Dienstleister: {lead.external_readiness==='proven'?'belegt':'nicht belegt'}</p>
  {lead.research_status==='complete'&&<div className="section"><h3>Deep Research</h3><p>{lead.research_summary}</p>{(lead.research_sources||[]).filter(source=>source.kind!=='Auslöser').map((source,i)=><div className="research-finding" key={i}><a className="source" href={source.url} target="_blank" rel="noopener noreferrer">{source.kind||'Weitere Quelle'} ↗</a><blockquote>„{source.quote}“</blockquote>{source.insight&&<p>{source.insight}</p>}</div>)}{lead.contact_source_url&&<p className="muted research-meta">Kontaktquelle: <a className="source" href={lead.contact_source_url} target="_blank" rel="noopener noreferrer">{lead.contact_source_url}</a></p>}
   <h3>Einordnung und Gesprächsansatz</h3><p>{assessment.scoreReason||'Keine Begründung gespeichert.'}</p>{assessment.scoreBreakdown&&<p className="muted research-meta">Score: Bedarf {assessment.scoreBreakdown.need}/35 · Externe Betreuung {assessment.scoreBreakdown.fit}/25 · Aktualität {assessment.scoreBreakdown.recency}/15 · Potenzial {assessment.scoreBreakdown.economics}/15 · Kontaktweg {assessment.scoreBreakdown.contact}/10</p>}{assessment.conversationOpener&&<p><b>Gesprächseinstieg:</b> {assessment.conversationOpener}</p>}
   {assessment.pricing&&<p><b>Geschätzter Nettostundensatz:</b> {assessment.pricing.hourlyRateMin}–{assessment.pricing.hourlyRateMax} € · Ausgangsbasis 100 €/h. Keine belegte Zahlungsbereitschaft.</p>}{assessment.monthlyPotential&&<p><b>Potenzial für laufende Betreuung:</b> {assessment.monthlyPotential==='high'?'hoch':assessment.monthlyPotential==='medium'?'mittel':assessment.monthlyPotential==='low'?'niedrig':'unbekannt'}{assessment.monthlyReason?' · '+assessment.monthlyReason:''}</p>}
   {!!assessment.facts?.length&&<><h3>Belegte Unternehmensdaten</h3>{assessment.facts.map((fact,i)=><p key={i}><b>{fact.field}:</b> {fact.value} · <a className="source" href={fact.sourceUrl} target="_blank" rel="noopener noreferrer">Quelle ↗</a><br/><small className="muted">„{fact.quote}“</small></p>)}</>}
  </div>}
  {lead.research_status!=='complete'&&<div className="section"><h3>Deep Research</h3><p className="muted">Beginnt erst nach einem belegten IT-Signal. Die Vertiefung sucht weitere Firmenquellen, Geschäftskontakte und einen Gesprächsansatz.</p>{lead.research_error&&<p className="muted research-meta">{lead.research_error}</p>}<button className="btn light" disabled={busy} onClick={retry}>{busy?'Recherchiert…':'Vertiefung jetzt versuchen'}</button>{error&&<p role="alert">{error}</p>}</div>}
  {!!signals.length&&<div className="section"><h3>Signale und Originalquellen</h3>{signals.map(signal=><div className="research-finding" key={signal.id}><b>Priorität {signal.priority} · {signal.category}</b> · <span className="muted">{signal.status==='active'?'aktiver Beleg':signal.status==='missing'?'Seite derzeit nicht auffindbar':signal.status==='changed'?'Belegtext verändert':'früherer Beleg'}</span><p>{signal.signal}</p><a className="source" href={signal.source_url} target="_blank" rel="noopener noreferrer">Originalquelle ↗</a><blockquote>„{signal.evidence_quote}“</blockquote><small className="muted">Veröffentlicht: {date(signal.published_at)} · geprüft: {date(signal.last_checked_at)} · Quellentyp: {signal.source_reliability}</small></div>)}</div>}
  {!!events.length&&<details className="section"><summary>Änderungsverlauf ({events.length})</summary>{events.map((event,i)=><p key={i} className="research-meta">{date(event.created_at)} · {event.kind}: {event.detail}</p>)}</details>}
 </>;
}
