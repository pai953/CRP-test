var s = document.createElement('script');
s.src = chrome.runtime.getURL('interceptor.js');
s.onload = function () {
    this.remove();
};
(document.head || document.documentElement).appendChild(s);

const query = qry => document.body.querySelector(qry);
var preservedState = null;

//function que pega algo dentro dentro do html.
function pegaString(str, first_character, last_character) {
    if (str == null || str.match(first_character + '(.*)' + last_character) == null) {
        return null;
    } else {
        new_str = str.match(first_character + '(.*)' + last_character)[1].trim();
        return new_str;
    }
}

//function para remover elementos da página
function remove(element, name, untilRemoved = false, callback = () => {}) {
    let tries = 0;
    if (untilRemoved) {
        const finishRemove = setInterval(() => {
            if (query(element) != null) {
                clearInterval(finishRemove);
                console.log(`[CR Premium] Removendo ${name}...`);
                const closeBtn = query(element + ' > .close-button');
                if (closeBtn) closeBtn.click();
                else query(element).style.display = 'none';

                callback();
            } else if (tries > 250) clearInterval(finishRemove);
            else tries++;
        }, 20);
    } else if (query(element) != null) {
        console.log(`[CR Premium] Removendo ${name}...`);
        query(element).style.display = 'none';
    }
}

//renderiza player
function importPlayer(ready = false) {
    var videoPlayer = query('.video-player') || query('#frame');
    if (!ready) {
        setTimeout(() => importPlayer(!!videoPlayer), 100);
        return;
    }
    var lastWatchedPlayer = query('#frame');
    if (query('.video-player') && lastWatchedPlayer) lastWatchedPlayer.parentNode.removeChild(lastWatchedPlayer);

    var titleLink = query('.show-title-link');
    if (titleLink) titleLink.style.zIndex = '2';

    console.log('[CR] Removendo player da Crunchyroll...');
    remove('.video-player-placeholder', 'Video Placeholder');
    remove('.video-player', 'Video Player', true);
    remove('.blocked-stream-overlay', 'Blocked Overlay', true);

    console.log('[CR Premium] Removendo overlays...');
    remove('.erc-modal-portal > .overlay > .content-wrapper', 'Free Trial Modal', true, () => (document.body.classList = []));
    remove('.erc-watch-premium-upsell', 'Premium Sidebar', true);
    remove('.erc-watch-premium-dub-upsell', 'New Premium Sidebar', true);

    videoPlayer.src = '';
    const appendTo = videoPlayer.parentNode;

    console.log('[CR] Pegando dados da stream...');
    // var ep_lang = preservedState.localization.locale.replace('-', '');
    // var ep_id = preservedState.watch.id;
    // var ep = preservedState.content.media.byId[ep_id];
    var lang = location.href.match(/\/(.*?)\/watch/)[1].split('-');
    var ep_lang = "";
if (lang && lang.length >= 2) {
    ep_lang = lang[0] + lang[1].toUpperCase();
} else {
    // Handle the case where lang is not defined or doesn't have enough elements.
    // You might want to provide a default value or an error message.
}
    var ep_id = location.href.match(/watch\/(.*?)\//)[1];

    var episode = document.querySelector('.erc-current-media-info > h1')?.textContent;
    var up_next = document.querySelector('[data-t="next-episode"] > a');
    var up_next_title = document.querySelector('[data-t="next-episode"] h4')?.textContent;
    var up_next_thumbnail = document.querySelector('[data-t="next-episode"] img')?.src;
    //var thumbnail = document.querySelector('.video-player-wrapper picture > img')?.src;
    var thumbnail = ''; //ep.images.thumbnail[0][7].source; //pegando a imagem do player
    var playback = ''; //ep.playback;
    var series = document.querySelector('.show-title-link > h4')?.innerText;

    var message = {
        'playback': playback,
        'id': ep_id,
        'lang': ep_lang,
        'up_next': up_next ? up_next.href : undefined,
        'series': series ? series : undefined,
        'episode': episode ? episode : undefined,
        'thumbnail': thumbnail ? thumbnail : undefined,
        'up_next_thumbnail': up_next_thumbnail ? up_next_thumbnail : undefined,
        'up_next_title': up_next_title ? up_next_title : undefined
    };

    console.log('[CR Beta] Adicionando o jwplayer...');
    addPlayer(appendTo, message, true);
}

function addPlayer(element, playerInfo, beta = false) {
    console.log('[CR Premium] Adicionando o jwplayer...');
    var ifrm = document.createElement('iframe');
    ifrm.setAttribute('id', 'frame');
    ifrm.setAttribute('src', 'https://dev4mod.github.io/crp-iframe-player/');
    // ifrm.setAttribute('src', 'http://localhost:5500/');
    ifrm.setAttribute('width', '100%');
    ifrm.setAttribute('height', '100%');
    ifrm.setAttribute('frameborder', '0');
    ifrm.setAttribute('scrolling', 'no');
    ifrm.setAttribute('allowfullscreen', 'allowfullscreen');
    ifrm.setAttribute('allow', 'autoplay; encrypted-media *');

    element.appendChild(ifrm);

    chrome.storage.sync.get(['forcemp4', 'aseguir', 'cooldown', 'webvideocaster'], function (items) {
        ifrm.onload = async function () {
            let media = await getData(playerInfo.id);
            playerInfo['video_config_media'] = media;
            playerInfo['webvideocaster'] = items.webvideocaster === undefined ? false : items.webvideocaster;
            playerInfo['up_next_cooldown'] = items.cooldown === undefined ? 5 : items.cooldown;
            playerInfo['up_next_enable'] = items.aseguir === undefined ? true : items.aseguir;
            playerInfo['force_mp4'] = items.forcemp4 === undefined ? false : items.forcemp4;
            playerInfo['version'] = '1.4.0';
            playerInfo['noproxy'] = true;
            ifrm.contentWindow.postMessage(playerInfo, '*');
        };
    });
}

async function getData(video_id) {
    for (let i = 0; i < 2; i++) {
        await getToken();
        console.log('[CR Premium] Pegando dados da stream...');

        let localToken = localStorage.getItem('token');
        let allTokens = JSON.parse(localToken);
        let mediaId = await getMediaId(video_id, allTokens.token);
        if (mediaId == null) continue;
        let url = `https://beta-api.crunchyroll.com/cms/v2${allTokens.cms.bucket}/videos/${mediaId}/streams?Policy=${allTokens.cms.policy}&Signature=${allTokens.cms.signature}&Key-Pair-Id=${allTokens.cms.key_pair_id}`;
        let response_media = await fetchByPass(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'authorization': `${allTokens.token.token_type} ${allTokens.token.access_token}`
            }
        });
        if (response_media.includes('error')) {
            localStorage.removeItem('token');
            continue;
        }
        return response_media;
    }
    console.log('[CR Premium] Erro ao pegar dados da stream...');
}

