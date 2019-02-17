'use strict';

// Implements AudD API
// https://docs.audd.io/

const audDMatcher = (() => {
  function sendRequest(context) {
    let form = new FormData();
    if (context.options.apiToken) {
        form.append('api_token', context.options.apiToken);
    }
    form.append('method', 'recognize');
    form.append('file', context.mp3Blob);
    form.append('audio_format', 'mp3');

    let url = `https://api.audd.io`;

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

    if (r.status === 'error') {
      return Promise.reject(r.error.error_message);
    } else if (r.result === null) {
      return [];
    }

    return [{
      title: r.result.artist + ' - ' + r.result.title,
      links: [],
    }];
  }

  function match(options, mp3Blob) {
    return (
      // object passed along the promise chain
      Promise.resolve({
        mp3Blob: mp3Blob,
        options: options || {}
      })
      .then(sendRequest)
      .then(transformResponse)
    );
  }

  return {
    name: 'audd',
    title: 'audD',
    options: [
      {
        name: 'apiToken',
        title: 'API token',
        required: false,
      }
    ],
    description: H.div([
      H.p('audD offers 10 free requests per day. Contact them at api@audd.io for a access token.'),
      H.p('Go to ', [H.a({href: 'https://audd.io'}, 'https://audd.io'), ' for more information.'])
    ]),
    validOptions: () => true,
    match: match
  };
})();
