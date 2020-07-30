let $sidebar;

function addbuttons() {
    let url = window.location.href;
    let buttonsAdded = ($('#showTweets').length);
    let buttonText;
    if(/robinhood\.com\/(stocks|crypto)\/[a-z]+$/gi.test(url)) {
        // individual stocks page
        buttonText = 'orderForm';
        $sidebar = $('.sidebar-content').find('form[data-testid="OrderForm"]').parent(); // replace with "body" to see if we can put this on the expanded url as well
        if(!($sidebar.length)) $sidebar = $('.sidebar-content').find('div[data-testid="OrderForm"]').parent();
        $sidebar.append('<div class="tweets">');
    } else if (/robinhood\.com\/$/gi.test(url) || /robinhood\.com\/news(\/article\/[a-z0-9-]+)?$/gi.test(url)) {
        // homepage
        buttonText = 'watchlist'
        $('div .sidebar-content').css({'overflow-y': 'unset', 'top': '75px'});
        let $sidebar1 = $('.sidebar-content').find('div[data-testid="InstrumentPreviewList"]');// $('.sidebar-content').find('section a[class^="rh-hyperlink"]');
        let $sidebar2 = $('.sidebar-content').find('div[data-testid="VirtualizedSidebar"]').find('div.ReactVirtualized__Grid').first();// $('.sidebar-content').find('section a[class^="rh-hyperlink"]');
        $sidebar = $sidebar1 > $sidebar2 ? $sidebar1 : $sidebar2;
        $sidebar.prepend('<div class="tweets">');
    }
    if(!buttonsAdded) {
        $('.sidebar-content').prepend(`
        <div class="container">
            <div class="row">
                <div class="col-6 button-col">
                    <button type="button" class="btn robin-button-md highlightButtonMain" id="watchlist">${buttonText}</button>
                </div>
                <div class="col-6 button-col">
                    <button type="button" class="btn robin-button-md" id="showTweets">tweets</button>
                </div>
            </div>
        </div>
    `);
    }
}

function addTweets(url) {
    if(
        /robinhood\.com\/((stocks|crypto)\/[a-z]+)?$/gi.test(url) 
        || 
        /robinhood\.com\/news(\/article\/[a-z0-9-]+)?$/gi.test(url)
    ) {
        let buttonAppender = setInterval(() => {
            let finished = ($('#iframe').length);
            if(finished) {
                return clearInterval(buttonAppender);
            }
            addbuttons();
            $('.tweets').append(`<iframe id="iframe" src="${chrome.extension.getURL('../../html/frame.html')}"></iframe>`).hide();
        }, 500);
    }
}

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
    return (hsp>127.5);
}

function setThemeColors() {
    let style = getComputedStyle(document.body);
    let light = style.getPropertyValue('--rh__primary-lightest-base') || '#00c8051a';
    let norm = style.getPropertyValue('--rh__primary-base') || '#00c805';
    // let up = style.getPropertyValue('--rh__semantic-positive-base');
    // let upLight = style.getPropertyValue('--rh__semantic-positive-light');
    // let down = style.getPropertyValue('--rh__semantic-negative-base');
    // let downLight = style.getPropertyValue('--rh__semantic-negative-light');
    let background = $('body').css('background') || 'white';
    background = background.match(/^rgb.*\)/gi)[0];
    let theme = isLight(background) ? 'light' : 'dark';
    let textcolor = $('body').css('color') || '#1b1b1d';
    $('html').get(0).style.setProperty('--time-based-color', background);
    $('html').get(0).style.setProperty('--time-based-font-color', textcolor);
    $('html').get(0).style.setProperty('--robin-color-1', norm);
    $('html').get(0).style.setProperty('--robin-color-light', light);
    chrome.storage.sync.set({theme});
    chrome.storage.sync.set({colors: [background, textcolor, norm, light]});
}

