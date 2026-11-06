import {graph} from './browser/learning.js?v=1.4.1';
// Keep selected older memories visible even when the personal map is limited to 180.
export function experimentMap(memories,ids=[]){
  const selected=new Set(ids),rest=memories.filter(m=>!selected.has(m.id)).slice(-(180-selected.size));
  return graph([...rest,...memories.filter(m=>selected.has(m.id))]);
}
