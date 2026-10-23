'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {Alert, Button, Card, Chip, Form, Label, Link, Modal, Spinner, TextArea, TextField} from '@heroui/react';
import {ArrowUp, Check, Code2, ExternalLink, MessageSquare, Plus, Sparkles, WandSparkles, X} from 'lucide-react';
import CodeReviewPanel from './code-review-panel';

type Proposal = {kind:string; instruction?:string; value?:unknown; sourceId?:string; enabled?:boolean; source?:{name:string;url:string}; dailyAt?:string; intervalMinutes?:number; leadId?:number; score?:number; summary?:string; text?:string};
type Evaluation = {source:string; resultA:{count:number;averageScore:number;leads:{name:string;sourceUrl:string}[]}; resultB:{count:number;averageScore:number;leads:{name:string;sourceUrl:string}[]}; caveat:string};
type CodeDraft = {id:string;summary:string;status:string;pr_url?:string|null};
type CompanyReview={id:string;url:string;status:string;name?:string;opportunityId?:string;error?:string};
type Message = {id:string;company_review?:CompanyReview|null;code_draft?:CodeDraft|null;role:'user'|'assistant';content:string;proposal?:Proposal|null;applied_at?:string|null;evaluation?:Evaluation|null};
const activeReview=(item:Message)=>!!item.company_review&&['queued','running','pending','researching','failed','needs_source'].includes(item.company_review.status);

function proposalLabel(proposal: Proposal) {
  switch (proposal.kind) {
    case 'search_prompt': return 'Suchprompt übernehmen';
    case 'skills': return 'Recherche-Skills ändern';
    case 'source_enabled': return `Quelle ${proposal.enabled ? 'aktivieren' : 'deaktivieren'}`;
    case 'source_add': return `Quelle hinzufügen: ${proposal.source?.name || ''}`;
    case 'schedule': return proposal.dailyAt ? `Täglich um ${proposal.dailyAt} Uhr suchen` : 'Tägliche Recherche anpassen';
    case 'lead_note': return `Notiz zu Lead ${proposal.leadId} speichern`;
    case 'lead_update': return `Lead ${proposal.leadId} aktualisieren`;
    case 'research_run': return 'Recherche starten';
    case 'code_change': return 'Code-Entwurf vorbereiten';
    default: return 'Änderung übernehmen';
  }
}
function proposalDetail(proposal: Proposal) {
  if (proposal.kind === 'search_prompt') return String(proposal.value || '');
  if (proposal.kind === 'skills') return Array.isArray(proposal.value) ? proposal.value.join(', ') : '';
  if (proposal.kind === 'source_add') return proposal.source?.url || '';
  if (proposal.kind === 'lead_note') return proposal.text || '';
  if (proposal.kind === 'code_change') return proposal.instruction || '';
  if (proposal.kind === 'lead_update') return [proposal.score !== undefined ? `Score ${proposal.score}` : '', proposal.summary || ''].filter(Boolean).join(' · ');
  return '';
}
function messageError(error: unknown) {return error instanceof Error ? error.message.replace(/^Error: /, '') : 'Die Anfrage konnte nicht abgeschlossen werden.';}

