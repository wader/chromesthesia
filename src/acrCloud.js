'use strict';

// Implements ACRCloud identification protocol version 1
// https://www.acrcloud.com/docs/audio-fingerprinting-api/audio-identification-api/protocol-1/

const acrCloudMatcher = (() => {
  function arrayBufferToString(b) {
    let b8 = new Uint8Array(b);

    let s = '';
    for (let i = 0; i < b8.length; i++) {
      s += String.fromCharCode(b8[i]);
    }

    return s;
  }

  function generateSignature(context) {
    const signatureVersion = '1';
    const httpMethod = 'POST';
    const httpUri = '/v1/identify';
    const dataType = 'audio';

    // string_to_sign = http_method+'\n'+http_uri+'\n'+access_key+'\n'+data_type+'\n'+signature_version+'\n'+str(timestamp)
    // sign = base64.b64encode(hmac.new(access_secret, string_to_sign, digestmod=hashlib.sha1).digest())
    let signString = (
      httpMethod + '\n' +
      httpUri + '\n' +
      context.options.accessKey + '\n' +
      dataType + '\n' +
      signatureVersion + '\n' +
      context.timestamp
    );

    return crypto.subtle.importKey(
      'raw', // raw means key is a ArrayBuffer
      new TextEncoder('utf-8').encode(context.options.accessSecret).buffer, // key
      {name: 'HMAC', hash: 'SHA-1'}, // algo
      false, // extractable
      ['sign'] // usages
    ).then(accessSecretKey => {
      return crypto.subtle.sign(
        {name: 'HMAC'},
        accessSecretKey,
        new TextEncoder('utf-8').encode(signString).buffer
      ).then(hmacBuffer => {
        return Object.assign(context, {
          signature: {
            version: signatureVersion,
            hmacBuffer: hmacBuffer
          }
        });
      });
    });
  }

  function sendRequest(context) {
    let hmacBase64 = btoa(arrayBufferToString(context.signature.hmacBuffer));

    let blob = new Blob([context.wavBuffer]);
    let form = new FormData();
    form.append('access_key', context.options.accessKey);
    form.append('data_type', 'audio');
    form.append('sample_bytes', blob.size);
    form.append('sample', blob);
    form.append('signature_version', context.signature.version);
    form.append('signature', hmacBase64);
    form.append('timestamp', context.timestamp);

    let url = `http://${context.options.host}/v1/identify`;

    return (
      fetch(url, {method: 'POST', body: form})
      .then(response =>  {
        if (!response.ok) {
          return Promise.reject('network');
        }
        return (
          response.json()
          .then(jsonResponse => {
            return Object.assign(context, {jsonResponse: jsonResponse});
          })
        );
      })
    );
  }

  function transformResponse(context) {
    let r = context.jsonResponse;
    const statusNoResult = 1001;

    if (r.status.code === statusNoResult) {
      return [];
    } else if (r.status.code !== 0) {
      return Promise.reject(r.status.msg);
    }

    return r.metadata.music.map(m => {
      let links = [];
      if (m.external_metadata) {
        let em = m.external_metadata;
        if (em.spotify) {
          links.push({
            external: true,
            title: 'Spotify',
            href: 'spotify:track:' + encodeURIComponent(em.spotify.track.id)
          });
        }
      }

      return {
        title: m.artists.map(a => a.name).join(', ') + ' - ' + m.title,
        links: links
      };
    });
  }

  function match(options, capture) {
    return (
      // object passed along the promise chain
      Promise.resolve({
        wavBuffer: createWav(capture.channels, capture.sampleRate),
        timestamp: Date.now(),
        options: options,
        signature: null, // assigned by generateSignature
        jsonResponse: null // assigned by sendRequest
      })
      .then(generateSignature)
      .then(sendRequest)
      .then(transformResponse)
    );
  }

  function validOptions(options) {
    return (
      options &&
      options.host !== '' &&
      options.accessKey !== '' &&
      options.accessSecret !== ''
    );
  }

  return {
    name: 'acrcloud',
    title: 'ACRCloud',
    options: [
      {
        name: 'host',
        title: 'Host',
        placeholder: 'e.g: eu-west-1.api.acrcloud.com'
      },
      {
        name: 'accessKey',
        title: 'Access key',
        placeholder: '32 characters'
      },
      {
        name: 'accessSecret',
        title: 'Access secret',
        placeholder: '40 characters'
      }
    ],
    description: H.div([
      H.p('To use ACRCloud you need an account. There is a free plan that allow around hundred recognitions per day. You can pay to do more.'),
      H.ul([
        H.li('Sign up at ', H.a({href: 'https://www.acrcloud.com'}, 'https://www.acrcloud.com')),
        H.li('Sign in and go to console'),
        H.li('Creata a new "Audio & Video Recognition" project'),
        H.li('Choose any name you want, select "Line-in audio", check the "ACRCloud Music" bucket and check "Enable 3rd Party ID Integration"'),
        H.li('Now select the created project and look at the details / description tab for host, access key and access secret to configure')
      ])
    ]),
    validOptions: validOptions,
    match: match
  };
})();
