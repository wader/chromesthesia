'use strict';

function reloadOnChange() {
  let ws = new WebSocket('ws://127.0.0.1:8000/.devd.livereload');
  ws.onmessage = () => {
    // reload current tab with some delay
    // require permissions in manifest
    // chrome.tabs.executeScript(null, {
    //   code: 'setTimeout(function() { document.location.reload(); }, 200);'
    // });

    // reload extension
    chrome.runtime.reload();
  };
}
// reloadOnChange();

// uses only JSON friendly types so that sendMessage works
const initialState = {
  options: {
    captureDuration: defaultOptions.captureDuration
  },
  capture: {
    status: 'idle'
  },
  allTabIds: [],
  audibleTabIds: [],
  usedInTabIds: []
};

function validMatchersForOptions(options) {
  return matchers.filter(m => m.validOptions(options[m.name]) && m);
}

function reduce(state, action) {
  return reduceProps(state, action, {
    options: {
      changeOptions: (propState, propAction) => Object.assign({}, propState, propAction)
    },
    capture: {
      openPageAction: (propState, _propAction) => {
        if (validMatchersForOptions(state.options).length === 0) {
          return {status: 'options'};
        } else if (propState.status === 'idle' || propState.status === 'options') {
          return {status: 'capturing', start: Date.now()};
        } else {
          return propState;
        }
      },
      startCapture: (_propState, _propAction) => ({status: 'capturing', start: Date.now()}),
      captureResult: (_propState, propAction) => Object.assign({status: 'result'}, propAction)
    },
    allTabIds: {
      createTabs: (propState, propAction) => arraySetUnion(propState, propAction),
      removeTabs: (propState, propAction) => arraySetMinus(propState, propAction)
    },
    audibleTabIds: {
      addAudibleTabs: (propState, propAction) => arraySetUnion(propState, propAction),
      removeAudibleTabs: (propState, propAction) => arraySetMinus(propState, propAction),
      removeTabs: (propState, propAction) => arraySetMinus(propState, propAction)
    },
    usedInTabIds: {
      openPageAction: (propState, propAction) => arraySetUnion(propState, [propAction.tabId]),
      removeTabs: (propState, propAction) => arraySetMinus(propState, propAction)
    }
  });
}

function update(oldState, newState, defer) {
  let oldIsCapturing = oldState.capture.status == 'capturing';
  let newIsCapturing = newState.capture.status == 'capturing';

  if (!oldIsCapturing && newIsCapturing) {
    defer(() => captureAndMatch(newState.options));

    newState.allTabIds.forEach(tabId => {
      chrome.tabs.get(tabId, () => {
        if (!chrome.runtime.lastError) {
          chrome.pageAction.setIcon({
            tabId: tabId,
            path: 'icons/iconCapturing38.png'
          });
        }
      });
    });
  } else if (oldIsCapturing && !newIsCapturing) {
    newState.allTabIds.forEach(tabId => {
      chrome.tabs.get(tabId, () => {
        if (!chrome.runtime.lastError) {
          chrome.pageAction.setIcon({
            tabId: tabId,
            path: 'icons/icon38.png'
          });
        }
      });
    });
  }

  let oldHasValidMatches = validMatchersForOptions(oldState.options).length > 0;
  let oldPageActionVisibleIds;
  if (oldIsCapturing || !oldHasValidMatches) {
    oldPageActionVisibleIds = oldState.allTabIds;
  } else {
    oldPageActionVisibleIds = arraySetUnion(oldState.audibleTabIds, oldState.usedInTabIds);
  }
  let newHasValidMatches = validMatchersForOptions(newState.options).length > 0;
  let newPageActionVisibleIds;
  if (newIsCapturing || !newHasValidMatches) {
    newPageActionVisibleIds = newState.allTabIds;
  } else {
    newPageActionVisibleIds = arraySetUnion(newState.audibleTabIds, newState.usedInTabIds);
  }

  if (!arraySetEqual(oldPageActionVisibleIds, newPageActionVisibleIds)) {
    let removedIds = arraySetMinus(oldState.allTabIds, newState.allTabIds);
    let hideIds = arraySetMinus(oldPageActionVisibleIds, newPageActionVisibleIds, removedIds);
    let showIds = arraySetMinus(newPageActionVisibleIds, oldPageActionVisibleIds, removedIds);

    // TODO: there is some kind of tab remove race.
    // should chrome.tabs.get and lastError really be needed?
    hideIds.forEach(tabId => {
      chrome.tabs.get(tabId, () => {
        if (!chrome.runtime.lastError) {
          chrome.pageAction.hide(tabId);
        }
      });
    });
    showIds.forEach(tabId => {
      chrome.tabs.get(tabId, () => {
        if (!chrome.runtime.lastError) {
          chrome.pageAction.show(tabId);
          chrome.pageAction.setIcon({
            tabId: tabId,
            path: newIsCapturing ? 'icons/iconCapturing38.png' : 'icons/icon38.png'
          });
        }
      });
    });
  }

  chrome.runtime.sendMessage({state: newState});
}

