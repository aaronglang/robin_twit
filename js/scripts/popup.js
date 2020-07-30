import {COLORTHEME, THEMECOLORS, setGainTheme, setTheme, setTableTheme} from '../modules/themeController.js';
import * as chartFormatter from '../modules/chartFormatting.js';

let PORTCHART, CHART;
let SYMBCHART = {}, DOWNLOADCHART = {};

String.prototype.toNumberWithCommas = function() {
    return this.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// popularity-data cache cleaner
setInterval( function() {
    const cached = JSON.parse(window.localStorage.getItem('popularityData'));
    let updated = {};
    if(cached) {
        Object.keys(cached).forEach(key =>{
            const now = Date.now();
            const then = new Date(cached[key].created_on);
            const diff = (now - then) / 60000;
            if(diff < 30) updated[key] = cached[key];  
            // else console.log('removing key:', key);
        });
        window.localStorage.setItem('popularityData', JSON.stringify(updated));
    }
}, 1000 * 60);

function formatWatchlistTable(stocks) {
    let data = [];
    let uri = [];
    for(let stock of stocks) {
        let obj = {};
        let price = (+stock.last_extended_hours_trade_price > 0) ? +stock.last_extended_hours_trade_price : +stock.last_trade_price;
        obj.price = price.toFixed(2);
        obj.symbol = stock.symbol;
        let percent = +((price / +stock.previous_close * 100) - 100).toFixed(2);
        obj.percent = percent;
        uri.push(`$${obj.symbol.replace(/(?<=\w)(\-)?USD/g, '')}\t${percentFormatter(obj.percent)}`);
        data.push(obj);
    }
    // let currentUrl = $('#shareStandings').attr('href');
    // for(let u of uri) {
    //     let encoded = encodeURIComponent(u);
    //     currentUrl = `${currentUrl}%0D%0A${encoded}`;
    // }
    return [data];
}

function formatOptionsTable(options) {
    let data = [];
    for(let opt of options) {
        let price = (+opt.adjusted_mark_price).toFixed(2);
        let symbol = `${opt.symbol}_${opt.link_id}`;
        let percent = +((+price/opt.previous_close_price * 100) - 100).toFixed(2);
        data.push({price, symbol, percent});
    }
    return [data];
}

function addTweetButtonToWatchlist(data) {
    let uri = '';
    for(let obj of data) {
        uri = `${uri}\n$${obj.symbol.replace(/(?<=\w)(\-)?USD/g, '')} \t${percentFormatter(obj.percent)}\n#RobinTwit`;
    }
    uri = encodeURIComponent(uri);
    let tweetUrl = encodeURIComponent(`My RobinTwit Watchlist:`);
    $('#tweetWatchlist').remove();
    $('#tableTitle').append(`
        <a  id="tweetWatchlist"
            href="https://twitter.com/intent/tweet?text=${tweetUrl}${uri}"
            target="_blank"
            title="Tweet">
            <i class="fab fa-twitter mainTw"></i>
        </a>
    `);
}

function getWatchlistValues() {
    chrome.storage.local.get(['watchlistValues'], (obj) => {
        let watchedStocks = obj.watchlistValues;
        let $table = $('#watchlistTable');
        let [data] = formatWatchlistTable(watchedStocks);
        // addTweetButtonToWatchlist(data);
        if(data.length > 7) $table.attr('data-height', '450');
        $table.bootstrapTable('destroy');
        $table.bootstrapTable({data, onCollapseRow});
        setTableTheme();
    });
}

// TABLE FUNCTIONS
function onCollapseRow(index, row, $detail) {
}

function onExpandRowMain(index, row, $detail) {
    $('#hideChart').find('i').replaceWith('<i class="fas fa-plus-circle"></i>');
    // $('.mainSpanners').hide();
    // $('#myChart').slideUp();
}

function toggleMainChart() {
    if(($('#myChart').is(':visible'))) {
        $('#hideChart').find('i').replaceWith('<i class="fas fa-plus-circle"></i>');
        $('.mainSpanners').hide();
        $('#myChart').slideUp();
    }
    else {
        $('#myChart').slideDown();
        $('.mainSpanners').show();
        $('#hideChart').find('i').replaceWith('<i class="fas fa-minus-circle"></i>');
    }
}

function toggleTable($toggler) {
    $('.tabletoolbar:visible').slideUp();
    $('.tabletoolbar:visible').parent().find('.hideTable i').replaceWith('<i class="fas fa-plus-circle"></i>');
    let $tableDiv = $toggler.parent().parent().find('.tabletoolbar');
    let $table = $tableDiv.find('table')
    let fn = ($table.is(':visible')) ? 'slideUp' : 'slideDown';
    $tableDiv[fn]();
    let i = fn === 'slideUp' ? '<i class="fas fa-plus-circle"></i>' : '<i class="fas fa-minus-circle"></i>';
    $toggler.find('i').replaceWith(i);
}

function formatIndividualChart(data) {
    let arr = data.historicals.map( h => {
        return {
            x: moment(h.begins_at),
            y: +h.close_price,
            open: +h.open_price,
            close: +h.close_price,
            high: +h.high_price,
            low: +h.low_price,
            volume: +h.volume,
        }
    })
    let ts = data.historicals.map(obj => moment(obj.begins_at));
    let nums = data.historicals.map(obj => (+obj.open_price).toFixed(2));
    return {ts, nums, xy: arr};
}

function spanFormatter(span) {
    switch(span) {
        case 'day':
            return 'today';
        case 'week':
            return 'this week';
        case 'month':
            return 'this month';
        case '3month':
            return 'over the last 3 months';
        case 'year':
            return 'this past year';
        case '5year':
            return 'over the last 5 years';
        case 'all':
            return 'all time';
        default:
            return '';
    }
}

function twitterButtonPerSymbol(data) {
    let span = spanFormatter(data.span);
    let header = `$${data.symbol} ${(+data.percent >= 0) ? 'up' : 'down'} ${percentFormatter(+data.percent)} ${span}\n#RobinTwit`;
    let tweetUri = encodeURIComponent(`${header}`);
    let tweetUrl = `https://twitter.com/intent/tweet?text=${tweetUri}`
    return `
    <a  id="shareStandings"
        href="${tweetUrl}"
        target="_blank"
        title="Tweet">
        <i class="fab fa-twitter mainTwInd"></i>
    </a>
    `;
}

function setIndividualTotals(data) {
    let symbol = data.symbol, span = data.span, dollarGain = data.dollarGain, previousDay = data.previousDay;
    let percent = (dollarGain/previousDay * 100).toFixed(2);
    let latestPrice = (dollarGain + previousDay).toFixed(2).toNumberWithCommas();
    let $current = $(`.${symbol}`);
    let anchor = twitterButtonPerSymbol({percent, price: dollarGain, symbol, span});
    let expCol, hval;
    if($('#expandedChart').is(':visible')) {
        hval = 'h4';
        expCol = `
            <a class="collapseChart">
                <i class="fas fa-compress-arrows-alt mainTwInd" title="Collapse Chart"></i>
            </a>`;
    } else {
        hval = 'h6'
        expCol = `
            <a class="expandChart">
                <i class="fas fa-expand-arrows-alt mainTwInd" title="Expand Chart"></i>
            </a>`;
    }
    let downloadLink = '';
    // if($('#expandedChart').is(':visible')) {
    downloadLink = `
        <a class="downloadCharts" id="${symbol}DownloadLink" chart-id="${symbol}" href="#" download="${symbol}-${span}-graph.png" title="Download Chart">
            <i class="fa fa-download mainTwInd"></i>
        </a>`;
    // }
    $current.find('h6').remove();
    $current.find('h4').remove();
    let gainSp = ($('#expandedChart').is(':visible')) ? 
        `${(dollarGain > 0) ? '<i class="fas fa-arrow-up indicator"></i>' : '<i class="fas fa-arrow-down indicator"></i>'}
        <span id="${data.symbol}GainZoomed">$${Math.abs(dollarGain).toFixed(2)}</span>` 
        : '';
    $current.prepend(`
        <${hval} class="individualCharts">
            ${data.symbol}
            <span id="${data.symbol}Price">$${latestPrice}</span>
            ${anchor}
            ${downloadLink}
            ${expCol}
            <span style="float: right;">
                <strong>
                    ${gainSp}
                    <span id="${data.symbol}PercentZoomed">${(percent > 0) ? `+${percent}%` : `${percent}%`}</span>
                </strong>
            </span>
        </${hval}>
    `);
    // <${hval} class="individualCharts">
    //         ${(dollarGain > 0) ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-arrow-down"></i>'} 
    //         $${Math.abs(dollarGain).toFixed(2)}
    //         ${anchor}
    //         ${downloadLink}
    //         ${expCol}
    //         <span style="float: right;">${data.symbol}&nbsp;${(percent > 0) ? `+${percent}%` : `${percent}%`}</span>
    //     </${hval}>
}

async function getPopularityData(symbol, span) {
    let data;
    // let url = `http://robintrack.net/api/stocks/${symbol}/popularity_history`;
    let url = `https://luqvzyvnec.execute-api.us-east-1.amazonaws.com/dev/track/${symbol}`;
    let cached = JSON.parse(window.localStorage.getItem('popularityData'));
    if(cached && cached[symbol]) {
        data = cached[symbol].data;
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
            store[symbol] = {};
            store[symbol].data = data;
            store[symbol].created_on = moment();
            window.localStorage.setItem('popularityData', JSON.stringify(store));
        }
        return data;
    }
}

