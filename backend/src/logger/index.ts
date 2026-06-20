type Level='info'|'warn'|'error'

const log=(level:Level,message:string,meta?:unknown)=>{
  
const ts = new Date().toISOString()
  const metaStr = meta ? ` | ${JSON.stringify(meta)}` : ''
  console[level](`[${ts}] [${level.toUpperCase()}] ${message}${metaStr}`)
}


export const logger = {
  info:  (msg: string, meta?: unknown) => log('info', msg, meta),
  warn:  (msg: string, meta?: unknown) => log('warn', msg, meta),
  error: (msg: string, meta?: unknown) => log('error', msg, meta),
}