async function getMediaId(video_id, token) {
    let resp = await fetchByPass(`https://beta-api.crunchyroll.com/content/v2/cms/objects/${video_id}?ratings=true&locale=pt-BR`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'authorization': `${token.token_type} ${token.access_token}`
        }
    });

    if (resp.includes('error')) {
        localStorage.removeItem('token');
        return null;
    }
    let json = JSON.parse(resp);

    if (json.data && Array.isArray(json.data) && json.data.length > 0) {
        let episodeMetadata = json.data[0].episode_metadata;
        if (episodeMetadata && episodeMetadata.versions && episodeMetadata.versions.length > 0) {
            return episodeMetadata.versions[0].media_guid;
        }
    }

    return null; // Return null if any expected properties are missing
}
async function getToken() {
    let token = localStorage.getItem('token');
    if (token == null || typeof token === 'undefined') {
        console.log('[CR Premium] Token expirado, gerando novo token...');
        let tokenData = JSON.parse(await getRequest());
        console.log(tokenData);
        let newToken = await fetchByPass('https://beta-api.crunchyroll.com/index/v2', {
            method: 'GET',
            headers: {
                'authorization': `${tokenData.token_type} ${tokenData.access_token}`
            }
        });
        let allTokens = JSON.parse(newToken);
        allTokens['token'] = tokenData;
        localStorage.setItem('token', JSON.stringify(allTokens));
    }
}

async function getRequest() {
    let refreshToken = await fetchByPass('https://raw.githubusercontent.com/Samfun75/File-host/main/aniyomi/refreshToken.txt');
    refreshToken = refreshToken.replace(/[\n\r]/gi, '');
    console.log(refreshToken);

    const data = new URLSearchParams();
    data.append('grant_type', 'refresh_token');
    data.append('refresh_token', refreshToken);
    data.append('scope', 'offline_access');

    let resp = await fetchByPass('https://beta-api.crunchyroll.com/auth/v1/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic a3ZvcGlzdXZ6Yy0teG96Y21kMXk6R21JSTExenVPVnRnTjdlSWZrSlpibzVuLTRHTlZ0cU8='
        },
        body: data.toString()
    });
    return resp;
}

function fetchByPass(url, options) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ url, options }, response => {
            if (response.error) {
                reject(response.error);
            } else {
                resolve(response.result);
            }
        });
    });
}

//function ao carregar pagina.
function onloadfunction() {
    importPlayer(); // beta CR
    registerChangeEpisode();
}

// function pra atualizar pagina quando mudar de episodio pela UI beta
var currentURL = window.location.href;

function registerChangeEpisode() {
    setInterval(async () => {
        if (currentURL !== window.location.href) {
            currentURL = window.location.href;
            if (currentURL.includes('/watch/')) {
                remove('.erc-watch-premium-upsell', 'New Premium Sidebar', true);
                remove('.erc-watch-premium-dub-upsell', 'New Premium Sidebar', true);
                const HTML = await fetch(currentURL);
                console.log('[CR Beta] Searching for new INITIAL_STATE');
                preservedState = JSON.parse(pegaString(HTML, '__INITIAL_STATE__ = ', ';'));
                importPlayer(false);
            }
        }
    }, 50);
}

function fetch(url) {
    return new Promise(async (resolve, reject) => {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.withCredentials = true;
        xhr.onreadystatechange = () => {
            if (xhr.readyState == 4)
                if (xhr.status == 200) resolve(xhr.responseText);
                else reject(xhr.statusText);
        };
        xhr.send();
    });
}

document.addEventListener('DOMContentLoaded', onloadfunction, false);
document.onreadystatechange = function () {
    if (document.readyState === 'interactive') {
        console.log('[CR Beta] Searching for INITIAL_STATE');
        const HTML = '' + document.body.innerHTML;
        preservedState = JSON.parse(pegaString(HTML, '__INITIAL_STATE__ = ', ';'));
    }

    const crBetaStyle = document.createElement('style');
    crBetaStyle.innerHTML = `.video-player-wrapper {
    margin-bottom: calc(-3vh - 7vw);
    height: 57.25vw !important;
    margin-left: auto;
    margin-right: auto;
    width: 80% !important;
  }`;
    document.head.appendChild(crBetaStyle);
};

function fetch(url) {
    return new Promise(async (resolve, reject) => {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.withCredentials = true;
        xhr.onreadystatechange = () => {
            if (xhr.readyState == 4)
                if (xhr.status == 200) resolve(xhr.responseText);
                else reject(xhr.statusText);
        };
        xhr.send();
    });
}
