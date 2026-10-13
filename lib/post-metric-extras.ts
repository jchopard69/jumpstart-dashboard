import { observedNumber } from './measurement';

/** Preserve optional LinkedIn clicks without turning an absent field into zero. */
export function retainedPostExtras(platform:string,incoming:Record<string,unknown>,existing:Record<string,unknown>) {
  if(platform!=='linkedin')return {};
  const clicks=observedNumber(incoming.clicks);
  const previous=observedNumber(existing.clicks);
  const incomingHasData=Object.values(incoming).some(value=>(observedNumber(value)??0)>0);
  const value=clicks==null||clicks===0&&!incomingHasData&&previous!=null&&previous>0?previous:clicks;
  return value==null?{}:{clicks:value};
}
