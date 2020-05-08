let url = '';
let TOKEN;

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if(changeInfo.url && url !== changeInfo.url && /^https\:\/\/(api\.)?robinhood\.com/gi.test(changeInfo.url)) {
        chrome.storage.sync.set({currentUrl: changeInfo.url});
        chrome.tabs.sendMessage(tabId, {cmd: 'urlUpdate', url: changeInfo.url});
    }
});

chrome.runtime.onMessage.addListener( async function(request, sender, sendResponse) {
    switch(request.cmd) {
        case 'sniff':
            sendResponse();
            sniff();
            break;
        case 'updateStockValues':
            sendResponse();
            updateStockValues();
            break;
        case 'getHistoricalsBySymbol':
            sendResponse();
            getHistoricalsBySymbol(request.symbol, request.span);
            break;
        case 'getRealTimeTotals':
            sendResponse();
            getCurrentPortfolioTotals();
            break;
    }
});

chrome.runtime.onMessageExternal.addListener( function (request, sender, sendResponse) {
    switch (request.cmd) {
        case 'auth':
            sendResponse();
            setAuth(request.auth);
            break;
    }
});

function setAuth(auth) {
    let token = auth.auth_token.match(/^Bearer\s\w{10}/g);
    token = token ? token[0] : null;
    if(token) {
        if(!TOKEN || TOKEN !== auth.auth_token) {
            TOKEN = auth.auth_token;
            chrome.storage.local.set({r_auth: {auth_token: auth.auth_token}});
        }
    }
}

function updateStockValues() {
    getStockValues();
}

async function getStockValues() {
    let userWatchlistInstrumentsUrl = 'https://api.robinhood.com/watchlists/Default/';
    let data = await get({url: userWatchlistInstrumentsUrl});
    if(data) getWatchlistValues(data.results);
}

function sendErrorMessage(err) {
    if(err.status === 401) chrome.runtime.sendMessage({cmd: 'httpFail', status: 401});
    else chrome.runtime.sendMessage({cmd: 'httpFail', status: 400});
}

async function getWatchlistValues(list) {
    let getValuesUrl = 'https://api.robinhood.com/marketdata/quotes/?bounds=trading&instruments=';
    let params = [];
    for(let obj of list) {
        params.push(encodeURIComponent(obj.instrument));
    }
    let url = getValuesUrl + params.join('%2C');
    let data = await get({url});
    getOwnedStocks(data.results);
    chrome.storage.local.set({watchlistValues: data.results}, () => {
        chrome.runtime.sendMessage({cmd: 'updatedWatchlistStorage'})
    });
}

async function getOwnedStocks(totalResults) {
    let StockUrl = 'https://api.robinhood.com/positions/?nonzero=true';
    let optionsUrl = 'https://api.robinhood.com/options/aggregate_positions/?nonzero=true';
    let data = await get({url: StockUrl});
    let portfolioHoldings = [];
    if( data && data.results.length > 0) {
        let instruments = data.results.map(obj => obj.instrument);
        let holdings = totalResults.filter(obj => instruments.includes(obj.instrument));
        portfolioHoldings = holdings;
    }
    let portfolioHistoricals = await getPortfolioHistorical();
    let realtimeTotals = await getCurrentPortfolioTotals();
    chrome.storage.local.set({portfolioValues: portfolioHoldings, portfolioHistoricals, realtimeTotals}, () => {
        chrome.runtime.sendMessage({cmd: 'updatedPortfolioStorage'})
    });
}

async function getCurrentPortfolioTotals() {
    let url = 'https://phoenix.robinhood.com/accounts/unified';
    let response = await get({url});
    chrome.runtime.sendMessage({cmd: 'realtimeTotals', data: response});
    return response;
}

async function getPortfolioHistorical() {
    let accountNumber = await getAccountNumber();
    if(accountNumber) {
        let url = `https://api.robinhood.com/portfolios/historicals/${accountNumber}/?account=${accountNumber}&bounds=trading&interval=5minute&span=day`
        let res = await get({url});
        if(res) {
            return res;
        }
    }
}

async function getHistoricalsBySymbol(symbol, span = 'day') {
    let params = {
        'day': {bounds:'trading', interval: '5minute'},
        'week': {bounds:'regular', interval: 'hour'},
        'month': {bounds:'regular', interval: 'hour'},
        '3month': {bounds:'regular', interval: 'day'},
        'year': {bounds:'regular', interval: 'day'},
        '5year': {bounds:'regular', interval: 'week'},
    };
    let url = `https://api.robinhood.com/marketdata/historicals/${symbol}/?bounds=${params[span].bounds}&interval=${params[span].interval}&span=${span}`;
    let data = await get({url});
    if(data) {
        chrome.runtime.sendMessage({cmd: 'historicalBySymbol', data});
    }
}

function getToken() {
    return new Promise(resolve => {
        chrome.storage.local.get(['r_auth'], (obj) => {
            if(obj.r_auth) {
                let token = obj.r_auth.auth_token;
                TOKEN = token;
                // console.log(TOKEN);
                resolve(TOKEN);
            }
            else {
                chrome.runtime.sendMessage({cmd: 'httpFail', status: 401}, () => resolve());
            }
        });
    })
}

async function getAccounts() {
    let url = 'https://api.robinhood.com/accounts/';
    let res = await get({url});
    if(res && res.results.length > 0) return res.results[0];
}

function getAccountNumber() {
    return new Promise(resolve => {
        chrome.storage.local.get(['accountNumber'], async (obj) => {
            if(obj.accountNumber) resolve(obj.accountNumber);
            else {
                let accounts = await getAccounts();
                resolve(accounts.account_number);
                chrome.storage.local.set({accountNumber: accounts.account_number});
            }
        })
    })
}

async function get(req) {
    let token = await getToken();
    return new Promise( resolve => {
        $.get({
            url: req.url,
            headers: {"Authorization": token}
        }, (data) => {
            resolve(data);
        }).fail((err) => {
            sendErrorMessage(err);
            resolve();
        });
    })
}

function sniff() {
    const injected = `
        let testScript = document.createElement('script');
        testScript.type = "text/javascript";
        testScript.src = "${chrome.extension.getURL('./onload.js')}";
        testScript.setAttribute("extId", "${chrome.runtime.id}");
        testScript.onload = function() {
            console.log('injected the script from background')
        };
        (document.head || document.documentElement).appendChild(testScript);
    `;
    chrome.tabs.query({active: true}, function(tabs) {
        let currentTab = tabs.find(t => /^https\:\/\/robinhood.com/gi.test(t.url));
        if(currentTab) {
            let tabId = currentTab.id;
            chrome.tabs.executeScript(tabId, {code: injected, runAt: 'document_end'}, () => {
                console.log('successfully injected script');
            });
        }
    });
}