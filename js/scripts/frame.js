let THEME;
let pieChart;

// GOOGLE ANALYITCS
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
ga('create', 'UA-169402994-1', 'auto');
ga('set', 'checkProtocolTask', null);
ga('send', 'pageview', '/frame');
// END

function isLight(color) {
    if (color.match(/^rgb/)) {
        color = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)/);
        r = color[1];
        g = color[2];
        b = color[3];
    }
    else {
        color = +("0x" + color.slice(1).replace(color.length < 5 && /./g, '$&$&'));
        r = color >> 16;
        g = color >> 8 & 255;
        b = color & 255;
    }
    hsp = Math.sqrt(
      0.299 * (r * r) +
      0.587 * (g * g) +
      0.114 * (b * b)
    );
    return (hsp > 127.5);
}

setInterval( function() {
    const cached = JSON.parse(window.localStorage.getItem('twitFeed'));
    let updated = {};
    if(cached) {
        Object.keys(cached).forEach(key =>{
            const now = Date.now();
            const then = new Date(cached[key].created_on);
            const diff = (now - then) / 60000;
            if(diff < 3) updated[key] = cached[key];  
            // else console.log('removing key:', key);
        });
        window.localStorage.setItem('twitFeed', JSON.stringify(updated));
    }
}, 1000 * 60);

function setTweetThemes() {
    return new Promise( resolve => {
        chrome.storage.sync.get(['theme'], (obj) => {
            let theme = obj.theme;
            // console.log(theme);
            THEME = theme;
            resolve(theme);
        });
    });
}