const stateAction = createState(
  initialState,
  reduce,
  update
  // (state, action) => {console.log('reduce', action); return reduce(state, action);},
  // (oldState, newState, defer) => {console.log('update', oldState, newState); update(oldState, newState, defer);}
);

function captureAndMatch(options) {
  let validMatchers = validMatchersForOptions(options);
  if (validMatchers.length === 0) {
    stateAction({needOptions: true});
    return;
  }

  return captureAudio(options.captureDuration*1000)
  .then(capture => {
    let shine = new Shine({
      samplerate: capture.sampleRate,
      bitrate: 128,
      channels: capture.channels.length,
      mode: Shine.STEREO
    });
    let mp3Blob = new Blob([shine.encode(capture.channels), shine.close()]);

    return Promise.all(validMatchers.map(m => {
      return (
        // assign source matcher, matches and convert catches to errors
        m.match(options[m.name], mp3Blob)
        .then(r => ({matches: r, matcher: m}))
        // e.message to convert error object to string
        .catch(e => ({error: (e.message || e), matcher: m}))
      );
    }));
  })
  .then(r => {
    stateAction({captureResult: {
      errors: r.filter(m => m.error),
      matches: r.filter(m => m.matches)
    }});
  });
}

chrome.runtime.onMessage.addListener((request, _sender, _response) => {
  if (request.action) {
    stateAction(request.action);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.audible !== undefined) {
    if (tab.audible) {
      stateAction({addAudibleTabs: [tab.id]});
    } else {
      stateAction({removeAudibleTabs: [tab.id]});
    }
  }

  if (changeInfo.status === 'complete') {
    // this will take care of created tabs and reloaded tabs
    // also it seems like pageAction.show can't be used until complete status
    stateAction({removeTabs: [tab.id]});
    stateAction({createTabs: [tab.id]});
    chrome.tabs.get(tab.id, tab => {
      if (!chrome.runtime.lastError) {
        if (tab.audible) {
          stateAction({addAudibleTabs: [tab.id]});
        } else {
          stateAction({removeAudibleTabs: [tab.id]});
        }
      }
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId, _removeInfo) => {
  stateAction({removeTabs: [tabId]});
});

chrome.tabs.query({}, tabs => {
  stateAction({createTabs: tabs.map(tab => tab.id)});
});

chrome.tabs.query({audible: true}, tabs => {
  stateAction({addAudibleTabs: tabs.map(tab => tab.id)});
});

chrome.storage.sync.get(null, items => {
  stateAction({changeOptions: items});
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') {
    return;
  }

  let newValues = Object.keys(changes).reduce((acc, p) =>  {
    acc[p] = changes[p].newValue;
    return acc;
  }, {});

  stateAction({changeOptions: newValues});
});