export default function AssistantPanel({lead, onChanged, onClose, onOpenCompany}: {onOpenCompany?:(id:string)=>void;lead?:{id:number;name:string};onChanged:()=>void;onClose:()=>void}) {
  const [items, setItems] = useState<Message[]>([]);
  const [reviewId, setReviewId] = useState<string|null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [hasError, setHasError] = useState(false);
  const conversation = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const hasActiveReview=items.some(activeReview);
  const changedRef=useRef(onChanged);
  useEffect(()=>{changedRef.current=onChanged},[onChanged]);
  useEffect(()=>{
    if(!hasActiveReview||busy)return;
    const controller=new AbortController();
    const timer=setInterval(async()=>{
      try{const response=await fetch('/api/assistant',{signal:controller.signal});if(!response.ok)return;const data=await response.json();if(!controller.signal.aborted){setItems(data.items||[]);changedRef.current()}}
      catch{/* The next poll retries a transient connection error. */}
    },6000);
    return()=>{clearInterval(timer);controller.abort()};
  },[hasActiveReview,busy]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/assistant', {signal:controller.signal}).then(async response => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Der Chat konnte nicht geladen werden.');
      setItems(data.items || []);
    }).catch(error => {if (!controller.signal.aborted) {setStatus(messageError(error));setHasError(true);}}).finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const panel = conversation.current;
    if (panel) panel.scrollTo({top:panel.scrollHeight, behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  }, [items, busy, status]);

  async function send(text = draft) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);setStatus('');setHasError(false);setDraft('');
    const optimistic: Message = {id:`pending-${Date.now()}`, role:'user', content:message};
    setItems(old => [...old, optimistic]);
    try {
      const response = await fetch('/api/assistant', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message, leadId:lead?.id})});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Die KI-Anfrage ist fehlgeschlagen.');
      setItems(old => [...old.map(item => item.id === optimistic.id ? {...item, id:`user-${result.id}`} : item), result]);
      if(result.company_review)onChanged();
    } catch (error) {
      setItems(old => old.filter(item => item.id !== optimistic.id));setDraft(message);setStatus(messageError(error));setHasError(true);
    } finally {setBusy(false);}
  }
  async function apply(id: string) {
    setBusy(true);setStatus('');setHasError(false);
    try {
      const response = await fetch('/api/assistant/apply', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({messageId:id})});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Die Änderung konnte nicht übernommen werden.');
      setItems(old => old.map(item => item.id === id ? {...item, applied_at:new Date().toISOString(), code_draft:result.draft || item.code_draft} : item));
      setStatus(result.result);onChanged();
    } catch (error) {setStatus(messageError(error));setHasError(true);} finally {setBusy(false);}
  }

  return <>
    <Modal isOpen onOpenChange={open => {if (!open && !reviewId) onClose();}}>
      <Modal.Backdrop className="justify-end" isDismissable={!reviewId} isKeyboardDismissDisabled={!!reviewId}>
        <Modal.Container size="full" placement="top" scroll="inside" className="ml-auto w-full min-w-0 max-w-full flex-none p-0 sm:w-[min(34rem,100vw)] sm:p-0">
          <Modal.Dialog aria-labelledby={headingId} className="flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden rounded-none border-l border-border bg-background p-0 text-foreground shadow-xl">
            <Modal.Header className="m-0 min-w-0 shrink-0 flex-row items-center justify-between gap-2 border-b border-border bg-surface px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
              <div className="flex min-w-0 items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Sparkles size={20} aria-hidden="true"/></div><div className="min-w-0"><Modal.Heading id={headingId} className="font-semibold">Dein KI-Begleiter</Modal.Heading><p className="mt-0.5 truncate text-xs text-muted">{lead ? lead.name : 'Recherche, Prompts und nächste Schritte'}</p></div></div>
              <Button isIconOnly variant="ghost" className="size-11 min-h-11 min-w-11 shrink-0" aria-label="KI-Begleiter schließen" onPress={onClose}><X size={20} aria-hidden="true"/></Button>
            </Modal.Header>
            <Modal.Body ref={conversation} className="m-0 min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-background px-4 py-5 sm:px-6">
              {loading && <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted" role="status"><Spinner size="sm"/> Chat wird geladen</div>}
              {!loading && !items.length && <div className="min-w-0 py-3 sm:py-6">
                <div className="mb-6 inline-flex size-12 items-center justify-center rounded-2xl border border-border bg-surface text-accent"><MessageSquare size={23} aria-hidden="true"/></div>
                <h3 className="text-xl font-semibold tracking-tight text-foreground">Woran arbeiten wir?</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">Sende eine Firmen-URL für eine vollständige Recherche mit Dossier und Bewertung. Oder entwickle Suchprompts und bereite den nächsten Kontakt vor.</p>
                <div className="mt-7 flex flex-col gap-3">
                  <Button variant="outline" isDisabled={busy} className="h-auto min-h-11 justify-start gap-3 whitespace-normal bg-surface px-4 py-4 text-left" onPress={() => send('Analysiere meinen aktuellen Suchprompt und schlage eine präzisere Version für belegte IT-Bedarfssignale vor.')}><WandSparkles size={17} className="shrink-0 text-accent" aria-hidden="true"/> Suchprompt verbessern</Button>
                  <Button variant="outline" isDisabled={busy} className="h-auto min-h-11 justify-start gap-3 whitespace-normal bg-surface px-4 py-4 text-left" onPress={() => send('Erkläre mir, wie wir zwei Suchprompts an denselben Originalquellen vergleichen können.')}><Plus size={17} className="shrink-0 text-accent" aria-hidden="true"/> Zwei Prompts vergleichen</Button>
                  {lead && <Button variant="outline" isDisabled={busy} className="h-auto min-h-11 min-w-0 justify-start gap-3 whitespace-normal bg-surface px-4 py-4 text-left" onPress={() => send('Formuliere einen sachlichen Gesprächseinstieg für diesen Lead, ausschließlich auf Grundlage der belegten Informationen.')}><MessageSquare size={17} className="shrink-0 text-accent" aria-hidden="true"/><span className="min-w-0 [overflow-wrap:anywhere]">Gesprächseinstieg für {lead.name}</span></Button>}
                </div>
                <p className="mt-7 text-xs leading-relaxed text-muted">Nachrichten und ausgewählte Lead-Daten werden an deinen konfigurierten KI-Anbieter gesendet.</p>
              </div>}
              <div className="min-w-0 space-y-6" role="log" aria-label="Nachrichten mit dem KI-Begleiter" aria-live="polite" aria-relevant="additions" aria-busy={loading}>
                {items.map(item => <article key={item.id} className={`min-w-0 max-w-full ${item.role === 'user' ? 'ml-4 sm:ml-8' : 'sm:mr-2'}`}>
                  <p className={`mb-2 flex items-center gap-1.5 text-[11px] font-semibold ${item.role === 'user' ? 'justify-end text-muted' : 'text-accent'}`}>{item.role === 'user' ? 'DU' : <><Sparkles size={12} aria-hidden="true"/> QUOVADIS</>}</p>
                  <div className={`min-w-0 max-w-full rounded-2xl px-4 py-3.5 text-sm leading-relaxed ${item.role === 'user' ? 'bg-accent text-accent-foreground' : 'border border-border bg-surface text-foreground'}`}><p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{item.content}</p></div>
                  {item.company_review&&<Card className="mt-3 min-w-0 border border-border bg-surface p-4 shadow-none"><Card.Content className="space-y-2 p-0"><p className="flex items-center gap-2 text-sm font-semibold">{['queued','running','pending','researching'].includes(item.company_review.status)?<Spinner size="sm"/>:<Check size={16}/>} {item.company_review.name||'Firmenprüfung'}</p><p className="text-xs text-muted">{item.company_review.status==='complete'?'Vertieft · Dossier und Bewertung unter „Alle Firmen“ verfügbar':item.company_review.status==='deleted'?'Firmeneintrag wurde gelöscht':['intake_failed','failed','needs_source'].includes(item.company_review.status)?'Prüfung derzeit nicht abgeschlossen · URL bei Bedarf erneut senden':item.company_review.status==='pending'||item.company_review.status==='researching'?'Firma erfasst · Deep Dive läuft':item.company_review.status==='queued'?'Firmenprüfung eingeplant · wartet auf den Hintergrunddienst':'Website wird geprüft · anschließend folgt der Deep Dive'}</p><p className="break-all text-xs text-muted">{item.company_review.url}</p>{item.company_review.opportunityId&&onOpenCompany&&<Button variant="outline" size="sm" className="min-h-11" onPress={()=>onOpenCompany(item.company_review!.opportunityId!)}>Firmendossier öffnen <ExternalLink size={14}/></Button>}{item.company_review.error&&<p className="text-xs text-warning [overflow-wrap:anywhere]">{item.company_review.error}</p>}</Card.Content></Card>}
                  {item.evaluation && <Card className="mt-3 min-w-0 max-w-full overflow-hidden border border-border bg-surface p-4 shadow-none">
                    <Card.Header className="min-w-0 p-0"><Card.Title className="text-sm font-semibold">Promptvergleich</Card.Title><Card.Description className="line-clamp-2 break-all text-xs">{item.evaluation.source}</Card.Description></Card.Header>
                    <Card.Content className="mt-4 grid min-w-0 grid-cols-2 gap-3 p-0">{[{name:'Variante A',result:item.evaluation.resultA},{name:'Variante B',result:item.evaluation.resultB}].map(variant => <div key={variant.name} className="min-w-0 rounded-xl bg-surface-secondary p-3 [overflow-wrap:anywhere]"><p className="text-xs text-muted">{variant.name}</p><p className="mt-1 text-xl font-semibold text-foreground">{variant.result.count}<span className="ml-1 text-xs font-normal text-muted">Treffer</span></p><p className="mt-1 text-xs text-muted">Ø Score {variant.result.averageScore}</p></div>)}</Card.Content>
                    <Card.Footer className="mt-3 min-w-0 p-0 text-xs leading-relaxed text-muted [overflow-wrap:anywhere]">{item.evaluation.caveat}</Card.Footer>
                  </Card>}
                  {item.proposal && <Card className="mt-3 min-w-0 max-w-full overflow-hidden border border-accent/20 bg-accent-soft p-4 shadow-none">
                    <Card.Header className="min-w-0 p-0"><p className="mb-2 text-[10px] font-semibold tracking-wider text-accent">VORSCHLAG</p><Card.Title className="text-sm font-semibold [overflow-wrap:anywhere]">{proposalLabel(item.proposal)}</Card.Title></Card.Header>
                    {proposalDetail(item.proposal) && <Card.Content className="mt-3 max-h-40 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain p-0 text-xs leading-relaxed whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">{proposalDetail(item.proposal)}</Card.Content>}
                    <Card.Footer className="mt-4 flex flex-wrap gap-2 p-0">
                      {item.applied_at ? <Chip color="success" size="sm" variant="soft"><Check size={12} aria-hidden="true"/><Chip.Label>{item.code_draft ? 'Entwurf vorbereitet' : 'Übernommen'}</Chip.Label></Chip> : <Button size="sm" className="min-h-11 whitespace-normal" variant="primary" isDisabled={busy} onPress={() => apply(item.id)}>{item.proposal.kind === 'code_change' ? <Code2 size={14} className="shrink-0" aria-hidden="true"/> : <Check size={14} className="shrink-0" aria-hidden="true"/>} {item.proposal.kind === 'code_change' ? 'Entwurf vorbereiten' : 'Änderung übernehmen'}</Button>}
                      {item.code_draft && <Button size="sm" className="min-h-11" variant="outline" onPress={() => setReviewId(item.code_draft!.id)}><Code2 size={14} aria-hidden="true"/> Diff prüfen</Button>}
                      {item.code_draft?.pr_url && <Link href={item.code_draft.pr_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 px-2 text-xs">PR öffnen <ExternalLink size={12} aria-hidden="true"/></Link>}
                    </Card.Footer>
                  </Card>}
                </article>)}
              </div>
              {busy && <div className="mt-5 flex items-center gap-2 text-xs text-muted" role="status"><Spinner size="sm"/> Dein Begleiter arbeitet …</div>}
              {status && <Alert status={hasError ? 'danger' : 'success'} className="mt-5 min-w-0"><Alert.Content className="min-w-0"><Alert.Description className="text-xs [overflow-wrap:anywhere]">{status}</Alert.Description></Alert.Content></Alert>}
            </Modal.Body>
            <Modal.Footer className="m-0 block min-w-0 shrink-0 border-t border-border bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
              <Form className="flex w-full min-w-0 items-end gap-2" onSubmit={event => {event.preventDefault();void send();}}>
                <TextField className="min-w-0 flex-1" value={draft} onChange={setDraft} aria-label="Nachricht an den Begleiter" isDisabled={busy}>
                  <Label className="sr-only">Nachricht an den Begleiter</Label>
                  <TextArea rows={2} placeholder="Firmen-URL oder Nachricht eingeben …" enterKeyHint="send" className="max-h-32 min-h-16 w-full min-w-0 resize-none overflow-y-auto bg-field text-base text-foreground sm:text-sm" onKeyDown={event => {if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault();void send();}}}/>
                </TextField>
                <Button type="submit" isIconOnly variant="primary" className="size-11 min-h-11 min-w-11 shrink-0" isDisabled={busy || !draft.trim()} aria-label="Nachricht senden"><ArrowUp size={20} aria-hidden="true"/></Button>
              </Form>
              <p className="mt-2 hidden text-[11px] text-muted sm:block">Enter senden · Shift + Enter neue Zeile</p>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
    {reviewId && <CodeReviewPanel draftId={reviewId} onClose={() => setReviewId(null)} onPublished={url => setItems(old => old.map(item => item.code_draft?.id === reviewId ? {...item, code_draft:{...item.code_draft, status:'published', pr_url:url}} : item))}/>}
  </>;
}
