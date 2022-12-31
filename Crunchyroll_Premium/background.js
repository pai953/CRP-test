chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    fetch(request.url, request.options)
        .then(async response => {
            sendResponse({ result: await response.text() });
        })
        .catch(error => sendResponse({ error: error }));
    return true;
});
