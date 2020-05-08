let COLORTHEME;

function formatWatchlistTable(stocks) {
    let data = [];
    for(stock of stocks) {
        let obj = {};
        let price = (+stock.last_extended_hours_trade_price > 0) ? +stock.last_extended_hours_trade_price : +stock.last_trade_price;
        obj.price = price.toFixed(2);
        obj.symbol = stock.symbol;
        let percent = +((price / +stock.previous_close * 100) - 100).toFixed(2);
        obj.percent = percent;
        data.push(obj);
    }
    return data;
}

function getWatchlistValues() {
    chrome.storage.local.get(['watchlistValues'], (obj) => {
        let watchedStocks = obj.watchlistValues;
        let $table = $('#watchlistTable');
        let data = formatWatchlistTable(watchedStocks);
        if(data.length > 7) $table.attr('data-height', '450');
        $table.bootstrapTable('destroy');
        $table.bootstrapTable({data, onCollapseRow});
    });
}

// TABLE FUNCTIONS
function onCollapseRow(index, row, $detail) {
    console.log(index, row);
}

function onExpandRowMain(index, row, $detail) {
    $('#hideChart').find('i').replaceWith('<i class="fas fa-plus-circle"></i>');
    $('#myChart').slideUp();
}

function onCollapseRowMain(index, row, $detail) {
    $('#myChart').slideDown();
    $('#hideChart').find('i').replaceWith('<i class="fas fa-minus-circle"></i>');
}

function toggleMainChart() {
    if(($('#myChart').is(':visible'))) {
        $('#hideChart').find('i').replaceWith('<i class="fas fa-plus-circle"></i>');
        $('#myChart').slideUp();
    }
    else {
        $('#myChart').slideDown();
        $('#hideChart').find('i').replaceWith('<i class="fas fa-minus-circle"></i>');
    }
}

function chartFormatter(index, row) {
    let div = document.createElement('div');
    div.classList.add(row.symbol);
    // create canvas
    let ctx = document.createElement('canvas');
    ctx.height = '20';
    ctx.width = '50';
    ctx.id = row.symbol;
    div.appendChild(ctx);
    chrome.runtime.sendMessage({cmd: 'getHistoricalsBySymbol', symbol: row.symbol});
    return div;
}

function formatIndividualChart(data) {
    let ts = data.historicals.map(obj => moment(obj.begins_at));
    let nums = data.historicals.map(obj => (+obj.close_price).toFixed(2));
    if(data.bounds === 'trading') {
        for(i = 0; i < 5; i++) {
            let ogSpan = moment(data.open_time).subtract(5*(i+1), 'minutes');
            nums.unshift((+data.previous_close_price).toFixed(2));
            ts.unshift(ogSpan);
        }
    }
    return {ts, nums};
}

async function chartBySymbol(data) {
    let symbol = data.symbol;
    let formatted = formatIndividualChart(data);
    let previousDay = +data.previous_close_price || formatted.nums[0];
    let latestPrice = +data.historicals.pop().close_price;
    let dollarGain = latestPrice - previousDay;
    let span = data.span;
    let percent = (dollarGain/previousDay * 100).toFixed(2);
    $(`.${symbol}`).find('h6').remove();
    $(`.${data.symbol}`).prepend(`
        <h6>
            ${(dollarGain > 0) ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-arrow-down"></i>'} 
            $${Math.abs(dollarGain).toFixed(2)}
            <span style="float: right;">${data.symbol}&nbsp;${(percent > 0) ? `+${percent}%` : `${percent}%`}</span>
        </h6>
    `);
    addSpanButtons(data.symbol, span);
    linearStockChart(formatted, symbol, true, (span === 'day'));
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
    let lightThemeColor = (COLORTHEME === 'light') ? '#21ce9933' : 'grey';
    $current.find(`#${span}`).css({'color': 'white', 'background-color': lightThemeColor});
}

function getOwnedStocks() {
    chrome.storage.local.get(['portfolioValues', 'portfolioHistoricals', 'realtimeTotals'], (obj) => {
        let ownedStocks = obj.portfolioValues;
        let realtime = obj.realtimeTotals;
        let historicals = obj.portfolioHistoricals;
        historicals.previousCloseAmount = realtime.previous_close.amount;
        historicals.realtimeTotal = realtime.total_equity.amount;
        if(($('#chartContainer').is(":visible"))) {
            linearStockChart(historicals, 'myChart');
        }
        let $table = $('#portfolioTable'); 
        let data = formatWatchlistTable(ownedStocks);
        if(data.length > 7) $table.attr('data-height', '500');
        chrome.storage.sync.set({currentUrl: `https://robinhood.com/stocks/${data[0].symbol}`});
        $table.bootstrapTable('destroy');
        $table.bootstrapTable({
            data, 
            onExpandRow: onExpandRowMain, 
            onCollapseRow: onCollapseRowMain
        });
    });
};

