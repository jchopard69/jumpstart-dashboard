import test from 'node:test';
import assert from 'node:assert/strict';
import { metaPostMedia } from '../lib/social-platforms/meta/post-media';

test('Instagram video needs a cover, carousel can use an image child',()=>{
  assert.equal(metaPostMedia('instagram',{media_type:'VIDEO',media_url:'https://cdn/video.mp4'}).thumbnail_url,undefined);
  assert.equal(metaPostMedia('instagram',{media_type:'VIDEO',media_product_type:'REELS',thumbnail_url:'https://cdn/cover.jpg'}).media_type,'reel');
  assert.equal(metaPostMedia('instagram',{media_type:'CAROUSEL_ALBUM',children:{data:[{media_type:'VIDEO',media_url:'https://cdn/movie.mp4'},{media_type:'IMAGE',media_url:'https://cdn/photo.jpg'}]}}).thumbnail_url,'https://cdn/photo.jpg');
});
test('Facebook identifies video and album instead of classifying every thumbnail as an image',()=>{
  assert.deepEqual(metaPostMedia('facebook',{attachments:{data:[{media_type:'video',media:{image:{src:'https://cdn/cover.jpg'}}}]}}),{media_type:'video',media_url:'https://cdn/cover.jpg',thumbnail_url:'https://cdn/cover.jpg'});
  assert.equal(metaPostMedia('facebook',{attachments:{data:[{type:'album',subattachments:{data:[{media:{image:{src:'https://cdn/child.jpg'}}}]}}]}}).thumbnail_url,'https://cdn/child.jpg');
  assert.equal(metaPostMedia('facebook',{}).media_type,'text');
});
