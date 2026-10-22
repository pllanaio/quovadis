'use client';
import {useEffect,useState} from 'react';
import {Alert,Button,Card,Chip,Link,Spinner} from '@heroui/react';
import {ArrowUpRight,FileCheck2,History,RefreshCw} from 'lucide-react';
import {dateLabel,sourceLabel,webHref,type ResearchLead,type OpportunitySignal,type SignalEvent} from './lead-types';

export type {ResearchLead} from './lead-types';
const categories:Record<string,string>={jobs:'Stellenanzeige',tenders:'Ausschreibung',migration:'IT-Modernisierung',providers:'Dienstleistersuche',growth:'Wachstum',social:'Social Media',news:'Presse & Meldungen'};
const eventLabels:Record<string,string>={detected:'Signal gefunden',superseded:'Neuer Beleg',reappeared:'Beleg wieder verfügbar',not_found:'Quelle nicht erreichbar',source_changed:'Beleg verändert',content_changed:'Seite aktualisiert'};

export default function ResearchDetail({lead,onRefresh}:{lead:ResearchLead;onRefresh:()=>void}){
 const [signals,setSignals]=useState<OpportunitySignal[]>([]),[events,setEvents]=useState<SignalEvent[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');
  fetch('/api/opportunities/signals?id='+lead.id,{signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Belege konnten nicht geladen werden.');setSignals(data.signals||[]);setEvents(data.events||[])}).catch(cause=>{if(!controller.signal.aborted)setError(String(cause))}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return ()=>controller.abort();
 },[lead.id,lead.last_checked_at,lead.research_status]);
 async function retry(){
  setBusy(true);setError('');
  try{const response=await fetch('/api/research/deep',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:lead.id})});const data=await response.json();if(!response.ok)throw Error(data.error||'Recherche konnte nicht gestartet werden.');onRefresh();if(data.errors?.length)throw Error(data.errors.join('; '))}
  catch(cause){setError(String(cause))}finally{setBusy(false)}
 }
 const findings=(lead.research_sources||[]).filter(source=>source.kind!=='Auslöser');
 return <div className="space-y-6">
  <div className="flex flex-wrap items-start justify-between gap-4">
   <div><h3 className="text-lg font-semibold tracking-tight text-foreground">Belege, auf die du dich beziehen kannst</h3><p className="mt-1 text-sm leading-6 text-muted">Originalquellen, wörtliche Fundstellen und der Zeitpunkt ihrer letzten Prüfung.</p></div>
   {lead.evidence_quote&&<Button variant="secondary" size="sm" isPending={busy} onPress={retry}>{busy?<Spinner size="sm"/>:<RefreshCw size={15}/>}Erneut recherchieren</Button>}
  </div>
  {error&&<Alert status="danger"><Alert.Indicator/><Alert.Content><Alert.Title>Recherchehinweis</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}
  {!error&&lead.research_error&&lead.research_status!=='complete'&&<Alert status="warning"><Alert.Indicator/><Alert.Content><Alert.Title>Recherche noch unvollständig</Alert.Title><Alert.Description>{lead.research_error}</Alert.Description></Alert.Content></Alert>}
  {!lead.evidence_quote&&<Alert status="warning"><Alert.Indicator/><Alert.Content><Alert.Title>Noch kein überprüfter Originalbeleg</Alert.Title><Alert.Description>Dieser ältere Eintrag enthält kein gespeichertes Signalzitat.</Alert.Description></Alert.Content></Alert>}
  {loading?<div className="flex items-center gap-3 py-10 text-sm text-muted"><Spinner size="sm"/>Belege werden geladen …</div>:signals.length?<div className="space-y-4">{signals.map(signal=><Card key={signal.id} className="border border-border bg-surface shadow-none"><Card.Content className="space-y-4 p-5">
   <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><Chip size="sm" color={signal.priority==='A'?'success':signal.priority==='B'?'accent':'warning'} variant="soft">Priorität {signal.priority}</Chip><span className="text-xs font-medium text-muted">{categories[signal.category]||signal.category}</span></div><Chip size="sm" color={signal.status==='active'?'success':signal.status==='missing'?'danger':'warning'} variant="soft">{signal.status==='active'?'Beleg verfügbar':signal.status==='missing'?'Derzeit nicht auffindbar':signal.status==='changed'?'Belegtext verändert':'Früherer Beleg'}</Chip></div>
   <h4 className="text-base font-semibold leading-6 text-foreground">{signal.signal}</h4>
   <blockquote className="rounded-xl border-l-3 border-accent bg-accent-soft px-4 py-3 text-sm leading-7 text-foreground">„{signal.evidence_quote}“</blockquote>
   <div className="flex flex-wrap items-end justify-between gap-3"><dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs"><div><dt className="text-muted">Veröffentlicht</dt><dd className="mt-1 text-foreground">{dateLabel(signal.published_at)}</dd></div><div><dt className="text-muted">Zuletzt geprüft</dt><dd className="mt-1 text-foreground">{dateLabel(signal.last_checked_at,true)}</dd></div></dl>{webHref(signal.source_url)&&<Link href={webHref(signal.source_url)} target="_blank" rel="noopener noreferrer" className="text-sm">{sourceLabel(signal.source_reliability)}<ArrowUpRight size={14}/></Link>}</div>
  </Card.Content></Card>)}</div>:lead.evidence_quote?<Card className="border border-border bg-surface shadow-none"><Card.Content className="p-5"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileCheck2 size={17}/>Gespeichertes Signal</div><blockquote className="text-sm leading-7 text-muted">„{lead.evidence_quote}“</blockquote></Card.Content></Card>:null}
  {findings.length>0&&<section className="space-y-3"><h3 className="text-base font-semibold">Zusätzliche Firmenrecherche</h3>{findings.map((finding,index)=><Card key={index} className="border border-border bg-surface shadow-none"><Card.Content className="space-y-3 p-5"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-wider text-muted">{finding.kind||'Weitere Quelle'}</span>{webHref(finding.url)&&<Link href={webHref(finding.url)} target="_blank" rel="noopener noreferrer" className="text-xs">Quelle öffnen<ArrowUpRight size={14}/></Link>}</div>{finding.insight&&<p className="text-sm font-medium leading-6 text-foreground">{finding.insight}</p>}<blockquote className="border-l-2 border-border pl-4 text-sm leading-6 text-muted">„{finding.quote}“</blockquote></Card.Content></Card>)}</section>}
  {events.length>0&&<Card className="border border-border bg-surface shadow-none"><Card.Header className="px-5 pt-5"><Card.Title className="flex items-center gap-2 text-base"><History size={17}/>Änderungen der Quellen</Card.Title></Card.Header><Card.Content className="divide-y divide-border px-5 pb-3">{events.slice(0,12).map((event,index)=><div key={index} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-semibold text-foreground">{eventLabels[event.kind]||event.kind}</span><time className="text-muted">{dateLabel(event.created_at,true)}</time></div><p className="mt-1 text-sm leading-6 text-muted">{event.detail}</p></div>)}</Card.Content></Card>}
 </div>;
}
