import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialProposal } from '../lib/editorial-advice';
import { normalizeReviewPost } from '../lib/monthly-review';
const post=normalizeReviewPost({id:'a',platform:'instagram',caption:'Un bâtiment adapté au stockage. Le projet répond au besoin de cet exploitant.'});
test('advice gives a production format and concrete steps tailored to each network',()=>{
 const instagram=editorialProposal(post);const linkedin=editorialProposal({...post,platform:'linkedin'});
 assert.match(instagram.format,/Reel/);assert.match(instagram.steps.join(' '),/sous-titres/);
 assert.match(linkedin.format,/5 pages/);assert.match(linkedin.steps.join(' '),/Page 5/);
 assert.match(instagram.angle,/besoin du client/);assert.match(instagram.reference,/bâtiment/);
});
test('people and event posts get relevant briefs without invented quotes or statistics',()=>{
 const people=editorialProposal({...post,caption:'Formation et parcours de nos collaborateurs.'});
 const event=editorialProposal({...post,caption:'Rendez-vous à la foire.'});
 assert.match(people.steps.join(' '),/vraie réponse/);assert.match(event.angle,/réellement posée/);
});
