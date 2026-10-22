'use client';

import {useEffect, useRef, useState} from 'react';
import {Alert, Button, Card, Chip, Form, Label, Link, Modal, Spinner, TextArea, TextField} from '@heroui/react';
import {ArrowUp, Check, Code2, ExternalLink, MessageSquare, Plus, Sparkles, WandSparkles, X} from 'lucide-react';
import CodeReviewPanel from './code-review-panel';

type Proposal = {kind:string; instruction?:string; value?:unknown; sourceId?:string; enabled?:boolean; source?:{name:string;url:string}; dailyAt?:string; intervalMinutes?:number; leadId?:number; score?:number; summary?:string; text?:string};
type Evaluation = {source:string; resultA:{count:number;averageScore:number;leads:{name:string;sourceUrl:string}[]}; resultB:{count:number;averageScore:number;leads:{name:string;sourceUrl:string}[]}; caveat:string};
type CodeDraft = {id:string;summary:string;status:string;pr_url?:string|null};
type Message = {id:string;code_draft?:CodeDraft|null;role:'user'|'assistant';content:string;proposal?:Proposal|null;applied_at?:string|null;evaluation?:Evaluation|null};

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

export default function AssistantPanel({lead, onChanged, onClose}: {lead?:{id:number;name:string};onChanged:()=>void;onClose:()=>void}) {
  const [items, setItems] = useState<Message[]>([]);
  const [reviewId, setReviewId] = useState<string|null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [hasError, setHasError] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/assistant', {signal:controller.signal}).then(async response => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Der Chat konnte nicht geladen werden.');
      setItems(data.items || []);
    }).catch(error => {if (!controller.signal.aborted) {setStatus(messageError(error));setHasError(true);}}).finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, []);
  useEffect(() => {bottom.current?.scrollIntoView({behavior:'smooth', block:'end'});}, [items, busy]);

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
    <Modal isOpen onOpenChange={open => {if (!open) onClose();}}>
      <Modal.Backdrop className="justify-end">
        <Modal.Container size="full" placement="top" scroll="inside" className="ml-auto w-full flex-none p-0 sm:w-[490px] sm:p-0">
          <Modal.Dialog aria-label="KI-Begleiter" className="h-full rounded-none p-0 shadow-2xl">
            <Modal.Header className="flex-row items-center justify-between border-b border-slate-100 px-6 py-5">
              <div className="flex min-w-0 items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Sparkles size={20}/></div><div className="min-w-0"><Modal.Heading className="font-semibold">Dein KI-Begleiter</Modal.Heading><p className="mt-0.5 truncate text-xs text-slate-500">{lead ? lead.name : 'Recherche, Prompts und nächste Schritte'}</p></div></div>
              <Button isIconOnly variant="ghost" size="sm" aria-label="KI-Begleiter schließen" onPress={onClose}><X size={18}/></Button>
            </Modal.Header>
            <Modal.Body className="m-0 overflow-y-auto bg-slate-50/70 p-6">
              {loading && <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500"><Spinner size="sm"/> Chat wird geladen</div>}
              {!loading && !items.length && <div className="py-6">
                <div className="mb-6 inline-flex size-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-blue-600"><MessageSquare size={23}/></div>
                <h3 className="text-xl font-semibold tracking-tight text-slate-900">Woran arbeiten wir?</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">Entwickle Suchprompts, ordne Leads ein oder bereite den nächsten Kontakt vor. Konkrete Änderungen kannst du direkt übernehmen.</p>
                <div className="mt-7 flex flex-col gap-3">
                  <Button variant="outline" className="h-auto justify-start gap-3 whitespace-normal px-4 py-4 text-left" onPress={() => send('Analysiere meinen aktuellen Suchprompt und schlage eine präzisere Version für belegte IT-Bedarfssignale vor.')}><WandSparkles size={17} className="shrink-0 text-blue-600"/> Suchprompt verbessern</Button>
                  <Button variant="outline" className="h-auto justify-start gap-3 whitespace-normal px-4 py-4 text-left" onPress={() => send('Erkläre mir, wie wir zwei Suchprompts an denselben Originalquellen vergleichen können.')}><Plus size={17} className="shrink-0 text-blue-600"/> Zwei Prompts vergleichen</Button>
                  {lead && <Button variant="outline" className="h-auto justify-start gap-3 whitespace-normal px-4 py-4 text-left" onPress={() => send('Formuliere einen sachlichen Gesprächseinstieg für diesen Lead, ausschließlich auf Grundlage der belegten Informationen.')}><MessageSquare size={17} className="shrink-0 text-blue-600"/> Gesprächseinstieg für {lead.name}</Button>}
                </div>
                <p className="mt-7 text-xs leading-relaxed text-slate-400">Nachrichten und ausgewählte Lead-Daten werden an deinen konfigurierten KI-Anbieter gesendet.</p>
              </div>}
              <div className="space-y-6">
                {items.map(item => <article key={item.id} className={item.role === 'user' ? 'ml-8' : 'mr-2'}>
                  <p className={`mb-2 flex items-center gap-1.5 text-[11px] font-semibold ${item.role === 'user' ? 'justify-end text-slate-400' : 'text-blue-600'}`}>{item.role === 'user' ? 'DU' : <><Sparkles size={12}/> QUOVADIS</>}</p>
                  <div className={`rounded-2xl px-4 py-3.5 text-sm leading-relaxed ${item.role === 'user' ? 'bg-slate-900 text-white' : 'border border-slate-200/80 bg-white text-slate-700'}`}><p className="whitespace-pre-wrap break-words">{item.content}</p></div>
                  {item.evaluation && <Card className="mt-3 border border-slate-200 bg-white p-4 shadow-none">
                    <Card.Header className="p-0"><Card.Title className="text-sm font-semibold">Promptvergleich</Card.Title><Card.Description className="line-clamp-2 break-all text-xs">{item.evaluation.source}</Card.Description></Card.Header>
                    <Card.Content className="mt-4 grid grid-cols-2 gap-3 p-0">{[{name:'Variante A',result:item.evaluation.resultA},{name:'Variante B',result:item.evaluation.resultB}].map(variant => <div key={variant.name} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{variant.name}</p><p className="mt-1 text-xl font-semibold text-slate-900">{variant.result.count}<span className="ml-1 text-xs font-normal text-slate-500">Treffer</span></p><p className="mt-1 text-xs text-slate-500">Ø Score {variant.result.averageScore}</p></div>)}</Card.Content>
                    <Card.Footer className="mt-3 p-0 text-xs leading-relaxed text-slate-400">{item.evaluation.caveat}</Card.Footer>
                  </Card>}
                  {item.proposal && <Card className="mt-3 border border-blue-100 bg-blue-50/50 p-4 shadow-none">
                    <Card.Header className="p-0"><p className="mb-2 text-[10px] font-semibold tracking-wider text-blue-600">VORSCHLAG</p><Card.Title className="text-sm font-semibold">{proposalLabel(item.proposal)}</Card.Title></Card.Header>
                    {proposalDetail(item.proposal) && <Card.Content className="mt-3 max-h-40 overflow-y-auto p-0 text-xs leading-relaxed whitespace-pre-wrap break-words text-slate-600">{proposalDetail(item.proposal)}</Card.Content>}
                    <Card.Footer className="mt-4 flex flex-wrap gap-2 p-0">
                      {item.applied_at ? <Chip color="success" size="sm" variant="soft"><Check size={12}/><Chip.Label>{item.code_draft ? 'Entwurf vorbereitet' : 'Übernommen'}</Chip.Label></Chip> : <Button size="sm" variant="primary" isDisabled={busy} onPress={() => apply(item.id)}>{item.proposal.kind === 'code_change' ? <Code2 size={14}/> : <Check size={14}/>} {item.proposal.kind === 'code_change' ? 'Entwurf vorbereiten' : 'Änderung übernehmen'}</Button>}
                      {item.code_draft && <Button size="sm" variant="outline" onPress={() => setReviewId(item.code_draft!.id)}><Code2 size={14}/> Diff prüfen</Button>}
                      {item.code_draft?.pr_url && <Link href={item.code_draft.pr_url} target="_blank" rel="noopener noreferrer" className="text-xs">PR öffnen <ExternalLink size={12}/></Link>}
                    </Card.Footer>
                  </Card>}
                </article>)}
                {busy && <div className="flex items-center gap-2 text-xs text-slate-500" role="status"><Spinner size="sm"/> Dein Begleiter arbeitet …</div>}
                <div ref={bottom}/>
              </div>
            </Modal.Body>
            <Modal.Footer className="block border-t border-slate-100 bg-white p-5">
              {status && <Alert status={hasError ? 'danger' : 'success'} className="mb-3"><Alert.Content><Alert.Description className="text-xs">{status}</Alert.Description></Alert.Content></Alert>}
              <Form className="w-full" onSubmit={event => {event.preventDefault();void send();}}>
                <TextField className="w-full" value={draft} onChange={setDraft} aria-label="Nachricht an den Begleiter" isDisabled={busy}>
                  <Label className="sr-only">Nachricht an den Begleiter</Label>
                  <TextArea placeholder="Frag deinen Begleiter …" className="min-h-24 w-full resize-none bg-slate-50" onKeyDown={event => {if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault();void send();}}}/>
                </TextField>
                <div className="mt-3 flex items-center justify-between gap-3"><p className="text-[11px] text-slate-400">Enter senden · Shift + Enter neue Zeile</p><Button type="submit" isIconOnly variant="primary" size="sm" isDisabled={busy || !draft.trim()} aria-label="Nachricht senden"><ArrowUp size={18}/></Button></div>
              </Form>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
    {reviewId && <CodeReviewPanel draftId={reviewId} onClose={() => setReviewId(null)} onPublished={url => setItems(old => old.map(item => item.code_draft?.id === reviewId ? {...item, code_draft:{...item.code_draft, status:'published', pr_url:url}} : item))}/>}
  </>;
}