async function chartBySymbol(data, target) {
    let symbol = data.symbol;
    let $current = $(`.${target}`);
    let latestPrice = $current.parent().parent().prev().find('.price');
    if(latestPrice) latestPrice = +latestPrice.text().replace('$', '');
    else latestPrice = +data.historicals.pop().close_price;
    let formatted = formatIndividualChart(data);
    if(data.span === 'day') {
        formatted.xy.unshift({x: formatted.ts[0], y: +data.previous_close_price});
        formatted.nums.unshift(+data.previous_close_price);
    }
    let previousDay = +data.previous_close_price || formatted.nums[0];
    let dollarGain = latestPrice - previousDay;
    let span = data.span;
    let percent = (dollarGain/previousDay * 100).toFixed(2);
    let anchor = twitterButtonPerSymbol({percent, price: dollarGain, symbol: data.symbol, span});
    let expCol, hval;
    if($('#expandedChart').is(':visible')) {
        $('#chartLoader').show();
        hval = 'h4';
        expCol = `
            <a class="collapseChart">
                <i class="fas fa-compress-arrows-alt mainTwInd" title="Collapse Chart"></i>
            </a>`;
    } else {
        hval = 'h6'
        expCol = `
            <a class="expandChart">
                <i class="fas fa-expand-arrows-alt mainTwInd" title="Expand Chart"></i>
            </a>`;
    }
    let downloadLink = '';
    if($('#expandedChart').is(':visible')) {
        formatted.popularity = await getPopularityData(data.symbol);
        $('#chartLoader').hide();
        $(`.${data.symbol}`).fadeIn();
    }
    downloadLink = `
        <a class="downloadCharts" id="${symbol}DownloadLink" chart-id="${symbol}" download="${symbol}-${span}-graph.png" title="Download Chart">
            <i class="fa fa-download mainTwInd"></i>
        </a>`;
    $current.find('h6').remove();
    $current.find('h4').remove();
    latestPrice = latestPrice.toString().toNumberWithCommas();
    let gainSp = ($('#expandedChart').is(':visible')) ? 
        `${(dollarGain > 0) ? '<i class="fas fa-arrow-up indicator"></i>' : '<i class="fas fa-arrow-down indicator"></i>'}
        <span id="${data.symbol}Gain">$${Math.abs(dollarGain).toFixed(2)}</span>` 
        : '';    
    $current.prepend(`
        <${hval} class="individualCharts">
            ${data.symbol}
            <span id="${data.symbol}Price">$${latestPrice}</span>
            ${anchor}
            ${downloadLink}
            ${expCol}
            <span style="float: right;">
                <strong>
                    ${gainSp}
                    <span id="${data.symbol}Percent">${(percent > 0) ? `+${percent}%` : `${percent}%`}</span>
                </strong>
            </span>
        </${hval}>
    `);
    // ${Math.abs(dollarGain).toFixed(2)}
    // ${(dollarGain > 0) ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-arrow-down"></i>'}
    addSpanButtons(target, span);
    let orderDataset = await orderData(data);
    if(orderDataset.length > 0) formatted.orders = orderDataset;
    linearStockChart(formatted, target, true, span);
}

function addSpanButtons(symbol, span) {
    let $current = $(`.${symbol}`);
    $current.find('.spanners').remove();
    $current.append(`
        <div class="container text-center spanners">
            <div class="row">
                <div class="col" id="day">D</div>
                <div class="col" id="week">W</div>
                <div class="col" id="month">M</div>
                <div class="col" id="3month">3M</div>
                <div class="col" id="year">Y</div>
                <div class="col" id="5year">5Y</div>
            </div>
        </div>
    `);
    let lightThemeColor = (COLORTHEME === 'light') ? 'var(--robin-color-1)' : 'grey';
    $current.find(`#${span}`).css({'color': 'white', 'background-color': 'var(--robin-color-1)'});
}

function addSpanButtonsToMain(span) {
    let $current = $(`#chartContainer`);
    $current.find('.mainSpanners').remove();
    $current.append(`
        <div class="container text-center mainSpanners">
            <div class="row">
                <div class="col" id="day">D</div>
                <div class="col" id="week">W</div>
                <div class="col" id="month">M</div>
                <div class="col" id="3month">3M</div>
                <div class="col" id="year">Y</div>
                <div class="col" id="all">All</div>
            </div>
        </div>
    `);
    let lightThemeColor = (COLORTHEME === 'light') ? 'var(--robin-color-1)' : 'grey';
    $current.find(`#${span}`).css({'color': 'white', 'background-color': 'var(--robin-color-1)'});
}

