/** Monthly reports: the next 3rd at 09:00 Europe/Paris, including DST. */
export function computeNextSendAt(frequency: 'weekly' | 'monthly', from = new Date()): string {
  if (frequency === 'weekly') {
    const d=new Date(from); const day=d.getUTCDay();
    d.setUTCDate(d.getUTCDate()+(day===0?1:day===1?7:8-day));d.setUTCHours(8,0,0,0);
    return d.toISOString();
  }
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'numeric'}).formatToParts(from);
  const year=Number(parts.find(p=>p.type==='year')!.value);const month=Number(parts.find(p=>p.type==='month')!.value)-1;
  function candidate(offset:number) {
    const nominal=new Date(Date.UTC(year,month+offset,3,9));
    const parisHour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',hour:'numeric',hourCycle:'h23'}).format(nominal));
    return new Date(nominal.getTime()-(parisHour-9)*3600000);
  }
  const current=candidate(0);return (current>from?current:candidate(1)).toISOString();
}
