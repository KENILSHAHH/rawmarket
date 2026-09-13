import {ENGINE_URL} from './constants';

export async function apiRequest<T>(path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(`${ENGINE_URL}${path}`,{
    ...init,
    headers:{'content-type':'application/json',...(init?.headers||{})},
    cache:'no-store',
  });
  if(!response.ok){
    const body=await response.text();
    throw new Error(body.replace(/^"|"$/g,'')||`Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
