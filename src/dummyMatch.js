'use strict';

function dummyMatcher(name, validOptions, matchFn) {
  return {
    name: name,
    title: name,
    options: [
      {
        name: 'test1',
        title: 'Test1',
        placeholder: 'test1...'
      },
      {
        name: 'test2',
        title: 'Test2',
        placeholder: 'test2...'
      }
    ],
    validOptions: () => validOptions,
    match: () => matchFn()
  };
}

const dummySuccessMatcher = dummyMatcher('dummySuccess', true, () => Promise.resolve([
  {
    title: 'Roman Flügel - Wilkie',
    links: [
      {
        title: 'Spotify',
        href: 'spotify:track:5LaFLRPrb7yhc3x46Ktn6B'
      }
    ]
  }
]));

const dummySuccessEmptyMatcher = dummyMatcher('dummySuccessEmpty', true, () => Promise.resolve({matches: []}));
const dummyOptionsErrorMatcher = dummyMatcher('optionsErrorMatcher', false, () => Promise.reject('options'));
const dummyRandomErrorMatcher = dummyMatcher('randomErrorMatcher', true, () => Promise.reject('random'));
