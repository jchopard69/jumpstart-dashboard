import test from 'node:test';
import assert from 'node:assert/strict';
import { postPreviewCandidates } from '../lib/post-preview';
test('preview uses stored image media when a thumbnail is missing',()=>{
 assert.deepEqual(postPreviewCandidates({media_type:'IMAGE',media_url:'https://cdn.example/photo?signed=abc'}),['https://cdn.example/photo?signed=abc']);
 assert.deepEqual(postPreviewCandidates({media_type:'VIDEO',media_url:'https://cdn.example/video.mp4'}),[]);
 assert.deepEqual(postPreviewCandidates({media_type:'VIDEO',thumbnail_url:'https://cdn.example/cover.jpg',media_url:'https://network.example/watch/1'}),['https://cdn.example/cover.jpg']);
});
test('preview rejects unsafe URLs, deduplicates and preserves signed URL parameters',()=>{
 const url='https://cdn.example/photo.jpg?signature='+'a'.repeat(600);
 assert.deepEqual(postPreviewCandidates({thumbnail_url:url,media_url:url,media_type:'IMAGE'}),[url]);
 assert.deepEqual(postPreviewCandidates({thumbnail_url:'javascript:alert(1)',media_type:'IMAGE',media_url:'https://user:password@example.com/image'}),[]);
});
