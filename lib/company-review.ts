import {isIP} from 'node:net';
import {db,init} from './db';
import {getSettings} from './settings';
import {importCompanyUrl} from './research';

export function companyReviewUrl(value:string):string{
 const url=new URL(value);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port&&!['80','443'].includes(url.port)||isIP(url.hostname)||!url.hostname.includes('.')||/\.(?:local|internal|localhost)$/i.test(url.hostname)||url.hostname.length>253)throw Error('Bitte eine öffentlich erreichbare Firmenwebsite angeben.');
 url.hash='';if(url.href.length>2000)throw Error('Die Firmen-URL ist zu lang.');return url.href;
}

/** Only an explicit request or a bare URL starts work without another confirmation. */
export function requestedCompanyUrl(message:string,proposed?:string):string|null{
 const matches=[...message.matchAll(/https?:\/\/[^\s<>"']+/gi)].map(match=>match[0].replace(/[),.;!?]+$/,''));
 if(matches.length!==1)return null;
 if(proposed)return matches[0]===proposed?companyReviewUrl(proposed):null;
 const bare=message.trim().replace(/[<>]/g,'').replace(/[),.;!?]+$/,'')===matches[0];
 if(!bare&&!/(?:prüf|pruef|recherchier|analysier|bewert|einord|ordne|untersuch|firma.{0,30}(?:hinzufüg|hinzufueg|aufnehm)|schau.{0,30}(?:firma|unternehmen)|check)/i.test(message))return null;
 return companyReviewUrl(matches[0]);
}

export async function enqueueCompanyReview(url:string,message:string){
 await init();url=companyReviewUrl(url);const settings=await getSettings();
 if(settings.provider==='anthropic'?!settings.anthropicKey:!settings.openaiKey)throw Error('Bitte zuerst den API-Key für den gewählten KI-Anbieter speichern.');
 const connection=await db().connect();
 try{
  await connection.query('BEGIN');await connection.query('SELECT pg_advisory_xact_lock($1,hashtext($2))',[4747304,url]);
  let job=(await connection.query("SELECT * FROM company_reviews WHERE url=$1 AND status IN ('queued','running') ORDER BY id DESC LIMIT 1",[url])).rows[0];
  if(!job)job=(await connection.query('INSERT INTO company_reviews(url) VALUES($1) RETURNING *',[url])).rows[0];
  await connection.query('INSERT INTO assistant_messages(role,content) VALUES(\'user\',$1)',[message]);
  const reply='Die Firmenprüfung ist eingeplant: '+url+'\nIch lese die Website und recherchiere Kontakte, Firmendaten und mögliche IT-Anlässe. Anschließend erscheint die Firma mit Dossier und Bewertung unter „Alle Firmen“. Ohne belegten Bedarf kennzeichne ich das ausdrücklich. Du kannst den Chat währenddessen schließen.';
  const saved=await connection.query("INSERT INTO assistant_messages(role,content,company_review_id) VALUES('assistant',$1,$2) RETURNING id,role,content,created_at",[reply,job.id]);
  await connection.query('COMMIT');return {...saved.rows[0],company_review:{id:job.id,url,status:job.status}};
 }catch(error){await connection.query('ROLLBACK');throw error}finally{connection.release()}
}

export async function processCompanyReviews(){
 await init();const connection=await db().connect();let locked=false;
 try{
  locked=(await connection.query('SELECT pg_try_advisory_lock($1) AS ok',[4747304])).rows[0]?.ok===true;
  if(!locked)return {processed:0,ready:0,busy:true};
  await connection.query("UPDATE company_reviews SET status='queued',next_attempt_at=NULL WHERE status='running'");
  const job=(await connection.query("UPDATE company_reviews SET status='running',attempts=attempts+1,updated_at=now() WHERE id=(SELECT id FROM company_reviews WHERE status='queued' AND (next_attempt_at IS NULL OR next_attempt_at<=now()) ORDER BY id LIMIT 1) RETURNING *")).rows[0];
  if(job){
   try{const id=await importCompanyUrl(companyReviewUrl(job.url));await connection.query("UPDATE company_reviews SET status='complete',opportunity_id=$2,error=NULL,updated_at=now() WHERE id=$1",[job.id,id])}
   catch{await connection.query("UPDATE company_reviews SET status=CASE WHEN attempts<3 THEN 'queued' ELSE 'failed' END,next_attempt_at=now()+interval '2 minutes',error='Firmenwebsite konnte nicht zuverlässig geprüft werden. Website und KI-Zugang prüfen; bei erneutem Fehler die URL noch einmal senden.',updated_at=now() WHERE id=$1",[job.id])}
  }
  const ready=(await connection.query("SELECT count(*)::int AS count FROM company_reviews WHERE status='queued' AND (next_attempt_at IS NULL OR next_attempt_at<=now())")).rows[0].count;
  return {processed:job?1:0,ready,busy:false};
 }finally{if(locked)await connection.query('SELECT pg_advisory_unlock($1)',[4747304]);connection.release()}
}