function loadTable(type) {
    switch (type) {
        case 'watchlist':
            getWatchlistValues();
            break;
        case 'portfolio':
            getOwnedStocks();
            break;
    }
}

function priceFormatter(value) {
    return `$${value}`;
}

function percentFormatter(value) {
    return (value > 0) ? `+${value}%` : `${value}%`;
}

function symbolFormatter(value) {
    let anchor = `
        <a 
            href="https://robinhood.com/stocks/${value}" 
            target="_blank"><u style="color: var(--time-based-font-color)">${value}</u>
        </a>`;
    return anchor;
}

function rowStyle(row, index) {
    let css = {};
    if(row.percent > 0) css = {color: '#21ce99'};
    else if(row.percent < 0) css = {color: '#f45531'};
    return {css};
}

function handleHttpFail(errCode) {
    switch (errCode) {
        case 401:
            $('#popupBody').empty();
            $('#popupBody').append(`
                <div id="unauthorized" class="container">
                    <a href="https://robinhood.com/login" target="_blank">Please log in to continue</a>
                </div>
            `);
            break;
        case 400:
            $('#popupBody').empty();
            $('#popupBody').append(`
                <div id="unauthorized" class="container">
                    An error occured, please try again later!
                </div>
            `);
            break;
    }
}

function formatChartData(data) {
    let ts = data.equity_historicals.map(obj => moment(obj.begins_at));
    let nums = data.equity_historicals.map(obj => (+obj.close_equity).toFixed(2));
    // add values from previous day
    for(i = 0; i < 10; i++) {
        let ogSpan = moment(data.open_time).subtract(5*(i+1), 'minutes');
        nums.unshift((+data.previous_close_equity).toFixed(2));
        ts.unshift(ogSpan);
        if(i > 7) {
            nums.push((+data.realtimeTotal).toFixed(2));
            ts.push(moment());
        }
    }
    return {ts, nums};
}

let prev_total = 0;
function setTotals(data) {
    let $cont = $('#totals');
    let previousDay = +data.previousCloseAmount;
    let last = +data.realtimeTotal; //+data.equity_historicals.pop().close_equity;
    let gl = last - previousDay;
    let color = (gl > prev_total) ? '#21ce99' : (gl < prev_total) ? '#f45531' : '';
    let icolor = (gl > 0) ? '#21ce99' : (gl < 0) ? '#f45531' : '';
    prev_total = gl;
    $cont.empty().prepend(`
        <h4 id="totalEq" class="animated">$${last.toFixed(2)}</h4><span id="hideChart"><i class="fas fa-minus-circle"></i></span>
        <h6 id="totalDay" class="animated pulse">${
            (gl > 0) ? '<i class="fas fa-arrow-up"></i>' : (gl < 0) ? '<i class="fas fa-arrow-down"></i>' : ''
        } <span id="eq">$${Math.abs(gl).toFixed(2)}&nbsp;(${Math.abs(gl/last * 100).toFixed(2)}%)</span></h6>
    `);
    $('#totalDay').find('.fas').css({color: icolor});
    $('#eq').css({color});
    setTimeout( () => {
        $('#eq').css({color: ''});
    }, 1000);
}

let PORTCHART;
let SYMBCHART = {};

function updatePortfolioChart(updateData) {
    if(PORTCHART && ($('#chartContainer').is(":visible"))) {
        setTotals({
            previousCloseAmount: updateData.previous_close.amount, 
            realtimeTotal: updateData.total_equity.amount
        });
        if(($('#myChart').is(":visible"))) {
            PORTCHART.data.datasets[0].data.push(updateData.total_equity.amount);
            PORTCHART.data.labels.push(moment());
            PORTCHART.update();
        }
    }
}

function linearStockChart(portfolioData, chartId, individual, isDay = true) {
    let data;
    if(!individual) {
        if(PORTCHART) PORTCHART.destroy();
        setTotals(portfolioData);
        data = formatChartData(portfolioData);
    } else {
        if(SYMBCHART[chartId]) SYMBCHART[chartId].destroy();
        data = portfolioData;
    }
    let tsFormatter = isDay ? 'H:mm' : 'MM/DD/YYYY';
    let ctx = document.getElementById(chartId);
    let isUp = (+data.nums.pop() > +data.nums[0]);
    console.log(data.nums.pop(), data.nums[0], isUp);
    let lineColor = isUp ? '#21ce9933' : '#f4553166';
    let fillColor = isUp ? '#21ce99' : '#f45531';
    CHART = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.ts,
            datasets: [{ 
                data: data.nums,
                borderColor: fillColor,
                backgroundColor: lineColor,
                pointRadius: 0,
                pointHoverRadius: 5,
            }],
        },
        options: {
            tooltips: {
                mode: 'nearest',
                displayColors: false,
                titleFontSize: 14,
                bodyFontSize: 14,
                intersect: false,
                callbacks: {
                    label: function(tooltipItem, data) {
                        console.log(tooltipItem);
                        let ts = moment(+tooltipItem.label).format(tsFormatter);
                        return ts;
                    },
                    title: function(tooltipItem, data) {
                        console.log(tooltipItem);
                        return `$${tooltipItem[0].value}`;
                    },

                }
            },
            legend: {
                display: false
            },
            hover: {
                intersect: false,
                animationDuration: 100
            },
            scales: {
                yAxes: [{
                    gridLines: {
                        display: false
                    },
                    ticks: {
                        suggestedMin: data.nums[0],
                        display: false
                    }
                }],
                xAxes: [{
                    gridLines: {
                        display: false
                    },
                    ticks: {
                        display: false
                    }
                }]
            }
        }
    });
    if(!individual) {
        CHART.render();
        PORTCHART = CHART;
    } else {
        CHART.render();
        SYMBCHART[chartId] = CHART;
    }
}

