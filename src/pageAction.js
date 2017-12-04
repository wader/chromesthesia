'use strict';

const requestDurationGuess = 1.5;

function buildDOM(state) {
  if (state.capture.status === 'options') {
    return H.div({'class': 'options'}, [
      H.span({'class': 'message'}, 'Some configuration is needed'),
      H.button('Open options', {click: (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
      }})
    ]);
  } else if (state.capture.status === 'capturing') {
    return H.div(
      {'class': 'capturing'},
      [
        'Listening...',
        H.div({
          'class': 'progress',
          'style': (
            'animation-duration: ' + (state.options.captureDuration + requestDurationGuess) + 's;' +
            // offset animation start if state is updated
            'animation-delay: -' + (Date.now() - state.capture.start)/1000  + 's;'
          )
        })
      ]
    );
  } else if (state.capture.status === 'result') {
    let matches = state.capture.matches;
    let totalMatches = matches.reduce((c, m) => c+m.matches.length, 0);
    let matchesDOM;
    if (totalMatches > 0) {
      // a bit messy:
      // matches is an array of each matchers matches
      // m is a matchers matches (m.matcher is the actual matcher)
      // mm is a match
      matchesDOM = matches.map(m => m.matches.map(mm => {
        return H.div({'class': 'match'}, [
          H.div({'class': 'title'}, mm.title),
          H.div({'class': 'details'}, [
            H.span({'class': 'source'}, m.matcher.title),
            H.span({'class': 'links'}, mm.links.map(l => {
              return H.a(l.title, {
                href: l.href,
                target: l.external ? 'externalLinkDummy' : ''
              });
            }))
          ])
        ]);
      }));
    } else {
      matchesDOM = H.span({'class': 'no-matches'}, 'No matches :(');
    }

    let errorsDOM;
    let errors = state.capture.errors;
    if (errors.length > 0) {
      let messages = errors.map(e => (e.matcher.title + ': ' + e.error));
      errorsDOM = H.span(
        {'class': 'errors'},
        messages.map(e => H.span({'class': 'error'}, e))
      );
    }

    return H.div({'class': 'result'}, [
      matchesDOM,
      errorsDOM,
      H.button('Listen again', {click: (e) => {
        e.preventDefault();
        chrome.runtime.sendMessage({action: {startCapture: true}});
      }})
    ]);
  }
}

chrome.runtime.onMessage.addListener((request, _sender, _response) => {
  if (request.state) {
    replaceChildren(document.getElementById('state'), buildDOM(request.state));
  }
});

document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    chrome.runtime.sendMessage({action: {openPageAction: {tabId: tabs[0].id}}});
  });
});
