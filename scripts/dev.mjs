import { createServer } from '../apps/web/node_modules/vite/dist/node/index.js';
process.chdir(new URL('../apps/web',import.meta.url).pathname);
const server=await createServer({server:{host:'0.0.0.0',port:5173}});await server.listen();server.printUrls();
