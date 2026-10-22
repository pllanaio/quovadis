'use client';

import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {Button} from '@heroui/react';
import {Monitor,Moon,Sun} from 'lucide-react';

type Preference='light'|'dark'|'system';
type ThemeContextValue={preference:Preference;dark:boolean;setPreference:(value:Preference)=>void};
const ThemeContext=createContext<ThemeContextValue>({preference:'system',dark:false,setPreference:()=>{}});
const storageKey='quovadis-theme';

function applyTheme(preference:Preference){
 const dark=preference==='dark'||(preference==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
 const root=document.documentElement;
 root.dataset.theme=dark?'dark':'light';root.dataset.themePreference=preference;
 root.classList.toggle('dark',dark);root.classList.toggle('light',!dark);
 root.style.colorScheme=dark?'dark':'light';
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#000000':'#ffffff');
 return dark;
}

export function ThemeProvider({children}:{children:ReactNode}){
 const [preference,setPreferenceState]=useState<Preference>('system'),[dark,setDark]=useState(false);
 useEffect(()=>{
  const initial=document.documentElement.dataset.themePreference;
  const value:Preference=initial==='dark'||initial==='light'?initial:'system';
  setPreferenceState(value);setDark(applyTheme(value));
  const sync=(event:StorageEvent)=>{if(event.key!==storageKey&&event.key!==null)return;const next=event.newValue==='dark'||event.newValue==='light'?event.newValue:'system';setPreferenceState(next);setDark(applyTheme(next))};
  window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);
 },[]);
 useEffect(()=>{
  const media=matchMedia('(prefers-color-scheme: dark)');
  const sync=()=>{if(preference==='system')setDark(applyTheme('system'))};
  media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync);
 },[preference]);
 function setPreference(value:Preference){setPreferenceState(value);setDark(applyTheme(value));try{localStorage.setItem(storageKey,value)}catch{/* Keep the choice for this session if storage is unavailable. */}}
 return <ThemeContext.Provider value={{preference,dark,setPreference}}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle(){
 const {dark,setPreference}=useContext(ThemeContext);
 const label=dark?'Helles Design aktivieren':'Schwarzen Darkmode aktivieren';
 return <Button isIconOnly variant="ghost" className="size-11 shrink-0" aria-label={label} onPress={()=>setPreference(dark?'light':'dark')}><Sun size={19} className="hidden dark:block"/><Moon size={19} className="dark:hidden"/></Button>;
}

export function ThemePreference(){
 const {preference,setPreference}=useContext(ThemeContext);
 return <div role="group" aria-label="Farbschema" className="grid grid-cols-3 gap-2">{([{value:'light',label:'Hell',icon:Sun},{value:'dark',label:'Schwarz',icon:Moon},{value:'system',label:'System',icon:Monitor}] as const).map(item=><Button key={item.value} variant={preference===item.value?'secondary':'outline'} className="min-h-11 min-w-0 gap-2 px-2" aria-pressed={preference===item.value} onPress={()=>setPreference(item.value)}><item.icon size={17}/>{item.label}</Button>)}</div>;
}
