window.addEventListener('message', async e => {
    // Meta para testar o player APENAS em localhost
    const href = window.location.href;
    if (href.startsWith('http://127.0.0.1') || href.startsWith('http://localhost')) {
        let meta = document.createElement('meta');
        meta.httpEquiv = 'Content-Security-Policy';
        meta.content = 'upgrade-insecure-requests';
        document.getElementsByTagName('head')[0].appendChild(meta);
    }

    console.log('[CR Premium] Player encontrado!');

    // Variáveis principais
    const r = { 0: '720', 1: '1080', 2: '480', 3: '360', 4: '240' };
    const lgLangs = { 'ptBR': 'Português (BR)', 'enUS': 'English (US)', 'enGB': 'English (UK)', 'esLA': 'Español (LA)', 'esES': 'Español (ES)', 'ptPT': 'Português (PT)', 'frFR': 'Français (FR)', 'deDE': 'Deutsch (DE)', 'arME': '(ME) عربي', 'itIT': 'Italiano (IT)', 'ruRU': 'Русский (RU)' };
    const epLangs = { 'ptBR': 'Episódio', 'enUS': 'Episode', 'enGB': 'Episode', 'esLA': 'Episodio', 'esES': 'Episodio', 'ptPT': 'Episódio', 'frFR': 'Épisode', 'deDE': 'Folge', 'arME': 'الحلقة', 'itIT': 'Episodio', 'ruRU': 'Серия' };
    const fnLangs = { 'ptBR': 'FINAL', 'enUS': 'FINAL', 'enGB': 'FINAL', 'esLA': 'FINAL', 'esES': 'FINAL', 'ptPT': 'FINAL', 'frFR': 'FINALE', 'deDE': 'FINALE', 'arME': 'نهائي', 'itIT': 'FINALE', 'ruRU': 'ФИНАЛЬНЫЙ' };

    let is_beta = e.data.beta;
    let force_mp4 = e.data.force_mp4;
    let tampermonkey = e.data.tampermonkey;
    let webvideocaster = e.data.webvideocaster;
    let streamrgx = /_,(\d+.mp4),(\d+.mp4),(\d+.mp4),(?:(\d+.mp4),(\d+.mp4),)?.*?m3u8/;
    let video_config_media = {}; // Initialize an empty object for video_config_media.

    try {
        // Parse the video_config_media JSON.
        video_config_media = JSON.parse(e.data.video_config_media);
    } catch (error) {
        console.error('Error parsing JSON for video_config_media:', error);
    }

    let video_id = video_config_media['media_id'];
    let up_next_cooldown = e.data.up_next_cooldown;
    let up_next_enable = e.data.up_next_enable;
    let up_next = e.data.up_next;
    let next_thumb = up_next ? e.data.up_next_thumbnail : [];
    let version = e.data.version;
    let user_lang = e.data.lang;
    let series = e.data.series;
    let video_stream_url = '';
    let stream_languages = [];
    let video_m3u8_array = {};
    let video_mp4_array = {};
    let rows_number = {};
    let tracks = {};
    let dlSize = [];
    let dlUrl = [];
    let media_data = e.data;
    for (let idx in r) {
        dlSize[idx] = document.getElementById(r[idx] + '_down_size');
        dlUrl[idx] = document.getElementById(r[idx] + '_down_url');
    }

    if (force_mp4) console.log('[CR Premium] Forçando MP4 (chromecast workaround)');

    // Obter streams
    const streamlist = getStreams(video_config_media['streams']);

    if (!streamlist || streamlist.length === 0) {
        displayError(`Não foi possível obter os streams do vídeo.`);
        return;
    }

    const sourceLocale = getSourceLocale();

    for (let stream of streamlist) {
        let streamLang = stream.hardsub_locale ? stream.hardsub_locale : 'off';
        streamLang = streamLang.replace('-', '');
        if (!video_mp4_array[streamLang]) {
            stream_languages.push(streamLang);
            tracks[streamLang] = [];
            video_mp4_array[streamLang] = [];
            rows_number[streamLang] = -1;
        }

        // Padrão
        if (stream.type == 'adaptive_hls') {
            video_stream_url = stream.url;
            video_m3u8_array[streamLang] = force_mp4 ? mp4ListFromStream(video_stream_url) : video_stream_url;
            video_mp4_array[streamLang] = mp4ListFromStream(video_stream_url);
        }
        // Premium
        else if (stream.type == 'trailer_hls')
            if (++rows_number[streamLang] <= 4) {
                // TODO: video_m3u8_array.push(await getDirectStream(stream.url, rows_number[streamLang]));
                const arr_idx = rows_number[streamLang] === 0 ? 2 : rows_number[streamLang] === 2 ? 0 : rows_number[streamLang];
                video_mp4_array[streamLang][arr_idx] = getDirectFile(stream.url);
                video_m3u8_array[streamLang] = video_mp4_array[streamLang];
            }
    }

    // Popular tracks e carregar player
    stream_languages.forEach(lang => {
        if (Array.isArray(video_m3u8_array[lang])) for (let idx of [1, 0, 2, 3, 4]) tracks[lang].push({ file: video_m3u8_array[lang][idx], label: toResolution(r[idx]) });
        else tracks[lang] = { file: video_m3u8_array[lang], type: 'm3u' };
    });

    (() => {
        // Inicia o player
        let playerInstance = jwplayer('player_div');
        playerInstance
            .setup({
                'playlist': [
                    {
                        'title': getLocalEpisodeTitle(),
                        'description': '',
                        'image': media_data['thumbnail'],
                        'sources': tracks[sourceLocale] || tracks['off'],
                        'tracks': buildTracks(tracks)
                    },
                    up_next_enable && up_next
                        ? {
                              'autoplaytimer': 0,
                              'title': media_data.up_next_title, //video_config_media['metadata']['up_next']['display_episode_number'] + ' - ' + video_config_media['metadata']['up_next']['series_title'],
                              'file': 'https://i.imgur.com/8wEeX0R.mp4',
                              'repeat': true,
                              'image': next_thumb
                          }
                        : {}
                ],
                'related': { displayMode: 'none' },
                'nextupoffset': -up_next_cooldown,
                'width': '100%',
                'height': '100%',
                'autostart': false,
                'displayPlaybackLabel': true,
                'primary': 'html5',
                'cast': {},
                'playbackRateControls': [0.5, 0.75, 1, 1.25, 1.5, 2]
            })
            .on('playlistItem', e => {
                // tocar próximo ep
                if (e.index > 0 && up_next_enable && up_next) {
                    jwplayer().setControls(false);
                    jwplayer().setConfig({
                        repeat: true
                    });
                    jwplayer().play();
                    localStorage.setItem('next_up', true);
                    localStorage.setItem('next_up_fullscreen', jwplayer().getFullscreen());
                    window.top.location.href = up_next;
                }
            })
            .on('captionsChanged', el => {
                const { tracks: captions, track: captionIndex } = el;
                const position = jwplayer().getPosition();
                playlist = jwplayer().getPlaylist();
                trackId = captions[captionIndex].id;
                track = trackId === 'off' ? tracks['off'] : trackId === 'default' ? tracks[locale] || tracks['off'] : trackId;
                playlist[0].file = undefined;
                playlist[0].allSources = undefined;
                playlist[0].sources = track;
                playlist[0].tracks = buildTracks(tracks);
                jwplayer().load(playlist);
                jwplayer().play();
                const seek = setInterval(el => {
                    if (jwplayer().getState() === 'playing') {
                        jwplayer().seek(position);
                        clearInterval(seek);
                    }
                }, 5);
                updateWebVideoCasterAnchor();
            });

        // Variaveis para os botões.
        let update_iconPath = 'assets/icon/update_icon.svg';
        let update_id = 'update-video-button';
        let update_tooltipText = 'Atualização Disponível';

        let rewind_iconPath = 'assets/icon/replay-10s.svg';
        let rewind_id = 'rewind-video-button';
        let rewind_tooltipText = 'Voltar 10s';

        let forward_iconPath = 'assets/icon/forward-30s.svg';
        let forward_id = 'forward-video-button';
        let forward_tooltipText = 'Avançar 30s';

        let webvideocaster_iconPath = 'assets/icon/webvideocaster_icon.png';
        let webvideocaster_id = 'webvideocaster-video-button';
        let webvideocaster_tooltipText = 'Abrir no WebVideoCaster';

        let download_iconPath = 'assets/icon/download_icon.svg';
        let download_id = 'download-video-button';
        let download_tooltipText = 'Download';
        let didDownload = false;

        const downloadModal = document.querySelectorAll('.modal')[0];
        const updateModal = document.querySelectorAll('.modal')[1];
        document.querySelectorAll('button.close-modal')[0].onclick = () => (downloadModal.style.visibility = 'hidden');
        document.querySelectorAll('button.close-modal')[1].onclick = () => (updateModal.style.visibility = 'hidden');

        const rewind_ButtonClickAction = () => jwplayer().seek(jwplayer().getPosition() - 10);
        const forward_ButtonClickAction = () => jwplayer().seek(jwplayer().getPosition() + 30);

        function download_ButtonClickAction() {
            if (jwplayer().getEnvironment().OS.mobile == true) {
                downloadModal.style.height = '170px';
                downloadModal.style.overflow = 'auto';
            }
            downloadModal.style.visibility = downloadModal.style.visibility === 'hidden' ? 'visible' : 'hidden';
            if (!didDownload) {
                didDownload = true;
                console.log('[CR Premium] Baixando sources:');
                for (let id of [1, 0, 2, 3, 4]) linkDownload(id);
            }
        }

        function update_ButtonClickAction() {
            if (jwplayer().getEnvironment().OS.mobile == true) {
                updateModal.style.height = '170px';
                updateModal.style.overflow = 'auto';
            }
            updateModal.style.visibility = updateModal.style.visibility === 'hidden' ? 'visible' : 'hidden';
        }

        const forwardBtn = [forward_iconPath, forward_tooltipText, forward_ButtonClickAction, forward_id];
        const rewindBtn = [rewind_iconPath, rewind_tooltipText, rewind_ButtonClickAction, rewind_id];
        const webvideocasterBtn = [webvideocaster_iconPath, webvideocaster_tooltipText, () => {}, webvideocaster_id];
        const downloadBtn = [download_iconPath, download_tooltipText, download_ButtonClickAction, download_id];
        const updateBtn = [update_iconPath, update_tooltipText, update_ButtonClickAction, update_id];

        playerInstance.addButton(...forwardBtn);
        playerInstance.addButton(...rewindBtn);
        if (webvideocaster) playerInstance.addButton(...webvideocasterBtn);
        else playerInstance.addButton(...downloadBtn);
        if (!tampermonkey && version !== '1.4.0') playerInstance.addButton(...updateBtn);

        jwplayer().on('visualQuality', () => {
            // Selecionar qualidade de vídeo
            const selectedQuality = jwplayer().getVisualQuality().level.label;
            console.log('[CR Premium] Qualidade de vídeo selecionada:', selectedQuality);

            for (let idx in r) {
                if (selectedQuality === toResolution(r[idx])) {
                    dlSize[idx].innerHTML = dlSize[idx].getAttribute('s') + dlSize[idx].getAttribute('u') + dlSize[idx].getAttribute('p');
                    dlUrl[idx].href = dlUrl[idx].getAttribute('u');
                }
            }
        });

        jwplayer().on('play', () => {
            updateWebVideoCasterAnchor();
        });

        jwplayer().on('ready', () => {
            updateWebVideoCasterAnchor();
        });

        let download_window;
        window.closeDownloadWindow = () => {
            if (download_window) {
                download_window.close();
            }
        };

        // Abrir o link de download
        const linkDownload = id => {
            let jw = jwplayer();
            let delay = 500;

            jw.seek(0);
            jw.play();

            const t = jwplayer().getEnvironment().OS.mobile ? 1000 : 200;
            setTimeout(() => {
                jw.seek(jw.getPosition() + t);
                setTimeout(() => {
                    if (typeof download_window == 'undefined' || download_window.closed) {
                        download_window = window.open(video_mp4_array[getSourceLocale()][id], 'Video Download');
                    } else {
                        download_window.location = video_mp4_array[getSourceLocale()][id];
                    }
                    download_window.focus();
                    jw.pause(true);
                }, delay);
            }, t);
        };

        // Function to construct tracks array.
        function buildTracks(tracks) {
            const constructedTracks = [];
            for (const [locale, track] of Object.entries(tracks)) {
                constructedTracks.push({
                    file: track,
                    label: getLanguageName(locale),
                    kind: 'captions'
                });
            }
            return constructedTracks;
        }

        // Function to get the language name from the locale.
        function getLanguageName(locale) {
            return lgLangs[locale] || 'Off';
        }

        // Function to get the full episode title with language.
        function getLocalEpisodeTitle() {
            const episodeTitle = video_config_media['metadata']['display_episode_number']
                ? `${getLanguageName(sourceLocale)} - ${video_config_media['metadata']['display_episode_number']}`
                : '';
            return episodeTitle ? `${episodeTitle} - ${video_config_media['metadata']['title']}` : video_config_media['metadata']['title'];
        }

        // Function to convert resolution number to string.
        function toResolution(res) {
            return r[res] ? r[res] + 'p' : '';
        }

        // Function to determine the source locale for captions.
        function getSourceLocale() {
            return user_lang in video_config_media['metadata']['available_languages'] ? user_lang : 'enUS';
        }

        function getDirectFile(url) {
            return url.match(streamrgx)[1];
        }

        function mp4ListFromStream(url) {
            const matches = url.match(streamrgx);
            if (matches) {
                const mp4List = [matches[1], matches[2], matches[3]];
                if (matches[4]) {
                    mp4List.push(matches[4]);
                }
                if (matches[5]) {
                    mp4List.push(matches[5]);
                }
                return mp4List;
            }
            return [];
        }

        // Function to display an error message on the player.
        function displayError(errorMessage) {
            const errorElement = document.createElement('div');
            errorElement.textContent = errorMessage;
            errorElement.style.color = 'red';
            errorElement.style.fontSize = '18px';
            errorElement.style.textAlign = 'center';
            const playerContainer = document.getElementById('player_div');
            playerContainer.innerHTML = '';
            playerContainer.appendChild(errorElement);
        }

        // Function to update the WebVideoCaster anchor element.
        function updateWebVideoCasterAnchor() {
            const anchor = document.getElementById(webvideocaster_id);
            if (anchor) {
                anchor.href = `intent://${window.location.href}#Intent;package=com.instantbits.cast.webvideo;S.url=${window.location.href};end`;
                anchor.style.display = 'block';
            }
        }
    })();
});
