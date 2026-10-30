const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs/promises');
const { MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS } = require('./ai-metering.service');

(async () => {
  let file, result;
  try {
    file = await fs.open(workerData.filePath, 'r');
    const stat = await file.stat();
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_AUDIO_BYTES) throw Error('AI_INPUT_TOO_LARGE');
    const data = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < data.length) {
      const { bytesRead } = await file.read(data, offset, data.length - offset, offset);
      if (!bytesRead) throw Error('AI_AUDIO_DURATION_REQUIRED');
      offset += bytesRead;
    }
    // Node 24 supports require(ESM). No MIME/extension hints supplied by the sender.
    const { parseBuffer } = require('music-metadata');
    const { format } = await parseBuffer(data, undefined, { duration: true, skipCovers: true,
      maxMemoryAllocation: MAX_AUDIO_BYTES, maxMetadataEntries: 10000 });
    const measured = [format.duration, format.containerDuration,
      format.sampleRate > 0 ? format.numberOfSamples / format.sampleRate : undefined]
      .filter(n => Number.isFinite(n) && n > 0);
    if (!measured.length) throw Error('AI_AUDIO_DURATION_REQUIRED');
    const durationSeconds = Math.max(...measured);
    if (durationSeconds > MAX_AUDIO_SECONDS) throw Error('AI_AUDIO_TOO_LONG');
    result = { inputBytes: data.length, durationSeconds };
  } catch (error) {
    const allowed = ['AI_INPUT_TOO_LARGE', 'AI_AUDIO_TOO_LONG', 'AI_AUDIO_DURATION_REQUIRED'];
    result = { error: allowed.includes(error.message) ? error.message : 'AI_AUDIO_DURATION_REQUIRED' };
  } finally {
    await file?.close();
  }
  parentPort.postMessage(result);
})();
