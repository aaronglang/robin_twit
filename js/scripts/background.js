let url = '';
let TOKEN;

chrome.runtime.onInstalled.addListener(function(details){
    if(details.reason == "install"){
        let welcomeUrl = chrome.extension.getURL('../../html/welcome.html');
        setTimeout(() => {
            window.open(welcomeUrl);
        }, 1000);
        setTimeout( () => {
            alert('RobinTwits Tip: \nAccess the popup by hitting CMD+SHIFT+P\n(windows/linux/chrome: CTRL+SHIFT+Y)');
        }, 1000 * 30);
    }
});

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
        case 'getPortfolioHistoricals':
            sendResponse();
            getPortfolioHistorical(request.span, true);
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
    getOrders();
    getOptionOrders();
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

async function getStocksByInstruments(list) {
    let getValuesUrl = 'https://api.robinhood.com/marketdata/quotes/?bounds=trading&instruments=';
    let params = [];
    for(let obj of list) {
        params.push(encodeURIComponent(obj.instrument));
    }
    let url = getValuesUrl + params.join('%2C');
    let data = await get({url});
    return data;
}

async function getWatchlistValues(list) {
    let data = await getStocksByInstruments(list);
    let watchlistValues = data.results;
    let owned = await getOwnedStocks(data.results);
    let totals = watchlistValues.concat(owned);
    chrome.runtime.sendMessage({cmd: 'updatedWatchlistStorage', watchlistValues: totals});
    chrome.storage.local.set({watchlistValues: totals});
}

async function getOwnedStocks(totalResults) {
    let StockUrl = 'https://api.robinhood.com/positions/?nonzero=true';
    let optionsUrl = 'https://api.robinhood.com/options/aggregate_positions/?nonzero=true';
    let data = await get({url: StockUrl});
    let portfolioHoldings = [];
    if( data && data.results.length > 0) {
        let ownedHoldings = await getStocksByInstruments(data.results);
        portfolioHoldings = ownedHoldings.results;
    }
    getPortfolioHistorical('day', true);
    getCryptos();
    getOptions();
    let realtimeTotals = await getCurrentPortfolioTotals();
    chrome.runtime.sendMessage({cmd: 'updatedPortfolioStorage', portfolioValues: portfolioHoldings, realtimeTotals});
    chrome.storage.local.set({portfolioValues: portfolioHoldings, realtimeTotals});
    return portfolioHoldings;
}

async function getOptions() {
    let allOptions = 'https://api.robinhood.com/options/aggregate_positions/?nonzero=True';
    const options = await get({url: allOptions});
    let optionArr = [];
    for(let opt of options.results) {
        let rgx = /(?<=options\/instruments\/)[a-z0-9-]+(?=\/$)/gi;
        let matcher = opt.legs[0].option.match(rgx);
        if(matcher) {
            let instrument = matcher[0];
            let currentInfoUrl = `https://api.robinhood.com/marketdata/options/${instrument}/`;
            let optionHolding = await get({url: currentInfoUrl});
            optionHolding.link_id = opt.id;
            optionHolding.symbol = opt.symbol;
            optionArr.push(optionHolding);
        }
    }
    chrome.runtime.sendMessage({cmd: 'updatedOptionHoldings', data: optionArr});
}

async function getCryptos() {
    let allCryptos = 'https://nummus.robinhood.com/currency_pairs/';
    let cryptoUrl = 'https://nummus.robinhood.com/holdings/';
    let holding = await get({url: cryptoUrl});
    let arr = [];
    if(holding.results.length > 0) {
        let all = await get({url: allCryptos});
        let ids = [];
        holding.results.filter(obj => {
            let idObj = all.results.find(o => (o.asset_currency.code === obj.currency.code) && (o.quantity > 0));
            if(idObj) {
                ids.push(idObj.id);
            }
        });
        if(ids.length > 0) {
            let getCryptoValues = 'https://api.robinhood.com/marketdata/forex/historicals/?bounds=24_7&ids=';
            let url = getCryptoValues + ids.join('%2C') + '&interval=5minute&span=day';
            let heldCryptos = await get({url});
            arr = heldCryptos.results.map(obj => {
                if(obj) {
                    return {
                        last_trade_price: obj.data_points.pop().close_price,
                        previous_close: obj.data_points[0].open_price,
                        symbol: obj.symbol
                    }
                }
            });
        }
    }
    chrome.runtime.sendMessage({cmd: 'updateCryptoHoldings', data: arr});
    return arr;
}

