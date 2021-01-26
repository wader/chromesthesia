'use strict';

const requestDurationGuess = 4;

function buildDOM(state) {
  if (state.capture.status === 'options') {
    return D.div({'class': 'options'}, [
      D.span({'class': 'message'}, 'Some configuration is needed'),
      D.button('Open options', {click: (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
      }})
    ]);
  } else if (state.capture.status === 'capturing') {
    return D.div(
      {'class': 'capturing'},
      [
        'Listening...',
        D.div({
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
        let links = [
          {
            title: 'YouTube',
            href: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(mm.title)
          },
          ...mm.links
        ];

        return D.div({'class': 'match'}, [
          D.div({'class': 'title'}, mm.title),
          D.div({'class': 'details'}, [
            D.span({'class': 'source'}, m.matcher.title),
            D.span({'class': 'links'}, links.map(l => {
              return D.a(l.title, {
                href: l.href,
                target: l.external ? 'externalLinkDummy' : '',
                click: l.external ? undefined : (e) => {
                  e.preventDefault();
                  chrome.tabs.create({url: e.target.href})
                }
              });
            }))
          ])
        ]);
      }));
    } else {
      matchesDOM = D.span({'class': 'no-matches'}, 'No matches :(');
    }

    let errorsDOM;
    let errors = state.capture.errors;
    if (errors.length > 0) {
      let messages = errors.map(e => (e.matcher.title + ': ' + e.error));
      errorsDOM = D.span(
        {'class': 'errors'},
        messages.map(e => D.div({'class': 'error'}, e))
      );
    }

    return D.div({'class': 'result'}, [
      matchesDOM,
      errorsDOM,
      D.button('Listen again', {click: (e) => {
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
