export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') return { url: 'data:text/javascript,export const NextResponse={json:(body,init)=>Response.json(body,init)};', shortCircuit:true };
  if (specifier.includes('supabase/server')) return { url: 'data:text/javascript,export const createSupabaseServerClient=()=>globalThis.__contentSession;export const createSupabaseServiceClient=()=>globalThis.__contentService;', shortCircuit:true };
  if (specifier.includes('core/token-manager')) return {url:'data:text/javascript,export const getValidAccessToken=async()=>{throw Error("Unexpected credential access")}',shortCircuit:true};
  return nextResolve(specifier,context);
}
