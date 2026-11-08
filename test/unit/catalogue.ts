import { registerXAdsReads, registerXAdsWrites } from "../../src/tools.js";
export function collect(_platform: string, config: any) {
  const tools: any[]=[];
  const c={tool(name:string,description:string,shape:any,handler:any){tools.push({name,description,shape,handler,write:Object.hasOwn(shape,"confirm")});},resource(){}};
  registerXAdsReads(c,config);registerXAdsWrites(c,config);return tools;
}
