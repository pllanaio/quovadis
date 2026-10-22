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
 return <div className="min-w-0 max-w-full space-y-5 text-foreground [overflow-wrap:anywhere] sm:space-y-6">
  <div className="flex min-w-0 flex-col items-start justify-between gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
   <div className="min-w-0 flex-1">
    <h3 className="text-base font-semibold leading-6 tracking-tight sm:text-lg">Belege, auf die du dich beziehen kannst</h3>
    <p className="mt-1 text-sm leading-6 text-muted">Originalquellen, wörtliche Fundstellen und der Zeitpunkt ihrer letzten Prüfung.</p>
   </div>
   {lead.evidence_quote&&<Button variant="secondary" size="sm" className="h-auto min-h-11 w-full min-w-0 shrink-0 whitespace-normal px-4 py-2 sm:w-auto" isPending={busy} onPress={retry}>{busy?<Spinner size="sm"/>:<RefreshCw size={15} className="shrink-0"/>}Erneut recherchieren</Button>}
  </div>
  {error&&<Alert status="danger" className="min-w-0"><Alert.Indicator/><Alert.Content className="min-w-0"><Alert.Title>Recherchehinweis</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}
  {!error&&lead.research_error&&lead.research_status!=='complete'&&<Alert status="warning" className="min-w-0"><Alert.Indicator/><Alert.Content className="min-w-0"><Alert.Title>Recherche noch unvollständig</Alert.Title><Alert.Description>{lead.research_error}</Alert.Description></Alert.Content></Alert>}
  {!lead.evidence_quote&&<Alert status="warning" className="min-w-0"><Alert.Indicator/><Alert.Content className="min-w-0"><Alert.Title>Noch kein überprüfter Originalbeleg</Alert.Title><Alert.Description>Dieser ältere Eintrag enthält kein gespeichertes Signalzitat.</Alert.Description></Alert.Content></Alert>}
  {loading?<div role="status" className="flex min-w-0 items-center gap-3 py-8 text-sm text-muted sm:py-10"><Spinner size="sm"/>Belege werden geladen …</div>:signals.length?<div className="min-w-0 space-y-4">{signals.map(signal=><Card key={signal.id} className="min-w-0 max-w-full border border-border bg-surface shadow-none">
   <Card.Content className="min-w-0 space-y-4 p-4 sm:p-5">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
     <div className="flex min-w-0 flex-wrap items-center gap-2"><Chip size="sm" className="max-w-full" color={signal.priority==='A'?'success':signal.priority==='B'?'accent':'warning'} variant="soft">Priorität {signal.priority}</Chip><span className="min-w-0 text-xs font-medium leading-5 text-muted">{categories[signal.category]||signal.category}</span></div>
     <Chip size="sm" className="max-w-full" color={signal.status==='active'?'success':signal.status==='missing'?'danger':'warning'} variant="soft">{signal.status==='active'?'Beleg verfügbar':signal.status==='missing'?'Derzeit nicht auffindbar':signal.status==='changed'?'Belegtext verändert':'Früherer Beleg'}</Chip>
    </div>
    <h4 className="text-base font-semibold leading-6">{signal.signal}</h4>
    <blockquote className="min-w-0 whitespace-pre-wrap rounded-xl border-l-3 border-accent bg-accent-soft px-3 py-3 text-sm leading-7 text-accent-soft-foreground sm:px-4">„{signal.evidence_quote}“</blockquote>
    <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
     <dl className="flex min-w-0 flex-wrap gap-x-6 gap-y-3 text-xs leading-5">
      <div className="min-w-0"><dt className="text-muted">Veröffentlicht</dt><dd className="mt-0.5">{dateLabel(signal.published_at)}</dd></div>
      <div className="min-w-0"><dt className="text-muted">Zuletzt geprüft</dt><dd className="mt-0.5">{dateLabel(signal.last_checked_at,true)}</dd></div>
     </dl>
     {webHref(signal.source_url)&&<Link href={webHref(signal.source_url)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-11 max-w-full items-center gap-1.5 rounded-lg px-2 py-2 text-sm leading-5 hover:bg-accent-soft"><span className="min-w-0">{sourceLabel(signal.source_reliability)}</span><ArrowUpRight size={15} className="shrink-0" aria-hidden="true"/></Link>}
    </div>
   </Card.Content>
  </Card>)}</div>:lead.evidence_quote?<Card className="min-w-0 max-w-full border border-border bg-surface shadow-none"><Card.Content className="min-w-0 p-4 sm:p-5"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileCheck2 size={17} className="shrink-0"/>Gespeichertes Signal</div><blockquote className="min-w-0 whitespace-pre-wrap text-sm leading-7 text-muted">„{lead.evidence_quote}“</blockquote></Card.Content></Card>:null}
  {findings.length>0&&<section className="min-w-0 space-y-3">
   <h3 className="text-base font-semibold leading-6">Zusätzliche Firmenrecherche</h3>
   {findings.map((finding,index)=><Card key={index} className="min-w-0 max-w-full border border-border bg-surface shadow-none"><Card.Content className="min-w-0 space-y-3 p-4 sm:p-5">
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
     <span className="min-w-0 text-xs font-semibold uppercase leading-5 tracking-wider text-muted">{finding.kind||'Weitere Quelle'}</span>
     {webHref(finding.url)&&<Link href={webHref(finding.url)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-11 max-w-full items-center gap-1.5 rounded-lg px-2 py-2 text-sm leading-5 hover:bg-accent-soft"><span className="min-w-0">Quelle öffnen</span><ArrowUpRight size={15} className="shrink-0" aria-hidden="true"/></Link>}
    </div>
    {finding.insight&&<p className="text-sm font-medium leading-6">{finding.insight}</p>}
    <blockquote className="min-w-0 whitespace-pre-wrap rounded-r-lg border-l-2 border-border bg-background px-3 py-3 text-sm leading-7 text-muted sm:px-4">„{finding.quote}“</blockquote>
   </Card.Content></Card>)}
  </section>}
  {events.length>0&&<Card className="min-w-0 max-w-full border border-border bg-surface shadow-none">
   <Card.Header className="min-w-0 px-4 pt-4 sm:px-5 sm:pt-5"><Card.Title className="flex min-w-0 items-start gap-2 text-base leading-6"><History size={17} className="mt-0.5 shrink-0"/>Änderungen der Quellen</Card.Title></Card.Header>
   <Card.Content className="min-w-0 divide-y divide-border px-4 pb-3 sm:px-5">{events.slice(0,12).map((event,index)=><div key={index} className="min-w-0 py-4">
    <div className="flex min-w-0 flex-col gap-1 text-xs leading-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2"><span className="min-w-0 font-semibold">{eventLabels[event.kind]||event.kind}</span><time className="min-w-0 text-muted">{dateLabel(event.created_at,true)}</time></div>
    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{event.detail}</p>
   </div>)}</Card.Content>
  </Card>}
 </div>;
}