function orderMap(arr, order, watchlist, symbol) {
    let validSymbol;
    let ts = order.created_at;
    let buy = (order.side === 'buy');
    let found = watchlist.find(s => s.instrument === order.instrument);
    if(found) validSymbol = found.symbol;
    let price = order.average_price;
    let quantity = order.quantity;
    if( (symbol && symbol === validSymbol) || !symbol ) {
        arr.push({ts, buy, symbol: validSymbol, price, quantity});
    }
    return arr;
}

function optionOrderMap(arr, order, watchlist, symbol) {
    let validSymbol;
    if(order.legs[0].executions.length > 0) {
        let type = order.opening_strategy || order.closing_strategy;
        type = type.match(/call|put/gi)[0];
        let ts = order.created_at;
        let buy = (order.legs[0].side === 'buy');
        let found = watchlist.find(s => s.symbol === order.chain_symbol);
        if(found) validSymbol = found.symbol;
        let price = order.price;
        let quantity = order.processed_quantity;
        if( (symbol && symbol === validSymbol) || !symbol ) {
            arr.push({type, ts, buy, symbol: validSymbol, price, quantity});
        }
    }
    return arr;
}

async function getOrders(symbol) {
    let orders = await new Promise(resolve => {
        chrome.storage.local.get(['orderHistory'], obj => {
            let orders = obj.orderHistory;
            resolve(orders);
        })
    })
    let watchlist = await getWatchlist();
    let objArr = orders.reduce( (arr, o) => orderMap(arr, o, watchlist, symbol), []);
    let options = await getOptionOrders(symbol);
    let allOrders = objArr.concat(options);
    return allOrders;
}

async function getOptionOrders(symbol) {
    let orders = await new Promise(resolve => {
        chrome.storage.local.get(['optionOrderHistory'], obj => {
            let orders = obj.optionOrderHistory;
            resolve(orders);
        })
    })
    let watchlist = await getWatchlist();
    let objArr = orders.reduce( (arr, o) => optionOrderMap(arr, o, watchlist, symbol), []);
    return objArr;
}

function formatOrders(orders, historicals) {
    let histList, close_price;
    if(historicals.equity_historicals) {
        histList = historicals.equity_historicals;
        close_price = 'adjusted_close_equity';
    } else {
        histList = historicals.historicals;
        close_price = 'close_price';
    }
    let start = moment(histList[0].begins_at);
    let end = moment(histList[histList.length - 1].begins_at);
    let formatted = orders.map(o => {
        let ts = moment(o.ts);
        let TS;
        if(historicals.span === 'day') {
            let remainder = 5 - (ts.minute() % 5);
            TS = moment(ts).add(remainder, "minutes");
        } else TS = moment(ts);
        if(TS.isBetween(start, end)) {
            let smallestDiffObj = {diff: Infinity};
            histList.forEach(eq => {
                let t = moment(eq.begins_at);
                let diff = Math.abs(TS.diff(t));
                if(diff < smallestDiffObj.diff) {
                    eq.diff = diff;
                    smallestDiffObj = eq;
                }
            });
            o.x = moment(smallestDiffObj.begins_at);
            o.y = (+smallestDiffObj[close_price]).toFixed(2);
            o.r = 5;
        }
        return o;
    });
    return formatted;
}

async function orderData(historicals) {
    let orders = await getOrders(historicals.symbol);
    let formatted = formatOrders(orders, historicals);
    return formatted.filter(f => (f.x && f.y))
}

function chartPortfolioHistoricals(historicals) {
    if($('#chartContainer').is(":visible") || $('#expandedChart').is(':visible')) {
        chrome.storage.local.get(['realtimeTotals'], async obj => {
            // historicals.previousCloseAmount = obj.realtimeTotals.previous_close.amount;
            if(obj.realtimeTotals) {
                let orderDataset = await orderData(historicals);
                if(orderDataset.length > 0) historicals.orders = orderDataset;
                historicals.realtimeTotal = obj.realtimeTotals.total_equity.amount;
                linearStockChart(historicals, 'myChart', false, historicals.span);
                addSpanButtonsToMain(historicals.span);
            } else {
                setTimeout(() => {
                    chartPortfolioHistoricals(historicals);
                }, 500);
            }
        });
    }
}

function getOwnedStocks(obj) {
    let ownedStocks = obj.portfolioValues;
    if(ownedStocks.length > 0) {
        let $table = $('#portfolioTable'); 
        let [data] = formatWatchlistTable(ownedStocks);
        data.sort((a,b) => +b.percent - +a.percent);
        // $('#shareStandings').attr('href', `${uri}`);
        if(data.length > 7) $table.attr('data-height', '500');
        if(data.length === 0) return;
        getPopularityData(data[0].symbol);
        chrome.storage.sync.set({currentUrl: `https://robinhood.com/stocks/${data[0].symbol}`});
        $table.bootstrapTable('destroy');
        $table.bootstrapTable({
            data,
            onExpandRow: onExpandRowMain
        });
        setTableTheme();
    } else {
        $('#portfolioContainer').remove();
    }
}

function loadTable(type, data) {
    switch (type) {
        case 'watchlist':
            getWatchlistValues(data);
            break;
        case 'portfolio':
            getOwnedStocks(data);
            break;
        case 'crypto':
            cryptoTable(data);
            break;
        case 'options':
            optionTable(data);
            break;
    }
}

function cryptoTable(crypto) {
    if(crypto.length > 0) {
        let $table = $('#cryptoTable');
        let [data] = formatWatchlistTable(crypto);
        data.sort((a,b) => +b.percent - +a.percent);
        // $('#shareStandings').attr('href', `${uri}`);
        $table.bootstrapTable('destroy');
        $table.bootstrapTable({
            data, 
            onExpandRow: onExpandRowMain
        });
        setTableTheme();
    } else {
        $('#cryptoContainer').remove();
    }
}

function optionTable(options) {
    if(options.length > 0) {
        let $table = $('#optionsTable');
        let [data] = formatOptionsTable(options);
        data.sort((a,b) => +b.percent - +a.percent);
        // $('#shareStandings').attr('href', `${uri}`);
        $table.bootstrapTable('destroy');
        $table.bootstrapTable({
            data, 
            onExpandRow: onExpandRowMain
        });
        setTableTheme();
    } else {
        $('#optionsContainer').remove();
    }
}

function handleHttpFail(errCode) {
    switch (errCode) {
        case 401:
            // ANALYTICS
            ga('send', 'exception', {
                'exDescription': 'Unauthorized',
                'exFatal': false
            });
            // END
            $('#popupBody').empty();
            $('#popupBody').append(`
                <div class="container error">
                    <a href="https://robinhood.com/login" target="_blank">Please log in to continue</a>
                </div>
            `);
            break;
        case 400:
            // ANALYTICS
            ga('send', 'exception', {
                'exDescription': 'RobinhoodRequestFailed',
                'exFatal': true
            });
            // END
            $('#popupBody').empty();
            $('#popupBody').append(`
                <div class="container error">
                    We are having trouble reaching Robinhood! Please try again!
                </div>
            `);
            break;
    }
}

