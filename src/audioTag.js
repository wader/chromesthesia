'use strict';

// Implements AudioTag API
// https://user.audiotag.info/doc/AudioTag-API_v1.0.pdf

const audioTagMatcher = (() => {
  const apiUrl = `https://audiotag.info/api`;

  function delay(t) {
    return new Promise(function(resolve) {
      setTimeout(resolve, t);
    });
  }

  function retry(maxRepeat, retryInterval, fn) {
    return fn().catch(err => {
      if (maxRepeat == 0) {
        return Promise.reject(err);
      }
      return delay(retryInterval).then(() => retry(maxRepeat-1, retryInterval, fn))
    });
  }

  function sendRequest(context) {
    const form = new FormData();
    form.append('apikey', context.options.apiKey);
    form.append('action', 'identify');
    // filename extension is used to determine type so it's needed
    form.append('file', context.mp3Blob, 'file.mp3');

    return (
      fetch(apiUrl, {method: 'POST', body: form})
      .then(r =>  {
        if (!r.ok) {
          return Promise.reject('network');
        }
        return r.json();
      })
      .then(r => {
        if (!r.success) {
          return Promise.reject(r.error); 
        }
        return Object.assign(context, {identifyResponse: r});
      })
    );
  }
  
  function pollResult(context) {
    return retry(5, 500, () => {
      const form = new FormData();
      form.append('apikey', context.options.apiKey);
      form.append('action', 'get_result');
      form.append('token', context.identifyResponse.token);
      return (
        fetch(apiUrl, {method: 'POST', body: form})
        .then(r =>  {
          if (!r.ok) {
            return Promise.reject('network');
          }
          return r.json();
        })
        .then(r => {
          if (r.result === 'wait') {
            throw('waiting');
          }
          return Object.assign(context, {getResultResponse: r});
        })
      );
    })
  } 

  function transformResponse(context) {
    const r = context.getResultResponse;

    if (r.result === 'not found') {
      return [];
    } else if (r.result === 'found') {
      return [].concat.apply([], r.data.map(d => {
        return d.tracks.map(t => {
          const title = t[0];
          const artist = t[1];
          return {
            title: artist + ' - ' + title,
            links: [],
          };
        });
      }));
    }
    return Promise.reject(r.result);
  }

  function match(options, mp3Blob) {
    return (
      // object passed along the promise chain
      Promise.resolve({
        mp3Blob: mp3Blob,
        options: options,
        identifyResponse: null, // assigned by sendRequest
        getResultResponse: null, // assigned by pollResult
      })
      .then(sendRequest)
      .then(pollResult)
      .then(transformResponse)
    );
  }

  function validOptions(options) {
    return (
      options &&
      options.apiKey !== ''
    );
  }

  return {
    name: 'audiotag',
    title: 'AudioTag',
    options: [
      {
        name: 'apiKey',
        title: 'API Key',
        required: true,
      }
    ],
    description: H.div([
      H.p('AudioTag requires and API key to be used. Both paid and limited free version requires registration.'),
      H.p('Go to ', [H.a({href: 'https://audiotag.info/'}, 'https://audiotag.info/'), ' for more information.'])
    ]),
    validOptions: validOptions,
    match: match
  };
})();
