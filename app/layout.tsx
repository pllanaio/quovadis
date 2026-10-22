import './globals.css';
import {ThemeProvider} from './theme-provider';
export const metadata={title:'quovadis · IT Opportunity Radar'};
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover',colorScheme:'light dark'};
const themeScript=`(()=>{let p='system';try{const v=localStorage.getItem('quovadis-theme');if(v==='light'||v==='dark')p=v}catch{}const d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);const r=document.documentElement;r.dataset.theme=d?'dark':'light';r.dataset.themePreference=p;r.classList.add(d?'dark':'light');r.style.colorScheme=d?'dark':'light';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',d?'#000000':'#ffffff')})()`;
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="de" suppressHydrationWarning><head><meta name="theme-color" content="#ffffff"/><script dangerouslySetInnerHTML={{__html:themeScript}}/></head><body><ThemeProvider>{children}</ThemeProvider></body></html>}
