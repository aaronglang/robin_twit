let THEMECOLORS = {
    upPrimary: 'rgba(0,200,5,1)',
    upLight: 'rgba(0,200,5,0.1)', 
    downPrimary: 'rgba(255,80,0,1)', 
    downLight: 'rgba(255,80,0,0.1)'
}

function chartFormatter(index, row) {
    // ANALYTICS
    ga('send', 'event', {
        'eventCategory': 'General',
        'eventAction': 'viewExpandedRow',
      });
    // END
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

function priceFormatter(value) {
    return `<span class="price">$${value}</span`;
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

function optionsSymbolFormatter(value) {
    let [symbol, id] = value.split('_');
    let anchor = `
        <a 
            href="https://robinhood.com/options/${id}" 
            target="_blank"><u style="color: var(--time-based-font-color)">${symbol}</u>
        </a>`;
    return anchor;
}

function cryptoSymbolFormatter(value) {
    let symbol = value.replace(/(?<=\w)(\-)?USD/g, '');
    let anchor = `
        <a 
            href="https://robinhood.com/crypto/${symbol}"
            target="_blank"><u style="color: var(--time-based-font-color)">${symbol}</u>
        </a>`;
    return anchor;
}

function rowStyle(row, index) {
    let css = {};
    if(row.percent > 0) css = {color: THEMECOLORS.upPrimary};
    else if(row.percent < 0) css = {color: THEMECOLORS.downPrimary};
    return {css};
}