function formatTweets (ids, key, analyzed) {
    if(!($('#tweetHome').length)) $('#tweetContainer').append('<div id="tweetHome" class="animated"></div>');
    if(ids.length > 0) {
        $('#tweetHome').append(`
            <br>
            <div>
                <h5 class="font-color-norm"><strong>${ids.length} Recent Tweets Found:</strong></h5>
            </div>
        `);
        for (let id of ids) {
            let an = analyzed.find(t => t.id == id);
            let keywords = an.keywords.map(k => `${Object.keys(k)[0]} ${Object.values(k)[0]}`);
            // <br>Keywords: ${keywords.join(', ')}
            $('#tweetHome').append(`
                <div class="tweet" id="${id}" tweet-score="${an.score}" keywords="${keywords.join(' ')}">
                    Sentiment: ${ an.score > 0 ? '<i class="fas fa-thumbs-up"></i>' : (an.score < 0) ? '<i class="fas fa-thumbs-down"></i>' : 'Neutral <i class="far fa-meh"></i>'}
                </div>
            `);
        }
        $('#tweetHome').hide();
        $(".tweet").each( function (t, tweet) {
            const id = $(this).attr('id');
            const opts = {
                conversation:'all',    // or all
                cards: 'visible',  // or hidden
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

function keywordTweetHider(keyword) {
    if(!/^\$/gi.test(keyword)) {
        $('#tweetHome').find('.tweet').each( function() {
            let keywords = $(this).attr('keywords');
            if(!keywords.split(' ').includes(keyword)) {
                $(this).hide();
            } else {
                $(this).show();
            }
        });
    }
}

function legendTweetHider(e, legendItem) {
    const ci = this.chart;
    // index = 0 since only have one dataset
    let meta = ci.getDatasetMeta(0);
    let thisMeta = meta.data[legendItem.index];
    let otherMetas = meta.data.filter(i => i._index !== legendItem.index);
    let shouldHide = !(otherMetas[0].hidden && otherMetas[1].hidden);
    otherMetas.forEach(obj => {
        obj.hidden = shouldHide;
    });
    thisMeta.hidden = false;
    // hide/show tweets
    $('#tweetHome').find('.tweet').each( function() {
        let score = +$(this).attr('tweet-score');
        if(shouldHide && legendItem.text === 'negative' && score >= 0) {
            $(this).fadeOut();
        } else if (shouldHide && legendItem.text === 'positive' && score <= 0) {
            $(this).fadeOut();
        } else if (shouldHide && legendItem.text === 'neutral' && score !== 0) {
            $(this).fadeOut();
        } else {
            $(this).fadeIn();
        }
    });
    ci.update();
}

function formatPercent(p) {
    return (p > 0) ? `+${p}%` : (p < 0) ? `${p}%` : `${p}%`;
}

function formatTweetUri(symbol, score) {
    return new Promise( resolve => {
        let tag = symbol.replace(/^\$|^\#/, '');
        chrome.storage.local.get(['watchlistValues'], (obj) => {
            let stocks = obj.watchlistValues;
            let uri = '';
            if(stocks) {
                let stock = stocks.find(o => o.symbol.toLowerCase() === tag.toLowerCase());
                // console.log(stock, tag);
                if(stock) {
                    let obj = {};
                    let price = (+stock.last_extended_hours_trade_price > 0) ? +stock.last_extended_hours_trade_price : +stock.last_trade_price;
                    obj.price = price.toFixed(2);
                    obj.symbol = stock.symbol;
                    let percent = +((price / +stock.previous_close * 100) - 100).toFixed(2);
                    obj.percent = percent;
                    uri = `$${obj.symbol.replace(/(?<=\w)(\-)?USD/g, '').toUpperCase()} ${formatPercent(obj.percent)} today. Currently at $${obj.price}`;
                } else {
                    uri = `$${tag.toUpperCase()}`;
                }
            }
            let encoded = encodeURIComponent(`${uri}\nTweet Sentiment Score: ${score}%`);
            resolve(encoded);
        });
    })
}

const dynamicColors = (length) => {
    let colors = [];
    for(let i = 0; i < length; i++) {
        const r = Math.floor(Math.random() * 255);
        const g = Math.floor(Math.random() * 255);
        const b = Math.floor(Math.random() * 255);
        colors.push("rgb(" + r + "," + g + "," + b + ")");
    }
    return colors;
};

async function chartTopWords(response, tag, labelColor) {
    let $div = $('#chartDiv');
    // get prefix of symbol
    let pre = /^\$/gi.test(tag) ? '$' : '#';
    // create two charts from hashtags/cashtags and keywords
    for(let t of ['topSymbols', 'topWords']) {
        let title = [`${tag.toUpperCase()} Tweets`];
        if(pre === '$') {
            title.unshift((/symbol/gi.test(t)) ? 'Top 3 Stock Symbols' : 'Top 10 Keywords');
        } else{
            title.unshift((/symbol/gi.test(t)) ? 'Top 3 Hashtags' : 'Top 10 Keywords');
        }
        let ctx = document.createElement('canvas');
        ctx.height = '75';
        ctx.width = '75';
        $div.append(ctx);
        let labels = response[t].map(el => t === 'topSymbols' ? `${pre}${pre === '$' ? el[0].toUpperCase() : el[0]}` : el[0]);
        let dataset = response[t].map(el => el[1]);
        let bgColors = dynamicColors(labels.length);
        let options = {
            // events: ['click', 'hover'],
            onClick: function(c,i) {
                e = i[0];
                if(e) {
                    // console.log(e._index)
                    var x_value = this.data.labels[e._index];
                    var y_value = this.data.datasets[0].data[e._index];
                    keywordTweetHider(x_value);
                }
            },
            legend: {display: false},
            title: {display: true, text: title, fontSize: 18, fontColor: labelColor},
            scales: {
                yAxes: [{
                    ticks: {beginAtZero: true, fontColor: labelColor, precision: 0}
                }],
                xAxes: [{
                    ticks: {fontColor: labelColor}
                }]
            },
            plugins: {
                crosshair: false
            }
        }
        let data = {
            labels,
            datasets: [{
                data: dataset,
                backgroundColor: bgColors
            }]
        }
        let chart = new Chart(ctx, {
            type: 'bar',
            data,
            options
        })
        chart.render();
    }
}

async function chartInsights(response, tag) {
    tag = decodeURIComponent(tag);
    let insights = response.insights;
    let uri = await formatTweetUri(tag, insights.totalScore);
    $('.tweetChart').attr('href', `https://twitter.com/intent/tweet?text=${uri}`);
    let style = getComputedStyle(document.body);
    let labelColor = style.getPropertyValue('--time-based-font-color');
    let $div = $('#chartDiv');
    $div.empty();
    // $div.hide();
    let ctx = document.createElement('canvas');
    ctx.height = '75';
    ctx.width = '75';
    $div.append(ctx);
    chartTopWords(response, tag, labelColor);
    let dataset = Object.values(insights);
    let labels = Object.keys(insights);
    labels.pop();
    dataset.pop();
    let total = dataset.reduce((a, b) => a + b, 0);
    let data = {
        labels,
        datasets: [{
            data: dataset,
            backgroundColor: ["rgba(0,200,5,1)", "rgba(255,80,0,1)","#8F9491"],
        }],
    };
    let options = {
        title: {
            display: true,
            fontSize: 18, //[18, 18, 12],
            fontColor: labelColor,
            text: [`Tweet Sentiment`, `Tweet Score: ${insights.totalScore}%`]
        },
        legend: {
            onClick: legendTweetHider,
            labels: {
                fontColor: labelColor,
            }
        },
        tooltips: {
            displayColors: false,
            callbacks: {
                label: function(tooltipItem, data) {
                    let index = tooltipItem.index;
                    return `${(dataset[index]/total*100).toFixed(2)}% ${labels[index]}`;
                }
            }
        },
        plugins: {
            crosshair: false
        }
    };
    pieChart = new Chart(ctx, {
        type: 'pie',
        data,
        options
    });
    $('#chartSpot').addClass('fadeInLeft').show();
    $('#chartDiv').hide();
    $('#expander').replaceWith(`<strong id="expander">Show Insights&nbsp;<i class="fas fa-plus-circle"></i></strong>`).fadeIn();
    pieChart.render();
}

async function showTweets(tag, search) {
    // ANALYTICS
    ga('send', 'event', {
        'eventCategory': 'Twitter',
        'eventAction': 'TagSearch',
        'eventLabel': `${tag}${search}`,
      });
    // END
    let cache = JSON.parse(window.localStorage.getItem('twitFeed'));
    let key = `${tag}${search}`.toLowerCase();
    if(cache && cache[key]) {
        formatTweets(cache[key].ids, key, cache[key].analyzed);
        chartInsights(cache[key], key);
    } else {
        let url = `https://7b8eb3wg9i.execute-api.us-east-1.amazonaws.com/dev/tweets/${key}`;
        // console.log('getting tweets...', url);
        $.get({
            url,
        }, function(response) {
            chartInsights(response, key);
            let ids = response.ids;
            formatTweets(ids, key, response.analyzed);
            if(ids.length >  0) {
                // console.log(response);
                let store = cache ? cache : {};
                store[key] = {};
                store[key].insights = response.insights;
                store[key].analyzed = response.analyzed;
                store[key].ids = ids;
                store[key].topWords = response.topWords;
                store[key].topSymbols = response.topSymbols;
                store[key].created_on = Date.now();
                window.localStorage.setItem('twitFeed', JSON.stringify(store));
            }
        });
    }
}

async function showTwitterList(list, styleOpts) {
    // console.log('INPUT', list)
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
    await setTweetThemes();
    let map = {at:'@', hashtag:'%23', cashtag: '$'};
    searchType = $('.tw:visible').attr('id') || 'list';
    // console.log('SEARCH TYPE', searchType);
    input = input.replace(/[^a-zA-Z0-9]/g, '');
    const opts = {
        sourceType: 'profile',
        screenName: input
    };
    const styleOpts = {
        width: '2000',
        // height: '100%',
        theme: THEME
    }
    switch(searchType) {
        case 'at':
            $('#chartSpot').hide();
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
            $('#chartSpot').fadeOut();
            showTweets(map['hashtag'], input);
            break;
        case 'cashtag':
            $('#tweetSpot').hide();
            $('#tweetHome').empty();
            $('#tweetHome').show();
            $('#chartSpot').fadeOut();
            showTweets(map['cashtag'], input);
            break;
        case 'list':
            $('#chartSpot').hide();
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
            $('#tweetSpot').append(`
                <div id="notFound" class="container" style="color: var(--time-based-font-color)">
                    Twitter Feed Not Found
                </div>
            `);
        };
    }, 5000);
}

function twitterUserSearch() {
    $('#chartSpot').hide();
    let user = $('#timelineInput').val() || 'aarongabriel58';
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

    setTweetThemes();

    chrome.storage.sync.get(['currentUrl'], (obj) => {
        let URL;
        URL = obj.currentUrl || 'https://robinhood.com/';
        let match = URL.match(/(?<=(stocks|crypto)\/)\w+$/);
        let cashtag = match ? match[0] : null;

        // show searchType icons
        showIcon(cashtag);

        chrome.storage.sync.get(['colors'], (obj) => {
            let background = '#ffff', textcolor = '#1b1b1d';
            let norm = '#00c805', light = '#00c8051a';
            if(obj.colors) {
                [ background, textcolor, norm, light ] = obj.colors;
            }
            $('html').get(0).style.setProperty('--time-based-color', background);
            $('html').get(0).style.setProperty('--time-based-font-color', textcolor);
            $('html').get(0).style.setProperty('--robin-color-1', norm);
            $('html').get(0).style.setProperty('--robin-color-light', light);
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

        $('body').on('click', '#expander', function() {
            if($('#chartDiv:visible').length > 0) {
                $('#chartDiv').slideUp();
                $('#expander').replaceWith('<strong id="expander">Show Insights&nbsp;<i class="fas fa-plus-circle"></i></strong>');
            }
            else {
                // ANALYTICS
                ga('send', 'event', {
                    'eventCategory': 'Twitter',
                    'eventAction': 'SentimentChartView',
                });
                // END
                $('#chartDiv').show();
                $('#expander').replaceWith('<strong id="expander">Hide Insights&nbsp;<i class="fas fa-minus-circle"></i></strong>');
            }
        });

        // change search type based on icon selected
        $('#searchSelect').click(function () {
            // ANALYTICS
            ga('send', 'event', {
                'eventCategory': 'Twitter',
                'eventAction': 'searchSelectChange',
            });
            // END
            let icons = ['hashtag', 'cashtag', 'at', 'list'];
            let current = $(this).find('i:visible').attr('id');
            let index = icons.indexOf(current) - 1;
            index = (index < 0) ? 3 : index;
            $(`#${icons[index]}`).show();
            let defaultVals = {at:['Handler','aarongabriel58'], hashtag:['Hashtag', cashtag || 'robintwit'], cashtag: ['Cashtag', cashtag || 'AMZN'], list: ['List ID','1255368312718004225']};
            $('#timelineInput').val(defaultVals[icons[index]][1]);
            $('#timelineInput').attr('placeholder', defaultVals[icons[index]][0]);
            icons.splice(index, 1);
            for(let i of icons) $(`#${i}`).hide();
            // twitterUserSearch();
        });
    });
});
