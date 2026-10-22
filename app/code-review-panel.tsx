'use client';

import {useEffect, useState} from 'react';
import {Alert, Button, Chip, Link, Modal, Spinner} from '@heroui/react';
import {Check, Code2, ExternalLink, GitBranch, GitPullRequest, X} from 'lucide-react';

type Draft = {id:string;summary:string;instruction:string;owner:string;repo:string;base_branch:string;diff_preview:string;status:string;pr_url?:string|null};

export default function CodeReviewPanel({draftId, onClose, onPublished}: {draftId:string;onClose:()=>void;onPublished:(url:string)=>void}) {
  const [draft, setDraft] = useState<Draft|null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setDraft(null);setError('');
    fetch(`/api/code/drafts?id=${encodeURIComponent(draftId)}`, {signal:controller.signal}).then(async response => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Der Entwurf konnte nicht geladen werden.');
      setDraft(data);
    }).catch(cause => {if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Der Entwurf konnte nicht geladen werden.');});
    return () => controller.abort();
  }, [draftId]);

  async function publish() {
    setBusy(true);setError('');
    try {
      const response = await fetch('/api/code/pr', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({draftId})});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Der Pull Request konnte nicht erstellt werden.');
      setDraft(old => old ? {...old, status:'published', pr_url:data.url} : old);
      onPublished(data.url);
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'Der Pull Request konnte nicht erstellt werden.');} finally {setBusy(false);}
  }

  return <Modal isOpen onOpenChange={open => {if (!open) onClose();}}>
    <Modal.Backdrop className="z-[100]">
      <Modal.Container size="lg" placement="center" scroll="inside" className="w-full sm:w-full">
        <Modal.Dialog aria-label="Code-Entwurf prüfen" className="max-w-5xl p-0">
          <Modal.Header className="flex-row items-center justify-between border-b border-slate-100 px-6 py-5">
            <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Code2 size={20}/></div><div><Modal.Heading className="font-semibold">Code-Entwurf prüfen</Modal.Heading>{draft && <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">{draft.owner}/{draft.repo}<span className="text-slate-300">/</span><GitBranch size={12}/>{draft.base_branch}</p>}</div></div>
            <Button isIconOnly variant="ghost" size="sm" aria-label="Code-Entwurf schließen" onPress={onClose}><X size={18}/></Button>
          </Modal.Header>
          <Modal.Body className="m-0 overflow-y-auto p-6">
            {draft ? <>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div className="max-w-3xl"><h3 className="text-lg font-semibold tracking-tight text-slate-900">{draft.summary}</h3><p className="mt-2 text-sm leading-relaxed text-slate-500">{draft.instruction}</p></div><Chip variant="soft" color={draft.pr_url ? 'success' : 'default'} size="sm"><Chip.Label>{draft.pr_url ? 'PR erstellt' : 'Entwurf'}</Chip.Label></Chip></div>
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3 text-xs text-slate-400"><GitBranch size={14}/><span>Änderungen gegenüber {draft.base_branch}</span></div>
                <pre className="max-h-[52dvh] overflow-auto py-4 font-mono text-xs leading-6 text-slate-300" tabIndex={0} aria-label="Vollständiger Code-Diff">{draft.diff_preview.split('\n').map((line, index) => <span key={index} className={`block min-w-max px-4 ${line.startsWith('+') && !line.startsWith('+++') ? 'bg-emerald-950/50 text-emerald-300' : line.startsWith('-') && !line.startsWith('---') ? 'bg-rose-950/50 text-rose-300' : line.startsWith('@@') ? 'bg-blue-950/50 text-blue-300' : ''}`}>{line || ' '}</span>)}</pre>
              </div>
            </> : !error ? <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500"><Spinner size="sm"/> Entwurf wird geladen</div> : null}
            {error && <Alert status="danger" className="mt-4"><Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}
          </Modal.Body>
          {draft && <Modal.Footer className="flex-col items-stretch gap-4 border-t border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-lg text-xs leading-relaxed text-slate-500">{draft.pr_url ? 'Der Draft-PR steht auf GitHub zur weiteren Prüfung bereit.' : 'Prüfe den vollständigen Diff. Mit dem nächsten Schritt wird ein Draft-PR in deinem Repository erstellt.'}</p>
            <div className="flex shrink-0 items-center gap-3">{draft.pr_url ? <><Chip color="success" variant="soft" size="sm"><Check size={12}/><Chip.Label>Veröffentlicht</Chip.Label></Chip><Link href={draft.pr_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium">PR öffnen <ExternalLink size={14}/></Link></> : <><Button variant="secondary" size="sm" onPress={onClose}>Schließen</Button><Button variant="primary" size="sm" isPending={busy} isDisabled={busy} onPress={publish}><GitPullRequest size={16}/>{busy ? 'PR wird erstellt …' : 'Draft-PR erstellen'}</Button></>}</div>
          </Modal.Footer>}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </Modal>;
}
