'use strict';

// Uncomment to mock chome.storage.sync during dev
// if (!chrome.storage) {
//   chrome.storage = {
//     sync: {
//       get: (a, f) => { console.log('storage sync get'); f({}) },
//       set: (s) => console.log('storage sync set', s)
//     }
//   };
// }

function matcherInputsToOptions() {
  return matchers.reduce((acc, m) => {
    acc[m.name] = m.options.reduce((acc, o) => {
      acc[o.name] = document.getElementsByName(`${m.name}_${o.name}`)[0].value.trim();
      return acc;
    }, {});
    return acc;
  }, {});
}

function buildDOM(state) {
  return D.div([
    D.div(state.matchers.map(m => {
      return D.div({'class': 'section'}, [
        D.div({'class': 'name'}, m.title),
        D.div({'class': 'options'}, m.options.map(o => {
          return D.div({'class': 'option'}, [
            D.label(o.title),
            D.input({
              type: 'text',
              name: `${m.name}_${o.name}`,
              value: (state.options && state.options[m.name] && state.options[m.name][o.name]) || '',
              required: o.required ? true : null,
              placeholder: o.placeholder,
              input: () => {
                chrome.storage.sync.set(matcherInputsToOptions());
              }
            })
          ]);
        })),
        D.div({'class': 'description'}, m.description)
      ]);
    })),

    D.div({'class': 'section'}, [
      D.div({'class': 'name'}, 'Options'),
      D.div({'class': 'options'},
      D.div({'class': 'option'}, [
        D.label('Listen duration'),
        D.input({
          type: 'text',
          value: state.options.captureDuration,
          placeholder: 'Duration in seconds',
          input: (e) => {
            let d = parseInt(e.target.value, 10);
            if (d <= 0) {
              d = defaultOptions.captureDuration;
            }
            chrome.storage.sync.set({captureDuration: d});
          }
        })
      ])
    )])
  ]);
}

const onStateMessage = (request, _sender, _response) => {
  if (request.state) {
    replaceChildren(document.getElementById('options'), buildDOM({matchers: matchers, options: request.state.options}));
    // prevent state updates while options page is open. messes with focus etc
    chrome.runtime.onMessage.removeListener(onStateMessage);
  }
};
chrome.runtime.onMessage.addListener(onStateMessage);

document.addEventListener('DOMContentLoaded', () => {
  // make sure to trigger state update
  chrome.runtime.sendMessage({action: {nop: true}});
});
