function runInterceptor(xhr) {

    console.log('sniffing all communication packets');
    let ExtId = document.currentScript.getAttribute('extid');

    var XHR = XMLHttpRequest.prototype;
    var open = XHR.open;
    var send = XHR.send;
    var setRequestHeader = XHR.setRequestHeader;

    XHR.open = function(method, url) {
        this._method = method;
        this._url = url;
        this._requestHeaders = {};
        this._startTime = (new Date()).toISOString();
        return open.apply(this, arguments);
    };

    XHR.setRequestHeader = function(header, value) {
        this._requestHeaders[header] = value;
        return setRequestHeader.apply(this, arguments);
    };

    XHR.send = function(postData) {

        this.addEventListener('load', function() {
            var endTime = (new Date()).toISOString();

            var reqUrl = this._url;
            if(reqUrl) {

                if (postData) {
                    if (typeof postData === 'string') {
                        try {
                            // here you get the REQUEST HEADERS, in JSON format, so you can also use JSON.parse
                            this._requestHeaders = postData;   
                        } catch(err) {
                            console.log('Request Header JSON decode failed, transfer_encoding field could be base64');
                            console.log(err);
                        }
                    } else if (typeof postData === 'object' || typeof postData === 'array' || typeof postData === 'number' || typeof postData === 'boolean') {
                            // do something if you need
                    }
                }

                // here you get the RESPONSE HEADERS
                // var responseHeaders = this.getAllResponseHeaders();

                if ( this.responseType != 'blob' && this.responseText) {
                    // responseText is string or null
                    try {

                        // here you get RESPONSE TEXT (BODY), in JSON format, so you can use JSON.parse
                        const arr = this.responseText;
                        const funcName = parseUri(reqUrl);
                        if(funcName) {
                            // const json = JSON.parse(arr);
                            const headers = this._requestHeaders;
                            storeRequest(funcName, reqUrl, headers, this._method, ExtId);
                            // parseReponseBody(funcName, json, headers);
                        }
                        // printing url, request headers, response headers, response body, to console

                        // console.log(this._url);
                        // console.log(this._requestHeaders);
                        // console.log(responseHeaders);
                        // console.log(arr);                        

                    } catch(err) {
                        console.log("Error in responseType try catch");
                        console.log(err);
                    }
                }
            }
        });
        return send.apply(this, arguments);
    };
}

class Funcs {

    constructor() {
        this.symbols = {};
    }

    getWatchlistSymbols(body) {
        let results = body.results;
        results.forEach(el => {
            this.symbols[el.symbol] = {};
        });
        console.log('SYMBOLS', Object.keys(this.symbols).length, this.symbols);
    }

    getUserData(body) {
        window.localStorage.setItem('user', JSON.stringify(body));
    }
    
    getOrderData(body) {
        // console.log(body);
    }
    
    getHoldings(body) {
        // console.log(body);
    }

    getUserDayGain(body) {
        window.localStorage.setItem('userDayGain', JSON.stringify(body));
    }

    getRealTimePortfolioValue(body) {
        window.localStorage.setItem('portfolioValue', JSON.stringify(body));
    }

    historicalData(body) {
        // console.log(body);
    }

    getStockValueBySymbol(body) {
        window.localStorage.setItem(`${body.results[0].symbol || 'test'}`, JSON.stringify(body.results[0]));
    }

    getWatchlistIds(body) {

    }

    getStockValues(body) {
        let results = body.results;
        for(let stock of results) {
            if(stock) {
                if(Object.keys(this.symbols).includes(stock.symbol)) {
                    this.symbols[stock.symbol]['price'] = stock.last_trade_price;
                    this.symbols[stock.symbol]['previous_close'] = stock.previous_close;
                    this.symbols[stock.symbol]['after_hours_price'] = stock.last_extended_hours_trade_price;
                }
            }
        }
        // chrome.runtime.sendMessage({cmd: 'stockStore', stocks: this.symbols});
        window.localStorage.setItem('watchedStocks', JSON.stringify(this.symbols));
    }
}

let funcs = new Funcs();

function parseReponseBody(func, body, headers) {
    funcs[func](body, headers);
}

function storeRequest(func, url, headers, method, extID, portfolioId) {
    chrome.runtime.sendMessage(extID, {cmd: 'auth', auth: {auth_token: headers.Authorization, portfolioId} });
    // let stored = window.localStorage.getItem(func);
    // if(!stored) {
    //     window.localStorage.setItem(func, JSON.stringify({method, url, headers}));
    // }
}

