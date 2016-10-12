'use strict';

// [
//   [Float32Array[1, -1, 0.5 ...], ...], // channel 0 buffers
//   [Float32Array[1, -1, 0.5 ...], ...], // channel 1 buffers
//   ...
// ] ->
// [
//   Int16Array[32767, -32767, 16383, ...], // channel 0 int16 buffer
//   Int16Array[32767, -32767, 16383, ...], // channel 1 int16 buffer
//   ...
// ]
function flattenChannelBuffersToSign16(floatArrays) {
  let samples = floatArrays[0].reduce((v, b) => v+b.length, 0);
  let int16Arrays = [];

  for (let i = 0; i < floatArrays.length; i++) {
    int16Arrays[i] = new Int16Array(samples);
  }

  for (let i = 0; i < floatArrays.length; i++) {
    let offset = 0;
    let fa = floatArrays[i];
    for (let j = 0; j < fa.length; j++) {
      let a = fa[j];
      for (let k = 0; k < a.length; k++) {
        int16Arrays[i][offset] = floatArrays[i][j][k] * 0x7fff;
        offset++;
      }
    }
  }

  return int16Arrays;
}

const captureAudio = (() => {
  let audio;

  return (captureDuration) => {
    return new Promise((resolve, _reject) => {
      // tabCapture assumes active tab
      chrome.tabCapture.capture({audio: true}, stream => {
        // TODO: hack to continue playing
        // TODO: i suspect there is a chrome crash bug related to the hack if
        // many audio tags are created so create only one
        if (!audio) {
          audio = document.createElement('audio');
        }
        audio.src = window.URL.createObjectURL(stream);
        audio.play();

        let context = new AudioContext();
        let sampleRate = context.sampleRate;
        let audioInput = context.createMediaStreamSource(stream);

        const bufferSize = 512;
        const channels = 2;
        let recorder = context.createScriptProcessor(bufferSize, channels, channels);

        let channelBuffers = [];
        for (let i = 0; i < channels; i++) {
          channelBuffers[i] = [];
        }

        recorder.onaudioprocess = e => {
          for (let i = 0; i < e.inputBuffer.numberOfChannels; i++) {
            // make copy as buffers seems to be reused
            channelBuffers[i].push(new Float32Array(e.inputBuffer.getChannelData(i)));
          }
        };

        // connect recorder
        audioInput.connect(recorder);
        recorder.connect(context.destination);

        setTimeout(() => {
          stream.getTracks().forEach(t => t.stop());
          context.close();
          resolve({
            sampleRate: sampleRate,
            channels: flattenChannelBuffersToSign16(channelBuffers)
          });
        }, captureDuration);
      });
    });
  };
})();
