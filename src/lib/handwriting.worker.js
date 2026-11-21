import { InferenceEngine, loadVocab } from 'ink-on/core';
import { env } from 'onnxruntime-web';

env.wasm.numThreads = 1;
let engine;

self.onmessage = async ({ data: { input, baseUrl } }) => {
  try {
    const asset = name => new URL(`models/comer/${name}`, baseUrl).href;
    engine ??= new InferenceEngine({
      encoderUrl: asset('encoder_int8.onnx'),
      decoderUrl: asset('decoder_int8.onnx'),
      executionProvider: 'wasm',
      beamWidth: 4,
    });
    const vocab = await loadVocab(asset('vocab.json'));
    const result = await engine.recognize(input, vocab);
    self.postMessage({ latex: result.latex });
  } catch (error) {
    console.error('Handwriting recognition failed:', error);
    self.postMessage({ error: true });
  }
};
