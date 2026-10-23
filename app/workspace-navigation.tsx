'use client';

import {useEffect} from 'react';
import {Button,Chip,Modal} from '@heroui/react';
import {ArrowRight,Building2,Clock3,LayoutDashboard,LogOut,Network,Radar,ScanSearch,Settings2} from 'lucide-react';
import type {SearchConfig} from './dashboard-types';

export type View='dashboard'|'companies'|'stale'|'research'|'settings'|'graph';
export const navigation=[{id:'dashboard' as const,label:'Übersicht',icon:LayoutDashboard},{id:'companies' as const,label:'Alle Firmen',icon:Building2},{id:'graph' as const,label:'Verbindungen',icon:Network},{id:'stale' as const,label:'Zurückgestellt',icon:Clock3},{id:'research' as const,label:'Recherche',icon:ScanSearch},{id:'settings' as const,label:'Einstellungen',icon:Settings2}];
type Props={view:View;onNavigate:(view:View)=>void;mobileOpen:boolean;onMobileChange:(open:boolean)=>void;total:number;stale:number;config:SearchConfig|null;onLogout:()=>void};

export default function WorkspaceNavigation(props:Props){
 const {view,onNavigate,mobileOpen,onMobileChange}=props;
 useEffect(()=>{const media=matchMedia('(min-width: 1024px)');const sync=()=>{if(media.matches)onMobileChange(false)};media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync)},[onMobileChange]);
 return <>
  <aside className="qv-sidebar hidden lg:flex"><SidebarContent {...props}/></aside>
  <Modal.Backdrop isOpen={mobileOpen} onOpenChange={onMobileChange}>
   <Modal.Container size="full" placement="top" className="mr-auto w-[min(320px,calc(100%_-_24px))] flex-none p-0 sm:p-0"><Modal.Dialog aria-label="Navigation" className="h-full rounded-none bg-background p-0"><Modal.Heading className="sr-only">Navigation</Modal.Heading><Modal.CloseTrigger aria-label="Navigation schließen" className="z-10 min-h-11 min-w-11"/><SidebarContent {...props}/></Modal.Dialog></Modal.Container>
  </Modal.Backdrop>
  <nav className="qv-bottom-nav" aria-label="Schnellnavigation">{navigation.filter(item=>item.id!=='stale'&&item.id!=='graph').map(item=><Button key={item.id} variant="ghost" aria-current={view===item.id||(view==='stale'&&item.id==='companies')?'page':undefined} className="qv-bottom-link" onPress={()=>onNavigate(item.id)}><item.icon size={20}/><span>{item.id==='companies'?'Firmen':item.label}</span></Button>)}</nav>
 </>;
}

function SidebarContent({view,onNavigate,total,stale,config,onLogout}:Props){
 return <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain bg-background">
  <div className="flex min-h-20 shrink-0 items-center px-6 pr-14"><Button variant="ghost" className="h-auto min-h-11 gap-2.5 p-0 text-xl font-semibold tracking-tight" aria-label="QuoVadis Startseite" onPress={()=>onNavigate('dashboard')}><span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground"><Radar size={22}/></span>quovadis</Button></div>
  <div className="px-4 pb-6"><div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-secondary text-xs font-semibold">PL</div><div className="min-w-0"><p className="text-sm font-semibold">PLLANA</p><p className="text-xs leading-5 text-muted">IT Opportunity Workspace</p></div></div></div>
  <nav className="flex flex-1 flex-col gap-1.5 px-3" aria-label="Hauptnavigation">{navigation.map(item=><Button key={item.id} variant={view===item.id?'secondary':'ghost'} aria-current={view===item.id?'page':undefined} className={`min-h-12 w-full justify-start gap-3 px-3.5 ${view===item.id?'bg-accent-soft text-accent-soft-foreground':''}`} onPress={()=>onNavigate(item.id)}><item.icon size={18}/><span className="flex-1 text-left">{item.label}</span>{item.id==='companies'&&<span className="text-xs tabular-nums text-muted">{total}</span>}{item.id==='stale'&&stale>0&&<Chip size="sm">{stale}</Chip>}</Button>)}</nav>
  <div className="m-4 shrink-0 rounded-xl border border-border bg-surface p-4"><div className="mb-2 flex items-center gap-2 text-sm font-medium"><span className={`size-2 rounded-full ${config?.dailyEnabled?'bg-success':'bg-muted'}`}/>{config?.dailyEnabled?'Agent ist eingeplant':'Agent pausiert'}</div><p className="text-xs leading-5 text-muted">{config?.dailyEnabled?`Täglich um ${config.dailyAt} Uhr sucht dein Agent nach neuen Chancen.`:'Du kannst jederzeit eine Suche starten.'}</p><Button variant="ghost" size="sm" className="mt-1 min-h-11 px-0 text-accent-soft-foreground" onPress={()=>onNavigate('settings')}>Zeitplan bearbeiten<ArrowRight size={13}/></Button></div>
  <div className="shrink-0 border-t border-border p-3 pb-[max(12px,env(safe-area-inset-bottom))]"><Button variant="ghost" className="min-h-11 w-full justify-start gap-3 text-muted" onPress={onLogout}><LogOut size={17}/>Abmelden</Button></div>
 </div>;
}