function setWatchlistValues() {
    let portfolioValue = JSON.parse(window.localStorage.getItem('portfolioValue'));
    let watchedStocks = JSON.parse(window.localStorage.getItem('watchedStocks'));
    if(portfolioValue && watchedStocks) {
        chrome.storage.sync.set({portfolioValue, watchedStocks});
    }
}

$('document').ready( function() {

    // set storage for iframe
    chrome.storage.sync.set({currentUrl: window.location.href});
    // inject packet sniffer on current tab
    chrome.runtime.sendMessage({cmd: 'sniff'});

    setTimeout(() => {
        setThemeColors(window.location.href);
    }, 1000);

    addTweets(window.location.href);

    $('body').on('click', '#showTweets', function () {
        // ANALYTICS
        // ga('send', 'event', {
        //     'eventCategory': 'RobinhoodSite',
        //     'eventAction': 'showTweets',
        // });
        // END
        $('.sidebar-content').addClass('expandTweetSection');
        $sidebar.find('section').hide();
        // $sidebar.find('.resize-triggers').hide(); // testing
        $sidebar.find('form[data-testid="OrderForm"]').hide();
        $sidebar.find('div[data-testid="OrderForm"]').hide();
        $sidebar.find('div.ReactVirtualized__Grid__innerScrollContainer').hide(); // testing
        $('.tweets').show();
        if(/\/stocks\/.*$/gi.test(window.location.href)) {
            $('.sidebar-buttons').hide();
            $('.sidebar-content').find('div:has(form[data-testid="OrderForm"])').addClass('tweetbox');
        } else if(/\/crypto\/.*$/gi.test(window.location.href)) {
            $('.sidebar-buttons').hide();
            $('.sidebar-content').find('div:has(div[data-testid="OrderForm"])').addClass('tweetbox');
        } else {
            $('.sidebar-content').find('div[data-testid="InstrumentPreviewList"]').addClass('tweetbox');
            $sidebar.find('div.ReactVirtualized__Grid').first().addClass('tweetbox');
        }
    });

    $('body').on('click', 'nav button', function () {
        let i = 0;
        if($('.tweets').is(':visible')) {
            let interval = setInterval( () => {
                let added = (i > 20) // ($('.tweetbox').length) || (i > 100);
                if(added) clearInterval(interval);                
                $('.sidebar-content').find('div:has(form[data-testid="OrderForm"])').addClass('tweetbox');
                $('.sidebar-content').find('div:has(div[data-testid="OrderForm"])').addClass('tweetbox');
                $('.sidebar-content').find('div[data-testid="InstrumentPreviewList"]').addClass('tweetbox');
                $sidebar.find('div.ReactVirtualized__Grid').first().addClass('tweetbox');
                i++;
            }, 100);
        }
    });

    $('body').on('click', '#watchlist', function () {
        $('.sidebar-content').removeClass('expandTweetSection');
        $('.tweets').hide();
        $('.sidebar-buttons').show();
        $sidebar.find('section').fadeIn();
        $sidebar.find('form[data-testid="OrderForm"]').fadeIn();
        $sidebar.find('div[data-testid="OrderForm"]').fadeIn();
        // set box sizing back to original
        $('.sidebar-content').find('div:has(form[data-testid="OrderForm"])').removeClass('tweetbox');
        $('.sidebar-content').find('div:has(div[data-testid="OrderForm"])').removeClass('tweetbox');
        $('.sidebar-content').find('div[data-testid="InstrumentPreviewList"]').removeClass('tweetbox');
        // show original content
        $sidebar.find('div.ReactVirtualized__Grid__innerScrollContainer').show();
    });

    $('body').on('click', '.robin-button-md', function() {
        $('.highlightButtonMain').removeClass('highlightButtonMain');
        $(this).addClass('highlightButtonMain');
    });
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch(request.cmd) {
        case 'urlUpdate':
            sendResponse();
            addTweets(window.location.href);
            setThemeColors(window.location.href);
            break;
    }
});