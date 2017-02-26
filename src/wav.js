'use strict';

function dataViewWriteUTF8(view, offset, str) {
  var l = str.length;
  for (var i = 0; i < l; i++) {
    view.setUint8(offset+i, str.charCodeAt(i));
  }
}

// channels:
// [
//   Int16Array[32767, -32767, 16383, ...], // channel 0 int16 buffer
//   Int16Array[32767, -32767, 16383, ...], // channel 1 int16 buffer
//   ...
// ]
function createWav(channels, sampleRate) {
  var sampleBits = 16;
  var samples = channels[0].length;

  const wavHeaderByteSize = 44;
  var sampleByteSize = samples * channels.length * sampleBits/8;
  var wavByteSize = wavHeaderByteSize + sampleByteSize;
  var wavBuffer = new ArrayBuffer(wavByteSize);
  var headerView = new DataView(wavBuffer, 0, wavHeaderByteSize);
  var sampleView = new DataView(wavBuffer, wavHeaderByteSize, wavByteSize - wavHeaderByteSize);

  // http://soundfile.sapp.org/doc/WaveFormat/
  dataViewWriteUTF8(headerView, 0, 'RIFF');
  headerView.setUint32(4, wavByteSize-8, true); // byte size of reset of wav
  dataViewWriteUTF8(headerView, 8, 'WAVE');

  dataViewWriteUTF8(headerView, 12, 'fmt ');
  headerView.setUint32(16, 16, true); // byte size of reset of fmt below
  headerView.setUint16(20, 1, true); // format, 1 = PCM
  headerView.setUint16(22, channels.length, true); // channels
  headerView.setUint32(24, sampleRate, true); // sample rate
  headerView.setUint32(28, sampleByteSize, true); // byte rate
  headerView.setUint16(32, channels.length * sampleBits/8, true); // sample align
  headerView.setUint16(34, sampleBits, true); // sampleBits per sample

  dataViewWriteUTF8(headerView, 36, 'data');
  headerView.setUint32(40, sampleByteSize, true); // byte size of sample data

  // interleave channel samples
  var sampleOffset = 0;
  for (var i = 0; i < samples; i++) {
    for (var j = 0; j < channels.length; j++) {
      sampleView.setInt16(sampleOffset, channels[j][i], true);
      sampleOffset += sampleBits/8;
    }
  }

  return wavBuffer;
}

// usefull for wav debug
function saveData(data, fileName) {
  var a = document.createElement('a');
  a.style = 'display: none';
  document.body.appendChild(a);
  var blob = new Blob([data], {type: 'octet/stream'});
  var url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
}