async function getCurrentPortfolioTotals() {
    let url = 'https://phoenix.robinhood.com/accounts/unified';
    let response = await get({url});
    chrome.runtime.sendMessage({cmd: 'realtimeTotals', data: response});
    return response;
}

async function getPortfolioHistorical(span = 'day', respond) {
    // by span --> https://api.robinhood.com/portfolios/historicals/5SQ80312/?account=5SQ80312&bounds=regular&interval=day&span=month
    let params = {
        'day': {bounds:'trading', interval: '5minute'},
        'week': {bounds:'regular', interval: '10minute'},
        'month': {bounds:'regular', interval: 'hour'},
        '3month': {bounds:'regular', interval: 'hour'},
        'year': {bounds:'regular', interval: 'day'},
        '5year': {bounds:'regular', interval: 'week'},
        'all': {bounds:'regular', interval: 'week'},
    };
    let accountNumber = await getAccountNumber();
    if(accountNumber) {
        let url = `https://api.robinhood.com/portfolios/historicals/${accountNumber}/?account=${accountNumber}&bounds=${params[span].bounds}&interval=${params[span].interval}&span=${span}`;
        let res = await get({url});
        if(res) {
            if(respond) chrome.runtime.sendMessage({ cmd:'portfolioHistoricals', data: res });
            return res;
        }
    }
}

async function getHistoricalsBySymbol(symbol, span = 'day') {
    let params = {
        'day': {bounds:'trading', interval: '5minute'},
        'week': {bounds:'regular', interval: '10minute'},
        'month': {bounds:'regular', interval: 'hour'},
        '3month': {bounds:'regular', interval: 'hour'},
        'year': {bounds:'regular', interval: 'day'},
        '5year': {bounds:'regular', interval: 'week'},
    };
    let url = `https://api.robinhood.com/marketdata/historicals/${symbol}/?bounds=${params[span].bounds}&interval=${params[span].interval}&span=${span}`;
    let data = await get({url});
    if(data) {
        chrome.runtime.sendMessage({cmd: 'historicalBySymbol', data});
        chrome.storage.local.set({historicalBySymbol: data});
    }
}

async function getOrders() {
    let url = 'https://api.robinhood.com/orders/';
    let orders = await get({url});
    if(orders) {
        chrome.storage.local.set({orderHistory: orders.results});
    }
}

async function getOptionOrders() {
    let url = 'https://api.robinhood.com/options/orders/';
    let optionOrders = await get({url});
    if(optionOrders) {
        chrome.storage.local.set({optionOrderHistory: optionOrders.results});
    }
}

async function getPopularityStore() {
    let store = await new Promise(resolve => {
        chrome.storage.local.get(['popularityData'], (obj) => {
            if(obj.popularityData) resolve(obj.popularityData);
        })
    });
}

async function getPopularityData(symbol, span) {
    let data;
    // let url = `http://robintrack.net/api/stocks/${symbol}/popularity_history`;
    let url = `https://luqvzyvnec.execute-api.us-east-1.amazonaws.com/dev/track/${symbol}`;
    let cached = JSON.parse(window.localStorage.getItem('popularityData'));
    if(cached && cached[symbol]) {
        data = cached[symbol];
    } else {
        data = await new Promise( resolve => {
            $.get({
                url: url,
            }, (data) => {
                resolve(data);
            }).fail((err) => {
                resolve();
            });
        });
    }
    if(data && data.length > 0) {
        if(!cached || !cached[symbol]) {
            let store = cached ? cached : {};
            if(Object.keys(store).length > 3) delete store[Object.keys(store)[0]];
            store[symbol] = data;
            window.localStorage.setItem('popularityData', JSON.stringify(store));
        }
        return data;
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
        testScript.src = "${chrome.extension.getURL('./js/scripts/onload.js')}";
        testScript.setAttribute("extId", "${chrome.runtime.id}");
        (document.head || document.documentElement).appendChild(testScript);
    `;
    chrome.tabs.query({active: true}, function(tabs) {
        let currentTab = tabs.find(t => /^https\:\/\/robinhood.com/gi.test(t.url));
        if(currentTab) {
            let tabId = currentTab.id;
            chrome.tabs.executeScript(tabId, {code: injected, runAt: 'document_end'});
        }
    });
}