async function getSymbolFromInst(instrument) {
    return new Promise( resolve => {
        chrome.storage.local.get(['watchlistValues'], obj => {
            let watchlist = obj.watchlistValues;
            found = watchlist.find(s => s.instrument === instrument);
            if(found) resolve(found.symbol);
        })
    })
}


async function getWatchlist() {
    return new Promise( resolve => {
        chrome.storage.local.get(['watchlistValues'], (obj) => {
            let watchlist = obj.watchlistValues;
            resolve(watchlist);
        })
    })
}

function formatChartData(data) {
    let xy = data.equity_historicals.map(obj => {
        return {
            x: moment(obj.begins_at),
            y: (+obj.adjusted_close_equity).toFixed(2)
        }
    });
    let ts = data.equity_historicals.map(obj => moment(obj.begins_at));
    let nums = data.equity_historicals.map(obj => (+obj.adjusted_close_equity).toFixed(2));
    // add values from previous day
    if(data.span === 'day') {
        for(let i = 0; i < 10; i++) {
            let ogSpan = moment(data.open_time).subtract(5*(i+1), 'minutes');
            nums.unshift((+data.previous_close_equity).toFixed(2));
            ts.unshift(ogSpan);
            xy.unshift({x: ogSpan, y: (+data.previous_close_equity).toFixed(2)});
            if(i > 7) {
                nums.push((+data.realtimeTotal).toFixed(2));
                ts.push(moment());
                xy.push({x: moment(), y: (+data.realtimeTotal).toFixed(2)});
            }
        }
    } else {
        for(let i = 0; i < 3; i++) {
            nums.push(data.realtimeTotal);
            ts.push(moment().add(i));
            xy.push({x: moment(), y: data.realtimeTotal});
        }
    }
    let previousCloseAmount = (data.span === 'day') ? data.adjusted_previous_close_equity : data.equity_historicals[0].adjusted_open_equity;
    let realtimeTotal = data.realtimeTotal;
    setTotals({previousCloseAmount, realtimeTotal, span: data.span});
    return {ts, nums, xy};
}

/**
 * data {object} {previousCloseAmount: number, realtimeTotal: number, span: string, }
 */

let prev_total = 0;
function setTotals(data, realtime) {
    let $cont = $('#totals');
    let previousDay = +data.previousCloseAmount;
    let last = +data.realtimeTotal;
    let gl = last - previousDay;
    let isUp = (gl > 0);
    let color = (gl > prev_total) ? THEMECOLORS.upPrimary : (gl < prev_total) ? THEMECOLORS.downPrimary : '';
    let icolor = (gl > 0) ? THEMECOLORS.upPrimary : (gl < 0) ? THEMECOLORS.downPrimary : '';
    if(data.span !== 'day' || !realtime) color = icolor;
    let plmin =  (($('#myChart').is(":visible"))) ? 'minus' : 'plus';
    prev_total = gl;
    let $currentHref = $('#shareStandings');
    let tweetUri, twPercent = percentFormatter(+((gl/previousDay * 100).toFixed(2)));
    if(data.span !== 'day') {
        tweetUri = encodeURIComponent(`Portfolio ${isUp ? 'up' : 'down'} ${twPercent} ${spanFormatter(data.span)}\n\n#RobinTwit`);
    } else {
        tweetUri = encodeURIComponent(`Current ${data.span} ${(isUp) ? 'gain' : 'loss'}: ${twPercent}\n\n\n#RobinTwit`);
    }
    let tweetUrl;
    if($currentHref.length > 0) {
        tweetUrl = $currentHref.attr('href').replace(/(?<=text\=)C.*\%25\)/gi, tweetUri); // (?=%0D%0AHold)
    }
    else tweetUrl = `https://twitter.com/intent/tweet?text=${tweetUri}`; // ${(data.span === 'day') ? '%0D%0AHolding:' : ''}
    // set display data
    let displayData = {
        total: last.toFixed(2).toNumberWithCommas(), // 94543
        spanGain: Math.abs(gl).toFixed(2).toNumberWithCommas(), // '1234'
        spanGainPercent: Math.abs(gl/previousDay * 100).toFixed(2).toNumberWithCommas() // '13.05'
    };
    let expander;
    if(!$('#expandedChart').is(':visible')) {
        expander = `
            <a class="expandPortfolioChart">
                <i class="fas fa-expand-arrows-alt mainTw" title="Expand Chart"></i>
            </a>`;
    } else {
        expander = `
            <a class="collapseChart">
                <i class="fas fa-compress-arrows-alt mainTw" title="Collapse Chart"></i>
            </a>`;
    }
    $cont.empty().prepend(`
        <h4 id="totalEq" class="animated">
            $${displayData.total}
            <a id="robinlink" title="See on Robinhood" target="_blank" href="https://robinhood.com/">
                <i class="fas fa-feather"></i>
            </a>
            <a  id="shareStandings"
                    href="${tweetUrl}"
                    target="_blank"
                    title="Tweet">
                    <i class="fab fa-twitter mainTw"></i>
            </a>
            ${expander}
            <span id="hideChart">
                <i class="fas fa-${plmin}-circle"></i>
            </span>
        </h4>
        <h6 id="totalDay" class="animated pulse">
            ${(gl > 0) ? '<i class="fas fa-arrow-up"></i>' : (gl < 0) ? '<i class="fas fa-arrow-down"></i>' : ''} 
            <span id="eq">$${displayData.spanGain}&nbsp;(${displayData.spanGainPercent}%)</span>
        </h6>
    `);
    $('#totalDay').find('.fas').css({color: icolor});
    $('#eq').css({color});
    setTimeout( () => {
        $('#eq').css({color: ''});
    }, 1000);
}

function updatePortfolioChart(updateData) {
    if(PORTCHART && ($('#chartContainer').is(":visible"))) {
        setTotals({
            span: 'day',
            previousCloseAmount: updateData.previous_close.amount, 
            realtimeTotal: updateData.total_equity.amount
        }, true);
        if(($('#myChart').is(":visible"))) {
            PORTCHART.data.datasets[0].data.push(updateData.total_equity.amount);
            PORTCHART.data.labels.push(moment());
            PORTCHART.update();
        }
    }
}

function createDownloadableChart(data, chartId, span) {
    if($('#expandedChart').is(':visible')) {
        linearStockChart(data, chartId, true, span, true);
    }
}

function formatSpan(span) {
    switch (span) {
        case 'day':
            return moment().format('MM/DD/YYYY');
        case 'week':
            return 'Past Week';
        case 'month':
            return 'Past Month';
        case '3month':
            return 'Past 3 Months';
        case 'year':
            return 'Past Year';
        case '5year':
            return 'Past 5 Years';
    }
}

