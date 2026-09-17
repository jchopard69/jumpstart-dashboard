"use client";
import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
export function MonthlyPeriodPicker({from,to}:{from:string;to:string}) {
  const router=useRouter();const search=useSearchParams();const [pending,start]=useTransition();
  const month=from.slice(0,7);const lastDay=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();
  const fullMonth=from.endsWith('-01')&&to===`${month}-${lastDay}`;
  const change=(value:string)=>{if(!/^\d{4}-\d{2}$/.test(value))return;const [y,m]=value.split('-').map(Number);const end=new Date(y,m,0).getDate();const params=new URLSearchParams(search.toString());params.set('preset','custom');params.set('from',`${value}-01`);params.set('to',`${value}-${end}`);start(()=>router.push(`/client/dashboard?${params}`));};
  const move=(offset:number)=>{const [y,m]=month.split('-').map(Number);const d=new Date(y,m-1+offset,1);change(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);};
  return <div className="review-month-picker" aria-busy={pending}><button aria-label="Mois précédent" onClick={()=>move(-1)} disabled={pending}><ChevronLeft size={18}/></button><label><CalendarDays size={17}/><input type="month" aria-label="Mois du bilan" value={month} onChange={e=>change(e.target.value)} disabled={pending}/></label><button aria-label="Mois suivant" onClick={()=>move(1)} disabled={pending}><ChevronRight size={18}/></button><span>{pending?'Chargement du bilan…':fullMonth?'Comparé au mois civil précédent':'Période personnalisée'}</span></div>;
}
