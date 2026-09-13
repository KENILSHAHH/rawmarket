export const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(value||0);
export const compact=(value:number)=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value||0);
export const stamp=(seconds:number)=>new Date(seconds*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
export const availability=(status:string)=>status.toLowerCase().includes('live')?'Trading':'Preview';
export const sourceStatus=(status:string)=>{
  const normalized=status.toLowerCase();
  if(normalized.includes('verified'))return 'USDA verified';
  if(normalized.includes('loading'))return 'Loading';
  if(normalized.includes('unavailable'))return 'Unavailable';
  return 'Reference data';
};
