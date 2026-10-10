/** Split migration statements while preserving SQL literals, comments and function bodies. */
export function statements(source) {
  const output=[]; let start=0; let quote=null; let dollar=null; let line=false; let block=0;
  for (let i=0;i<source.length;i++) {
    const c=source[i], n=source[i+1];
    if(line){ if(c==='\n')line=false; continue; }
    if(block){ if(c==='/'&&n==='*'){block++;i++;}else if(c==='*'&&n==='/'){block--;i++;} continue; }
    if(dollar){ if(source.startsWith(dollar,i)){i+=dollar.length-1;dollar=null;} continue; }
    if(quote){ if(c===quote){if(n===quote)i++;else quote=null;} continue; }
    if(c==='-'&&n==='-'){line=true;i++;continue;}
    if(c==='/'&&n==='*'){block=1;i++;continue;}
    if(c==="'"||c==='"'){quote=c;continue;}
    if(c==='$'){const match=source.slice(i).match(/^\$[A-Za-z_0-9]*\$/);if(match){dollar=match[0];i+=dollar.length-1;continue;}}
    if(c===';'){const statement=source.slice(start,i).trim();if(statement)output.push(statement);start=i+1;}
  }
  const tail=source.slice(start).trim();if(tail)output.push(tail);
  if(quote||dollar||block)throw new Error('Unclosed SQL literal');
  return output;
}
