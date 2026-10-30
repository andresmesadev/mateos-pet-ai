const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { measureAudio } = require('../backend/src/services/audio-duration.service');

function wav(seconds) {
  const rate = 8000, samples = Math.round(seconds*rate), length = samples*2;
  const b = Buffer.alloc(44+length);
  b.write('RIFF',0); b.writeUInt32LE(36+length,4); b.write('WAVEfmt ',8);
  b.writeUInt32LE(16,16); b.writeUInt16LE(1,20); b.writeUInt16LE(1,22);
  b.writeUInt32LE(rate,24); b.writeUInt32LE(rate*2,28); b.writeUInt16LE(2,32);
  b.writeUInt16LE(16,34); b.write('data',36); b.writeUInt32LE(length,40);
  return b;
}
function oggPage(packet, sequence, granule, flags) {
  const b = Buffer.alloc(28+packet.length);
  b.write('OggS'); b[5]=flags; b.writeBigUInt64LE(BigInt(granule),6);
  b.writeUInt32LE(1234,14); b.writeUInt32LE(sequence,18); b[26]=1; b[27]=packet.length; packet.copy(b,28);
  let crc=0;
  for (const byte of b) {
    crc=(crc^(byte<<24))>>>0;
    for(let j=0;j<8;j++) crc=((crc<<1)^((crc&0x80000000)?0x04c11db7:0))>>>0;
  }
  b.writeUInt32LE(crc,22); return b;
}
function opus(seconds) {
  const head=Buffer.alloc(19), tags=Buffer.alloc(16);
  head.write('OpusHead'); head[8]=1; head[9]=1; head.writeUInt16LE(312,10); head.writeUInt32LE(48000,12);
  tags.write('OpusTags');
  const count=Math.round(seconds*50), pages=[oggPage(head,0,0,2),oggPage(tags,1,0,0)];
  for(let i=0;i<count;i++) pages.push(oggPage(Buffer.from([0xF8,0xFF,0xFE]),i+2,312+(i+1)*960,i===count-1?4:0));
  return Buffer.concat(pages);
}
async function audio(data, fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'huella-synthetic-audio-'));
  const file = path.join(dir,'synthetic.ogg'); // detection must use contents, not this intentionally wrong extension
  try { await fs.writeFile(file,data); await fn(file); }
  finally { await fs.rm(dir,{ recursive: true, force: true }); }
}

test('real metadata parser measures synthetic WAV from content with no external API or filename assumptions', async () => {
  for (const seconds of [0.125,60,61,600]) await audio(wav(seconds), async file => {
    const result = await measureAudio(file);
    assert.equal(result.durationSeconds,seconds);
    assert.equal(result.inputBytes,44+Math.round(seconds*8000)*2);
    assert.deepEqual(Object.keys(result).sort(),['durationSeconds','inputBytes']);
  });
});
test('synthetic WhatsApp-style Ogg Opus measures 60 and 61 seconds including its pre-skip', async () => {
  for (const seconds of [60,61]) await audio(opus(seconds), async file => {
    const measured = await measureAudio(file); assert.equal(measured.durationSeconds,seconds);
  });
});
test('malformed, empty, and overlong actual audio files fail closed', async () => {
  for (const data of [Buffer.from('not audio'),Buffer.alloc(0),wav(600.1)]) await audio(data, async file => {
    await assert.rejects(measureAudio(file), error => ['AI_AUDIO_DURATION_REQUIRED','AI_INPUT_TOO_LARGE','AI_AUDIO_TOO_LONG'].includes(error.code));
  });
});
test('oversized input and nonexistent files are rejected locally', async () => {
  await audio(Buffer.alloc(20*1024*1024+1), async file => {
    await assert.rejects(measureAudio(file),{ code: 'AI_INPUT_TOO_LARGE' });
  });
  await assert.rejects(measureAudio(path.join(os.tmpdir(),'huella-audio-missing-'+Date.now())),{ code: 'AI_AUDIO_DURATION_REQUIRED' });
});
test('a burst cannot create unbounded metadata workers, and completed slots are reusable', async () => {
  await audio(wav(1), async file => {
    const results = await Promise.allSettled(Array.from({ length: 10 },()=>measureAudio(file)));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,2);
    assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.code==='AI_AUDIO_MEASUREMENT_BUSY'));
    assert.equal((await measureAudio(file)).durationSeconds,1);
  });
});
