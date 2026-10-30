const path = require('node:path');
const { Worker } = require('node:worker_threads');
let activeMeasurements = 0;
const MAX_MEASUREMENTS = 2;

// Parse untrusted metadata off the event loop, with no access to provider credentials.
function measureAudio(filePath) {
  if (activeMeasurements >= MAX_MEASUREMENTS) return Promise.reject(Object.assign(new Error('AI_AUDIO_MEASUREMENT_BUSY'), { code: 'AI_AUDIO_MEASUREMENT_BUSY' }));
  activeMeasurements++;
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(path.join(__dirname, 'audio-duration.worker.js'), {
        workerData: { filePath }, env: {},
        resourceLimits: { maxOldGenerationSizeMb: 96, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
      });
    } catch {
      activeMeasurements--;
      reject(Object.assign(new Error('AI_AUDIO_DURATION_REQUIRED'), { code: 'AI_AUDIO_DURATION_REQUIRED' }));
      return;
    }
    let finished = false;
    const finish = (error, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const complete = () => {
        activeMeasurements--;
        if (error) reject(Object.assign(new Error(error), { code: error }));
        else resolve(value);
      };
      // Release the slot only after the worker and its buffers actually exit.
      void worker.terminate().then(complete, complete);
    };
    const timer = setTimeout(() => finish('AI_AUDIO_MEASUREMENT_TIMEOUT'), 5000);
    worker.once('message', value => finish(value.error, value));
    worker.once('error', () => finish('AI_AUDIO_DURATION_REQUIRED'));
    worker.once('exit', () => { if (!finished) finish('AI_AUDIO_DURATION_REQUIRED'); });
  });
}
module.exports = { measureAudio };
