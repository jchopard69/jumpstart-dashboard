import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderToBuffer} from '@react-pdf/renderer';
import {PdfDocument, type PdfDocumentProps} from '../lib/pdf-document';

test('monthly PDF keeps five illustrated posts on one page per network despite long captions',async()=>{
  const platforms=['facebook','youtube'].map(platform=>({platform,accountNames:['Compte client'],hasCurrentMetrics:true,hasPreviousMetrics:true,totals:{followers:60000,views:1369035,reach:0,engagements:43151,posts_count:72},prevTotals:{followers:59859,views:171047,reach:0,engagements:5936,posts_count:10},available:{views:true,reach:false,engagements:true},delta:{followers:0,views:0,reach:0,engagements:0,posts_count:0}}));
  const props:PdfDocumentProps={tenantName:'Ligue Nationale de Handball',rangeLabel:'01/09/2026 - 30/09/2026',prevRangeLabel:'01/08/2026 - 31/08/2026',generatedAt:'13/10/2026',platforms,kpis:[{label:'Vues',value:1369035,delta:700.4}],posts:platforms.flatMap(p=>Array.from({length:20},(_,i)=>({platform:p.platform,date:'27 sept. 2026',caption:'Une légende très longue '.repeat(100),thumbnailUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',visibility:{label:'Vues' as const,value:10000-i*100},engagements:250}))),metrics:[],shootDays:0,shoots:[],documents:[]};
  const pdf=await renderToBuffer(PdfDocument(props));
  // Verify real PDF pagination: one global page plus stats and top 5 for each network.
  assert.equal([...pdf.toString('latin1').matchAll(/\/Type \/Page\b/g)].length,5);
});