function parseUri(url) {
    const paths = [
        ['getUserData', '\/user\/'],
        ['getOrderData', '\/orders\/'],
        ['getHoldings', '\/holdings\/'],
        ['getWatchlistSymbols', '\/instruments\/', /^\?active_instruments_only\=false\&ids\=/gi], // list of watched stock ids in query params --> https://api.robinhood.com/instruments/?active_instruments_only=false&ids=940fc3f5-1db5-4fed-b452-f3a2e4562b5f%2Ca4ecd608-e7b4-4ff3-afa5-f77ae7632dfb%2Cc0bb3aec-bd1e-471e-a4f0-ca011cbec711%2Cd7c0f322-e333-483d-8626-bd1173b5ffd5%2C91da75e3-1684-4ed8-b976-1be0121aa16d%2Ce39ed23a-7bd1-4587-b060-71988d9ef483%2C330579a8-907e-49d2-97a7-92a8d1a20088%2C43c1172a-9130-420a-ac9b-b01a6ff5dd54%2Cbab3b12b-4216-4b01-b2d8-9587ee5f41cf%2Cca4821f9-06c3-4c22-bbb8-efe569f23d2b%2Cebab2398-028d-4939-9f1d-13bf38f81c50%2C0dd811b3-7047-448d-96e0-7bf6ee4cfe45%2Cad059c69-0c1c-4c6b-8322-f53f1bbd69d4%2C544a79d6-8599-4131-a367-ffce07d74ab9%2C450dfc6d-5510-4d40-abfb-f633b7d9be3e%2Cae7f719c-ba1a-4207-8d94-af40fb7310f8%2C35739e4a-7c80-495e-b5b8-55b281a11c30%2C3a47ca97-d5a2-4a55-9045-053a588894de%2C81733743-965a-4d93-b87a-6973cb9efd34%2C39ff611b-84e7-425b-bfb8-6fe2a983fcf3%2C1e513292-5926-4dc4-8c3d-4af6b5836704%2C0a8a072c-e52c-4e41-a2ee-8adbd72217d3%2Cf3acdd2f-6580-4c75-a69c-81481cc4c235%2C50810c35-d215-4866-9758-0ada4ac79ffa%2Cf38285c7-235d-4edf-94b4-8d230cb0e12e%2Cba58ee89-58b3-4e79-9713-b40fe08d54da%2C35875944-ffb7-47eb-a2e5-582ba9f26a8d%2C6eff9d56-6244-44c7-933b-f87e7a334ae1%2Cba64dea1-34fc-4571-a88d-3974861073f3%2Cba37d8ed-1714-46c9-92e7-e5a799c06605%2Ca6fca97e-3cd0-4d86-b7ac-4c5d15fed91c%2C5099ddaa-37a3-4b52-8964-1a24be2d4b03
        ['getUserDayGain', /\/portfolios\/historicals\/\w+\/$/],
        ['getRealTimePortfolioValue', /\/portfolios\/\w+\/$/],
        ['historicalData', '\/marketdata\/historicals\/'],
        ['getStockValueBySymbol', '\/instruments\/', /^\?active_instruments_only\=false\&symbol\=\w+/gi],
        ['getStockValues', '\/marketdata\/quotes\/', /\&instruments\=/gi], // https://api.robinhood.com/marketdata/quotes/?bounds=trading&instruments=[listOfStockIds]
        ['getWatchlistIds', '\/watchlists\/Default\/']
    ];
    let parsedUrl = new URL(url);
    let path = parsedUrl.pathname;
    let searchParam = parsedUrl.search;
    let match = paths.find(el => {
        let rgx = new RegExp(el[1]);
        if( (el[1] === path || rgx.test(path)) && ( (!el[2]) || ((el[2] && el[2].test(searchParam))) ) ) {
            return el;
        }
    });
    let funcName = match ? match[0] : null;
    // if (funcName) console.log(funcName);
    return funcName;
}

runInterceptor(XMLHttpRequest);

// function runInterceptor(xhr) {

//     console.log('sniffing all communication packets');
//     let ExtId = document.currentScript.getAttribute('extid');

//     var XHR = XMLHttpRequest.prototype;
//     var open = XHR.open;
//     var send = XHR.send;
//     var setRequestHeader = XHR.setRequestHeader;

//     XHR.open = function(method, url) {
//         this._method = method;
//         this._url = url;
//         this._requestHeaders = {};
//         this._startTime = (new Date()).toISOString();
//         return open.apply(this, arguments);
//     };

//     XHR.setRequestHeader = function(header, value) {
//         this._requestHeaders[header] = value;
//         return setRequestHeader.apply(this, arguments);
//     };

//     XHR.send = function(postData) {

//         this.addEventListener('load', function() {
//             var endTime = (new Date()).toISOString();

//             var reqUrl = this._url;
//             if(reqUrl) {

//                 if (postData) {
//                     if (typeof postData === 'string') {
//                         try {
//                             // here you get the REQUEST HEADERS, in JSON format, so you can also use JSON.parse
//                             this._requestHeaders = postData;   
//                         } catch(err) {
//                             console.log('Request Header JSON decode failed, transfer_encoding field could be base64');
//                             console.log(err);
//                         }
//                     } else if (typeof postData === 'object' || typeof postData === 'array' || typeof postData === 'number' || typeof postData === 'boolean') {
//                             // do something if you need
//                     }
//                 }

//                 if ( this.responseType != 'blob' && this.responseText) {
//                     // responseText is string or null
//                     try {

//                         const headers = this._requestHeaders;
//                         storeRequest(headers, ExtId);
                
//                     } catch(err) {
//                         console.log("Error in responseType try catch");
//                         console.log(err);
//                     }
//                 }
//             }
//         });
//         return send.apply(this, arguments);
//     };
// }

// function storeRequest(headers, extID) {
//     if(headers && headers.Authorization) {
//         chrome.runtime.sendMessage(extID, {cmd: 'auth', auth: {auth_token: headers.Authorization} });
//     }
// }


// runInterceptor(XMLHttpRequest);
