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
  return H.div([

    H.div(state.matchers.map(m => {
      return H.div({'class': 'section'}, [
        H.div({'class': 'name'}, m.title),
        H.div({'class': 'options'}, m.options.map(o => {
          return H.div({'class': 'option'}, [
            H.label(o.title),
            H.input({
              type: 'text',
              name: `${m.name}_${o.name}`,
              value: (state.options && state.options[m.name] && state.options[m.name][o.name]) || '',
              placeholder: o.placeholder,
              input: () => {
                chrome.storage.sync.set(matcherInputsToOptions());
              }
            })
          ]);
        })),
        H.div({'class': 'description'}, m.description)
      ]);
    })),

    H.div({'class': 'section'}, [
      H.div({'class': 'name'}, 'Options'),
      H.div({'class': 'options'},
      H.div({'class': 'option'}, [
        H.label('Listen duration'),
        H.input({
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
      ]),
      H.div({'class': 'option'}, [
        H.label('Show for all tabs'),
        H.input(Object.assign({
          type: 'checkbox',
          click: (e) => {
            chrome.storage.sync.set({showForAllTabs: e.target.checked});
          }
        }, state.options.showForAllTabs ? {checked: true} : {}))
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
