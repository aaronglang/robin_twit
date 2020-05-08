let THEME;

setInterval( function() {
    const cached = JSON.parse(window.localStorage.getItem('twitFeed'));
    let updated = {};
    if(cached) {
        Object.keys(cached).forEach(key =>{
            const now = Date.now();
            const then = new Date(cached[key].created_on);
            const diff = (now - then) / 60000;
            if(diff < 3) updated[key] = cached[key];  
            else console.log('removing key:', key);
        });
        window.localStorage.setItem('twitFeed', JSON.stringify(updated));
    }
}, 1000 * 60);

function formatTweets (ids, key) {
    if(!($('#tweetHome').length)) $('#tweetContainer').append('<div id="tweetHome" class="animated"></div>');
    if(ids.length > 0) {
        for (let id of ids) {
            $('#tweetHome').append(`<div class="tweet" id="${id}"></div>`)
        }
        $('#tweetHome').hide();
        $(".tweet").each( function (t, tweet) {
            const id = $(this).attr('id');
            const opts = {
                conversation:'all',    // or all
                cards: 'visible',  // or visible
                theme: THEME,    // or dark
            }
            twttr.widgets.createTweet(id, tweet, opts).then(() => {
                $('#tweetLoader').hide();
                $('#tweetHome').addClass('fadeInLeft fast').show();
            });
        });
    } else {
        $('#tweetLoader').hide();
        $('#tweetSpot').empty().append(`
            <div id="notFound" class="container" style="color: var(--time-based-font-color)">
                Twitter Feed Not Found: ${key}
            </div>`
        );
        $('#tweetSpot').addClass('fadeInLeft fast').show();
    }
}

async function showTweets(tag, search) {
    let cache = JSON.parse(window.localStorage.getItem('twitFeed'));
    let key = `${tag}${search}`.toLowerCase();
    if(cache && cache[key]) {
        formatTweets(cache[key].ids, key);
    } else {
        let url = `https://7b8eb3wg9i.execute-api.us-east-1.amazonaws.com/dev/tweets/${key}`;
        console.log('getting tweets...', url);
        $.get({
            url,
        }, function(response) {
            let ids = response.ids;
            formatTweets(ids, key);
            if(ids.length >  0) {
                let store = cache ? cache : {};
                store[key] = {};
                store[key].ids = ids;
                store[key].created_on = Date.now();
                window.localStorage.setItem('twitFeed', JSON.stringify(store));
            }
        });
    }
}

async function showTwitterList(list, styleOpts) {
    console.log('INPUT', list)
    let id = /^\d+$/gi.test(list) ? list : '1255368312718004225';
    twttr.widgets.createTimeline(
        {
        sourceType: 'list',
        id
        },
        $("#tweetSpot")[0], styleOpts
    ).then(() => {
        $('#tweetLoader').hide();
        $('#tweetSpot').addClass('fadeInLeft fast').show();
    });
}

async function showTimeline(input) {
    let map = {at:'@', hashtag:'%23', cashtag: '$'};
    searchType = $('.tw:visible').attr('id') || 'list';
    console.log('SEARCH TYPE', searchType);
    input = input.replace(/[^a-zA-Z0-9]/g, '');
    const opts = {
        sourceType: 'profile',
        screenName: input
    };
    const styleOpts = {
        width: '450',
        height: '600',
        theme: THEME
    }
    switch(searchType) {
        case 'at':
            $('#tweetSpot').empty().hide();
            $('#tweetHome').hide();
            twttr.widgets.createTimeline(opts, $("#tweetSpot")[0], styleOpts).then(() => {
                $('#tweetLoader').hide();
                $('#tweetSpot').addClass('fadeInLeft fast').show();
            });
            break;
        case 'hashtag':
            $('#tweetSpot').hide();
            $('#tweetHome').empty();
            $('#tweetHome').show();
            showTweets(map['hashtag'], input);
            break;
        case 'cashtag':
            $('#tweetSpot').hide();
            $('#tweetHome').empty();
            $('#tweetHome').show();
            showTweets(map['cashtag'], input);
            break;
        case 'list':
            $('#tweetSpot').empty().hide();
            $('#tweetHome').hide();
            showTwitterList(input, styleOpts);
            break;
    }
    setTimeout( () => {
        let notfound;
        if(/ashtag/gi.test(searchType)) {
            notfound = !($('.tweet').length);
        } else {
            notfound = !($('#tweetSpot').find('iframe').contents().find('div').length);
        }
        if(notfound && !($('#notFound').length)) {
            $('#tweetSpot').append('<div id="notFound" class="container" style="color: var(--time-based-font-color)">Twitter Feed Not Found</div>')
        };
    }, 5000);
}

function twitterUserSearch() {
    let user = $('#timelineInput').val() || 'breakoutstocks';
    $('#tweetLoader').show();
    $('#tweetSpot').show();
    showTimeline(user);
}

function showIcon(cashtag) {
    let hidden = cashtag ? ['hashtag', 'list', 'at'] : ['hashtag', 'cashtag', 'at'];
    let value = cashtag ? cashtag : 'RobinTwits';
    let placeholder = cashtag ? 'Cashtag' : 'List ID';
    $('#timelineInput').attr('placeholder', placeholder);
    $('#timelineInput').val(value);
    for(let i of hidden) $(`#${i}`).hide();
}

$('document').ready( function() {
    chrome.storage.sync.get(['currentUrl'], (obj) => {
        let URL;
        URL = obj.currentUrl || 'https://robinhood.com/';
        let match = URL.match(/(?<=(stocks|crypto)\/)\w+$/);
        let cashtag = match ? match[0] : null;

        // show searchType icons
        showIcon(cashtag);

        chrome.storage.sync.get(['colors'], (obj) => {
            let backgroundColor = 'white', fontColor = '#1b1b1d';
            if(obj.colors) {
                backgroundColor = obj.colors[0];
                fontColor = obj.colors[1];
            }
            $('html').get(0).style.setProperty('--time-based-color', backgroundColor);
            $('html').get(0).style.setProperty('--time-based-font-color', fontColor);
            THEME = (backgroundColor === 'white') ? 'light' : 'dark';
            if(!cashtag || !/stocks|crypto/gi.test(URL)) {
                // hide tweets from lambda function
                $('#tweetHome').hide();
                // run twitter search based on current default value
                twitterUserSearch();
            } else {
                // get tweets for cashtag based on current window
                showTweets('$', cashtag || 'amzn');
            }
        });

        // watch for search events
        $('#showTimeline').click(twitterUserSearch);
        $('#timelineInput').keypress(function(e) {
            if (e.which == 13) {
                $('#timelineInput').blur();
                twitterUserSearch();
                return false;
            }
        });

        // change search type based on icon selected
        $('#searchSelect').click(function () {
            let icons = ['hashtag', 'cashtag', 'at', 'list'];
            let current = $(this).find('i:visible').attr('id');
            let index = icons.indexOf(current) - 1;
            index = (index < 0) ? 3 : index;
            $(`#${icons[index]}`).show();
            let defaultVals = {at:['Handler','stockTwits'], hashtag:['Hashtag', cashtag || 'NASDAQ'], cashtag: ['Cashtag', cashtag || 'AMZN'], list: ['List ID','1255368312718004225']};
            $('#timelineInput').val(defaultVals[icons[index]][1]);
            $('#timelineInput').attr('placeholder', defaultVals[icons[index]][0]);
            icons.splice(index, 1);
            for(let i of icons) $(`#${i}`).hide();
            // twitterUserSearch();
        });
    });
});