function getChartPlugins(color, data, zoom, chartInfo) {
   return {
        zoom: {
            pan: {enabled: false, mode: 'x', speed: 20, threshold: 10},
            zoom: {enabled: !zoom, mode: 'x', speed: .1, threshold: 2, sensitivity: 3}
        },
        crosshair: {
            line: {color},
            zoom: {enabled: !zoom, zoomButtonClass: 'zoom-reset'},
            snap: {enabled: true},
            sync: {
                enabled: false
            },
            callbacks: {
                beforeZoom: function(start, end) {   
                    return true;
                },
                afterZoom: function(start, end) {   
                    let a = moment(start);
                    let b = moment(end); 
                    // let begin = data;
                    // console.log(data);
                    // console.log(data.xy);
                    let firstgroup = data.xy.filter(el => {
                        let m = moment(el.x);
                        if(m && m.isSameOrBefore(a, 'minute')) {
                            return el;
                        } // else console.log(m, a);
                    });
                    let sortedFirst = firstgroup.sort((a, b) => a.valueOf() - b.valueOf());
                    let lastgroup = data.xy.filter(el => {
                        let m = moment(el.x);
                        if(m && m.isSameOrAfter(b, 'minute')) {
                            return el;
                        }
                    });
                    let sortedLast = lastgroup.sort((a, b) => a.valueOf() - b.valueOf());
                    let diff = +sortedLast[0].y - +sortedFirst.pop().y;
                    if(chartInfo.portfolio) {
                        setTotals({previousCloseAmount: +sortedFirst.pop().y, realtimeTotal: +sortedLast[0].y});
                    } else {
                        let symbol = chartInfo.symbol, span = chartInfo.span, dollarGain = diff, previousDay = +sortedFirst.pop().y;
                        setIndividualTotals({symbol, span, dollarGain, previousDay});
                    }
                }
              }
        }
    }
}

function getTitle(data, symbol, span) {
    span = formatSpan(span);
    let $current = $(`.${symbol}`);
    let latestPrice = $current.parent().parent().prev().find('.price');
    if(latestPrice) latestPrice = +latestPrice.text().replace('$', '');
    else latestPrice = +data.nums.pop();
    let lastClose = +data.nums[0];
    let priceDiff = latestPrice - lastClose;
    let percent = (priceDiff/lastClose * 100).toFixed(2);
    let sign = percent > 0 ? '+' : '';
    return [ `${symbol.toUpperCase()} ${span}`, `${sign}${percent}% ${sign}${priceDiff.toFixed(2)}`, `Current Price: $${latestPrice}`];
}

function getChartOptions(data, chartId, download, span, title, color, individual) {
    let options;
    let expanded = $('#expandedChart').is(':visible');
    let legendDisplay =  expanded;
    let plugins = (!download) ? getChartPlugins(color, data, !expanded, {symbol: chartId, span, portfolio: !individual}) : {};
    let tsFormatter = (span === 'day') ? 'h:mm A' : (['month', 'week', '3month'].includes(span)) ? 'MMM D h:mm A' : 'MMM D YYYY';
    let tooltipPadding = individual ? 5 : 10;
    let tooltipFontsize = individual ? 12 : 14;
    options = {
        plugins,
        title: {
            display: download,
            text: title
        },
        elements: {
            line: {
                tension: 0
            }
        },
        animation : {
            duration: 500,
        },
        tooltips: {
            mode: 'interpolate', // 'interpolate',// 'nearest',
            displayColors: expanded,
            titleFontSize: tooltipFontsize,
            bodyFontSize: tooltipFontsize,
            intersect: false,
            backgroundColor: 'rgba(27, 27, 29, 0.45)', // 'rgba(0,200,5,0.3)',
            bodyFontColor: 'white',
            titleFontColor: 'white',
            titleFontStyle: 'normal',
            cornerRadius: 1,
            position: 'nearest',
            xPadding: tooltipPadding,
            yPadding: tooltipPadding,
            // custom: function (tooltipModel) {
            //     chartFormatter.getCustomTooltip(this, tooltipModel);
            // },
            callbacks: {
                label: function(tooltipItem, data) {
                    // console.log('LABEL', tooltipItem, data);
                    // format: May/Mar 20, 2020, 9:40:00 am
                    // format: MMM D YYYY h:m:ss A
                    //  || (data.datasets.length === 2 && tooltipItem.datasetIndex !== 0) 
                    if(data.datasets.length > 1 && tooltipItem.datasetIndex === 0 && data.datasets[0].data[tooltipItem.index].symbol) {
                        let symbol = data.datasets[0].data[tooltipItem.index].symbol;
                        let tradeType = data.datasets[0].data[tooltipItem.index].type;
                        let orderType = data.datasets[0].data[tooltipItem.index].buy;
                        let price = (+data.datasets[0].data[tooltipItem.index].price).toFixed(2).toNumberWithCommas();
                        let quantity = (+data.datasets[0].data[tooltipItem.index].quantity).toFixed(2).toNumberWithCommas();
                        if(tradeType) {
                            return `${symbol} ${orderType ? 'buy' : 'sell'} ${quantity} ${tradeType.toUpperCase()} at $${price}`;
                        } else {
                            return `${symbol} ${orderType ? 'buy' : 'sell'} ${quantity} shares at $${price}`;
                        }
                    } else {
                        let index = tooltipItem.datasetIndex;
                        if(individual) {
                            if(expanded && !data.datasets[index].data[tooltipItem.index].barVolume && data.datasets[index].data[tooltipItem.index].open) {
                                let volume = data.datasets[index].data[tooltipItem.index].volume;
                                // let high = data.datasets[index].data[tooltipItem.index].high.toFixed(2);
                                // let low = data.datasets[index].data[tooltipItem.index].low.toFixed(2);
                                let open = data.datasets[index].data[tooltipItem.index].open//.toFixed(2);
                                let close = data.datasets[index].data[tooltipItem.index].close//.toFixed(2);
                                let percent = (close/open*100 - 100).toFixed(2);
                                let change = `Change: ${percent > 0 ? '+' : ''}${percent}%`;
                                // return change;
                                // return [change, `Open: ${open}`, `Close: ${close}`, `High: ${high}`, `Low: ${low}`, `Volume: ${volume}`].join(', ');
                            } else if(individual && data.datasets[index].data[tooltipItem.index].barVolume) {
                                let volume = data.datasets[index].data[tooltipItem.index].barVolume;
                                // return `Volume: ${volume.toString().toNumberWithCommas()}`;
                            }
                        }
                    }
                },
                title: function(tooltipItem, chartData) {
                    let first = data.nums[0]; // data.datasets[tooltipItem[0].datasetIndex].data[0].y;
                    let gain = +tooltipItem[0].yLabel - first;
                    let percentChange = gain/first * 100;
                    let percentText = percentChange > 0 ? `+${percentChange.toFixed(2)}%` : `${percentChange.toFixed(2)}%`;
                    let total = (+tooltipItem[0].yLabel).toFixed(2).toNumberWithCommas(); // for display: individual ? (+tooltipItem[0].yLabel).toFixed(2) : '74543';
                    let ts = moment(tooltipItem[0].xLabel, 'MMM D YYYY h:mm:ss A').format(tsFormatter);
                    let color = gain > 0 ? THEMECOLORS.upPrimary : THEMECOLORS.downPrimary;
                    $('html').get(0).style.setProperty('--individual-charts-header-color', color);
                    $(`#${chartId}Price`).text(`$${total}`);
                    if(expanded) {
                        $(`#${chartId}Gain`).text(`$${Math.abs(gain).toFixed(2)}`);
                        let arrow = `${(gain > 0) ? '<i class="fas fa-arrow-up indicator"></i>' : '<i class="fas fa-arrow-down indicator"></i>'}`;
                        $('.indicator').replaceWith(arrow);
                    }
                    $(`#${chartId}Percent`).text(percentText);
                    let title = individual ? `${ts}` : `$${total} ${ts}`; // $${total} 
                    return title;
                },
                labelColor: function(tooltipItem, chart) {
                    let borderColor = 'black', backgroundColor = 'white';
                    let index = tooltipItem.datasetIndex;
                    if(expanded) {
                        if(chart.config.data.datasets.length > 1 && tooltipItem.datasetIndex === 0 && chart.config.data.datasets[index].data[tooltipItem.index].quantity) {
                            backgroundColor = chart.config.data.datasets[index].data[tooltipItem.index].buy ? THEMECOLORS.upLight : THEMECOLORS.downLight;
                            borderColor = chart.config.data.datasets[index].data[tooltipItem.index].buy ? THEMECOLORS.upPrimary : THEMECOLORS.downPrimary;
                        } else if(individual) {
                            if(!chart.config.data.datasets[index].data[tooltipItem.index].barVolume && chart.config.data.datasets[index].data[tooltipItem.index].open) {
                                let open = chart.config.data.datasets[index].data[tooltipItem.index].open;
                                let close = chart.config.data.datasets[index].data[tooltipItem.index].close;
                                backgroundColor = (close > open) ? THEMECOLORS.upPrimary : THEMECOLORS.downPrimary;
                                borderColor = backgroundColor;
                            } else if(chart.config.data.datasets[index].data[tooltipItem.index].barVolume) {
                                let open = chart.config.data.datasets[index].data[tooltipItem.index].open;
                                let close = chart.config.data.datasets[index].data[tooltipItem.index].close;
                                backgroundColor = (close > open) ? THEMECOLORS.upPrimary : THEMECOLORS.downPrimary;
                                borderColor = backgroundColor;
                            }
                        }
                    }
                    return {borderColor, backgroundColor};
                },
            }
        },
        legend: {
            display: legendDisplay,
            labels: {
                usePointStyle: true
            }
        },
        hover: {
            intersect: false,
            // mode: 'index',
            // animationDuration: 1000
        },
        scales: {
            yAxes: [
                {
                    id: 'value',
                    type: 'linear',
                    gridLines: {
                        display: expanded
                    },
                    ticks: {
                        fontSize: 10,
                        suggestedMin: data.nums[0],
                        callback: function(label, index, labels) {
                            return `$${label.toFixed(2)}`;
                        },
                        display: expanded
                    }
                },
                {
                    id: 'popularity',
                    display: false,
                    // type: 'linear',
                }
            ],
            xAxes: [
                {
                    type: 'time',
                    distribution: 'series',
                    gridLines: {
                        display: expanded
                    },
                    ticks: {
                        fontSize: 10,
                        autoSkip: true,
                        maxTicksLimit: 20,
                        callback: function(label, index, labels) {
                            return moment(labels[index].value).format(tsFormatter);
                        },
                        display: expanded
                    }
                }
            ]
        }
    }
    return options;
}