$('document').ready( function() {
    
    chrome.runtime.sendMessage({cmd: 'updateStockValues'});
    
    $('#tweetContainer').hide();

    $('#portfolio').click( function() {
        chrome.runtime.sendMessage({cmd: 'updateStockValues'});
        $('#tweetContainer').hide();
        $('#watchlistContainer').hide();
        $('#portfolioContainer').find('#portfolioTable').fadeOut();
        $('.portfolio').addClass('fadeInLeft').show();
    });

    $('#watchlist').click( function() {
        chrome.runtime.sendMessage({cmd: 'updateStockValues'});
        $('#tweetContainer').hide();
        $('.portfolio').hide();
        $('#watchlistContainer').find('#watchlistTable').fadeOut();
        $('#watchlistContainer').addClass('fadeInLeft').show();
        $('#refresh').show();
    });

    $('#twitFeed').click( function() {
        $('.portfolio').hide();
        $('.tables').hide();
        $('#tweetContainer').fadeIn();
    });

    $('body').on('click', '#refresh', function() {
        $('#portfolioTable').fadeOut();
        $('#watchlistTable').fadeOut();
        chrome.runtime.sendMessage({cmd: 'updateStockValues'});
    });

    $('body').on('click', '.spanners .col', function() {
        let lightThemeColor = (COLORTHEME === 'light') ? '#21ce9933' : 'grey';
        let $current = $(this);
        $current.parent().find('.col').css({'color': '', 'background-color': ''});
        $current.css({'color': 'white', 'background-color': lightThemeColor});
        let symbol = $current.parent().parent().parent().attr('class');
        let span = $current.attr('id');
        chrome.runtime.sendMessage({cmd: 'getHistoricalsBySymbol', symbol, span});
    });

    $('body').on('click', '#hideChart', function() {
        toggleMainChart();
    });

    $('body').on('click', '.popup-button-md', function() {
        $('.highlightButton').removeClass('highlightButton');
        $(this).addClass('highlightButton');
    });

    $('.tables').each(function () {
        $(this).load(chrome.extension.getURL('./popupPortfolioTable.html'), () => {
            if($(this).attr('id') === 'watchlistContainer') {
                // set watchlist table 
                $(this).find('.tableContainer').prepend(`
                    <h5 style="color: var(--time-based-font-color)" id="tableTitle"><strong>Your Watchlist Items</strong></h5>
                `);
                $(this).find('table').attr('id', 'watchlistTable');
                $(this).find('table').attr('data-toolbar', '#watchlistToolbar');
                $(this).find('#toolbar').attr('id', 'watchlistToolbar');
                $(this).hide();
            } else {
                $(this).find('.tableContainer').prepend(`
                    <br>
                    <h5 style="color: var(--time-based-font-color)" id="tableTitle"><strong>Stock Holdings</strong></h5>
                `);
            }
            // get theme colors
            chrome.storage.sync.get(['colors'], (obj) => {
                if(obj.colors) {
                    let backgroundColor = obj.colors[0];
                    if(backgroundColor !== 'white') {
                        COLORTHEME = 'dark';
                        $('.table').addClass('table-dark');
                    } else COLORTHEME = 'light';
                }
            });
            $('.table').removeClass('table-hover');
            // show portfolio
            $('.portfolio').addClass('fadeInLeft').show();
        });
    });

    setInterval(() => {
        chrome.runtime.sendMessage({cmd: 'getRealTimeTotals'});
    }, 5000);

    chrome.runtime.onMessage.addListener( async function(request, sender, sendResponse) {
        switch(request.cmd) {
            case 'updatedWatchlistStorage':
                sendResponse();
                loadTable('watchlist');
                $('#watchlistTable').fadeIn();
                break;
            case 'updatedPortfolioStorage':
                sendResponse();
                loadTable('portfolio');
                $('#portfolioTable').fadeIn();
                break;
            case 'historicalBySymbol':
                sendResponse();
                chartBySymbol(request.data);
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