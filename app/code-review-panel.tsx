'use client';

import {useEffect, useId, useState} from 'react';
import {Alert, Button, Chip, Link, Modal, Spinner} from '@heroui/react';
import {Check, Code2, ExternalLink, GitBranch, GitPullRequest, X} from 'lucide-react';

type Draft = {id:string;summary:string;instruction:string;owner:string;repo:string;base_branch:string;diff_preview:string;status:string;pr_url?:string|null};

export default function CodeReviewPanel({draftId, onClose, onPublished}: {draftId:string;onClose:()=>void;onPublished:(url:string)=>void}) {
  const headingId = useId();
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
    <Modal.Backdrop className="z-[calc(var(--z-index-overlay)+10)]">
      <Modal.Container size="lg" placement="center" scroll="inside" className="w-full min-w-0 p-0 sm:w-full sm:p-6 [@media(max-height:500px)]:p-0">
        <Modal.Dialog aria-labelledby={headingId} className="flex h-full min-h-0 min-w-0 max-w-5xl flex-col overflow-hidden rounded-none bg-surface p-0 text-foreground sm:h-auto sm:rounded-2xl [@media(max-height:500px)]:h-full [@media(max-height:500px)]:rounded-none">
          <Modal.Header className="shrink-0 flex-row items-center justify-between gap-3 border-b border-border px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:px-6 sm:pt-4 sm:pb-4 [@media(max-height:500px)]:py-2">
            <div className="flex min-w-0 items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><Code2 size={20}/></div><div className="min-w-0"><Modal.Heading id={headingId} className="text-base font-semibold sm:text-lg">Code-Entwurf prüfen</Modal.Heading>{draft && <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted"><span className="min-w-0 truncate" title={`${draft.owner}/${draft.repo}`}>{draft.owner}/{draft.repo}</span><span aria-hidden="true">/</span><GitBranch size={12} className="shrink-0"/><span className="max-w-24 truncate sm:max-w-48" title={draft.base_branch}>{draft.base_branch}</span></p>}</div></div>
            <Button autoFocus isIconOnly variant="ghost" className="size-11 shrink-0" aria-label="Code-Entwurf schließen" onPress={onClose}><X size={20}/></Button>
          </Modal.Header>
          <Modal.Body className="m-0 min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 sm:p-6">
            {draft ? <>
              <div className="mb-5 flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0 max-w-3xl flex-1 basis-64 [overflow-wrap:anywhere]"><h3 className="text-lg font-semibold tracking-tight text-foreground">{draft.summary}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{draft.instruction}</p></div><Chip variant="soft" color={draft.pr_url ? 'success' : 'default'} size="sm"><Chip.Label>{draft.pr_url ? 'PR erstellt' : 'Entwurf'}</Chip.Label></Chip></div>
              <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-background">
                <div className="flex min-w-0 items-center gap-2 border-b border-border px-4 py-3 text-xs text-muted"><GitBranch size={14} className="shrink-0"/><span className="min-w-0 truncate" title={draft.base_branch}>Änderungen gegenüber {draft.base_branch}</span></div>
                <pre className="m-0 max-h-[52dvh] min-w-0 max-w-full overflow-auto overscroll-contain py-3 font-mono text-xs leading-6 text-foreground outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-accent" tabIndex={0} aria-label="Vollständiger Code-Diff, horizontal und vertikal scrollbar"><code className="block w-max min-w-full">{draft.diff_preview.split('\n').map((line, index) => <span key={index} className={`block px-4 ${line.startsWith('+') && !line.startsWith('+++') ? 'bg-success-soft text-success-soft-foreground' : line.startsWith('-') && !line.startsWith('---') ? 'bg-danger-soft text-danger-soft-foreground' : line.startsWith('@@') ? 'bg-accent-soft text-accent-soft-foreground' : ''}`}>{line || ' '}</span>)}</code></pre>
              </div>
            </> : !error ? <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted" role="status"><Spinner size="sm"/> Entwurf wird geladen</div> : null}
            {error && <Alert status="danger" className="mt-4 min-w-0"><Alert.Content className="min-w-0"><Alert.Description className="[overflow-wrap:anywhere]">{error}</Alert.Description></Alert.Content></Alert>}
          </Modal.Body>
          {draft && <Modal.Footer className="m-0 min-w-0 shrink-0 flex-col items-stretch gap-3 border-t border-border bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pt-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))] [@media(max-height:500px)]:pt-2 [@media(max-height:500px)]:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <p className="min-w-0 max-w-lg text-xs leading-relaxed text-muted [overflow-wrap:anywhere] [@media(max-height:500px)]:hidden">{draft.pr_url ? 'Der Draft-PR steht auf GitHub zur weiteren Prüfung bereit.' : 'Prüfe den vollständigen Diff. Mit dem nächsten Schritt wird ein Draft-PR in deinem Repository erstellt.'}</p>
            <div className="grid w-full min-w-0 shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 sm:flex sm:w-auto sm:justify-end">{draft.pr_url ? <><Chip color="success" variant="soft" size="sm"><Check size={12}/><Chip.Label>Veröffentlicht</Chip.Label></Chip><Link href={draft.pr_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-end gap-2 rounded-lg px-3 text-sm font-medium">PR öffnen <ExternalLink size={16}/></Link></> : <><Button variant="secondary" className="min-h-11 shrink-0" onPress={onClose}>Schließen</Button><Button variant="primary" className="h-auto min-h-11 min-w-0 gap-2 whitespace-normal py-2 text-center" isPending={busy} isDisabled={busy} onPress={publish}><GitPullRequest size={16} className="shrink-0"/>{busy ? 'PR wird erstellt …' : 'Draft-PR erstellen'}</Button></>}</div>
          </Modal.Footer>}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </Modal>;
}
