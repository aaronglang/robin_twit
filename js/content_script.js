let $sidebar;

function addbuttons() {
    let url = window.location.href;
    console.log(url);
    let buttonsAdded = ($('#showTweets').length);
    let buttonText;
    if(/robinhood\.com\/(stocks|crypto)\/[a-z]+$/gi.test(url)) {
        // individual stocks page
        buttonText = 'orderForm';
        $sidebar = $('.sidebar-content').find('form[data-testid="OrderForm"]').parent(); // replace with "body" to see if we can put this on the expanded url as well
        if(!($sidebar.length)) $sidebar = $('.sidebar-content').find('div[data-testid="OrderForm"]').parent();
        $sidebar.append('<div class="tweets">');
    } else if (/robinhood\.com\/$/gi.test(url)) {
        // homepage
        buttonText = 'watchlist'
        $('div .sidebar-content').css({'overflow-y': 'unset', 'top': '75px'});
        $sidebar = $('.sidebar-content').find('div[data-testid="InstrumentPreviewList"]');// $('.sidebar-content').find('section a[class^="rh-hyperlink"]');
        $sidebar.append('<div class="tweets">');
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
    if(/robinhood\.com\/((stocks|crypto)\/[a-z]+)?$/gi.test(url)) {
        let buttonAppender = setInterval(() => {
            let finished = ($('#iframe').length);
            if(finished) {
                return clearInterval(buttonAppender);
            }
            addbuttons();
            $('.tweets').append(`<iframe id="iframe" src="${chrome.extension.getURL('frame.html')}"></iframe>`).hide();
        }, 500);
    }
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
        if( !($('body').hasClass('theme-open-up')) && !($('body').hasClass('theme-open-down')) )  {
            $('html').get(0).style.setProperty('--time-based-color', '#1b1b1d');
            chrome.storage.sync.set({colors: ['#1b1b1d', 'white']});
        } else {
            chrome.storage.sync.set({colors: ['white', '#1b1b1d']});
        }
    }, 2000);

    addTweets(window.location.href);

    $('body').on('click', '#showTweets', function () {
        $sidebar.find('section').hide();
        $sidebar.find('form[data-testid="OrderForm"]').hide();
        $sidebar.find('div[data-testid="OrderForm"]').hide();
        $('.tweets').fadeIn();
        if(/\/stocks\/.*$/gi.test(window.location.href)) {
            $('.sidebar-buttons').hide();
            $('.sidebar-content').find('div:has(form[data-testid="OrderForm"])').addClass('tweetbox');
        } else if(/\/crypto\/.*$/gi.test(window.location.href)) {
            $('.sidebar-buttons').hide();
            $('.sidebar-content').find('div:has(div[data-testid="OrderForm"])').addClass('tweetbox');
        } else {
            $('.sidebar-content').find('div[data-testid="InstrumentPreviewList"]').addClass('tweetbox');
        }
    });

    $('body').on('click', 'a', function () {
        let i = 0;
        let interval = setInterval( () => {
            let added = ($('.tweetbox').length) || (i > 20);
            if(added) clearInterval(interval);
            $('.sidebar-content').find('div:has(form[data-testid="OrderForm"])').addClass('tweetbox');
            $('.sidebar-content').find('div:has(div[data-testid="OrderForm"])').addClass('tweetbox');
            $('.sidebar-content').find('div[data-testid="InstrumentPreviewList"]').addClass('tweetbox');
            i++;
        }, 100);
    });

    $('body').on('click', '#watchlist', function () {
        $('.tweets').hide();
        $('.sidebar-buttons').show();
        $sidebar.find('section').fadeIn();
        $sidebar.find('form[data-testid="OrderForm"]').fadeIn();
        $sidebar.find('div[data-testid="OrderForm"]').fadeIn();
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
            break;
    }
});