import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleState,validTime,validTimezone} from '../lib/schedule.mjs';

const settings={dailyAt:'07:00',timezone:'Europe/Berlin',dailyEnabled:true};
const at=(iso,last=null,config=settings)=>scheduleState(config,last,new Date(iso));

test('validates daily clock values and IANA time zones',()=>{
 assert.equal(validTime('07:00'),true);assert.equal(validTime('24:00'),false);assert.equal(validTime('7:00'),false);
 assert.equal(validTimezone('Europe/Berlin'),true);assert.equal(validTimezone('Mars/Crater'),false);
});
test('runs at Berlin local time in summer and winter',()=>{
 assert.equal(at('2026-07-10T04:59:00Z').scheduledDue,false);
 assert.equal(at('2026-07-10T05:00:00Z').scheduledDue,true);
 assert.equal(at('2026-12-10T05:59:00Z').scheduledDue,false);
 assert.equal(at('2026-12-10T06:00:00Z').scheduledDue,true);
});
test('restart catches up once and persists a calendar-date guard',()=>{
 assert.equal(at('2026-10-22T19:00:00Z').scheduledDue,true);
 assert.equal(at('2026-10-22T19:00:00Z','2026-10-22').scheduledDue,false);
 assert.equal(at('2026-10-23T05:00:00Z','2026-10-22').scheduledDue,true);
});
test('spring DST gap runs once at first valid time after target',()=>{
 const config={...settings,dailyAt:'02:30'};
 assert.equal(at('2026-03-29T00:59:00Z',null,config).scheduledDue,false);
 assert.equal(at('2026-03-29T01:00:00Z',null,config).scheduledDue,true);
 assert.equal(at('2026-03-29T01:01:00Z','2026-03-29',config).scheduledDue,false);
});
test('autumn DST repeated hour never repeats a persisted run',()=>{
 const config={...settings,dailyAt:'02:30'};
 assert.equal(at('2026-10-25T00:30:00Z',null,config).scheduledDue,true);
 assert.equal(at('2026-10-25T01:30:00Z','2026-10-25',config).scheduledDue,false);
});
test('midnight uses selected local date and disabled schedules stay paused',()=>{
 const midnight={...settings,dailyAt:'00:00'};
 assert.equal(at('2026-07-10T22:00:00Z','2026-07-10',midnight).scheduleDate,'2026-07-11');
 assert.equal(at('2026-07-10T22:00:00Z','2026-07-10',midnight).scheduledDue,true);
 assert.equal(at('2026-07-10T22:00:00Z',null,{...settings,dailyEnabled:false}).scheduledDue,false);
});