function linearStockChart(portfolioData, chartId, individual, span = 'day', download = false) {
    let data, title;
    if(!individual) {
        if(PORTCHART) PORTCHART.destroy();
        data = formatChartData(portfolioData);
        data.orders = portfolioData.orders;
    } else {
        if(!download && SYMBCHART[chartId]) SYMBCHART[chartId].destroy();
        data = portfolioData;
    }
    let ctx = document.getElementById(chartId);
    let isUp = (+data.nums[data.nums.length - 1] > +data.nums[0]);
    let nums = [...data.nums]; // (data.nums.length > data.ts.length) data.nums.shift();
    let ts = [...data.ts];
    if(nums.length > ts.length) nums.shift();
    if(!download) setGainTheme(isUp);
    let style = getComputedStyle(document.body);
    let fillColor = style.getPropertyValue('--robin-color-light');
    let lineColor = style.getPropertyValue('--robin-color-1');
    // get chart options   
    let options = getChartOptions(data, chartId, download, span, title, lineColor, individual);
    let dataLabel = (individual) ? chartId : 'Portfolio Value';
    let datasets = [{ 
        yAxisID: 'value',
        label: dataLabel,
        data: data.xy, // nums,
        lineTension: 0,
        borderColor: lineColor,
        backgroundColor: fillColor,
        pointRadius: 0,
        pointHoverRadius: 3,
        borderWidth: 1.75
    }];
    let expanded = $('#expandedChart').is(':visible');
    if(!download && individual) {
        let max = Math.max(...data.nums);
        let min = Math.min(...data.nums);
        let priceRange = (max - min) * .5;
        let vols = data.xy.map(v => v.volume);
        if(!vols[0]) vols.shift();
        let volRange = Math.max(...vols) - Math.min(...vols);
        let unit = volRange/priceRange;
        // get vol bar heights
        let volBars = data.xy.map(d => {
            let relativeVolume = d.volume/unit + (min * .9999) - (min * .01) // d.volume === 0 ? 0 : d.volume/unit + (min * .99) //(min * .25);
            return { x: d.x, y: relativeVolume, barVolume: d.volume, open: d.open, close: d.close };
        });
        datasets.push({
            // yAxisID: 'volume',
            label: 'Volume',
            type: 'bar',
            // hidden: expanded,
            data: volBars,
            backgroundColor: function(context) {
                let index = context.dataIndex;
                let value = context.dataset.data[index];
                return (value.open > value.close) ? THEMECOLORS.downPrimary : THEMECOLORS.upPrimary;
            },
            borderSkipped: false,
            barThickness: 'flex'
        });
        if(expanded) {
            let popData = [];
            let dts1 = moment(data.ts[0]);
            let dts2 = moment(data.ts[data.ts.length - 1]);
            if(data.popularity.length > 0) {
                data.popularity.forEach(p => {
                    let pts = moment(p.timestamp).startOf('hour');
                    let found = data.ts.find(m => m.isSame(pts));
                    if(pts.isBetween(dts1, dts2) && found) {
                        popData.push({x: pts, y: p.popularity});
                    }
                });
                // console.log(popData.length, data.popularity.length);
                datasets.push({
                    yAxisID: 'popularity',
                    label: '# RH Users Holding',
                    type: 'scatter',
                    borderColor: 'green',
                    backgroundColor: 'transparent',
                    lineTension: 0,
                    pointRadius: .5,
                    showLine: true,
                    pointHoverRadius: 1,
                    borderWidth: 1.75,
                    // hidden: true,
                    data: popData
                });
            }
        }
    }

    if( (data.orders && data.orders.length > 0) && ( (expanded || !individual) || individual )) {
        let radius = expanded ? 7 : 5;
        // let avg = nums.reduce((x,y) => +x + +y)/nums.length; 
        let orderData = data.orders.map(o => {
            let index = ts.findIndex(t => t.isSame(o.x)); // (avg/75)
            return Object.assign(o, {x: ts[index], y: +nums[index], r: radius}) //{x: ts[index], y: nums[index], r: o.r}
        });
        let dimensions = 18;
        let bullImg = new Image();
        bullImg.src = chrome.extension.getURL('../../assets/bull.png');
        bullImg.width = dimensions;
        bullImg.height = dimensions;
        let bearImg = new Image();
        bearImg.src = chrome.extension.getURL('../../assets/bear.png');
        bearImg.width = dimensions;
        bearImg.height = dimensions;
        orderData.reverse();
        datasets.unshift({
            label: 'Trades',
            type: 'bubble',
            pointStyle: function(context) {
                let index = context.dataIndex;
                let value = context.dataset.data[index];
                return (value && value.buy && value.type !== 'put') ? bullImg : bearImg;
            },
            // hidden: !expanded,
            data: orderData,
            borderColor: 'black',
            borderWidth: 2,
            backgroundColor: function(context) {
                let index = context.dataIndex;
                let value = context.dataset.data[index];
                return (value && value.buy) ? THEMECOLORS.downPrimary : THEMECOLORS.upPrimary;
            }
        });
    }
    CHART = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ts,
            datasets: datasets,
        },
        options
    });
    if(!download) {
        if(!individual) {
            CHART.render();
            PORTCHART = CHART;
        } else {
            CHART.render();
            SYMBCHART[chartId] = CHART;
        }
    }
}

