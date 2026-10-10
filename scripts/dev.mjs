import { createServer } from '../apps/web/node_modules/vite/dist/node/index.js';
process.chdir(new URL('../apps/web',import.meta.url).pathname);
const server=await createServer({server:{host:'0.0.0.0',port:Number(process.env.PORT??5173),strictPort:true}});await server.listen();server.printUrls();
