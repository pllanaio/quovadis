/** Numbers in a stated fact must occur in its own citation, not elsewhere on the page. */
export function numbersGrounded(value:string,quote:string){
 const numbers=(text:string)=>text.match(/\d+(?:[.,]\d+)*/g)||[];
 const cited=new Set(numbers(quote));
 return numbers(value).every(number=>cited.has(number));
}

export function explicitExternalDemand(quote:string){
 if(/(?:keine?|nicht)\s+(?:an\s+)?extern/i.test(quote))return false;
 const service='(?:extern[a-zäöü]*\\s+)?(?:IT[- ]?(?:Dienstleister|Betreuung|Partner|Dienstleistungen|Support)|Systemhaus)';
 return new RegExp('(?:suchen|gesucht|beauftragen|benötigen)\\s+(?:wir\\s+)?(?:(?:einen?|nach|neuen?|geeigneten?|zuverlässigen?)\\s+){0,3}'+service,'i').test(quote)
  ||new RegExp(service+'.{0,25}(?:gesucht|beauftragt|benötigt)','i').test(quote)
  ||/(?:IT[- ]?Dienstleisterwechsel|Wechsel\s+(?:unseres|des)\s+IT[- ]?Dienstleisters|Ausschreibung.{0,70}(?:IT[- ]?Dienstleistungen|IT[- ]?Betreuung|IT[- ]?Support|Managed Services))/i.test(quote);
}

export function discoveryFailure(stats:{successfulSearches:number;discovered:number;verified:number;evaluatedPages:number;persistedCandidates:number;persistenceFailures:number;searchFailures?:number;unavailableSearches?:number;deadlineReached?:boolean}){
 if(!stats.successfulSearches)return 'Keine Suchanfrage konnte erfolgreich ausgeführt werden.';
 if(stats.unavailableSearches)return `Websuche unvollständig: ${stats.successfulSearches} Suchanfragen wurden beantwortet. Alle verfügbaren Suchzugänge waren anschließend nicht erreichbar; weitere Anfragen wurden gestoppt. Bereits gefundene Treffer wurden weiter geprüft.`;
 if(stats.searchFailures)return `Websuche unvollständig: ${stats.successfulSearches} von ${stats.successfulSearches+stats.searchFailures} Suchanfragen wurden beantwortet. Vorübergehende Fehler haben die Suchabdeckung eingeschränkt.`;
 if(stats.discovered&&!stats.verified)return 'Suchtreffer vorhanden, aber keine Originalquelle konnte gelesen werden.';
 if(stats.verified&&!stats.evaluatedPages)return 'Originalquellen wurden gelesen, aber die KI-Auswertung ist vollständig fehlgeschlagen.';
 if(stats.persistenceFailures&&!stats.persistedCandidates)return 'Verifizierte Signale konnten nicht gespeichert werden.';
 if(stats.deadlineReached)return 'Recherche unvollständig: Das Zeitbudget wurde erreicht. Bereits verifizierte Firmen wurden gespeichert.';
 return null;
}