$('document').ready( function() {
    // GET INSIDER TRADING curl https://chartexe.com/data/json/mu.json

    // ANALYTICS
    ga('send', 'pageview', '/popup/portfolio');
    // END

    let liveUpdates;
    if(liveUpdates) clearInterval(liveUpdates);
    liveUpdates = setInterval(() => {
        if(!$('#expandedChart').is(':visible')) {
            chrome.runtime.sendMessage({cmd: 'getRealTimeTotals'});
        } else {
            clearInterval(liveUpdates);
        }
    }, 5000);

    chrome.runtime.sendMessage({cmd: 'updateStockValues'});
    
    $('#tweetContainer').hide();

    $('#portfolio').click( function() {
        // ANALYTICS
        ga('send', 'pageview', '/popup/portfolio');
        // END
        chrome.runtime.sendMessage({cmd: 'updateStockValues'});
        $('#shareStandings').remove();
        $('#tweetContainer').hide();
        $('#watchlistContainer').hide();
        $('#portfolioContainer').find('#portfolioTable').fadeOut();
        $('.portfolio').addClass('fadeInLeft').show();
    });

    $('#watchlist').click( function() {
        // ANALYTICS
        ga('send', 'pageview', '/popup/watchlist');
        // END
        chrome.runtime.sendMessage({cmd: 'updateStockValues'});
        $('#shareStandings').remove();
        $('#tweetContainer').hide();
        $('.portfolio').hide();
        $('#watchlistContainer').find('#watchlistTable').fadeOut();
        $('#watchlistContainer').addClass('fadeInLeft').show();
        $('#refresh').show();
    });

    $('#twitFeed').click( function() {
        // ANALYTICS
        ga('send', 'pageview', '/popup/tweets');
        // END
        $('#shareStandings').remove();
        $('.portfolio').hide();
        $('.tables').hide();
        $('#tweetContainer').fadeIn();
    });

    $('#twitterWindow').click( function() {
        let paramsT = `toolbar=no,menubar=no,width=450,height=700,left=50,top=50`;
        let symbol = 'PLAN'
        window.open(`https://www.twitter.com/search?q=%24${symbol}&src=typed_query&f=live`, 'Twitter',  paramsT);
    });

    $('body').on('click', '#refresh', function() {
        $('#shareStandings').remove();
        $('#portfolioTable').fadeOut();
        $('#watchlistTable').fadeOut();
        chrome.runtime.sendMessage({cmd: 'updateStockValues'});
    });

    $('body').on('click', '.spanners .col', function() {
        let lightThemeColor = (COLORTHEME === 'light') ? 'var(--robin-color-1)' : 'grey';
        let $current = $(this);
        $current.parent().find('.col').css({'color': '', 'background-color': ''});
        $current.css({'color': 'white', 'background-color': 'var(--robin-color-1)'});
        let symbol = $current.parent().parent().parent().attr('class');
        let span = $current.attr('id');
        chrome.runtime.sendMessage({cmd: 'getHistoricalsBySymbol', symbol, span});
    });

    $('body').on('click', '.mainSpanners .col', function() {
        $('#shareStandings').remove();
        let lightThemeColor = (COLORTHEME === 'light') ? 'var(--robin-color-1)' : 'grey';
        let $current = $(this);
        $current.parent().find('.col').css({'color': '', 'background-color': ''});
        $current.css({'color': 'white', 'background-color': 'var(--robin-color-1)'});
        let span = $current.attr('id');
        if(span !== 'day' || $('#expandedChart').is(':visible')) clearInterval(liveUpdates);
        else {
            clearInterval(liveUpdates);
            liveUpdates = setInterval(() => {
                if(!$('#expandedChart').is(':visible')) {
                    chrome.runtime.sendMessage({cmd: 'getRealTimeTotals'});
                } else {
                    clearInterval(liveUpdates);
                }
            }, 5000);
        }
        chrome.runtime.sendMessage({cmd: 'getPortfolioHistoricals', span});
    });

    $('body').on('click', '#hideChart', function() {
        toggleMainChart();
    });

    $('body').on('click', '.hideTable', function() {
        toggleTable($(this));
    });

    $('body').on('click', '.header-btns', function() {
        $('.highlightButton').removeClass('highlightButton');
        $(this).addClass('highlightButton');
    });

    $('body').on('click', '.expandChart', function() {
        // ANALYTICS
        ga('send', 'pageview', '/popup/expandedIndividual');
        // END
        let symbol = $(this).parent().parent().attr('class');
        let span = '3month';
        let $current = $('body').find(`.${symbol}`);
        let $cloned = $current.clone();
        $('#popupBody').hide();
        $('#theme').hide();
        $('#buttonHeader').hide();
        $cloned.width(750) //.height(350);
        $('#expandedChart').show();
        $('#expandedChart').append($cloned);
        $cloned.find('.expandChart').replaceWith(`
            <a class="collapseChart">
                <i class="fas fa-compress-arrows-alt mainTw" title="Collapse Chart"></i>
            </a>
        `);
        $cloned.hide();
        // trigger chart construction
        chrome.runtime.sendMessage({cmd: 'getHistoricalsBySymbol', symbol, span});
    });

    $('body').on('click', '.expandPortfolioChart', function() {
        // ANALYTICS
        ga('send', 'pageview', '/popup/expandedPortfolio');
        // END
        clearInterval(liveUpdates);
        let span = '3month';
        let $current = $('body').find('#chartContainer');
        let $cloned = $current.clone();
        $cloned.removeClass('fadeInLeft');
        $cloned.removeClass('container');
        $('#popupBody').hide();
        $('#theme').hide();
        $('#buttonHeader').hide();
        $cloned.width(750); //.height(600);
        $('#expandedChart').empty().show();
        $('#expandedChart').append($cloned);
        $cloned.find('.expandPortfolioChart').replaceWith(`
            <a class="collapseChart">
                <i class="fas fa-compress-arrows-alt mainTw" title="Collapse Chart"></i>
            </a>
        `);
        // trigger chart construction
        chrome.runtime.sendMessage({cmd: 'getPortfolioHistoricals', span});
    });

    $('body').on('click', '.collapseChart', function() {
        $('#expandedChart').find('div:has(canvas)').remove();
        $('#expandedChart').hide();
        $('#popupBody').show();
        $('#theme').show();
        $('#buttonHeader').show();
        $('#shareStandings').remove();
        $('#portfolioTable').fadeOut();
        $('#watchlistTable').fadeOut();
        chrome.runtime.sendMessage({cmd: 'updateStockValues'});
    });

    $('body').on('click', '.downloadCharts', function(e) {
        // ANALYTICS
        ga('send', 'event', {
            'eventCategory': 'General',
            'eventAction': 'DownloadChart',
        });
        // END
        let symbol = $(this).attr('chart-id');
        let anchor = document.getElementById(`${symbol}DownloadLink`);
        let ctx = document.getElementById(symbol);
        let imgURL = ctx.toDataURL('image/png');
        anchor.href = imgURL;
        // console.log(imgURL);
        // e.originalEvent.currentTarget.href = imgURL;
    });

    $('body').on('click', '#themeToggle', function() {
        chrome.storage.sync.get(['theme'], obj => {
            let isDark = !(obj.theme === 'dark');
            setTheme(isDark);
            let title = isDark ? 'change to light-theme' : 'change to dark-theme'
            $('#themeToggle').find('i').replaceWith(`
                <i class="fa${isDark ? 'r' : 's'} fa-lightbulb px-3" aria-hidden="true" title="${title}"></i>
            `);
            if(isDark) {
                $('.tabletoolbar').find('.table').addClass('table-dark');
            } else {
                $('.tabletoolbar').find('.table').removeClass('table-dark');
            }
            let theme = isDark ? 'dark' : 'light';
            chrome.storage.sync.set({theme})
            // ANALYTICS
            ga('send', 'event', {
                'eventCategory': 'Customizations',
                'eventAction': `SetTheme-${theme}`,
            });
            // END
        });
    });

    $('.tables').each(function () {
        $(this).load(chrome.extension.getURL('../../html/popupPortfolioTable.html'), () => {

            chrome.storage.sync.get(['theme'], obj => {
                let isDark = (obj.theme === 'dark');
                setTheme(isDark);
                let title = isDark ? 'change to light-theme' : 'change to dark-theme'
                if($('.fa-lightbulb').length === 0) $('#footer').before(`
                    <span id="theme">
                        <button id="themeToggle" class="btn text-center">
                            <i class="fa${isDark ? 'r' : 's'} fa-lightbulb px-3" aria-hidden="true" title="${title}"></i>
                        </button>
                    </span>
                `);
            });

            if($(this).attr('id') === 'watchlistContainer') {
                // set watchlist table 
                $(this).find('.tableContainer').prepend(`
                    <h5 style="color: var(--time-based-font-color)" id="tableTitle">
                        <strong>Your Watchlist Items</strong>
                    </h5>
                `);
                $(this).find('table').attr('id', 'watchlistTable');
                $(this).find('table').attr('data-toolbar', '#watchlistToolbar');
                $(this).find('#toolbar').attr('id', 'watchlistToolbar');
                $(this).hide();
            } else if($(this).attr('id') === 'optionsContainer') {
                $(this).find('.tableContainer').prepend(`
                    <h5 class="hideTable" style="color: var(--time-based-font-color)">
                        <strong>Stock Options</strong>
                        <span><i class="fas fa-plus-circle"></i></span>
                    </h5>
                `);
                $(this).find('.tabletoolbar').hide();
                $(this).find('table').removeAttr('data-search');
                $(this).find('table').removeAttr('data-detail-view');
                $(this).find('table').removeAttr('data-detail-view-by-click');
                $(this).find('#refresh').remove();
                $(this).find('.symbols').attr('data-formatter', 'optionsSymbolFormatter');
                $(this).find('table').attr('id', 'optionsTable');
                $(this).find('table').attr('data-toolbar', '#optionsToolbar');
                $(this).find('#toolbar').attr('id', 'optionsToolbar');
            } else if($(this).attr('id') === 'cryptoContainer') {
                $(this).find('.tableContainer').prepend(`
                    <h5 class="hideTable" style="color: var(--time-based-font-color)">
                        <strong>Cryptocurrencies</strong>
                        <span><i class="fas fa-plus-circle"></i></span>
                    </h5>
                `);
                $(this).find('.tabletoolbar').hide();
                $(this).find('table').removeAttr('data-search');
                $(this).find('table').removeAttr('data-detail-view');
                $(this).find('table').removeAttr('data-detail-view-by-click');
                $(this).find('#refresh').remove();
                $(this).find('.symbols').attr('data-formatter', 'cryptoSymbolFormatter');
                $(this).find('table').attr('id', 'cryptoTable');
                $(this).find('table').attr('data-toolbar', '#cryptoToolbar');
                $(this).find('#toolbar').attr('id', 'cryptoToolbar');
            } else {
                $(this).find('#refresh').remove();
                $(this).find('table').removeAttr('data-search');
                $(this).find('.tableContainer').prepend(`
                    <br>
                    <h5 class="hideTable" style="color: var(--time-based-font-color)">
                        <strong>Stock Holdings</strong>
                        <span><i class="fas fa-minus-circle"></i></span>
                    </h5>
                `);
            }
            // show portfolio
            $('.portfolio').addClass('fadeInLeft').show();
        });
    });

    chrome.runtime.onMessage.addListener( async function(request, sender, sendResponse) {
        switch(request.cmd) {
            case 'updatedWatchlistStorage':
                sendResponse();
                loadTable('watchlist', request);
                $('#watchlistTable').fadeIn();
                break;
            case 'updatedPortfolioStorage':
                sendResponse();
                loadTable('portfolio', request);
                $('#portfolioTable').fadeIn();
                break;
            case 'portfolioHistoricals':
                sendResponse();
                chartPortfolioHistoricals(request.data);
                break;
            case 'updateCryptoHoldings':
                sendResponse();
                loadTable('crypto', request.data);
                break;
            case 'updatedOptionHoldings':
                sendResponse();
                loadTable('options', request.data);
                break;
            case 'historicalBySymbol':
                sendResponse();
                chartBySymbol(request.data, request.data.symbol);
                break;
            case 'realtimeTotals':
                sendResponse();
                updatePortfolioChart(request.data);
                break;
            case 'httpFail':
                sendResponse();
                handleHttpFail(request.status);
                break;
        }
    });

});