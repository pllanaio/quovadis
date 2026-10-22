import {db,init} from './db';
import {getSettings} from './settings';

export async function enqueueResearch(trigger='manual',scheduleDate?:string){
 await init();
 const settings=await getSettings();
 if(settings.provider==='anthropic'?!settings.anthropicKey:!settings.openaiKey)throw Error('Bitte zuerst den API-Key für den gewählten KI-Anbieter in den Einstellungen speichern.');
 if(trigger==='scheduled'&&(!scheduleDate||!/^\d{4}-\d{2}-\d{2}$/.test(scheduleDate)))throw Error('Ungültiges Zeitplandatum');
 const connection=await db().connect();
 try{
  await connection.query('BEGIN');
  await connection.query('SELECT pg_advisory_xact_lock($1)',[4747303]);
  const existing=trigger==='scheduled'
   ?await connection.query('SELECT * FROM research_runs WHERE scheduled_date=$1',[scheduleDate])
   :await connection.query("SELECT * FROM research_runs WHERE status IN ('queued','running') ORDER BY id DESC LIMIT 1");
  if(existing.rowCount){await connection.query('COMMIT');return {run:existing.rows[0],queued:false}}
  const inserted=await connection.query("INSERT INTO research_runs(status,stage,scheduled_date) VALUES('queued','Wartet auf den Recherche-Worker',$1) RETURNING *",[trigger==='scheduled'?scheduleDate:null]);
  await connection.query('COMMIT');
  return {run:inserted.rows[0],queued:true};
 }catch(error){await connection.query('ROLLBACK');throw error}finally{connection.release()}
}
