'use client';
import {useState} from 'react';

export type ResearchLead={id:number;evidence_quote?:string|null;research_status?:string;research_summary?:string|null;research_sources?:{url:string;quote:string;insight?:string;kind?:string}[];research_error?:string|null;contact_source_url?:string|null;detected_at?:string|null;researched_at?:string|null};

export default function ResearchDetail({lead,onRefresh}:{lead:ResearchLead;onRefresh:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!lead.evidence_quote)return <p className="muted">Dieser Eintrag stammt aus dem Altbestand. Ein überprüftes IT-Bedarfssignal ist dafür nicht hinterlegt.</p>;
 const label=lead.research_status==='complete'?'Vertiefung abgeschlossen':lead.research_status==='pending'?'Vertiefung ausstehend':lead.research_status==='needs_source'?'Weitere Quellen benötigt':lead.research_status==='failed'?'Vertiefung fehlgeschlagen':'Signal erkannt';
 async function retry(){setBusy(true);setError('');try{const response=await fetch('/api/research/deep',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:lead.id})});const result=await response.json();if(!response.ok)throw Error(result.error||'Recherche fehlgeschlagen');onRefresh()}catch(e){setError(String(e))}finally{setBusy(false)}}
 return <>
  <div className="research-status">{label}</div>
  <blockquote className="research-quote">„{lead.evidence_quote}“</blockquote>
  {lead.detected_at&&<p className="muted research-meta">Signal erkannt: {new Date(lead.detected_at).toLocaleString('de-DE')}</p>}
  {lead.research_status==='complete'&&<div className="section"><h3>Deep Research</h3><p>{lead.research_summary}</p>{(lead.research_sources||[]).filter(source=>source.kind!=='Auslöser').map((source,i)=><div className="research-finding" key={i}><a className="source" href={source.url} target="_blank" rel="noopener noreferrer">{source.kind||'Weitere Quelle'} ↗</a><blockquote>„{source.quote}“</blockquote>{source.insight&&<p>{source.insight}</p>}</div>)}{lead.contact_source_url&&<p className="muted research-meta">Kontaktquelle: <a className="source" href={lead.contact_source_url} target="_blank" rel="noopener noreferrer">{lead.contact_source_url}</a></p>}</div>}
  {lead.research_status!=='complete'&&<div className="section"><h3>Deep Research</h3><p className="muted">Beginnt erst nach einem belegten IT-Bedarfssignal. Die Vertiefung sucht zusätzliche Firmenquellen und belegte Kontaktdaten.</p>{lead.research_error&&<p className="muted research-meta">{lead.research_error}</p>}<button className="btn light" disabled={busy} onClick={retry}>{busy?'Recherchiert…':'Vertiefung jetzt versuchen'}</button>{error&&<p role="alert">{error}</p>}</div>}
 </>;
}
