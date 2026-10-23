'use client';
import {useState} from 'react';
import {Button,Modal,Spinner} from '@heroui/react';
import {Trash2} from 'lucide-react';
export default function DeleteLeadButton({entries,onDeleted,bulk=false}:{entries:{id:number;name:string}[];onDeleted:()=>void;bulk?:boolean}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function remove(){
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/opportunities',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({ids:entries.map(entry=>entry.id)})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Löschen fehlgeschlagen.');
   for(const entry of entries)try{sessionStorage.removeItem('quovadis:draft:'+entry.id)}catch{}
   setOpen(false);onDeleted();
  }catch(e){setError(e instanceof Error?e.message:'Löschen fehlgeschlagen.')}finally{setBusy(false)}
 }
 return <><Button variant={bulk?'danger':'ghost'} className={'min-h-11 '+(bulk?'':'text-danger')} isDisabled={!entries.length} onPress={()=>{setError('');setOpen(true)}}><Trash2 size={16}/>{bulk?`Auswahl löschen (${entries.length})`:'Firma löschen'}</Button>
 <Modal.Backdrop isOpen={open} onOpenChange={value=>{if(!busy)setOpen(value)}} isDismissable={!busy} isKeyboardDismissDisabled={busy}><Modal.Container size="sm" placement="center" className="p-4"><Modal.Dialog className="bg-surface p-5 text-foreground"><Modal.Header><Modal.Heading className="text-lg">{entries.length===1?'Firma endgültig löschen?':`${entries.length} Firmen endgültig löschen?`}</Modal.Heading></Modal.Header><Modal.Body className="space-y-4"><p className="text-sm leading-6">Die ausgewählten Firmen werden einschließlich Notizen, Kontaktverlauf, Signalen und Ereignissen gelöscht. Das lässt sich nicht rückgängig machen.</p><ul className="max-h-40 list-disc space-y-2 overflow-auto break-words pl-5 text-sm">{entries.map(entry=><li key={entry.id}>{entry.name}</li>)}</ul><p className="text-xs leading-5 text-muted">Neue Rechercheergebnisse zu diesen Firmen können später wieder erscheinen.</p>{error&&<p role="alert" className="text-sm text-danger">{error}</p>}</Modal.Body><Modal.Footer className="flex flex-wrap gap-2"><Button variant="secondary" isDisabled={busy} onPress={()=>setOpen(false)}>Abbrechen</Button><Button variant="danger" isDisabled={busy} onPress={()=>void remove()}>{busy?<Spinner size="sm"/>:<Trash2 size={16}/>}Endgültig löschen</Button></Modal.Footer></Modal.Dialog></Modal.Container></Modal.Backdrop></>;
}
