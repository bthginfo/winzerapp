import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';
export function mailConfigured(){return Boolean(env.SMTP_HOST&&env.SMTP_USER&&env.SMTP_PASSWORD&&env.SMTP_FROM);}
export async function sendMail(to:string,subject:string,text:string){
 if(!mailConfigured())throw new Error('MAIL_NOT_CONFIGURED');
 const port=Number(env.SMTP_PORT||465);if(![465,587].includes(port))throw new Error('INVALID_SMTP_PORT');
 const transport=nodemailer.createTransport({host:env.SMTP_HOST,port,secure:port===465,requireTLS:true,auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD},connectionTimeout:10000,socketTimeout:15000,tls:{minVersion:'TLSv1.2'}});
 try{await transport.sendMail({from:env.SMTP_FROM,to,subject,text});}finally{transport.close();}
}
